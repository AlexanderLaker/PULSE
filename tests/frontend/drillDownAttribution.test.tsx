// @vitest-environment jsdom
/**
 * The category drill-down ranks its contributing drivers with the same
 * decomposition the PRISM Analysis readings are written on. Rendered end to
 * end from the parity fixture the Python build writes: the Shift Analysis
 * page mounts on a store whose drivers, configuration and cell weights are
 * the fixture's inputs and whose category medians are the fixture's category
 * shifts; the fabric-clean row is opened, and the drill-down must
 *
 *   1. name the score-means basis in its footer,
 *   2. rank the drivers as the fixture does (X-15, C-01, C-06 first),
 *   3. say, when the configuration or the drivers did not load, which of
 *      the two the ranking needs, and rank none of the drivers another way;
 *   4. keep every driver's sign where the row's median and the net at the
 *      means disagree.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import type { Driver, ForceName, ShiftPath } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import type { AttributionResult } from '@/lib/driverAttribution';
import { codeForDriverId } from '@/data/driverCodeMap';
import { BASE_BY_CODE, categoryMap, distribution, makeConfig, makeDriver, makeSimulation, makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ store: null as unknown as PrismStore }));

vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.store }));
vi.mock('@/lib/apiClient', () => ({ getDiagnostics: vi.fn(async () => null) }));

// The fan chart renders in a Recharts ResponsiveContainer, which needs a
// ResizeObserver; jsdom has none, and the chart is not under test.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

import ShiftAnalysis from '@/components/dashboard/ShiftAnalysis';
import { rankContributors } from '@/components/dashboard/shift/contributors';

type FixtureDriver = Pick<Driver,
  'id' | 'expected_effect' | 'category_exposure' | 'regional_exposure'
  | 'uncertainty' | 'peak_year' | 'diffusion_curve' | 'start_year'> & { force: string };

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'driverAttribution.fixture.json'), 'utf8')) as {
  inputs: {
    drivers: FixtureDriver[];
    config: { force_weights: Record<ForceName, number>; per_force_attenuation: Record<ForceName, number>;
      within_force_overlap: Record<ForceName, number>; path_years: number[]; peak_year_jitter: boolean };
    cellWeights: Record<string, Record<string, number>>;
  };
  expected: {
    byDriver: Record<string, { category: Record<string, Record<string, number>> }>;
    categoryShift: Record<string, Record<string, number>>;
  };
};
const FCN = 'LHC: FCN';

/** The fixture's drivers, each named by its id: a card shows the short name the base gives a driver it
 *  holds and the name of any other, so cardOrder can read every card back to its driver's id. */
function fixtureDrivers(): Driver[] {
  return FIXTURE.inputs.drivers.map((d) => makeDriver({
    ...d,
    force: d.force as ForceName,
    name: d.id,
    direction: d.expected_effect < 0 ? 'Contraction' : 'Expansion',
  }));
}

function buildStore(configLoaded: boolean, driversLoaded = true): PrismStore {
  const shifts: Record<string, ShiftPath> = Object.fromEntries(
    Object.entries(FIXTURE.expected.categoryShift).map(([cat, byYear]) => [
      cat, Object.fromEntries(Object.entries(byYear).map(([year, median]) => [year, distribution(median)])),
    ]),
  );
  const cfg = FIXTURE.inputs.config;
  return makeStore({
    drivers: driversLoaded ? fixtureDrivers() : [],
    simulation: makeSimulation({ shifts, cell_weights_used: FIXTURE.inputs.cellWeights }),
    config: configLoaded
      ? makeConfig({
          force_weights: cfg.force_weights,
          per_force_attenuation: cfg.per_force_attenuation,
          within_force_overlap: cfg.within_force_overlap,
          path_years: cfg.path_years,
          peak_year_jitter: cfg.peak_year_jitter,
        })
      : null,
  });
}

function openFabricClean(container: HTMLElement): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: /Open Fabric Clean detail/ }));
  const aside = container.querySelector('[role="dialog"]') as HTMLElement;
  expect(aside).toBeTruthy();
  return aside;
}

/** The driver id behind each short name of the base. */
const ID_BY_SHORT_NAME: Record<string, string> = Object.fromEntries(
  Object.values(BASE_BY_CODE).map((info) => [info.shortName, info.driverId]),
);

/** The driver cards in rank order, by driver id. */
function cardOrder(aside: HTMLElement): string[] {
  return within(aside)
    .getAllByRole('button', { name: /Opens it on the Drivers page$/ })
    .map((card) => /^\d+\. ([^:]+): /.exec(card.getAttribute('aria-label') ?? '')?.[1] ?? '')
    .map((name) => ID_BY_SHORT_NAME[name] ?? name);
}

afterEach(() => cleanup());

