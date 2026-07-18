// REST endpoints + SSE relay exactly as 03-API-SPEC defines; no business logic beyond
// request validation and wiring to store/escrow/keeper/bus.
import express from "express";
import { PublicKey } from "@solana/web3.js";
import { validateCondition } from "./conditions.mjs";
import { generatePledgeId, serializePledge } from "./store.mjs";

function isValidPubkey(s) {
  if (typeof s !== "string") return false;
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

function isValidAmount(s) {
  return typeof s === "string" && /^[1-9][0-9]*$/.test(s);
}

function errorBody(code, message) {
  return { error: { code, message } };
}

/**
 * @param {{store: object, escrow: object, bus: import("node:events").EventEmitter, keeper: object, getFixtures: () => Promise<object[]>}} deps
 */
export function createRoutes({ store, escrow, bus, keeper, getFixtures }) {
  const router = express.Router();

  async function findFixture(fixtureId) {
    const fixtures = await getFixtures();
    return fixtures.find((f) => f.fixtureId === fixtureId) || null;
  }

  router.get("/api/fixtures", async (req, res) => {
    try {
      const fixtures = await getFixtures();
      res.json({ fixtures });
    } catch (err) {
      res.status(502).json(errorBody("txline_unavailable", err.message));
    }
  });

  router.get("/api/pledges", async (req, res) => {
    try {
      const local = store.computeLocalTotals();
      await escrow.getBalanceLamports(); // live invariant sanity check — throws rather than default to zero
      res.json({
        pledges: store.list().map(serializePledge),
        totals: {
          depositedLamports: local.depositedLamports.toString(),
          activeLamports: local.activeLamports.toString(),
          releasedLamports: local.releasedLamports.toString(),
        },
      });
    } catch (err) {
      res.status(500).json(errorBody("balance_read_failed", err.message));
    }
  });

  router.get("/api/pledges/:id", (req, res) => {
    const pledge = store.get(req.params.id);
    if (!pledge) return res.status(404).json(errorBody("not_found", `no pledge ${req.params.id}`));
    res.json(serializePledge(pledge));
  });

  router.post("/api/pledges", async (req, res) => {
    const { fixtureId, condition, amountLamports, pledger, beneficiary, createTx } = req.body || {};

    if (!validateCondition(condition)) {
      return res.status(400).json(errorBody("invalid_condition", "unknown template or invalid params"));
    }
    if (!isValidAmount(amountLamports)) {
      return res.status(400).json(errorBody("invalid_amount", "amountLamports must be a positive integer decimal string"));
    }
    if (!isValidPubkey(pledger) || !isValidPubkey(beneficiary)) {
      return res.status(400).json(errorBody("invalid_pubkey", "pledger/beneficiary must be valid base58 pubkeys"));
    }

    const fixture = await findFixture(fixtureId).catch(() => null);
    if (!fixture) {
      return res.status(404).json(errorBody("fixture_not_found", `no fixture ${fixtureId}`));
    }

    if (store.findByCreateTx(createTx)) {
      return res.status(409).json(errorBody("duplicate_create_tx", "createTx already registered"));
    }

    if (fixture.status === "finalised") {
      return res.status(422).json(errorBody("fixture_already_finalised", "fixture no longer accepts pledges"));
    }

    let verified;
    try {
      verified = await escrow.confirmCreate(createTx);
    } catch (err) {
      return res.status(422).json(errorBody("create_tx_invalid", err.message));
    }
    if (verified.lamports !== BigInt(amountLamports)) {
      return res
        .status(422)
        .json(errorBody("create_tx_invalid", `lamports mismatch: expected ${amountLamports}, on-chain ${verified.lamports}`));
    }

    const ts = new Date().toISOString();
    const pledge = {
      id: generatePledgeId(),
      fixtureId,
      condition,
      amountLamports: BigInt(amountLamports),
      pledger,
      beneficiary,
      state: "pending",
      failureReason: null,
      createTx,
      releaseTx: null,
      createdAt: ts,
      updatedAt: ts,
    };
    store.put(pledge);
    bus.emit("pledge_update", pledge);
    res.status(201).json(serializePledge(pledge));
  });

  router.get("/api/stream", (req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders?.();

    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const onScore = (p) => send("score", p);
    const onMatchEvent = (p) => send("match_event", p);
    const onPledgeUpdate = (p) => send("pledge_update", serializePledge(p));
    const onGameFinalised = (p) => send("game_finalised", p);

    bus.on("score", onScore);
    bus.on("match_event", onMatchEvent);
    bus.on("pledge_update", onPledgeUpdate);
    bus.on("game_finalised", onGameFinalised);

    const heartbeat = setInterval(() => send("heartbeat", { ts: new Date().toISOString() }), 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      bus.off("score", onScore);
      bus.off("match_event", onMatchEvent);
      bus.off("pledge_update", onPledgeUpdate);
      bus.off("game_finalised", onGameFinalised);
    });
  });

  router.post("/api/resolve/:id", async (req, res) => {
    const pledge = store.get(req.params.id);
    if (!pledge) return res.status(404).json(errorBody("not_found", `no pledge ${req.params.id}`));
    if (pledge.state === "transferred" || pledge.state === "failed") {
      return res.json(serializePledge(pledge));
    }

    const stats = keeper.getFinalisedStats(pledge.fixtureId);
    if (!stats) {
      return res.status(409).json(errorBody("fixture_not_finalised", `fixture ${pledge.fixtureId} not finalised yet`));
    }

    try {
      const resolved = await keeper.resolvePledge(pledge, stats);
      res.json(serializePledge(resolved));
    } catch (err) {
      if (err.code === "PROOF_UNAVAILABLE") {
        return res.status(502).json(errorBody("proof_unavailable", err.message));
      }
      // transfer_error: state already persisted as failed by the keeper; report current record
      const current = store.get(req.params.id);
      res.json(serializePledge(current));
    }
  });

  return router;
}
