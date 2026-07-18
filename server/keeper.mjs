// Keeper loop: on game_finalised -> proof fetch -> conditions.evaluate -> escrow.release ->
// state transition + pledge_update; idempotent; 30s sweep for missed finals (spec 02 §2/§4).
import { evaluate } from "./conditions.mjs";

const SWEEP_INTERVAL_MS = 30_000;

function nowIso() {
  return new Date().toISOString();
}

async function withRetry(fn, { retries = 3, baseDelayMs = 500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}

/**
 * @param {{bus: import("node:events").EventEmitter, store: object, escrow: object, txline: object}} deps
 */
export function createKeeper({ bus, store, escrow, txline, proofRetries = 3, proofRetryBaseMs = 500 }) {
  const resolving = new Set(); // in-flight pledge ids — idempotency guard against concurrent resolves
  const finalisedFixtures = new Map(); // fixtureId -> MatchStats (incl. source)

  /**
   * Resolves one pledge against known-finalised stats. Idempotent: a pledge already in a
   * terminal state, or already being resolved concurrently, is returned unchanged.
   */
  async function resolvePledge(pledge, stats) {
    if (resolving.has(pledge.id)) return store.get(pledge.id);
    const current = store.get(pledge.id);
    if (!current || current.state === "transferred" || current.state === "failed") return current;

    resolving.add(pledge.id);
    try {
      // Proof-gated release (02 §4): live fixtures require a fresh TxLINE stat-validation
      // fetch before we trust the score. Replay fixtures are demo-only and skip this fetch
      // by design (documented in replay.mjs) — there is no live proof to fetch for them.
      if (stats.source !== "replay") {
        try {
          await withRetry(() => txline.getStatValidationProof(pledge.fixtureId, stats.seq ?? 0), {
            retries: proofRetries,
            baseDelayMs: proofRetryBaseMs,
          });
        } catch (proofErr) {
          const wrapped = new Error(
            `stat-validation proof unavailable for fixture ${pledge.fixtureId}: ${proofErr.message}`
          );
          wrapped.code = "PROOF_UNAVAILABLE";
          throw wrapped; // state intentionally unchanged — never "assume true"
        }
      }

      const conditionMet = evaluate(pledge.condition, stats);
      const withMet = { ...current, state: "condition_met", updatedAt: nowIso() };
      store.put(withMet);
      bus.emit("pledge_update", withMet);

      let signature;
      try {
        ({ signature } = await escrow.release(current, conditionMet ? "success" : "failure"));
      } catch (releaseErr) {
        const failed = { ...withMet, state: "failed", failureReason: "transfer_error", updatedAt: nowIso() };
        store.put(failed);
        bus.emit("pledge_update", failed);
        throw releaseErr;
      }

      const resolved = {
        ...withMet,
        state: conditionMet ? "transferred" : "failed",
        failureReason: conditionMet ? null : "condition_not_met",
        releaseTx: signature,
        updatedAt: nowIso(),
      };
      store.put(resolved);
      bus.emit("pledge_update", resolved);
      return resolved;
    } finally {
      resolving.delete(pledge.id);
    }
  }

  async function resolveFixture(fixtureId, stats) {
    finalisedFixtures.set(fixtureId, stats);
    const pending = store.list().filter((p) => p.fixtureId === fixtureId && (p.state === "pending" || p.state === "condition_met"));
    for (const pledge of pending) {
      try {
        await resolvePledge(pledge, stats);
      } catch (err) {
        bus.emit("internal_error", { scope: "keeper.resolveFixture", pledgeId: pledge.id, message: err.message });
      }
    }
  }

  bus.on("game_finalised", (payload) => {
    const stats = {
      fixtureId: payload.fixtureId,
      homeGoals: payload.homeGoals,
      awayGoals: payload.awayGoals,
      finalised: true,
      source: payload.source,
    };
    resolveFixture(payload.fixtureId, stats).catch((err) =>
      bus.emit("internal_error", { scope: "keeper.onGameFinalised", message: err.message })
    );
  });

  function sweep() {
    for (const [fixtureId, stats] of finalisedFixtures) {
      resolveFixture(fixtureId, stats).catch((err) =>
        bus.emit("internal_error", { scope: "keeper.sweep", message: err.message })
      );
    }
  }

  const sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();

  return {
    resolvePledge, // exposed for POST /api/resolve/:id backstop
    getFinalisedStats: (fixtureId) => finalisedFixtures.get(fixtureId) || null,
    stop: () => clearInterval(sweepTimer),
  };
}
