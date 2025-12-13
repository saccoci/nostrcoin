// Nostrcoin Indexer Node v0.0.9 – With Halving Schedule
const http = require('http');
const { WebSocket } = require('ws');
const validator = require('./nostrcoin-validator.js');
const Database = require('better-sqlite3');
const fs = require('fs');

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
  pollInterval: 15000, // Poll relays every 15 seconds
  syncInterval: 30000, // Sync with peers every 30 seconds
  dbPath: './nostrcoin.db',
  // Add peer indexers here - these will be synced with
  peerIndexers: [
    // Example: 'https://another-indexer.com',
    // Add more as they become available
  ]
};

let events = [];
let lastPollTime = Math.floor(Date.now() / 1000) - 3600; // Start 1 hour ago
let db;

// Initialize database
function initDatabase() {
  db = new Database(CONFIG.dbPath);
  
  // Create events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      kind INTEGER NOT NULL,
      pubkey TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      content TEXT,
      tags TEXT NOT NULL,
      sig TEXT NOT NULL,
      first_seen INTEGER NOT NULL,
      source_relay TEXT,
      epoch INTEGER
    )
  `);
  
  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_kind ON events(kind);
    CREATE INDEX IF NOT EXISTS idx_pubkey ON events(pubkey);
    CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_epoch ON events(epoch);
  `);
  
  console.log('✓ Database initialized');
}

// Load events from database
function loadEventsFromDB() {
  const rows = db.prepare('SELECT * FROM events ORDER BY created_at ASC').all();
  
  events = rows.map(row => ({
    id: row.id,
    kind: row.kind,
    pubkey: row.pubkey,
    created_at: row.created_at,
    content: row.content,
    tags: JSON.parse(row.tags),
    sig: row.sig
  }));
  
  console.log(`✓ Loaded ${events.length} events from database`);
  
  // Set lastPollTime to most recent event, or 1 hour ago if empty
  if (events.length > 0) {
    const mostRecent = Math.max(...events.map(e => e.created_at));
    lastPollTime = mostRecent;
  }
}

// Save event to database
function saveEventToDB(event, sourceRelay) {
  try {
    const epoch = event.kind === validator.NOSTRCOIN.KIND_MINING 
      ? validator.getEpoch(event.created_at * 1000) 
      : null;
    
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO events 
      (id, kind, pubkey, created_at, content, tags, sig, first_seen, source_relay, epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      event.id,
      event.kind,
      event.pubkey,
      event.created_at,
      event.content || '',
      JSON.stringify(event.tags),
      event.sig,
      Math.floor(Date.now() / 1000),
      sourceRelay,
      epoch
    );
    
    return true;
  } catch (error) {
    console.error(`Error saving event to DB:`, error.message);
    return false;
  }
}

function pollRelay(relayUrl) {
  return new Promise((resolve) => {
    const ws = new WebSocket(relayUrl);
    const receivedEvents = [];
    let timeout;

    ws.on('open', () => {
      const subId = 'poll-' + Date.now();
      ws.send(JSON.stringify(['REQ', subId, { 
        kinds: CONFIG.eventKinds,
        since: lastPollTime
      }]));

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
          if (handleEvent(event, CONFIG.relays[index])) {
            newEventsCount++;
          }
        });
      }
    }
  });
  
  console.log(`  Total: ${totalEventsReceived} received, ${newEventsCount} new`);
  
  if (newEventsCount === 0 && totalEventsReceived === 0) {
    console.log(`  No new events found`);
  }
  
  lastPollTime = Math.floor(Date.now() / 1000);
}

