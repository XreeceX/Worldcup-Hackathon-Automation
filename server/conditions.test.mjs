import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, progress, validateCondition } from "./conditions.mjs";

test("team_wins: home/away/draw", () => {
  const homeWin = { homeGoals: 2, awayGoals: 1 };
  assert.equal(evaluate({ template: "team_wins", params: { team: "home" } }, homeWin), true);
  assert.equal(evaluate({ template: "team_wins", params: { team: "away" } }, homeWin), false);

  const draw = { homeGoals: 1, awayGoals: 1 };
  assert.equal(evaluate({ template: "team_wins", params: { team: "home" } }, draw), false);
  assert.equal(evaluate({ template: "team_wins", params: { team: "away" } }, draw), false);
});

test("both_teams_score", () => {
  assert.equal(evaluate({ template: "both_teams_score", params: {} }, { homeGoals: 1, awayGoals: 1 }), true);
  assert.equal(evaluate({ template: "both_teams_score", params: {} }, { homeGoals: 2, awayGoals: 0 }), false);
  assert.equal(evaluate({ template: "both_teams_score", params: {} }, { homeGoals: 0, awayGoals: 0 }), false);
});

test("total_goals_gte: exact boundary", () => {
  assert.equal(evaluate({ template: "total_goals_gte", params: { n: 3 } }, { homeGoals: 2, awayGoals: 1 }), true);
  assert.equal(evaluate({ template: "total_goals_gte", params: { n: 3 } }, { homeGoals: 1, awayGoals: 1 }), false);
  assert.equal(evaluate({ template: "total_goals_gte", params: { n: 1 } }, { homeGoals: 0, awayGoals: 0 }), false);
});

test("progress() strings match current stats", () => {
  const stats = { homeGoals: 1, awayGoals: 2 };
  assert.match(progress({ template: "team_wins", params: { team: "home" } }, stats), /1-2/);
  assert.match(progress({ template: "both_teams_score", params: {} }, stats), /1-2/);
  assert.match(progress({ template: "total_goals_gte", params: { n: 4 } }, stats), /3\/4/);
});

test("validateCondition accepts the 3 templates and rejects the rest", () => {
  assert.equal(validateCondition({ template: "team_wins", params: { team: "home" } }), true);
  assert.equal(validateCondition({ template: "team_wins", params: { team: "sideways" } }), false);
  assert.equal(validateCondition({ template: "both_teams_score", params: {} }), true);
  assert.equal(validateCondition({ template: "total_goals_gte", params: { n: 1 } }), true);
  assert.equal(validateCondition({ template: "total_goals_gte", params: { n: 0 } }), false);
  assert.equal(validateCondition({ template: "total_goals_gte", params: { n: 1.5 } }), false);
  assert.equal(validateCondition({ template: "unknown_template", params: {} }), false);
});
