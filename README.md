# ⚡ Nostrcoin (NSTC)

**Pronounced: "nestacy" or "nest"**

A Nostr-native cryptocurrency experiment with proof-of-work mining.  
This is for fun and educational purposes only! Do not invest any real money.

**Version:** 0.0.9 (Indexer) / 0.0.5 (Miner) / 0.0.3 (Validator)  
**Status:** Educational/Experimental  
**Max Supply:** 21,000,000 NSTC  
**Smallest Unit:** 1 nak (0.00000001 NSTC)  
**Initial Block Reward:** 50 NSTC (halves every 210,000 blocks)  
**Epoch Time:** 10 minutes  
**Event Kinds:** 30333 (mining), 30334 (transfers)  
**Difficulty:** 4 leading zeros required in event ID

---

## 📖 Table of Contents

- [What is Nostrcoin?](#what-is-nostrcoin)
- [Quick Start](#quick-start)
- [Running a Node](#running-a-node)
- [Mining](#mining)
- [How It Works](#how-it-works)
- [Why Decentralized?](#why-decentralized)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Whitepaper](#whitepaper)
- [Contributing](#contributing)

---

## What is Nostrcoin?

Nostrcoin (NSTC or "nestacy") is a fully decentralized cryptocurrency built entirely on Nostr. Unlike traditional cryptocurrencies that use blockchains, Nostrcoin uses Nostr events as the ledger. Anyone can validate the entire history, and no single authority controls the network.

**Key Terminology:**
- **NSTC** = Nostrcoin ticker symbol
- **Nestacy/Nest** = How you say "NSTC"
- **Nak** = The smallest unit (like "satoshi" in Bitcoin)
  - 1 NSTC = 100,000,000 naks
  - 1 nak = 0.00000001 NSTC

## Core Principles

- ✅ **Nostr-native**: All state changes are Nostr events
- ✅ **Decentralized**: No central authority, anyone can validate
- ✅ **Proof-of-Work**: Mining requires finding hash with difficulty target
- ✅ **Permissionless**: Anyone can run an indexer node
- ✅ **Transparent**: All transactions are public and verifiable

---

## Quick Start

### 1. Run the Indexer (Node)

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
- Store events in SQLite database (`nostrcoin.db`)
- Sync with peer indexers (if configured)
- Provide HTTP API on port 3000

### 2. Mine NSTC

```bash
# Create a .env file with your Nostr private key
echo "NOSTR_PRIVATE_KEY_HEX=your_64_char_hex_private_key" > .env

# Run the miner
node miner.js
```

The miner will:
- Continuously mine blocks for each 10-minute epoch
- Automatically wait for next epoch if block found
- Check balance from indexer after mining
- Display hash rate and statistics

### 3. Use the Wallet

Web wallet available at: https://saccoci.github.io/wallet.html

Features:
- Connect with Nostr extension (Alby, AKA Profiles, Gooti, etc.)
- Mine NSTC with proof-of-work
- Send NSTC to other users (transfers measured in naks)
- View transaction history
- Generate receive QR codes

---

## Running a Node

Anyone can run a Nostrcoin indexer node. Indexers validate events and provide APIs for wallets/explorers.

### Prerequisites

- Node.js 16+ and npm
- 500MB+ disk space
- Stable internet connection
- Port 3000 open (or custom)

### Local Installation

#### Linux (Ubuntu/Debian)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone https://github.com/saccoci/nostrcoin.git
cd nostrcoin
npm install

# Start
npm start
```

**Run as system service:**

```bash
# Create systemd service
sudo nano /etc/systemd/system/nostrcoin.service
```

Add:
```ini
[Unit]
Description=Nostrcoin Indexer Node
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/nostrcoin
ExecStart=/usr/bin/node indexer.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable nostrcoin
sudo systemctl start nostrcoin
```

#### Windows

```powershell
# Install Node.js from https://nodejs.org/
# Clone and setup
git clone https://github.com/saccoci/nostrcoin.git
cd nostrcoin
npm install

# Start
npm start
```

**Run as Windows service (NSSM):**
```powershell
# Download NSSM from https://nssm.cc/
nssm install NostrcoinIndexer "C:\Program Files\nodejs\node.exe"
nssm set NostrcoinIndexer AppDirectory "C:\path\to\nostrcoin"
nssm set NostrcoinIndexer AppParameters "indexer.js"
nssm start NostrcoinIndexer
```

#### macOS

```bash
# Install Node.js via Homebrew
brew install node

# Clone and setup
git clone https://github.com/saccoci/nostrcoin.git
cd nostrcoin
npm install

# Start
npm start
```

### VPS Deployment (Cloud Server)

**Quick setup on Ubuntu 22.04:**

```bash
# SSH into your VPS

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Clone and setup
git clone https://github.com/saccoci/nostrcoin.git
cd nostrcoin
npm install

# Configure firewall
sudo ufw allow 3000/tcp
sudo ufw enable

# Run with PM2 (process manager)
sudo npm install -g pm2
pm2 start indexer.js --name nostrcoin-indexer
pm2 save
pm2 startup
```

**Docker deployment:**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "indexer.js"]
```

Build and run:
```bash
docker build -t nostrcoin-indexer .
docker run -d -p 3000:3000 -v $(pwd)/nostrcoin.db:/app/nostrcoin.db nostrcoin-indexer
```

### Monitoring Your Node

```bash
# Check stats
curl http://localhost:3000/stats

# View database info
curl http://localhost:3000/db-stats

# Check peer connections
curl http://localhost:3000/peers

# Get all events
curl http://localhost:3000/events
```

---

## How It Works

### The Big Picture (Plain English)

Imagine a public ledger (like a shared spreadsheet) where everyone can see all transactions, but no one person controls it. That's essentially what Nostrcoin is.

**Instead of a traditional blockchain**, Nostrcoin uses "Nostr events" - these are just messages that get shared across the internet. Every time someone mines NSTC or sends it to someone else, they create one of these messages.

### Mining: Earning NSTC

Think of mining like a lottery that happens every 10 minutes:

1. **Every 10 minutes** is a new "round" (called an "epoch")
2. **During those 10 minutes**, miners try to solve a math puzzle
3. **The puzzle**: Find a random number that produces a code starting with four zeros (like "0000abc123...")
4. **First person to solve it** wins 50 NSTC (this reward gets cut in half every few years)
5. **Everyone can verify** the winner solved the puzzle correctly

It's like rolling dice trying to get four zeros in a row. Your computer tries thousands of combinations per second.

### Sending NSTC: Making Transfers

Sending NSTC is simpler:

1. **You create a message** saying "I'm sending 5 NSTC to Bob"
2. **You sign it** with your private key (like a digital signature)
3. **You broadcast it** to Nostr relays (servers that spread messages)
4. **Indexers validate it** by checking you have 5 NSTC to send
5. **If valid**, everyone's ledger updates

The smallest amount you can send is **1 nak** (0.00000001 NSTC).

### How Balances Work

Your balance is calculated by looking at your complete history:

**Example:**
```
Start: 0 NSTC
+ Mined block: +50 NSTC
+ Mined another: +50 NSTC
- Sent to Alice: -25 NSTC
+ Received from Bob: +10 NSTC
= Balance: 85 NSTC
```

Anyone can calculate this by looking at all public messages. You don't need to trust anyone - verify it yourself!

### What Are "Indexers"?

An **indexer** is just a program that:
1. Listens to Nostr relays for Nostrcoin messages
2. Validates each message (checks mining, balances, etc.)
3. Keeps a database of everyone's balance
4. Provides an API so wallets can check balances

**Important:** Indexers don't control anything. If one lies, you can check others or run your own.

### Real-World Analogy

Imagine a town square where:
- **Miners** solve puzzles for prizes every 10 minutes
- **Senders** shout "I'm sending 5 coins to Bob!" and everyone hears it
- **Indexers** are scribes writing everything down
- **Anyone** can become a scribe and compare notes
- **No mayor** controls it - it just works because everyone follows the rules

---

## Mining

### Setup

```bash
# Create .env file with your Nostr private key
echo "NOSTR_PRIVATE_KEY_HEX=your_64_char_hex_key" > .env

# Start mining
node miner.js
```

### How Mining Works

1. **Epoch System**: Time divided into 10-minute periods
2. **Competition**: Miners compete to find valid proof-of-work
3. **First Winner**: First valid block in each epoch wins 50 NSTC (or current reward)
4. **Automatic Progression**: Miner moves to next epoch after finding block
5. **Halving**: Block reward halves every 210,000 blocks

---

## How It Works

### Mining (Proof-of-Work)

1. User attempts to mine by creating a Nostr event
2. Event ID must start with 4 leading zeros (SHA-256)
3. First valid event in each 10-minute epoch wins block reward
4. Block reward starts at 50 NSTC, halves every 210,000 blocks
5. Only one attempt per user per epoch (spam prevention)
6. Earliest timestamp wins (with ID tie-breaker)

### Transfers

1. Sender creates signed transfer event
2. Event includes recipient npub and amount (in NSTC)
3. Indexer validates sender has sufficient balance
4. If valid, balances update immediately
5. Smallest transferable amount: 1 nak (0.00000001 NSTC)

### Validation

All events validated using `nostrcoin-validator.js`:
- **Mining**: Check PoW, epoch, no duplicates
- **Transfers**: Check signature, balance, amount
- **Anyone can re-validate** entire history independently

### Units and Precision

```
1 NSTC = 100,000,000 naks
1 nak = 0.00000001 NSTC

Examples:
- 5 NSTC = 500,000,000 naks
- 0.5 NSTC = 50,000,000 naks
- 0.00000001 NSTC = 1 nak (minimum transfer)
```

---

## Why Decentralized?

### No Central Authority

- **No privileged nodes**: All indexers equal
- **No consensus voting**: Validation is deterministic
- **No gatekeepers**: Permissionless participation

### Independent Validation

- **Open-source**: `nostrcoin-validator.js` is public
- **Deterministic**: Same events → same results
- **Client verification**: Validate your own balances

### Relay Distribution

- **Multiple relays**: Events distributed across independent Nostr relays
- **No single point of failure**: Relays operate independently
- **Censorship resistant**: Cannot selectively filter

### Indexer Redundancy

- **Anyone runs indexer**: No special permissions
- **Peer sync**: Indexers reconcile with each other
- **User choice**: Query multiple indexers

### Comparison to Bitcoin

| Feature | Bitcoin | Nostrcoin |
|---------|---------|-----------|
| Data structure | Blockchain | Nostr events |
| Consensus | Longest chain | Deterministic rules |
| Distribution | P2P nodes | Relay network |
| Validation | Independent nodes | Validator library |
| Entry barrier | Full blockchain sync | Start from any point |

**Trust Model**: "Don't trust, verify"
- Cryptographic signatures prove authorship
- Anyone can replay event history
- Proof-of-work trivially verifiable
- Run your own indexer or compare multiple

---

## API Reference

The indexer provides REST API endpoints:

### GET /balance/:pubkey
Get balance for a public key.

```bash
curl http://localhost:3000/balance/8770fd14ef56ba04f9eb7aee7824eee44487902ea1fe4e37d700347184ccaca2
```

Response:
```json
{
  "pubkey": "8770fd14...",
  "balance": 150.50000000,
  "timestamp": 1234567890000
}
```

### GET /history/:pubkey
Get transaction history for a public key.

```bash
curl http://localhost:3000/history/8770fd14ef56ba04f9eb7aee7824eee44487902ea1fe4e37d700347184ccaca2
```

Response:
```json
{
  "pubkey": "8770fd14...",
  "history": [
    {
      "type": "mined",
      "amount": 50,
      "timestamp": 1234567890,
      "eventId": "0000abc123...",
      "blockHeight": 42
    },
    {
      "type": "sent",
      "amount": -10.5,
      "recipient": "abc123def...",
      "timestamp": 1234567900,
      "eventId": "def456..."
    }
  ],
  "timestamp": 1234567890000
}
```

### GET /stats
Network statistics.

```bash
curl http://localhost:3000/stats
```

Response:
```json
{
  "totalSupply": 5250.00000000,
  "uniqueHolders": 42,
  "totalEvents": 105,
  "currentEpoch": 8760,
  "connectedRelays": 7,
  "peerIndexers": 2,
  "timestamp": 1234567890000
}
```

### GET /events
All valid events.

```bash
curl http://localhost:3000/events
```

### GET /export
Export all events (for peer sync).

```bash
curl http://localhost:3000/export
```

### GET /db-stats
Database statistics.

```bash
curl http://localhost:3000/db-stats
```

### GET /peers
List configured peer indexers.

```bash
curl http://localhost:3000/peers
```

---

## Configuration

### Indexer Configuration

Edit `indexer.js`:

```javascript
const CONFIG = {
  port: 3000,                    // HTTP API port
  relays: [                      // Nostr relays to monitor
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nostr.mom',
    'wss://relay.primal.net',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://offchain.pub'
  ],
  eventKinds: [30333, 30334],    // Mining and transfer events
  pollInterval: 15000,           // Poll relays every 15 seconds
  syncInterval: 30000,           // Sync with peers every 30 seconds
  dbPath: './nostrcoin.db',      // SQLite database path
  peerIndexers: [                // Other indexers to sync with
    // 'http://indexer-1.com:3000',
    // 'http://indexer-2.com:3000',
  ]
};
```

### Miner Configuration

Edit `miner.js`:

```javascript
const CONFIG = {
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    // Add more relays...
  ],
  eventKind: 30333,
  difficulty: 4,                  // Leading zeros required
  protocolTag: 'nostrcoin',
  indexerUrl: 'http://localhost:3000'
};
```

Set your Nostr private key in `.env`:
```
NOSTR_PRIVATE_KEY_HEX=your_64_character_hex_private_key
```

---

## Project Structure

```
nostrcoin/
├── nostrcoin-validator.js     # Core validation library (browser + Node.js)
├── indexer.js                  # Indexer node (validates, provides API)
├── miner.js                    # Mining client (epoch-aware)
├── nostrcoin.db                # SQLite database (auto-created)
├── package.json                # Node.js dependencies
├── .env                        # Your Nostr private key (create this)
├── README.md                   # This file
└── LICENSE                     # MIT License
```

**Separate repos:**
- Web wallet: https://saccoci.github.io/wallet.html
- Block explorer: https://saccoci.github.io/explorer.html

---

## Whitepaper

For detailed technical documentation, see the [Nostrcoin Whitepaper](WHITEPAPER.md).

Topics covered:
- Technical architecture
- Decentralization mechanisms
- Economic model and halving schedule
- Running nodes (local, VPS, cloud)
- Security considerations
- Future development

---

## Event Kinds

Nostrcoin uses custom Nostr event kinds with `["protocol", "nostrcoin"]` tag:

### Kind 30333: Mining Events
```json
{
  "kind": 30333,
  "tags": [
    ["protocol", "nostrcoin"],
    ["difficulty", "4"],
    ["nonce", "random_nonce"]
  ],
  "content": "Mining NSTC"
}
```

Requirements:
- Event ID starts with 4 zeros
- First valid event per epoch wins
- One attempt per user per epoch

### Kind 30334: Transfer Events
```json
{
  "kind": 30334,
  "tags": [
    ["protocol", "nostrcoin"],
    ["p", "recipient_pubkey"],
    ["amount", "5.00000000"]
  ],
  "content": "Sending 5 NSTC"
}
```

Requirements:
- Sender has sufficient balance
- Amount > 0 and ≤ 8 decimals
- Cannot send to self

---

## Roadmap

- [x] Validation library
- [x] Indexer node with database
- [x] Peer indexer sync
- [x] Halving schedule (every 210,000 blocks)
- [x] Continuous miner with epoch awareness
- [x] Web wallet (login with extension or nsec)
- [x] Block explorer
- [ ] Mining pools
- [ ] Mobile wallet
- [ ] Lightning integration
- [ ] Enhanced federation

---

## Educational Purpose

⚠️ **This is an educational experiment.** Nostrcoin has no financial value and is not intended as an investment. It demonstrates decentralized systems and blockchain concepts.

---

## Contributing

Contributions welcome! Open issues or submit PRs on Codeberg.

### Development Setup

```bash
git clone https://github.com/saccoci/nostrcoin.git
cd nostrcoin
npm install
npm start
```

---

## Links

- **Repository**: https://github.com/saccoci/nostrcoin
- **Forum**: https://nostrcoin.boards.net
- **Block Explorer**: https://saccoci.github.io/explorer.html
- **Web Wallet**: https://saccoci.github.io/wallet.html

---

## License

MIT License - See LICENSE file

---

**Built on Nostr. Inspired by Bitcoin. Educational by design.**

*Remember: 1 NSTC = 100,000,000 naks* 🪙