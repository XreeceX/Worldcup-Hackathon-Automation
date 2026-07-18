// TxLINE client: session auth (connect.mjs pattern), fixtures fetch, scores SSE subscribe,
// stat-validation proof fetch. Host https://txline-dev.txodds.com (spec 02 §2/§5).
import axios from "axios";
import fs from "node:fs";
import { EventSource } from "eventsource";

const API_ORIGIN = process.env.TXLINE_API_ORIGIN || "https://txline-dev.txodds.com";
const STATE_PATH = process.env.TXLINE_SESSION_PATH || "_keys/txline-session.json";
const JWT_TTL_MS = 4 * 60 * 1000; // guest JWTs are short-lived; refresh proactively rather than wait for a 401

function loadSession(statePath) {
  if (!fs.existsSync(statePath)) {
    throw new Error(`TxLINE session not found at ${statePath} — run \`node scripts/connect.mjs\` once to subscribe + activate the API token`);
  }
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  if (!state.apiToken) throw new Error(`TxLINE session at ${statePath} missing apiToken — run scripts/connect.mjs`);
  return state;
}

/**
 * Maps TxLINE's raw fixture/score shapes (observed live: FixtureId, Participant1/2,
 * Participant1IsHome, StartTime, GameState as either a numeric code or a string like
 * "scheduled") onto our canonical Fixture/MatchStats types (spec 02 §3).
 */
function normalizeFixture(raw) {
  const kickoffMs = raw.StartTime ?? raw.startTime;
  const gameState = raw.GameState;
  let status = "upcoming";
  if (gameState === "live" || gameState === 2) status = "live";
  else if (gameState === "finished" || gameState === "finalised" || gameState === 3) status = "finalised";
  const isHome = raw.Participant1IsHome !== false;
  return {
    fixtureId: raw.FixtureId ?? raw.fixtureId,
    home: isHome ? raw.Participant1 : raw.Participant2,
    away: isHome ? raw.Participant2 : raw.Participant1,
    kickoffUtc: new Date(kickoffMs).toISOString(),
    status,
    source: "live",
  };
}

export function createTxLineClient({ statePath = STATE_PATH, apiOrigin = API_ORIGIN } = {}) {
  const session = loadSession(statePath);
  let jwt = null;
  let jwtFetchedAt = 0;

  async function getJwt(force = false) {
    if (!force && jwt && Date.now() - jwtFetchedAt < JWT_TTL_MS) return jwt;
    const { data } = await axios.post(`${apiOrigin}/auth/guest/start`);
    jwt = data.token || data;
    jwtFetchedAt = Date.now();
    return jwt;
  }

  async function apiGet(urlPath, params) {
    const attempt = async (token) =>
      axios.get(`${apiOrigin}/api${urlPath}`, {
        params,
        headers: { Authorization: `Bearer ${token}`, "X-Api-Token": session.apiToken },
        timeout: 20000,
      });
    try {
      const { data } = await attempt(await getJwt());
      return data;
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        const { data } = await attempt(await getJwt(true));
        return data;
      }
      throw err;
    }
  }

  async function getFixtures() {
    const data = await apiGet("/fixtures/snapshot");
    const list = Array.isArray(data) ? data : data.fixtures || [];
    return list.map(normalizeFixture);
  }

  async function getScoresSnapshot(fixtureId) {
    return apiGet(`/scores/snapshot/${fixtureId}`);
  }

  /** Merkle stat-validation proof package for a fixture — the proof-gate for release (02 §4). */
  async function getStatValidationProof(fixtureId, seq = 0, statKeys = [1, 2]) {
    return apiGet("/scores/stat-validation", { fixtureId, seq, statKeys: statKeys.join(",") });
  }

  /** Subscribes to the live scores SSE stream; reconnects with backoff on drop (02 §4). */
  function subscribeScores(onMessage, onError) {
    let es;
    let lastEventId;
    let stopped = false;

    const connect = async () => {
      if (stopped) return;
      const token = await getJwt();
      es = new EventSource(`${apiOrigin}/api/scores/stream`, {
        fetch: async (input, init) => {
          const headers = {
            ...(init?.headers || {}),
            Authorization: `Bearer ${token}`,
            "X-Api-Token": session.apiToken,
            ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
          };
          return fetch(input, { ...init, headers });
        },
      });
      es.onmessage = (event) => {
        if (event.lastEventId) lastEventId = event.lastEventId;
        try {
          onMessage(JSON.parse(event.data));
        } catch (err) {
          onError?.(err);
        }
      };
      es.onerror = (err) => {
        onError?.(err);
        es.close();
        if (!stopped) setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      stopped = true;
      es?.close();
    };
  }

  return { getFixtures, getScoresSnapshot, getStatValidationProof, subscribeScores, apiGet };
}
