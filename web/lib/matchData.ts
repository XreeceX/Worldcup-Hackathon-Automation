import type {
  LiveScoreState,
  MatchEvent,
  MatchEventKind,
  MatchStats,
  PeriodScore,
  HydrationBreak,
  LineupBand,
  LineupPlayer,
  PlayerContribution,
  PlayerDirectory,
  TeamLineup,
} from './types';
import { coachForTeam } from './wcCoaches';

type RelatedRole = MatchEvent['relatedRole'];

/** FIFA World Cup 2026: mandatory 3-minute hydration breaks each half. */
export const FIFA_HYDRATION_DURATION_MIN = 3;
/** ~22' first half, ~67' match clock (22' into second half). */
export const FIFA_HYDRATION_WINDOWS = [
  { half: 1 as const, minuteLabel: "22'", minSec: 18 * 60, maxSec: 28 * 60 },
  { half: 2 as const, minuteLabel: "67'", minSec: 62 * 60, maxSec: 74 * 60 },
];

/** Same phrasing as stoppage tiles: "+3 min". */
export function formatDurationMin(mins: number): string {
  return `+${mins} min`;
}

export function hydrationBreakDetail(
  durationMin: number,
  half: 1 | 2 | null,
): string {
  const halfLabel =
    half === 1 ? '1st half' : half === 2 ? '2nd half' : null;
  return [
    `${formatDurationMin(durationMin)} drinks break`,
    halfLabel,
    'added to stoppage',
  ]
    .filter(Boolean)
    .join(' · ');
}

export const EMPTY_PERIOD: PeriodScore = {
  homeGoals: 0,
  awayGoals: 0,
  homeYellows: 0,
  awayYellows: 0,
  homeReds: 0,
  awayReds: 0,
  homeCorners: 0,
  awayCorners: 0,
};

export const EMPTY_STATS: MatchStats = {
  homeGoals: 0,
  awayGoals: 0,
  homeYellows: 0,
  awayYellows: 0,
  homeReds: 0,
  awayReds: 0,
  homeCorners: 0,
  awayCorners: 0,
  homeGoalsH1: 0,
  awayGoalsH1: 0,
  homeCornersH1: 0,
  awayCornersH1: 0,
  homeYellowsH1: 0,
  awayYellowsH1: 0,
  homeGoalsH2: 0,
  awayGoalsH2: 0,
  homeCornersH2: 0,
  awayCornersH2: 0,
  homeYellowsH2: 0,
  awayYellowsH2: 0,
  homeGoalsEt: 0,
  awayGoalsEt: 0,
  homePens: 0,
  awayPens: 0,
  homeShotsOnTarget: 0,
  awayShotsOnTarget: 0,
  homeFreeKicks: 0,
  awayFreeKicks: 0,
  homeOffsides: 0,
  awayOffsides: 0,
  homeFouls: 0,
  awayFouls: 0,
  homeThrowIns: 0,
  awayThrowIns: 0,
  homeGoalKicks: 0,
  awayGoalKicks: 0,
  varChecks: 0,
};

export const EMPTY_SCORE: LiveScoreState = {
  homeGoals: 0,
  awayGoals: 0,
  minute: null,
  clockSeconds: null,
  period: null,
  finalised: false,
  stats: EMPTY_STATS,
  h1: EMPTY_PERIOD,
  h2: EMPTY_PERIOD,
  ht: EMPTY_PERIOD,
  gameState: null,
  statusId: null,
  coverage: null,
  venue: null,
  weather: null,
  pitch: null,
  addedTime: null,
  addedTimeH1: null,
  addedTimeH2: null,
  hydrationBreaks: [],
  players: [],
  playerDirectory: {},
  lineups: { home: null, away: null },
};

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length ? v : null;
}

/**
 * FIFA World Cup match clock.
 * 1st half: 1'–45', then 45+1'… in stoppage.
 * 2nd half: 46'–90', then 90+1'… in stoppage.
 */
export function formatFifaMinute(
  seconds: number | null,
  statusId: number | null,
  _kind?: MatchEventKind | null,
  action?: string | null,
): string | null {
  if (action === 'game_finalised') return 'FT';
  if (action === 'halftime_finalised' || action === 'halftime') return 'HT';
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const mins = Math.floor(seconds / 60);
  const inFirstHalf = statusId === 2 || statusId === 3;
  const inSecondHalf = statusId === 4 || statusId === 5 || statusId === 100;

  if (inFirstHalf || (!inSecondHalf && mins <= 45)) {
    if (mins < 45) return `${Math.max(1, mins)}'`;
    return mins === 45 ? `45'` : `45+${mins - 45}'`;
  }
  if (inSecondHalf || mins > 45) {
    if (mins < 90) return `${Math.max(46, mins)}'`;
    return mins === 90 ? `90'` : `90+${mins - 90}'`;
  }
  return `${mins}'`;
}

/** "Anderson, Elliot" / "James, Reece (1999)" → "Elliot Anderson" */
export function formatPreferredName(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  const parts = cleaned.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return `${parts[1]} ${parts[0]}`.trim();
  return cleaned;
}

export function extractPlayerDirectory(records: Record<string, unknown>[]): PlayerDirectory {
  const dir: PlayerDirectory = {};
  for (const r of records) {
    const root = (r.Lineups ?? r.lineups) as unknown;
    if (!Array.isArray(root)) continue;
    for (const teamBlock of root as Record<string, unknown>[]) {
      const entries = (teamBlock.lineups ?? teamBlock.Lineups) as unknown;
      if (!Array.isArray(entries)) continue;
      for (const entry of entries as Record<string, unknown>[]) {
        const player = (entry.player ?? entry.Player) as Record<string, unknown> | undefined;
        if (!player) continue;
        const id = num(player.normativeId ?? player.NormativeId ?? player.id);
        if (id == null) continue;
        const name = formatPreferredName(str(player.preferredName ?? player.PreferredName));
        if (!name) continue;
        const shirt = str(entry.rosterNumber ?? entry.RosterNumber);
        dir[String(id)] = { name, shirt };
      }
    }
  }
  return dir;
}

/** Human label for TxLINE venue type (often just "neutral"). */
export function formatVenueLabel(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === 'neutral') return 'Neutral venue';
  if (t === 'home') return 'Home venue';
  if (t === 'away') return 'Away venue';
  return raw.trim();
}

/** "Elliot Anderson" → "E. Anderson" for pitch chips. */
export function shortPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name.trim();
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

function bandFromPositionId(positionId: number): LineupBand {
  // TxLINE football positions: 34 GK, 35 DEF, 36 MID, 37 FWD
  if (positionId === 34) return 'gk';
  if (positionId === 35) return 'def';
  if (positionId === 36) return 'mid';
  if (positionId === 37) return 'fwd';
  if (positionId < 34) return 'gk';
  return 'mid';
}

function formationFromStarters(starters: LineupPlayer[]): string {
  const def = starters.filter((p) => p.band === 'def').length;
  const mid = starters.filter((p) => p.band === 'mid').length;
  const fwd = starters.filter((p) => p.band === 'fwd').length;
  if (!def && !mid && !fwd) return '—';
  return `${def}-${mid}-${fwd}`;
}

function teamBlockSide(
  teamBlock: Record<string, unknown>,
  index: number,
): 'home' | 'away' | null {
  const p =
    teamFromParticipant(teamBlock.participant ?? teamBlock.Participant) ??
    teamFromParticipant(teamBlock.participantId ?? teamBlock.ParticipantId);
  if (p) return p;
  if (index === 0) return 'home';
  if (index === 1) return 'away';
  return null;
}

function teamBlockName(teamBlock: Record<string, unknown>): string | null {
  const team = (teamBlock.team ?? teamBlock.Team) as Record<string, unknown> | undefined;
  return (
    formatPreferredName(str(teamBlock.preferredName ?? teamBlock.PreferredName)) ??
    formatPreferredName(str(team?.preferredName ?? team?.PreferredName)) ??
    str(teamBlock.name ?? teamBlock.Name ?? team?.name ?? team?.Name)
  );
}

