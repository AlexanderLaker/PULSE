// @vitest-environment jsdom
/**
 * The entry gate, the first view every user sees:
 *   1. the headline and the four doors, with the live driver count;
 *   2. a door click opens its tab;
 *   3. keys 1–4 open a tab only while the gate is the visible pane (hidden
 *      panes stay mounted, and a listener left on would catch digits typed
 *      in other tabs);
 *   4. the Shift Analysis door draws the served run's category medians and
 *      portfolio band, the band tinted by its median's direction, and the
 *      neutral tint when there is no run.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useRef } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { PrismStore } from '@/hooks/usePrism';
import { linearPath, makeDriver, makeSimulation, makeStore } from './fixtures/prism';

const STATE = vi.hoisted(() => ({ store: null as unknown as PrismStore }));
vi.mock('@/hooks/usePrism', () => ({ default: () => STATE.store }));

import HomeGate from '@/components/dashboard/HomeGate';
import useOverlay from '@/hooks/useOverlay';

const DRIVERS = [
  makeDriver({ id: 'consumer_r01' }),
  makeDriver({ id: 'consumer_r02', name: 'Retail media networks' }),
  makeDriver({ id: 'government_r01', force: 'Government', name: 'Packaging regulation cost stack' }),
];

/** The fixture run, with Insect Control expanding so both tints appear. */
function runWithAnExpansion() {
  const run = makeSimulation();
  return makeSimulation({ shifts: { ...run.shifts, 'LHC: IC': linearPath(0.034) } });
}

/** The 13 category cells are the only 52-wide rects on the gate. */
const cellFills = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll('rect[width="52"]')).map((r) => r.getAttribute('fill') ?? '');

/** The portfolio band's P10–P90 fill, the only 9-high rect on the gate. */
const bandFill = (root: HTMLElement) => root.querySelector('rect[height="9"]')?.getAttribute('fill') ?? null;

afterEach(() => cleanup());

describe('HomeGate', () => {
  it('shows the headline and the four doors in tab order', () => {
    STATE.store = makeStore({ drivers: DRIVERS });
    render(<HomeGate active onNavigate={() => {}} />);
    expect(screen.getByText('Profit Pool Model')).toBeTruthy();
    const doors = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(doors).toEqual([
      'Drivers, the input. 3 drivers: the evidence. Shortcut key 1.',
      'Consumer Journey, the context. Consumer moments and the drivers behind them. Shortcut key 2.',
      "Profit Pool Shift Analysis, the output. Every category's shift to 2035. Shortcut key 3.",
      'Profit Pool Explorer (Beta), the market. The pools, sized and sourced. Shortcut key 4.',
    ]);
    expect(screen.getByText('3 drivers: the evidence.')).toBeTruthy();
  });

  it('counts the seeded driver base until the drivers load', () => {
    STATE.store = makeStore({ drivers: [], simulation: null, loading: true });
    render(<HomeGate active onNavigate={() => {}} />);
    expect(screen.getByText('51 drivers: the evidence.')).toBeTruthy();
  });

  it('opens the matching tab on a door click', () => {
    STATE.store = makeStore();
    const navigate = vi.fn();
    render(<HomeGate active onNavigate={navigate} />);
    fireEvent.click(screen.getByRole('button', { name: /the output/ }));
    expect(navigate).toHaveBeenCalledWith('shift-analysis');
  });

  it('opens a tab on keys 1–4 only while the gate is the visible pane', () => {
    STATE.store = makeStore();
    const navigate = vi.fn();
    const { rerender } = render(<HomeGate active onNavigate={navigate} />);
    fireEvent.keyDown(window, { key: '1' });
    expect(navigate).toHaveBeenCalledWith('drivers');
    fireEvent.keyDown(window, { key: '4' });
    expect(navigate).toHaveBeenCalledWith('profit-pool-explorer');

    navigate.mockClear();
    rerender(<HomeGate active={false} onNavigate={navigate} />);
    fireEvent.keyDown(window, { key: '2' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves keys 1–4 to a dialog open over the gate', () => {
    STATE.store = makeStore();
    const navigate = vi.fn();
    const Dialog = () => {
      const ref = useRef<HTMLDivElement | null>(null);
      useOverlay(true, () => {}, ref);
      return <div ref={ref} role="dialog" aria-label="Welcome"><button type="button">Got it</button></div>;
    };
    const { rerender } = render(<><HomeGate active onNavigate={navigate} /><Dialog /></>);
    fireEvent.keyDown(window, { key: '1' });
    expect(navigate).not.toHaveBeenCalled();
    rerender(<HomeGate active onNavigate={navigate} />);
    fireEvent.keyDown(window, { key: '1' });
    expect(navigate).toHaveBeenCalledWith('drivers');
  });

  it("draws the run's category medians and portfolio band, and the neutral tint without a run", () => {
    STATE.store = makeStore({ simulation: runWithAnExpansion() });
    const { container, unmount } = render(<HomeGate active onNavigate={() => {}} />);
    const fills = cellFills(container);
    expect(fills).toHaveLength(13);
    expect(fills.some((f) => f.includes('159, 64, 61'))).toBe(true);   // contraction tint
    expect(fills.some((f) => f.includes('31, 122, 61'))).toBe(true);   // expansion tint (Insect Control)
    expect(container.querySelectorAll('rect[width="52"][stroke]')).toHaveLength(1);   // the largest shift is outlined
    expect(bandFill(container)).toBe('rgba(159, 64, 61, 0.16)');   // the fixture's portfolio contracts
    unmount();

    const run = makeSimulation();
    const band = run.totals.portfolio['2035'];
    const growing = { ...band, p10: 0.004, median: 0.01, p90: 0.016 };
    STATE.store = makeStore({ simulation: { ...run, totals: { ...run.totals, portfolio: { ...run.totals.portfolio, '2035': growing } } } });
    const { container: up, unmount: unmountUp } = render(<HomeGate active onNavigate={() => {}} />);
    expect(bandFill(up)).toBe('rgba(31, 122, 61, 0.16)');
    unmountUp();

    STATE.store = makeStore({ simulation: null });
    const { container: empty } = render(<HomeGate active onNavigate={() => {}} />);
    expect(cellFills(empty)).toHaveLength(13);
    expect(cellFills(empty).every((f) => f === '#eff4ff')).toBe(true);
    expect(bandFill(empty)).toBeNull();
  });
});
