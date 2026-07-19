/**
 * World Cup 2026 stage catalog from TxLINE scores schedule
 * (https://txline-docs.txodds.com/documentation/scores/schedule).
 * Used to label fixtures when the API only returns competition name.
 */

export type WcStage =
  | 'group'
  | 'r32'
  | 'r16'
  | 'qf'
  | 'sf'
  | 'third'
  | 'final';

export type CompetitionKind = 'world_cup' | 'other';

/** Knockout-only — group stage is excluded from the product UI (too many matches). */
export const WC_STAGE_ORDER: WcStage[] = [
  'r32',
  'r16',
  'qf',
  'sf',
  'third',
  'final',
];

export function isKnockoutStage(stage: WcStage | null | undefined): boolean {
  return stage != null && stage !== 'group';
}

export const WC_STAGE_LABEL: Record<WcStage, string> = {
  group: 'Group stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  third: '3rd place',
  final: 'Final',
};

type ScheduleEntry = {
  stage: WcStage;
  homeTeam: string;
  awayTeam: string;
  /** ISO UTC kickoff */
  kickoffIso: string;
};

/** fixtureId → schedule metadata */
export const WC_2026_SCHEDULE: Record<number, ScheduleEntry> = {
  // Group stage
  17588325: { stage: 'group', homeTeam: 'Jordan', awayTeam: 'Argentina', kickoffIso: '2026-06-28T02:00:00.000Z' },
  17588326: { stage: 'group', homeTeam: 'Algeria', awayTeam: 'Austria', kickoffIso: '2026-06-28T02:00:00.000Z' },

  // Round of 32
  18167317: { stage: 'r32', homeTeam: 'South Africa', awayTeam: 'Canada', kickoffIso: '2026-06-28T19:00:00.000Z' },
  18172489: { stage: 'r32', homeTeam: 'Brazil', awayTeam: 'Japan', kickoffIso: '2026-06-29T17:00:00.000Z' },
  18175983: { stage: 'r32', homeTeam: 'Germany', awayTeam: 'Paraguay', kickoffIso: '2026-06-29T20:30:00.000Z' },
  18172260: { stage: 'r32', homeTeam: 'Netherlands', awayTeam: 'Morocco', kickoffIso: '2026-06-30T01:00:00.000Z' },
  18175397: { stage: 'r32', homeTeam: 'Ivory Coast', awayTeam: 'Norway', kickoffIso: '2026-06-30T17:00:00.000Z' },
  18175981: { stage: 'r32', homeTeam: 'France', awayTeam: 'Sweden', kickoffIso: '2026-06-30T21:00:00.000Z' },
  18179759: { stage: 'r32', homeTeam: 'Mexico', awayTeam: 'Ecuador', kickoffIso: '2026-07-01T01:00:00.000Z' },
  18179764: { stage: 'r32', homeTeam: 'England', awayTeam: 'Congo DR', kickoffIso: '2026-07-01T16:00:00.000Z' },
  18179550: { stage: 'r32', homeTeam: 'Belgium', awayTeam: 'Senegal', kickoffIso: '2026-07-01T20:00:00.000Z' },
  18172379: { stage: 'r32', homeTeam: 'USA', awayTeam: 'Bosnia & Herzegovina', kickoffIso: '2026-07-02T00:00:00.000Z' },
  18179551: { stage: 'r32', homeTeam: 'Spain', awayTeam: 'Austria', kickoffIso: '2026-07-02T19:00:00.000Z' },
  18179763: { stage: 'r32', homeTeam: 'Portugal', awayTeam: 'Croatia', kickoffIso: '2026-07-02T23:00:00.000Z' },
  18179552: { stage: 'r32', homeTeam: 'Switzerland', awayTeam: 'Algeria', kickoffIso: '2026-07-03T03:00:00.000Z' },
  18176123: { stage: 'r32', homeTeam: 'Australia', awayTeam: 'Egypt', kickoffIso: '2026-07-03T18:00:00.000Z' },
  18175918: { stage: 'r32', homeTeam: 'Argentina', awayTeam: 'Cape Verde', kickoffIso: '2026-07-03T22:00:00.000Z' },
  18179549: { stage: 'r32', homeTeam: 'Colombia', awayTeam: 'Ghana', kickoffIso: '2026-07-04T01:30:00.000Z' },

  // Round of 16 (8th Finals)
  18185036: { stage: 'r16', homeTeam: 'Canada', awayTeam: 'Morocco', kickoffIso: '2026-07-04T17:00:00.000Z' },
  18188721: { stage: 'r16', homeTeam: 'Paraguay', awayTeam: 'France', kickoffIso: '2026-07-04T21:03:00.000Z' },
  18187298: { stage: 'r16', homeTeam: 'Brazil', awayTeam: 'Norway', kickoffIso: '2026-07-05T20:00:00.000Z' },
  18192996: { stage: 'r16', homeTeam: 'Mexico', awayTeam: 'England', kickoffIso: '2026-07-06T00:00:00.000Z' },
  18198205: { stage: 'r16', homeTeam: 'Portugal', awayTeam: 'Spain', kickoffIso: '2026-07-06T19:00:00.000Z' },
  18193785: { stage: 'r16', homeTeam: 'USA', awayTeam: 'Belgium', kickoffIso: '2026-07-07T00:00:00.000Z' },
  18202701: { stage: 'r16', homeTeam: 'Argentina', awayTeam: 'Egypt', kickoffIso: '2026-07-07T16:00:00.000Z' },
  18202783: { stage: 'r16', homeTeam: 'Switzerland', awayTeam: 'Colombia', kickoffIso: '2026-07-07T20:00:00.000Z' },

  // Quarter-finals
  18209181: { stage: 'qf', homeTeam: 'France', awayTeam: 'Morocco', kickoffIso: '2026-07-09T20:00:00.000Z' },
  18218149: { stage: 'qf', homeTeam: 'Spain', awayTeam: 'Belgium', kickoffIso: '2026-07-10T19:00:00.000Z' },
  18213979: { stage: 'qf', homeTeam: 'Norway', awayTeam: 'England', kickoffIso: '2026-07-11T21:00:00.000Z' },
  18222446: { stage: 'qf', homeTeam: 'Argentina', awayTeam: 'Switzerland', kickoffIso: '2026-07-12T01:00:00.000Z' },

  // Semi-finals
  18237038: { stage: 'sf', homeTeam: 'France', awayTeam: 'Spain', kickoffIso: '2026-07-14T19:00:00.000Z' },
  18241006: { stage: 'sf', homeTeam: 'England', awayTeam: 'Argentina', kickoffIso: '2026-07-15T19:00:00.000Z' },

  // 3rd place + Final
  18257865: { stage: 'third', homeTeam: 'France', awayTeam: 'England', kickoffIso: '2026-07-18T21:00:00.000Z' },
  18257739: { stage: 'final', homeTeam: 'Spain', awayTeam: 'Argentina', kickoffIso: '2026-07-19T19:00:00.000Z' },
};

