import { describe, expect, it } from 'vitest';
import { condenseOddsSnapshot, formatImpliedChip, impliedPct } from '../odds';

/** Row shapes captured from the live TxLINE odds snapshot API (fixture 18241006). */
const SNAPSHOT = [
  {
    FixtureId: 18241006,
    Ts: 1784141697059,
    Bookmaker: 'TXLineStablePriceDemargined',
    BookmakerId: 10021,
    SuperOddsType: '1X2_PARTICIPANT_RESULT',
    MarketParameters: null,
    MarketPeriod: 'half=1',
    PriceNames: ['part1', 'draw', 'part2'],
    Pct: ['27.042', '49.044', '23.906'],
  },
  {
    FixtureId: 18241006,
    Ts: 1784141697059,
    Bookmaker: 'TXLineStablePriceDemargined',
    BookmakerId: 10021,
    SuperOddsType: '1X2_PARTICIPANT_RESULT',
    MarketParameters: null,
    MarketPeriod: null,
    PriceNames: ['part1', 'draw', 'part2'],
    Pct: ['35.448', '33.411', '31.133'],
  },
  {
    FixtureId: 18241006,
    Ts: 1784141697059,
    BookmakerId: 10021,
    SuperOddsType: 'OVERUNDER_PARTICIPANT_GOALS',
    MarketParameters: 'line=2.5',
    MarketPeriod: null,
    PriceNames: ['over', 'under'],
    Pct: ['48.211', '51.789'],
  },
  {
    // half-time line — must not leak into full-match totals
    FixtureId: 18241006,
    Ts: 1784141697059,
    BookmakerId: 10021,
    SuperOddsType: 'OVERUNDER_PARTICIPANT_GOALS',
    MarketParameters: 'line=0.5',
    MarketPeriod: 'half=1',
    PriceNames: ['over', 'under'],
    Pct: ['60.753', '39.246'],
  },
  {
    // Asian handicap also carries line= — must not be read as totals
    FixtureId: 18241006,
    Ts: 1784141697059,
    BookmakerId: 10021,
    SuperOddsType: 'ASIANHANDICAP_PARTICIPANT_GOALS',
    MarketParameters: 'line=0',
    MarketPeriod: null,
    PriceNames: ['part1', 'part2'],
    Pct: ['53.220', '46.773'],
  },
  {
    // other bookmakers are ignored entirely
    FixtureId: 18241006,
    Ts: 1784141697059,
    BookmakerId: 42,
    SuperOddsType: '1X2_PARTICIPANT_RESULT',
    MarketPeriod: null,
    Pct: ['90', '5', '5'],
  },
];

describe('condenseOddsSnapshot', () => {
  const odds = condenseOddsSnapshot(SNAPSHOT);

  it('reads full-match 1X2 from SuperOddsType rows', () => {
    expect(odds.homeWinPct).toBeCloseTo(35.448);
    expect(odds.drawPct).toBeCloseTo(33.411);
    expect(odds.awayWinPct).toBeCloseTo(31.133);
  });

  it('keeps only full-match over lines', () => {
    expect(odds.over['2.5']).toBeCloseTo(48.211);
    expect(odds.over['0.5']).toBeUndefined();
    expect(odds.over['0']).toBeUndefined();
  });

  it('records the snapshot timestamp', () => {
    expect(odds.asOf).toBe(1784141697059);
  });

  it('returns empty odds for empty input', () => {
    const empty = condenseOddsSnapshot([]);
    expect(empty.homeWinPct).toBeNull();
    expect(empty.over).toEqual({});
  });
});

describe('impliedPct', () => {
  const odds = condenseOddsSnapshot(SNAPSHOT);

  it('maps team-wins to home/away percentages', () => {
    expect(impliedPct(odds, 1, 0)).toBeCloseTo(35.448); // home wins
    expect(impliedPct(odds, 1, 1)).toBeCloseTo(31.133); // away wins
  });

  it('maps draw and total-goals thresholds', () => {
    expect(impliedPct(odds, 2, 0)).toBeCloseTo(33.411);
    expect(impliedPct(odds, 4, 3)).toBeCloseTo(48.211); // 3+ goals → over 2.5
  });

  it('stays hidden when no market maps', () => {
    expect(impliedPct(odds, 0, 0)).toBeNull(); // BTTS has no market
    expect(impliedPct(odds, 4, 5)).toBeNull(); // no over-4.5 line in snapshot
  });
});

describe('formatImpliedChip', () => {
  it('names the outcome when a label is given', () => {
    expect(formatImpliedChip(35.448, 'Spain wins')).toBe(
      'Market pulse · Spain wins — 35% implied chance',
    );
  });

  it('falls back to the bare chip without a label', () => {
    expect(formatImpliedChip(33.411)).toBe('Market pulse · 33% implied chance');
  });
});
