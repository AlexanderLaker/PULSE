// @vitest-environment jsdom
/**
 * The category drill-down ranks its contributing drivers with the same
 * decomposition the PRISM Analysis readings are written on. Rendered end to
 * end from the parity fixture the Python build writes: the Shift Analysis
 * page mounts on a store whose drivers, configuration and cell weights are
 * the fixture's inputs and whose category medians are the fixture's category
 * shifts; the fabric-clean row is opened, and the drill-down must
 *
 *   1. name the score-means basis in its footer (never the exposure proxy),
 *   2. rank the drivers as the fixture does (X-15, C-01, C-06 first),
 *   3. fall back to the labelled exposure proxy, ranked by Shift x exposure,
 *      when the configuration did not load.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import type { Driver, ForceName, ShiftPath } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { distribution, makeConfig, makeDriver, makeSimulation, makeStore } from './fixtures/prism';

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

type FixtureDriver = Pick<Driver,
  'id' | 'normalized_score' | 'category_exposure' | 'regional_exposure'
  | 'uncertainty' | 'peak_year' | 'diffusion_curve' | 'start_year'> & { force: string };

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'driverAttribution.fixture.json'), 'utf8')) as {
  inputs: {
    drivers: FixtureDriver[];
    config: { force_weights: Record<ForceName, number>; per_force_attenuation: Record<ForceName, number>;
      within_force_overlap: Record<ForceName, number>; base_year: number; path_years: number[]; peak_year_jitter: number };
    cellWeights: Record<string, Record<string, number>>;
  };
  expected: {
    byDriver: Record<string, { category: Record<string, Record<string, number>> }>;
    categoryShift: Record<string, Record<string, number>>;
  };
};
const FCN = 'LHC: FCN';

/** The fixture's drivers, each named by its id so a card's name is the driver's id. */
function fixtureDrivers(): Driver[] {
  return FIXTURE.inputs.drivers.map((d) => makeDriver({
    ...d,
    force: d.force as ForceName,
    name: d.id,
    direction: d.normalized_score < 0 ? 'Contraction' : 'Expansion',
  }));
}

function buildStore(configLoaded: boolean): PrismStore {
  const shifts: Record<string, ShiftPath> = Object.fromEntries(
    Object.entries(FIXTURE.expected.categoryShift).map(([cat, byYear]) => [
      cat, Object.fromEntries(Object.entries(byYear).map(([year, median]) => [year, distribution(median)])),
    ]),
  );
  const cfg = FIXTURE.inputs.config;
  return makeStore({
    drivers: fixtureDrivers(),
    simulation: makeSimulation({ shifts, cell_weights_used: FIXTURE.inputs.cellWeights }),
    config: configLoaded
      ? makeConfig({
          force_weights: cfg.force_weights,
          per_force_attenuation: cfg.per_force_attenuation,
          within_force_overlap: cfg.within_force_overlap,
          base_year: cfg.base_year,
          path_years: cfg.path_years,
          peak_year_jitter: cfg.peak_year_jitter,
        })
      : null,
  });
}

function openFabricClean(container: HTMLElement): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: /Open Fabric Clean detail/ }));
  const aside = container.querySelector('aside') as HTMLElement;
  expect(aside).toBeTruthy();
  return aside;
}

/** The driver cards in rank order, by driver id. */
function cardOrder(aside: HTMLElement): string[] {
  return within(aside)
    .getAllByRole('button', { name: /on the Drivers page$/ })
    .map((card) => /^Open "(.+)" on the Drivers page$/.exec(card.getAttribute('aria-label') ?? '')?.[1] ?? '');
}

afterEach(() => cleanup());

describe('category drill-down: contributing drivers at the score means', () => {
  it('names the score-means basis and ranks the fabric-clean drivers as the fixture does', () => {
    STORE.store = buildStore(true);
    const openDriver = vi.fn();
    const { container } = render(<ShiftAnalysis onNavigateToDriver={openDriver} />);
    const aside = openFabricClean(container);

    expect(aside.textContent).toContain('the same decomposition as the PRISM Analysis');
    expect(aside.textContent).not.toContain('exposure proxy');
    expect(within(aside).getByText(/Contributing Drivers/)).toBeTruthy();

    const expected = FIXTURE.inputs.drivers
      .filter((d) => (d.category_exposure[FCN] ?? 0) > 0)
      .map((d) => d.id)
      .sort((a, b) => Math.abs(FIXTURE.expected.byDriver[b].category[FCN]['2035'])
        - Math.abs(FIXTURE.expected.byDriver[a].category[FCN]['2035']));
    const order = cardOrder(aside);
    expect(order.slice(0, 3)).toEqual(['competitive_r15', 'consumer_r01', 'consumer_r06']);
    expect(order).toEqual(expected);
    // The growth-market currency driver sits well below the large European headwinds.
    expect(order.indexOf('consumer_r36')).toBeGreaterThan(10);

    fireEvent.click(within(aside).getAllByRole('button', { name: /on the Drivers page$/ })[0]);
    expect(openDriver).toHaveBeenCalledWith('competitive_r15');
  });

  it('falls back to the labelled exposure proxy when the configuration did not load', () => {
    STORE.store = buildStore(false);
    const { container } = render(<ShiftAnalysis onNavigateToDriver={vi.fn()} />);
    const aside = openFabricClean(container);

    expect(aside.textContent).toContain('Contributing drivers: exposure proxy');
    expect(aside.textContent).not.toContain('the same decomposition as the PRISM Analysis');
    // The proxy ranks by Shift x exposure / 5: private label (the largest) first.
    const order = cardOrder(aside);
    expect(order.slice(0, 3)).toEqual(['consumer_r01', 'competitive_r15', 'customer_r13']);
  });
});
