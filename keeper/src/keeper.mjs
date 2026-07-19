// Keeper core (design-01.md §7): finalisation handling, polling fallback,
// auto-void on cancellation, replay mode and the manual-resolve pipeline.

import { EventEmitter } from 'node:events';
import axios from 'axios';
import { log } from './logger.mjs';
import {
  fixtureUpdatesUrl,
  isCancelledGameState,
  isFinalisedEvent,
  mapFixtureValidation,
  mapStatValidation,
  scoreUpdateUrls,
  statKeysForTemplate,
  unpackFixtureId,
} from './mapping.mjs';
import { isAlreadyResolvedError, statusName } from './chain.mjs';

const FEED_BUFFER_SIZE = 50;

/** Indexer rows may be snake_case; chain rows camelCase. Normalise once. */
function normalizeCommitmentRow(row) {
  return {
    pubkey: row.pubkey,
    fixtureId: Number(row.fixture_id ?? row.fixtureId),
    conditionTemplate: Number(row.condition_template ?? row.conditionTemplate ?? 0),
    conditionParam: Number(row.condition_param ?? row.conditionParam ?? 0),
    beneficiary: row.beneficiary,
    name: row.name,
  };
}

export function createKeeper({ cfg, txline, chain }) {
  const feedBus = new EventEmitter();
  const scoreBus = new EventEmitter();
  scoreBus.setMaxListeners(100); // one listener per /api/scores/live client
  const recentFeed = [];

  const resolvedFixtures = new Set(); // dedupe across SSE + poll (design §7.5)
  const voidedFixtures = new Set();

  let sseHandle = null;
  let scorePollTimer = null;
  let fixturePollTimer = null;

  const indexerClient = axios.create({ baseURL: cfg.indexerUrl, timeout: 8_000 });

  function emitFeedEvent(event) {
    const enriched = { ...event, at: new Date().toISOString() };
    recentFeed.push(enriched);
    if (recentFeed.length > FEED_BUFFER_SIZE) recentFeed.shift();
    log.info(`[feed] ${JSON.stringify(enriched)}`);
    feedBus.emit('event', enriched);
  }

  /** Indexer board query, with on-chain getProgramAccounts scan fallback. */
  async function getOpenCommitments(fixtureId = null) {
    try {
      let url = '/api/board?status=Open';
      if (fixtureId != null) url += `&fixture_id=${fixtureId}`;
      const rows = (await indexerClient.get(url)).data;
      return (Array.isArray(rows) ? rows : rows.commitments ?? []).map(normalizeCommitmentRow);
    } catch (e) {
      log.warn(`[keeper] indexer unreachable (${e.message}) — falling back to on-chain scan`);
      const rows = await chain.scanOpenCommitments(fixtureId);
      return rows.map(normalizeCommitmentRow);
    }
  }

  /**
   * Resolve a single commitment: fetch proof, send tx, then — only AFTER the
   * tx has confirmed — read the on-chain account for the real outcome and
   * emit the feed event (BUG-03 fix).
   */
  async function resolveCommitment(c, fixtureId, seq) {
    const statKeys = statKeysForTemplate(c.conditionTemplate);
    const proofJson = await txline.getStatValidation(fixtureId, seq, statKeys);
    const { payload, epochDay } = mapStatValidation(proofJson, statKeys);

    log.info(
      `[keeper] resolving ${c.pubkey} (fixture ${fixtureId}, seq ${seq}, epochDay ${epochDay})`
    );
    const txSig = await chain.sendResolveTransaction(c.pubkey, payload, epochDay);
    const outcome = await chain.getResolutionOutcome(c.pubkey);

    log.info(
      `[keeper] state transition: ${c.pubkey} Open → ${outcome.status} (tx ${txSig})`
    );
    emitFeedEvent({
      type: 'resolved',
      commitment: c,
      fixtureId,
      conditionMet: outcome.conditionMet,
      status: outcome.status,
      txSig,
    });
    return { txSig, ...outcome };
  }

  /** design §7.5 — entry point for SSE, polling, replay and manual resolve. */
  async function handleFinalised(fixtureId, seq) {
    // BUG-02 fix: never default seq to 0 — a falsy seq is a hard error.
    if (!seq) {
      log.error(`[keeper] game_finalised for fixture ${fixtureId} missing seq — refusing to proceed`);
      throw new Error(`game_finalised for fixture ${fixtureId} carried no seq`);
    }
    if (resolvedFixtures.has(fixtureId)) return;
    resolvedFixtures.add(fixtureId);
    log.info(`[keeper] game_finalised: fixture ${fixtureId}, seq ${seq}`);

    let commitments;
    try {
      commitments = await getOpenCommitments(fixtureId);
    } catch (e) {
      resolvedFixtures.delete(fixtureId); // retry on the next poll cycle
      log.error(`[keeper] could not list Open commitments for fixture ${fixtureId}`, e.message);
      return;
    }
    if (commitments.length === 0) {
      log.info(`[keeper] fixture ${fixtureId} finalised — no Open commitments`);
      return;
    }

    let hadFailure = false;
    for (const c of commitments) {
      try {
        await resolveCommitment(c, fixtureId, seq);
      } catch (e) {
        if (isAlreadyResolvedError(e)) {
          // FR-13.5: already resolved on-chain — success, do not retry.
          log.info(`[keeper] ${c.pubkey} already resolved (NotOpen) — skipping`);
          continue;
        }
        hadFailure = true;
        log.error(`[keeper] resolve failed for ${c.pubkey}`, e.message);
      }
    }
    if (hadFailure) {
      // Do not skip commitments silently (design §6.3) — allow the next
      // poll cycle to re-detect this fixture and retry the failures.
      resolvedFixtures.delete(fixtureId);
    }
  }

  // ---------- SSE channel (design §7.3) ----------

  function startSse() {
    sseHandle = txline.subscribeScores({
      onEvent: (data) => {
        scoreBus.emit('score', data); // feeds /api/scores/live proxy
        // BUG-01 fix: only a fully finalised signal triggers resolution.
        if (isFinalisedEvent(data)) {
          handleFinalised(data.FixtureId, data.seq).catch((e) =>
            log.error('[keeper] handleFinalised (SSE) failed', e.message)
          );
        }
      },
    });
  }

  // ---------- polling fallback (design §7.4) ----------

  async function pollScores() {
    for (const url of scoreUpdateUrls(Date.now(), 24)) {
      let records;
      try {
        records = (await txline.apiClient.get(url)).data;
      } catch (e) {
        log.warn(`[keeper] score poll ${url} failed: ${e.message}`);
        continue;
      }
      for (const r of records ?? []) {
        if (isFinalisedEvent(r) && !resolvedFixtures.has(r.FixtureId)) {
          await handleFinalised(r.FixtureId, r.seq).catch((e) =>
            log.error('[keeper] handleFinalised (poll) failed', e.message)
          );
        }
      }
    }
  }

  // ---------- auto-void on cancellation (design §7.6) ----------

  async function handleFixtureCancelled(fixtureId, timestamp) {
    if (voidedFixtures.has(fixtureId)) return;
    const commitments = await getOpenCommitments(fixtureId);
    if (commitments.length === 0) {
      voidedFixtures.add(fixtureId);
      return;
    }
    log.info(`[keeper] fixture ${fixtureId} cancelled — voiding ${commitments.length} commitment(s)`);

    const proofJson = await txline.getFixtureValidation(fixtureId, timestamp);
    const mapped = mapFixtureValidation(proofJson);

    let hadFailure = false;
    for (const c of commitments) {
      try {
        const txSig = await chain.sendVoidFixtureTransaction(c.pubkey, mapped);
        log.info(`[keeper] state transition: ${c.pubkey} Open → Void (tx ${txSig})`);
        emitFeedEvent({ type: 'voided', commitment: c, fixtureId, txSig });
      } catch (e) {
        if (isAlreadyResolvedError(e)) {
          log.info(`[keeper] ${c.pubkey} already left Open state — skipping void`);
          continue;
        }
        hadFailure = true;
        log.error(`[keeper] void_fixture failed for ${c.pubkey}`, e.message);
      }
    }
    if (!hadFailure) voidedFixtures.add(fixtureId);
  }

  async function pollFixtures() {
    let updates;
    try {
      updates = (await txline.apiClient.get(fixtureUpdatesUrl(Date.now()))).data;
    } catch (e) {
      log.warn(`[keeper] fixture poll failed: ${e.message}`);
      return;
    }
    for (const f of updates ?? []) {
      const { gameState, fixtureId } = unpackFixtureId(f.FixtureId);
      // 16 = Cancelled. gameState 6 is WaitET and must NOT void (design §4.3).
      if (isCancelledGameState(gameState)) {
        await handleFixtureCancelled(fixtureId, f.Ts).catch((e) =>
          log.error(`[keeper] cancel handling failed for fixture ${fixtureId}`, e.message)
        );
      }
    }
  }

  // ---------- replay mode (design §7.7, docs/demo.md) ----------

  async function runReplay() {
    const fixtureId = cfg.replayFixtureId;
    log.info(`[keeper] REPLAY mode: fetching /scores/historical/${fixtureId}`);
    const records = await txline.getScoresHistorical(fixtureId);

    // Forward the historical timeline onto the score bus so the in-play
    // proxy behaves exactly as in live mode.
    for (const r of records ?? []) scoreBus.emit('score', r);

    const finalised = (records ?? []).find(isFinalisedEvent);
    if (!finalised) {
      throw new Error(
        `replay fixture ${fixtureId} has no record with action=game_finalised and statusId=100`
      );
    }
    log.info(`[keeper] replay found finalised record: seq ${finalised.seq}`);
    await handleFinalised(finalised.FixtureId ?? fixtureId, finalised.seq);
  }

  // ---------- manual resolve (design §7.8, POST /api/resolve/:pubkey) ----------

  async function findFinalisedRecord(fixtureId) {
    try {
      const records = await txline.getScoresHistorical(fixtureId);
      const hit = (records ?? []).find(isFinalisedEvent);
      if (hit) return hit;
    } catch (e) {
      log.warn(`[keeper] historical lookup failed for ${fixtureId}: ${e.message}`);
    }
    for (const url of scoreUpdateUrls(Date.now(), 24)) {
      try {
        const records = (await txline.apiClient.get(`${url}?fixtureId=${fixtureId}`)).data;
        const hit = (records ?? []).find(
          (r) => isFinalisedEvent(r) && Number(r.FixtureId) === Number(fixtureId)
        );
        if (hit) return hit;
      } catch {
        // scan window may 404 / fail — keep scanning
      }
    }
    return null;
  }

  async function resolveByPubkey(pubkey) {
    // Look the commitment up via indexer, falling back to the chain.
    let row = null;
    try {
      row = normalizeCommitmentRow((await indexerClient.get(`/api/commitment/${pubkey}`)).data);
    } catch {
      const account = await chain.fetchCommitment(pubkey);
      const status = statusName(account.status);
      if (status !== 'Open') return { skipped: true, status };
      row = normalizeCommitmentRow({
        pubkey,
        fixtureId: Number(account.fixtureId.toString()),
        conditionTemplate: account.conditionTemplate,
        conditionParam: Number(account.conditionParam.toString()),
        beneficiary: account.beneficiary.toBase58(),
      });
    }

    const record = await findFinalisedRecord(row.fixtureId);
    if (!record) {
      throw new Error(
        `no finalised score record found for fixture ${row.fixtureId} — match may not be over`
      );
    }
    if (!record.seq) {
      throw new Error(`finalised record for fixture ${row.fixtureId} carries no seq`); // BUG-02
    }
    return resolveCommitment(row, row.fixtureId, record.seq);
  }

  // ---------- boot (design §7.2) ----------

  async function loadActiveCommitments() {
    try {
      const open = await getOpenCommitments(null);
      log.info(`[keeper] tracking ${open.length} Open commitment(s) at boot`);
    } catch (e) {
      log.warn(`[keeper] could not load Open commitments at boot: ${e.message}`);
    }
  }

  function start() {
    if (cfg.replayFixtureId != null) {
      log.info(`[keeper] REPLAY_FIXTURE_ID=${cfg.replayFixtureId} — skipping SSE and poll loops`);
      runReplay().catch((e) => log.error('[keeper] replay failed', e.message));
      return;
    }
    // BUG-04 fix: live SSE subscription is wired at boot, replay is opt-in.
    startSse();
    scorePollTimer = setInterval(
      () => pollScores().catch((e) => log.error('[keeper] score poll loop failed', e.message)),
      cfg.pollIntervalMs
    );
    fixturePollTimer = setInterval(
      () => pollFixtures().catch((e) => log.error('[keeper] fixture poll loop failed', e.message)),
      cfg.pollIntervalMs
    );
    log.info(
      `[keeper] LIVE mode: SSE subscribed, score + fixture polls every ${cfg.pollIntervalMs}ms`
    );
  }

  function stop() {
    sseHandle?.close();
    clearInterval(scorePollTimer);
    clearInterval(fixturePollTimer);
  }

  return {
    feedBus,
    scoreBus,
    recentFeed,
    resolvedFixtures,
    chain,
    txline,
    get mode() {
      return cfg.replayFixtureId != null ? 'replay' : 'live';
    },
    get sseConnected() {
      return sseHandle?.connected ?? false;
    },
    getOpenCommitments,
    handleFinalised,
    resolveByPubkey,
    pollScores,
    pollFixtures,
    loadActiveCommitments,
    start,
    stop,
  };
}