describe('category drill-down: contributing drivers at the score means', () => {
  it('names the score-means basis and ranks the fabric-clean drivers as the fixture does', () => {
    STORE.store = buildStore(true);
    const openDriver = vi.fn();
    const { container } = render(<ShiftAnalysis onNavigateToDriver={openDriver} />);
    const aside = openFabricClean(container);

    expect(aside.textContent).toContain('the same decomposition as the PRISM Analysis');
    expect(within(aside).getByText(/Contributing Drivers/)).toBeTruthy();

    const expected = FIXTURE.inputs.drivers
      .filter((d) => d.category_exposure[FCN] > 0)
      .map((d) => d.id)
      .sort((a, b) => Math.abs(FIXTURE.expected.byDriver[b].category[FCN]['2035'])
        - Math.abs(FIXTURE.expected.byDriver[a].category[FCN]['2035']));
    expect(expected.length).toBeGreaterThan(10);
    // The first ten are shown; the rest behind "Show all".
    expect(cardOrder(aside)).toEqual(expected.slice(0, 10));
    fireEvent.click(within(aside).getByRole('button', { name: `Show all ${expected.length}` }));
    const order = cardOrder(aside);
    expect(order.slice(0, 3)).toEqual(['competitive_r15', 'consumer_r01', 'consumer_r06']);
    expect(order).toEqual(expected);
    // The growth-market currency driver sits well below the large European headwinds.
    expect(order.indexOf('consumer_r36')).toBeGreaterThan(10);

    // The top card opens its driver on the Drivers page by its code.
    fireEvent.click(within(aside).getAllByRole('button', { name: /Opens it on the Drivers page$/ })[0]);
    expect(openDriver).toHaveBeenCalledWith('X-15');
  });

  it('names a card by its short name, adds the long name on the five top-ranked, and shows both on focus', () => {
    STORE.store = buildStore(true);
    const { container } = render(<ShiftAnalysis onNavigateToDriver={vi.fn()} />);
    const aside = openFabricClean(container);
    const cards = within(aside).getAllByRole('button', { name: /Opens it on the Drivers page$/ });
    const names = cardOrder(aside).map((id) => BASE_BY_CODE[codeForDriverId(id) as string]);
    // A card's own lines, without the tooltip it keeps hidden until hover or focus.
    const lines = (card: HTMLElement) => {
      const copy = card.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('[role="tooltip"]').forEach((tip) => tip.remove());
      return copy.textContent ?? '';
    };
    expect(cards.length).toBeGreaterThan(5);
    cards.forEach((card, i) => {
      expect(lines(card)).toContain(names[i].shortName);
      expect(lines(card).includes(names[i].longName)).toBe(i < 5);
    });

    // A card names its description before it is focused, so a screen reader reads it on arrival;
    // the tooltip shows only on hover or focus.
    const tipId = cards[5].getAttribute('aria-describedby');
    expect(tipId).toBeTruthy();
    expect(document.getElementById(tipId as string)?.textContent).toBe(names[5].longName + names[5].descriptor);
    expect(within(aside).queryByRole('tooltip')).toBeNull();
    fireEvent.focus(cards[5]);
    const tip = within(aside).getByRole('tooltip');
    expect(tip.id).toBe(tipId);
    expect(tip.textContent).toBe(names[5].longName + names[5].descriptor);
    fireEvent.blur(cards[5]);
    expect(within(aside).queryByRole('tooltip')).toBeNull();
  });

  it('shows ten drivers, then all of them on "Show all", and folds them again on "Show fewer"', () => {
    STORE.store = buildStore(true);
    const { container } = render(<ShiftAnalysis onNavigateToDriver={vi.fn()} />);
    const aside = openFabricClean(container);
    const exposed = FIXTURE.inputs.drivers.filter((d) => d.category_exposure[FCN] > 0).length;
    expect(cardOrder(aside)).toHaveLength(10);
    const toggle = within(aside).getByRole('button', { name: `Show all ${exposed}` });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(cardOrder(aside)).toHaveLength(exposed);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('Show fewer');
    fireEvent.click(toggle);
    expect(cardOrder(aside)).toHaveLength(10);
  });

  it('shows each driver\'s code as a chip and lets a long name wrap to two lines', () => {
    STORE.store = buildStore(true);
    const { container } = render(<ShiftAnalysis onNavigateToDriver={vi.fn()} />);
    const aside = openFabricClean(container);
    const first = within(aside).getAllByRole('button', { name: /Opens it on the Drivers page$/ })[0];
    // competitive_r15 is X-15 in the generated code map.
    expect(within(first).getByText('X-15')).toBeTruthy();
    const name = within(first).getByText(BASE_BY_CODE['X-15'].shortName) as HTMLElement;
    expect(name.style.whiteSpace).not.toBe('nowrap');
    expect(name.style.webkitLineClamp).toBe('2');
  });

  it('says the drivers cannot be attributed when the configuration did not load, and ranks nothing', () => {
    STORE.store = buildStore(false);
    const { container } = render(<ShiftAnalysis onNavigateToDriver={vi.fn()} />);
    const aside = openFabricClean(container);

    expect(aside.textContent).toContain('attributed with the model configuration, which did not load');
    expect(aside.textContent).not.toContain('the same decomposition as the PRISM Analysis');
    expect(within(aside).queryAllByRole('button', { name: /Opens it on the Drivers page$/ })).toHaveLength(0);
  });

  it('says so when the drivers did not load', () => {
    STORE.store = buildStore(true, false);
    const { container } = render(<ShiftAnalysis onNavigateToDriver={vi.fn()} />);
    const aside = openFabricClean(container);
    expect(aside.textContent).toContain('attributed with the drivers, which did not load');
    expect(within(aside).queryAllByRole('button', { name: /Opens it on the Drivers page$/ })).toHaveLength(0);
  });
});

