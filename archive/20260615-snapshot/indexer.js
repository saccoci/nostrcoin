// Nostrcoin Indexer Node v0.1.0 – Persistent Subscriptions
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
  // How far back to subscribe from on (re)connect — covers any gap while disconnected
  subscribeBackSecs: 3600,
  // Reconnect backoff: starts at 5s, doubles up to 5 min
  reconnectBaseMs: 5000,
  reconnectMaxMs:  300000,
  // Periodic deep catchup — belt-and-suspenders against relay gaps
  deepCatchupIntervalMs: 600000, // every 10 min
  deepCatchupWindowSecs: 1800,   // look back 30 min
  dbPath: './nostrcoin.db',
  peerIndexers: [
    // 'https://another-indexer.com',
  ],
  syncInterval: 30000,
};

let events = [];
let db;

// Track the earliest created_at we know about per relay so we never miss a gap
// Maps relayUrl -> unix timestamp of earliest safe "since" for that relay
const relayLastSeen = {};

// ── Database ──────────────────────────────────────────────────────────────────

function initDatabase() {
  db = new Database(CONFIG.dbPath);
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
    );
    CREATE INDEX IF NOT EXISTS idx_kind       ON events(kind);
    CREATE INDEX IF NOT EXISTS idx_pubkey     ON events(pubkey);
    CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_epoch      ON events(epoch);
  `);
  console.log('✓ Database initialized');
}

function loadEventsFromDB() {
  const rows = db.prepare('SELECT * FROM events ORDER BY created_at ASC').all();
  events = rows.map(row => ({
    id:         row.id,
    kind:       row.kind,
    pubkey:     row.pubkey,
    created_at: row.created_at,
    content:    row.content,
    tags:       JSON.parse(row.tags),
    sig:        row.sig
  }));
  console.log(`✓ Loaded ${events.length} events from database`);
}

function saveEventToDB(event, sourceRelay) {
  try {
    const epoch = event.kind === validator.NOSTRCOIN.KIND_MINING
      ? validator.getEpoch(event.created_at * 1000)
      : null;
    db.prepare(`
      INSERT OR IGNORE INTO events
      (id, kind, pubkey, created_at, content, tags, sig, first_seen, source_relay, epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id, event.kind, event.pubkey, event.created_at,
      event.content || '', JSON.stringify(event.tags), event.sig,
      Math.floor(Date.now() / 1000), sourceRelay, epoch
    );
    return true;
  } catch (err) {
    console.error('Error saving event to DB:', err.message);
    return false;
  }
}

// ── Event handling ────────────────────────────────────────────────────────────

function handleEvent(event, source) {
  if (events.some(e => e.id === event.id)) return false;

  const hasTag = event.tags?.some(
    t => t[0] === 'protocol' && t[1] === validator.NOSTRCOIN.PROTOCOL_TAG
  );
  if (!hasTag) return false;

  const src = source.startsWith('peer:') ? source.replace('peer:', '📡 ') : source;
  console.log(`  → New event from ${src} – kind ${event.kind} – ${event.pubkey.slice(0,8)}...`);

  if (event.kind === validator.NOSTRCOIN.KIND_MINING) {
    const epoch = validator.getEpoch(event.created_at * 1000);
    const existing = events.find(e =>
      e.kind === validator.NOSTRCOIN.KIND_MINING &&
      validator.getEpoch(e.created_at * 1000) === epoch
    );

    if (existing) {
      const replaceByTime = event.created_at < existing.created_at;
      const replaceByTie  = event.created_at === existing.created_at && event.id < existing.id;
      if (replaceByTime || replaceByTie) {
        const reason = replaceByTime ? 'earlier timestamp' : 'tie-breaker';
        console.log(`     Replacing existing block for epoch ${epoch} (${reason})`);
        events = events.filter(e => e.id !== existing.id);
        db.prepare('DELETE FROM events WHERE id = ?').run(existing.id);
        events.push(event);
        saveEventToDB(event, source);
        return 'replaced';
      }
      console.log(`     Rejected (existing block wins) for epoch ${epoch}`);
      return false;
    }

    const v = validator.validateMiningEvent(event, events);
    if (v.valid) {
      console.log(`     ✓ Valid mining! Epoch ${epoch} → +${validator.getBlockReward ? validator.getBlockReward(events.filter(e => e.kind === validator.NOSTRCOIN.KIND_MINING).length) : 50} NSTC`);
      events.push(event);
      saveEventToDB(event, source);
      return true;
    } else {
      console.log(`     ✗ Invalid: ${v.reason}`);
      return false;
    }
  }

  if (event.kind === validator.NOSTRCOIN.KIND_TRANSFER) {
    console.log('     ✓ Valid transfer');
    events.push(event);
    saveEventToDB(event, source);
    return true;
  }

  return false;
}

// ── Persistent relay subscriptions ───────────────────────────────────────────
// Each relay gets its own persistent WebSocket with automatic reconnection.
// On (re)connect we subscribe from (lastSeen - buffer) so no event slips
// through the gap while we were disconnected.

