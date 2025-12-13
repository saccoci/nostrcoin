// Nostrcoin Indexer Node v0.0.6 – Polling Strategy
const http = require('http');
const { WebSocket } = require('ws');
const validator = require('./nostrcoin-validator.js');

// Configuration
const CONFIG = {
  port: 3000,
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nostr.mom',
    'wss://relay.primal.net',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://offchain.pub'
  ],
  eventKinds: [
    validator.NOSTRCOIN.KIND_MINING,
    validator.NOSTRCOIN.KIND_TRANSFER
  ],
  pollInterval: 15000 // Poll every 15 seconds
};

let events = [];
let lastPollTime = Math.floor(Date.now() / 1000) - 3600; // Start 1 hour ago

function pollRelay(relayUrl) {
  return new Promise((resolve) => {
    const ws = new WebSocket(relayUrl);
    const receivedEvents = [];
    let timeout;

    ws.on('open', () => {
      // Query for events since last poll
      const subId = 'poll-' + Date.now();
      ws.send(JSON.stringify(['REQ', subId, { 
        kinds: CONFIG.eventKinds,
        since: lastPollTime
      }]));

      // Close after 5 seconds
      timeout = setTimeout(() => {
        ws.close();
        resolve(receivedEvents);
      }, 5000);
    });

    ws.on('message', data => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'EVENT') {
          receivedEvents.push(msg[2]);
        }
        if (msg[0] === 'EOSE') {
          clearTimeout(timeout);
          ws.close();
          resolve(receivedEvents);
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    ws.on('error', () => {
      clearTimeout(timeout);
      resolve(receivedEvents);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      resolve(receivedEvents);
    });
  });
}

async function pollAllRelays() {
  console.log(`\n🔍 Polling relays for new events (since ${new Date(lastPollTime * 1000).toLocaleTimeString()})...`);
  console.log(`   Query: kinds=[${CONFIG.eventKinds}], since=${lastPollTime} (${new Date(lastPollTime * 1000).toISOString()})`);
  
  const promises = CONFIG.relays.map(relay => pollRelay(relay));
  const results = await Promise.allSettled(promises);
  
  let newEventsCount = 0;
  let totalEventsReceived = 0;
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      totalEventsReceived += result.value.length;
      if (result.value.length > 0) {
        console.log(`  ✓ ${CONFIG.relays[index]}: ${result.value.length} events`);
        result.value.forEach(event => {
          console.log(`     Event ${event.id.slice(0, 8)}... created at ${new Date(event.created_at * 1000).toISOString()}`);
          if (handleEvent(event, CONFIG.relays[index])) {
            newEventsCount++;
          }
        });
      }
    } else {
      console.log(`  ✗ ${CONFIG.relays[index]}: failed`);
    }
  });
  
  console.log(`  Total received: ${totalEventsReceived} events, ${newEventsCount} new`);
  
  if (newEventsCount > 0) {
    console.log(`✨ Added ${newEventsCount} new events to index`);
  } else if (totalEventsReceived === 0) {
    console.log(`  No events found on any relay`);
  }
  
  // Update last poll time to now
  lastPollTime = Math.floor(Date.now() / 1000);
}

function handleEvent(event, relayUrl) {
  // Skip if we already have this exact event
  if (events.some(e => e.id === event.id)) return false;

  // Check for protocol tag
  const hasTag = event.tags?.some(t => t[0] === 'protocol' && t[1] === validator.NOSTRCOIN.PROTOCOL_TAG);
  if (!hasTag) return false;

  console.log(`  → New NSTC event from ${relayUrl} – kind ${event.kind} – ${event.pubkey.slice(0,8)}...`);

  if (event.kind === validator.NOSTRCOIN.KIND_MINING) {
    const epoch = validator.getEpoch(event.created_at * 1000);
    
    // Check if there's an existing event for this epoch
    const existingEpochEvent = events.find(e => {
      if (e.kind !== validator.NOSTRCOIN.KIND_MINING) return false;
      const eEpoch = validator.getEpoch(e.created_at * 1000);
      return eEpoch === epoch;
    });

    if (existingEpochEvent) {
      // Earlier timestamp wins
      if (event.created_at < existingEpochEvent.created_at) {
        console.log(`     Replacing old block for epoch ${epoch}`);
        events = events.filter(e => e.id !== existingEpochEvent.id);
        events.push(event);
        return true;
      }
      
      // Same timestamp - lexicographically smaller ID wins
      if (event.created_at === existingEpochEvent.created_at && event.id < existingEpochEvent.id) {
        console.log(`     Replacing old block (tie-breaker) for epoch ${epoch}`);
        events = events.filter(e => e.id !== existingEpochEvent.id);
        events.push(event);
        return true;
      }
      
      // Existing block is better
      console.log(`     Rejected (existing block better) for epoch ${epoch}`);
      return false;
    }

    // No existing block for this epoch - validate and add
    const v = validator.validateMiningEvent(event, events);
    if (v.valid) {
      console.log(`     ✓ Valid mining! Epoch ${epoch} → +50 NSTC`);
      events.push(event);
      return true;
    } else {
      console.log(`     ✗ Invalid: ${v.reason}`);
      return false;
    }
  }

  if (event.kind === validator.NOSTRCOIN.KIND_TRANSFER) {
    console.log(`     ✓ Valid transfer`);
    events.push(event);
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (url.pathname.startsWith('/balance/')) {
    const pubkey = url.pathname.split('/')[2];
    const balance = validator.getBalance(pubkey, events);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pubkey, balance, timestamp: Date.now() }));
    return;
  }

  if (url.pathname.startsWith('/history/')) {
    const pubkey = url.pathname.split('/')[2];
    const history = validator.getHistory(pubkey, events);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pubkey, history, timestamp: Date.now() }));
    return;
  }

  if (url.pathname === '/stats') {
    const result = validator.computeBalances(events);
    const totalSupply = result.totalSupply || 0;
    const uniqueHolders = Object.keys(result.balances || {}).length;
    const currentEpoch = validator.getEpoch(Date.now());

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalSupply,
      uniqueHolders,
      totalEvents: events.length,
      currentEpoch,
      connectedRelays: CONFIG.relays.length,
      timestamp: Date.now()
    }));
    return;
  }

  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      events: events.map(e => ({
        id: e.id,
        kind: e.kind,
        pubkey: e.pubkey,
        created_at: e.created_at,
        epoch: e.kind === validator.NOSTRCOIN.KIND_MINING ? validator.getEpoch(e.created_at * 1000) : undefined
      })),
      total: events.length
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

async function start() {
  console.log('Nostrcoin Indexer v0.0.6 – Polling Strategy');
  console.log('============================================\n');
  
  server.listen(CONFIG.port, () => {
    console.log(`HTTP API → http://0.0.0.0:${CONFIG.port}`);
    console.log('Endpoints: /stats  /events  /balance/:pubkey  /history/:pubkey\n');
  });

  // Do initial poll
  await pollAllRelays();
  
  // Set up polling interval
  setInterval(pollAllRelays, CONFIG.pollInterval);
  console.log(`\n⏰ Polling every ${CONFIG.pollInterval/1000} seconds\n`);
}

process.on('SIGINT', () => {
  server.close();
  process.exit(0);
});

start();