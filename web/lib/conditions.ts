export const TEMPLATE_BTTS = 0;
export const TEMPLATE_TEAM_WINS = 1;
export const TEMPLATE_DRAW = 2;
export const TEMPLATE_TEAM_SCORES_AT_LEAST = 3;
export const TEMPLATE_TOTAL_GOALS_AT_LEAST = 4;
export const TEMPLATE_WINS_BY_AT_LEAST = 5;
export const TEMPLATE_WINS_ON_PENS = 6;
export const TEMPLATE_GOES_TO_PENS = 7;

export const GOALS_DISCLOSURE =
  'Full-time goals include extra time. Penalty shootout goals are separate — use a penalties condition for those.';

export const SHOOTOUT_DISCLOSURE =
  'Wins on goals. Extra time counts. Turn on “Include penalties” to settle on the shootout instead.';

export const PENS_DISCLOSURE =
  'Uses shootout goals only (stat keys 6001/6002). Full-time and ET goals do not count.';

/** Pack team (0|1) and threshold N into condition_param. */
export function packTeamThreshold(team: number, n: number): number {
  return team * 256 + n;
}

export function unpackTeamThreshold(param: number): { team: number; n: number } {
  const team = Math.floor(Number(param) / 256);
  const n = Number(param) % 256;
  return { team, n };
}

export type ConditionOption = {
  template: number;
  title: string;
  blurb: string;
  needsTeam?: boolean;
  needsThreshold?: boolean;
  minN?: number;
  maxN?: number;
  thresholdLabel?: string;
  /** Show ET / pens disclosure under the option */
  disclosure?: 'goals' | 'pens';
};

export const CONDITION_OPTIONS: ConditionOption[] = [
  {
    template: TEMPLATE_BTTS,
    title: 'Both teams score',
    blurb: 'Each side scores at least once (ET goals count).',
    disclosure: 'goals',
  },
  {
    template: TEMPLATE_TEAM_WINS,
    title: 'Team wins (full time)',
    blurb: 'Chosen side wins on goals after full time (ET counts). Toggle penalties below if you want the shootout instead.',
    needsTeam: true,
    disclosure: 'goals',
  },
  {
    template: TEMPLATE_DRAW,
    title: 'Draw (full time)',
    blurb: 'Level on goals after full time including ET. Pens are a separate condition.',
    disclosure: 'goals',
  },
  {
    template: TEMPLATE_GOES_TO_PENS,
    title: 'Goes to penalties',
    blurb: 'Match is decided by a penalty shootout (after a draw through ET).',
    disclosure: 'pens',
  },
  {
    template: TEMPLATE_TEAM_SCORES_AT_LEAST,
    title: 'Team scores ≥ N',
    blurb: 'Chosen side scores at least N goals (ET included).',
    needsTeam: true,
    needsThreshold: true,
    minN: 1,
    maxN: 8,
    thresholdLabel: 'Goals',
    disclosure: 'goals',
  },
  {
    template: TEMPLATE_TOTAL_GOALS_AT_LEAST,
    title: 'Total goals ≥ N',
    blurb: 'Combined goals reach at least N (ET included).',
    needsThreshold: true,
    minN: 1,
    maxN: 10,
    thresholdLabel: 'Total goals',
    disclosure: 'goals',
  },
  {
    template: TEMPLATE_WINS_BY_AT_LEAST,
    title: 'Wins by ≥ N',
    blurb: 'Chosen side wins by at least N goals (ET included).',
    needsTeam: true,
    needsThreshold: true,
    minN: 1,
    maxN: 5,
    thresholdLabel: 'Margin',
    disclosure: 'goals',
  },
];

/**
 * Human-readable condition label.
 */
export function conditionLabel(
  template: number,
  param: number,
  homeTeam?: string,
  awayTeam?: string,
): string {
  const home = homeTeam || 'Home team';
  const away = awayTeam || 'Away team';
  switch (template) {
    case TEMPLATE_BTTS:
      return 'Both teams score';
    case TEMPLATE_TEAM_WINS:
      return Number(param) === 0 ? `${home} wins` : `${away} wins`;
    case TEMPLATE_DRAW:
      return 'Draw (full time)';
    case TEMPLATE_TEAM_SCORES_AT_LEAST: {
      const { team, n } = unpackTeamThreshold(param);
      const side = team === 0 ? home : away;
      return `${side} scores at least ${n}`;
    }
    case TEMPLATE_TOTAL_GOALS_AT_LEAST:
      return `Total goals ≥ ${Number(param)}`;
    case TEMPLATE_WINS_BY_AT_LEAST: {
      const { team, n } = unpackTeamThreshold(param);
      const side = team === 0 ? home : away;
      return `${side} wins by ≥ ${n}`;
    }
    case TEMPLATE_WINS_ON_PENS:
      return Number(param) === 0
        ? `${home} wins on penalties`
        : `${away} wins on penalties`;
    case TEMPLATE_GOES_TO_PENS:
      return 'Goes to penalties';
    default:
      return 'Unknown condition';
  }
}

/** Build the on-chain param for the selected template + UI controls. */
export function buildConditionParam(
  template: number,
  team: number,
  threshold: number,
): number {
  switch (template) {
    case TEMPLATE_TEAM_WINS:
    case TEMPLATE_WINS_ON_PENS:
      return team === 0 ? 0 : 1;
    case TEMPLATE_TEAM_SCORES_AT_LEAST:
    case TEMPLATE_WINS_BY_AT_LEAST:
      return packTeamThreshold(team, threshold);
    case TEMPLATE_TOTAL_GOALS_AT_LEAST:
      return threshold;
    default:
      return 0;
  }
}

