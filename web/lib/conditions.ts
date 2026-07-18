export const TEMPLATE_BTTS = 0;
export const TEMPLATE_TEAM_WINS = 1;

export const SHOOTOUT_DISCLOSURE =
  'Wins on goals. Extra time counts. A draw settled by penalty shootout does not satisfy this condition.';

/**
 * Human-readable condition label (design-01 §5).
 * Template 0 = Both teams score; template 1 = Team wins (param 0 home / 1 away).
 */
export function conditionLabel(
  template: number,
  param: number,
  homeTeam?: string,
  awayTeam?: string,
): string {
  switch (template) {
    case TEMPLATE_BTTS:
      return 'Both teams score';
    case TEMPLATE_TEAM_WINS:
      if (param === 0) return homeTeam ? `${homeTeam} wins` : 'Home team wins';
      return awayTeam ? `${awayTeam} wins` : 'Away team wins';
    default:
      return 'Unknown condition';
  }
}

export type LiveConditionState = 'tracking' | 'met';

/**
 * Client-side live tracking of a condition against the current score.
 * Only used for display — resolution is always confirmed on-chain (FR-15.5).
 */
export function evaluateCondition(
  template: number,
  param: number,
  homeGoals: number,
  awayGoals: number,
): LiveConditionState {
  switch (template) {
    case TEMPLATE_BTTS:
      return homeGoals > 0 && awayGoals > 0 ? 'met' : 'tracking';
    case TEMPLATE_TEAM_WINS: {
      const diff = param === 0 ? homeGoals - awayGoals : awayGoals - homeGoals;
      return diff > 0 ? 'met' : 'tracking';
    }
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
    if (diff === 0) return `Level — ${team} needs a goal`;
    return `${team} is behind by ${-diff}`;
  }
  return 'Tracking condition';
}
