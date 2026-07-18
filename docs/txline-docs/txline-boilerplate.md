# TxLINE Boilerplate — Devnet Examples Reference

> Extracted from https://github.com/txodds/tx-on-chain/tree/main/examples/devnet
>
> All examples target **devnet only**. Never mix hosts.

---

## Constants (config.ts)

```typescript
export const API_BASE_URL  = "https://txline-dev.txodds.com/api";
export const JWT_URL       = "https://txline-dev.txodds.com/auth/guest/start";
export const TOKEN_DECIMALS = 6;
```

| Network item | Value |
|---|---|
| RPC | `https://api.devnet.solana.com` |
| TxLINE program | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxLINE token mint | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |

---

## Run command (all scripts)

```bash
TOKEN_MINT_ADDRESS=4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG \
ANCHOR_PROVIDER_URL="https://api.devnet.solana.com" \
ANCHOR_WALLET="./_keys/your-wallet.json" \
ts-node examples/devnet/scripts/<script>.ts
```

---

## Auth flow (users.ts)

### 1. Get a guest JWT

```typescript
const response = await axios.post("https://txline-dev.txodds.com/auth/guest/start");
const jwt = response.data.token; // short-lived; renew on 401
```

### 2. Subscribe on-chain (service level 1, World Cup free tier)

```typescript
const tx = await program.methods
  .subscribe(1, 4)  // serviceLevelId=1, weeks must be multiple of 4
  .accounts({ user, pricingMatrix, tokenMint, userTokenAccount, tokenTreasuryVault, tokenTreasuryPda, tokenProgram, associatedTokenProgram, systemProgram })
  .transaction();

const txSig = await connection.sendRawTransaction(tx.serialize());
await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed');
```

### 3. Activate API token

```typescript
// Activation message for empty leagues (World Cup free tier)
const messageString = `${txSig}:${selectedLeagues.join(",")}:${jwt}`;
const message = new TextEncoder().encode(messageString);
const signatureBytes = nacl.sign.detached(message, user.secretKey);
const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

const activationResponse = await axios.post(
  `${API_BASE_URL}/token/activate`,
  { txSig, walletSignature: signatureBase64, leagues: [] },
  { headers: { Authorization: `Bearer ${jwt}` } }
);
const apiToken = activationResponse.data.token;
```

### 4. All subsequent data requests

```typescript
// Headers required on every data call:
Authorization: Bearer <jwt>
X-Api-Token: <apiToken>
```

### JWT auto-renewal pattern (axios interceptor)

The `users.ts` interceptor catches `401` responses, calls `renewJwt()`, and retries the original request transparently. Use `users.apiClient` for all data requests instead of raw axios.

```typescript
// Renew JWT without re-subscribing
const response = await axios.post(config.JWT_URL);
const newJwt = response.data.token;
```

---

## Anchor program setup

```typescript
import { Program } from "@coral-xyz/anchor";
import { Txoracle } from "../types/txoracle";
import TxoracleJson from "../idl/txoracle.json";
import * as anchor from "@coral-xyz/anchor";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = new Program<Txoracle>(TxoracleJson as unknown as Txoracle, provider);
```

---

## REST endpoints

### Fixtures

```typescript
// Full fixture universe (filter by competitionId=72 for World Cup)
GET /fixtures/snapshot?competitionId=72&startEpochDay=20624

// Hourly fixture updates (for cancel detection)
GET /fixtures/updates/${epochDay}/${hourOfDay}

// Fixture validation proof (for void/cancel logic)
GET /fixtures/validation?fixtureId=${fixtureId}&timestamp=${ts}
```

### Odds

```typescript
// Current odds for a fixture
GET /odds/snapshot/${fixtureId}
GET /odds/snapshot/${fixtureId}?asOf=${Date.now()}

// Interval backfill
GET /odds/updates/${epochDay}/${hourOfDay}/${interval}

// Live SSE stream
GET /odds/stream  // SSE; requires Auth + X-Api-Token headers
```

### Scores

