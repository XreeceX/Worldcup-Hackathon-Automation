import { describe, expect, it } from 'vitest';
import { conditionLabel, evaluateCondition } from '../conditions';

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

  it('handles unknown templates', () => {
    expect(conditionLabel(9, 0)).toBe('Unknown condition');
  });
});

describe('evaluateCondition (live display only)', () => {
  it('tracks BTTS until both score', () => {
    expect(evaluateCondition(0, 0, 0, 0)).toBe('tracking');
    expect(evaluateCondition(0, 0, 1, 0)).toBe('tracking');
    expect(evaluateCondition(0, 0, 1, 1)).toBe('met');
  });

  it('tracks TeamWins by goal difference', () => {
    expect(evaluateCondition(1, 0, 1, 0)).toBe('met'); // home leads
    expect(evaluateCondition(1, 0, 1, 1)).toBe('tracking'); // level
    expect(evaluateCondition(1, 1, 0, 2)).toBe('met'); // away leads
    expect(evaluateCondition(1, 1, 2, 0)).toBe('tracking');
  });
});
