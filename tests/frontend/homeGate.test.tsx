// @vitest-environment jsdom
/**
 * HomeGate — entry-view tests (July 2026).
 *
 * The gate is the first thing every user sees, so it gets its own
 * cheap-but-real coverage:
 *   1. mounts against a canned store and shows the four doors;
 *   2. door click navigates to the right pane id;
 *   3. keys 1–4 navigate — but ONLY while the gate is the active pane
 *      (panes stay mounted when hidden; a leaked listener would hijack
 *      digits typed in other tabs);
 *   4. the shift door renders live matrix cells from the store, and the
 *      empty store renders the neutral base tint — never fabricated heat.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const STORE = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));

vi.mock('@/hooks/usePrism', () => ({
  __esModule: true,
  default: () => STORE.store,
  PrismProvider: ({ children }: { children: unknown }) => children,
}));

import HomeGate from '@/components/dashboard/HomeGate';

const shifts: Record<string, Record<number, unknown>> = {
  'Hair: Color': { 2035: { median: -0.061, p10: -0.11, p90: -0.01 } },
  'LHC: IC':     { 2035: { median:  0.034, p10: -0.01, p90:  0.08 } },
};

const fullStore = {
  trends: [
    { id: 'c1', name: 't1', force: 'Consumer' },
    { id: 'c2', name: 't2', force: 'Consumer' },
    { id: 'g1', name: 't3', force: 'Government' },
  ],
  simulation: {
    shifts,
    totals: { portfolio: { '2035': { median: -0.038, p10: -0.094, p90: 0.012 } } },
  },
  loading: false, error: null,
};

const emptyStore = { trends: [], simulation: null, loading: true, error: null };

afterEach(() => cleanup());

describe('HomeGate entry view', () => {
  it('mounts with the headline and all four doors', () => {
    STORE.store = fullStore;
    render(<HomeGate active onNavigate={() => {}} />);
    expect(screen.getByText('Profit Pool Model')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Trends — the input/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Consumer Journey — the lens/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Shift Analysis — the output/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Explorer, beta — the market/ })).toBeTruthy();
  });

  it('door click navigates to the matching pane', () => {
    STORE.store = fullStore;
    const nav = vi.fn();
    render(<HomeGate active onNavigate={nav} />);
    fireEvent.click(screen.getByRole('button', { name: /the output/ }));
    expect(nav).toHaveBeenCalledWith('profit-pool-2');
  });

  it('keys 1–4 navigate only while the gate is the active pane', () => {
    STORE.store = fullStore;
    const nav = vi.fn();
    const { rerender } = render(<HomeGate active onNavigate={nav} />);
    fireEvent.keyDown(window, { key: '1' });
    expect(nav).toHaveBeenCalledWith('trends-2');
    fireEvent.keyDown(window, { key: '4' });
    expect(nav).toHaveBeenCalledWith('profit-pool-explorer');

    nav.mockClear();
    rerender(<HomeGate active={false} onNavigate={nav} />);
    fireEvent.keyDown(window, { key: '2' });
    expect(nav).not.toHaveBeenCalled();          // hidden pane must not hijack keys
  });

  /** The 12 shift-matrix cells are the only 52px-wide rects in the gate. */
  const matrixCellFills = (root: HTMLElement): string[] =>
    Array.from(root.querySelectorAll('rect[width="52"]'))
      .map((r) => r.getAttribute('fill') ?? '');

  it('renders live heat from the store and neutral tint when empty', () => {
    STORE.store = fullStore;
    const { container, unmount } = render(<HomeGate active onNavigate={() => {}} />);
    const live = matrixCellFills(container);
    expect(live).toHaveLength(12);
    expect(live.some((f) => f.includes('159, 64, 61'))).toBe(true);  // contraction tint (Hair: Color)
    expect(live.some((f) => f.includes('31, 122, 61'))).toBe(true);  // expansion tint (LHC: IC)
    unmount();

    STORE.store = emptyStore;
    const { container: c2 } = render(<HomeGate active onNavigate={() => {}} />);
    const empty = matrixCellFills(c2);
    expect(empty).toHaveLength(12);
    // No run loaded → every cell is the neutral base tint, never fabricated heat.
    expect(empty.every((f) => f === '#eff4ff')).toBe(true);
  });
});
