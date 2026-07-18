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
  type: string; // 'resolved' | ...
  conditionMet?: boolean;
  txSig?: string;
  commitment?: Partial<BoardCommitment> & { pubkey?: string };
  receivedAt: number;
}

/** Normalised live-score state derived from the keeper score proxy. */
export interface LiveScoreState {
  homeGoals: number;
  awayGoals: number;
  minute: string | null;
  period: string | null;
  finalised: boolean;
}

export interface MatchEvent {
  id: string;
  kind: 'goal' | 'card' | 'info';
  team: 'home' | 'away' | null;
  label: string;
  minute: string | null;
  ts: number;
}