```typescript
// Current score for a fixture
GET /scores/snapshot/${fixtureId}
GET /scores/snapshot/${fixtureId}?asOf=${Date.now()}

// Interval scan (5-min windows; scan backwards for recent records)
GET /scores/updates/${epochDay}/${hourOfDay}/${interval}

// Historical scores (fixtures started 2w–6h ago)
GET /scores/historical/${fixtureId}

// Live SSE stream
GET /scores/stream  // SSE; requires Auth + X-Api-Token headers

// Stat validation proof package (V2 — primary)
GET /scores/stat-validation?fixtureId=&seq=&statKeys=1,2

// Stat validation proof package (V3 multiproof — larger payloads)
GET /scores/stat-validation-v3?fixtureId=&seq=&statKeys=1,2,3001,3002

// Legacy single-stat
GET /scores/stat-validation?fixtureId=&seq=&statKey=1
```

**Key rules:**
- `seq` must be observed from a real score record — never invent `0`
- Prefer records with `action=game_finalised` / `statusId=100` for FT settlement
- Derive `epochDay` from the proof's `minTimestamp`, not wall-clock

---

## Soccer stat keys

| Key | Stat |
|---|---|
| 1 / 2 | P1 / P2 total goals |
| 3 / 4 | P1 / P2 yellow cards |
| 5 / 6 | P1 / P2 red cards |
| 7 / 8 | P1 / P2 corners |
| 1001 / 1002 | P1 / P2 H1 goals |
| 1007 / 1008 | P1 / P2 H1 corners |
| 2001 / 2002 | P1 / P2 HT goals (half-time snapshot) |
| 3001 / 3002 | P1 / P2 H2 goals  ← NOT ET (see period-prefix formula below) |
| 4001 / 4002 | P1 / P2 ET1 goals |
| 5001 / 5002 | P1 / P2 ET2 goals |
| 6001 / 6002 | P1 / P2 penalty shootout goals |
| 7001 / 7002 | P1 / P2 ET-total goals |

---

## Interval scan pattern (find recent score records)

```typescript
const scanRecentScores = async (fixtureId?: number) => {
  const msPerInterval = 300_000; // 5-minute windows
  const now = new Date();

  for (let i = 0; i < 24; i++) {
    const t = new Date(now.getTime() - i * msPerInterval);
    const epochDay = Math.floor(t.getTime() / 86_400_000);
    const hour = t.getUTCHours();
    const interval = Math.floor(t.getUTCMinutes() / 5);

    let url = `/scores/updates/${epochDay}/${hour}/${interval}`;
    if (fixtureId) url += `?fixtureId=${fixtureId}`;

    const response = await apiClient.get(url);
    if (response.data.length > 0) {
      // response.data[0] has .FixtureId, .Ts, .seq
    }
  }
};
```

---

## SSE stream pattern (scores or odds)

```typescript
import { EventSource } from 'eventsource';

function connect() {
  const eventSource = new EventSource(`${API_BASE_URL}/scores/stream`, {
    fetch: async (input, init) => {
      const headers: Record<string, string> = {
        ...(init?.headers as Record<string, string>),
        'Accept-Encoding': 'deflate',
        'Authorization': `Bearer ${authState.jwt}`,
        'X-Api-Token': authState.apiToken,
      };

      // Resume from last seen event ID to avoid gaps
      if (lastSeenId) headers['Last-Event-ID'] = lastSeenId;

      let response = await fetch(input, { ...init, headers });

      if (response.status === 401 || response.status === 403) {
        const newJwt = await renewJwt();
        headers['Authorization'] = `Bearer ${newJwt}`;
        response = await fetch(input, { ...init, headers });
      }

      return response;
    },
  });

  eventSource.onmessage = (event) => {
    if (event.lastEventId) lastSeenId = event.lastEventId;
    const data = JSON.parse(event.data);
    // data has: FixtureId, Ts, seq, action, statusId, period, scores, etc.
  };

  eventSource.onerror = (err) => {
    if (eventSource.readyState === 2) { // CLOSED
      eventSource.close();
      setTimeout(connect, 3_000); // reconnect after 3s
    }
  };
}

let lastSeenId: string | undefined;
connect();
```