// NEW: Sync with peer indexers
async function syncWithPeers() {
  if (CONFIG.peerIndexers.length === 0) {
    return; // No peers configured
  }

  console.log(`\n🔄 Syncing with ${CONFIG.peerIndexers.length} peer indexer(s)...`);
  
  for (const peerUrl of CONFIG.peerIndexers) {
    try {
      console.log(`  → Fetching from ${peerUrl}`);
      
      const response = await fetch(`${peerUrl}/export`, {
        timeout: 10000
      });
      
      if (!response.ok) {
        console.log(`  ✗ ${peerUrl}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const peerEvents = data.events || [];
      
      let newFromPeer = 0;
      let conflictsResolved = 0;
      
      for (const event of peerEvents) {
        const result = handleEvent(event, `peer:${peerUrl}`);
        if (result === true) {
          newFromPeer++;
        } else if (result === 'replaced') {
          conflictsResolved++;
        }
      }
      
      if (newFromPeer > 0 || conflictsResolved > 0) {
        console.log(`  ✓ ${peerUrl}: ${newFromPeer} new, ${conflictsResolved} conflicts resolved`);
      } else {
        console.log(`  ✓ ${peerUrl}: Already synced`);
      }
      
    } catch (error) {
      console.log(`  ✗ ${peerUrl}: ${error.message}`);
    }
  }
}

function handleEvent(event, sourceIdentifier) {
  // Skip if we already have this exact event
  if (events.some(e => e.id === event.id)) return false;

  // Check for protocol tag
  const hasTag = event.tags?.some(t => t[0] === 'protocol' && t[1] === validator.NOSTRCOIN.PROTOCOL_TAG);
  if (!hasTag) return false;

  const sourceDisplay = sourceIdentifier.startsWith('peer:') 
    ? sourceIdentifier.replace('peer:', '📡 ') 
    : sourceIdentifier;
  
  console.log(`  → New event from ${sourceDisplay} – kind ${event.kind} – ${event.pubkey.slice(0,8)}...`);

  if (event.kind === validator.NOSTRCOIN.KIND_MINING) {
    const epoch = validator.getEpoch(event.created_at * 1000);
    
    const existingEpochEvent = events.find(e => {
      if (e.kind !== validator.NOSTRCOIN.KIND_MINING) return false;
      const eEpoch = validator.getEpoch(e.created_at * 1000);
      return eEpoch === epoch;
    });

    if (existingEpochEvent) {
      if (event.created_at < existingEpochEvent.created_at) {
        console.log(`     Replacing old block for epoch ${epoch}`);
        events = events.filter(e => e.id !== existingEpochEvent.id);
        db.prepare('DELETE FROM events WHERE id = ?').run(existingEpochEvent.id);
        events.push(event);
        saveEventToDB(event, sourceIdentifier);
        return 'replaced';
      }
      
      if (event.created_at === existingEpochEvent.created_at && event.id < existingEpochEvent.id) {
        console.log(`     Replacing old block (tie-breaker) for epoch ${epoch}`);
        events = events.filter(e => e.id !== existingEpochEvent.id);
        db.prepare('DELETE FROM events WHERE id = ?').run(existingEpochEvent.id);
        events.push(event);
        saveEventToDB(event, sourceIdentifier);
        return 'replaced';
      }
      
      console.log(`     Rejected (existing block better) for epoch ${epoch}`);
      return false;
    }

    const v = validator.validateMiningEvent(event, events);
    if (v.valid) {
      console.log(`     ✓ Valid mining! Epoch ${epoch} → +50 NSTC`);
      events.push(event);
      saveEventToDB(event, sourceIdentifier);
      return true;
    } else {
      console.log(`     ✗ Invalid: ${v.reason}`);
      return false;
    }
  }

  if (event.kind === validator.NOSTRCOIN.KIND_TRANSFER) {
    console.log(`     ✓ Valid transfer`);
    events.push(event);
    saveEventToDB(event, sourceIdentifier);
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
      peerIndexers: CONFIG.peerIndexers.length,
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
        tags: e.tags,
        epoch: e.kind === validator.NOSTRCOIN.KIND_MINING ? validator.getEpoch(e.created_at * 1000) : undefined
      })),
      total: events.length
    }));
    return;
  }

  // Export all events (for peer sync and reconciliation)
  if (url.pathname === '/export') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      events: events,
      total: events.length,
      exportedAt: Date.now()
    }));
    return;
  }

  // Database stats
  if (url.pathname === '/db-stats') {
    const totalRows = db.prepare('SELECT COUNT(*) as count FROM events').get();
    const oldestEvent = db.prepare('SELECT MIN(created_at) as oldest FROM events').get();
    const newestEvent = db.prepare('SELECT MAX(created_at) as newest FROM events').get();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalStoredEvents: totalRows.count,
      oldestEventTime: oldestEvent.oldest,
      newestEventTime: newestEvent.newest,
      databaseSize: fs.statSync(CONFIG.dbPath).size
    }));
    return;
  }

  // NEW: Peer info endpoint
  if (url.pathname === '/peers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      peers: CONFIG.peerIndexers,
      totalPeers: CONFIG.peerIndexers.length
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

async function start() {
  console.log('Nostrcoin Indexer v0.0.8 – With Multi-Indexer Sync');
  console.log('===================================================\n');
  
  // Initialize database
  initDatabase();
  
  // Load existing events
  loadEventsFromDB();
  
  server.listen(CONFIG.port, () => {
    console.log(`HTTP API → http://0.0.0.0:${CONFIG.port}`);
    console.log('Endpoints: /stats /events /balance/:pubkey /history/:pubkey');
    console.log('           /export /db-stats /peers\n');
    
    if (CONFIG.peerIndexers.length > 0) {
      console.log(`Peer Indexers: ${CONFIG.peerIndexers.length} configured`);
      CONFIG.peerIndexers.forEach(peer => console.log(`  - ${peer}`));
      console.log('');
    } else {
      console.log('Peer Indexers: None configured (this indexer runs independently)\n');
    }
  });

  // Do initial poll and sync
  await pollAllRelays();
  
  if (CONFIG.peerIndexers.length > 0) {
    await syncWithPeers();
  }
  
  // Set up polling interval
  setInterval(pollAllRelays, CONFIG.pollInterval);
  console.log(`\n⏰ Polling relays every ${CONFIG.pollInterval/1000} seconds`);
  
  // Set up peer sync interval
  if (CONFIG.peerIndexers.length > 0) {
    setInterval(syncWithPeers, CONFIG.syncInterval);
    console.log(`⏰ Syncing with peers every ${CONFIG.syncInterval/1000} seconds\n`);
  }
}

process.on('SIGINT', () => {
  console.log('\n\nShutting down gracefully...');
  if (db) db.close();
  server.close();
  process.exit(0);
});

start();