describe('the drill-down header actions', () => {
  it('downloads the panel as CSV: the shift path, the force attribution, then the ranked drivers with their codes', async () => {
    STORE.store = buildStore(true);
    const blobs: Blob[] = [];
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { blobs.push(blob as Blob); return 'blob:x'; });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const downloads: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    try {
      const { container } = render(<ShiftAnalysis onNavigateToDriver={vi.fn()} />);
      const aside = openFabricClean(container);
      fireEvent.click(within(aside).getByRole('button', { name: 'Download this drill-down as CSV' }));
      expect(within(aside).getByRole('status').textContent).toBe('CSV downloaded');
      expect(downloads).toEqual(['PRISM-Fabric-Clean-drill-down-2035.csv']);
      const lines = (await blobs[0].text()).split('\r\n');
      expect(lines[0]).toBe('PRISM Shift Analysis drill-down');
      expect(lines[1]).toBe('Category,Fabric Clean,Laundry & Home Care');
      expect(lines[2]).toBe('Year,2035');
      expect(lines).toContain('Year,Median,P10,P90');
      expect(lines.filter((l) => /^20\d\d,[+-]?\d+\.\d%,[+-]?\d+\.\d%,[+-]?\d+\.\d%$/.test(l))).toHaveLength(10);
      expect(lines).toContain('Force,Attribution 2035');
      const rankHeader = lines.indexOf('Rank,Driver,Long name,Technical scope,Code,Force,Exposure,Share of movement,Contribution 2035');
      expect(rankHeader).toBeGreaterThan(0);
      // the short name and the long name, never the technical scope
      const x15 = BASE_BY_CODE['X-15'];
      expect(lines[rankHeader + 1].startsWith(`1,${x15.shortName},${x15.longName},competitive_r15,X-15,Competitive,`)).toBe(true);
      expect(lines[rankHeader + 1]).toMatch(/,\d\/5,\d+%,-\d+\.\d%$/);
      // Every exposed driver is in the file, not only the ten on screen.
      const exposed = FIXTURE.inputs.drivers.filter((d) => d.category_exposure[FCN] > 0).length;
      expect(lines.slice(rankHeader + 1).filter(Boolean)).toHaveLength(exposed);
    } finally {
      click.mockRestore();
      create.mockRestore();
      revoke.mockRestore();
    }
  });

  it('shows "Esc to close" only once a key has been pressed in the session', () => {
    STORE.store = buildStore(true);
    const { container } = render(<ShiftAnalysis onNavigateToDriver={vi.fn()} />);
    const aside = openFabricClean(container);
    expect(within(aside).queryByText('Esc to close')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'Shift' });
    expect(within(aside).getByText('Esc to close')).toBeTruthy();
  });
});

describe('a row whose median disagrees with the net at the means', () => {
  it('keeps every driver at its value at the means, never turned around', () => {
    const exposed = categoryMap({ [FCN]: 5 });
    const drivers = [makeDriver({ id: 'up', category_exposure: exposed }), makeDriver({ id: 'down', category_exposure: exposed })];
    const at = (v: number) => ({ portfolio: {}, category: { [FCN]: { 2035: v } } });
    const attribution: AttributionResult = {
      years: [2035], byDriver: { up: at(0.02), down: at(-0.019) }, categoryShift: {}, portfolioShift: {},
    };
    // The net at the means is +0.1 pt, the median -0.3 pt: scaling to it would turn both drivers around.
    const ranked = rankContributors(FCN, drivers, attribution, -0.003);
    expect(ranked.map((c) => [c.driver.id, c.contribution])).toEqual([['up', 0.02], ['down', -0.019]]);
  });
});
