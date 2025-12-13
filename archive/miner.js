// Nostrcoin Validation Library v0.0.2 — FIXED MINING VALIDATION
// Pure JavaScript - works in browser or Node.js
// No dependencies, fully deterministic

const NOSTRCOIN = {
  MAX_SUPPLY: 21000000,
  DECIMALS: 8,
  BLOCK_REWARD: 50,
  BLOCK_INTERVAL: 600000, // 10 minutes in milliseconds
  DIFFICULTY: 4, // Leading zeros required in event ID

  KIND_GENESIS: 30000,
  KIND_MINING: 30333,
  KIND_TRANSFER: 30334,

  PROTOCOL_TAG: "nostrcoin",

  // Genesis: Wed Nov 27 2025 00:00:00 UTC
  GENESIS_TIME: 1764182400000
};

/**
 * Get the current epoch number based on timestamp
 */
function getEpoch(timestamp) {
  const elapsed = timestamp - NOSTRCOIN.GENESIS_TIME;
  return Math.max(0, Math.floor(elapsed / NOSTRCOIN.BLOCK_INTERVAL));
}

/**
 * Validate a mining event — FIXED tie-breaker
 */
function validateMiningEvent(event, existingEvents = []) {
  if (!event.id || !event.pubkey || !event.created_at) {
    return { valid: false, reason: "Missing required fields" };
  }

  const protocolTag = event.tags?.find(t => t[0] === 'protocol' && t[1] === NOSTRCOIN.PROTOCOL_TAG);
  if (!protocolTag) {
    return { valid: false, reason: "Missing or invalid protocol tag" };
  }

  const requiredZeros = '0'.repeat(NOSTRCOIN.DIFFICULTY);
  if (!event.id.startsWith(requiredZeros)) {
    return { valid: false, reason: `Event ID must start with ${NOSTRCOIN.DIFFICULTY} zeros` };
  }

  const epoch = getEpoch(event.created_at * 1000);

  const epochWinner = existingEvents.find(e => {
    const eEpoch = getEpoch(e.created_at * 1000);
    return eEpoch === epoch && e.id !== event.id;
  });

  if (epochWinner) {
    // Earlier timestamp wins
    if (event.created_at < epochWinner.created_at) {
      return { valid: true, reason: "Earlier than existing winner", reward: NOSTRCOIN.BLOCK_REWARD, replacesEvent: epochWinner.id };
    }
    // Same second → lexicographically smaller ID wins
    if (event.created_at === epochWinner.created_at && event.id < epochWinner.id) {
      return { valid: true, reason: "Tie-breaker winner", reward: NOSTRCOIN.BLOCK_REWARD, replacesEvent: epochWinner.id };
    }
    return { valid: false, reason: "Epoch already has a winner" };
  }

  // No winner yet — this is the winner
  return { valid: true, reason: "First valid event in epoch", reward: NOSTRCOIN.BLOCK_REWARD, epoch };
}

// The rest of your functions (getHistory, computeBalances, etc.) are perfect — unchanged
// ... (everything below this line stays exactly as you had it)

function getHistory(pubkey, events) {
  const history = [];
  const sortedEvents = [...events].sort((a, b) => a.created_at - b.created_at);

  for (const event of sortedEvents) {
    if (event.kind === NOSTRCOIN.KIND_MINING && event.pubkey === pubkey) {
      const validation = validateMiningEvent(event, sortedEvents.slice(0, sortedEvents.indexOf(event)));
      if (validation.valid) {
        history.push({
          type: 'mined',
          amount: validation.reward || NOSTRCOIN.BLOCK_REWARD,
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
          history.push({
            type: 'sent',
            amount: -amount,
            recipient: recipient,
            timestamp: event.created_at,
            eventId: event.id
          });
        } else if (recipient === pubkey) {
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

async function hashData(data) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else if (typeof require !== 'undefined') {
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
    getHistory,
    hashData
  };
}

if (typeof window !== 'undefined') {
  window.NostrcoinValidator = {
    NOSTRCOIN,
    getEpoch,
    validateMiningEvent,
    getHistory,
    hashData
  };
}
