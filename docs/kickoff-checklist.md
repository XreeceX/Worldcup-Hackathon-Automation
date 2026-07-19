# Kickoff Checklist — do these BEFORE writing product code

Written at 00:00 BST Sun Jul 19. Runway: **12h to local deadline (12:00 BST)**, 24h to global (23:59 UTC). Everything here is de-risking — each item either kills a false assumption cheaply or removes a blocking dependency from the critical path.

## Hour zero — prove the pipeline before building on it (~45 min)

The single biggest project risk is discovering at hour 10 that a proof doesn't verify. Run the whole TxLINE chain once, by hand, with throwaway scripts (sponsor repo `txodds/tx-on-chain` has copy-paste examples):

1. [ ] Devnet wallet: generate keeper keypair, airdrop SOL (airdrop is flaky — do it now, fund **three** wallets: keeper, demo-pledger, demo-joiner; ~2 SOL each covers everything including the 0.15 SOL commitment rent)
2. [ ] Guest JWT from `txline-dev.txodds.com` → on-chain `subscribe(1, 4)` → token activation (mind the two-colon signature message; never mix devnet/mainnet hosts — sponsor brief §3/§4)
3. [ ] `GET /scores/historical/18241006` → confirm `action=game_finalised`, `statusId=100`, and **record the real `seq`** in a scratch note
4. [ ] `GET /scores/stat-validation?fixtureId=18241006&seq=<real>&statKeys=1,2` → proof package returns; note `minTimestamp` and derive `epochDay` from it
5. [ ] Run the repo's example validate script: `validateStatV2` `.view()` simulation passes against the devnet program with that proof and the BTTS strategy

If step 5 is green, the entire settlement thesis is proven and everything after is assembly. If it's red, we know at hour 1 — not hour 10 — and the fallback conversation (keeper-custody mode) happens with time to act.

## Workspace & hygiene (~30 min, parallelizable with airdrops)

6. [ ] Fresh top-level dirs: `program/` (Anchor), `keeper/`, `indexer/`, `web/` — the existing repo code is examples only; **do not build on it**, but keep it until the TxLINE snippets have been mined
7. [ ] `.gitignore` covers `.env*`, keypair JSONs, `target/`; commit a `.env.example` with every var from design §7.1 — JWT/API-token must never enter git history (repo goes public at submission)
8. [ ] Copy TxLINE IDL + TS types from `tx-on-chain` into a shared `lib/txline/` with attribution (T&C: pre-existing code must be public + attributed)
9. [ ] Anchor toolchain sanity: `anchor init` + `anchor build` + deploy a hello program to devnet once — toolchain version fights cost 40 minutes when they ambush you mid-build
10. [ ] Postgres up (local Docker now; Railway later), Vercel + Railway logins verified

## Submission logistics (do now, they're not build work)

11. [ ] Superteam Earn account ready; local London Google form link located and bookmarked
12. [ ] Confirm who fronts the entry (human owner per T&C §5.1) and team list ≤ 3

## Schedule posture (decide now, not at 10:00)

- **Target the local 12:00 BST deadline** with the irreducible demo set: Phase 1 (individual loop) + Board → Wizard → Match Center → Ceremony → Receipt.
- Kill clocks: proof pipeline green by **02:00** · resolve tx landing from keeper replay by **05:00** · frontend demo path walkable by **09:00** · dress rehearsal **09:30** · record **10:00–11:00** · submit local **by 11:30**.
- Group/DAO join, claims page polish, ticker/feed rail happen only if ahead — or in the window between local and global deadlines (submit an improved build + same video to the global track by 23:59 UTC).
- If any kill clock slips by >90 min, drop the local pool without ceremony and re-anchor everything to 23:59 UTC — a complete product at the global deadline beats a broken one at noon.
