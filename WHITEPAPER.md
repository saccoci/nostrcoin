# Nostrcoin: A Nostr-Native Cryptocurrency

**Version 1.0**

**December 2025**

---

## Abstract

Nostrcoin (NSTC, pronounced "nestacy" or "nest") is a decentralized cryptocurrency built entirely on the Nostr protocol. Unlike traditional cryptocurrencies that rely on dedicated blockchain networks, Nostrcoin leverages Nostr's event system as its distributed ledger. This approach eliminates the need for separate blockchain infrastructure while maintaining the core principles of decentralization, transparency, and permissionless participation. Through proof-of-work mining, deterministic validation, and multi-indexer architecture, Nostrcoin demonstrates how existing decentralized protocols can be extended to support digital currency functionality.

The smallest unit of NSTC is called a "nok" (1 NSTC = 100,000,000 noks), analogous to satoshis in Bitcoin.

**Disclaimer:** Nostrcoin is an educational experiment designed to explore decentralized system design. It has no monetary value and should not be treated as an investment vehicle.

**⚠️ Expect Chaos:** This experimental system will break, fail, fork, get hacked, get quantum computer'd, get AI'd, get rekt, and experience any and all things bad. Participate at your own risk.

---

## Table of Contents

1. [Introduction](#1-introduction)
- 1.1 [Background](#11-background)
- 1.2 [Design Philosophy](#12-design-philosophy)
- 1.3 [Terminology](#13-terminology)

2. [How It Works (Plain English)](#2-how-it-works-plain-english)
- 2.1 [The Big Picture](#21-the-big-picture)
- 2.2 [Mining: Earning NSTC](#22-mining-earning-nstc)
- 2.3 [Sending NSTC: Making Transfers](#23-sending-nstc-making-transfers)
- 2.4 [How Balances Work](#24-how-balances-work)
- 2.5 [What Makes It Decentralized?](#25-what-makes-it-decentralized)
- 2.6 [What Are "Indexers" and Why Do They Matter?](#26-what-are-indexers-and-why-do-they-matter)
- 2.7 [Why Nostr Instead of a Blockchain?](#27-why-nostr-instead-of-a-blockchain)
- 2.8 [Real-World Analogy](#28-real-world-analogy)

3. [Technical Architecture](#3-technical-architecture)
- 3.1 [Core Components](#31-core-components)
- 3.2 [Event Structure](#32-event-structure)
- 3.3 [Proof-of-Work Mining](#33-proof-of-work-mining)
- 3.4 [Balance Calculation](#34-balance-calculation)

4. [Decentralization Architecture](#4-decentralization-architecture)
- 4.1 [Why Nostrcoin is Decentralized](#41-why-nostrcoin-is-decentralized)
- 4.2 [Comparison to Traditional Blockchains](#42-comparison-to-traditional-blockchains)
- 4.3 [Trust Model](#43-trust-model)

5. [Running a Node (Indexer)](#5-running-a-node-indexer)
- 5.1 [Prerequisites](#51-prerequisites)
- 5.2 [Installation](#52-installation)
- 5.3 [VPS Deployment](#53-vps-deployment-digitalocean-aws-vultr-etc)
- 5.4 [Configuration](#54-configuration)
- 5.5 [Monitoring Your Node](#55-monitoring-your-node)
- 5.6 [Becoming a Public Indexer](#56-becoming-a-public-indexer)
- 5.7 [Peer Synchronization](#57-peer-synchronization)

6. [Mining](#6-mining)
- 6.1 [Setting Up Mining](#61-setting-up-mining)
- 6.2 [Mining Strategy](#62-mining-strategy)
- 6.3 [Solo vs Pool Mining](#63-solo-vs-pool-mining)

7. [Economic Model](#7-economic-model)
- 7.1 [Supply Schedule](#71-supply-schedule)
- 7.2 [Precision and Units](#72-precision-and-units)
- 7.3 [Use Cases (Educational)](#73-use-cases-educational)

8. [Security Considerations](#8-security-considerations)
- 8.1 [Attack Vectors](#81-attack-vectors)
- 8.2 [Known Limitations](#82-known-limitations)

9. [How You Can Help Nostrcoin](#9-how-you-can-help-nostrcoin)
- 9.1 [Run an Always-On Node](#91-run-an-always-on-node)
- 9.2 [Share Your Peer Address](#92-share-your-peer-address)
- 9.3 [What We Need Most](#93-what-we-need-most)

10. [Conclusion](#10-conclusion)

[Appendices](#appendices)
- [Appendix A: API Reference](#appendix-a-api-reference)
- [Appendix B: Glossary](#appendix-b-glossary)
- [Appendix C: Resources](#appendix-c-resources)

---

## 1. Introduction

### 1.1 Background

The cryptocurrency landscape has historically required purpose-built blockchain infrastructure, each network operating independently with its own nodes, consensus mechanisms, and validation rules. This approach, while effective, creates significant barriers to entry and limits interoperability between systems.

Nostr (Notes and Other Stuff Transmitted by Relays) presents an alternative paradigm: a simple, decentralized protocol for distributing signed messages. While initially designed for social networking, Nostr's architecture—featuring cryptographic signatures, relay-based distribution, and event permanence—provides the foundational elements necessary for a decentralized currency system.

### 1.2 Design Philosophy

Nostrcoin is guided by four core principles:

1.  **True Decentralization**: No central authority controls the network. Anyone can validate the entire history independently.
2.  **Nostr-Native**: All state changes occur through Nostr events, making the system interoperable with existing Nostr infrastructure.
3.  **Permissionless Participation**: Anyone can mine, transfer, validate, or run an indexer node without approval.
4.  **Transparent Validation**: All transactions are public and independently verifiable using open-source validation logic.

### 1.3 Terminology

-  **NSTC**: The ticker symbol for Nostrcoin
-  **Nestacy/Nest**: Colloquial pronunciations of NSTC
-  **Nok**: The smallest unit of NSTC (0.00000001 NSTC = 1 nok)
-  **Epoch**: A 10-minute time window during which miners compete to produce a valid block
-  **Indexer**: A node that indexes Nostr events and provides balance/history APIs
-  **Validator**: The deterministic validation library that enforces consensus rules

---

## 2. How It Works (Plain English)

### 2.1 The Big Picture

Imagine a public ledger (like a shared spreadsheet) where everyone can see all transactions, but no one person controls it. That's essentially what Nostrcoin is.

**Instead of a traditional blockchain**, Nostrcoin uses something called "Nostr events" - these are just messages that get shared across the internet. Every time someone mines NSTC or sends it to someone else, they create one of these messages.

### 2.2 Mining: Earning NSTC

Think of mining like a lottery that happens every 10 minutes:

1.  **Every 10 minutes** is a new "round" (we call this an "epoch")
2.  **During those 10 minutes**, miners try to solve a math puzzle
3.  **The puzzle**: Find a random number that, when combined with your mining attempt, produces a special code starting with four zeros (like "0000abc123...")
4.  **First person to solve it** wins 50 NSTC (this reward gets cut in half every few years, just like Bitcoin)
5.  **Everyone can verify** the winner actually solved the puzzle correctly

It's like a race where you keep rolling dice trying to get four zeros in a row. Your computer can try thousands of combinations per second, but it still takes luck and computing power.

### 2.3 Sending NSTC: Making Transfers

Sending NSTC is simpler than mining:

1.  **You create a message** saying "I'm sending 5 NSTC to Bob"
2.  **You sign it** with your private key (like a digital signature)
3.  **You broadcast it** to Nostr relays (these are servers that spread messages around)
4.  **Indexers validate it** by checking you actually have 5 NSTC to send
5.  **If it's valid**, everyone's copy of the ledger gets updated

The smallest amount you can send is **1 nok** (0.00000001 NSTC) - like sending a penny, but way smaller.

### 2.4 How Balances Work

Your balance isn't stored in one place. Instead, it's calculated by looking at your complete history:

**Example:**
```
You start with: 0 NSTC
+ You mined a block: +50 NSTC
+ You mined another block: +50 NSTC
- You sent to Alice: -25 NSTC
+ You received from Bob: +10 NSTC
= Your balance: 85 NSTC
```

Anyone can calculate this by looking at all the public messages. That's why you don't need to trust anyone - you can verify it yourself.

### 2.5 What Makes It Decentralized?

**No CEO, no company, no servers we control:**
- Anyone can run an "indexer" (a program that tracks all the messages)
- Anyone can mine
- Anyone can send and receive
- No one can stop you or censor transactions
- No one can change the rules without everyone agreeing

**Think of it like email:**
- Multiple email providers exist (Gmail, Outlook, ProtonMail)
- They all work together even though no one company controls email
- You can switch providers but keep your address
- Nostrcoin works the same way - multiple indexers, all independent, all in sync

### 2.6 What Are "Indexers" and Why Do They Matter?

An **indexer** is just a computer program that:
1. Listens to Nostr relays for Nostrcoin messages
2. Validates each message (checks if mining was done correctly, if someone has enough balance to send, etc.)
3. Keeps a database of everyone's balance
4. Provides a website/API so wallets can check balances

**Important:** Indexers don't control anything. They're like accountants - they can't change the numbers, they just keep track. If an indexer lies, you can check other indexers or run your own.

### 2.7 Why Nostr Instead of a Blockchain?

Traditional cryptocurrencies like Bitcoin require everyone to download and store the entire history (hundreds of gigabytes). With Nostrcoin:
- Messages are stored on existing Nostr relays
- You don't need to download everything to participate
- Indexers do the heavy lifting of tracking balances
- But you can still verify everything if you want to

It's like the difference between downloading every email ever sent vs. just checking your inbox when you need to.

### 2.8 Real-World Analogy

Imagine a town square where:
-  **Miners** are people trying to solve puzzles for prizes (every 10 minutes, new puzzle)
-  **Senders** shout "I'm sending 5 coins to Bob!" and everyone hears it
-  **Indexers** are scribes writing down everything they hear in their notebooks
-  **Anyone** can become a scribe and compare notebooks with others
-  **No mayor** controls the square - it just works because everyone follows the same rules

That's Nostrcoin. No central authority, just rules that everyone can verify.

---

## 3. Technical Architecture

### 3.1 Core Components

Nostrcoin consists of three primary components:

1.  **Validation Library** (`nostrcoin-validator.js`): Pure JavaScript library containing all consensus rules. Runs in browsers or Node.js.
2.  **Indexer Node** (`indexer.js`): Connects to Nostr relays, validates events, maintains state, and provides HTTP API.
3.  **Mining Client** (`miner.js`): Continuously attempts proof-of-work mining for each epoch.

### 3.2 Event Structure

Nostrcoin uses two custom Nostr event kinds, both filtered by the protocol tag `["protocol", "nostrcoin"]`:

#### Mining Events (Kind 30333)

```json
{
"kind": 30333,
"pubkey": "miner_public_key",
"created_at": 1234567890,
"tags": [
["protocol", "nostrcoin"],
["difficulty", "4"],
["nonce", "a1b2c3d4"]
],
"content": "Mining NSTC",
"id": "0000abc123...",
"sig": "signature..."
}
```

Requirements:
- Event ID must start with 4 leading zeros (SHA-256 hash)
- Must occur within a valid epoch boundary
- First valid event in each epoch wins the block reward

#### Transfer Events (Kind 30334)

```json
{
"kind": 30334,
"pubkey": "sender_public_key",
"created_at": 1234567890,
"tags": [
["protocol", "nostrcoin"],
["p", "recipient_public_key"],
["amount", "5.00000000"]
],
"content": "Sending 5 NSTC",
"id": "event_id",
"sig": "signature..."
}
```

Requirements:
- Sender must have sufficient balance
- Amount must be positive and within precision limits (8 decimals)
- Cannot send to self

### 3.3 Proof-of-Work Mining

Mining in Nostrcoin follows these rules:

1.  **Epoch System**: Time is divided into 10-minute epochs starting from genesis (November 27, 2025, 00:00:00 UTC)
2.  **Difficulty Target**: Event ID must start with 4 leading zeros
3.  **One Block Per Epoch**: Only one valid mining event is accepted per epoch
4.  **Timestamp Priority**: If multiple valid events exist, the earliest timestamp wins
5.  **Tie-Breaking**: If timestamps match, the lexicographically smaller event ID wins
6.  **Spam Prevention**: Each user can only attempt mining once per epoch

#### Block Rewards and Halving

```
Initial Reward: 50 NSTC
Halving Interval: 210,000 blocks (~4 years)
Max Supply: 21,000,000 NSTC
Total Halvings: 64 (until reward reaches 0)
```

Reward calculation:
```
reward = 50 / (2^halvings)
halvings = floor(block_height / 210_000)
```

### 3.4 Balance Calculation

Balances are computed deterministically by processing all events in chronological order:

1. Sort events by timestamp, then by ID (for deterministic ordering)
2. Process mining events:
- Award block reward to miner if epoch not already claimed
- Increment block height for halving calculation
3. Process transfer events:
- Validate sender has sufficient balance
- Deduct from sender, credit to recipient
4. Return final balances and total supply

This approach ensures that any participant can independently verify all balances by replaying the event history.

---

## 4. Decentralization Architecture

### 4.1 Why Nostrcoin is Decentralized

Nostrcoin achieves decentralization through multiple mechanisms:

#### No Central Authority
-  **No privileged nodes**: All indexers have equal authority
-  **No consensus voting**: Validation is deterministic based on mathematical rules
-  **No gatekeepers**: Anyone can participate without permission

#### Independent Validation
-  **Open-source validation logic**: The `nostrcoin-validator.js` library is public and auditable
-  **Deterministic rules**: Given the same event history, all validators produce identical results
-  **Client-side verification**: Users can validate their own balances without trusting indexers

#### Relay Distribution
-  **Multiple relays**: Events are distributed across numerous independent Nostr relays
-  **No single point of failure**: If one relay goes down, others continue operating
-  **Censorship resistance**: Relays cannot selectively filter Nostrcoin events without filtering all events

#### Indexer Redundancy
-  **Anyone can run an indexer**: No special permissions or registration required
-  **Peer synchronization**: Indexers can sync with each other to reconcile events
-  **User choice**: Users can query multiple indexers and compare results

### 4.2 Comparison to Traditional Blockchains

| Feature | Traditional Blockchain | Nostrcoin |
|---------|----------------------|-----------|
| **Data Structure** | Linked blocks with hashes | Nostr events with timestamps |
| **Consensus** | PoW/PoS with longest chain | Deterministic validation rules |
| **Node Types** | Full nodes mine & validate | Indexers validate, miners compete |
| **Distribution** | P2P network of nodes | Nostr relay network |
| **Validation** | Each node validates independently | Shared validator library |
| **Entry Barrier** | Must sync entire blockchain | Can start indexing from any point |

### 4.3 Trust Model

Nostrcoin operates on a "don't trust, verify" model:

1.  **Event Authenticity**: Cryptographic signatures prove event authorship
2.  **Balance Verification**: Anyone can replay event history to verify balances
3.  **Mining Validity**: Proof-of-work is trivially verifiable (check leading zeros)
4.  **Transfer Validity**: Validation rules are public and deterministic
5.  **Indexer Honesty**: Users can run their own indexer or compare multiple indexers

---

## 5. Running a Node (Indexer)

Running a Nostrcoin indexer node makes you a full participant in the network. Indexers:
- Validate all mining and transfer events
- Maintain the complete event history in a local database
- Provide HTTP APIs for wallets and explorers
- Sync with other indexers for redundancy

### 5.1 Prerequisites

- Node.js 16+ and npm
- 500MB+ disk space (grows with event history)
- Stable internet connection
- Open port 3000 (or custom port)

### 5.2 Installation

#### Linux (Ubuntu/Debian)

```bash
# Update system
sudo  apt  update && sudo  apt  upgrade  -y

# Install Node.js (if not installed)
curl  -fsSL  https://deb.nodesource.com/setup_18.x  |  sudo  -E  bash  -
sudo  apt-get  install  -y  nodejs

# Clone repository
git  clone  https://github.com/saccoci/nostrcoin.git
cd  nostrcoin

# Install dependencies
npm  install

# Start indexer
npm  start
```

**Run as systemd service (persistent):**

```bash
# Create service file
sudo  nano  /etc/systemd/system/nostrcoin.service
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

Enable and start:
```bash
sudo  systemctl  enable  nostrcoin
sudo  systemctl  start  nostrcoin
sudo  systemctl  status  nostrcoin
```

#### Windows

```powershell
# Install Node.js from https://nodejs.org/

# Clone repository
git clone https://github.com/saccoci/nostrcoin.git
cd nostrcoin

# Install dependencies
npm install

# Start indexer
npm start
```

**Run as Windows service (using NSSM):**

```powershell
# Download NSSM from https://nssm.cc/download

# Install service
nssm install NostrcoinIndexer "C:\Program Files\nodejs\node.exe"
nssm set NostrcoinIndexer AppDirectory "C:\path\to\nostrcoin"
nssm set NostrcoinIndexer AppParameters "indexer.js"
nssm start NostrcoinIndexer
```

#### macOS

```bash
# Install Node.js (using Homebrew)
brew  install  node

# Clone repository
git  clone  https://github.com/saccoci/nostrcoin.git
cd  nostrcoin

# Install dependencies
npm  install

# Start indexer
npm  start
```

**Run as LaunchAgent (persistent):**

Create `~/Library/LaunchAgents/com.nostrcoin.indexer.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE  plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
<key>Label</key>
<string>com.nostrcoin.indexer</string>
<key>ProgramArguments</key>
<array>
<string>/usr/local/bin/node</string>
<string>/path/to/nostrcoin/indexer.js</string>
</array>
<key>RunAtLoad</key>
<true/>
<key>KeepAlive</key>
<true/>
</dict>
</plist>
```

Load:
```bash
launchctl  load  ~/Library/LaunchAgents/com.nostrcoin.indexer.plist
```

### 5.3 VPS Deployment (DigitalOcean, AWS, Vultr, etc.)

#### Quick Setup

```bash
# Create new droplet/instance (Ubuntu 22.04)
# SSH into server

# Install Node.js
curl  -fsSL  https://deb.nodesource.com/setup_18.x  |  sudo  -E  bash  -
sudo  apt-get  install  -y  nodejs  git

# Clone and setup
git  clone  https://github.com/saccoci/nostrcoin.git
cd  nostrcoin
npm  install

# Configure firewall
sudo  ufw  allow  3000/tcp
sudo  ufw  enable

# Run with PM2 (process manager)
sudo  npm  install  -g  pm2
pm2  start  indexer.js  --name  nostrcoin-indexer
pm2  save
pm2  startup
```

#### Docker Deployment

Create `Dockerfile`:
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
docker  build  -t  nostrcoin-indexer  .
docker  run  -d  -p  3000:3000  -v $(pwd)/nostrcoin.db:/app/nostrcoin.db  nostrcoin-indexer
```

### 5.4 Configuration

Edit `indexer.js` to customize your node:

```javascript
const  CONFIG  = {
port:  3000, // HTTP API port
relays:  [  // Nostr relays to monitor
'wss://relay.damus.io',
'wss://relay.nostr.band',
// Add more relays...
],
pollInterval:  15000, // Poll relays every 15 seconds
syncInterval:  30000, // Sync with peers every 30 seconds
dbPath:  './nostrcoin.db', // SQLite database location
peerIndexers:  [  // Other indexers to sync with
'http://peer-indexer-1.com:3000',
'http://peer-indexer-2.com:3000',
]
};
```

### 5.5 Monitoring Your Node

Check node status:
```bash
# View API endpoints
curl  http://localhost:3000/stats

# Check database stats
curl  http://localhost:3000/db-stats

# View peer connections
curl  http://localhost:3000/peers

# Check events
curl  http://localhost:3000/events
```

Monitor logs:
```bash
# Linux (systemd)
sudo  journalctl  -u  nostrcoin  -f

# PM2
pm2  logs  nostrcoin-indexer

# Windows (Event Viewer)
Get-EventLog  -LogName  Application  -Source  NostrcoinIndexer
```

### 5.6 Becoming a Public Indexer

To allow others to use your indexer:

1.  **Ensure port 3000 is accessible** from the internet
2.  **Configure SSL/TLS** (recommended for production):
```bash
# Use Caddy for automatic HTTPS
sudo apt install caddy
caddy reverse-proxy --from nostrcoin.yourdomain.com --to localhost:3000
```
3.  **Add your indexer URL to community lists**
4.  **Announce on Nostr** with your indexer URL

### 5.7 Peer Synchronization

Adding peer indexers improves network resilience:

```javascript
peerIndexers: [
'https://indexer-1.nostrcoin.org',
'https://indexer-2.nostrcoin.org',
'http://local-backup-indexer:3000'
]
```

Your indexer will:
- Fetch events from peers every 30 seconds
- Resolve conflicts automatically (earliest timestamp wins)
- Share events with peers that query your `/export` endpoint

---

## 6. Mining

### 6.1 Setting Up Mining

```bash
# Create .env file
echo  "NOSTR_PRIVATE_KEY_HEX=your_64_character_hex_key"  >  .env

# Start mining
node  miner.js
```

### 6.2 Mining Strategy

-  **Continuous Operation**: Miner automatically moves to next epoch after finding a block
-  **Epoch Awareness**: Stops mining when epoch boundary is reached
-  **Resource Usage**: Single-threaded, suitable for personal computers
-  **Expected Return**: Depends on network hashrate and your computing power

### 6.3 Solo vs Pool Mining

Currently, Nostrcoin only supports solo mining. Each miner competes independently to find valid proof-of-work for each epoch.

---

## 7. Economic Model

### 7.1 Supply Schedule

```
Block Height | Reward | Supply Added | Total Supply
0 - 209,999 | 50 | 10,500,000 | 10,500,000
210,000 - 419,999| 25 | 5,250,000 | 15,750,000
420,000 - 629,999| 12.5 | 2,625,000 | 18,375,000
630,000 - 839,999| 6.25 | 1,312,500 | 19,687,500
... | ... | ... | ...
After 64 halvings| 0 | ~0 | 21,000,000
```

### 7.2 Precision and Units

-  **Base Unit**: 1 nok = 0.00000001 NSTC
-  **Precision**: 8 decimal places (100,000,000 noks per NSTC)
-  **Display Format**: Always show 8 decimals (e.g., "5.00000000 NSTC")

### 7.3 Use Cases (Educational)

While Nostrcoin has no monetary value, it demonstrates:
- Microtransaction capabilities (transfer any amount ≥ 1 nok)
- Tipping mechanisms on Nostr
- Token-gated content and services
- Educational blockchain concepts

---

## 8. Security Considerations

### 8.1 Attack Vectors

**Double-Spend Prevention**
- Deterministic validation ensures same-epoch blocks are rejected
- First valid block (by timestamp) always wins

**51% Attack Resistance**
- Mining is computationally expensive (4 leading zeros)
- Epoch system prevents rapid block production
- No single entity controls relays

**Sybil Attack Mitigation**
- One attempt per pubkey per epoch
- Proof-of-work requirement prevents spam

### 8.2 Known Limitations

-  **No SPV Mode**: Light clients must trust indexers (or run their own)
-  **Relay Dependence**: Events must propagate through Nostr relays
-  **Timestamp Trust**: Relies on honest timestamp reporting by miners

---

## 9. How You Can Help Nostrcoin

The network needs **always-on indexer nodes** to stay resilient and decentralized. True decentralization requires active participation.

### 9.1 Run an Always-On Node

The most valuable contribution is running a public indexer 24/7:

1. **Set up a VPS** (DigitalOcean, AWS, Vultr, etc.)
   - Even a $5/month droplet makes a difference
   - The more geographically distributed, the better
   - Uptime matters more than raw performance

2. **Install and run the indexer** (see Section 5.2 and 5.3)
   - Follow the installation guide for your platform
   - Use PM2, systemd, or Docker for persistence
   - Configure firewall to allow port 3000

3. **Keep it running**
   - Monitor with system tools or PM2
   - Set up automatic restarts on failure
   - Consider backup power/connectivity

4. **Make it public**
   - Open port 3000 to the internet
   - Consider setting up SSL/TLS with a domain
   - Add CORS headers for web wallet compatibility

5. **Share your indexer URL**
   - See section 9.2 below

**Why this matters:**
- More nodes = more resilient network
- More nodes = faster sync for new participants
- More nodes = harder to censor or attack
- Decentralization requires actual distributed nodes!

### 9.2 Share Your Peer Address

If you're running an indexer or validator, **share your connection details**:

1. **Add it to the forum**: https://nostrcoin.boards.net
   - Create a thread with your node details
   - Include uptime expectations
   - List your geographic location (optional)

2. **Post it on Nostr** with hashtag #nostrcoin
   - Announce your indexer's public URL
   - Share your node's capabilities

3. **Add it to GitHub issues** as a peer indexer
   - Create an issue or PR adding your node to README
   - Help maintain a community node list

4. **Configure peer sync** in your `indexer.js`:
```javascript
   peerIndexers: [
     'http://your-indexer-ip:3000',
     'https://nostrcoin.yourdomain.com',
     // Share these URLs publicly!
   ]
```

5. **For validator nodes**: Share connection details
   - If running a validator-only setup
   - Include API endpoints if available
   - Document any custom configurations

### 9.3 What We Need Most

**Priority 1: Always-On VPS Indexers**
- Geographic diversity (different countries/continents)
- Reliable hosting providers
- 24/7 uptime commitment
- Public API accessibility

**Priority 2: Peer Address Sharing**
- Publicly announced node URLs
- Community-maintained node lists
- Peer discovery mechanisms
- Inter-node communication standards

**Priority 3: Network Participation**
- Testing and bug reports
- Responsible exploit discovery
- Documentation improvements
- Edge case identification

**Priority 4: Infrastructure Development**
- Automated node discovery systems
- Health monitoring tools
- Load balancing solutions
- Fallback mechanisms

**The network is only as decentralized as the number of independent nodes running. Your node matters.**

---

## 10. Conclusion

Nostrcoin demonstrates that decentralized currency systems need not require dedicated blockchain infrastructure. By leveraging Nostr's existing relay network and event distribution system, Nostrcoin achieves:

- True decentralization without central coordination
- Permissionless participation for all users
- Independent verifiability of all transactions
- Interoperability with existing Nostr applications

While Nostrcoin remains an educational experiment, it validates the concept of protocol-native currencies and opens possibilities for future Nostr-based financial applications.

The network's strength lies in its participants. By running indexers