/** Starting XI + bench from TxLINE Lineups records. */
export function extractTeamLineups(
  records: Record<string, unknown>[],
): { home: TeamLineup | null; away: TeamLineup | null } {
  let home: TeamLineup | null = null;
  let away: TeamLineup | null = null;

  for (const r of records) {
    const root = (r.Lineups ?? r.lineups) as unknown;
    if (!Array.isArray(root) || !root.length) continue;

    for (let i = 0; i < (root as unknown[]).length; i++) {
      const teamBlock = (root as Record<string, unknown>[])[i];
      const side = teamBlockSide(teamBlock, i);
      if (!side) continue;
      const entries = (teamBlock.lineups ?? teamBlock.Lineups) as unknown;
      if (!Array.isArray(entries) || !entries.length) continue;

      const players: LineupPlayer[] = [];
      for (const entry of entries as Record<string, unknown>[]) {
        const player = (entry.player ?? entry.Player) as Record<string, unknown> | undefined;
        if (!player) continue;
        const id = num(player.normativeId ?? player.NormativeId ?? player.id);
        if (id == null) continue;
        const name = formatPreferredName(str(player.preferredName ?? player.PreferredName));
        if (!name) continue;
        const positionId =
          num(entry.positionId ?? entry.PositionId ?? player.positionId ?? player.PositionId) ?? 36;
        const starterRaw = entry.starter ?? entry.Starter ?? entry.isStarter ?? entry.IsStarter;
        const explicitStarter =
          starterRaw === true ||
          starterRaw === 1 ||
          starterRaw === '1' ||
          starterRaw === 'true';
        players.push({
          playerId: String(id),
          name,
          shirt: str(entry.rosterNumber ?? entry.RosterNumber),
          band: bandFromPositionId(positionId),
          positionId,
          starter: explicitStarter,
          goals: 0,
          yellowCards: 0,
          redCards: 0,
          subbedOff: false,
          subbedOn: false,
        });
      }

      if (!players.length) continue;

      const hasExplicitStarters = players.some((p) => p.starter);
      let starters: LineupPlayer[];
      let bench: LineupPlayer[];
      if (hasExplicitStarters) {
        starters = players.filter((p) => p.starter).slice(0, 11);
        const starterIds = new Set(starters.map((p) => p.playerId));
        bench = players.filter((p) => !starterIds.has(p.playerId));
      } else {
        const order: LineupBand[] = ['gk', 'def', 'mid', 'fwd'];
        const sorted = [...players].sort(
          (a, b) => order.indexOf(a.band) - order.indexOf(b.band) || a.positionId - b.positionId,
        );
        starters = sorted.slice(0, 11);
        bench = sorted.slice(11);
      }

      starters = starters.map((p) => ({ ...p, starter: true }));
      bench = bench.map((p) => ({ ...p, starter: false }));

      const lineup: TeamLineup = {
        teamName: teamBlockName(teamBlock) ?? (side === 'home' ? 'Home' : 'Away'),
        formation: formationFromStarters(starters),
        starters,
        bench,
        coach:
          formatPreferredName(
            str(
              teamBlock.coach ??
                teamBlock.Coach ??
                teamBlock.manager ??
                teamBlock.Manager ??
                teamBlock.coachName ??
                teamBlock.CoachName,
            ),
          ) ?? coachForTeam(teamBlockName(teamBlock)),
      };
      if (side === 'home') home = lineup;
      else away = lineup;
    }
  }

  return { home, away };
}

export function enrichLineupsWithMatchData(
  lineups: { home: TeamLineup | null; away: TeamLineup | null },
  events: MatchEvent[],
  players: PlayerContribution[],
): { home: TeamLineup | null; away: TeamLineup | null } {
  const enrichSide = (team: TeamLineup | null, side: 'home' | 'away'): TeamLineup | null => {
    if (!team) return null;
    const mapOne = (p: LineupPlayer): LineupPlayer => {
      const contrib = players.find((c) => c.playerId === p.playerId && c.team === side);
      const goalEvents = events.filter((e) => e.kind === 'goal' && e.playerId === p.playerId);
      const cardEvents = events.filter((e) => e.kind === 'card' && e.playerId === p.playerId);
      const redFromEvents = cardEvents.filter((e) =>
        /red|second.?yellow/i.test(`${e.action ?? ''} ${e.label}`),
      ).length;
      const yellowFromEvents = cardEvents.length - redFromEvents;
      const subbedOff = events.some(
        (e) => e.kind === 'sub' && e.relatedPlayerId === p.playerId,
      );
      const subbedOn = events.some((e) => e.kind === 'sub' && e.playerId === p.playerId);
      return {
        ...p,
        goals: Math.max(contrib?.goals ?? 0, goalEvents.length),
        yellowCards: Math.max(contrib?.yellowCards ?? 0, yellowFromEvents),
        redCards: Math.max(contrib?.redCards ?? 0, redFromEvents),
        subbedOff: subbedOff || p.subbedOff,
        subbedOn: subbedOn || p.subbedOn,
      };
    };
    return {
      ...team,
      coach: team.coach ?? coachForTeam(team.teamName),
      starters: team.starters.map(mapOne),
      bench: team.bench.map(mapOne),
    };
  };
  return {
    home: enrichSide(lineups.home, 'home'),
    away: enrichSide(lineups.away, 'away'),
  };
}

function resolvePlayerName(
  playerId: string | null,
  directory: PlayerDirectory,
): string | null {
  if (!playerId) return null;
  return directory[playerId]?.name ?? null;
}

function teamFromParticipant(p: unknown): 'home' | 'away' | null {
  const n = num(p);
  if (n === 1) return 'home';
  if (n === 2) return 'away';
  return null;
}

function fromStatMap(s: Record<string, unknown>): Partial<MatchStats> {
  return {
    homeGoals: num(s['1']) ?? undefined,
    awayGoals: num(s['2']) ?? undefined,
    homeYellows: num(s['3']) ?? undefined,
    awayYellows: num(s['4']) ?? undefined,
    homeReds: num(s['5']) ?? undefined,
    awayReds: num(s['6']) ?? undefined,
    homeCorners: num(s['7']) ?? undefined,
    awayCorners: num(s['8']) ?? undefined,
    homeGoalsH1: num(s['1001']) ?? undefined,
    awayGoalsH1: num(s['1002']) ?? undefined,
    homeYellowsH1: num(s['1003']) ?? undefined,
    awayYellowsH1: num(s['1004']) ?? undefined,
    homeCornersH1: num(s['1007']) ?? undefined,
    awayCornersH1: num(s['1008']) ?? undefined,
    homeGoalsH2: num(s['3001']) ?? undefined,
    awayGoalsH2: num(s['3002']) ?? undefined,
    homeYellowsH2: num(s['3003']) ?? undefined,
    awayYellowsH2: num(s['3004']) ?? undefined,
    homeCornersH2: num(s['3007']) ?? undefined,
    awayCornersH2: num(s['3008']) ?? undefined,
    homeGoalsEt: num(s['7001']) ?? undefined,
    awayGoalsEt: num(s['7002']) ?? undefined,
    homePens: num(s['6001']) ?? undefined,
    awayPens: num(s['6002']) ?? undefined,
  };
}

function sideBag(bucket: Record<string, unknown> | undefined): {
  goals: number;
  yellows: number;
  reds: number;
  corners: number;
} {
  return {
    goals: num(bucket?.Goals ?? bucket?.goals) ?? 0,
    yellows: num(bucket?.YellowCards ?? bucket?.yellowCards) ?? 0,
    reds: num(bucket?.RedCards ?? bucket?.redCards) ?? 0,
    corners: num(bucket?.Corners ?? bucket?.corners) ?? 0,
  };
}

function fromNestedScore(score: Record<string, unknown>): {
  stats: Partial<MatchStats>;
  h1: PeriodScore;
  h2: PeriodScore;
  ht: PeriodScore;
} {
  const p1 = (score.Participant1 ?? score.participant1) as Record<string, unknown> | undefined;
  const p2 = (score.Participant2 ?? score.participant2) as Record<string, unknown> | undefined;
  const t1 = sideBag((p1?.Total ?? p1?.total) as Record<string, unknown> | undefined);
  const t2 = sideBag((p2?.Total ?? p2?.total) as Record<string, unknown> | undefined);
  const h1a = sideBag((p1?.H1 ?? p1?.h1) as Record<string, unknown> | undefined);
  const h1b = sideBag((p2?.H1 ?? p2?.h1) as Record<string, unknown> | undefined);
  const h2a = sideBag((p1?.H2 ?? p1?.h2) as Record<string, unknown> | undefined);
  const h2b = sideBag((p2?.H2 ?? p2?.h2) as Record<string, unknown> | undefined);
  const hta = sideBag((p1?.HT ?? p1?.ht) as Record<string, unknown> | undefined);
  const htb = sideBag((p2?.HT ?? p2?.ht) as Record<string, unknown> | undefined);

  return {
    stats: {
      homeGoals: t1.goals,
      awayGoals: t2.goals,
      homeYellows: t1.yellows,
      awayYellows: t2.yellows,
      homeReds: t1.reds,
      awayReds: t2.reds,
      homeCorners: t1.corners,
      awayCorners: t2.corners,
      homeGoalsH1: h1a.goals,
      awayGoalsH1: h1b.goals,
      homeYellowsH1: h1a.yellows,
      awayYellowsH1: h1b.yellows,
      homeCornersH1: h1a.corners,
      awayCornersH1: h1b.corners,
      homeGoalsH2: h2a.goals,
      awayGoalsH2: h2b.goals,
      homeYellowsH2: h2a.yellows,
      awayYellowsH2: h2b.yellows,
      homeCornersH2: h2a.corners,
      awayCornersH2: h2b.corners,
    },
    h1: {
      homeGoals: h1a.goals,
      awayGoals: h1b.goals,
      homeYellows: h1a.yellows,
      awayYellows: h1b.yellows,
      homeReds: h1a.reds,
      awayReds: h1b.reds,
      homeCorners: h1a.corners,
      awayCorners: h1b.corners,
    },
    h2: {
      homeGoals: h2a.goals,
      awayGoals: h2b.goals,
      homeYellows: h2a.yellows,
      awayYellows: h2b.yellows,
      homeReds: h2a.reds,
      awayReds: h2b.reds,
      homeCorners: h2a.corners,
      awayCorners: h2b.corners,
    },
    ht: {
      homeGoals: hta.goals,
      awayGoals: htb.goals,
      homeYellows: hta.yellows,
      awayYellows: htb.yellows,
      homeReds: hta.reds,
      awayReds: htb.reds,
      homeCorners: hta.corners,
      awayCorners: htb.corners,
    },
  };
}