---

## validateStatV2 — full proof flow

### Step 1: Fetch proof package

```typescript
// statKeys order matters — indexes 0..N are referenced in strategy predicates
const url = `/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKeys=1,2`;
const val = (await apiClient.get(url)).data;
```

### Step 2: Build payload

```typescript
import { IdlTypes } from "@coral-xyz/anchor";
type StatValidationInput = IdlTypes<Txoracle>["statValidationInput"];
type ProofNode = IdlTypes<Txoracle>["proofNode"];

const mapProof = (arr: any[]): ProofNode[] =>
  arr.map(n => ({ hash: Array.from(n.hash), isRightSibling: n.isRightSibling }));

const payload: StatValidationInput = {
  ts: new BN(val.summary.updateStats.minTimestamp),
  fixtureSummary: {
    fixtureId: new BN(val.summary.fixtureId),
    updateStats: {
      updateCount: val.summary.updateStats.updateCount,
      minTimestamp: new BN(val.summary.updateStats.minTimestamp),
      maxTimestamp: new BN(val.summary.updateStats.maxTimestamp),
    },
    eventsSubTreeRoot: Array.from(val.summary.eventStatsSubTreeRoot),
  },
  fixtureProof: mapProof(val.subTreeProof),
  mainTreeProof: mapProof(val.mainTreeProof),
  eventStatRoot: Array.from(val.eventStatRoot),
  stats: val.statsToProve.map((stat: any, i: number) => ({
    stat,
    statProof: mapProof(val.statProofs[i]),
  })),
};
```

### Step 3: Derive daily_scores_roots PDA

```typescript
// CRITICAL: use minTimestamp from the proof, not wall-clock
const epochDay = Math.floor(val.summary.updateStats.minTimestamp / (24 * 60 * 60 * 1000));

const [dailyScoresPda] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("daily_scores_roots"), new BN(epochDay).toBuffer("le", 2)],
  program.programId
);
```

### Step 4: Build strategy

```typescript
type NDimensionalStrategy = IdlTypes<Txoracle>["nDimensionalStrategy"];

// P1 wins (goals subtract > 0)
const strategyHomeWin: NDimensionalStrategy = {
  geometricTargets: [],
  distancePredicate: null,
  discretePredicates: [{
    binary: { indexA: 0, indexB: 1, op: { subtract: {} }, predicate: { threshold: 0, comparison: { greaterThan: {} } } }
  }]
};

// Draw (goals subtract = 0)
const strategyDraw: NDimensionalStrategy = {
  geometricTargets: [],
  distancePredicate: null,
  discretePredicates: [{
    binary: { indexA: 0, indexB: 1, op: { subtract: {} }, predicate: { threshold: 0, comparison: { equalTo: {} } } }
  }]
};

// Both teams score (each goals > 0)
const strategyBTTS: NDimensionalStrategy = {
  geometricTargets: [],
  distancePredicate: null,
  discretePredicates: [
    { single: { index: 0, predicate: { threshold: 0, comparison: { greaterThan: {} } } } },
    { single: { index: 1, predicate: { threshold: 0, comparison: { greaterThan: {} } } } },
  ]
};

// Geometric (score prediction distance)
const strategyGeometric: NDimensionalStrategy = {
  geometricTargets: [
    { statIndex: 0, prediction: 0 },
    { statIndex: 1, prediction: 1 },
  ],
  distancePredicate: { threshold: 2, comparison: { lessThan: {} } },
  discretePredicates: []
};
```

**Strategy rules:**
- Every stat in `statKeys` must appear in exactly one predicate (`IncompleteStatCoverage` error if not)
- `indexA` / `indexB` / `index` refer to position in `statKeys` array (0-based)
- Comparison ops: `{ greaterThan: {} }`, `{ lessThan: {} }`, `{ equalTo: {} }`
- Binary ops: `{ subtract: {} }`

### Step 5: Call validateStatV2

