// TIFO keeper: watches TxLINE for game_finalised (SSE + polling in parallel),
// fetches Merkle proofs, submits resolve transactions, and serves the frontend's
// live-data endpoints (feed SSE, score proxy). The only holder of API credentials.
//
// Usage:  node keeper/index.mjs
// Env:    PORT (default 3001)  REPLAY_FIXTURE_ID (replay mode)  POLL_INTERVAL_MS (default 30000)
import http from "node:http";
import { URL } from "node:url";
import fs from "node:fs";
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { EventSource } from "eventsource";
import bs58 from "bs58";
import {
  makeApiClient, fetchHistorical, findFinalised, fetchProofPayload, dailyScoresPda, loadJson, parseSseRecords,
} from "./txline.mjs";
import { makeBoard } from "./board.mjs";

const PORT = Number(process.env.PORT ?? 3001);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 30_000);
const REPLAY_FIXTURE_ID = process.env.REPLAY_FIXTURE_ID ? Number(process.env.REPLAY_FIXTURE_ID) : null;
const RPC_URL = "https://api.devnet.solana.com";
const API_ORIGIN = "https://txline-dev.txodds.com";

const STATUS = ["Open", "Executed", "Refunded", "Void", "Closed"];
const STATUS_OFFSET = 8 + 157; // discriminator + offset of status field in Commitment
const FIXTURE_OFFSET = 8;

// ---------- boot ----------
const log = (...a) => console.log(new Date().toISOString(), ...a);
const session = loadJson("_keys/txline-session.json");
const kp = Keypair.fromSecretKey(Uint8Array.from(loadJson("_keys/wallet.json")));
const tifoIdl = fs.existsSync("tifo/target/idl/tifo.json")
  ? loadJson("tifo/target/idl/tifo.json")   // fresh build output
  : loadJson("web/lib/idl/tifo.json");      // committed copy (target/ is gitignored)
const txoracleIdl = loadJson("txline-examples/devnet/idl/txoracle.json");

const connection = new Connection(RPC_URL, "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(kp), { commitment: "confirmed" });
anchor.setProvider(provider);
const tifo = new anchor.Program(tifoIdl, provider);
const txoracleProgramId = new PublicKey(txoracleIdl.address);
const api = makeApiClient(session.apiToken);

const board = makeBoard({ tifo, api });
const resolvedFixtures = new Set();
const feedClients = new Set();          // SSE responses for /api/feed
const scoreClients = new Map();         // fixtureId -> Set of SSE responses
let lastSeenId;
let replayRecords = null;

// ---------- on-chain queries ----------
async function openCommitmentsForFixture(fixtureId) {
  const fixtureBytes = new anchor.BN(fixtureId).toBuffer("le", 8);
  return tifo.account.commitment.all([
    { memcmp: { offset: FIXTURE_OFFSET, bytes: bs58.encode(fixtureBytes) } },
    { memcmp: { offset: STATUS_OFFSET, bytes: bs58.encode(Buffer.from([0])) } }, // Open
  ]);
}

function vaultPda(commitmentKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), commitmentKey.toBuffer()],
    tifo.programId
  );
  return pda;
}

// ---------- resolution ----------
async function handleFinalised(fixtureId, seq) {
  if (!seq) { log(`ERROR game_finalised for ${fixtureId} missing seq — skipping`); return; }
  if (resolvedFixtures.has(fixtureId)) return;
  resolvedFixtures.add(fixtureId);
  log(`game_finalised fixture=${fixtureId} seq=${seq}`);

  let commitments;
  try {
    commitments = await openCommitmentsForFixture(fixtureId);
  } catch (e) {
    resolvedFixtures.delete(fixtureId); // allow re-detection on next poll
    log("ERROR loading commitments:", e.message);
    return;
  }
  log(`  ${commitments.length} open commitment(s) on fixture ${fixtureId}`);

  for (const c of commitments) {
    try {
      const txSig = await resolveCommitment(c.publicKey, c.account, fixtureId, seq);
      // Feed event fires only after the tx confirmed and state was re-read (BUG-03)
      const after = await tifo.account.commitment.fetch(c.publicKey);
      const status = STATUS[after.status];
      emitFeed({
        type: "resolved",
        commitment: c.publicKey.toBase58(),
        fixtureId,
        name: Buffer.from(after.name).toString("utf8").replace(/\0+$/, ""),
        conditionMet: status === "Executed",
        status,
        beneficiary: after.beneficiary.toBase58(),
        txSig,
        ts: Date.now(),
      });
      log(`  resolved ${c.publicKey.toBase58()} -> ${status} (${txSig})`);
    } catch (e) {
      if (/NotOpen/.test(String(e))) { log(`  ${c.publicKey.toBase58()} already resolved — ok`); continue; }
      log(`  ERROR resolving ${c.publicKey.toBase58()}:`, e.message ?? e);
    }
  }
}

