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
const t01 = {
  id: 'technology_r01',
  name: 'AI-Driven Formulation and Speed-to-Market',
  force: 'Technology',
  direction: 'Expansion',
  impact: 4,
  probability: 4.5,
  score: 18,
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

    // the four-step ladder
    expect(u.getByText(/Why this moment is (expanding|under pressure)/)).toBeTruthy();
    expect(u.getByText('This moment')).toBeTruthy();
    expect(u.getByText('Driving trends — links to the Trends page')).toBeTruthy();
    expect(u.getByText('Net effect')).toBeTruthy();
    expect(u.getByText(/Computed attribution/)).toBeTruthy();

    // trend-force card resolved against the LIVE trend
    expect(u.getAllByText(/Tailwind/).length).toBeGreaterThan(0);
    expect(u.getByText('Strength')).toBeTruthy();        // impact × probability
    expect(u.getByText('Stage exposure')).toBeTruthy();  // live journey_exposure
    expect(u.getAllByText('View in Trends').length).toBeGreaterThan(0);

    // honesty wall preserved
    expect(dialog.textContent).toContain('judgment, not simulated');
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
