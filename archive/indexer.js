// Nostrcoin Indexer Node v0.0.4 – FIXED REPLACEMENT LOGIC
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
  ]
};

let events = [];
let connections = new Map();

function connectToRelay(relayUrl) {
  console.log(`Connecting to ${relayUrl}...`);
  const ws = new WebSocket(relayUrl);

  ws.on('open', () => {
    console.log(`Connected to ${relayUrl}`);
    connections.set(relayUrl, ws);

    // Subscribe to events from 1 hour ago to now (catches recent + new events)
    const since = Math.floor(Date.now() / 1000) - 3600;
    ws.send(JSON.stringify(['REQ', 'nstc-' + Date.now(), {
      kinds: CONFIG.eventKinds,
      since: since
    }]));
    console.log(`Subscribed to NSTC events (since: ${new Date(since * 1000).toISOString()})`);
  });

  ws.on('message', data => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg[0] === 'EVENT') handleEvent(msg[2], relayUrl);
    } catch (e) { /* ignore */ }
  });

  ws.on('close', () => {
    connections.delete(relayUrl);
    setTimeout(() => connectToRelay(relayUrl), 5000);
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error on ${relayUrl}:`, err.message);
  });
}

function handleEvent(event, relayUrl) {
  // Skip if we already have this exact event
  if (events.some(e => e.id === event.id)) return;

  // Check for protocol tag
  const hasTag = event.tags?.some(t => t[0] === 'protocol' && t[1] === validator.NOSTRCOIN.PROTOCOL_TAG);
  if (!hasTag) return;

  console.log(`New NSTC event from ${relayUrl} – kind ${event.kind} – ${event.pubkey.slice(0,8)}...`);

  if (event.kind === validator.NOSTRCOIN.KIND_MINING) {
    const epoch = validator.getEpoch(event.created_at * 1000);

    // Check if there's an existing event for this epoch
    const existingEpochEvent = events.find(e => {
      if (e.kind !== validator.NOSTRCOIN.KIND_MINING) return false;
      const eEpoch = validator.getEpoch(e.created_at * 1000);
      return eEpoch === epoch;
    });

    if (existingEpochEvent) {
      // There's already a block for this epoch - check which one wins

      // Earlier timestamp wins
      if (event.created_at < existingEpochEvent.created_at) {
        console.log(`New block is earlier! Epoch ${epoch} – Replacing old block`);
        events = events.filter(e => e.id !== existingEpochEvent.id);
        events.push(event);
        return;
      }

      // Same timestamp - lexicographically smaller ID wins
      if (event.created_at === existingEpochEvent.created_at && event.id < existingEpochEvent.id) {
        console.log(`New block wins tie-breaker! Epoch ${epoch} – Replacing old block`);
        events = events.filter(e => e.id !== existingEpochEvent.id);
        events.push(event);
        return;
      }

      // Existing block is better - reject this one
      console.log(`Existing block is better for epoch ${epoch} – Rejecting new block`);
      return;
    }

    // No existing block for this epoch - validate and add
    const v = validator.validateMiningEvent(event, events);
    if (v.valid) {
      console.log(`✓ Valid mining! Epoch ${epoch} → +50 NSTC`);
      events.push(event);
    } else {
      console.log(`✗ Invalid mining: ${v.reason}`);
    }
    return;
  }

  if (event.kind === validator.NOSTRCOIN.KIND_TRANSFER) {
    // Validate transfer before accepting
    const currentBalances = validator.computeBalances(events).balances;
    const v = validator.validateTransferEvent(event, currentBalances);

    if (v.valid) {
      console.log(`✓ Valid transfer: ${v.amount} NSTC`);
      events.push(event);
    } else {
      console.log(`✗ Invalid transfer: ${v.reason}`);
    }
    return;
  }

  // Other event types - just add them
  events.push(event);
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
      connectedRelays: connections.size,
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

function start() {
  console.log('Nostrcoin Indexer v0.0.4 – FIXED REPLACEMENT LOGIC');
  console.log('===================================================\n');
  CONFIG.relays.forEach(connectToRelay);
  server.listen(CONFIG.port, () => {
    console.log(`HTTP API → http://0.0.0.0:${CONFIG.port}`);
    console.log('Endpoints: /stats  /events  /balance/:pubkey  /history/:pubkey\n');
  });
}

process.on('SIGINT', () => {
  connections.forEach(ws => ws.close());
  server.close();
  process.exit(0);
});

start();
