// @vitest-environment jsdom
/**
 * A driver's names as the dashboard reads them (lib/driverNames.ts): the short
 * name, long name, descriptor and boundary sentence the API serves with the
 * driver, its `name` as the technical scope and its code from the code map; a
 * driver without names is named by its technical scope alone, and a code's
 * names come from the loaded drivers. A query is a driver's code only when it
 * is exactly one, a boundary sentence is cut into its text and its codes, and
 * the Journey tile editor labels each code with its driver's short name.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import driverBase from '@/data/drivers/driver_base.json';
import { boundaryParts, driverNames, exactDriverCode, namesForCode } from '@/lib/driverNames';
import { NAME_WORDS } from '@/components/dashboard/drivers/NamesGlossary';
import { makeDriver } from './fixtures/prism';
import { TileEditor } from '@/components/dashboard/journey/TileEditor';
import type { JourneyTile } from '@/data/consumerJourney';

const C01 = makeDriver({ id: 'consumer_r01', name: 'As the API serves it' });

describe('driverNames', () => {
  it("takes the driver's names and keeps its name as the technical scope", () => {
    expect(driverNames(C01)).toEqual({
      code: 'C-01', shortName: C01.short_name, longName: C01.long_name, descriptor: C01.descriptor,
      boundary: C01.boundary, technicalScope: 'As the API serves it',
    });
    expect(C01.short_name).toBe(driverBase.drivers[0].short_name);
  });

  it('names a driver without names by its technical scope alone', () => {
    const unknown = makeDriver({ id: 'consumer_r99', name: 'A driver newer than this build' });
    expect(driverNames(unknown)).toEqual({
      code: '', shortName: 'A driver newer than this build', longName: '', descriptor: '', boundary: '',
      technicalScope: 'A driver newer than this build',
    });
  });
});

describe('namesForCode', () => {
  it("reads a code's names from the loaded drivers, and has none before they load", () => {
    expect(namesForCode('C-01', [C01])?.shortName).toBe(C01.short_name);
    expect(namesForCode('C-01', [])).toBeNull();
    expect(namesForCode('C-99', [C01])).toBeNull();
  });
});

describe('exactDriverCode', () => {
  it('reads a code of the map in either case, with spaces around it, and nothing else', () => {
    expect(exactDriverCode(' c-01 ')).toBe('C-01');
    expect(exactDriverCode('X-15')).toBe('X-15');
    expect(exactDriverCode('C-99')).toBeNull();
    expect(exactDriverCode('C-1')).toBeNull();
    expect(exactDriverCode('C-01 private label')).toBeNull();
  });
});

describe("the glossary's family words", () => {
  it('are each used by at least one short name', () => {
    const shortNames = driverBase.drivers.map((d) => d.short_name);
    for (const { words } of NAME_WORDS) {
      for (const word of words.split(', ')) {
        expect(shortNames.some((name) => new RegExp(`\\b${word}\\b`).test(name)), word).toBe(true);
      }
    }
  });
});

describe('boundaryParts', () => {
  it('cuts a boundary sentence into its text and the codes it cites', () => {
    expect(boundaryParts('Counted in other drivers: a price ceiling (K-01) and dupes (C-11).')).toEqual([
      { kind: 'text', text: 'Counted in other drivers: a price ceiling (' },
      { kind: 'code', code: 'K-01' },
      { kind: 'text', text: ') and dupes (' },
      { kind: 'code', code: 'C-11' },
      { kind: 'text', text: ').' },
    ]);
  });
});

describe("the Journey tile editor's driver list", () => {
  const TILE = {
    id: 'lhc.test.exp.tile', name: 'A tile', type: 'tech' as const, driverCodes: ['C-01'], driverNote: 'C-01',
    intensity: 2 as const, provenance: { source: 'Strategist-authored', date: 'Oct 2026', grade: 'Estimate' },
    analysis: null,
  } as unknown as JourneyTile;
  const noop = () => {};

  it('labels each code with its short name once the drivers have loaded, and with the code alone before', () => {
    const { unmount } = render(
      <TileEditor initial={TILE} driversById={new Map([[C01.id, C01]])} onSave={noop} onCancel={noop} onRemove={noop} />);
    const list = screen.getByRole('combobox', { name: 'Linked driver 1' });
    expect(within(list).getByRole('option', { name: `C-01: ${C01.short_name}` })).toBeTruthy();
    expect(within(list).queryByRole('option', { name: new RegExp(C01.name) })).toBeNull();   // not the technical scope
    expect(within(list).getByRole('option', { name: 'C-02' })).toBeTruthy();   // a driver not loaded: the code alone
    unmount();
    render(<TileEditor initial={TILE} driversById={new Map()} onSave={noop} onCancel={noop} onRemove={noop} />);
    expect(within(screen.getByRole('combobox', { name: 'Linked driver 1' })).getByRole('option', { name: 'C-01' })).toBeTruthy();
  });
});
