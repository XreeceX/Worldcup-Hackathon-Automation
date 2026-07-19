export type CommitmentStatus =
  | 'Open'
  | 'Executed'
  | 'Refunded'
  | 'Void'
  | 'Closed';

/** Row shape served by the indexer board / commitment endpoints (camelised). */
export interface BoardCommitment {
  pubkey: string;
  fixtureId: number;
  kickoffTs: number; // Unix ms
  conditionTemplate: number;
  conditionParam: number;
  conditionLabel?: string;
  beneficiary: string;
  founder: string;
  name: string;
  status: CommitmentStatus;
  memberCount: number;
  totalLamports: number;
  createdAt?: string;
  resolvedAt?: string | null;
  settlementTx?: string | null;
  members?: CommitmentMember[];
  homeTeam?: string;
  awayTeam?: string;
  competition?: string;
}

export interface CommitmentMember {
  wallet: string;
  depositLamports: number;
  withdrawn: boolean;
  claimed: boolean;
  joinedAt?: string;
}

export interface Fixture {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffTs: number; // Unix ms
  gameState: number;
  status?: string;
  /** world_cup | other (friendlies / leagues) */
  competitionKind?: 'world_cup' | 'other';
  /** WC stage key when known from TxLINE schedule catalog */
  stage?: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final' | null;
  stageLabel?: string | null;
  /** Tournament year when known */
  year?: number | null;
}

export interface ClaimRow {
  commitmentPubkey: string;
  wallet: string;
  depositLamports: number;
  name?: string;
  conditionLabel?: string;
  status?: CommitmentStatus;
  fixtureId?: number;
  homeTeam?: string;
  awayTeam?: string;
}

/** Event emitted on the keeper /api/feed SSE stream. */
export interface FeedEvent {
  type: string; // 'resolved' | 'voided' | ...
  conditionMet?: boolean;
  txSig?: string;
  fixtureId?: number;
  status?: CommitmentStatus;
  commitment?: Partial<BoardCommitment> & { pubkey?: string };
  receivedAt: number;
}

/** Side-by-side match stats from TxLINE (totals + period splits). */
export interface MatchStats {
  homeGoals: number;
  awayGoals: number;
  homeYellows: number;
  awayYellows: number;
  homeReds: number;
  awayReds: number;
  homeCorners: number;
  awayCorners: number;
  homeGoalsH1: number;
  awayGoalsH1: number;
  homeCornersH1: number;
  awayCornersH1: number;
  homeYellowsH1: number;
  awayYellowsH1: number;
  homeGoalsH2: number;
  awayGoalsH2: number;
  homeCornersH2: number;
  awayCornersH2: number;
  homeYellowsH2: number;
  awayYellowsH2: number;
  homeGoalsEt: number;
  awayGoalsEt: number;
  homePens: number;
  awayPens: number;
  /** Tallied from TxLINE score actions (not always in Stats map). */
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeFreeKicks: number;
  awayFreeKicks: number;
  homeOffsides: number;
  awayOffsides: number;
  /** Free kicks won that are not offsides — closest foul proxy in the feed. */
  homeFouls: number;
  awayFouls: number;
  homeThrowIns: number;
  awayThrowIns: number;
  homeGoalKicks: number;
  awayGoalKicks: number;
  /** Match-level VAR checks (PossibleEvent / VAR flag). */
  varChecks: number;
}

export interface PeriodScore {
  homeGoals: number;
  awayGoals: number;
  homeYellows: number;
  awayYellows: number;
  homeReds: number;
  awayReds: number;
  homeCorners: number;
  awayCorners: number;
}

export interface PlayerContribution {
  playerId: string;
  name: string | null;
  team: 'home' | 'away';
  goals: number;
  yellowCards: number;
  redCards: number;
}

/** Player id → display name from TxLINE lineups. */
export type PlayerDirectory = Record<string, { name: string; shirt: string | null }>;

export type LineupBand = 'gk' | 'def' | 'mid' | 'fwd';

export interface LineupPlayer {
  playerId: string;
  name: string;
  shirt: string | null;
  band: LineupBand;
  positionId: number;
  starter: boolean;
  goals: number;
  yellowCards: number;
  redCards: number;
  subbedOff: boolean;
  subbedOn: boolean;
}

export interface TeamLineup {
  teamName: string;
  /** e.g. 4-3-3 from starter counts (excluding GK). */
  formation: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  /** Head coach when known (feed rarely includes staff). */
  coach: string | null;
}

/** Normalised live-score state derived from the keeper score proxy. */
export interface LiveScoreState {
  homeGoals: number;
  awayGoals: number;
  minute: string | null;
  clockSeconds: number | null;
  period: string | null;
  finalised: boolean;
  stats: MatchStats;
  h1: PeriodScore;
  h2: PeriodScore;
  ht: PeriodScore;
  gameState: string | null;
  statusId: number | null;
  coverage: string | null;
  venue: string | null;
  weather: string | null;
  pitch: string | null;
  /** Latest added-time announcement (current period). */
  addedTime: number | null;
  /** FIFA stoppage announced for 1st half / 2nd half (both halves get this). */
  addedTimeH1: number | null;
  addedTimeH2: number | null;
  /** FIFA World Cup hydration breaks (~22' and ~67', 3 minutes each). */
  hydrationBreaks: HydrationBreak[];
  players: PlayerContribution[];
  playerDirectory: PlayerDirectory;
  lineups: { home: TeamLineup | null; away: TeamLineup | null };
}

/** One scheduled / observed FIFA hydration (cooling) break. */
export interface HydrationBreak {
  half: 1 | 2;
  /** FIFA-style minute when the break was taken / is scheduled. */
  minute: string;
  /** Break length in minutes (World Cup 2026 = 3). */
  durationMin: number;
  /** True when observed in the live feed; false = scheduled under FIFA rules. */
  observed: boolean;
  clockSeconds: number | null;
}

export type MatchEventKind =
  | 'goal'
  | 'card'
  | 'corner'
  | 'shot'
  | 'sub'
  | 'period'
  | 'freekick'
  | 'offside'
  | 'foul'
  | 'var'
  | 'hydration'
  | 'info';

export interface MatchEvent {
  id: string;
  kind: MatchEventKind;
  team: 'home' | 'away' | null;
  label: string;
  detail: string | null;
  /** FIFA-style clock: 23', 45+2', 90+5', HT, FT */
  minute: string | null;
  clockSeconds: number | null;
  /** Primary player (scorer, booked, taker, player on, offside player…). */
  playerId: string | null;
  playerName: string | null;
  /** Secondary player (player off, fouled, VAR subject…). */
  relatedPlayerId: string | null;
  relatedPlayerName: string | null;
  relatedRole: 'off' | 'on' | 'against' | 'fouled' | null;
  action: string | null;
  ts: number;
  seq: number;
}
