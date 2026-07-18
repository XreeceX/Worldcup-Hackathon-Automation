// Boot: load config/env, init store, pick escrow impl from ESCROW_MODE, start Express + keeper
// (spec 02 §2, spec 05 F2).
import express from "express";
import { createEventBus } from "./events.mjs";
import { createStore } from "./store.mjs";
import { createTxLineClient } from "./txline.mjs";
import { createCustodyEscrow } from "./escrow/custody.mjs";
import { createAnchorEscrow } from "./escrow/anchor.mjs";
import { createKeeper } from "./keeper.mjs";
import { startReplay, loadReplayData } from "./replay.mjs";
import { createRoutes } from "./routes.mjs";

const PORT = Number(process.env.PORT || 8787);
// Accepted values: "keeper" (default, = Path B keeper-custody) / "custody" (alias) / "anchor" (Path A, stubbed).
const ESCROW_MODE = (process.env.ESCROW_MODE || "keeper").toLowerCase();
const REPLAY_ON_BOOT = process.env.REPLAY_ON_BOOT !== "0"; // on by default — the replay driver is first-class (02 §5)
const REPLAY_SPEED = Number(process.env.REPLAY_SPEED || "1"); // >1 faster, <1 slower (e.g. to leave room for a live devnet round trip in demos)

const bus = createEventBus();
const store = createStore();

const escrow = ESCROW_MODE === "anchor" ? createAnchorEscrow() : createCustodyEscrow();

let txline = null;
try {
  txline = createTxLineClient();
  console.log("[boot] TxLINE session loaded");
} catch (err) {
  console.error("[boot] TxLINE client unavailable:", err.message);
}

const fallbackTxline = {
  async getFixtures() {
    throw new Error("TxLINE client not initialised (missing/invalid _keys/txline-session.json)");
  },
  async getStatValidationProof() {
    throw new Error("TxLINE client not initialised (missing/invalid _keys/txline-session.json)");
  },
};

const keeper = createKeeper({ bus, store, escrow, txline: txline || fallbackTxline });

const replayData = loadReplayData();

async function getFixtures() {
  const live = await (txline || fallbackTxline).getFixtures();
  const finalised = keeper.getFinalisedStats(replayData.fixture.fixtureId);
  const replayFixture = {
    ...replayData.fixture,
    status: finalised ? "finalised" : "live",
    source: "replay",
  };
  return [...live, replayFixture];
}

const app = express();
app.use(express.json());
app.use(createRoutes({ store, escrow, bus, keeper, getFixtures }));

app.listen(PORT, () => {
  console.log(`[boot] server listening on :${PORT} (ESCROW_MODE=${ESCROW_MODE}, escrow.mode=${escrow.mode})`);
  if (escrow.escrowPubkey) console.log(`[boot] escrow wallet: ${escrow.escrowPubkey}`);
});

bus.on("internal_error", (e) => console.error("[keeper:error]", e));

if (REPLAY_ON_BOOT) {
  console.log(`[boot] starting replay driver for fixture ${replayData.fixture.fixtureId} (${replayData.fixture.home} vs ${replayData.fixture.away})`);
  startReplay(bus, {
    speed: REPLAY_SPEED,
    onDone: (payload) => console.log("[replay] game_finalised", payload),
  });
}