function mergeStats(base: MatchStats, patch: Partial<MatchStats>): MatchStats {
  const out = { ...base };
  for (const key of Object.keys(EMPTY_STATS) as (keyof MatchStats)[]) {
    if (patch[key] != null) out[key] = patch[key] as number;
  }
  return out;
}

export function extractMatchStats(d: Record<string, unknown>): MatchStats {
  let stats = { ...EMPTY_STATS };
  const flat = d.stats ?? d.Stats;
  if (flat && typeof flat === 'object' && !Array.isArray(flat)) {
    stats = mergeStats(stats, fromStatMap(flat as Record<string, unknown>));
  }
  const nested = d.Score ?? d.score;
  if (nested && typeof nested === 'object') {
    stats = mergeStats(stats, fromNestedScore(nested as Record<string, unknown>).stats);
  }
  stats = mergeStats(stats, {
    homeGoals: num(d.p1Score ?? d.P1Score ?? d.homeGoals ?? d.homeScore) ?? undefined,
    awayGoals: num(d.p2Score ?? d.P2Score ?? d.awayGoals ?? d.awayScore) ?? undefined,
  });
  return stats;
}

function extractPlayers(d: Record<string, unknown>): PlayerContribution[] {
  const raw = (d.PlayerStats ?? d.playerStats) as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') return [];
  const out: PlayerContribution[] = [];
  for (const [sideKey, team] of [
    ['Participant1', 'home'],
    ['Participant2', 'away'],
  ] as const) {
    const side = raw[sideKey] as Record<string, Record<string, unknown>> | undefined;
    if (!side) continue;
    for (const [playerId, bag] of Object.entries(side)) {
      out.push({
        playerId,
        name: null,
        team,
        goals: num(bag.goals ?? bag.Goals) ?? 0,
        yellowCards: num(bag.yellowCards ?? bag.YellowCards) ?? 0,
        redCards: num(bag.redCards ?? bag.RedCards) ?? 0,
      });
    }
  }
  return out.sort((a, b) => b.goals - a.goals || b.yellowCards - a.yellowCards);
}

const PERIOD_LABELS: Record<string, string> = {
  '1': 'Not started',
  '2': '1st half',
  '3': 'Half-time',
  '4': '2nd half',
  '5': 'Full time',
  '6': 'Extra time pending',
  '7': 'ET 1st half',
  '8': 'ET half-time',
  '9': 'ET 2nd half',
  '10': 'ET finished',
  '11': 'Penalties pending',
  '12': 'Penalty shootout',
  '13': 'Penalties finished',
  '14': 'Interrupted',
  '15': 'Abandoned',
  '16': 'Cancelled',
  '19': 'Postponed',
  '100': 'Full time',
};

export function periodLabel(period: string | null, gameState: string | null): string {
  if (gameState && !/^\d+$/.test(gameState) && gameState.toLowerCase() !== 'scheduled') {
    return gameState.replace(/_/g, ' ');
  }
  const key = period ?? gameState;
  if (!key) return '—';
  return PERIOD_LABELS[key] ?? key;
}

/**
 * Regulation half/match length + announced stoppage (both halves when applicable).
 * e.g. HT +1 → "45+1'" · FT with +2 and +4 → "90+6'"
 */
export function totalPlayedTimeLabel(score: LiveScoreState): string {
  const sid = score.statusId;
  const period = score.period ?? '';
  const h1 = score.addedTimeH1 ?? 0;
  const h2 = score.addedTimeH2 ?? 0;
  const announced = score.addedTime ?? 0;

  const inEt =
    (sid != null && sid >= 7 && sid <= 13) ||
    ['7', '8', '9', '10', '11', '12', '13'].includes(period);
  const pastFirstHalf =
    score.finalised ||
    sid === 100 ||
    (sid != null && sid >= 3) ||
    ['3', '4', '5', '6', '100'].includes(period) ||
    inEt;
  const pastSecondHalf =
    score.finalised ||
    sid === 100 ||
    sid === 5 ||
    (sid != null && sid >= 5) ||
    ['5', '6', '100'].includes(period) ||
    inEt;

  if (inEt) {
    const stoppage = h1 + h2;
    return stoppage > 0 ? `120+${stoppage}'` : `120'`;
  }

  if (pastSecondHalf || (sid != null && sid >= 4) || period === '4') {
    let stoppage = h1;
    if (score.addedTimeH2 != null) stoppage += h2;
    else if (pastSecondHalf) stoppage += announced;
    else if (sid === 4 || period === '4') stoppage += announced;
    return stoppage > 0 ? `90+${stoppage}'` : `90'`;
  }

  if (pastFirstHalf || sid === 2 || period === '2') {
    const stoppage = score.addedTimeH1 != null ? h1 : announced;
    if (stoppage > 0) return `45+${stoppage}'`;
    // Still in open play with no stoppage board yet — use live clock.
    if (sid === 2 || period === '2') return score.minute ?? '—';
    return `45'`;
  }

  return score.minute ?? '—';
}

const ACTION_META: Record<
  string,
  { kind: MatchEventKind; label: string; teamFrom?: 'participant' | 'data' }
> = {
  goal: { kind: 'goal', label: 'Goal', teamFrom: 'participant' },
  own_goal: { kind: 'goal', label: 'Own goal', teamFrom: 'participant' },
  penalty: { kind: 'goal', label: 'Penalty', teamFrom: 'participant' },
  yellow_card: { kind: 'card', label: 'Yellow card', teamFrom: 'participant' },
  red_card: { kind: 'card', label: 'Red card', teamFrom: 'participant' },
  second_yellow: { kind: 'card', label: 'Second yellow', teamFrom: 'participant' },
  corner: { kind: 'corner', label: 'Corner', teamFrom: 'participant' },
  shot: { kind: 'shot', label: 'Shot', teamFrom: 'participant' },
  substitution: { kind: 'sub', label: 'Substitution', teamFrom: 'data' },
  kickoff: { kind: 'period', label: 'Kick-off' },
  halftime: { kind: 'period', label: 'Half-time' },
  halftime_finalised: { kind: 'period', label: 'Half-time' },
  secondhalf: { kind: 'period', label: 'Second half' },
  game_finalised: { kind: 'period', label: 'Full time' },
  additional_time: { kind: 'info', label: 'Added time' },
  injury: { kind: 'info', label: 'Injury break', teamFrom: 'data' },
  free_kick: { kind: 'freekick', label: 'Free kick', teamFrom: 'participant' },
  // goal_kick / throw_in: tallied for stats only — too noisy for the timeline
  penalty_outcome: { kind: 'goal', label: 'Penalty', teamFrom: 'participant' },
  var: { kind: 'var', label: 'VAR check' },
  possible: { kind: 'var', label: 'VAR check' },
  suspend: { kind: 'hydration', label: 'Hydration break' },
  hydration: { kind: 'hydration', label: 'Hydration break' },
  cooling_break: { kind: 'hydration', label: 'Hydration break' },
  drinks_break: { kind: 'hydration', label: 'Hydration break' },
  water_break: { kind: 'hydration', label: 'Hydration break' },
};

function idStr(v: unknown): string | null {
  const n = num(v);
  return n != null ? String(n) : null;
}

/** Taker / subject player id from TxLINE Data (and nested Player). */
function extractPlayerId(data: Record<string, unknown>): string | null {
  const nested = (data.Player ?? data.player) as Record<string, unknown> | undefined;
  return (
    idStr(data.PlayerId ?? data.playerId ?? data.TakerId ?? data.takerId) ??
    idStr(nested?.normativeId ?? nested?.NormativeId ?? nested?.id)
  );
}

