// Nostrcoin Validation Library v0.0.2
// Pure JavaScript - works in browser or Node.js
// No dependencies, fully deterministic

const NOSTRCOIN = {
  // Protocol constants
  MAX_SUPPLY: 21000000,
  DECIMALS: 8,
  BLOCK_REWARD: 50,
  BLOCK_INTERVAL: 600000, // 10 minutes in milliseconds
  DIFFICULTY: 4, // Leading zeros required in event ID
  
  // Event kinds (custom Nostrcoin kinds)
  KIND_GENESIS: 30000,
  KIND_MINING: 30333,    // NSTC mining attempts
  KIND_TRANSFER: 30334,  // NSTC transfers
  
  // Protocol identifier
  PROTOCOL_TAG: "nostrcoin",
  
  // Genesis block timestamp (set this to your launch time)
  GENESIS_TIME: 1764968400000   // Wed Nov 27 2025 00:00:00 UTC
};

/**
 * Get the current epoch number based on timestamp
 */
function getEpoch(timestamp) {
  const elapsed = timestamp - NOSTRCOIN.GENESIS_TIME;
  return Math.max(0, Math.floor(elapsed / NOSTRCOIN.BLOCK_INTERVAL));  // Clamp to >=0
}

/**
 * Validate a mining event
 * Returns: { valid: boolean, reason?: string, reward?: number }
 */
function validateMiningEvent(event, existingEvents = []) {
  // 1. Check event structure
  if (!event.id || !event.pubkey || !event.created_at) {
    return { valid: false, reason: "Missing required fields" };
  }
  
  // 2. Check protocol tag
  const protocolTag = event.tags?.find(t => t[0] === 'protocol' && t[1] === NOSTRCOIN.PROTOCOL_TAG);
  if (!protocolTag) {
    return { valid: false, reason: "Missing or invalid protocol tag" };
  }
  
  // 3. Check difficulty (event ID must have N leading zeros)
  const requiredZeros = '0'.repeat(NOSTRCOIN.DIFFICULTY);
  if (!event.id.startsWith(requiredZeros)) {
    return { valid: false, reason: `Event ID must start with ${NOSTRCOIN.DIFFICULTY} zeros` };
  }
  
  // 4. Determine epoch from timestamp
  const epoch = getEpoch(event.created_at * 1000); // Nostr uses seconds
  
  // 5. Check if this epoch already has a winner
  const epochWinner = existingEvents.find(e => {
    const eventEpoch = getEpoch(e.created_at * 1000);
    return eventEpoch === epoch && e.id !== event.id;
  });
  
  if (epochWinner) {
  // If there's already a winner, check if this event is earlier
  if (event.created_at < epochWinner.created_at) {
    return { valid: true, reason: "Earlier than existing winner", reward: NOSTRCOIN.BLOCK_REWARD, replacesEvent: epochWinner.id };
  }

  // Tie: same timestamp → lexicographically smaller ID wins
  if (event.created_at === epochWinner.created_at && event.id < epochWinner.id) {
    return { valid: true, reason: "Tie-breaker winner", reward: NOSTRCOIN.BLOCK_REWARD, replacesEvent: epochWinner.id };
  }

  return { valid: false, reason: "Epoch already has a winner" };
}
  
  // 6. Check user hasn't mined multiple times in same epoch (spam prevention)
  const userAttemptsThisEpoch = existingEvents.filter(e => {
    const eventEpoch = getEpoch(e.created_at * 1000);
    return e.pubkey === event.pubkey && eventEpoch === epoch;
  });
  
  if (userAttemptsThisEpoch.length > 0) {
    return { valid: false, reason: "User already attempted mining this epoch" };
  }
  
  return { valid: true, reward: NOSTRCOIN.BLOCK_REWARD, epoch };
}

/**
 * Validate a transfer event
 * Returns: { valid: boolean, reason?: string, amount?: number, recipient?: string }
 */
