# ⚡ Nostrcoin (NSTC)

A Nostr-native cryptocurrency experiment with proof-of-work mining.
This is for fun and educational purposes only! Do not invest any real money.

**Version:** 0.0.9 (Indexer) / 0.0.5 (Miner) / 0.0.3 (Validator)  
**Status:** Educational/Experimental  
**Max Supply:** 21,000,000 NSTC  
**Initial Block Reward:** 50 NSTC (halves every 210,000 blocks)  
**Epoch Time:** 10 minutes (in Nostrcoin, an "epoch" is a 10 minute period)  
**Event Kinds:** 30333 (mining), 30334 (transfers)  
**Difficulty:** 4 leading zeros required in event ID

## What is Nostrcoin?

Nostrcoin is a fully decentralized cryptocurrency built entirely on Nostr. Unlike traditional cryptocurrencies that use blockchains, Nostrcoin uses Nostr events as the ledger. Anyone can validate the entire history, and no single authority controls the network.

## Core Principles

- ✅ **Nostr-native**: All state changes are Nostr events
- ✅ **Decentralized**: No central authority, anyone can validate
- ✅ **Proof-of-Work**: Mining requires finding hash with difficulty target
- ✅ **Permissionless**: Anyone can run an indexer node
- ✅ **Transparent**: All transactions are public and verifiable

## Project Structure

```
nostrcoin/
├── nostrcoin-validator.js     # Core validation library (runs anywhere)
├── indexer.js                 # Indexer node (listens to relays, provides API, peer sync)
├── miner.js                   # Continuous mining script (epoch-aware)
├── package.json               # Node.js dependencies
├── README.md                  # This file
└── LICENSE                    # MIT License
```

**Note:** Wallet and explorer HTML files are hosted separately or available in archive folders.

## Quick Start

### Run the Indexer

```bash
# Clone the repo
git clone https://codeberg.org/saccoci/nostrcoin.git
cd nostrcoin

# Install dependencies
npm install

# Run the indexer
npm start
```

The indexer will:
- Connect to Nostr relays
- Listen for mining and transfer events
- Validate all events using the validator library
- Store events in SQLite database for persistence
- Sync with peer indexers (if configured)
- Provide HTTP API on port 3000

### Run the Miner

```bash
# Create a .env file with your Nostr private key
echo "NOSTR_PRIVATE_KEY_HEX=your_64_char_hex_private_key" > .env

# Run the miner
node miner.js
```

The miner will:
- Continuously mine blocks for each epoch
- Automatically wait for the next epoch if a block is found
- Check balance from the indexer after mining
- Display hash rate and mining statistics

### Use the Wallet

Wallet and explorer interfaces are available separately. The wallet allows you to:
- Connect with Nostr extension (Alby, AKA Profiles, Gooti, etc.)
- Mine NSTC with proof-of-work
- Send NSTC to other users
- View transaction history
- Generate receive QR codes

## How It Works

### Mining (Proof-of-Work)

1. User attempts to mine by creating a Nostr event
2. Event ID must start with 4 leading zeros (SHA-256)
3. First valid event in each 10-minute epoch wins the block reward
4. Block reward starts at 50 NSTC and halves every 210,000 blocks
5. Only one attempt per user per epoch (spam prevention)
6. If multiple valid blocks exist for an epoch, the earliest timestamp wins (with ID tie-breaker)

### Transfers

1. Sender creates signed transfer event
2. Event includes recipient npub and amount
3. Indexer validates sender has sufficient balance
4. If valid, balances update immediately

### Validation

All events are validated using `nostrcoin-validator.js`:
- Mining: Check PoW, epoch, no duplicates
- Transfers: Check signature, balance, amount
- Anyone can re-validate entire history independently

## API Endpoints

The indexer provides a REST API:

```
GET  /balance/:pubkey      # Get balance for a pubkey
GET  /history/:pubkey      # Get transaction history
GET  /stats                # Network statistics (supply, holders, events, current epoch)
GET  /events               # All valid events
GET  /export               # Export all events (for peer sync)
GET  /db-stats             # Database statistics
GET  /peers                 # List configured peer indexers
```