function hydrationWindowForSeconds(
  seconds: number | null,
): (typeof FIFA_HYDRATION_WINDOWS)[number] | null {
  if (seconds == null) return null;
  return FIFA_HYDRATION_WINDOWS.find((w) => seconds >= w.minSec && seconds <= w.maxSec) ?? null;
}

function isHydrationAction(action: string): boolean {
  return /hydrat|cooling_break|drinks_break|water_break/i.test(action);
}

const TIMELINE_ACTIONS = new Set(Object.keys(ACTION_META));

function isOffsideType(t: string | null): boolean {
  return !!t && /offside/i.test(t);
}

/** Shot outcomes that count as on target (goals handled separately). */
function isShotOnTargetOutcome(outcome: string | null): boolean {
  if (!outcome) return false;
  // Woodwork / missed / wide / blocked = not on target in usual football counting.
  if (/woodwork|miss|wide|off.?target|blocked|out/i.test(outcome)) return false;
  return /saved|on.?target|goal|parry|catch/i.test(outcome);
}

/** Increment action-derived counters (SOT, free kicks, VAR…) from one record. */
function tallyActionStats(
  stats: MatchStats,
  d: Record<string, unknown>,
): MatchStats {
  const action = str(d.action ?? d.Action)?.toLowerCase();
  if (!action) return stats;
  const data = (d.Data ?? d.data ?? {}) as Record<string, unknown>;
  const team =
    teamFromParticipant(d.Participant ?? d.participant) ??
    teamFromParticipant(data.Participant ?? data.participant);
  const next = { ...stats };
  const bump = (homeKey: keyof MatchStats, awayKey: keyof MatchStats) => {
    if (team === 'home') (next[homeKey] as number) += 1;
    else if (team === 'away') (next[awayKey] as number) += 1;
  };

  // Goals count as shots on target; own goals do not credit the scoring side's SOT.
  if (action === 'goal' || action === 'penalty') {
    bump('homeShotsOnTarget', 'awayShotsOnTarget');
  }
  if (action === 'shot') {
    const outcome = str(data.Outcome ?? data.outcome);
    if (isShotOnTargetOutcome(outcome)) {
      bump('homeShotsOnTarget', 'awayShotsOnTarget');
    }
  }
  if (action === 'throw_in') bump('homeThrowIns', 'awayThrowIns');
  if (action === 'goal_kick') bump('homeGoalKicks', 'awayGoalKicks');
  if (action === 'free_kick') {
    const fk = str(data.FreeKickType ?? data.freeKickType);
    if (isOffsideType(fk)) {
      bump('homeOffsides', 'awayOffsides');
    } else {
      bump('homeFreeKicks', 'awayFreeKicks');
      // Free kick (not offside) is the closest foul signal in this feed.
      bump('homeFouls', 'awayFouls');
    }
  }
  if (action === 'var') next.varChecks += 1;
  if (action === 'possible') {
    const pe = (d.PossibleEvent ?? d.possibleEvent ?? data) as Record<string, unknown>;
    if (pe?.VAR === true || pe?.var === true || data.VAR === true) {
      next.varChecks += 1;
    }
  }
  return next;
}

function eventFromAction(d: Record<string, unknown>): MatchEvent | null {
  const action = str(d.action ?? d.Action)?.toLowerCase();
  if (!action || !TIMELINE_ACTIONS.has(action)) return null;
  const data = (d.Data ?? d.data ?? {}) as Record<string, unknown>;
  const pe = (d.PossibleEvent ?? d.possibleEvent ?? {}) as Record<string, unknown>;

  // Only treat "possible" as a timeline event when VAR is involved.
  if (action === 'possible') {
    if (!(pe.VAR === true || pe.var === true || data.VAR === true)) return null;
  }

  let meta = ACTION_META[action];
  const fkType = str(data.FreeKickType ?? data.freeKickType);
  if (action === 'free_kick' && isOffsideType(fkType)) {
    meta = { kind: 'offside', label: 'Offside', teamFrom: 'participant' };
  }

  const clock = (d.Clock ?? d.clock) as Record<string, unknown> | undefined;
  let seconds = num(clock?.Seconds ?? clock?.seconds);
  const statusId = num(d.statusId ?? d.StatusId);
  const inShootout = statusId === 12 || statusId === 13;

  // Penalty kick outcome (in-game or shootout). Do NOT promote unrelated actions
  // just because Data.Penalty is set — that created phantom goal cards.
  // Bare `penalty` often has no PlayerId; `penalty_outcome` carries the taker.
  if (action === 'penalty' || action === 'penalty_outcome') {
    const outcome = str(data.Outcome ?? data.outcome)?.toLowerCase() ?? '';
    const hasTaker = Boolean(extractPlayerId(data));
    if (action === 'penalty' && !outcome && !hasTaker) {
      // Award announcement only — wait for penalty_outcome for the taker/result.
      meta = {
        kind: 'info',
        label: inShootout ? 'Shootout penalty' : 'Penalty awarded',
        teamFrom: 'participant',
      };
    } else if (/miss|save|retake|woodwork|post|bar/.test(outcome) || outcome === 'missed') {
      meta = {
        kind: 'info',
        label: inShootout ? 'Shootout miss' : 'Penalty missed',
        teamFrom: 'participant',
      };
    } else if (inShootout) {
      meta = {
        kind: 'info',
        label: /score|goal/.test(outcome) || !outcome ? 'Shootout goal' : 'Shootout penalty',
        teamFrom: 'participant',
      };
    } else if (action === 'penalty_outcome' || /score|goal/.test(outcome) || hasTaker) {
      meta = { kind: 'goal', label: 'Penalty', teamFrom: 'participant' };
    }
    // else: scored penalty in open play → keep as goal from ACTION_META
  }

  // Ignore spurious late "kickoff" pings during the 2nd half (TxLINE noise).
  if (action === 'kickoff' && seconds != null && seconds > 5 * 60) return null;

  // Generic "suspend" without a hydration-window clock is noise for the timeline.
  if (action === 'suspend') {
    const window = hydrationWindowForSeconds(seconds);
    if (!window) return null;
    meta = {
      kind: 'hydration',
      label: 'Hydration break',
    };
  }

  let team: 'home' | 'away' | null = null;
  if (meta.teamFrom === 'participant') team = teamFromParticipant(d.Participant ?? d.participant);
  if (meta.teamFrom === 'data') team = teamFromParticipant(data.Participant ?? data.participant);

  let playerId = extractPlayerId(data);
  let relatedPlayerId: string | null = null;
  let relatedRole: RelatedRole = null;

  // Pin HT / FT on the FIFA timeline so they sort correctly.
  if (action === 'halftime_finalised' || action === 'halftime') {
    seconds = 45 * 60;
  }
  if (action === 'game_finalised') {
    seconds = 120 * 60;
  }

  const details: string[] = [];
  let labelKind = meta.label;
  let eventAction = meta.kind === 'offside' ? 'offside' : action;

  if (action === 'substitution') {
    playerId = idStr(data.PlayerInId ?? data.playerInId);
    relatedPlayerId = idStr(data.PlayerOutId ?? data.playerOutId);
    relatedRole = 'off';
    details.push('SUB_PLACEHOLDER');
  }

  if (
    action === 'goal' ||
    action === 'own_goal' ||
    ((action === 'penalty' || action === 'penalty_outcome') && meta.kind === 'goal')
  ) {
    const gt = str(data.GoalType ?? data.goalType);
    if (
      action === 'penalty' ||
      action === 'penalty_outcome' ||
      (action === 'goal' && data.Penalty === true)
    ) {
      labelKind = 'Penalty';
      eventAction = 'penalty';
      details.push('Taken by taker'); // resolved to name later
    }
    if (gt) details.push(gt === 'Head' ? 'Header' : gt);
  }

  if (
    (action === 'penalty' || action === 'penalty_outcome') &&
    meta.kind === 'info'
  ) {
    details.push('Taken by taker');
    const outcome = str(data.Outcome ?? data.outcome);
    if (outcome) details.push(outcome);
  }

  if (action === 'shot') {
    const outcome = str(data.Outcome ?? data.outcome);
    if (outcome) details.push(outcome === 'Woodwork' ? 'Hit the woodwork' : outcome);
  }

  if (action === 'red_card' || action === 'second_yellow') details.push('Sent off');

  if (action === 'additional_time') {
    const mins = num(data.Minutes ?? data.minutes);
    if (mins != null) {
      const half =
        statusId === 2 || statusId === 3 || (seconds != null && seconds <= 50 * 60)
          ? 'first half (after 45\')'
          : 'second half (after 90\')';
      details.push(`+${mins} min stoppage · ${half}`);
      details.push('FIFA adds time at the end of both halves');
    }
  }

  if (action === 'injury') {
    const outcome = str(data.Outcome ?? data.outcome);
    if (outcome) details.push(outcome.replace(/_/g, ' '));
    if (!playerId) playerId = idStr(data.PlayerId ?? data.playerId);
  }

  // Free kick (not offside): taker + who was fouled
  if (action === 'free_kick' && !isOffsideType(fkType)) {
    if (!playerId) playerId = extractPlayerId(data);
    if (fkType) details.push(`${fkType} free kick`);
    details.push('Taken by taker');
    const fouled = idStr(data.FouledId ?? data.fouledId);
    if (fouled) {
      relatedPlayerId = fouled;
      relatedRole = 'fouled';
    }
  }

  // Offside: player who was offside
  if (meta.kind === 'offside') {
    labelKind = 'Offside';
    eventAction = 'offside';
    if (!playerId) playerId = extractPlayerId(data);
    details.push('Offside by player');
  }

  // Corner: taker when PlayerId present
  if (action === 'corner') {
    if (!playerId) playerId = extractPlayerId(data);
    details.push('Taken by taker');
  }

  // VAR: against which team / player, and what was checked
  if (action === 'var' || action === 'possible') {
    labelKind = 'VAR check';
    eventAction = 'var';
    if (!team) team = teamFromParticipant(data.Participant ?? d.Participant ?? d.participant);
    relatedRole = 'against';
    if (!playerId) playerId = idStr(data.PlayerId ?? pe.PlayerId);
    const checks: string[] = [];
    if (pe.RedCard === true || data.RedCard === true) checks.push('possible red card');
    if (pe.YellowCard === true || data.YellowCard === true) checks.push('possible yellow card');
    if (pe.Penalty === true || data.Penalty === true) checks.push('possible penalty');
    if (pe.Goal === true || data.Goal === true) checks.push('possible goal');
    if (checks.length) details.push(`Reviewing ${checks.join(', ')}`);
    else details.push('Video review');
  }

  if (action === 'halftime_finalised' || action === 'halftime') {
    details.push('End of the first half · stoppage time already played');
  }
  if (action === 'game_finalised') {
    details.push('End of the match');
  }

  if (meta.kind === 'hydration' || isHydrationAction(action) || action === 'suspend') {
    const window = hydrationWindowForSeconds(seconds);
    const durationMin =
      num(data.Minutes ?? data.minutes ?? data.Duration ?? data.duration) ??
      FIFA_HYDRATION_DURATION_MIN;
    labelKind = 'Hydration break';
    eventAction = 'hydration';
    details.length = 0;
    details.push(
      hydrationBreakDetail(durationMin, window?.half ?? null),
    );
    if (window) {
      // Snap display minute to the FIFA window label when close.
      seconds = window.half === 1 ? 22 * 60 : 67 * 60;
    }
  }

  const minute =
    eventAction === 'hydration' && seconds != null
      ? hydrationWindowForSeconds(seconds)?.minuteLabel ?? formatFifaMinute(seconds, statusId, meta.kind, action)
      : formatFifaMinute(seconds, statusId, meta.kind, action);

  const seq = num(d.Seq ?? d.seq) ?? 0;
  const ts = num(d.Ts ?? d.ts) ?? Date.now();
  const teamWord = team === 'home' ? 'home' : team === 'away' ? 'away' : null;
  let label = teamWord ? `${labelKind} — ${teamWord}` : labelKind;
  if ((action === 'var' || action === 'possible') && teamWord) {
    label = `VAR check — against ${teamWord}`;
  }
  if (eventAction === 'hydration') {
    label = 'Hydration break';
  }

  const kind: MatchEventKind =
    eventAction === 'hydration'
      ? 'hydration'
      : meta.kind === 'offside'
        ? 'offside'
        : meta.kind;

  return {
    id: `${action}-${kind}-${seq}-${ts}`,
    kind,
    team,
    label,
    detail: details.length ? details.join(' · ') : null,
    minute,
    clockSeconds: seconds,
    playerId,
    playerName: null,
    relatedPlayerId,
    relatedPlayerName: null,
    relatedRole,
    action: eventAction,
    ts,
    seq,
  };
}

