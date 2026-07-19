// Human-language layer over condition templates. Mirrors the on-chain
// build_strategy mapping — template/param are the only inputs.
export const TEMPLATE_BTTS = 0;
export const TEMPLATE_TEAM_WINS = 1;
export const TEMPLATE_TOTAL_GOALS = 2;

export function conditionLabel(template: number, param: number, home: string, away: string): string {
  switch (template) {
    case TEMPLATE_BTTS: return "Both teams score";
    case TEMPLATE_TEAM_WINS: return param === 0 ? `${home} wins` : `${away} wins`;
    case TEMPLATE_TOTAL_GOALS: return `${param}+ goals in the match`;
    default: return "Unknown condition";
  }
}

export type LiveStatus = { state: "tracking" | "met"; text: string };

// Plain-language live status from current goals (display only — resolution
// truth always comes from the on-chain proof, FR-15.5).
export function liveStatus(
  template: number, param: number, home: string, away: string,
  g1: number, g2: number, clock: string
): LiveStatus {
  const score = `${g1}–${g2}`;
  switch (template) {
    case TEMPLATE_BTTS: {
      if (g1 > 0 && g2 > 0) return { state: "met", text: `Both teams have scored ✓ · ${score} ${clock}` };
      if (g1 > 0) return { state: "tracking", text: `${home} have scored — waiting on ${away} · ${score} ${clock}` };
      if (g2 > 0) return { state: "tracking", text: `${away} have scored — waiting on ${home} · ${score} ${clock}` };
      return { state: "tracking", text: `Both teams yet to score · ${score} ${clock}` };
    }
    case TEMPLATE_TEAM_WINS: {
      const team = param === 0 ? home : away;
      const lead = param === 0 ? g1 - g2 : g2 - g1;
      if (lead > 0) return { state: "met", text: `${team} lead ✓ — holding until the whistle · ${score} ${clock}` };
      if (lead === 0) return { state: "tracking", text: `Level — ${team} need a goal · ${score} ${clock}` };
      return { state: "tracking", text: `${team} trail by ${-lead} · ${score} ${clock}` };
    }
    case TEMPLATE_TOTAL_GOALS: {
      const total = g1 + g2;
      if (total >= param) return { state: "met", text: `${total} of ${param} goals — condition met ✓ · ${score} ${clock}` };
      return { state: "tracking", text: `${total} of ${param} goals so far · ${score} ${clock}` };
    }
    default:
      return { state: "tracking", text: `${score} ${clock}` };
  }
}

export const shootoutDisclosure =
  "Wins on goals — extra time counts. A draw settled by penalty shootout does not satisfy this condition.";