export type LiveConditionState = 'tracking' | 'met';

/**
 * Client-side live tracking — display only.
 * Pass shootout totals for templates 6–7.
 */
export function evaluateCondition(
  template: number,
  param: number,
  homeGoals: number,
  awayGoals: number,
  homePens = 0,
  awayPens = 0,
): LiveConditionState {
  switch (template) {
    case TEMPLATE_BTTS:
      return homeGoals > 0 && awayGoals > 0 ? 'met' : 'tracking';
    case TEMPLATE_TEAM_WINS: {
      const diff = param === 0 ? homeGoals - awayGoals : awayGoals - homeGoals;
      return diff > 0 ? 'met' : 'tracking';
    }
    case TEMPLATE_DRAW:
      return homeGoals === awayGoals ? 'met' : 'tracking';
    case TEMPLATE_TEAM_SCORES_AT_LEAST: {
      const { team, n } = unpackTeamThreshold(param);
      const goals = team === 0 ? homeGoals : awayGoals;
      return goals >= n ? 'met' : 'tracking';
    }
    case TEMPLATE_TOTAL_GOALS_AT_LEAST:
      return homeGoals + awayGoals >= Number(param) ? 'met' : 'tracking';
    case TEMPLATE_WINS_BY_AT_LEAST: {
      const { team, n } = unpackTeamThreshold(param);
      const diff = team === 0 ? homeGoals - awayGoals : awayGoals - homeGoals;
      return diff >= n ? 'met' : 'tracking';
    }
    case TEMPLATE_WINS_ON_PENS: {
      const diff = param === 0 ? homePens - awayPens : awayPens - homePens;
      return diff > 0 ? 'met' : 'tracking';
    }
    case TEMPLATE_GOES_TO_PENS:
      return homePens + awayPens > 0 ? 'met' : 'tracking';
    default:
      return 'tracking';
  }
}

/** Plain-language status line for the in-play card. */
export function conditionStatusText(
  template: number,
  param: number,
  homeGoals: number,
  awayGoals: number,
  homeTeam?: string,
  awayTeam?: string,
  homePens = 0,
  awayPens = 0,
): string {
  const home = homeTeam ?? 'Home';
  const away = awayTeam ?? 'Away';
  if (template === TEMPLATE_BTTS) {
    if (homeGoals > 0 && awayGoals > 0) return 'Both teams have scored ✓';
    if (homeGoals > 0) return `${home} has scored — ${away} yet to score`;
    if (awayGoals > 0) return `${away} has scored — ${home} yet to score`;
    return 'Both teams yet to score';
  }
  if (template === TEMPLATE_TEAM_WINS) {
    const team = param === 0 ? home : away;
    const diff = param === 0 ? homeGoals - awayGoals : awayGoals - homeGoals;
    if (diff > 0) return `${team} is winning ✓`;
    if (diff === 0) return `Level — ${team} needs a goal (pens do not count)`;
    return `${team} is behind by ${-diff}`;
  }
  if (template === TEMPLATE_DRAW) {
    if (homeGoals === awayGoals) return 'Scores level ✓ (pens separate)';
    return `Not level — ${homeGoals}–${awayGoals}`;
  }
  if (template === TEMPLATE_TEAM_SCORES_AT_LEAST) {
    const { team, n } = unpackTeamThreshold(param);
    const side = team === 0 ? home : away;
    const goals = team === 0 ? homeGoals : awayGoals;
    if (goals >= n) return `${side} has ${goals} — target ${n} ✓`;
    return `${side} has ${goals} — need ${n}`;
  }
  if (template === TEMPLATE_TOTAL_GOALS_AT_LEAST) {
    const total = homeGoals + awayGoals;
    const n = Number(param);
    if (total >= n) return `${total} goals — target ${n} ✓`;
    return `${total} goals — need ${n}`;
  }
  if (template === TEMPLATE_WINS_BY_AT_LEAST) {
    const { team, n } = unpackTeamThreshold(param);
    const side = team === 0 ? home : away;
    const diff = team === 0 ? homeGoals - awayGoals : awayGoals - homeGoals;
    if (diff >= n) return `${side} ahead by ${diff} — margin ${n} ✓`;
    if (diff > 0) return `${side} ahead by ${diff} — need ${n}`;
    if (diff === 0) return `Level — ${side} needs a ${n}-goal cushion`;
    return `${side} behind — need ${n}-goal win`;
  }
  if (template === TEMPLATE_WINS_ON_PENS) {
    const team = param === 0 ? home : away;
    if (homePens + awayPens === 0) return 'Waiting for penalty shootout';
    const diff = param === 0 ? homePens - awayPens : awayPens - homePens;
    if (diff > 0) return `${team} leads on pens ${homePens}–${awayPens} ✓`;
    if (diff === 0) return `Pens level ${homePens}–${awayPens}`;
    return `${team} behind on pens ${homePens}–${awayPens}`;
  }
  if (template === TEMPLATE_GOES_TO_PENS) {
    if (homePens + awayPens > 0) return `Shootout underway ${homePens}–${awayPens} ✓`;
    return 'Waiting for penalty shootout';
  }
  return 'Tracking condition';
}
