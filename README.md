# ⚡ Nostrcoin (NSTC)

A Nostr-native cryptocurrency experiment with proof-of-work mining.
This is for fun and educational purposes only! Do not invest any real money.

## What is Nostrcoin?

Nostrcoin is a fully decentralized cryptocurrency built entirely on Nostr. Unlike traditional cryptocurrencies that use blockchains, Nostrcoin uses Nostr events as the ledger. Anyone can validate the entire history, and no single authority controls the network.

**Version:** 0.0.9 (Indexer) / 0.0.5 (Miner) / 0.0.5 (Validator)
**Status:** Educational/Experimental
**Max Supply:** 21,000,000 NSTC
**Initial Block Reward:** 50 NSTC (halves every 210,000 blocks)
**Epoch Time:** 10 minutes (in Nostrcoin, an "epoch" is a 10 minute period)
**Event Kinds:** 30333 (mining), 30334 (transfers)
**Difficulty:** 4 leading zeros required in event ID

## ⚠️ Disclaimer: Expect Chaos ⚠️

This is an experimental educational project. **Expect:**
- It **will break** (bugs everywhere)
- It **will fail** (systems crash, data corrupts)
- It **will fork** (chain splits, conflicting states)
- It **will get hacked** (exploits will be found)
- It **will get quantum computer'd** (eventually)
- It **will get AI'd** (bots will game it)
- It **will get rekt** (any and all things bad will happen)

**Do not invest real money. This has ZERO monetary value.**

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
├── WHITEPAPER.md                  # The whitepaper
└── LICENSE                    # MIT License
```

**Note:** Wallet and explorer HTML files are hosted separately at https://saccoci.github.io.

## Quick Start

### Use the Wallet or Explorer

The easiest way to interact with Nostrcoin is via the wallet at https://saccoci.github.io/wallet. Login with a Nostr signing extension or nsec. The wallet allows you to:
- Connect with Nostr signing extension (e.g. Alby, AKA Profiles, Gooti, nos2x, Flamingo, etc.)
- Mine NSTC with proof-of-work
- Send NSTC to other users
- View transaction history
- Generate receive QR codes

The explorer allows you to view information such as supply, block height, epoch, blocks, and transfers. View it at https://saccoci.github.io/explorer

### Run the Indexer

```bash
# Clone the repo
git clone https://github.com/saccoci/nostrcoin.git
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
- Check the forum for help: https://nostrcoin.boards.net

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
- Check the forum for help: https://nostrcoin.boards.net

**Tip: Use tmux to keep the miner running in the background**

tmux is a terminal multiplexer that lets you detach from a session while processes continue running (perfect for long-running miners on a VPS).

```bash
# Install tmux (if not present)
sudo apt install tmux  # Ubuntu/Debian

# Start a new tmux session
tmux new -s miner

# Inside the session, run the miner
node miner.js
```

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
    'wss://nos.lol',
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

## How You Can Help Nostrcoin

The network needs **always-on indexer nodes** to stay resilient and decentralized. Here's how you can help:

### Run an Always-On Node

The most valuable contribution is running a public indexer 24/7:

1. **Set up a VPS** (DigitalOcean, AWS, Vultr, etc.)
2. **Install and run the indexer** (see "Running a Node" section)
3. **Keep it running** with PM2 or systemd
4. **Make it public** by opening port 3000
5. **Share your indexer URL** with the community

**Why this matters:**
- More nodes = more resilient network
- More nodes = faster sync for new participants
- More nodes = harder to censor or attack
- Decentralization requires actual distributed nodes!

### Share Your Peer Address

If you're running an indexer, **share your URL**:

1. **Add it to the forum**: https://nostrcoin.boards.net
2. **Post it on Nostr** with hashtag #nostrcoin
3. **Add it to GitHub issues** as a peer indexer
4. **Configure peer sync** in your `indexer.js`:
```javascript
   peerIndexers: [
     'http://your-indexer-ip:3000',
     // Share this URL!
   ]
```

### What We Need Most

**Priority 1**: Always-on VPS indexers
- Even a $5/month droplet helps
- The more geographically distributed, the better
- Uptime matters more than speed

**Priority 2**: Peer discovery
- We need a way for nodes to find each other
- Consider announcing your indexer publicly

**Priority 3**: Testing and bug reports
- Break things and report them
- Try to exploit the system (responsibly)
- Document edge cases

**The network is only as decentralized as the number of independent nodes running.**

## Educational Purpose

⚠️ **This is an educational experiment.** Nostrcoin has no financial value and is not intended as an investment. It's a demonstration of how decentralized systems can be built on Nostr.

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

- **Repository**: https://github.com/saccoci/nostrcoin
- **Wallet**: https://saccoci.github.io/wallet
- **Explorer**: https://saccoci.github.io/explorer
- **Forum**: https://nostrcoin.boards.net

---

**Inspired by Bitcoin. Built on Nostr.**
