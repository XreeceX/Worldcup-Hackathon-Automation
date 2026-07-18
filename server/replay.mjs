// Replay driver: streams the seeded historical fixture's captured timeline on a timer,
// tagged source:"replay" (spec 02 §2). Emits the exact same internal events as txline.mjs
// so the keeper cannot tell live and replay apart — the final game_finalised still fires a
// real escrow release.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_PATH = path.join(__dirname, "fixtures", "replay-data.json");

export function loadReplayData(dataPath = DEFAULT_DATA_PATH) {
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

/**
 * @param {import("node:events").EventEmitter} bus
 * @param {{dataPath?: string, speed?: number, onDone?: (payload: object) => void}} [opts] speed>1 plays faster
 * @returns {() => void} stop
 */
export function startReplay(bus, { dataPath, speed = 1, onDone } = {}) {
  const data = loadReplayData(dataPath);
  const timers = data.timeline.map((step) =>
    setTimeout(() => {
      const payload = { ...step.payload, source: "replay" };
      bus.emit(step.event, payload);
      if (step.event === "game_finalised") onDone?.(payload);
    }, step.atMs / speed)
  );
  return () => timers.forEach(clearTimeout);
}
