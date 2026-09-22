// @vitest-environment jsdom
/**
 * The Shift Analysis page without a run says why, from the service's own
 * diagnosis (unreachable, no run yet, a run that cannot be served, no
 * database), and its "About this model" footer names the run's cell-weight
 * basis and the pass-through of the served configuration.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { DiagnosticsResult } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { ESTIMATED_CELL_WEIGHTS } from '@/lib/cellWeightProvenance';
import { makeConfig, makeSimulation, makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ store: null as unknown as PrismStore }));
const DIAGNOSIS = vi.hoisted(() => ({ result: null as DiagnosticsResult | null }));

vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.store }));
vi.mock('@/api/client', () => ({ getDiagnostics: vi.fn(async () => DIAGNOSIS.result) }));

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
    db_mode: 'postgres', db_host: 'ep-example.neon.tech', db_url_env: 'POSTGRES_URL', db_reachable: true,
    simulation_run_count: 0, latest_run_id: null, latest_run_date: null, error: null,
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

  it('tells an admin which of the four reasons applies', async () => {
    const cases: Array<[DiagnosticsResult | null, string]> = [
      [null, 'The run cannot be loaded'],
      [diagnosis({ simulation_reason: 'no_rows' }), 'No simulation persisted yet'],
      [diagnosis({ simulation_reason: 'malformed', latest_run_id: 99 }), 'Latest run cannot be served'],
      [diagnosis({ simulation_reason: 'db_error', db_reachable: false }), 'Backend cannot reach the database'],
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

  it('treats a store that lost the service as unreachable without asking it', () => {
    STORE.store = makeStore({ simulation: null, backendAvailable: false, connectionState: 'offline' });
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
    for (const lens of ['Force attribution', 'Value chain epicentre attribution', 'Region attribution']) {
      fireEvent.click(screen.getByRole('button', { name: lens }));
      expect(screen.getByText('Total 2035')).toBeTruthy();
      expect(screen.getByTitle(/^Grand total: /).getAttribute('title')).toBe(`Grand total: ${timeTotal}`);
    }
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
    expect(aside.textContent).toContain('Regional Shift');
    expect(aside.textContent).toContain('North America');
  });
});

describe('About this model', () => {
  it('names the estimated HCB mix as the basis of a run on the estimate', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    openAbout();
    expect(screen.getByText('Run #99')).toBeTruthy();
    expect(screen.getByText('estimated HCB mix, not Henkel P&L (52 cells)')).toBeTruthy();
    expect(screen.getByText('±0.01 pp across 3 seeds (2035 portfolio median)')).toBeTruthy();
  });

  it('names a finance file by its own label', () => {
    const finance = JSON.parse(JSON.stringify(ESTIMATED_CELL_WEIGHTS)) as Record<string, Record<string, number>>;
    finance['LHC: FCN'].Europe += 0.01;
    finance['Hair: Color'].Europe -= 0.01;
    STORE.store = makeStore({
      simulation: makeSimulation({ cell_weights_used: finance, cell_weights_source: 'Finance GP1 shares FY2025' }),
    });
    render(<ShiftAnalysis />);
    openAbout();
    expect(screen.getByText('finance figures (52 cells)')).toBeTruthy();
    expect(screen.getByText('Finance GP1 shares FY2025')).toBeTruthy();
    expect(screen.queryByText(/estimated HCB mix/)).toBeNull();
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
    expect(text).toContain('changing it is a code change followed by a new production run');
  });
});
