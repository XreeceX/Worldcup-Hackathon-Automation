/** Condensed TxLINE StablePrice odds for Market Pulse chips. */
export interface MarketOdds {
  homeWinPct: number | null;
  drawPct: number | null;
  awayWinPct: number | null;
  /** line string → over % (e.g. "2.5" → 48.2) */
  over: Record<string, number>;
  asOf: number | null;
  asOfKickoff: boolean;
}

export function emptyOdds(): MarketOdds {
  return {
    homeWinPct: null,
    drawPct: null,
    awayWinPct: null,
    over: {},
    asOf: null,
    asOfKickoff: false,
  };
}

function parsePct(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v !== 'NA' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Condense TxLINE odds snapshot rows (BookmakerId 10021 = demargined StablePrice). */
export function condenseOddsSnapshot(rows: unknown): MarketOdds {
  const out = emptyOdds();
  const list = Array.isArray(rows) ? rows : [];
  let asOf: number | null = null;

  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const bookmaker = Number(r.BookmakerId ?? r.bookmakerId);
    if (bookmaker !== 10021) continue;

    const ts = Number(r.Ts ?? r.ts ?? r.AsOf ?? r.asOf);
    if (Number.isFinite(ts)) asOf = asOf == null ? ts : Math.max(asOf, ts);

    const marketType = String(r.MarketType ?? r.marketType ?? '');
    const period = r.MarketPeriod ?? r.marketPeriod;
    const params = String(r.MarketParameters ?? r.marketParameters ?? '');
    const pcts = (r.Pct ?? r.pct) as unknown[];
    const names = (r.PriceNames ?? r.priceNames) as unknown[];
    if (!Array.isArray(pcts)) continue;

    if (marketType.includes('1X2') && (period == null || period === '')) {
      out.homeWinPct = parsePct(pcts[0]);
      out.drawPct = parsePct(pcts[1]);
      out.awayWinPct = parsePct(pcts[2]);
    }

    if (marketType.includes('OVERUNDER')) {
      const lineMatch = params.match(/line=([0-9.]+)/i);
      if (!lineMatch) continue;
      const line = lineMatch[1];
      let overIdx = 0;
      if (Array.isArray(names)) {
        const idx = names.findIndex((n) => String(n).toLowerCase() === 'over');
        if (idx >= 0) overIdx = idx;
      }
      const pct = parsePct(pcts[overIdx]);
      if (pct != null) out.over[line] = pct;
    }
  }

  out.asOf = asOf;
  return out;
}

/**
 * Implied chance for a condition template. Returns null when no market
 * mapping exists (e.g. BTTS) — chip must stay hidden.
 * Template ids match web/lib/conditions.ts.
 */
export function impliedPct(
  odds: MarketOdds | null | undefined,
  template: number,
  param: number,
): number | null {
  if (!odds) return null;
  // 0 BTTS — no market
  if (template === 1) return param === 0 ? odds.homeWinPct : odds.awayWinPct;
  if (template === 2) return odds.drawPct;
  if (template === 4) {
    const n = Number(param);
    const candidates = [String(n - 0.5), (n - 0.5).toFixed(1), (n - 0.5).toFixed(2)];
    for (const c of candidates) {
      if (odds.over[c] != null) return odds.over[c];
    }
    return null;
  }
  return null;
}

export function formatImpliedChip(pct: number): string {
  return `Market pulse · ${Math.round(pct)}% implied chance`;
}
