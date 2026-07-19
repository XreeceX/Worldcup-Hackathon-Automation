# Demo Video Voice-Over Script — PledgePitch

Target runtime **4:30** (hard cap 4:45). Pace ≈ 140 words/min — every segment
below fits its time window with a breath to spare. Record each segment as its
own clip if possible; the video is cut to these exact timestamps.

The video is recorded in **replay mode** against fixture 18241006
(England 1–2 Argentina) — the narration says so out loud in segment 4; honesty
reads as engineering confidence.

---

## 0:00 – 0:30 · The board (home page, ticker + market pulse scrolling)

> Every World Cup, fans make millions of promises. "If we win, drinks are on
> me. If both teams score, I'll donate to the grassroots club." Zero of them
> are enforceable. PledgePitch turns a fan's promise into a protocol. And no —
> this is not betting. There's no bookmaker, no counterparty, no odds. The fan
> *wants* the condition to come true, and the beneficiary is chosen up front.
> This is the public board — live pledges, locked in SOL, settled by the final
> whistle.

*(≈ 70 words)*

## 0:30 – 1:05 · Creating a pledge (fixture page → 3-step wizard)

> Here's England versus Argentina. Creating a pledge takes three steps. Pick a
> condition — both teams score, a side wins, goes to penalties. Notice the
> small print: extra time counts, shootouts are a separate condition. We tell
> you exactly what you're signing. Choose the beneficiary — fixed forever at
> signing — and the deposit. One signature, and the funds move into a program
> vault on Solana. No admin key can touch them. There it is on the board: the
> Both Teams Score Collective, five hundredths of a SOL behind it.

*(≈ 85 words)*

## 1:05 – 1:35 · A collective forms (commitment page, member joins)

> A pledge doesn't have to stay individual. Anyone can join this one — joining
> is co-signing the same condition, into the same vault. A second fan joins,
> and the total rolls up to zero point one SOL. No vote, no committee —
> membership *is* the commitment. The on-chain clock closes membership at
> kickoff automatically; until then, anyone can walk away with a full
> withdrawal. And one more pledge sits on this match: the England Winners
> Circle. Remember them.

*(≈ 78 words)*

## 1:35 – 2:20 · Match goes live (countdown → locked → Match Centre)

> Kickoff. From this second, the vault is locked — not by us, by the clock
> inside the program. What you're watching now is a real, finalised World Cup
> fixture replayed through the identical pipeline our keeper runs on live
> matches — same stream, same data, same proofs. England score. Argentina
> answer — twice. Both teams have scored, and the condition card flips to MET.
> But nothing has settled yet — a scoreboard is just a claim. Settlement needs
> proof.

*(≈ 78 words)*

## 2:20 – 3:20 · The settlement (full time → ceremony → explorer)

> Full time. TxLINE finalises the match and anchors its statistics to Solana
> as Merkle roots. Our keeper hears the final whistle, fetches the Merkle
> proof for the exact final-score record, and submits one transaction. Inside
> it, the program calls TxLINE's on-chain verifier — validate-stat-V2 — and
> only if the proof checks out against the on-chain root does the vault pay
> the beneficiary. Same transaction. Atomically. There's the ceremony — zero
> point one SOL delivered. And here's the receipt on Solana Explorer: the
> resolve call, the verifier CPI, the transfer. No human decided this outcome.
> A Merkle proof did.

*(≈ 100 words)*

## 3:20 – 3:55 · The NO path (refunded pledge → claims page)

> But England lost — so what about the England Winners Circle? The same proof
> that paid one vault marks this one Refunded. No winner takes their money —
> there was never a counterparty. Instead, every member reclaims their own
> deposit, forever — pull-based, so even a five-hundred-member collective can
> never jam. One click, and the deposit is back in the fan's wallet. When the
> condition fails, the protocol keeps its other promise.

*(≈ 72 words)*

## 3:55 – 4:30 · Zoom out (board of receipts → end card)

> That's the whole loop: promise, lock, proof, payout — or proof and refund.
> Under it: one Anchor program on devnet with no admin key in the fund path, a
> keeper that automates but can never override, and an indexer for the board.
> If the oracle vanished tomorrow, an on-chain timeout still guarantees every
> member an exit. Built in twenty-four hours on TxLINE and Solana.
> PledgePitch — put it on the line.

*(≈ 70 words)*

---

**Total ≈ 553 words ≈ 4:00 of speech across 4:30 of video** — comfortable
margin under the 4:45 cap, with natural pauses at segment boundaries.

## Recording notes

- Each segment's audio must not exceed its time window; if a take runs long,
  drop the italicised colour lines first ("Remember them", "Same transaction.
  Atomically.").
- Numbers: say "zero point one SOL" not "0.1"; "validate-stat-V-two".
- The 2:20–3:20 settlement segment is the emotional peak — slow down 10%
  there, especially "No human decided this outcome. A Merkle proof did."
