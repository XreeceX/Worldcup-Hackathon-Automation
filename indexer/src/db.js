import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

pool.on('error', (err) => console.error('[db] pool error:', err.message));

/** Apply schema.sql when the core tables are missing. */
export async function ensureSchema() {
  const { rows } = await pool.query(
    `SELECT to_regclass('public.commitments') IS NOT NULL AS exists`
  );
  if (rows[0].exists) {
    console.log('[db] schema present');
    return;
  }
  const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('[db] schema applied');
}

/**
 * Commitments reference fixtures(fixture_id). Events can arrive for fixtures
 * we have not (yet) fetched from TxLINE, so insert a placeholder row that a
 * later snapshot refresh will overwrite with real team names.
 */
export async function ensureFixtureRow(fixtureId, kickoffTsMs = 0) {
  await pool.query(
    `INSERT INTO fixtures (fixture_id, home_team, away_team, competition, kickoff_ts, game_state)
     VALUES ($1, 'Home team', 'Away team', 'Unknown', $2, 0)
     ON CONFLICT (fixture_id) DO NOTHING`,
    [fixtureId, kickoffTsMs]
  );
}

export async function upsertFixture(f) {
  await pool.query(
    `INSERT INTO fixtures (fixture_id, home_team, away_team, competition, kickoff_ts, game_state)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (fixture_id) DO UPDATE SET
       home_team = EXCLUDED.home_team,
       away_team = EXCLUDED.away_team,
       competition = EXCLUDED.competition,
       kickoff_ts = EXCLUDED.kickoff_ts,
       game_state = EXCLUDED.game_state`,
    [f.fixtureId, f.homeTeam, f.awayTeam, f.competition, f.kickoffTs, f.gameState]
  );
}

export async function getFixture(fixtureId) {
  const { rows } = await pool.query(`SELECT * FROM fixtures WHERE fixture_id = $1`, [fixtureId]);
  return rows[0] ?? null;
}
