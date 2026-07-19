// Hour-zero pipeline proof: historical record -> real seq -> stat-validation proof -> validateStatV2 .view()
// Proves the entire settlement thesis before any product code is written.
// Prereqs: scripts/connect.mjs has run (subscribe + activated API token in _keys/txline-session.json)
// Usage: node scripts/hourzero.mjs [fixtureId]   (default 18241006 — England vs Argentina semi, BTTS met)
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import axios from "axios";
import fs from "fs";

const RPC_URL = "https://api.devnet.solana.com";
const API_ORIGIN = "https://txline-dev.txodds.com";
const FIXTURE_ID = Number(process.argv[2] ?? 18241006);
const BN = anchor.BN;

const idl = JSON.parse(fs.readFileSync("txline-examples/devnet/idl/txoracle.json", "utf8"));
const kp = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("_keys/wallet.json", "utf8")))
);
const state = JSON.parse(fs.readFileSync("_keys/txline-session.json", "utf8"));

const connection = new Connection(RPC_URL, "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(kp), { commitment: "confirmed" });
anchor.setProvider(provider);
const program = new anchor.Program(idl, provider);

// fresh JWT (short-lived), stable apiToken
const { data: auth } = await axios.post(`${API_ORIGIN}/auth/guest/start`);
const jwt = auth.token || auth;
const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": state.apiToken },
  timeout: 30000,
});

// --- 1. historical record: find game_finalised with a real seq ---
// Endpoint returns SSE-formatted text ("data: {...}" lines), PascalCase fields (Action, Seq, StatusId, Ts)
const { data: hist } = await api.get(`/scores/historical/${FIXTURE_ID}`, { responseType: "text" });
const records = String(hist).split("\n").filter(l => l.startsWith("data: ")).map(l => JSON.parse(l.slice(6)));
console.log(`[1] historical records for ${FIXTURE_ID}: ${records.length}`);
const finalised = records.filter(r => r.Action === "game_finalised" && r.StatusId === 100);
if (finalised.length === 0) throw new Error("no game_finalised/StatusId=100 record for this fixture");
const fin = finalised[finalised.length - 1];
if (!fin.Seq) throw new Error("finalised record has no Seq — refusing to default to 0");
console.log(`[1] game_finalised: Seq=${fin.Seq} Ts=${fin.Ts} goals P1=${fin.Stats?.["1"]} P2=${fin.Stats?.["2"]}`);

// --- 2. stat-validation proof for total goals (keys 1,2) ---
const { data: val } = await api.get(
  `/scores/stat-validation?fixtureId=${FIXTURE_ID}&seq=${fin.Seq}&statKeys=1,2`
);
const goals = val.statsToProve.map(s => s.value ?? s.Value ?? JSON.stringify(s));
console.log(`[2] proof fetched. statsToProve (P1,P2 goals): ${JSON.stringify(goals)}`);
console.log(`    minTimestamp=${val.summary.updateStats.minTimestamp}`);

// --- 3. build payload (boilerplate shape) ---
const mapProof = arr => arr.map(n => ({ hash: Array.from(n.hash), isRightSibling: n.isRightSibling }));
const payload = {
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
  stats: val.statsToProve.map((stat, i) => ({ stat, statProof: mapProof(val.statProofs[i]) })),
};

// --- 4. PDA from proof's minTimestamp (never wall-clock) ---
const epochDay = Math.floor(val.summary.updateStats.minTimestamp / 86_400_000);
const [dailyScoresPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("daily_scores_roots"), new BN(epochDay).toBuffer("le", 2)],
  program.programId
);
console.log(`[3] epochDay=${epochDay} dailyScoresPda=${dailyScoresPda.toBase58()}`);

// --- 5. strategies: our two shipped templates ---
const strategyBTTS = {
  geometricTargets: [],
  distancePredicate: null,
  discretePredicates: [
    { single: { index: 0, predicate: { threshold: 0, comparison: { greaterThan: {} } } } },
    { single: { index: 1, predicate: { threshold: 0, comparison: { greaterThan: {} } } } },
  ],
};
const strategyHomeWin = {
  geometricTargets: [],
  distancePredicate: null,
  discretePredicates: [
    { binary: { indexA: 0, indexB: 1, op: { subtract: {} }, predicate: { threshold: 0, comparison: { greaterThan: {} } } } },
  ],
};

// --- 6. validateStatV2 .view() for both templates ---
const computeBudgetIx = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
for (const [name, strategy] of [["BTTS", strategyBTTS], ["HomeWin", strategyHomeWin]]) {
  const result = await program.methods
    .validateStatV2(payload, strategy)
    .accounts({ dailyScoresMerkleRoots: dailyScoresPda })
    .preInstructions([computeBudgetIx])
    .view();
  console.log(`[4] validateStatV2 ${name}: ${result}`);
}
console.log("HOUR-ZERO PIPELINE GREEN");
