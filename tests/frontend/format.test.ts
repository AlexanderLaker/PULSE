/**
 * lib/format pins — display-honesty invariants (July 2026 review).
 */
import { describe, it, expect } from 'vitest';
import { fmtShift, fmtPct, EXPANSION, CONTRACTION, FORCE_COLORS } from '@/lib/format';

describe('fmtShift', () => {
  it('formats signed percentages at one decimal', () => {
    expect(fmtShift(0.032)).toBe('+3.2%');
    expect(fmtShift(-0.0125)).toBe('-1.3%');
  });

  it('caps precision at one decimal even when asked for more (D3)', () => {
    expect(fmtShift(0.03256, 3)).toBe('+3.3%');
  });

  it('L5: a tiny negative never renders as "-0.0%"', () => {
    expect(fmtShift(-0.0004)).toBe('0.0%');
    expect(fmtShift(-0.000001)).toBe('0.0%');
    expect(fmtShift(-0)).toBe('0.0%');
  });

  it('flat epsilon zone renders unsigned', () => {
    expect(fmtShift(0.0004)).toBe('0.0%');
  });

  it('null/NaN render as em-dash', () => {
    expect(fmtShift(null)).toBe('—');
    expect(fmtShift(Number.NaN)).toBe('—');
  });
});

describe('fmtPct', () => {
  it('L5: no negative zero', () => {
    expect(fmtPct(-0.0001)).toBe('0.0%');
  });
});

describe('semantic tokens', () => {
  it('exposes the single expansion/contraction pair (L10)', () => {
    expect(EXPANSION).toBe('#1f7a3d');
    expect(CONTRACTION).toBe('#9f403d');
  });
  it('exposes one force palette (L11)', () => {
    expect(Object.keys(FORCE_COLORS)).toHaveLength(6);
  });
});
