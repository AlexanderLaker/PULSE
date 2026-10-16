/**
 * The driver code map (data/driverCodeMap.ts, generated from
 * data/drivers/driver_base.json): one code per driver of the base, each code
 * built from its driver's force and id, and nothing else of the driver (no
 * name, direction or text: the map ships in the public bundle, the drivers
 * come from the API). Every code the Consumer Journey content
 * (data/content/consumer_journey.json) cites or names is a live driver.
 * tests/test_driver_base.py checks the same map against prism/seed_drivers.py.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DRIVER_CODE_MAP, codeForDriverId } from '@/data/driverCodeMap';
import type { JourneyContent, JourneyContexts } from '@/data/consumerJourney';
import driverBase from '@/data/drivers/driver_base.json';
import journey from '@/data/content/consumer_journey.json';

const LETTER: Record<string, string> = {
  Consumer: 'C', Customer: 'K', Technology: 'T', Government: 'G', Environmental: 'E', Competitive: 'X',
};

const CODES = Object.keys(DRIVER_CODE_MAP);
const { tiles, contexts } = journey as unknown as { tiles: JourneyContent; contexts: JourneyContexts };
const TILES = [...tiles.lhc, ...tiles.hair].flatMap((s) => [...s.benefiting, ...s.negativelyImpacted]);
const MAP_SOURCE = fs.readFileSync(path.resolve(__dirname, '..', '..', 'data', 'driverCodeMap.ts'), 'utf8');

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

  it("agrees with each driver's id and force", () => {
    for (const d of driverBase.drivers) {
      const info = DRIVER_CODE_MAP[d.code];
      expect(info.driverId).toBe(d.id);
      expect(info.force).toBe(d.force);
    }
  });

  it('carries no name, direction or text of a driver: the id and the force only', () => {
    for (const code of CODES) expect(Object.keys(DRIVER_CODE_MAP[code]).sort()).toEqual(['driverId', 'force']);
    for (const d of driverBase.drivers) {
      expect(MAP_SOURCE.includes(d.name), d.code).toBe(false);
      expect(MAP_SOURCE.includes(d.description.slice(0, 40)), d.code).toBe(false);
    }
    expect(MAP_SOURCE).not.toMatch(/"(?:name|direction|firstSentence|description)":/);
  });

  it('finds the code of a driver id, and nothing for an unknown one', () => {
    for (const code of CODES) expect(codeForDriverId(DRIVER_CODE_MAP[code].driverId)).toBe(code);
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
      ...[contexts.lhc, contexts.hair].flatMap((ctx) => Object.values(ctx).flatMap((c) => [c.henkelBrands, c.competitors, c.opportunity])),
    ];
    const named = new Set(texts.flatMap((t) => t.match(/\b[CKTGEX]-\d\d\b/g) ?? []));
    expect(named.size).toBeGreaterThan(0);
    expect([...named].filter((c) => !DRIVER_CODE_MAP[c])).toEqual([]);
  });
});
