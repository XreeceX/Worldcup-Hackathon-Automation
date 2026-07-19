// Keeper HTTP API (design-01.md §7.8): feed SSE, score proxy SSE,
// commitments lookup, manual resolve trigger and health check.

import express from 'express';
import cors from 'cors';
import { log } from './logger.mjs';

const HEARTBEAT_MS = 15_000;

function openSseResponse(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), HEARTBEAT_MS);
  req.on('close', () => clearInterval(heartbeat));
  return {
    send(event) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    },
  };
}

function parseCorsOrigin(raw) {
  const value = String(raw || 'http://localhost:3000').trim();
  if (value === '*') return true;
  const list = value.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length <= 1 ? list[0] : list;
}

export function createServer({ cfg, keeper }) {
  const app = express();
  app.use(cors({ origin: parseCorsOrigin(cfg.corsOrigin) }));
  app.use(express.json());

  // SSE stream of resolution/void events from the internal feed bus.
  app.get('/api/feed', (req, res) => {
    const stream = openSseResponse(req, res);
    for (const event of keeper.recentFeed) stream.send(event); // catch-up for late joiners
    const listener = (event) => stream.send(event);
    keeper.feedBus.on('event', listener);
    req.on('close', () => keeper.feedBus.off('event', listener));
  });

  // SSE proxy of the TxLINE score stream, filtered to one fixture. In replay
  // mode the replayed historical records flow through the same bus.
  app.get('/api/scores/live', (req, res) => {
    const fixtureId = Number(req.query.fixtureId);
    if (!Number.isFinite(fixtureId)) {
      return res.status(400).json({ error: 'fixtureId query parameter is required' });
    }
    const stream = openSseResponse(req, res);
    const listener = (record) => {
      const recordFixture = Number(record?.FixtureId ?? record?.fixtureId);
      if (recordFixture === fixtureId) stream.send(record);
    };
    keeper.scoreBus.on('score', listener);
    req.on('close', () => keeper.scoreBus.off('score', listener));
  });

  // Latest TxLINE score snapshot for a fixture (stats for the match-details UI).
  app.get('/api/scores/snapshot/:fixtureId', async (req, res) => {
    try {
      const fixtureId = Number(req.params.fixtureId);
      if (!Number.isFinite(fixtureId)) {
        return res.status(400).json({ error: 'fixtureId is required' });
      }
      const data = await keeper.txline.getScoresSnapshot(fixtureId);
      res.json(data ?? {});
    } catch (e) {
      // Upcoming / unknown fixtures often 404 from TxLINE — treat as empty snapshot.
      const status = e?.response?.status;
      if (status === 404) {
        return res.json({});
      }
      log.error('[server] /api/scores/snapshot failed', e.message);
      res.status(502).json({ error: e.message });
    }
  });

  // Full score feed for match-details UI: historical (rich timeline) with
  // snapshot fallback. Returns a de-duplicated array of records.
  app.get('/api/scores/feed/:fixtureId', async (req, res) => {
    try {
      const fixtureId = Number(req.params.fixtureId);
      if (!Number.isFinite(fixtureId)) {
        return res.status(400).json({ error: 'fixtureId is required' });
      }
      const byKey = new Map();
      const ingest = (rows) => {
        if (!Array.isArray(rows)) return;
        for (const r of rows) {
          if (!r || typeof r !== 'object') continue;
          const key = `${r.Seq ?? r.seq ?? ''}:${r.Action ?? r.action ?? ''}:${r.Id ?? r.id ?? ''}`;
          byKey.set(key, r);
        }
      };
      try {
        ingest(await keeper.txline.getScoresHistorical(fixtureId));
      } catch (e) {
        if (e?.response?.status !== 404) {
          log.warn('[server] historical feed unavailable', e.message);
        }
      }
      try {
        const snap = await keeper.txline.getScoresSnapshot(fixtureId);
        ingest(Array.isArray(snap) ? snap : snap ? [snap] : []);
      } catch (e) {
        if (e?.response?.status !== 404) throw e;
      }
      const out = [...byKey.values()].sort(
        (a, b) => Number(a.Seq ?? a.seq ?? 0) - Number(b.Seq ?? b.seq ?? 0),
      );
      res.json(out);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404) return res.json([]);
      log.error('[server] /api/scores/feed failed', e.message);
      res.status(502).json({ error: e.message });
    }
  });

  // Open commitments for a fixture (indexer proxy, on-chain scan fallback).
  app.get('/api/commitments/:fixtureId', async (req, res) => {
    try {
      const rows = await keeper.getOpenCommitments(Number(req.params.fixtureId));
      res.json(rows);
    } catch (e) {
      log.error('[server] /api/commitments failed', e.message);
      res.status(502).json({ error: e.message });
    }
  });

  // Manual resolve trigger — fallback for keeper downtime (design §7.8).
  app.post('/api/resolve/:commitmentPubkey', async (req, res) => {
    try {
      const result = await keeper.resolveByPubkey(req.params.commitmentPubkey);
      res.json({ ok: true, ...result });
    } catch (e) {
      log.error(`[server] manual resolve failed for ${req.params.commitmentPubkey}`, e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Paced historical replay for demos (requires REPLAY_FIXTURE_ID).
  app.post('/api/replay/run', async (req, res) => {
    try {
      if (keeper.mode !== 'replay') {
        return res.status(400).json({ error: 'not in replay mode — set REPLAY_FIXTURE_ID' });
      }
      const speed = Number(req.query.speedMs ?? 150);
      const speedMs = Number.isFinite(speed) && speed > 0 ? speed : 150;
      keeper.startPacedReplay(speedMs).catch((e) =>
        log.error('[server] paced replay failed', e.message),
      );
      res.status(202).json({ started: true, speedMs });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: keeper.mode,
      sse: keeper.sseConnected ? 'connected' : 'disconnected',
    });
  });

  return new Promise((resolve) => {
    const server = app.listen(cfg.port, () => {
      log.info(`[server] keeper API listening on http://localhost:${cfg.port}`);
      resolve(server);
    });
  });
}
