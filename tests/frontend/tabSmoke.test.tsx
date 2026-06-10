// @vitest-environment jsdom
/**
 * Render smoke tests (review #7): each production tab must mount and
 * show its headline content against a canned store — catches
 * "whitescreen on missing field" regressions cheaply. Not a visual or
 * interaction test; those belong to the rewrite's own suite.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

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

import ProfitPoolAnalysis2 from '@/components/dashboard/ProfitPoolAnalysis2';
import Trends2 from '@/components/dashboard/Trends2';
import ConsumerJourney2 from '@/components/dashboard/ConsumerJourney2';

const trend = {
  id: 'consumer_r1', name: 'Test trend', force: 'Consumer',
  direction: 'Contraction', probability: 4, confidence: 'High',
  description: 'd', normalized_score: -0.02, gp1_shift: -0.02,
  category_exposure: { 'Hair: Color': 3 }, vc_exposure: {},
  source_type: 'seed', data_source: 's',
};
const shifts: Record<string, Record<number, unknown>> = {};
for (const cat of ['Hair: Color', 'Hair: Care']) {
  shifts[cat] = {};
  for (const y of [2026, 2030, 2035]) {
    shifts[cat][y] = { median: -0.012, p10: -0.03, p25: -0.02, p75: -0.005, p90: 0.001 };
  }
}

STORE.store = {
  health: { status: 'ok', version: 'test', has_simulation: true },
  trends: [trend],
  simulation: {
    shifts,
    convergence: { 'Hair: Color': { r_hat: 1.01, ess: 400, converged: true } },
    run_meta: { run_id: 7, iterations: 500, model_type: 'bayesian_copula' },
  },
  config: { category_weights: { 'Hair: Color': 2 }, iterations: 500 },
  loading: false, error: null, backendAvailable: true,
  connectionState: 'connected',
  updateTrend: vi.fn(), reload: vi.fn(), reconnect: vi.fn(),
};

afterEach(() => cleanup());

describe('production tab smoke renders', () => {
  it('ProfitPoolAnalysis2 mounts with canned store', () => {
    const { container } = render(<ProfitPoolAnalysis2 />);
    expect(container.textContent).toBeTruthy();
    expect(container.textContent!.length).toBeGreaterThan(100);
  });
  it('Trends2 mounts with canned store', () => {
    const { container } = render(<Trends2 />);
    expect(container.textContent).toBeTruthy();
    expect(container.textContent).toContain('Test trend');
  });
  it('ConsumerJourney2 mounts (static content page)', () => {
    const { container } = render(
      <ConsumerJourney2
        onNavigateProfitPoolShiftModel={() => {}}
        onNavigateTrends={() => {}}
        onNavigateInnovation={() => {}}
      />,
    );
    expect(container.textContent).toBeTruthy();
    expect(container.textContent!.length).toBeGreaterThan(100);
  });
});