export function parseScoreRecord(
  d: Record<string, unknown>,
  prev: LiveScoreState,
): { score: LiveScoreState; events: MatchEvent[] } {
  const stats = extractMatchStats(d);
  const nested = (d.Score ?? d.score) as Record<string, unknown> | undefined;
  const periods = nested ? fromNestedScore(nested) : null;
  const action = str(d.action ?? d.Action);
  const clock = (d.Clock ?? d.clock) as Record<string, unknown> | undefined;
  const clockSeconds = num(clock?.Seconds ?? clock?.seconds);
  const periodRaw = d.period ?? d.Period ?? d.statusId ?? d.StatusId;
  const period =
    periodRaw != null && (typeof periodRaw === 'string' || typeof periodRaw === 'number')
      ? String(periodRaw)
      : null;
  const gameState = str(d.gameState ?? d.GameState);
  const statusId = num(d.statusId ?? d.StatusId);
  const finalised =
    (action === 'game_finalised' && statusId === 100) || statusId === 100 || period === '100';

  const data = (d.Data ?? d.data ?? {}) as Record<string, unknown>;
  let addedTime = prev.addedTime;
  let addedTimeH1 = prev.addedTimeH1;
  let addedTimeH2 = prev.addedTimeH2;
  if (action === 'additional_time') {
    const mins = num(data.Minutes ?? data.minutes);
    if (mins != null) {
      addedTime = mins;
      const sid = statusId ?? prev.statusId;
      // Prefer status; fall back to clock — both halves get FIFA stoppage.
      if (sid === 2 || sid === 3) {
        addedTimeH1 = mins;
      } else if (sid === 4 || sid === 5 || sid === 100) {
        addedTimeH2 = mins;
      } else if (clockSeconds != null && clockSeconds <= 50 * 60) {
        addedTimeH1 = mins;
      } else {
        addedTimeH2 = mins;
      }
    }
  }

  // Track observed hydration breaks on the score state.
  let hydrationBreaks = [...prev.hydrationBreaks];
  if (
    action &&
    (isHydrationAction(action) ||
      (action === 'suspend' && hydrationWindowForSeconds(clockSeconds)))
  ) {
    const window =
      hydrationWindowForSeconds(clockSeconds) ??
      (action === 'suspend' ? null : FIFA_HYDRATION_WINDOWS[0]);
    if (window && !hydrationBreaks.some((b) => b.half === window.half && b.observed)) {
      hydrationBreaks = [
        ...hydrationBreaks.filter((b) => !(b.half === window.half && !b.observed)),
        {
          half: window.half,
          minute: window.minuteLabel,
          durationMin: FIFA_HYDRATION_DURATION_MIN,
          observed: true,
          clockSeconds: clockSeconds,
        },
      ];
    }
  }

  const lineupDir = extractPlayerDirectory([d]);
  const playerDirectory = { ...prev.playerDirectory, ...lineupDir };
  const extractedLineups = extractTeamLineups([d]);
  const lineups = {
    home: extractedLineups.home ?? prev.lineups.home,
    away: extractedLineups.away ?? prev.lineups.away,
  };

  const minute =
    formatFifaMinute(clockSeconds, statusId ?? prev.statusId) ?? prev.minute;

  let venue = prev.venue;
  let weather = prev.weather;
  let pitch = prev.pitch;
  if (action === 'venue') {
    const raw = str(data.Type ?? data.type) ?? venue;
    venue = raw ? formatVenueLabel(raw) : venue;
  }
  if (action === 'weather') {
    const cond = data.Conditions ?? data.conditions;
    weather = Array.isArray(cond) ? cond.join(', ') : str(cond) ?? weather;
  }
  if (action === 'pitch') {
    const cond = data.Conditions ?? data.conditions;
    pitch = Array.isArray(cond) ? cond.join(', ') : str(cond) ?? pitch;
  }

  const players = extractPlayers(d).map((p) => ({
    ...p,
    name: resolvePlayerName(p.playerId, playerDirectory),
  }));
  // Keep prior action tallies, then add this record's increments.
  const baseStats = mergeStats(prev.stats, stats);
  // Don't let extractMatchStats wipe action counters (they're 0 in Stats map).
  const preserved: Partial<MatchStats> = {
    homeShotsOnTarget: prev.stats.homeShotsOnTarget,
    awayShotsOnTarget: prev.stats.awayShotsOnTarget,
    homeFreeKicks: prev.stats.homeFreeKicks,
    awayFreeKicks: prev.stats.awayFreeKicks,
    homeOffsides: prev.stats.homeOffsides,
    awayOffsides: prev.stats.awayOffsides,
    homeFouls: prev.stats.homeFouls,
    awayFouls: prev.stats.awayFouls,
    homeThrowIns: prev.stats.homeThrowIns,
    awayThrowIns: prev.stats.awayThrowIns,
    homeGoalKicks: prev.stats.homeGoalKicks,
    awayGoalKicks: prev.stats.awayGoalKicks,
    varChecks: prev.stats.varChecks,
  };
  const withPreserved = mergeStats(baseStats, preserved);
  const tallied = tallyActionStats(withPreserved, d);

  const score: LiveScoreState = {
    homeGoals: tallied.homeGoals,
    awayGoals: tallied.awayGoals,
    minute,
    clockSeconds: clockSeconds ?? prev.clockSeconds,
    period: period ?? prev.period,
    finalised: prev.finalised || finalised,
    stats: tallied,
    h1: periods?.h1 ?? prev.h1,
    h2: periods?.h2 ?? prev.h2,
    ht: periods?.ht ?? prev.ht,
    gameState: gameState ?? prev.gameState,
    statusId: statusId ?? prev.statusId,
    coverage: str(d.CoverageType ?? d.coverageType) ?? prev.coverage,
    venue,
    weather,
    pitch,
    addedTime,
    addedTimeH1,
    addedTimeH2,
    hydrationBreaks,
    players: players.length
      ? players
      : prev.players.map((p) => ({
          ...p,
          name: p.name ?? resolvePlayerName(p.playerId, playerDirectory),
        })),
    playerDirectory,
    lineups,
  };

  const events: MatchEvent[] = [];
  const fromAction = eventFromAction(d);
  if (fromAction) {
    events.push(enrichEventDetail(fromAction, playerDirectory));
  }

  return { score, events };
}