async function resolveCommitment(pubkey, account, fixtureId, seq) {
  const { payload, epochDay } = await fetchProofPayload(api, fixtureId, seq, [1, 2]);
  return tifo.methods
    .resolve(payload)
    .accounts({
      resolver: kp.publicKey,
      commitment: pubkey,
      vault: vaultPda(pubkey),
      beneficiary: account.beneficiary,
      dailyScoresMerkleRoots: dailyScoresPda(txoracleProgramId, epochDay),
      txoracleProgram: txoracleProgramId,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
    .rpc();
}

// ---------- live channels ----------
function subscribeScores() {
  const es = new EventSource(`${API_ORIGIN}/api/scores/stream`, {
    fetch: async (input, init) => {
      const headers = {
        ...(init?.headers ?? {}),
        "Accept-Encoding": "deflate",
        Authorization: `Bearer ${await api.getJwt()}`,
        "X-Api-Token": session.apiToken,
      };
      if (lastSeenId) headers["Last-Event-ID"] = lastSeenId;
      let res = await fetch(input, { ...init, headers });
      if (res.status === 401 || res.status === 403) {
        headers.Authorization = `Bearer ${await api.renewJwt()}`;
        res = await fetch(input, { ...init, headers });
      }
      return res;
    },
  });
  es.onmessage = (event) => {
    if (event.lastEventId) lastSeenId = event.lastEventId;
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    forwardScore(data);
    // Only a fully-finalised signal triggers resolution (BUG-01)
    const action = data.Action ?? data.action;
    const statusId = data.StatusId ?? data.statusId;
    if (action === "game_finalised" && statusId === 100) {
      handleFinalised(data.FixtureId ?? data.fixtureId, data.Seq ?? data.seq);
    }
  };
  es.onerror = () => {
    log("SSE disconnected — polling continues independently; reconnecting in 3s");
    es.close();
    setTimeout(subscribeScores, 3000);
  };
  log("SSE subscribed to /scores/stream");
}

async function pollScores() {
  const now = Date.now();
  for (let i = 0; i < 24; i++) { // last 2 hours of 5-min windows
    const t = new Date(now - i * 300_000);
    const epochDay = Math.floor(t.getTime() / 86_400_000);
    const hour = t.getUTCHours();
    const interval = Math.floor(t.getUTCMinutes() / 5);
    try {
      const { data } = await api.get(`/scores/updates/${epochDay}/${hour}/${interval}`);
      const records = Array.isArray(data) ? data : [];
      for (const r of records) {
        const action = r.Action ?? r.action;
        const statusId = r.StatusId ?? r.statusId;
        const fid = r.FixtureId ?? r.fixtureId;
        if (action === "game_finalised" && statusId === 100 && !resolvedFixtures.has(fid)) {
          handleFinalised(fid, r.Seq ?? r.seq);
        }
      }
    } catch (e) {
      if (e.response?.status !== 404) log("poll error:", e.message);
    }
  }
}

function forwardScore(data) {
  const fid = data.FixtureId ?? data.fixtureId;
  const clients = scoreClients.get(fid);
  if (!clients) return;
  const line = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(line);
}

function emitFeed(event) {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of feedClients) res.write(line);
}

// ---------- replay mode ----------
async function loadReplay() {
  replayRecords = await fetchHistorical(api, REPLAY_FIXTURE_ID);
  const fin = findFinalised(replayRecords);
  log(`replay mode: fixture ${REPLAY_FIXTURE_ID}, ${replayRecords.length} records, finalised seq=${fin?.Seq}`);
}

// Re-emit the recorded timeline at high speed to any subscribed score clients,
// then fire the real resolution path with the recorded seq.
async function runReplay(speedMs = 150) {
  if (!replayRecords) await loadReplay();
  const interesting = replayRecords.filter((r) =>
    ["kickoff", "goal", "yellow_card", "red_card", "halftime_finalised", "game_finalised", "status", "corner"].includes(r.Action)
  );
  log(`replay run: ${interesting.length} events`);
  for (const r of interesting) {
    forwardScore(r);
    await new Promise((res) => setTimeout(res, speedMs));
  }
  const fin = findFinalised(replayRecords);
  resolvedFixtures.delete(REPLAY_FIXTURE_ID); // replay is re-runnable
  await handleFinalised(REPLAY_FIXTURE_ID, fin.Seq);
}

// ---------- HTTP server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }

  const sse = () => {
    res.writeHead(200, { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(":ok\n\n");
    const ping = setInterval(() => res.write(":ping\n\n"), 15000);
    res.on("close", () => clearInterval(ping));
  };
  const json = (code, body) => {
    res.writeHead(code, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  try {
    if (url.pathname === "/api/health") return json(200, { ok: true, replay: REPLAY_FIXTURE_ID, resolver: kp.publicKey.toBase58() });

    if (url.pathname === "/api/feed") {
      sse();
      feedClients.add(res);
      res.on("close", () => feedClients.delete(res));
      return;
    }

    if (url.pathname === "/api/scores/live") {
      const fid = Number(url.searchParams.get("fixtureId"));
      if (!fid) return json(400, { error: "fixtureId required" });
      sse();
      if (!scoreClients.has(fid)) scoreClients.set(fid, new Set());
      scoreClients.get(fid).add(res);
      res.on("close", () => scoreClients.get(fid)?.delete(res));
      return;
    }

    if (url.pathname.startsWith("/api/commitments/")) {
      const fid = Number(url.pathname.split("/").pop());
      const list = await openCommitmentsForFixture(fid);
      return json(200, list.map((c) => ({ pubkey: c.publicKey.toBase58() })));
    }

    if (url.pathname === "/api/board") return json(200, await board.board(url.searchParams));

    if (url.pathname.startsWith("/api/commitment/")) {
      const row = await board.commitment(url.pathname.split("/").pop());
      return row ? json(200, row) : json(404, { error: "not found" });
    }

    if (url.pathname === "/api/claims") {
      const wallet = url.searchParams.get("wallet");
      if (!wallet) return json(400, { error: "wallet required" });
      return json(200, await board.claims(wallet));
    }

    if (url.pathname === "/api/fixtures") return json(200, await board.fixtures());

    if (url.pathname.startsWith("/api/resolve/") && req.method === "POST") {
      // Manual/permissionless resolve trigger. Finds the finalised record itself.
      const pubkey = new PublicKey(url.pathname.split("/").pop());
      const account = await tifo.account.commitment.fetch(pubkey);
      const fixtureId = Number(account.fixtureId);
      const records = await fetchHistorical(api, fixtureId);
      const fin = findFinalised(records);
      if (!fin) return json(409, { error: "fixture not finalised yet" });
      const txSig = await resolveCommitment(pubkey, account, fixtureId, fin.Seq);
      const after = await tifo.account.commitment.fetch(pubkey);
      const status = STATUS[after.status];
      emitFeed({
        type: "resolved", commitment: pubkey.toBase58(), fixtureId,
        name: Buffer.from(after.name).toString("utf8").replace(/\0+$/, ""),
        conditionMet: status === "Executed", status,
        beneficiary: after.beneficiary.toBase58(), txSig, ts: Date.now(),
      });
      return json(200, { txSig, status });
    }

    if (url.pathname === "/api/replay/run" && req.method === "POST") {
      if (!REPLAY_FIXTURE_ID) return json(400, { error: "not in replay mode" });
      const speed = Number(url.searchParams.get("speedMs") ?? 150);
      runReplay(speed).catch((e) => log("replay error:", e.message));
      return json(202, { started: true, fixtureId: REPLAY_FIXTURE_ID });
    }

    json(404, { error: "not found" });
  } catch (e) {
    log("http error:", e.message ?? e);
    json(500, { error: String(e.message ?? e) });
  }
});

// ---------- start ----------
(async () => {
  log(`keeper starting — resolver ${kp.publicKey.toBase58()}, program ${tifo.programId.toBase58()}`);
  if (REPLAY_FIXTURE_ID) {
    await loadReplay(); // replay is an addition, not a replacement: live channels still run
  }
  subscribeScores(); // always subscribe at boot (BUG-04)
  setInterval(pollScores, POLL_INTERVAL_MS);
  server.listen(PORT, () => log(`keeper HTTP on :${PORT}`));
})();
