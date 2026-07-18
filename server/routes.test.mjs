import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import os from "node:os";
import path from "node:path";
import { Keypair } from "@solana/web3.js";
import { createEventBus } from "./events.mjs";
import { createStore } from "./store.mjs";
import { createKeeper } from "./keeper.mjs";
import { createRoutes } from "./routes.mjs";

function tmpStorePath() {
  return path.join(os.tmpdir(), `routes-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

function makeFakeEscrow(overrides = {}) {
  const released = [];
  return {
    mode: "fake",
    released,
    async prepareCreate() {
      return { instructions: [], destination: "11111111111111111111111111111111111111111" };
    },
    async confirmCreate(signature) {
      if (overrides.confirmCreate) return overrides.confirmCreate(signature);
      if (signature === "bad-sig") throw new Error("signature not found on-chain");
      return { lamports: 100000000n };
    },
    async release(pledge, outcome) {
      released.push({ pledgeId: pledge.id, outcome });
      if (overrides.release) return overrides.release(pledge, outcome);
      return { signature: `rel_${released.length}` };
    },
    async getBalanceLamports() {
      if (overrides.getBalanceLamports) return overrides.getBalanceLamports();
      return 1000000000n;
    },
  };
}

function makeFakeTxline(overrides = {}) {
  return {
    async getStatValidationProof(fixtureId) {
      if (overrides.getStatValidationProof) return overrides.getStatValidationProof(fixtureId);
      return { ok: true };
    },
  };
}

const FIXTURE_LIVE = { fixtureId: 1, home: "Home", away: "Away", kickoffUtc: new Date().toISOString(), status: "live", source: "live" };
const FIXTURE_FINALISED = { fixtureId: 2, home: "H2", away: "A2", kickoffUtc: new Date().toISOString(), status: "finalised", source: "live" };

async function buildApp({ escrow, txline, getFixtures } = {}) {
  const bus = createEventBus();
  const store = createStore(tmpStorePath());
  const fakeEscrow = escrow || makeFakeEscrow();
  const fakeTxline = txline || makeFakeTxline();
  const keeper = createKeeper({ bus, store, escrow: fakeEscrow, txline: fakeTxline, proofRetries: 1, proofRetryBaseMs: 10 });
  const fixturesFn = getFixtures || (async () => [FIXTURE_LIVE, FIXTURE_FINALISED]);

  const app = express();
  app.use(express.json());
  app.use(createRoutes({ store, escrow: fakeEscrow, bus, keeper, getFixtures: fixturesFn }));

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  return { server, base, store, escrow: fakeEscrow, txline: fakeTxline, keeper, bus };
}

function pubkey() {
  return Keypair.generate().publicKey.toBase58();
}

async function createValidPledge(base, overrides = {}) {
  const body = {
    fixtureId: 1,
    condition: { template: "team_wins", params: { team: "home" } },
    amountLamports: "100000000",
    pledger: pubkey(),
    beneficiary: pubkey(),
    createTx: `tx-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  };
  const res = await fetch(`${base}/api/pledges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { res, body: await res.json() };
}

test("GET /api/fixtures — happy path", async () => {
  const { server, base } = await buildApp();
  const res = await fetch(`${base}/api/fixtures`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.fixtures.length, 2);
  server.close();
});

test("GET /api/fixtures — upstream down never returns an empty list", async () => {
  const { server, base } = await buildApp({ getFixtures: async () => { throw new Error("upstream down"); } });
  const res = await fetch(`${base}/api/fixtures`);
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.equal(data.error.code, "txline_unavailable");
  server.close();
});

test("POST /api/pledges — happy path returns 201 pending pledge", async () => {
  const { server, base } = await buildApp();
  const { res, body } = await createValidPledge(base);
  assert.equal(res.status, 201);
  assert.equal(body.state, "pending");
  assert.equal(body.amountLamports, "100000000");
  server.close();
});

test("POST /api/pledges — validation matrix", async () => {
  const { server, base } = await buildApp();

  const badCondition = await createValidPledge(base, { condition: { template: "nope", params: {} } });
  assert.equal(badCondition.res.status, 400);
  assert.equal(badCondition.body.error.code, "invalid_condition");

  const badAmount = await createValidPledge(base, { amountLamports: "0" });
  assert.equal(badAmount.res.status, 400);
  assert.equal(badAmount.body.error.code, "invalid_amount");

  const badPubkey = await createValidPledge(base, { pledger: "not-a-pubkey" });
  assert.equal(badPubkey.res.status, 400);
  assert.equal(badPubkey.body.error.code, "invalid_pubkey");

  const noFixture = await createValidPledge(base, { fixtureId: 99999 });
  assert.equal(noFixture.res.status, 404);
  assert.equal(noFixture.body.error.code, "fixture_not_found");

  const dupTx = await createValidPledge(base, { createTx: "dup-tx-1" });
  assert.equal(dupTx.res.status, 201);
  const dupTx2 = await createValidPledge(base, { createTx: "dup-tx-1" });
  assert.equal(dupTx2.res.status, 409);
  assert.equal(dupTx2.body.error.code, "duplicate_create_tx");

  const finalisedFixture = await createValidPledge(base, { fixtureId: 2 });
  assert.equal(finalisedFixture.res.status, 422);
  assert.equal(finalisedFixture.body.error.code, "fixture_already_finalised");

  const invalidTx = await createValidPledge(base, { createTx: "bad-sig" });
  assert.equal(invalidTx.res.status, 422);
  assert.equal(invalidTx.body.error.code, "create_tx_invalid");

  server.close();
});

test("GET /api/pledges — totals as decimal strings, invariant holds", async () => {
  const { server, base } = await buildApp();
  await createValidPledge(base);
  const res = await fetch(`${base}/api/pledges`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(typeof data.totals.depositedLamports, "string");
  const dep = BigInt(data.totals.depositedLamports);
  const act = BigInt(data.totals.activeLamports);
  const rel = BigInt(data.totals.releasedLamports);
  assert.equal(act + rel, dep);
  server.close();
});

test("GET /api/pledges — forced balance-read failure never returns zeros", async () => {
  const escrow = makeFakeEscrow({ getBalanceLamports: async () => { throw new Error("rpc down"); } });
  const { server, base } = await buildApp({ escrow });
  const res = await fetch(`${base}/api/pledges`);
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.error.code, "balance_read_failed");
  server.close();
});

test("SSE relay — score/match_event/pledge_update/game_finalised/heartbeat arrive with 03 shapes", async () => {
  const { server, base, bus } = await buildApp();
  const controller = new AbortController();
  const res = await fetch(`${base}/api/stream`, { signal: controller.signal });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const seen = new Set();

  const readLoop = (async () => {
    while (seen.size < 4) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const chunks = buf.split("\n\n");
      buf = chunks.pop();
      for (const chunk of chunks) {
        const m = chunk.match(/^event: (\w+)/m);
        if (m) seen.add(m[1]);
      }
    }
  })();

  await new Promise((r) => setTimeout(r, 50));
  bus.emit("score", { fixtureId: 1, homeGoals: 1, awayGoals: 0, minute: 10, source: "replay" });
  bus.emit("match_event", { fixtureId: 1, type: "goal", team: "home", minute: 10, detail: "Goal", source: "replay" });
  bus.emit("game_finalised", { fixtureId: 1, homeGoals: 1, awayGoals: 0, source: "replay" });

  await Promise.race([readLoop, new Promise((r) => setTimeout(r, 2000))]);
  controller.abort();
  server.close();

  assert.ok(seen.has("score"), "expected score event");
  assert.ok(seen.has("match_event"), "expected match_event event");
  assert.ok(seen.has("game_finalised"), "expected game_finalised event");
});

test("Keeper happy path — game_finalised + proof(true) -> transferred, releaseTx set", async () => {
  const escrow = makeFakeEscrow();
  const { server, base, bus, store } = await buildApp({ escrow });
  const { body: pledge } = await createValidPledge(base, { fixtureId: 1, condition: { template: "team_wins", params: { team: "home" } } });

  bus.emit("game_finalised", { fixtureId: 1, homeGoals: 2, awayGoals: 0, source: "live" });
  await new Promise((r) => setTimeout(r, 100));

  const updated = store.get(pledge.id);
  assert.equal(updated.state, "transferred");
  assert.ok(updated.releaseTx);
  assert.equal(escrow.released.length, 1);
  assert.equal(escrow.released[0].outcome, "success");
  server.close();
});

test("Keeper condition false — funds-return release, failed(condition_not_met)", async () => {
  const escrow = makeFakeEscrow();
  const { server, base, bus, store } = await buildApp({ escrow });
  const { body: pledge } = await createValidPledge(base, { fixtureId: 1, condition: { template: "team_wins", params: { team: "home" } } });

  bus.emit("game_finalised", { fixtureId: 1, homeGoals: 0, awayGoals: 1, source: "live" });
  await new Promise((r) => setTimeout(r, 100));

  const updated = store.get(pledge.id);
  assert.equal(updated.state, "failed");
  assert.equal(updated.failureReason, "condition_not_met");
  assert.equal(escrow.released[0].outcome, "failure");
  server.close();
});

test("Idempotency — duplicate game_finalised + concurrent resolve => exactly one release call", async () => {
  const escrow = makeFakeEscrow();
  const { server, base, bus, store } = await buildApp({ escrow });
  const { body: pledge } = await createValidPledge(base, { fixtureId: 1, condition: { template: "team_wins", params: { team: "home" } } });

  bus.emit("game_finalised", { fixtureId: 1, homeGoals: 2, awayGoals: 0, source: "live" });
  bus.emit("game_finalised", { fixtureId: 1, homeGoals: 2, awayGoals: 0, source: "live" });
  const resolveCall = fetch(`${base}/api/resolve/${pledge.id}`, { method: "POST" });

  await Promise.all([resolveCall, new Promise((r) => setTimeout(r, 150))]);

  assert.equal(escrow.released.length, 1, `expected exactly 1 release call, got ${escrow.released.length}`);
  const updated = store.get(pledge.id);
  assert.equal(updated.state, "transferred");

  const secondResolve = await fetch(`${base}/api/resolve/${pledge.id}`, { method: "POST" });
  assert.equal(secondResolve.status, 200);
  const secondBody = await secondResolve.json();
  assert.equal(secondBody.state, "transferred");
  assert.equal(escrow.released.length, 1);
  server.close();
});

test("Resolve too early — fixture not finalised => 409, no state change", async () => {
  const { server, base } = await buildApp();
  const { body: pledge } = await createValidPledge(base, { fixtureId: 1 });

  const res = await fetch(`${base}/api/resolve/${pledge.id}`, { method: "POST" });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error.code, "fixture_not_finalised");
  server.close();
});

test("Proof unavailable — proof fetch throws => state unchanged, 502 proof_unavailable", async () => {
  const txline = makeFakeTxline({ getStatValidationProof: async () => { throw new Error("txline down"); } });
  const { server, base, bus, store } = await buildApp({ txline });
  const { body: pledge } = await createValidPledge(base, { fixtureId: 1 });

  bus.emit("game_finalised", { fixtureId: 1, homeGoals: 2, awayGoals: 0, source: "live" });
  await new Promise((r) => setTimeout(r, 200));

  const stillPending = store.get(pledge.id);
  assert.equal(stillPending.state, "pending", "state must be unchanged when proof is unavailable");

  const res = await fetch(`${base}/api/resolve/${pledge.id}`, { method: "POST" });
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.equal(data.error.code, "proof_unavailable");
  assert.equal(store.get(pledge.id).state, "pending");
  server.close();
});
