import fs from 'node:fs';
import axios from 'axios';
import { config } from './config.js';
import { mapFixtureRecord } from './lib.js';
import { upsertFixture } from './db.js';

let jwt = config.txline.jwt;
let apiToken = config.txline.apiToken;

function loadCredsFromDisk() {
  try {
    const raw = JSON.parse(fs.readFileSync(config.txline.credsPath, 'utf8'));
    if (raw.jwt) jwt = jwt || raw.jwt;
    if (raw.apiToken) apiToken = apiToken || raw.apiToken;
  } catch {
    // no creds file — handled by caller
  }
}

async function renewJwt() {
  const res = await axios.post(`${config.txline.origin}/auth/guest/start`);
  jwt = res.data.token;
  console.log('[fixtures] JWT renewed');
}

async function fetchSnapshot(competitionId) {
  const url =
    `${config.txline.origin}/api/fixtures/snapshot` +
    `?competitionId=${competitionId}&startEpochDay=${config.txline.startEpochDay}`;
  const doGet = () =>
    axios.get(url, {
      headers: { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken },
      timeout: 30_000,
    });
  try {
    return (await doGet()).data;
  } catch (err) {
    if (err.response?.status === 401) {
      await renewJwt();
      return (await doGet()).data;
    }
    throw err;
  }
}

function unwrapRecords(data) {
  const records = Array.isArray(data)
    ? data
    : data?.fixtures ?? data?.data ?? data?.records ?? [];
  return Array.isArray(records) ? records : null;
}

/** One refresh pass. Returns the number of fixtures upserted. */
export async function refreshFixtures() {
  if (!jwt || !apiToken) loadCredsFromDisk();
  if (!jwt || !apiToken) {
    console.warn(
      '[fixtures] no TxLINE credentials (TXLINE_JWT/TXLINE_API_TOKEN or ~/.secrets/txline-devnet-creds.json) — continuing with empty fixtures'
    );
    return 0;
  }

  const competitionIds = config.txline.competitionIds?.length
    ? config.txline.competitionIds
    : [config.txline.competitionId];

  let count = 0;
  let total = 0;
  for (const competitionId of competitionIds) {
    let data;
    try {
      data = await fetchSnapshot(competitionId);
    } catch (err) {
      console.warn(
        `[fixtures] snapshot competitionId=${competitionId} failed:`,
        err.response?.status ?? err.message
      );
      continue;
    }
    const records = unwrapRecords(data);
    if (!records) {
      console.warn(
        `[fixtures] unexpected snapshot shape for competitionId=${competitionId}:`,
        JSON.stringify(data).slice(0, 200)
      );
      continue;
    }
    total += records.length;
    for (const raw of records) {
      const f = mapFixtureRecord(raw);
      if (!f) continue;
      // Prefer explicit competition names from TxLINE; fall back by id.
      if (!f.competition || f.competition === 'Unknown') {
        f.competition = competitionId === 72 ? 'World Cup' : competitionId === 430 ? 'Friendlies' : f.competition;
      }
      await upsertFixture(f);
      count++;
    }
  }
  console.log(`[fixtures] upserted ${count}/${total} fixtures (competitions: ${competitionIds.join(',')})`);
  return count;
}

export function startFixtureLoader() {
  const run = () =>
    refreshFixtures().catch((err) =>
      console.error('[fixtures] refresh failed:', err.response?.status ?? err.message)
    );
  run();
  setInterval(run, config.fixtureRefreshMs).unref();
}
