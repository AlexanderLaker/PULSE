// @vitest-environment jsdom
/**
 * The category drill-down ranks its contributing drivers with the same
 * decomposition the PRISM Analysis readings are written on (owner instruction
 * 2026-09-17, F-30). Rendered end to end from the parity fixture the Python
 * build writes: the Shift Analysis page mounts on a store whose drivers,
 * configuration layers and cell weights are the fixture's inputs and whose
 * category medians are the fixture's category shifts, the fabric-clean row
 * is opened, and the drill-down must
 *
 *   1. name the score-means basis in its footer (never the exposure proxy),
 *   2. rank the drivers as the fixture does (X-15 first, then C-01, C-06),
 *   3. fall back to the labelled exposure proxy, with the old ranking, when
 *      the configuration layers are not served.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';

const STORE = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));

vi.mock('@/hooks/usePrism', () => ({
  __esModule: true,
  default: () => STORE.store,
  PrismProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/api/client', () => ({
  getDiagnostics: vi.fn(async () => ({ db_reachable: true, simulation_run_count: 1 })),
  updateTrend: vi.fn(),
}));

// The drill-down's fan chart renders in a Recharts ResponsiveContainer, which
// needs a ResizeObserver; jsdom has none, and the chart is not under test.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

import ProfitPoolAnalysis2 from '@/components/dashboard/ProfitPoolAnalysis2';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = JSON.parse(fs.readFileSync(
  path.join(REPO, 'tests', 'frontend', 'fixtures', 'driverAttribution.fixture.json'), 'utf8'));
const YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];
const FCN = 'LHC: FCN';

type FixtureTrend = {
  id: string; force: string; normalized_score: number;
  category_exposure: Record<string, number>; regional_exposure: Record<string, number>;
  uncertainty: number | null; peak_year: number | null; diffusion_curve: string | null; start_year: number | null;
};

const NAMES: Record<string, string> = {
  competitive_r15: 'Scale-leader innovation and A&P escalation',
  consumer_r01: 'Private label structural penetration',
  consumer_r06: 'Cost-of-living squeeze, round two',
  consumer_r36: 'Growth-market currency depreciation',
};

function buildStore(withConfigLayers: boolean) {
  const trends = (FIXTURE.inputs.trends as FixtureTrend[]).map((t) => ({
    ...t,
    name: NAMES[t.id] ?? `Driver ${t.id}`,
    direction: t.normalized_score < 0 ? 'Contraction' : 'Expansion',
    probability: 4, confidence: 'Medium', description: 'd',
    gp1_shift: t.normalized_score, vc_exposure: {}, source_type: 'seed', data_source: 's',
    strategic_implication: 'Weight in the answer: x.',
  }));
  const shifts: Record<string, Record<number, unknown>> = {};
  for (const cat of FIXTURE.inputs.categories as string[]) {
    shifts[cat] = {};
    for (const y of YEARS) {
      const m = FIXTURE.expected.categoryShift[cat][String(y)] as number;
      shifts[cat][y] = { median: m, p10: m * 1.1, p25: m * 1.05, p75: m * 0.95, p90: m * 0.9 };
    }
  }
  const cfg = FIXTURE.inputs.config;
  return {
    health: { status: 'ok', version: 'test', has_simulation: true },
    trends,
    simulation: {
      shifts,
      cell_weights_used: FIXTURE.inputs.cellWeights,
      run_meta: { run_id: 99, iterations: 50000, model_type: 'bayesian_copula', model_version: '2.12.0' },
    },
    config: withConfigLayers
      ? { force_weights: cfg.force_weights, per_force_attenuation: cfg.per_force_attenuation,
          within_force_overlap: cfg.within_force_overlap, base_year: cfg.base_year, path_years: cfg.path_years }
      : { iterations: 500 },
    loading: false, error: null, backendAvailable: true, connectionState: 'connected',
    updateTrend: vi.fn(), reload: vi.fn(), reconnect: vi.fn(),
  };
}

function openFabricClean(container: HTMLElement): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: /Open Fabric Clean detail/ }));
  const aside = container.querySelector('aside') as HTMLElement;
  expect(aside).toBeTruthy();
  return aside;
}

function driverOrder(aside: HTMLElement): string[] {
  const text = aside.textContent ?? '';
  return Object.values(NAMES)
    .map((n) => ({ n, i: text.indexOf(n) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.n);
}

afterEach(() => cleanup());

describe('category drill-down: contributing drivers at the score means', () => {
  it('names the score-means basis and ranks the fabric-clean drivers as the fixture does', () => {
    STORE.store = buildStore(true);
    const { container } = render(<ProfitPoolAnalysis2 />);
    const aside = openFabricClean(container);
    expect(aside.textContent).toContain('the same decomposition as the PRISM Analysis');
    expect(aside.textContent).not.toContain('exposure proxy');
    // the fixture's own order in fabric clean at 2035
    const exact = FIXTURE.expected.byDriver as Record<string, { category: Record<string, Record<string, number>> }>;
    const fixtureOrder = Object.keys(exact)
      .filter((id) => id in NAMES)
      .sort((a, b) => exact[a].category[FCN]['2035'] - exact[b].category[FCN]['2035'])
      .map((id) => NAMES[id]);
    expect(fixtureOrder[0]).toBe(NAMES.competitive_r15);
    expect(driverOrder(aside)).toEqual(fixtureOrder);
    // the growth-market driver (F-30) sits below the three large European headwinds
    expect(driverOrder(aside).indexOf(NAMES.consumer_r36)).toBe(3);
    expect(within(aside).getByText(/Contributing Drivers/)).toBeTruthy();
  });

  it('falls back to the labelled exposure proxy when the configuration layers are not served', () => {
    STORE.store = buildStore(false);
    const { container } = render(<ProfitPoolAnalysis2 />);
    const aside = openFabricClean(container);
    expect(aside.textContent).toContain('Contributing drivers: exposure proxy');
    expect(aside.textContent).not.toContain('the same decomposition as the PRISM Analysis');
    // the proxy ranks by Shift x exposure: private label (the largest Shift value) first
    expect(driverOrder(aside)[0]).toBe(NAMES.consumer_r01);
  });
});
