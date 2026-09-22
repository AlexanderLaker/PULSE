/**
 * The driver code map (data/driverCodeMap.ts, generated from
 * data/drivers/driver_base.json): one code per driver of the base, each code
 * built from its driver's force and id and agreeing with the driver's name,
 * force and direction, and every code the Consumer Journey content cites or
 * names is a live driver. tests/test_driver_base.py checks the same map
 * against prism/seed_drivers.py.
 */
import { describe, it, expect } from 'vitest';
import { DRIVER_CODE_MAP, driverIdForCode, codeForDriverId } from '@/data/driverCodeMap';
import { LHC_JOURNEY, HAIR_JOURNEY, LHC_CTX, HAIR_CTX } from '@/data/consumerJourney';
import driverBase from '@/data/drivers/driver_base.json';

const LETTER: Record<string, string> = {
  Consumer: 'C', Customer: 'K', Technology: 'T', Government: 'G', Environmental: 'E', Competitive: 'X',
};

const CODES = Object.keys(DRIVER_CODE_MAP);
const TILES = [...LHC_JOURNEY, ...HAIR_JOURNEY].flatMap((s) => [...s.benefiting, ...s.negativelyImpacted]);

describe('DRIVER_CODE_MAP', () => {
  it('holds one code per driver of the base', () => {
    expect(driverBase.drivers).toHaveLength(51);
    expect(CODES).toHaveLength(51);
    expect(new Set(CODES)).toEqual(new Set(driverBase.drivers.map((d) => d.code)));
    expect(new Set(CODES.map((c) => DRIVER_CODE_MAP[c].driverId)).size).toBe(51);
  });

  it('builds each code from the force letter and the number of the driver id', () => {
    for (const code of CODES) {
      const { driverId, force } = DRIVER_CODE_MAP[code];
      const [letter, num] = code.split('-');
      expect(letter).toBe(LETTER[force]);
      expect(driverId).toBe(`${force.toLowerCase()}_r${num}`);
    }
  });

  it("agrees with each driver's id, name, force, direction and description", () => {
    for (const d of driverBase.drivers) {
      const info = DRIVER_CODE_MAP[d.code];
      expect(info.driverId).toBe(d.id);
      expect(info.name).toBe(d.name);
      expect(info.force).toBe(d.force);
      expect(info.direction).toBe(d.direction);
      expect(info.fallbackDescription.length).toBeGreaterThan(0);
      expect(d.description.startsWith(info.fallbackDescription.replace(/…$/, ''))).toBe(true);
    }
  });

  it('resolves codes and driver ids both ways, and nothing for an unknown one', () => {
    for (const code of CODES) {
      const id = DRIVER_CODE_MAP[code].driverId;
      expect(driverIdForCode(code)).toBe(id);
      expect(codeForDriverId(id)).toBe(code);
    }
    expect(driverIdForCode('Z-99')).toBeUndefined();
    expect(codeForDriverId('consumer_r99')).toBeUndefined();
  });
});

describe('Consumer Journey content', () => {
  it('cites only live driver codes', () => {
    const cited = new Set(TILES.flatMap((t) => t.driverCodes));
    expect(cited.size).toBeGreaterThan(0);
    expect([...cited].filter((c) => !DRIVER_CODE_MAP[c])).toEqual([]);
  });

  it('names only live driver codes in its notes, reads and stage contexts', () => {
    const texts = [
      ...TILES.flatMap((t) => [t.name, t.driverNote, t.analysis ?? '']),
      ...[LHC_CTX, HAIR_CTX].flatMap((ctx) => Object.values(ctx).flatMap((c) => [c.henkelBrands, c.competitors, c.opportunity])),
    ];
    const named = new Set(texts.flatMap((t) => t.match(/\b[CKTGEX]-\d\d\b/g) ?? []));
    expect(named.size).toBeGreaterThan(0);
    expect([...named].filter((c) => !DRIVER_CODE_MAP[c])).toEqual([]);
  });
});
