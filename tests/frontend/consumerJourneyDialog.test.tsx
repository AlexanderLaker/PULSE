// @vitest-environment jsdom
/**
 * Consumer Journey rework suite (2026-06-27) — interaction tests for the
 * declutter (parenthetical stripping) and the full-screen Why-chain dialog.
 * Renders against a canned store; verifies the de-blackbox ladder actually
 * mounts and connects to the live trend.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';

const STORE = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));

vi.mock('@/hooks/usePrism', () => ({
  __esModule: true,
  default: () => STORE.store,
  PrismProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/api/client', () => ({ getDiagnostics: vi.fn(), updateTrend: vi.fn() }));

import ConsumerJourney2 from '@/components/dashboard/ConsumerJourney2';

// T-01 → technology_r01 (the first Sorting / benefiting tile links it).
// (M8, 2026-07-06: the phantom impact/score fields were removed from the
//  fixture together with the never-rendered Strength bar they fed.)
const t01 = {
  id: 'technology_r01',
  name: 'AI-Driven Formulation and Speed-to-Market',
  force: 'Technology',
  direction: 'Expansion',
  probability: 4.5,
  description: 'AI reads the garment and prescribes the SKU.',
  journey_exposure: { 'lhc:sorting': 5 },
  sources: [{ title: 's', url: 'https://example.com', data: 'd' }],
};

STORE.store = {
  trends: [t01],
  // populated journey_decomposition → step 4 shows a computed %
  simulation: {
    journey_decomposition: {
      'LHC: FCN': { 'lhc:sorting': 0.012 },
      'LHC: ADW': { 'lhc:sorting': -0.004 },
    },
  },
  loading: false,
  error: null,
};

afterEach(() => cleanup());

describe('ConsumerJourney2 — declutter + full-screen Why-chain', () => {
  it('strips trailing parentheticals from tile names in the rail', () => {
    const { container } = render(<ConsumerJourney2 />);
    // a known parenthetical tile renders its stripped name…
    expect(container.textContent).toContain('Garment care advisory service');
    // …and the parenthetical itself is gone from the rail
    expect(container.textContent).not.toContain('(digital)');
    expect(container.textContent).not.toContain('(auto-dose)');
  });

  it('opens a full-screen dialog with the Why-chain and the Trends connect', () => {
    render(<ConsumerJourney2 onNavigateToTrend={() => {}} />);

    fireEvent.click(screen.getByText('AI stain/fabric recognition apps'));

    const dialog = screen.getByRole('dialog');
    const u = within(dialog);

    // two-step ladder: driving trends -> net effect
    expect(u.getByText(/Why this moment is (expanding|under pressure)/)).toBeTruthy();
    expect(u.getByText('Driving trends — links to the Trends page')).toBeTruthy();
    expect(u.getByText('Net effect')).toBeTruthy();

    // trend-force card resolved against the LIVE trend
    expect(u.getAllByText(/Tailwind/).length).toBeGreaterThan(0);
    // M8 (owner decision 2026-07-06): the "Strength" bar is GONE — it was
    // built on the retired impact input and had never rendered. Lock that in.
    expect(u.queryByText('Strength')).toBeNull();
    expect(u.getByText('Stage exposure')).toBeTruthy();  // live journey_exposure
    expect(u.getAllByText('View in Trends').length).toBeGreaterThan(0);

    // refinement 2026-06-29: "This moment" + "Computed attribution" steps and
    // the honesty footer were removed; lock that in.
    expect(u.queryByText('This moment')).toBeNull();
    expect(u.queryByText(/Computed attribution/)).toBeNull();
    expect(dialog.textContent).not.toContain('judgment, not simulated');
  });

  it('closes on Escape', async () => {
    render(<ConsumerJourney2 />);
    fireEvent.click(screen.getByText('AI stain/fabric recognition apps'));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    // exit is deferred by the AnimatePresence transition; wait for unmount
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