const relayConnections = new Map(); // relayUrl -> { ws, reconnectMs, pingInterval }

function connectRelay(relayUrl) {
  // Prevent double-connect
  const existing = relayConnections.get(relayUrl);
  if (existing && existing.ws &&
      (existing.ws.readyState === WebSocket.CONNECTING ||
       existing.ws.readyState === WebSocket.OPEN)) {
    return;
  }

  const state = relayConnections.get(relayUrl) || { reconnectMs: CONFIG.reconnectBaseMs };
  relayConnections.set(relayUrl, state);

  console.log(`🔌 Connecting to ${relayUrl}...`);
  const ws = new WebSocket(relayUrl);
  state.ws = ws;

  ws.on('open', () => {
    console.log(`✓ Connected: ${relayUrl}`);
    state.reconnectMs = CONFIG.reconnectBaseMs; // reset backoff on success

    // Subscribe from (lastSeen - buffer) or subscribeBackSecs ago, whichever is earlier
    const sinceBase = relayLastSeen[relayUrl]
      ? relayLastSeen[relayUrl] - 60          // 60s overlap to never miss boundary events
      : Math.floor(Date.now() / 1000) - CONFIG.subscribeBackSecs;

    const subId = 'nstc-' + Date.now();
    ws.send(JSON.stringify(['REQ', subId, {
      kinds: CONFIG.eventKinds,
      since: sinceBase
    }]));

    // Keepalive ping every 30s — prevents relay dropping idle connections
    if (state.pingInterval) clearInterval(state.pingInterval);
    state.pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);
  });

  ws.on('message', data => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg[0] === 'EVENT' && msg[2]) {
        const event = msg[2];
        // Track most recent created_at seen from this relay
        if (!relayLastSeen[relayUrl] || event.created_at > relayLastSeen[relayUrl]) {
          relayLastSeen[relayUrl] = event.created_at;
        }
        handleEvent(event, relayUrl);
      }
      // EOSE = end of stored events; subscription stays open for live events
      if (msg[0] === 'EOSE') {
        console.log(`  📬 Caught up on stored events from ${relayUrl}`);
      }
      if (msg[0] === 'NOTICE') {
        console.log(`  📢 Notice from ${relayUrl}: ${msg[1]}`);
      }
    } catch (e) { /* ignore parse errors */ }
  });

  ws.on('pong', () => {
    // Relay is alive, nothing to do
  });

  ws.on('error', err => {
    console.log(`⚠️  Error on ${relayUrl}: ${err.message}`);
  });

  ws.on('close', (code, reason) => {
    if (state.pingInterval) { clearInterval(state.pingInterval); state.pingInterval = null; }
    console.log(`🔴 Disconnected from ${relayUrl} (code ${code}) — reconnecting in ${state.reconnectMs/1000}s`);
    setTimeout(() => {
      // Exponential backoff, capped at max
      state.reconnectMs = Math.min(state.reconnectMs * 2, CONFIG.reconnectMaxMs);
      connectRelay(relayUrl);
    }, state.reconnectMs);
  });
}

function connectAllRelays() {
  console.log(`\n📡 Opening persistent subscriptions to ${CONFIG.relays.length} relays...`);
  CONFIG.relays.forEach(connectRelay);
}

// ── Deep catchup (belt-and-suspenders) ───────────────────────────────────────
// Belt-and-suspenders: even with persistent subs, do a one-shot sweep every
// epoch in case a relay dropped an event without sending it to our sub.

async function deepCatchup() {
  const since = Math.floor(Date.now() / 1000) - CONFIG.deepCatchupWindowSecs;
  console.log(`\n🔭 Deep catchup sweep (last ${CONFIG.deepCatchupWindowSecs/60} min)...`);

  const promises = CONFIG.relays.map(relayUrl => new Promise(resolve => {
    const ws = new WebSocket(relayUrl);
    const found = [];
    let done = false;
    const finish = () => { if (!done) { done = true; ws.close(); resolve(found); } };

    ws.on('open', () => {
      ws.send(JSON.stringify(['REQ', 'catchup-' + Date.now(), { kinds: CONFIG.eventKinds, since }]));
      setTimeout(finish, 10000);
    });
    ws.on('message', data => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'EVENT' && msg[2]) found.push(msg[2]);
        if (msg[0] === 'EOSE') finish();
      } catch (e) {}
    });
    ws.on('error', finish);
    ws.on('close', finish);
  }));

  const results = await Promise.allSettled(promises);
  let recovered = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      r.value.forEach(ev => { if (handleEvent(ev, CONFIG.relays[i])) recovered++; });
    }
  });
  if (recovered > 0) {
    console.log(`  ✅ Deep catchup recovered ${recovered} event(s)`);
  } else {
    console.log(`  ✓ Deep catchup: nothing missed`);
  }
}

// ── Peer sync ─────────────────────────────────────────────────────────────────