export function competitionKind(competition: string | null | undefined): CompetitionKind {
  const c = (competition ?? '').toLowerCase();
  if (!c || c.includes('world cup') || c === 'wc') return 'world_cup';
  // Free tier also serves international friendlies
  return 'other';
}

export function stageForFixtureId(fixtureId: number): WcStage | null {
  return WC_2026_SCHEDULE[fixtureId]?.stage ?? null;
}

export function enrichFixtureMeta(fixture: {
  fixtureId: number;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTs: number;
}): {
  kind: CompetitionKind;
  stage: WcStage | null;
  stageLabel: string | null;
  year: number | null;
} {
  const catalog = WC_2026_SCHEDULE[fixture.fixtureId];
  const kind =
    catalog || competitionKind(fixture.competition) === 'world_cup'
      ? 'world_cup'
      : competitionKind(fixture.competition);
  const stage = catalog?.stage ?? null;
  const year = catalog
    ? 2026
    : fixture.kickoffTs
      ? new Date(fixture.kickoffTs).getUTCFullYear()
      : null;
  return {
    kind,
    stage,
    stageLabel: stage ? WC_STAGE_LABEL[stage] : kind === 'world_cup' ? 'World Cup' : null,
    year,
  };
}

/** Merge indexer fixtures with knockout WC schedule entries missing from the index. */
export function mergeWithWcSchedule<T extends {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffTs: number;
  gameState: number;
  status?: string;
}>(fixtures: T[]): T[] {
  const byId = new Map(fixtures.map((f) => [f.fixtureId, f]));
  for (const [idStr, entry] of Object.entries(WC_2026_SCHEDULE)) {
    if (!isKnockoutStage(entry.stage)) continue;
    const id = Number(idStr);
    if (byId.has(id)) continue;
    byId.set(id, {
      fixtureId: id,
      homeTeam: entry.homeTeam,
      awayTeam: entry.awayTeam,
      competition: 'World Cup',
      kickoffTs: Date.parse(entry.kickoffIso),
      gameState: 0,
      status: Date.parse(entry.kickoffIso) > Date.now() ? 'upcoming' : 'finished',
    } as T);
  }
  return Array.from(byId.values());
}
