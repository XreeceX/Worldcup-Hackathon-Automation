import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import { config } from './config.js';
import { buildBoardQuery, boardRowToJson, fixtureBucket } from './lib.js';
import { state } from './listener.js';

function parseCorsOrigin(raw) {
  const value = String(raw || 'http://localhost:3000').trim();
  if (value === '*') return true;
  const list = value.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length <= 1 ? list[0] : list;
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: parseCorsOrigin(config.corsOrigin) }));

  // GET /api/board?status=&fixture_id=&sort=&limit=&offset=
  app.get('/api/board', async (req, res) => {
    let query;
    try {
      query = buildBoardQuery({
        status: req.query.status,
        fixtureId: req.query.fixture_id,
        sort: req.query.sort,
        limit: req.query.limit,
        offset: req.query.offset,
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      const { rows } = await pool.query(query.text, query.values);
      res.json(rows.map(boardRowToJson));
    } catch (err) {
      console.error('[api] /api/board:', err.message);
      res.status(500).json({ error: 'internal error' });
    }
  });

  // GET /api/commitment/:pubkey — detail + members
  app.get('/api/commitment/:pubkey', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT c.*, f.home_team, f.away_team, f.kickoff_ts AS fixture_kickoff_ts
         FROM commitments c LEFT JOIN fixtures f ON f.fixture_id = c.fixture_id
         WHERE c.pubkey = $1`,
        [req.params.pubkey]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'not found' });

      const { rows: memberRows } = await pool.query(
        `SELECT wallet, deposit_lamports, withdrawn, claimed, joined_at
         FROM commitment_members WHERE commitment_pubkey = $1
         ORDER BY joined_at ASC, wallet ASC`,
        [req.params.pubkey]
      );
      res.json({
        ...boardRowToJson(rows[0]),
        resolvedAt: rows[0].resolved_at,
        createdAt: rows[0].created_at,
        members: memberRows.map((m) => ({
          wallet: m.wallet,
          depositLamports: Number(m.deposit_lamports),
          withdrawn: m.withdrawn,
          claimed: m.claimed,
          joinedAt: m.joined_at,
        })),
      });
    } catch (err) {
      console.error('[api] /api/commitment:', err.message);
      res.status(500).json({ error: 'internal error' });
    }
  });

  // GET /api/claims?wallet= — unclaimed refunds on Refunded/Void commitments
  app.get('/api/claims', async (req, res) => {
    const wallet = req.query.wallet;
    if (!wallet) return res.status(400).json({ error: 'wallet query param required' });
    try {
      const { rows } = await pool.query(
        `SELECT m.commitment_pubkey, m.deposit_lamports,
                c.name, c.status, c.condition_label, c.fixture_id,
                f.home_team, f.away_team, f.kickoff_ts AS fixture_kickoff_ts
         FROM commitment_members m
         JOIN commitments c ON c.pubkey = m.commitment_pubkey
         LEFT JOIN fixtures f ON f.fixture_id = c.fixture_id
         WHERE m.wallet = $1 AND m.withdrawn = false AND m.claimed = false
           AND c.status IN ('Refunded', 'Void')
         ORDER BY c.resolved_at DESC NULLS LAST`,
        [wallet]
      );
      res.json(
        rows.map((r) => ({
          commitmentPubkey: r.commitment_pubkey,
          name: r.name,
          status: r.status,
          conditionLabel: r.condition_label,
          fixtureId: Number(r.fixture_id),
          homeTeam: r.home_team ?? null,
          awayTeam: r.away_team ?? null,
          kickoffTs: r.fixture_kickoff_ts != null ? Number(r.fixture_kickoff_ts) : null,
          amountLamports: Number(r.deposit_lamports),
        }))
      );
    } catch (err) {
      console.error('[api] /api/claims:', err.message);
      res.status(500).json({ error: 'internal error' });
    }
  });

  // GET /api/fixtures?status=upcoming|live|finished
  app.get('/api/fixtures', async (req, res) => {
    const statusFilter = req.query.status;
    if (statusFilter && !['upcoming', 'live', 'finished'].includes(statusFilter)) {
      return res.status(400).json({ error: 'status must be upcoming|live|finished' });
    }
    try {
      const { rows } = await pool.query(`SELECT * FROM fixtures ORDER BY kickoff_ts ASC`);
      const now = Date.now();
      const mapped = rows.map((f) => ({
        fixtureId: Number(f.fixture_id),
        homeTeam: f.home_team,
        awayTeam: f.away_team,
        competition: f.competition,
        kickoffTs: Number(f.kickoff_ts),
        gameState: Number(f.game_state),
        status: fixtureBucket(f.game_state, Number(f.kickoff_ts), now),
      }));
      res.json(statusFilter ? mapped.filter((f) => f.status === statusFilter) : mapped);
    } catch (err) {
      console.error('[api] /api/fixtures:', err.message);
      res.status(500).json({ error: 'internal error' });
    }
  });

  // GET /api/health
  app.get('/api/health', async (_req, res) => {
    let dbConnected = false;
    try {
      await pool.query('SELECT 1');
      dbConnected = true;
    } catch {
      // fall through — reported below
    }
    res.json({
      ok: dbConnected,
      dbConnected,
      listenerRunning: state.listenerRunning,
      lastEventSlot: state.lastEventSlot,
    });
  });

  return app;
}
