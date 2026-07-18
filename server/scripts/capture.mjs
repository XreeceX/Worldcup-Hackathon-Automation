// Capture real TxLINE score/event payloads for a fixture into server/fixtures/replay-data.json
// (spec 05 B2). Run against a fixture that is actually live to get a real goal timeline;
// during this build's session, TxLINE devnet's free tier only exposed scheduled friendlies with
// no in-progress goals (see replay-data.json's _note), so this tool captured nothing usable and
// the shipped replay-data.json timeline is authored for demo pacing instead. Re-run this anytime
// a real match is live to replace it with a genuine capture.
//
// Usage: node server/scripts/capture.mjs <fixtureId> [durationSec]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTxLineClient } from "../txline.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "fixtures", "replay-data.json");

async function main() {
  const fixtureId = Number(process.argv[2]);
  const durationSec = Number(process.argv[3] || 120);
  if (!fixtureId) {
    console.error("Usage: node server/scripts/capture.mjs <fixtureId> [durationSec]");
    process.exit(1);
  }

  const client = createTxLineClient();
  const fixtures = await client.getFixtures();
  const fixture = fixtures.find((f) => f.fixtureId === fixtureId);
  if (!fixture) throw new Error(`fixture ${fixtureId} not found in current /fixtures/snapshot`);
  console.log(`capturing ${fixture.home} vs ${fixture.away} (fixtureId=${fixtureId}) for ${durationSec}s...`);

  const t0 = Date.now();
  const timeline = [];
  let lastScore = null;

  const poll = async () => {
    const snapshot = await client.getScoresSnapshot(fixtureId).catch(() => []);
    const entries = Array.isArray(snapshot) ? snapshot : [];
    for (const entry of entries) {
      const key = JSON.stringify(entry);
      if (key === lastScore) continue;
      lastScore = key;
      timeline.push({ atMs: Date.now() - t0, event: "score_raw", payload: entry });
      console.log(`  captured raw update @ +${Date.now() - t0}ms`);
    }
  };

  while (Date.now() - t0 < durationSec * 1000) {
    await poll();
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (timeline.length === 0) {
    console.log("no live score updates captured in this window — fixture is likely not in progress; replay-data.json left unchanged");
    return;
  }

  const out = {
    _note: `Real captured TxLINE payloads for fixtureId ${fixtureId} (${fixture.home} vs ${fixture.away}), captured ${new Date().toISOString()}.`,
    fixture: { fixtureId, home: fixture.home, away: fixture.away, kickoffUtc: fixture.kickoffUtc },
    timeline,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`wrote ${timeline.length} raw entries to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("capture failed:", err.message);
  process.exit(1);
});
