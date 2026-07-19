import { describe, expect, it } from 'vitest';
import {
  buildConditionParam,
  conditionLabel,
  evaluateCondition,
  packTeamThreshold,
  unpackTeamThreshold,
} from '../conditions';

describe('conditionLabel', () => {
  it('labels BTTS regardless of param', () => {
    expect(conditionLabel(0, 0)).toBe('Both teams score');
    expect(conditionLabel(0, 1, 'Argentina', 'France')).toBe('Both teams score');
  });

  it('labels TeamWins with team names', () => {
    expect(conditionLabel(1, 0, 'Argentina', 'France')).toBe('Argentina wins');
    expect(conditionLabel(1, 1, 'Argentina', 'France')).toBe('France wins');
  });

  it('falls back to generic home/away labels', () => {
    expect(conditionLabel(1, 0)).toBe('Home team wins');
    expect(conditionLabel(1, 1)).toBe('Away team wins');
  });

  it('labels Draw / team scores / total / margin', () => {
    expect(conditionLabel(2, 0)).toBe('Draw (full time)');
    expect(conditionLabel(3, packTeamThreshold(0, 2), 'Spain', 'Argentina')).toBe(
      'Spain scores at least 2',
    );
    expect(conditionLabel(4, 3)).toBe('Total goals ≥ 3');
    expect(conditionLabel(5, packTeamThreshold(1, 2), 'Spain', 'Argentina')).toBe(
      'Argentina wins by ≥ 2',
    );
  });

  it('labels pens templates', () => {
    expect(conditionLabel(6, 0, 'Spain', 'Argentina')).toBe('Spain wins on penalties');
    expect(conditionLabel(6, 1, 'Spain', 'Argentina')).toBe('Argentina wins on penalties');
    expect(conditionLabel(7, 0)).toBe('Goes to penalties');
  });

  it('handles unknown templates', () => {
    expect(conditionLabel(9, 0)).toBe('Unknown condition');
  });
});

describe('packTeamThreshold', () => {
  it('round-trips team and N', () => {
    expect(unpackTeamThreshold(packTeamThreshold(1, 5))).toEqual({ team: 1, n: 5 });
    expect(buildConditionParam(3, 0, 2)).toBe(2);
    expect(buildConditionParam(5, 1, 3)).toBe(256 + 3);
    expect(buildConditionParam(4, 0, 7)).toBe(7);
  });
});

describe('evaluateCondition (live display only)', () => {
  it('tracks BTTS until both score', () => {
    expect(evaluateCondition(0, 0, 0, 0)).toBe('tracking');
    expect(evaluateCondition(0, 0, 1, 0)).toBe('tracking');
    expect(evaluateCondition(0, 0, 1, 1)).toBe('met');
  });

  it('tracks TeamWins by goal difference', () => {
    expect(evaluateCondition(1, 0, 1, 0)).toBe('met');
    expect(evaluateCondition(1, 0, 1, 1)).toBe('tracking');
    expect(evaluateCondition(1, 1, 0, 2)).toBe('met');
    expect(evaluateCondition(1, 1, 2, 0)).toBe('tracking');
  });

  it('tracks Draw / thresholds', () => {
    expect(evaluateCondition(2, 0, 1, 1)).toBe('met');
    expect(evaluateCondition(2, 0, 2, 1)).toBe('tracking');
    expect(evaluateCondition(3, packTeamThreshold(0, 2), 2, 0)).toBe('met');
    expect(evaluateCondition(3, packTeamThreshold(0, 2), 1, 0)).toBe('tracking');
    expect(evaluateCondition(4, 3, 1, 2)).toBe('met');
    expect(evaluateCondition(4, 3, 1, 1)).toBe('tracking');
    expect(evaluateCondition(5, packTeamThreshold(1, 2), 0, 2)).toBe('met');
    expect(evaluateCondition(5, packTeamThreshold(1, 2), 0, 1)).toBe('tracking');
    expect(evaluateCondition(6, 0, 1, 1, 4, 3)).toBe('met');
    expect(evaluateCondition(6, 0, 1, 1, 3, 4)).toBe('tracking');
    expect(evaluateCondition(7, 0, 1, 1, 0, 0)).toBe('tracking');
    expect(evaluateCondition(7, 0, 1, 1, 1, 0)).toBe('met');
  });
});