Example:
```bash
# Get balance
curl http://localhost:3000/balance/8770fd14ef56ba04f9eb7aee7824eee44487902ea1fe4e37d700347184ccaca2

# Get network stats
curl http://localhost:3000/stats

# Get all events
curl http://localhost:3000/events
```

## Configuration

### Indexer Configuration

Edit `indexer.js` to customize:

```javascript
const CONFIG = {
  port: 3000,
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nostr.mom',
    // Add more relays...
  ],
  pollInterval: 15000,      // Poll relays every 15 seconds
  syncInterval: 30000,       // Sync with peers every 30 seconds
  dbPath: './nostrcoin.db',  // SQLite database path
  peerIndexers: [            // Other indexers to sync with
    // 'http://another-indexer.com:3000',
  ]
};
```

### Miner Configuration

Edit `miner.js` to customize:

```javascript
const CONFIG = {
  indexerUrl: 'http://localhost:3000',  // Indexer API URL
  difficulty: 4,                        // PoW difficulty (leading zeros)
  // ... relay configuration
};
```

Set your Nostr private key in a `.env` file:
```
NOSTR_PRIVATE_KEY_HEX=your_64_character_hex_private_key
```

## Decentralization

**Anyone can run an indexer.** The indexer doesn't control consensus—it just indexes public Nostr events. The system includes:

- **Peer Indexer Sync**: Indexers can sync with each other to reconcile events
- **Database Persistence**: Events are stored in SQLite for fast startup and recovery
- **Independent Validation**: Anyone can validate the entire event history using the validator library
- **Multiple Indexers**: Users can query multiple indexers and compare results

This is inspired by Bitcoin's model: full nodes vs. SPV wallets. Users can:
- Run their own indexer
- Validate against multiple indexers
- Verify the entire event history independently

## Event Kinds

Nostrcoin uses custom Nostr event kinds with protocol tag filtering:

- **30333**: Mining events (PoW attempts)
  - Must include `["protocol", "nostrcoin"]` tag
  - Event ID must start with 4 zeros
  - First valid event in each 10-minute epoch wins
  
- **30334**: Transfer events (sending NSTC)
  - Must include `["protocol", "nostrcoin"]` tag
  - Tags: `["p", "recipient_pubkey"]` and `["amount", "5.00000000"]`
  - Validated against sender's balance

All events are public and stored on Nostr relays.

## Roadmap

- [x] Validation library
- [x] Indexer node
- [x] Database persistence (SQLite)
- [x] Peer indexer sync
- [x] Halving schedule (every 210,000 blocks)
- [x] Continuous miner with epoch awareness
- [x] Web wallet
- [ ] Mobile wallet
- [ ] Lightning integration
- [ ] Enhanced federation features

## Educational Purpose

⚠️ **This is an educational experiment.** Nostrcoin has no financial value and is not intended as an investment. It's a demonstration of how decentralized systems can be built on Nostr.

## Contributing

Contributions welcome! Open issues or submit PRs on Codeberg.

## License

MIT License - See LICENSE file

## Features

### Halving Schedule
Block rewards halve every 210,000 blocks (approximately every 4 years), similar to Bitcoin. The reward starts at 50 NSTC and will continue halving until all 21 million NSTC are mined.

### Database Persistence
The indexer uses SQLite to store all events, enabling:
- Fast startup (no need to re-scan all events)
- Persistent state across restarts
- Efficient querying of historical data

### Peer Indexer Sync
Indexers can be configured to sync with other indexers, enabling:
- Event reconciliation between nodes
- Faster propagation of new events
- Redundancy and fault tolerance

## Links

- **Repository**: https://codeberg.org/saccoci/nostrcoin
- **Nostr**: Find updates via npub (coming soon)

---

**Built on Nostr. Inspired by Bitcoin. Educational by design.**