async function syncWithPeers() {
  if (CONFIG.peerIndexers.length === 0) return;
  console.log(`\n🔄 Syncing with ${CONFIG.peerIndexers.length} peer indexer(s)...`);
  for (const peerUrl of CONFIG.peerIndexers) {
    try {
      const response = await fetch(`${peerUrl}/export`);
      if (!response.ok) { console.log(`  ✗ ${peerUrl}: HTTP ${response.status}`); continue; }
      const data = await response.json();
      let newFromPeer = 0, conflicts = 0;
      for (const ev of (data.events || [])) {
        const r = handleEvent(ev, `peer:${peerUrl}`);
        if (r === true) newFromPeer++;
        if (r === 'replaced') conflicts++;
      }
      console.log(`  ✓ ${peerUrl}: ${newFromPeer} new, ${conflicts} conflicts resolved`);
    } catch (err) {
      console.log(`  ✗ ${peerUrl}: ${err.message}`);
    }
  }
}

// ── HTTP API ──────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/balance/')) {
    const pubkey = url.pathname.split('/')[2];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pubkey, balance: validator.getBalance(pubkey, events), timestamp: Date.now() }));
    return;
  }

  if (url.pathname.startsWith('/history/')) {
    const pubkey = url.pathname.split('/')[2];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pubkey, history: validator.getHistory(pubkey, events), timestamp: Date.now() }));
    return;
  }

  if (url.pathname === '/stats') {
    const result = validator.computeBalances(events);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalSupply:    result.totalSupply || 0,
      uniqueHolders:  Object.keys(result.balances || {}).length,
      totalEvents:    events.length,
      currentEpoch:   validator.getEpoch(Date.now()),
      connectedRelays: CONFIG.relays.length,
      activeRelays:   [...relayConnections.entries()]
                        .filter(([,s]) => s.ws && s.ws.readyState === WebSocket.OPEN).length,
      peerIndexers:   CONFIG.peerIndexers.length,
      timestamp:      Date.now()
    }));
    return;
  }

  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      events: events.map(e => ({
        id:         e.id,
        kind:       e.kind,
        pubkey:     e.pubkey,
        created_at: e.created_at,
        tags:       e.tags,
        epoch:      e.kind === validator.NOSTRCOIN.KIND_MINING
                      ? validator.getEpoch(e.created_at * 1000) : undefined
      })),
      total: events.length
    }));
    return;
  }

  if (url.pathname === '/export') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ events, total: events.length, exportedAt: Date.now() }));
    return;
  }

  if (url.pathname === '/db-stats') {
    const total   = db.prepare('SELECT COUNT(*) as c FROM events').get();
    const oldest  = db.prepare('SELECT MIN(created_at) as t FROM events').get();
    const newest  = db.prepare('SELECT MAX(created_at) as t FROM events').get();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalStoredEvents: total.c,
      oldestEventTime:   oldest.t,
      newestEventTime:   newest.t,
      databaseSize:      fs.statSync(CONFIG.dbPath).size
    }));
    return;
  }

  if (url.pathname === '/peers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ peers: CONFIG.peerIndexers, totalPeers: CONFIG.peerIndexers.length }));
    return;
  }

  // Relay connection status — useful for debugging
  if (url.pathname === '/relay-status') {
    const states = ['CONNECTING','OPEN','CLOSING','CLOSED'];
    const status = CONFIG.relays.map(url => ({
      url,
      state: relayConnections.has(url)
        ? (states[relayConnections.get(url).ws?.readyState] || 'UNKNOWN')
        : 'NOT_STARTED',
      lastSeen: relayLastSeen[url]
        ? new Date(relayLastSeen[url] * 1000).toISOString() : null
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ relays: status, timestamp: Date.now() }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function start() {
  console.log('Nostrcoin Indexer v0.1.0 – Persistent Subscriptions');
  console.log('=====================================================\n');

  initDatabase();
  loadEventsFromDB();

  server.listen(CONFIG.port, () => {
    console.log(`HTTP API → http://0.0.0.0:${CONFIG.port}`);
    console.log('Endpoints: /stats /events /balance/:pubkey /history/:pubkey');
    console.log('           /export /db-stats /peers /relay-status\n');
    if (CONFIG.peerIndexers.length > 0) {
      CONFIG.peerIndexers.forEach(p => console.log(`  Peer: ${p}`));
    } else {
      console.log('Peer Indexers: none configured\n');
    }
  });

  // Open persistent WebSocket subscriptions (this replaces polling)
  connectAllRelays();

  // Belt-and-suspenders deep catchup every epoch
  setInterval(deepCatchup, CONFIG.deepCatchupIntervalMs);
  console.log(`⏰ Deep catchup every ${CONFIG.deepCatchupIntervalMs/60000} min\n`);

  // Initial deep catchup after 10s (let connections establish first)
  setTimeout(deepCatchup, 10000);

  if (CONFIG.peerIndexers.length > 0) {
    setInterval(syncWithPeers, CONFIG.syncInterval);
    console.log(`⏰ Peer sync every ${CONFIG.syncInterval/1000}s\n`);
  }
}

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  relayConnections.forEach(state => {
    if (state.pingInterval) clearInterval(state.pingInterval);
    if (state.ws) state.ws.close();
  });
  if (db) db.close();
  server.close();
  process.exit(0);
});

start();