function enrichEventDetail(
  ev: MatchEvent,
  directory: PlayerDirectory,
): MatchEvent {
  const playerName = ev.playerName ?? resolvePlayerName(ev.playerId, directory);
  const relatedPlayerName =
    ev.relatedPlayerName ?? resolvePlayerName(ev.relatedPlayerId, directory);

  const nameOrId = (id: string | null, name: string | null) =>
    name ?? (id ? `Player #${id}` : null);

  const primary = nameOrId(ev.playerId, playerName);
  const related = nameOrId(ev.relatedPlayerId, relatedPlayerName);

  let text = (ev.detail ?? '').trim();
  // Strip unresolved placeholders / prior name prefixes so re-enrich is idempotent.
  text = text
    .replace(/SUB_PLACEHOLDER/g, '')
    .replace(/Taken by taker/gi, '')
    .replace(/Offside by player/gi, '')
    .replace(/Taken by\s+/gi, '')
    .replace(/Offside by\s+/gi, '')
    .replace(/Involving\s+/gi, '')
    .replace(/Foul on\s+/gi, '')
    .replace(/ON:#\d+/g, '')
    .replace(/OFF:#\d+/g, '')
    .replace(/^·\s*|\s*·$/g, '')
    .replace(/\s*·\s*·\s*/g, ' · ')
    .trim();
  if (primary) {
    text = text
      .split(' · ')
      .map((p) => p.trim())
      .filter((p) => p && p.toLowerCase() !== primary.toLowerCase())
      .join(' · ');
  }
  if (related) {
    text = text
      .split(' · ')
      .map((p) => p.trim())
      .filter(
        (p) =>
          p &&
          p.toLowerCase() !== related.toLowerCase() &&
          !p.toLowerCase().endsWith(` ${related.toLowerCase()}`),
      )
      .join(' · ');
  }

  const parts: string[] = [];

  if (ev.kind === 'sub') {
    if (primary) parts.push(`${primary} on`);
    if (related) parts.push(`${related} off`);
  } else if (ev.kind === 'offside') {
    if (primary) parts.push(`Offside by ${primary}`);
  } else if (ev.kind === 'var') {
    if (primary) parts.push(`Involving ${primary}`);
    if (related && relatedRoleIsAgainst(ev)) parts.push(`against ${related}`);
    if (text) parts.push(text);
  } else if (ev.kind === 'corner' || ev.kind === 'freekick') {
    // Taker name only — UI shows flag + time; event type is implied by the filter/icon.
    if (primary) parts.push(primary);
    if (ev.relatedRole === 'fouled' && related) parts.push(`Foul on ${related}`);
  } else if (ev.action === 'penalty' || /penalt/i.test(ev.label)) {
    if (primary) parts.push(primary);
    if (text && !/^taken by/i.test(text)) parts.push(text);
  } else if (ev.kind === 'card') {
    if (primary) parts.push(primary);
    if (text && !/sent off/i.test(text)) parts.push(text);
    else if (text) parts.push(text);
  } else if (ev.kind === 'goal') {
    if (primary) parts.push(primary);
    if (text) parts.push(text);
  } else {
    if (primary) parts.push(primary);
    if (text && text !== primary) parts.push(text);
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const uniq = parts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    ...ev,
    playerName,
    relatedPlayerName,
    detail: uniq.length ? uniq.join(' · ') : null,
  };
}

function relatedRoleIsAgainst(ev: MatchEvent): boolean {
  return ev.relatedRole === 'against' || ev.relatedRole === 'fouled';
}

/**
 * Collapse duplicate / phantom goal events so the Goals filter matches the scoreboard.
 * Prefers timed goals with a player; drops untimed fillers when the score is already covered.
 */
export function sanitizeTimelineEvents(
  events: MatchEvent[],
  score: Pick<LiveScoreState, 'homeGoals' | 'awayGoals'>,
): MatchEvent[] {
  const expected = Math.max(0, (score.homeGoals ?? 0) + (score.awayGoals ?? 0));
  const withoutAwardNoise = events.filter((e) => {
    if (!/penalty awarded/i.test(e.label)) return true;
    // Drop award pings when a real penalty result exists nearby for the same side.
    return !events.some((other) => {
      if (other.id === e.id) return false;
      const isResult =
        other.action === 'penalty' &&
        (other.kind === 'goal' || /miss|shootout/i.test(other.label));
      if (!isResult) return false;
      if (e.team && other.team && e.team !== other.team) return false;
      if (e.clockSeconds == null || other.clockSeconds == null) return true;
      return Math.abs(other.clockSeconds - e.clockSeconds) <= 5 * 60;
    });
  });

  const nonGoals = withoutAwardNoise.filter((e) => e.kind !== 'goal');
  const goals = withoutAwardNoise.filter((e) => e.kind === 'goal');
  if (!goals.length) {
    return withoutAwardNoise;
  }

  const quality = (e: MatchEvent) => {
    let s = 0;
    if (e.minute) s += 4;
    if (e.clockSeconds != null) s += 4;
    if (e.playerName) s += 2;
    if (e.playerId) s += 1;
    if (e.team) s += 1;
    return s;
  };

  // Dedupe near-identical goals (same side + clock ±2s, or same player + minute).
  const ranked = [...goals].sort((a, b) => quality(b) - quality(a) || a.seq - b.seq);
  const kept: MatchEvent[] = [];
  for (const g of ranked) {
    const dup = kept.some((k) => {
      if (g.team && k.team && g.team !== k.team) return false;
      if (
        g.clockSeconds != null &&
        k.clockSeconds != null &&
        Math.abs(g.clockSeconds - k.clockSeconds) <= 2
      ) {
        return true;
      }
      if (g.minute && k.minute && g.minute === k.minute && g.team === k.team) return true;
      if (
        g.playerId &&
        k.playerId &&
        g.playerId === k.playerId &&
        g.minute &&
        k.minute &&
        g.minute === k.minute
      ) {
        return true;
      }
      // Untimed duplicates for the same scorer
      if (
        !g.minute &&
        !k.minute &&
        g.playerId &&
        k.playerId &&
        g.playerId === k.playerId
      ) {
        return true;
      }
      return false;
    });
    if (!dup) kept.push(g);
  }

  let goalsOut = kept;
  if (expected === 0) {
    // Scoreboard has no goals — drop every goal event (phantoms from bad flags).
    goalsOut = [];
  } else if (kept.length > expected) {
    const timed = kept.filter((g) => g.minute || g.clockSeconds != null);
    const untimed = kept.filter((g) => !g.minute && g.clockSeconds == null);
    if (timed.length >= expected) {
      goalsOut = timed
        .sort(
          (a, b) =>
            (a.clockSeconds ?? 0) - (b.clockSeconds ?? 0) || quality(b) - quality(a),
        )
        .slice(0, expected);
    } else {
      goalsOut = [
        ...timed,
        ...untimed
          .sort((a, b) => quality(b) - quality(a))
          .slice(0, expected - timed.length),
      ];
    }
  }

  const merged = [...nonGoals, ...goalsOut];
  merged.sort((a, b) => {
    const sa = a.clockSeconds ?? (a.seq || 0);
    const sb = b.clockSeconds ?? (b.seq || 0);
    if (sa !== sb) return sa - sb;
    return a.ts - b.ts;
  });
  return merged;
}

/** Build score + full timeline from a historical/snapshot record array. */
export function buildMatchFromRecords(records: Record<string, unknown>[]): {
  score: LiveScoreState;
  events: MatchEvent[];
  hasData: boolean;
} {
  if (!records.length) {
    return { score: EMPTY_SCORE, events: [], hasData: false };
  }
  const sorted = [...records].sort(
    (a, b) => (num(a.Seq ?? a.seq) ?? 0) - (num(b.Seq ?? b.seq) ?? 0),
  );

  // Lineups may arrive as a single early record — index names before the timeline.
  const directory = extractPlayerDirectory(sorted);

  let score: LiveScoreState = { ...EMPTY_SCORE, playerDirectory: directory };
  const events: MatchEvent[] = [];
  const seen = new Set<string>();

  for (const raw of sorted) {
    const { score: next, events: additions } = parseScoreRecord(raw, score);
    score = next;
    for (const ev of additions) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      events.push(ev);
    }
  }

  // Ensure directory is complete even if lineups parsed late.
  score = {
    ...score,
    playerDirectory: { ...directory, ...score.playerDirectory },
    players: score.players.map((p) => ({
      ...p,
      name: p.name ?? resolvePlayerName(p.playerId, { ...directory, ...score.playerDirectory }),
    })),
  };
  const dir = score.playerDirectory;

  // Only backfill from PlayerStats when the feed has zero goal/card timeline rows
  // but the scoreboard / player bag clearly has them (sparse snapshot).
  const timedGoals = events.filter((e) => e.kind === 'goal' && e.minute).length;
  const timedCards = events.filter((e) => e.kind === 'card' && e.minute).length;
  const scoreGoals = score.homeGoals + score.awayGoals;
  const playerGoals = score.players.reduce((n, p) => n + p.goals, 0);
  const playerCards = score.players.reduce(
    (n, p) => n + p.yellowCards + p.redCards,
    0,
  );
  if (
    (timedGoals === 0 && scoreGoals > 0 && playerGoals > 0) ||
    (timedCards === 0 && playerCards > 0)
  ) {
    const haveGoalPlayers = new Set(
      events.filter((e) => e.kind === 'goal' && e.playerId).map((e) => e.playerId),
    );
    const haveCardPlayers = new Set(
      events.filter((e) => e.kind === 'card' && e.playerId).map((e) => e.playerId),
    );
    for (const p of score.players) {
      const pname = p.name ?? resolvePlayerName(p.playerId, dir);
      if (
        timedGoals === 0 &&
        scoreGoals > 0 &&
        p.goals > 0 &&
        !haveGoalPlayers.has(p.playerId)
      ) {
        for (let i = 0; i < p.goals; i++) {
          events.push({
            id: `ps-goal-${p.team}-${p.playerId}-${i}`,
            kind: 'goal',
            team: p.team,
            label: `Goal — ${p.team}`,
            detail: null,
            minute: null,
            clockSeconds: null,
            playerId: p.playerId,
            playerName: pname,
            relatedPlayerId: null,
            relatedPlayerName: null,
            relatedRole: null,
            action: 'goal',
            ts: 0,
            seq: 0,
          });
        }
      }
      if (timedCards === 0 && p.yellowCards > 0 && !haveCardPlayers.has(p.playerId)) {
        for (let i = 0; i < p.yellowCards; i++) {
          events.push({
            id: `ps-y-${p.team}-${p.playerId}-${i}`,
            kind: 'card',
            team: p.team,
            label: `Yellow card — ${p.team}`,
            detail: null,
            minute: null,
            clockSeconds: null,
            playerId: p.playerId,
            playerName: pname,
            relatedPlayerId: null,
            relatedPlayerName: null,
            relatedRole: null,
            action: 'yellow_card',
            ts: 0,
            seq: 0,
          });
        }
      }
      if (timedCards === 0 && p.redCards > 0) {
        for (let i = 0; i < p.redCards; i++) {
          events.push({
            id: `ps-r-${p.team}-${p.playerId}-${i}`,
            kind: 'card',
            team: p.team,
            label: `Red card — ${p.team}`,
            detail: null,
            minute: null,
            clockSeconds: null,
            playerId: p.playerId,
            playerName: pname,
            relatedPlayerId: null,
            relatedPlayerName: null,
            relatedRole: null,
            action: 'red_card',
            ts: 0,
            seq: 0,
          });
        }
      }
    }
  }

  // Resolve names on every event (lineups may have been after early score events).
  for (let i = 0; i < events.length; i++) {
    events[i] = enrichEventDetail(events[i], dir);
  }

  // Ensure both FIFA World Cup hydration breaks are represented (scheduled if not in feed).
  const hydration = ensureFifaHydrationBreaks(score.hydrationBreaks, events);
  score = { ...score, hydrationBreaks: hydration.breaks };
  for (const ev of hydration.eventsToAdd) {
    if (!events.some((e) => e.id === ev.id)) events.push(ev);
  }

  const cleaned = sanitizeTimelineEvents(events, score);

  // Prefer full pass over the feed; fall back to whatever parseScoreRecord collected.
  const fromFeed = extractTeamLineups(sorted);
  const mergedLineups = {
    home: fromFeed.home ?? score.lineups.home,
    away: fromFeed.away ?? score.lineups.away,
  };
  score = {
    ...score,
    lineups: enrichLineupsWithMatchData(mergedLineups, cleaned, score.players),
  };

  const hasData =
    (score.statusId != null && score.statusId > 1) ||
    score.finalised ||
    Object.values(score.stats).some((n) => n > 0) ||
    cleaned.some((e) => e.kind === 'goal' || e.kind === 'card' || e.kind === 'period') ||
    Boolean(score.lineups.home || score.lineups.away);

  return { score, events: cleaned, hasData };
}

/** Fill in scheduled FIFA hydration breaks when the feed omitted them. */
function ensureFifaHydrationBreaks(
  existing: HydrationBreak[],
  events: MatchEvent[],
): { breaks: HydrationBreak[]; eventsToAdd: MatchEvent[] } {
  const breaks: HydrationBreak[] = [...existing];
  const eventsToAdd: MatchEvent[] = [];

  for (const window of FIFA_HYDRATION_WINDOWS) {
    const observed =
      breaks.find((b) => b.half === window.half && b.observed) ||
      events.find(
        (e) =>
          e.kind === 'hydration' &&
          e.clockSeconds != null &&
          e.clockSeconds >= window.minSec &&
          e.clockSeconds <= window.maxSec,
      );

    if (observed && !('observed' in observed && (observed as HydrationBreak).observed === false)) {
      if (!breaks.some((b) => b.half === window.half)) {
        breaks.push({
          half: window.half,
          minute: window.minuteLabel,
          durationMin: FIFA_HYDRATION_DURATION_MIN,
          observed: true,
          clockSeconds: window.half === 1 ? 22 * 60 : 67 * 60,
        });
      }
      continue;
    }

    if (!breaks.some((b) => b.half === window.half)) {
      breaks.push({
        half: window.half,
        minute: window.minuteLabel,
        durationMin: FIFA_HYDRATION_DURATION_MIN,
        observed: false,
        clockSeconds: window.half === 1 ? 22 * 60 : 67 * 60,
      });
    }

    const id = `fifa-hydration-h${window.half}`;
    if (!events.some((e) => e.id === id || e.kind === 'hydration' && e.minute === window.minuteLabel)) {
      eventsToAdd.push({
        id,
        kind: 'hydration',
        team: null,
        label: 'Hydration break',
        detail: hydrationBreakDetail(FIFA_HYDRATION_DURATION_MIN, window.half),
        minute: window.minuteLabel,
        clockSeconds: window.half === 1 ? 22 * 60 : 67 * 60,
        playerId: null,
        playerName: null,
        relatedPlayerId: null,
        relatedPlayerName: null,
        relatedRole: null,
        action: 'hydration',
        ts: 0,
        seq: window.half === 1 ? 220 : 670,
      });
    }
  }

  breaks.sort((a, b) => a.half - b.half);
  return { breaks, eventsToAdd };
}

export type StatRow = {
  key: string;
  label: string;
  icon: string;
  home: number;
  away: number;
};

export type StatGroup = {
  id: string;
  title: string;
  rows: StatRow[];
};

/** Grouped, plain-language stats for the match centre UI. */
export function statGroups(stats: MatchStats): StatGroup[] {
  const groups: StatGroup[] = [
    {
      id: 'score',
      title: 'Score & cards',
      rows: [
        { key: 'goals', label: 'Goals', icon: '⚽', home: stats.homeGoals, away: stats.awayGoals },
        {
          key: 'yellows',
          label: 'Yellow cards',
          icon: 'yellow',
          home: stats.homeYellows,
          away: stats.awayYellows,
        },
        { key: 'reds', label: 'Red cards', icon: 'red', home: stats.homeReds, away: stats.awayReds },
      ],
    },
    {
      id: 'attack',
      title: 'Attacking',
      rows: [
        {
          key: 'sot',
          label: 'Shots on target',
          icon: '🎯',
          home: stats.homeShotsOnTarget,
          away: stats.awayShotsOnTarget,
        },
        {
          key: 'corners',
          label: 'Corners',
          icon: '🚩',
          home: stats.homeCorners,
          away: stats.awayCorners,
        },
        {
          key: 'freeKicks',
          label: 'Free kicks',
          icon: '🦵',
          home: stats.homeFreeKicks,
          away: stats.awayFreeKicks,
        },
      ],
    },
    {
      id: 'discipline',
      title: 'Fouls & offsides',
      rows: [
        {
          key: 'fouls',
          label: 'Fouls won',
          icon: '⚠️',
          home: stats.homeFouls,
          away: stats.awayFouls,
        },
        {
          key: 'offsides',
          label: 'Offsides',
          icon: '🚫',
          home: stats.homeOffsides,
          away: stats.awayOffsides,
        },
      ],
    },
    {
      id: 'restart',
      title: 'Restarts',
      rows: [
        {
          key: 'throwIns',
          label: 'Throw-ins',
          icon: '↪️',
          home: stats.homeThrowIns,
          away: stats.awayThrowIns,
        },
        {
          key: 'goalKicks',
          label: 'Goal kicks',
          icon: '🥅',
          home: stats.homeGoalKicks,
          away: stats.awayGoalKicks,
        },
      ],
    },
    {
      id: 'h1',
      title: 'First half',
      rows: [
        {
          key: 'goalsH1',
          label: 'Goals',
          icon: '⚽',
          home: stats.homeGoalsH1,
          away: stats.awayGoalsH1,
        },
        {
          key: 'cornersH1',
          label: 'Corners',
          icon: '🚩',
          home: stats.homeCornersH1,
          away: stats.awayCornersH1,
        },
        {
          key: 'yellowsH1',
          label: 'Yellow cards',
          icon: 'yellow',
          home: stats.homeYellowsH1,
          away: stats.awayYellowsH1,
        },
      ],
    },
    {
      id: 'h2',
      title: 'Second half',
      rows: [
        {
          key: 'goalsH2',
          label: 'Goals',
          icon: '⚽',
          home: stats.homeGoalsH2,
          away: stats.awayGoalsH2,
        },
        {
          key: 'cornersH2',
          label: 'Corners',
          icon: '🚩',
          home: stats.homeCornersH2,
          away: stats.awayCornersH2,
        },
        {
          key: 'yellowsH2',
          label: 'Yellow cards',
          icon: 'yellow',
          home: stats.homeYellowsH2,
          away: stats.awayYellowsH2,
        },
      ],
    },
  ];

  // VAR is match-level — show as home/away same count on both for bar, or special row.
  groups.splice(3, 0, {
    id: 'officials',
    title: 'Officials',
    rows: [
      {
        key: 'var',
        label: 'VAR checks',
        icon: '📺',
        home: stats.varChecks,
        away: stats.varChecks,
      },
    ],
  });

  if (stats.homeGoalsEt || stats.awayGoalsEt || stats.homePens || stats.awayPens) {
    const extra: StatRow[] = [];
    if (stats.homeGoalsEt || stats.awayGoalsEt) {
      extra.push({
        key: 'et',
        label: 'Extra-time goals',
        icon: '⏱',
        home: stats.homeGoalsEt,
        away: stats.awayGoalsEt,
      });
    }
    if (stats.homePens || stats.awayPens) {
      extra.push({
        key: 'pens',
        label: 'Penalty shootout',
        icon: '🥅',
        home: stats.homePens,
        away: stats.awayPens,
      });
    }
    groups.push({ id: 'extra', title: 'Extra time', rows: extra });
  }
  return groups;
}

/** Flat list kept for callers that only need totals. */
export function statRows(stats: MatchStats): StatRow[] {
  return statGroups(stats).flatMap((g) => g.rows);
}

/** Official half slice from TxLINE nested Score / Stats map (not event tallies). */
export type OfficialHalfSlice = {
  homeGoals: number;
  awayGoals: number;
  homeCorners: number;
  awayCorners: number;
  homeYellows: number;
  awayYellows: number;
  homeReds: number;
  awayReds: number;
};

function halfHasSignal(h: OfficialHalfSlice): boolean {
  return (
    h.homeGoals +
      h.awayGoals +
      h.homeCorners +
      h.awayCorners +
      h.homeYellows +
      h.awayYellows +
      h.homeReds +
      h.awayReds >
    0
  );
}

function deriveSecondHalf(
  total: OfficialHalfSlice,
  h1: OfficialHalfSlice,
): OfficialHalfSlice {
  return {
    homeGoals: Math.max(0, total.homeGoals - h1.homeGoals),
    awayGoals: Math.max(0, total.awayGoals - h1.awayGoals),
    homeCorners: Math.max(0, total.homeCorners - h1.homeCorners),
    awayCorners: Math.max(0, total.awayCorners - h1.awayCorners),
    homeYellows: Math.max(0, total.homeYellows - h1.homeYellows),
    awayYellows: Math.max(0, total.awayYellows - h1.awayYellows),
    homeReds: Math.max(0, total.homeReds - h1.homeReds),
    awayReds: Math.max(0, total.awayReds - h1.awayReds),
  };
}

/**
 * First / second half from the official Score feed only.
 * Prefers nested H1/H2; derives H2 from totals − H1 when H2 is missing.
 * Does not use action tallies (throw-ins, SOT, etc.) — those are incomplete.
 */
export function officialHalfStats(score: LiveScoreState): {
  h1: OfficialHalfSlice;
  h2: OfficialHalfSlice;
} {
  const s = score.stats;
  const fromPeriod = (p: PeriodScore): OfficialHalfSlice => ({
    homeGoals: p.homeGoals,
    awayGoals: p.awayGoals,
    homeCorners: p.homeCorners,
    awayCorners: p.awayCorners,
    homeYellows: p.homeYellows,
    awayYellows: p.awayYellows,
    homeReds: p.homeReds,
    awayReds: p.awayReds,
  });

  const h1FromStats: OfficialHalfSlice = {
    homeGoals: s.homeGoalsH1,
    awayGoals: s.awayGoalsH1,
    homeCorners: s.homeCornersH1,
    awayCorners: s.awayCornersH1,
    homeYellows: s.homeYellowsH1,
    awayYellows: s.awayYellowsH1,
    homeReds: 0,
    awayReds: 0,
  };
  const h2FromStats: OfficialHalfSlice = {
    homeGoals: s.homeGoalsH2,
    awayGoals: s.awayGoalsH2,
    homeCorners: s.homeCornersH2,
    awayCorners: s.awayCornersH2,
    homeYellows: s.homeYellowsH2,
    awayYellows: s.awayYellowsH2,
    homeReds: 0,
    awayReds: 0,
  };

  const h1Period = fromPeriod(score.h1);
  const h2Period = fromPeriod(score.h2);
  // HT is the score at the break — same as H1 when present.
  const htPeriod = fromPeriod(score.ht);

  const h1 = halfHasSignal(h1Period)
    ? h1Period
    : halfHasSignal(htPeriod)
      ? htPeriod
      : h1FromStats;

  let h2 = halfHasSignal(h2Period) ? h2Period : h2FromStats;

  const total: OfficialHalfSlice = {
    homeGoals: score.homeGoals || s.homeGoals,
    awayGoals: score.awayGoals || s.awayGoals,
    homeCorners: s.homeCorners,
    awayCorners: s.awayCorners,
    homeYellows: s.homeYellows,
    awayYellows: s.awayYellows,
    homeReds: s.homeReds,
    awayReds: s.awayReds,
  };

  if (!halfHasSignal(h2) && halfHasSignal(total) && halfHasSignal(h1)) {
    h2 = deriveSecondHalf(total, h1);
  }

  return { h1, h2 };
}

export function eventIcon(kind: MatchEventKind, action?: string | null): string {
  if (kind === 'goal') return '⚽';
  if (kind === 'card') {
    if (action === 'red_card' || action === 'second_yellow') return '🟥';
    return '🟨';
  }
  if (kind === 'corner') return '🚩';
  if (kind === 'shot') return '🎯';
  if (kind === 'sub') return '🔄';
  if (kind === 'period') return '⏱';
  if (kind === 'freekick' || kind === 'foul') return '🦵';
  if (kind === 'offside') return '🚫';
  if (kind === 'var') return '📺';
  if (kind === 'hydration') return '💧';
  return '•';
}