function validateTransferEvent(event, currentBalances = {}) {
  // 1. Check event structure
  if (!event.id || !event.pubkey || !event.sig) {
    return { valid: false, reason: "Missing required fields" };
  }
  
  // 2. Check protocol tag
  const protocolTag = event.tags?.find(t => t[0] === 'protocol' && t[1] === NOSTRCOIN.PROTOCOL_TAG);
  if (!protocolTag) {
    return { valid: false, reason: "Missing or invalid protocol tag" };
  }
  
  // 3. Extract recipient and amount from tags
  const recipientTag = event.tags.find(t => t[0] === 'p');
  const amountTag = event.tags.find(t => t[0] === 'amount');
  
  if (!recipientTag || !amountTag) {
    return { valid: false, reason: "Missing recipient or amount tag" };
  }
  
  const recipient = recipientTag[1];
  const amount = parseFloat(amountTag[1]);
  
  // 4. Validate amount
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, reason: "Invalid amount" };
  }
  
  if (amount > Math.pow(10, NOSTRCOIN.DECIMALS)) {
    return { valid: false, reason: "Amount exceeds maximum precision" };
  }
  
  // 5. Check sender balance
  const senderBalance = currentBalances[event.pubkey] || 0;
  if (senderBalance < amount) {
    return { valid: false, reason: `Insufficient balance (has ${senderBalance}, needs ${amount})` };
  }
  
  // 6. Prevent sending to self
  if (event.pubkey === recipient) {
    return { valid: false, reason: "Cannot send to self" };
  }
  
  return { valid: true, amount, recipient, sender: event.pubkey };
}

/**
 * Compute current balances from event history
 * Returns: { balances: {pubkey: amount}, totalSupply: number }
 */
function computeBalances(events) {
  const balances = {};
  let totalSupply = 0;
  
  // Sort events by timestamp, then by ID (for deterministic ordering)
  const sortedEvents = [...events].sort((a, b) => {
    if (a.created_at !== b.created_at) {
      return a.created_at - b.created_at;
    }
    return a.id.localeCompare(b.id);
  });
  
  // Track which epochs have been mined
  const minedEpochs = new Set();
  
  for (const event of sortedEvents) {
    if (event.kind === NOSTRCOIN.KIND_MINING) {
      const validation = validateMiningEvent(event, sortedEvents.slice(0, sortedEvents.indexOf(event)));
      
      if (validation.valid) {
        const epoch = getEpoch(event.created_at * 1000);
        
        // Only award if epoch not already mined
        if (!minedEpochs.has(epoch)) {
          balances[event.pubkey] = (balances[event.pubkey] || 0) + validation.reward;
          totalSupply += validation.reward;
          minedEpochs.add(epoch);
        }
      }
    }
    
    if (event.kind === NOSTRCOIN.KIND_TRANSFER) {
      const validation = validateTransferEvent(event, balances);
      
      if (validation.valid) {
        balances[validation.sender] = (balances[validation.sender] || 0) - validation.amount;
        balances[validation.recipient] = (balances[validation.recipient] || 0) + validation.amount;
      }
    }
  }
  
  return { balances, totalSupply };
}

/**
 * Get balance for a specific pubkey
 */
function getBalance(pubkey, events) {
  const { balances } = computeBalances(events);
  return balances[pubkey] || 0;
}

/**
 * Get transaction history for a specific pubkey
 */
function getHistory(pubkey, events) {
  const history = [];
  
  const sortedEvents = [...events].sort((a, b) => a.created_at - b.created_at);
  
  for (const event of sortedEvents) {
    if (event.kind === NOSTRCOIN.KIND_MINING && event.pubkey === pubkey) {
      const validation = validateMiningEvent(event, sortedEvents.slice(0, sortedEvents.indexOf(event)));
      if (validation.valid) {
        history.push({
          type: 'mined',
          amount: validation.reward,
          timestamp: event.created_at,
          eventId: event.id
        });
      }
    }
    
    if (event.kind === NOSTRCOIN.KIND_TRANSFER) {
      const recipientTag = event.tags.find(t => t[0] === 'p');
      const amountTag = event.tags.find(t => t[0] === 'amount');
      
      if (recipientTag && amountTag) {
        const recipient = recipientTag[1];
        const amount = parseFloat(amountTag[1]);
        
        if (event.pubkey === pubkey) {
          // Sent
          history.push({
            type: 'sent',
            amount: -amount,
            recipient: recipient,
            timestamp: event.created_at,
            eventId: event.id
          });
        } else if (recipient === pubkey) {
          // Received
          history.push({
            type: 'received',
            amount: amount,
            sender: event.pubkey,
            timestamp: event.created_at,
            eventId: event.id
          });
        }
      }
    }
  }
  
  return history;
}

/**
 * Hash function for mining (SHA-256)
 * Works in both browser and Node.js
 */
async function hashData(data) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Browser
    const encoded = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else if (typeof require !== 'undefined') {
    // Node.js
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  throw new Error('No crypto implementation available');
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NOSTRCOIN,
    getEpoch,
    validateMiningEvent,
    validateTransferEvent,
    computeBalances,
    getBalance,
    getHistory,
    hashData
  };
}

if (typeof window !== 'undefined') {
  window.NostrcoinValidator = {
    NOSTRCOIN,
    getEpoch,
    validateMiningEvent,
    validateTransferEvent,
    computeBalances,
    getBalance,
    getHistory,
    hashData
  };
}
