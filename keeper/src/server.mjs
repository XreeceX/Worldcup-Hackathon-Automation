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

export function createServer({ cfg, keeper }) {
  const app = express();
  app.use(cors({ origin: 'http://localhost:3000' }));
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

  // Manual resolve trigger — fallback for keeper downtime (design §10.7).
  app.post('/api/resolve/:commitmentPubkey', async (req, res) => {
    try {
      const result = await keeper.resolveByPubkey(req.params.commitmentPubkey);
      res.json({ ok: true, ...result });
    } catch (e) {
      log.error(`[server] manual resolve failed for ${req.params.commitmentPubkey}`, e.message);
      res.status(500).json({ ok: false, error: e.message });
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
