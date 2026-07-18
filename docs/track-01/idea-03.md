# Idea 03 — Proof-of-Witness: Fan Passport

## One-line pitch

The first cryptographic proof that you were watching when it happened — not a collectible you can buy, a mathematical record of your presence at a World Cup moment.

---

## Core insight

Traditional sports memorabilia is physical and forgeable. Digital collectibles are copy-paste. TxLINE's Merkle proofs anchored on Solana create a new primitive: **"I was there" as a cryptographic truth**. Your wallet signature + the TxLINE Merkle proof for a live event = an attestation that cannot be manufactured retroactively.

This is not betting. The sport is not a financial instrument. It is a source of verified real-world moments that anchor human presence.

---

## How it works

You connect your wallet and open the app while a match is live. The TxLINE SSE stream runs in the backend. When a significant event fires — a goal, a red card, the final whistle — a notification appears: **"Sign to stamp this moment."**

You have a short window (5 minutes) to sign. Your wallet signature + the TxLINE Merkle proof for that stat sequence are submitted on-chain together. The stamp is minted. Miss the window, miss the stamp — presence cannot be faked after the fact.

Each stamp embeds:
- Match fixture ID and event type
- TxLINE Merkle proof (stat-validation sequence)
- Wallet signature + block timestamp
- Pre-match odds at kickoff (from TxLINE StablePrice) — determines rarity

---

## The passport

Each wallet has a Solana PDA — their Fan Passport. It accumulates stamps across the 104-match tournament. Visually rendered like a physical passport with pages and ink stamps, each one cryptographically rooted in on-chain proofs.

**Rarity is objective, not manufactured.** TxLINE's pre-match StablePrice odds define how unlikely an outcome was. Witnessing a 12-to-1 upset yields a rarer stamp than witnessing a favourite win. The rarity score is derived from real consensus odds — no curator decides it arbitrarily.

---

## What you can do with a passport

- **Community gating** — only wallets with stamps from all group stage matches access a fan council
- **Dedicated fan credential** — prove you followed the tournament in real-time, not via highlights
- **Rare moment flex** — "I witnessed the semifinal comeback" is a verifiable claim, not a social media post anyone can make
- **Post-tournament rewards** — brands, organizers, or TxLINE could airdrop to high-witness-count passports
- **Analyst credentialing** — pair with prediction records (idea-01) to prove both presence and accuracy

---

## Technical architecture

```
TxLINE SSE stream
  └── backend detects significant events (goal, card, FT)
        └── fetches stat-validation proof package
              └── emits "stamp window open" to connected wallets
                    └── user signs witness claim (wallet sig + event hash)
                          └── keeper submits on-chain:
                                stamp PDA (passport + event + proof + sig)
```

**On-chain state:**
- `passport` PDA per wallet (total stamps, dedication score)
- `stamp` account per witnessed event (fixture_id, event_type, merkle_proof, witness_sig, rarity_bps)

**TxLINE primitives used:**
- `/api/scores/stream` SSE — live event detection
- `/api/scores/stat-validation` — Merkle proof package per event
- `/api/odds/snapshot/{fixtureId}` — StablePrice odds for rarity calculation
- `validateStat` or `validateStatV2` — on-chain proof verification embedded in stamp

---

## Demo flow

1. Wallet connected, passport shown (empty pages)
2. Live match on screen, TxLINE SSE running
3. Goal fires — notification: "Sign to stamp this moment"
4. User signs — stamp minted on-chain with Merkle proof embedded
5. Passport page fills with new stamp, rarity indicator shown
6. Proof receipt modal: stat keys, hashes, PDA, Solana explorer link
7. Judge opens explorer — sees stamp tx with CPI proof verification

---

## Why it's almost impossible

You're not building a collectible — you're building a **new attestation primitive**. The challenge: UX must be frictionless enough that fans sign during a goal celebration (seconds of attention), and the backend must handle burst events across simultaneous matches. The signing window is a hard real-time constraint with no retry path.

---

## What's not in scope

- Location-based presence (no GPS, no tickets)
- Post-match stamp minting of any kind
- Transferable stamps (soulbound by design — presence is personal)
- Financial value / trading of stamps