```typescript
const computeBudgetIx = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

// .view() simulates without sending a tx — use this for read-only checks
const isValid = await program.methods
  .validateStatV2(payload, strategy)
  .accounts({ dailyScoresMerkleRoots: dailyScoresPda })
  .preInstructions([computeBudgetIx])
  .view();

// For CPI (inside your own program's instruction), call the instruction normally
```

---

## validateStatV3 — multiproof (4+ legs)

Use V3 when V2 exceeds MTU (~1000 bytes), typically at 4+ stats.

```typescript
// Different endpoint
const url = `/scores/stat-validation-v3?fixtureId=${fixtureId}&seq=${seq}&statKeys=1,2,3001,3002`;
const val = (await apiClient.get(url)).data;

type StatValidationInputV3 = IdlTypes<Txoracle>["statValidationInputV3"];

const payloadV3: StatValidationInputV3 = {
  ts: new BN(targetTs),
  fixtureSummary: { /* same as V2 */ },
  fixtureProof: mapProof(val.subTreeProof),
  mainTreeProof: mapProof(val.mainTreeProof),
  eventStatRoot: Array.from(val.eventStatRoot),
  // V3-specific: leaves array + multiproof indices/hashes
  leaves: val.statsToProve.map((l: any) => ({
    stat: l.stat,
    statProof: mapProof(l.statProof)
  })),
  leafIndices: val.multiproof.indices,
  multiproofHashes: Array.from(val.multiproof.hashes),
};

const isValid = await program.methods
  .validateStatV3(payloadV3, strategy)
  .accounts({ dailyScoresMerkleRoots: dailyScoresPda })
  .preInstructions([computeBudgetIx])
  .view();
```

---

## validateFixture — fixture proof (cancel/void)

```typescript
// 1. Scan fixture updates
GET /fixtures/updates/${epochDay}/${hourOfDay}

// 2. Get validation proof
GET /fixtures/validation?fixtureId=${fixtureId}&timestamp=${fixture.Ts}

// 3. Derive PDA — uses 10-day window, not single day
const windowStartDay = Math.floor(epochDay / 10) * 10;
const windowStartBuffer = Buffer.alloc(2);
windowStartBuffer.writeUInt16LE(windowStartDay, 0);

const [tenDailyFixturesRootsPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("ten_daily_fixtures_roots"), windowStartBuffer],
  program.programId
);

// 4. Decode packed fixtureId (top 16 bits = gameState)
const shiftDivisor = 281474976710656; // 2^48
const pureFixtureId = packedId % shiftDivisor;
const gameState = Math.floor(packedId / shiftDivisor);
// gameState === 16 → fixture cancelled (6 = WaitET — do NOT use for void)

// 5. Simulate
await program.methods
  .validateFixture(snapshot, summary, subTreeProof, mainTreeProof)
  .accounts({ tenDailyFixturesRoots: tenDailyFixturesRootsPda })
  .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })])
  .transaction(); // then simulate via connection.simulateTransaction()
```

---

## Common gotchas

> **Period-prefix formula:** key = prefix + base. Prefixes: 0=total, 1000=H1, 2000=HT, 3000=H2, 4000=ET1, 5000=ET2, 6000=shootout, 7000=ET-total. Bases: 1/2=goals, 3/4=yellows, 5/6=reds, 7/8=corners.

| Trap | Fix |
|---|---|
| `seq=0` | Never invent a seq. Scan score updates to find real `seq ≥ 1` |
| Wrong epoch day | Always derive from `val.summary.updateStats.minTimestamp`, not `Date.now()` |
| `IncompleteStatCoverage` | Every stat in `statKeys` must appear in exactly one predicate |
| MTU exceeded | Switch from `validateStatV2` to `validateStatV3` for 4+ stats |
| 401 mid-stream | Implement JWT auto-renewal in SSE fetch; keep `X-Api-Token` stable |
| Devnet ↔ mainnet mix | Use one config object; never dual-host |
| `game_finalised` timing | Wait for `statusId=100` / `action=game_finalised` before FT settlement |
