/**
 * lib/format: how a shift, a share and a date read everywhere in the dashboard.
 */
import { describe, it, expect } from 'vitest';
import {
  BASE_YEAR, CONTRACTION, EXPANSION, FORCES, FORCE_COLORS, NO_VALUE, REGIONS, categoryDisplay, evidenceLine,
  firstPeakYear,
  fmtDate, fmtDateTime, fmtDateTimeUtc, fmtPct, fmtShift, groupDisplay, heatFill, heatScaleFor, heatText, shiftArrow,
  shiftColor, shortCat,
} from '@/lib/format';

describe('fmtShift', () => {
  it('shows a signed percentage with one decimal', () => {
    expect(fmtShift(0.032)).toBe('+3.2%');
    expect(fmtShift(-0.0125)).toBe('-1.3%');
  });

  it('never shows more than one decimal, even when asked', () => {
    expect(fmtShift(0.03256, 3)).toBe('+3.3%');
    expect(fmtShift(0.03256, 0)).toBe('+3%');
  });

  it('never shows a negative zero', () => {
    expect(fmtShift(-0.0004)).toBe('0.0%');
    expect(fmtShift(-0.000001)).toBe('0.0%');
    expect(fmtShift(-0)).toBe('0.0%');
  });

  it('shows a flat shift without a sign', () => {
    expect(fmtShift(0.0004)).toBe('0.0%');
  });

  it('shows NO_VALUE for a missing value', () => {
    expect(fmtShift(null)).toBe(NO_VALUE);
    expect(fmtShift(Number.NaN)).toBe(NO_VALUE);
    expect(NO_VALUE).toBe('–');
  });
});

describe('fmtPct', () => {
  it('shows a share without a sign and never a negative zero', () => {
    expect(fmtPct(0.514)).toBe('51.4%');
    expect(fmtPct(-0.0001)).toBe('0.0%');
    expect(fmtPct(undefined)).toBe(NO_VALUE);
  });
});

describe('dates', () => {
  it('reads the same in every browser locale', () => {
    expect(fmtDate('2026-09-13T23:04:39')).toBe('13 Sep 2026');
    expect(fmtDateTime('2026-09-13T08:05:00')).toBe('13 Sep 2026, 08:05');
    expect(fmtDate('not a date')).toBe(NO_VALUE);
    expect(fmtDateTime(null)).toBe(NO_VALUE);
  });

  it('shows a stored moment in UTC, named as such', () => {
    expect(fmtDateTimeUtc('2026-09-13T08:05:00+00:00')).toBe('13 Sep 2026, 08:05 UTC');
    expect(fmtDateTimeUtc('2026-09-13T23:30:00-02:00')).toBe('14 Sep 2026, 01:30 UTC');
    expect(fmtDateTimeUtc(undefined)).toBe(NO_VALUE);
  });
});

describe('evidenceLine', () => {
  it('names the publishers of the first three sources with their dates', () => {
    expect(evidenceLine([
      { title: 'Circana: private label reaches record 50% unit share', note: 'Apr 2026' },
      { title: 'YouGov Germany: nur Eigenmarken gewinnen hinzu', note: 'Jul 2026' },
      { title: 'BCG: European consumers are still cutting back', note: '' },
      { title: 'NIQ: Premium has a new price', note: 'Jun 2026' },
    ])).toBe('Circana (Apr 2026); YouGov Germany (Jul 2026); BCG');
  });

  it('shortens a long publisher and leaves out a source without a title', () => {
    const long = 'A'.repeat(60);
    expect(evidenceLine([{ title: '', note: '2026' }, { title: long, note: '' }])).toBe(`${'A'.repeat(47)}…`);
    expect(evidenceLine([])).toBe('');
  });
});

describe('direction and colour', () => {
  it('uses one colour pair and an arrow, and nothing for a flat shift', () => {
    expect(EXPANSION).toBe('#1f7a3d');
    expect(CONTRACTION).toBe('#9f403d');
    expect(shiftColor(0.01)).toBe(EXPANSION);
    expect(shiftColor(-0.01)).toBe(CONTRACTION);
    expect(shiftArrow(0.01)).toBe('▲');
    expect(shiftArrow(-0.01)).toBe('▼');
    expect(shiftArrow(0.0001)).toBe('');
  });

  it('tints a heat cell in the shift hue up to the saturation point', () => {
    expect(heatFill(-0.05, 0.05)).toBe('rgba(159, 64, 61, 0.42)');
    expect(heatFill(0.025, 0.05)).toBe('rgba(31, 122, 61, 0.28)');
    expect(heatFill(0.0001)).toBe(heatFill(null));
    expect(heatText(-0.03)).toBe('#6a2a27');
  });

  it('saturates the ramp at the 95th percentile of the values in view, at least 2 %', () => {
    expect(heatScaleFor([0.001, -0.004, 0.003])).toBe(0.02);
    const values = Array.from({ length: 100 }, (_, i) => -(i + 1) / 1000);
    expect(heatScaleFor(values)).toBeCloseTo(0.096, 12);
    expect(heatScaleFor([])).toBe(0.05);
  });
});

describe('taxonomy', () => {
  it("lists the forces and regions in the engine's order, one colour per force", () => {
    expect(FORCES).toEqual(['Consumer', 'Customer', 'Technology', 'Government', 'Environmental', 'Competitive']);
    expect(REGIONS).toEqual(['Europe', 'North America', 'Asia', 'High Growth']);
    expect(Object.keys(FORCE_COLORS)).toEqual(FORCES);
  });

  it('labels categories in plain English', () => {
    expect(categoryDisplay('LHC: FCN')).toBe('Fabric Clean');
    expect(categoryDisplay('Unknown')).toBe('Unknown');
    expect(groupDisplay('LHC')).toBe('Laundry & Home Care');
    expect(shortCat('Hair: Color')).toBe('Color');
  });
});

describe('firstPeakYear', () => {
  it('is the year after the onset, and never before the year after the base year', () => {
    expect(BASE_YEAR).toBe(2025);
    expect(firstPeakYear(undefined)).toBe(2026);
    expect(firstPeakYear(null)).toBe(2026);
    expect(firstPeakYear(2024)).toBe(2026);
    expect(firstPeakYear(2029)).toBe(2030);
  });
});
