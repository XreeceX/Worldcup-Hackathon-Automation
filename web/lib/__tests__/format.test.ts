import { describe, expect, it } from 'vitest';
import {
  decodeName64,
  encodeName64,
  formatSol,
  lamportsToSol,
  solToLamports,
  truncateAddress,
} from '../format';

describe('lamports/SOL conversion', () => {
  it('converts lamports to SOL', () => {
    expect(lamportsToSol(1_000_000_000)).toBe(1);
    expect(lamportsToSol(10_000_000)).toBe(0.01);
    expect(lamportsToSol(0)).toBe(0);
  });

  it('converts SOL to whole lamports', () => {
    expect(solToLamports(0.01)).toBe(10_000_000);
    expect(solToLamports(1.5)).toBe(1_500_000_000);
    expect(solToLamports(0.123456789)).toBe(123_456_789);
  });
});

describe('formatSol (2–4 decimals)', () => {
  it('uses 2 decimals for round amounts', () => {
    expect(formatSol(1_000_000_000)).toBe('1.00');
    expect(formatSol(12_100_000_000)).toBe('12.10');
  });

  it('extends to 4 decimals for small amounts', () => {
    expect(formatSol(10_000_000)).toBe('0.01');
    expect(formatSol(10_500_000)).toBe('0.0105');
    expect(formatSol(1_234_567)).toBe('0.0012');
  });

  it('groups thousands', () => {
    expect(formatSol(1_500_000_000_000)).toBe('1,500.00');
  });
});

describe('name 64-byte encoding', () => {
  it('round-trips and zero-pads', () => {
    const encoded = encodeName64('Argentina DAO');
    expect(encoded).toHaveLength(64);
    expect(encoded[13]).toBe(0);
    expect(decodeName64(encoded)).toBe('Argentina DAO');
  });

  it('rejects names over 64 bytes (UTF-8, not chars)', () => {
    expect(() => encodeName64('⚽'.repeat(22))).toThrow(); // 66 bytes
    expect(encodeName64('⚽'.repeat(21))).toHaveLength(64); // 63 bytes ok
  });
});

describe('truncateAddress', () => {
  it('truncates long addresses', () => {
    expect(truncateAddress('3uyiF93zMvUcP2o1Cqnt2iS4bXwYeBcTMTvbaTf5B3RJ')).toBe('3uyi…B3RJ');
  });
  it('leaves short strings alone', () => {
    expect(truncateAddress('abc')).toBe('abc');
  });
});
