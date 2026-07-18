// Pure condition-evaluation logic — no I/O, no imports beyond types (spec 02 §2).

/** @param {{template:string,params:object}} condition */
export function validateCondition(condition) {
  if (!condition || typeof condition !== "object" || typeof condition.template !== "string") return false;
  const params = condition.params;
  switch (condition.template) {
    case "team_wins":
      return !!params && (params.team === "home" || params.team === "away");
    case "both_teams_score":
      return !!params;
    case "total_goals_gte":
      return !!params && Number.isInteger(params.n) && params.n >= 1;
    default:
      return false;
  }
}

/**
 * @param {{template:string,params:object}} condition
 * @param {{homeGoals:number,awayGoals:number}} stats
 * @returns {boolean}
 */
export function evaluate(condition, stats) {
  const { homeGoals, awayGoals } = stats;
  switch (condition.template) {
    case "team_wins": {
      const { team } = condition.params;
      if (team === "home") return homeGoals > awayGoals;
      if (team === "away") return awayGoals > homeGoals;
      throw new Error(`team_wins: invalid team param ${JSON.stringify(team)}`);
    }
    case "both_teams_score":
      return homeGoals > 0 && awayGoals > 0;
    case "total_goals_gte": {
      const { n } = condition.params;
      return homeGoals + awayGoals >= n;
    }
    default:
      throw new Error(`unknown condition template: ${condition.template}`);
  }
}

/**
 * Plain-English progress string matching the current stats (spec 05 A2).
 * @param {{template:string,params:object}} condition
 * @param {{homeGoals:number,awayGoals:number}} stats
 * @returns {string}
 */
export function progress(condition, stats) {
  const { homeGoals, awayGoals } = stats;
  const score = `${homeGoals}-${awayGoals}`;
  switch (condition.template) {
    case "team_wins": {
      const { team } = condition.params;
      const leader = homeGoals === awayGoals ? "tied" : homeGoals > awayGoals ? "home" : "away";
      return `${score}, ${team} needs to be ahead at full time (currently ${leader})`;
    }
    case "both_teams_score": {
      const homeDone = homeGoals > 0 ? "✓" : "✗";
      const awayDone = awayGoals > 0 ? "✓" : "✗";
      return `${score}, both teams need to score (home ${homeDone}, away ${awayDone})`;
    }
    case "total_goals_gte": {
      const { n } = condition.params;
      const total = homeGoals + awayGoals;
      return `${score} — ${total}/${n} total goals scored`;
    }
    default:
      throw new Error(`unknown condition template: ${condition.template}`);
  }
}
