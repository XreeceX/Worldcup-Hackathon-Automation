import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createStore, generatePledgeId } from "./store.mjs";

function tmpPath() {
  return path.join(os.tmpdir(), `pledges-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

function mkPledge(overrides = {}) {
  return {
    id: generatePledgeId(),
    fixtureId: 1,
    condition: { template: "team_wins", params: { team: "home" } },
    amountLamports: 100000000n,
    pledger: "pledgerPubkey",
    beneficiary: "beneficiaryPubkey",
    state: "pending",
    failureReason: null,
    createTx: "tx1",
    releaseTx: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("bigint round-trip through disk snapshot", () => {
  const p = tmpPath();
  const store = createStore(p);
  const pledge = mkPledge();
  store.put(pledge);

  const reloaded = createStore(p);
  const got = reloaded.get(pledge.id);
  assert.equal(typeof got.amountLamports, "bigint");
  assert.equal(got.amountLamports, 100000000n);
  fs.rmSync(p, { force: true });
});

test("rejects float money", () => {
  const store = createStore(tmpPath());
  assert.throws(() => store.put(mkPledge({ amountLamports: 100000000 })), TypeError);
});

test("test_lamport_conservation — invariant holds after a scripted sequence", () => {
  const store = createStore(tmpPath());
  const a = mkPledge({ amountLamports: 100n, createTx: "tx-a" });
  const b = mkPledge({ amountLamports: 200n, createTx: "tx-b" });
  const c = mkPledge({ amountLamports: 300n, createTx: "tx-c" });
  store.put(a);
  store.put(b);
  store.put(c);

  // resolve a: condition true -> transferred
  store.put({ ...a, state: "transferred", releaseTx: "rel-a" });
  // resolve b: condition false -> failed(condition_not_met), funds auto-returned
  store.put({ ...b, state: "failed", failureReason: "condition_not_met", releaseTx: "rel-b" });
  // c stays pending

  const totals = store.computeLocalTotals();
  assert.equal(totals.activeLamports + totals.releasedLamports, totals.depositedLamports);
  assert.equal(totals.depositedLamports, 600n);
  assert.equal(totals.activeLamports, 300n); // only c
  assert.equal(totals.releasedLamports, 300n); // a (transferred) + b (returned)
});

test("funds stuck in failed(transfer_error) still count as active, not released", () => {
  const store = createStore(tmpPath());
  const a = mkPledge({ amountLamports: 500n, createTx: "tx-stuck" });
  store.put(a);
  store.put({ ...a, state: "failed", failureReason: "transfer_error" });

  const totals = store.computeLocalTotals();
  assert.equal(totals.activeLamports, 500n);
  assert.equal(totals.releasedLamports, 0n);
  assert.equal(totals.activeLamports + totals.releasedLamports, totals.depositedLamports);
});

test("a failed live balance read must raise, never return a default of zero", async () => {
  const failingEscrow = {
    async getBalanceLamports() {
      throw new Error("devnet rpc unavailable");
    },
  };
  await assert.rejects(() => failingEscrow.getBalanceLamports());
});
