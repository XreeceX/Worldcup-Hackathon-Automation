// Pure helpers — no I/O, unit-tested in test/lib.test.js.

const GAME_STATE_SHIFT = 1n << 48n;

/** Split a packed TxLINE fixture id into { pureFixtureId, gameState }. */
export function decodePackedFixtureId(packed) {
  const p = BigInt(packed);
  return {
    pureFixtureId: p % GAME_STATE_SHIFT,
    gameState: Number(p / GAME_STATE_SHIFT),
  };
}

/**
 * Human label for a condition. Team names come from the fixtures table;
 * when unknown we fall back to generic "Home team"/"Away team".
 */
export function conditionLabel(template, param, homeTeam, awayTeam) {
  const home = homeTeam || 'Home team';
  const away = awayTeam || 'Away team';
  const t = Number(template);
  const p = Number(param);
  switch (t) {
    case 0:
      return 'Both teams score';
    case 1:
      return p === 0 ? `${home} wins` : `${away} wins`;
    case 2:
      return 'Draw (full time)';
    case 3: {
      const team = Math.floor(p / 256);
      const n = p % 256;
      const side = team === 0 ? home : away;
      return `${side} scores at least ${n}`;
    }
    case 4:
      return `Total goals ≥ ${p}`;
    case 5: {
      const team = Math.floor(p / 256);
      const n = p % 256;
      const side = team === 0 ? home : away;
      return `${side} wins by ≥ ${n}`;
    }
    case 6:
      return p === 0 ? `${home} wins on penalties` : `${away} wins on penalties`;
    case 7:
      return 'Goes to penalties';
    default:
      return 'Unknown condition';
  }
}

/** Decode a [u8;64] null-padded name into a UTF-8 string. */
export function decodeName(bytes) {
  const buf = Buffer.from(bytes ?? []);
  let end = buf.length;
  while (end > 0 && buf[end - 1] === 0) end--;
  return buf.subarray(0, end).toString('utf8');
}

const SORT_COLUMNS = {
  total_lamports: 'c.total_lamports',
  member_count: 'c.member_count',
  created_at: 'c.created_at',
};

const STATUSES = new Set(['Open', 'Executed', 'Refunded', 'Void', 'Closed']);

/**
 * Build the parameterised board query from request filters.
 * Returns { text, values }. Throws on invalid status/sort values.
 */
export function buildBoardQuery({ status, fixtureId, sort, limit, offset } = {}) {
  const where = [];
  const values = [];

  if (status !== undefined && status !== null && status !== '') {
    if (!STATUSES.has(status)) throw new Error(`invalid status: ${status}`);
    values.push(status);
    where.push(`c.status = $${values.length}`);
  }
  if (fixtureId !== undefined && fixtureId !== null && fixtureId !== '') {
    const id = BigInt(fixtureId); // throws on garbage
    values.push(id.toString());
    where.push(`c.fixture_id = $${values.length}`);
  }

  const sortCol = SORT_COLUMNS[sort ?? 'total_lamports'];
  if (!sortCol) throw new Error(`invalid sort: ${sort}`);

  const lim = Math.min(Math.max(Number(limit ?? 50) || 50, 1), 200);
  const off = Math.max(Number(offset ?? 0) || 0, 0);
  values.push(lim, off);

  const text =
    `SELECT c.*, f.home_team, f.away_team, f.kickoff_ts AS fixture_kickoff_ts ` +
    `FROM commitments c LEFT JOIN fixtures f ON f.fixture_id = c.fixture_id ` +
    (where.length ? `WHERE ${where.join(' AND ')} ` : '') +
    `ORDER BY ${sortCol} DESC, c.pubkey ASC ` +
    `LIMIT $${values.length - 1} OFFSET $${values.length}`;

  return { text, values };
}

/** Map a commitments+fixtures join row to the API response shape. */
export function boardRowToJson(row) {
  return {
    pubkey: row.pubkey,
    fixtureId: Number(row.fixture_id),
    conditionTemplate: Number(row.condition_template),
    conditionParam: Number(row.condition_param),
    conditionLabel: row.condition_label,
    beneficiary: row.beneficiary,
    founder: row.founder,
    name: row.name,
    status: row.status,
    memberCount: Number(row.member_count),
    totalLamports: Number(row.total_lamports),
    homeTeam: row.home_team ?? null,
    awayTeam: row.away_team ?? null,
    kickoffTs:
      row.fixture_kickoff_ts != null
        ? Number(row.fixture_kickoff_ts)
        : Number(row.kickoff_ts) * 1000,
    settlementTx: row.settlement_tx ?? null,
  };
}

/**
 * Map one raw TxLINE snapshot record to a fixtures-table row.
 * Tolerant of field-name variants and missing fields; returns null
 * when no fixture id can be found.
 */
export function mapFixtureRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const packed = raw.FixtureId ?? raw.fixtureId ?? raw.fixture_id ?? raw.id;
  if (packed === undefined || packed === null) return null;

  let decoded;
  try {
    decoded = decodePackedFixtureId(packed);
  } catch {
    return null;
  }

  const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');
  const teamName = (v) =>
    typeof v === 'object' && v !== null ? pick(v.name, v.Name, v.team, v.Team) : v;

  const home = teamName(
    pick(raw.participant1, raw.Participant1, raw.homeTeam, raw.HomeTeam, raw.home, raw.p1)
  );
  const away = teamName(
    pick(raw.participant2, raw.Participant2, raw.awayTeam, raw.AwayTeam, raw.away, raw.p2)
  );
  const competition = teamName(
    pick(raw.competition, raw.Competition, raw.competitionName, raw.CompetitionName, raw.league)
  );
  const kickoff = pick(raw.StartTime, raw.startTime, raw.start_time, raw.kickoff, raw.Ts, raw.ts);

  return {
    fixtureId: decoded.pureFixtureId.toString(),
    gameState: decoded.gameState,
    homeTeam: String(home ?? 'Home team'),
    awayTeam: String(away ?? 'Away team'),
    competition: String(competition ?? 'Unknown'),
    kickoffTs: Number(kickoff ?? 0),
  };
}

/** Earliest plausible full-time after kickoff (90' + stoppage buffer). */
const EST_FULL_TIME_MS = 105 * 60 * 1000;

/** Fixture lifecycle bucket used by GET /api/fixtures?status=. */
export function fixtureBucket(gameState, kickoffTsMs, nowMs = Date.now()) {
  const gs = Number(gameState);
  if ([5, 10, 13, 15, 16, 100].includes(gs)) return 'finished';
  // Explicit in-play (H1/HT/H2/ET/pens) — trust TxLINE game_state.
  if (gs >= 2) return 'live';
  // NS / unknown: snapshot often leaves game_state 0 after FT. Use est. FT
  // instead of a multi-hour "live" window so lists match score finalisation.
  if (Number(kickoffTsMs) > nowMs) return 'upcoming';
  if (nowMs - Number(kickoffTsMs) >= EST_FULL_TIME_MS) return 'finished';
  return 'live';
}
