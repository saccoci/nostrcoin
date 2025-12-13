# ⚡ Nostrcoin (NSTC)

A Nostr-native cryptocurrency experiment with proof-of-work mining.
This is for fun and educational purposes only! Do not invest any real money.

**Version:** 0.0.3  
**Status:** Educational/Experimental  
**Max Supply:** 21,000,000 NSTC  
**Block Reward:** 50 NSTC  
**Epoch Time:** 10 minutes (in Nostrcoin, an "epoch" is a 10 minute period)
**Event Kinds:** 30333 (mining), 30334 (transfers)

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
├── nostrcoin-validator.js    # Core validation library (runs anywhere)
├── indexer.js                 # Indexer node (listens to relays, provides API)
├── nostrcoin_wallet.html      # Web wallet (mining, sending, receiving)
├── package.json               # Node.js dependencies
├── README.md                  # This file
└── LICENSE                    # MIT License
```

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
- Validate all events
- Provide HTTP API on port 3000

### Use the Wallet

Open `nostrcoin_wallet.html` in your browser or visit:  
**https://saccoci.codeberg.page/pages/nostrcoin_wallet.html**

Features:
- Connect with Nostr extension (Alby, AKA Profiles, Gooti, etc.)
- Mine NSTC with proof-of-work
- Send NSTC to other users
- View transaction history
- Generate receive QR codes

## How It Works

### Mining (Proof-of-Work)

1. User attempts to mine by creating a Nostr event
2. Event ID must start with 4 leading zeros (SHA-256)
3. First valid event in each 10-minute epoch wins 50 NSTC
4. Only one attempt per user per epoch (spam prevention)

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
GET  /stats                # Network statistics
GET  /events               # All valid events
POST /validate-mining      # Test mining event validity
```

Example:
```bash
curl http://localhost:3000/balance/8770fd14ef56ba04f9eb7aee7824eee44487902ea1fe4e37d700347184ccaca2
```

## Configuration

Edit `indexer.js` to customize:

```javascript
const CONFIG = {
  port: 3000,
  relays: [
    'wss://relay.damus.io',
    'wss://nos.lol',
    // Add more relays...
  ]
};
```

## Decentralization

**Anyone can run an indexer.** The indexer doesn't control consensus—it just indexes public Nostr events. Users can:

- Run their own indexer
- Validate against multiple indexers
- Verify the entire event history independently

This is inspired by Bitcoin's model: full nodes vs. SPV wallets.

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
- [x] Web wallet
- [ ] Federation (multiple trusted indexers)
- [ ] Mobile wallet
- [ ] Halving schedule
- [ ] Lightning integration

## Educational Purpose

⚠️ **This is an educational experiment.** Nostrcoin has no financial value and is not intended as an investment. It's a demonstration of how decentralized systems can be built on Nostr.

## Contributing

Contributions welcome! Open issues or submit PRs on Codeberg.

## License

MIT License - See LICENSE file

## Links

- **Wallet**: https://saccoci.codeberg.page/pages/nostrcoin_wallet.html
- **Repository**: https://codeberg.org/saccoci/nostrcoin
- **Nostr**: Find updates via npub (coming soon)

---

**Built on Nostr. Inspired by Bitcoin. Educational by design.**