// Nostrcoin Continuous Miner v0.0.5 - Using nostr-tools
require('dotenv').config();
const crypto = require('crypto');
const { WebSocket } = require('ws');
const { finalizeEvent } = require('nostr-tools/pure');
const { hexToBytes } = require('@noble/hashes/utils');

// Configuration
const CONFIG = {
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nostr.mom',
    'wss://relay.primal.net',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://offchain.pub'
  ],
  eventKind: 30333,
  difficulty: 5,
  protocolTag: 'nostrcoin',
  indexerUrl: 'http://localhost:3000'
};

// State
let mining = false;
let stats = {
  attempts: 0,
  blocksFound: 0,
  startTime: null,
  lastBlockTime: null
};

// Your Nostr keys
let privateKeyHex = process.env.NOSTR_PRIVATE_KEY_HEX || null;
let privateKey = null;
let publicKey = null;

/**
 * Publish event to relays
 */
async function publishToRelays(event) {
  const promises = CONFIG.relays.map(relayUrl => {
    return new Promise((resolve) => {
      const ws = new WebSocket(relayUrl);
      let receivedOK = false;
      let receivedMessage = false;

      ws.on('open', () => {
        ws.send(JSON.stringify(['EVENT', event]));
      });

      ws.on('message', (data) => {
        receivedMessage = true;
        try {
          const msg = JSON.parse(data.toString());
          if (msg[0] === 'OK') {
            receivedOK = true;
            if (msg[2]) {
              console.log(`  ✓ ${relayUrl}: Accepted`);
            } else {
              console.log(`  ✗ ${relayUrl}: Rejected - ${msg[3] || 'unknown'}`);
            }
          }
        } catch (e) {}
      });

      ws.on('error', () => {
        resolve(false);
      });

      setTimeout(() => {
        if (!receivedMessage) {
          console.log(`  ? ${relayUrl}: No response`);
        }
        ws.close();
        resolve(receivedOK);
      }, 3000);
    });
  });

  const results = await Promise.allSettled(promises);
  const successful = results.filter(r => r.value === true).length;
  return successful;
}

/**
 * Check balance from indexer
 */
async function checkBalance() {
  try {
    const response = await fetch(`${CONFIG.indexerUrl}/balance/${publicKey}`);
    const data = await response.json();
    return data.balance || 0;
  } catch (error) {
    return null;
  }
}

/**
 * Mine a single block
 */
async function mineBlock(targetEpoch) {
  const target = '0'.repeat(CONFIG.difficulty);
  let attempts = 0;
  const startTime = Date.now();

  const spinners = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let spinnerIndex = 0;

  while (mining) {
    const nonce = crypto.randomBytes(8).toString('hex');

    const event = {
      kind: CONFIG.eventKind,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['protocol', CONFIG.protocolTag],
        ['difficulty', CONFIG.difficulty.toString()],
        ['nonce', nonce]
      ],
      content: 'Mining NSTC',
      pubkey: publicKey
    };

    // Calculate event ID
    const serialized = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content
    ]);
    const eventId = crypto.createHash('sha256').update(serialized).digest('hex');

    const currentEpoch = Math.floor((Date.now() - 1764968400000) / 600000);

    // Check if we've moved to a new epoch
    if (currentEpoch !== targetEpoch) {
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      return false;
    }

    attempts++;
    stats.attempts++;

    // Update display every 1000 attempts
    if (attempts % 1000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const hashRate = Math.round(attempts / elapsed);
      spinnerIndex = (spinnerIndex + 1) % spinners.length;
      process.stdout.write(
        `\r${spinners[spinnerIndex]} Mining epoch ${currentEpoch} | ` +
        `${attempts.toLocaleString()} attempts | ` +
        `${hashRate.toLocaleString()} H/s`
      );
    }

    // Check if valid proof-of-work
    if (eventId.startsWith(target)) {
      const elapsed = (Date.now() - startTime) / 1000;
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      console.log(`✨ BLOCK FOUND! Event ID: ${eventId}`);
      console.log(`   Attempts: ${attempts.toLocaleString()} | Time: ${elapsed.toFixed(2)}s`);

      // Sign the event properly with nostr-tools
      event.id = eventId;
      const signedEvent = finalizeEvent(event, privateKey);

      // Publish to relays
      console.log('📡 Publishing to relays...');
      const successful = await publishToRelays(signedEvent);
      console.log(`   Published to ${successful}/${CONFIG.relays.length} relays`);

      stats.blocksFound++;
      stats.lastBlockTime = new Date().toLocaleString();

      // Wait 5 seconds for indexer to process
      console.log('⏳  Waiting for indexer to process...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check new balance
      const balance = await checkBalance();
      if (balance !== null) {
        console.log(`💰 Current balance: ${balance} NSTC`);
      } else {
        console.log('⚠️  Could not fetch balance from indexer');
      }

      return true;
    }
  }

  return false;
}

