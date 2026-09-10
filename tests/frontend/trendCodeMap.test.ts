/**
 * trendCodeMap integrity (2.11.0, owner ruling O10): the journey layer's
 * code map must partition every code into LIVE (51 drivers) or RETIRED,
 * every retired pointer must land on a live code, every journey-tile
 * citation must resolve to one of the two, and liveCodeFor must follow a
 * merged code to its driver while never resurrecting a deleted one.
 * (The Python twin, tests/test_trend_base_2026_09.py, checks the map
 * against pulse/seed_trends.py.)
 */
import { describe, it, expect } from 'vitest';
import {
  TREND_CODE_MAP, RETIRED_CODES, trendIdForCode, codeForTrendId, liveCodeFor,
} from '@/data/trendCodeMap';
import { LHC_JOURNEY, HAIR_JOURNEY } from '@/data/consumerJourney';

const LETTER: Record<string, string> = {
  Consumer: 'C', Customer: 'K', Technology: 'T', Government: 'G', Environmental: 'E', Competitive: 'X',
};
const SLUG: Record<string, string> = {
  Consumer: 'consumer', Customer: 'customer', Technology: 'technology',
  Government: 'government', Environmental: 'environmental', Competitive: 'competitive',
};

describe('TREND_CODE_MAP (live codes)', () => {
  it('holds the 51 drivers with codes derived from their ids', () => {
    const codes = Object.keys(TREND_CODE_MAP);
    expect(codes).toHaveLength(51);
    for (const code of codes) {
      const info = TREND_CODE_MAP[code];
      const [letter, num] = code.split('-');
      expect(letter).toBe(LETTER[info.force]);
      expect(info.trendId).toBe(`${SLUG[info.force]}_r${num}`);
      expect(['Expansion', 'Contraction']).toContain(info.direction);
      expect(info.name.length).toBeGreaterThan(0);
      expect(trendIdForCode(code)).toBe(info.trendId);
      expect(codeForTrendId(info.trendId)).toBe(code);
    }
    const ids = new Set(codes.map((c) => TREND_CODE_MAP[c].trendId));
    expect(ids.size).toBe(51);
  });

  it('carries the two force moves under their new codes', () => {
    expect(TREND_CODE_MAP['K-13'].trendId).toBe('customer_r13');
    expect(TREND_CODE_MAP['C-37'].trendId).toBe('consumer_r37');
    expect(TREND_CODE_MAP['T-06']).toBeUndefined();
    expect(TREND_CODE_MAP['X-06']).toBeUndefined();
  });
});

describe('RETIRED_CODES', () => {
  it('never overlaps the live map and every pointer lands on a live code', () => {
    for (const [code, info] of Object.entries(RETIRED_CODES)) {
      expect(TREND_CODE_MAP[code]).toBeUndefined();
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.note.length).toBeGreaterThan(0);
      expect(['v3.1', 'v3.3', 'v3.11']).toContain(info.retiredIn);
      for (const t of [...(info.mergedInto ?? []), ...(info.residueIn ?? [])]) {
        expect(TREND_CODE_MAP[t]).toBeDefined();
      }
      expect(!!(info.mergedInto && info.residueIn)).toBe(false);
    }
    expect(Object.keys(RETIRED_CODES)).toHaveLength(65);
  });

  it('records the September 2026 dispositions', () => {
    expect(RETIRED_CODES['T-06'].mergedInto).toEqual(['K-13']);
    expect(RETIRED_CODES['X-06'].mergedInto).toEqual(['C-37']);
    expect([...(RETIRED_CODES['G-07'].mergedInto ?? [])].sort()).toEqual(['G-04', 'G-16']);
    expect(RETIRED_CODES['X-01'].mergedInto).toEqual(['X-17']);
    expect(RETIRED_CODES['X-10'].residueIn).toEqual(['C-01']);
    expect(RETIRED_CODES['C-15'].mergedInto).toBeUndefined();
    expect(RETIRED_CODES['C-12'].retiredIn).toBe('v3.1');
  });
});

describe('liveCodeFor', () => {
  it('returns live codes unchanged, follows merges, and drops deleted codes', () => {
    expect(liveCodeFor('C-01')).toBe('C-01');
    expect(liveCodeFor('K-08')).toBe('K-13');   // merged into retail media (K-13)
    expect(liveCodeFor('T-06')).toBe('K-13');   // force move
    expect(liveCodeFor('G-07')).toBe('G-16');   // first of two targets
    expect(liveCodeFor('X-10')).toBeUndefined(); // deleted; a residue note is not a driver
    expect(liveCodeFor('C-15')).toBeUndefined(); // deleted outright
    expect(liveCodeFor('Z-99')).toBeUndefined(); // unknown
  });
});

describe('journey tiles', () => {
  it('cite only live or retired codes', () => {
    const unknown = new Set<string>();
    for (const journey of [LHC_JOURNEY, HAIR_JOURNEY]) {
      for (const stage of journey) {
        for (const tile of [...stage.benefiting, ...stage.negativelyImpacted]) {
          for (const code of tile.trendCodes) {
            if (!TREND_CODE_MAP[code] && !RETIRED_CODES[code]) unknown.add(code);
          }
        }
      }
    }
    expect([...unknown]).toEqual([]);
  });
});
