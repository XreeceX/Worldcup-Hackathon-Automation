// TxLINE API client + proof construction. The only module that touches TxLINE.
import axios from "axios";
import anchor from "@coral-xyz/anchor";
import fs from "fs";

const API_ORIGIN = "https://txline-dev.txodds.com";
const BN = anchor.BN;

export function makeApiClient(apiToken) {
  let jwt = null;
  const client = axios.create({ baseURL: `${API_ORIGIN}/api`, timeout: 30000 });
  client.interceptors.request.use(async (cfg) => {
    if (!jwt) jwt = await renewJwt();
    cfg.headers.Authorization = `Bearer ${jwt}`;
    cfg.headers["X-Api-Token"] = apiToken;
    return cfg;
  });
  client.interceptors.response.use(null, async (err) => {
    if (err.response?.status === 401 && !err.config._retried) {
      err.config._retried = true;
      jwt = await renewJwt();
      err.config.headers.Authorization = `Bearer ${jwt}`;
      return client.request(err.config);
    }
    throw err;
  });
  client.getJwt = async () => { if (!jwt) jwt = await renewJwt(); return jwt; };
  client.renewJwt = async () => { jwt = await renewJwt(); return jwt; };
  return client;
}

async function renewJwt() {
  const { data } = await axios.post(`${API_ORIGIN}/auth/guest/start`);
  return data.token || data;
}

// Parse the SSE-formatted body returned by /scores/historical (PascalCase fields)
export function parseSseRecords(body) {
  return String(body)
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => JSON.parse(l.slice(6)));
}

export async function fetchHistorical(api, fixtureId) {
  const { data } = await api.get(`/scores/historical/${fixtureId}`, { responseType: "text" });
  return parseSseRecords(data);
}

export function findFinalised(records) {
  const fin = records.filter((r) => r.Action === "game_finalised" && r.StatusId === 100);
  if (fin.length === 0) return null;
  const rec = fin[fin.length - 1];
  if (!rec.Seq) throw new Error("game_finalised record missing Seq — refusing to default to 0");
  return rec;
}

// Fetch stat-validation proof and build the on-chain StatValidationInput payload.
// Retries with exponential backoff (1s, 2s, 4s) per design §6.3.
export async function fetchProofPayload(api, fixtureId, seq, statKeys = [1, 2]) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data: val } = await api.get(
        `/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKeys=${statKeys.join(",")}`
      );
      return buildPayload(val);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastErr;
}

export function buildPayload(val) {
  const mapProof = (arr) => arr.map((n) => ({ hash: Array.from(n.hash), isRightSibling: n.isRightSibling }));
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
  // CRITICAL: epochDay from the proof's own timestamp, never wall-clock
  const epochDay = Math.floor(val.summary.updateStats.minTimestamp / 86_400_000);
  return { payload, epochDay };
}

export function dailyScoresPda(txoracleProgramId, epochDay) {
  const { PublicKey } = anchor.web3;
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new BN(epochDay).toBuffer("le", 2)],
    txoracleProgramId
  );
  return pda;
}

export function loadJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}