/**
 * Continuous mining loop
 */
async function startMining() {
  mining = true;
  stats.startTime = new Date().toLocaleString();

  console.log('\n🚀 Starting epoch-aware continuous mining...');
  console.log(`👤 Public key: ${publicKey.substring(0, 16)}...`);
  console.log(`💎 Reward: 50 NSTC per block\n`);

  while (mining) {
    const now = Date.now();
    const currentEpoch = Math.floor((now - 1764968400000) / 600000);
    const nextEpochStart = 1764968400000 + (currentEpoch + 1) * 600000;

    await mineBlock(currentEpoch);

    // Always wait for next epoch
    const waitMs = nextEpochStart - Date.now();
    if (waitMs > 0 && mining) {
      console.log(`⏸️  Waiting ${(waitMs/1000).toFixed(0)}s for epoch ${currentEpoch + 1}...`);
      await new Promise(r => setTimeout(r, waitMs + 1000));
    }
  }
}

/**
 * Display statistics
 */
function displayStats() {
  console.log('\n📊 Mining Statistics:');
  console.log(`   Started: ${stats.startTime}`);
  console.log(`   Blocks found: ${stats.blocksFound}`);
  console.log(`   Total attempts: ${stats.attempts.toLocaleString()}`);
  if (stats.lastBlockTime) {
    console.log(`   Last block: ${stats.lastBlockTime}`);
  }
  console.log('');
}

/**
 * Main entry point
 */
async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   Nostrcoin Continuous Miner v0.0.5   ║');
  console.log('╚═══════════════════════════════════════╝\n');

  // Load private key
  if (!privateKeyHex) {
    console.log('❌ Missing NOSTR_PRIVATE_KEY_HEX environment variable.');
    console.log('   Set it in your .env file.\n');
    process.exit(1);
  }

  privateKeyHex = privateKeyHex.trim();

  if (privateKeyHex.length !== 64) {
    console.log('\n❌ Invalid private key length. Must be 64 hex characters.');
    process.exit(1);
  }

  try {
    // Convert hex to bytes and derive public key using nostr-tools
    privateKey = hexToBytes(privateKeyHex);
    const { getPublicKey } = require('nostr-tools/pure');
    publicKey = getPublicKey(privateKey);

    console.log(`✓ Public key derived: ${publicKey.substring(0, 16)}...`);
    console.log(`✓ Public key length: ${publicKey.length}\n`);
  } catch (error) {
    console.log('\n❌ Invalid private key:', error.message);
    process.exit(1);
  }

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping miner...\n');
    mining = false;
    displayStats();
    process.exit(0);
  });

  // Check connection to indexer
  console.log('🔍 Checking connection to indexer...');
  const balance = await checkBalance();
  if (balance !== null) {
    console.log(`✓ Connected to indexer`);
    console.log(`💰 Current balance: ${balance} NSTC\n`);
  } else {
    console.log('⚠️  Could not connect to indexer, but mining will continue\n');
  }

  // Start mining
  await startMining();
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
