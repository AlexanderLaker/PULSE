// @vitest-environment jsdom
/**
 * The Shift Analysis page without a run says why, from the service's own
 * diagnosis (unreachable, no run yet, a run that cannot be served, no
 * database, a database awaiting the migration, none configured); above the
 * matrix it says when the drivers or the engine no longer match the run;
 * the impact filter splits the net by the drivers' contributions and needs
 * the model configuration and the drivers; its "About this model" footer names the run's
 * cell-weight basis and the pass-through of the served configuration.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import type { DiagnosticsResult } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { ESTIMATED_CELL_WEIGHTS } from '@/lib/cellWeightProvenance';
import { computeDriverAttribution } from '@/lib/driverAttribution';
import { CATEGORY_NAMES, YEARS } from '@/lib/format';
import { distribution, makeConfig, makeDriver, makeSimulation, makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ store: null as unknown as PrismStore }));
const DIAGNOSIS = vi.hoisted(() => ({ result: null as DiagnosticsResult | null }));

vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.store }));
vi.mock('@/lib/apiClient', () => ({ getDiagnostics: vi.fn(async () => DIAGNOSIS.result) }));

// The drill-down's fan chart renders in a Recharts ResponsiveContainer, which
// needs a ResizeObserver; jsdom has none, and the chart is not under test.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

import ShiftAnalysis from '@/components/dashboard/ShiftAnalysis';

function diagnosis(overrides: Partial<DiagnosticsResult>): DiagnosticsResult {
  return {
    db_reachable: true, simulation_run_count: 0, latest_run_id: null, error: null,
    simulation_reason: 'no_rows', version: 'test', ...overrides,
  };
}

function openAbout() {
  fireEvent.click(screen.getByRole('button', { name: /About this model/ }));
}

afterEach(() => cleanup());

describe('Shift Analysis without a run', () => {
  it('tells a viewer that results are unavailable when the service does not answer', async () => {
    STORE.store = makeStore({ simulation: null });
    DIAGNOSIS.result = null;
    render(<ShiftAnalysis />);
    expect(await screen.findByText('Results unavailable right now')).toBeTruthy();
  });

  it('tells an admin which of the reasons applies', async () => {
    const cases: Array<[DiagnosticsResult | null, string]> = [
      [null, 'The run cannot be loaded'],
      [diagnosis({ simulation_reason: 'no_rows' }), 'No run stored yet'],
      [diagnosis({ simulation_reason: 'malformed', latest_run_id: 99 }), 'Latest run cannot be served'],
      [diagnosis({ simulation_reason: 'db_error', db_reachable: false }), 'The API cannot reach the database'],
      [diagnosis({ simulation_reason: 'migration_pending' }), 'The database awaits a migration'],
      [diagnosis({ simulation_reason: 'no_database', db_reachable: false }), 'No database configured'],
      [diagnosis({ simulation_reason: 'drivers_missing', latest_run_id: 99 }), 'The database has lost its drivers'],
    ];
    for (const [result, title] of cases) {
      STORE.store = makeStore({ simulation: null });
      DIAGNOSIS.result = result;
      render(<ShiftAnalysis isAdmin />);
      expect(await screen.findByText(title)).toBeTruthy();
      cleanup();
    }
  });

  it('shows an admin what the unservable run lacks', async () => {
    STORE.store = makeStore({ simulation: null });
    DIAGNOSIS.result = diagnosis({
      simulation_reason: 'malformed', latest_run_id: 99,
      error: 'run 99 lacks seed_stability; re-run scripts/run_production.py',
    });
    render(<ShiftAnalysis isAdmin />);
    expect(await screen.findByText(/run 99 lacks seed_stability/)).toBeTruthy();
    expect(screen.getByText('#99')).toBeTruthy();
  });

  it("shows an admin why the dashboard's request for a stored run failed", async () => {
    STORE.store = makeStore({ simulation: null, simulationError: 'Invalid or expired token' });
    DIAGNOSIS.result = diagnosis({ simulation_reason: 'ok', latest_run_id: 99 });
    render(<ShiftAnalysis isAdmin />);
    expect(await screen.findByText('The run cannot be loaded')).toBeTruthy();
    expect(screen.getByText('Invalid or expired token')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(STORE.store.reload).toHaveBeenCalled();
  });

  it('treats a store that lost the service as unreachable without asking it', () => {
    STORE.store = makeStore({ simulation: null, apiAvailable: false });
    DIAGNOSIS.result = diagnosis({ simulation_reason: 'no_rows' });
    render(<ShiftAnalysis />);
    expect(screen.getByText('Results unavailable right now')).toBeTruthy();
    expect(screen.getByText(/The PRISM service cannot be reached/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(STORE.store.reload).toHaveBeenCalled();
  });
});

describe('Shift Matrix lenses', () => {
  it('shows the same grand total in every lens as the Time Path total of that year', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const timeTotal = screen.getByTitle(/^2035, column total: /).getAttribute('title')!.replace(/^2035, column total: /, '');
    for (const lens of ['Force attribution', 'Value-chain epicentre attribution', 'Region attribution']) {
      fireEvent.click(screen.getByRole('button', { name: lens }));
      expect(screen.getByText('Total 2035')).toBeTruthy();
      expect(screen.getByTitle(/^Grand total: /).getAttribute('title')).toBe(`Grand total: ${timeTotal}`);
    }
  });

  it('names what a cell holds: the median on the Time Path, the attribution or the filtered part elsewhere', () => {
    STORE.store = makeStore();
    const { container } = render(<ShiftAnalysis />);
    const hoverCard = (cell: HTMLElement) => {
      fireEvent.mouseEnter(cell);
      const card = container.querySelector('div.fixed') as HTMLElement;
      const text = card.textContent ?? '';
      fireEvent.mouseLeave(cell);
      return text;
    };
    const median = screen.getByLabelText(/^Toilet Care, 2035: median [+-]?\d+\.\d%, P10 /);
    expect(hoverCard(median)).toMatch(/Median[+-]?\d+\.\d%P10/);
    fireEvent.click(screen.getByRole('button', { name: 'Contraction drivers' }));
    const part = screen.getByLabelText(/^Toilet Care, 2035: contraction drivers’ part [+-]?\d+\.\d%$/);
    expect(hoverCard(part)).toContain('Contraction drivers’ part');
    fireEvent.click(screen.getByRole('button', { name: 'Force attribution' }));
    const force = screen.getByLabelText(/^Toilet Care, Consumer: force attribution [+-]?\d+\.\d%$/);
    const text = hoverCard(force);
    expect(text).toContain('Force attribution');
    expect(text).not.toContain('Median');
  });

  it('names every figure of the KPI tiles to a screen reader', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const portfolio = screen.getByRole('group', { name: /^Portfolio exposure/ });
    expect(portfolio.getAttribute('aria-label')).toMatch(
      /^Portfolio exposure \(if no action\) · by 2035: median -\d+\.\d%, P10 -\d+\.\d% to P90 [+-]?\d+\.\d%, 80% of outcomes \(joint portfolio\)$/);
    const exposed = screen.getByRole('button', { name: /^Most exposed category: / });
    expect(exposed.getAttribute('aria-label')).toMatch(
      /^Most exposed category: [A-Z][\w ]+, median -\d+\.\d%, P10 .+ to P90 .+, 80% of outcomes\. Opens the drill-down$/);
  });

  it('opens the drill-down at the lens year chosen with the stepper', () => {
    STORE.store = makeStore();
    const { container } = render(<ShiftAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: 'Region attribution' }));
    fireEvent.click(screen.getByRole('button', { name: 'Earlier year' }));
    expect(screen.getByText('Total 2034')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open Toilet Care detail/ }));
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.getAttribute('aria-label')).toBe('Toilet Care drill-down');
    expect(aside.textContent).toContain('Force attribution · 2034');
    expect(aside.textContent).toContain('Regional shift · 2034');
    expect(aside.textContent).toContain('North America');
    expect(aside.textContent).toContain('splits the row’s median in 2034 by the size of each force’s drivers, not their direction');
  });

  it('opens the drill-down at the horizon on the Time Path, whatever year the stepper was left on', () => {
    STORE.store = makeStore();
    const { container } = render(<ShiftAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: 'Force attribution' }));
    fireEvent.click(screen.getByRole('button', { name: 'Earlier year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Time Path' }));
    fireEvent.click(screen.getByRole('button', { name: /Open Toilet Care detail/ }));
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.textContent).toContain('Force attribution · 2035');
    expect(aside.textContent).toContain('Regional shift · 2035');
  });

  it('says in the drill-down when drivers changed since the run', () => {
    STORE.store = makeStore({
      simulation: makeSimulation({ inputs_since_run: { changed: ['consumer_r01'], added: [], removed: [] } }),
    });
    const { container } = render(<ShiftAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /Open Toilet Care detail/ }));
    const aside = container.querySelector('aside') as HTMLElement;
    expect(within(aside).getByRole('note').textContent).toContain('One driver has changed since this run');
  });
});

describe('the impact filter', () => {
  const total2035 = () => screen.getByTitle(/^2035, column total: /).getAttribute('title');

  it('splits the net by the drivers behind it: all of it for the contracting side here, none for the other', () => {
    // One driver, a contracting one, and a run whose medians are its shift at the means.
    const driver = makeDriver();
    const config = makeConfig();
    const attribution = computeDriverAttribution({
      drivers: [driver], categories: CATEGORY_NAMES, config, cellWeights: ESTIMATED_CELL_WEIGHTS,
    });
    const shifts = Object.fromEntries(CATEGORY_NAMES.map((c) => [c, Object.fromEntries(
      YEARS.map((y) => [String(y), distribution(attribution.categoryShift[c][y])]))]));
    STORE.store = makeStore({ drivers: [driver], config, simulation: makeSimulation({ shifts }) });
    render(<ShiftAnalysis />);
    const net = total2035();
    fireEvent.click(screen.getByRole('button', { name: 'Contraction drivers' }));
    expect(total2035()).toBe(net);
    fireEvent.click(screen.getByRole('button', { name: 'Expansion drivers' }));
    expect(total2035()).toMatch(/: [+-]?0\.0%$/);
  });

  it('shows the drivers at the means where the run is far from them, never turned around', () => {
    // The fixture run's medians are about four times this driver's shift at the means.
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const net = total2035();
    fireEvent.click(screen.getByRole('button', { name: 'Contraction drivers' }));
    const contraction = total2035();
    expect(contraction).not.toBe(net);
    expect(contraction).toMatch(/: -\d+\.\d%$/);
    fireEvent.click(screen.getByRole('button', { name: 'Expansion drivers' }));
    expect(total2035()).toMatch(/: [+-]?0\.0%$/);
  });

  it.each([
    ['the model configuration', { config: null }],
    ['the drivers', { drivers: [] }],
  ])('cannot be used without %s, which the split needs', (missing, overrides) => {
    STORE.store = makeStore(overrides);
    render(<ShiftAnalysis />);
    for (const name of ['Expansion drivers', 'Contraction drivers']) {
      const button = screen.getByRole('button', { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.title).toBe(`Needs ${missing}, which did not load; reload the page to try again.`);
    }
    expect((screen.getByRole('button', { name: 'Net' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('what the served run does not show yet', () => {
  it('names the drivers edited since the run', () => {
    STORE.store = makeStore({
      simulation: makeSimulation({ inputs_since_run: { changed: ['consumer_r01', 'technology_r01'], added: [], removed: [] } }),
    });
    render(<ShiftAnalysis />);
    expect(screen.getByRole('status').textContent).toContain('2 drivers have changed since this run (C-01, T-01)');
  });

  it('says when the run comes from an older engine: the next production run catches up', () => {
    STORE.store = makeStore({ health: { ...makeStore().health!, version: '2.13.0' } });
    render(<ShiftAnalysis />);
    const text = screen.getByRole('status').textContent;
    expect(text).toContain('computed by engine 2.12.0; the service runs 2.13.0');
    expect(text).toContain('after the next production run');
  });

  it('says when the run comes from a newer engine, as between a model change\'s run and its deploy', () => {
    // 2.9.0 against 2.12.0: the parts compare as numbers, not as text.
    for (const service of ['2.11.0', '2.9.0']) {
      STORE.store = makeStore({ health: { ...makeStore().health!, version: service } });
      render(<ShiftAnalysis />);
      const text = screen.getByRole('status').textContent;
      expect(text).toContain(`computed by engine 2.12.0, which the service does not run yet (it runs ${service})`);
      expect(text).not.toContain('next production run');
      cleanup();
    }
  });

  it('says nothing while the run matches the drivers and the engine', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('the lens toolbar', () => {
  it('keeps the keyboard focus on the lens control when the lens changes', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const force = screen.getByRole('button', { name: 'Force attribution' });
    force.focus();
    fireEvent.click(force);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Force attribution' }));
  });
});

describe('About this model', () => {
  it('names the estimated HCB mix as the basis of a run on the estimate', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    openAbout();
    expect(screen.getByText('Run #99')).toBeTruthy();
    expect(screen.getByText('13 Sep 2026, 23:04 UTC')).toBeTruthy();
    expect(screen.getByText('estimated HCB mix, not Henkel P&L (52 cells)')).toBeTruthy();
    expect(screen.getByText('0.010 pp spread across 3 seeds (2035 portfolio median)')).toBeTruthy();
    expect(screen.getByText('at most 0.001 pp (2035 category medians)')).toBeTruthy();
    expect(screen.getByText(/measure Monte Carlo sampling noise only, never the model's own error/)).toBeTruthy();
    // and the page says it next to the numbers, not only in the footer
    expect(screen.getByTestId('estimate-note').textContent).toContain('estimated HCB gross-profit mix');
    expect(screen.getByTestId('estimate-note').textContent).toContain('not Henkel P&L');
  });

  it("names a weights file by its own label, whatever its numbers", () => {
    const finance = JSON.parse(JSON.stringify(ESTIMATED_CELL_WEIGHTS)) as Record<string, Record<string, number>>;
    finance['LHC: FCN'].Europe += 0.01;
    finance['Hair: Color'].Europe -= 0.01;
    STORE.store = makeStore({
      simulation: makeSimulation({ cell_weights_used: finance, cell_weights_source: 'Finance GP1 shares FY2025' }),
    });
    render(<ShiftAnalysis />);
    openAbout();
    expect(screen.getByText('from the file given to the run (52 cells)')).toBeTruthy();
    expect(screen.getByText('Finance GP1 shares FY2025')).toBeTruthy();
    expect(screen.queryByText(/estimated HCB mix/)).toBeNull();
    expect(screen.queryByTestId('estimate-note')).toBeNull();
  });

  it('reads the basis from the label the run stored, not from matching numbers', () => {
    STORE.store = makeStore({
      simulation: makeSimulation({ cell_weights_source: 'Test grid: equal shares' }),   // the estimate's numbers
    });
    render(<ShiftAnalysis />);
    openAbout();
    expect(screen.getByText('from the file given to the run (52 cells)')).toBeTruthy();
  });

  it('shows the pass-through per force of the served configuration, largest first', () => {
    STORE.store = makeStore({ config: makeConfig() });
    const { container } = render(<ShiftAnalysis />);
    openAbout();
    // force weight 1/6 x attenuation: Consumer 0.487 -> 8.1%, Environmental 0.378 -> 6.3%
    expect(screen.getByText('8.1%')).toBeTruthy();
    expect(screen.getByText('6.3%')).toBeTruthy();
    const text = container.textContent ?? '';
    const consumer = text.indexOf('Consumer8.1%');
    const environmental = text.indexOf('Environmental6.3%');
    expect(consumer).toBeGreaterThanOrEqual(0);
    expect(environmental).toBeGreaterThan(consumer);
    expect(text).toContain('changing them is a code change followed by a new production run');
    // "Reading the level" states the range and its example from the same values
    expect(text).toContain('the structural pass-through, is 6.3% to 8.1% by force');
    expect(text).toContain('moves that category by 1.3% to 1.6% at full materialisation, not 20%');
  });

  it('says where the pass-through appears while the configuration has not loaded', () => {
    STORE.store = makeStore({ config: null });
    const { container } = render(<ShiftAnalysis />);
    openAbout();
    const text = container.textContent ?? '';
    expect(text).toContain('the structural pass-through of each force, is listed below once the model configuration has loaded');
    expect(text).not.toContain('at full materialisation');
  });

  it('states the uncertainty tables the engine uses', () => {
    STORE.store = makeStore({ config: makeConfig() });
    const { container } = render(<ShiftAnalysis />);
    openAbout();
    const text = container.textContent ?? '';
    expect(text).toContain('peak-year jitter of up to ±4 years');
    expect(text).toContain('the prior at uncertainty score 3 (α+β=6)');
    expect(text).toContain('from α+β=24 at score 0 to 3 at score 5');
  });
});
