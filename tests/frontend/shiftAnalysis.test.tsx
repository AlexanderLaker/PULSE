// @vitest-environment jsdom
/**
 * The Shift Analysis page without a run says why, from the service's own
 * diagnosis (unreachable, no run yet, a run that cannot be served, no
 * database, a database awaiting the migration, none configured); above the
 * matrix it says when the drivers or the engine no longer match the run;
 * the impact filter splits the net by the drivers' contributions and needs
 * the model configuration and the drivers; its "About this model" footer names the run's
 * cell-weight basis and the pass-through of the served configuration. The KPI
 * tiles show their bands without a hover and the page says what a band
 * covers; the lens, year, filter and open drill-down live in the address.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import type { DiagnosticsResult } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { ESTIMATED_CELL_WEIGHTS } from '@/lib/cellWeightProvenance';
import { computeDriverAttribution } from '@/lib/driverAttribution';
import { CATEGORY_NAMES, YEARS } from '@/lib/format';
import { ViewUrlProvider } from '@/hooks/useViewUrl';
import { distribution, makeConfig, makeDriver, makeSimulation, makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ store: null as unknown as PrismStore }));
const DIAGNOSIS = vi.hoisted(() => ({ result: null as DiagnosticsResult | null }));

const PNG = vi.hoisted(() => ({ toPng: vi.fn<(node: HTMLElement, options: { filter?: (n: HTMLElement) => boolean }) => Promise<string>>() }));

vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.store }));
vi.mock('@/lib/apiClient', () => ({ getDiagnostics: vi.fn(async () => DIAGNOSIS.result) }));
vi.mock('html-to-image', () => ({ toPng: PNG.toPng }));

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

/** The matrix cell whose text, visually hidden parts included, reads as `sentence`. */
function cellReading(container: HTMLElement, sentence: RegExp): HTMLElement {
  const cells = Array.from(container.querySelectorAll('td')).filter((td) => sentence.test(td.textContent ?? ''));
  expect(cells, `one cell reading ${sentence}`).toHaveLength(1);
  return cells[0];
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
  it('names the four lenses in short: the time path and three attributions', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const lensControl = screen.getByRole('group', { name: 'Matrix lens' });
    expect(within(lensControl).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Time path', 'Force attribution', 'Value-chain attribution', 'Region attribution',
    ]);
  });

  it('shows the same grand total in every lens as the Time path total of that year', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const timeTotal = screen.getByTitle(/^2035, column total: /).getAttribute('title')!.replace(/^2035, column total: /, '');
    for (const lens of ['Force attribution', 'Value-chain attribution', 'Region attribution']) {
      fireEvent.click(screen.getByRole('button', { name: lens }));
      expect(screen.getByText('Total 2035')).toBeTruthy();
      expect(screen.getByTitle(/^Grand total: /).getAttribute('title')).toBe(`Grand total: ${timeTotal}`);
    }
  });

  it('names what a cell holds: the median on the Time path, the attribution or the filtered part elsewhere', () => {
    STORE.store = makeStore();
    const { container } = render(<ShiftAnalysis />);
    const hoverCard = (cell: HTMLElement) => {
      fireEvent.mouseEnter(cell);
      const card = container.querySelector('div.fixed') as HTMLElement;
      const text = card.textContent ?? '';
      fireEvent.mouseLeave(cell);
      return text;
    };
    // The cell reads as one sentence to a screen reader: visually hidden
    // text around the visible figure, the band included on the Time path.
    const median = cellReading(container, /^Toilet Care, 2035: median [+-]?\d+\.\d%, P10 [+-]?\d+\.\d%, P90 [+-]?\d+\.\d%$/);
    expect(median.querySelectorAll('.sr-only')).toHaveLength(2);
    expect(hoverCard(median)).toMatch(/Median[+-]?\d+\.\d%P10/);
    fireEvent.click(screen.getByRole('button', { name: 'Contraction drivers' }));
    const part = cellReading(container, /^Toilet Care, 2035: contraction drivers’ part [+-]?\d+\.\d%$/);
    expect(hoverCard(part)).toContain('Contraction drivers’ part');
    fireEvent.click(screen.getByRole('button', { name: 'Force attribution' }));
    const force = cellReading(container, /^Toilet Care, Consumer: force attribution [+-]?\d+\.\d%$/);
    const text = hoverCard(force);
    expect(text).toContain('Force attribution');
    expect(text).not.toContain('Median');
  });

  it('captions the table with the lens and the year for a screen reader', () => {
    STORE.store = makeStore();
    const { container } = render(<ShiftAnalysis />);
    const caption = () => container.querySelector('table caption')!;
    expect(caption().className).toContain('sr-only');
    expect(caption().textContent).toBe('Shift Matrix: Time path, 2026 to 2035');
    fireEvent.click(screen.getByRole('button', { name: 'Region attribution' }));
    fireEvent.click(screen.getByRole('button', { name: 'Earlier year' }));
    expect(caption().textContent).toBe('Shift Matrix: Region attribution, 2034');
  });

  it('shows the lens as the label of the subtitle bar and its description as a sentence', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const label = screen.getByText('Time path', { selector: 'span' });
    expect(label.style.textTransform).toBe('uppercase');
    const text = label.nextElementSibling as HTMLElement;
    expect(text.textContent).toBe('MC median shifts 2026→2035, cumulative vs 2025');
    expect(text.style.textTransform).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Value-chain attribution' }));
    expect(screen.getByText('Value-chain attribution 2035', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText(/gives each driver's share wholly to the stage where its impact centres \(its epicentre\)/)).toBeTruthy();
  });

  it('names every figure of the KPI tiles to a screen reader', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const portfolio = screen.getByRole('group', { name: /^Portfolio exposure/ });
    expect(portfolio.getAttribute('aria-label')).toMatch(
      /^Portfolio exposure \(if no action\) · by 2035: median -\d+\.\d%, P10 -\d+\.\d% to P90 [+-]?\d+\.\d%, 80% of simulated outcomes \(joint portfolio; driver size and timing only\)$/);
    const exposed = screen.getByRole('button', { name: /^Most exposed category: / });
    expect(exposed.getAttribute('aria-label')).toMatch(
      /^Most exposed category: [A-Z][\w ]+, median -\d+\.\d%, P10 .+ to P90 .+, 80% of simulated outcomes \(driver size and timing only\)\. Opens the drill-down$/);
  });

  it('shows each KPI band in the tile without a hover, and the shared range bar', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const portfolio = screen.getByRole('group', { name: /^Portfolio exposure/ });
    // The fixture portfolio ends at its median with a 1 pt band each side.
    expect(within(portfolio).getByText(/^P10 -\d+\.\d% to P90 -\d+\.\d%$/)).toBeTruthy();
    const exposed = screen.getByRole('button', { name: /^Most exposed category: / });
    expect(within(exposed).getByText('P10 -7.8% to P90 -5.8%')).toBeTruthy();
    const least = screen.getByRole('button', { name: /^Least exposed category: / });
    expect(within(least).getByText('P10 -3.0% to P90 -1.0%')).toBeTruthy();
    // The band segment of the most exposed tile starts at the left end of the
    // shared scale and the least exposed one ends at its right end; the bars
    // are decorative.
    const segment = (tile: HTMLElement) => (tile.querySelector('[aria-hidden] > div') as HTMLElement).style;
    expect(segment(exposed).left).toBe('0%');
    const leastSeg = segment(least);
    expect(parseFloat(leastSeg.left) + parseFloat(leastSeg.width)).toBeCloseTo(100, 5);
    // No hover card until the tile is hovered or focused.
    expect(within(portfolio).queryByText(/joint portfolio/)).toBeNull();
    fireEvent.mouseEnter(portfolio);
    expect(within(portfolio).getByText(/joint portfolio/)).toBeTruthy();
  });

  it('says under the strip what the bands cover, and names the estimate only on a run that uses it', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    expect(screen.getByTestId('band-sentence').textContent).toBe(
      "Bands cover 80% of simulated outcomes for each driver's size and timing. "
      + 'They do not cover the scores themselves, the cell-weight estimate or drivers not yet listed.');
    cleanup();
    STORE.store = makeStore({
      simulation: makeSimulation({ cell_weights_source: 'Finance GP1 shares FY2025' }),
    });
    render(<ShiftAnalysis />);
    expect(screen.getByTestId('band-sentence').textContent).toBe(
      "Bands cover 80% of simulated outcomes for each driver's size and timing. "
      + 'They do not cover the scores themselves or drivers not yet listed.');
  });

  it('repeats the band sentence and the estimate note inside the matrix card for an image or a print only', () => {
    // The page shows both above the card; the card carries them so an export
    // of the card alone still says what its figures rest on.
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const notes = screen.getByTestId('matrix-export-notes');
    expect(notes.hasAttribute('data-print-only')).toBe(true);
    expect(notes.textContent).toContain("Bands cover 80% of simulated outcomes");
    expect(notes.textContent).toContain('estimated HCB gross-profit mix built from public reporting, not Henkel P&L');
    cleanup();
    STORE.store = makeStore({ simulation: makeSimulation({ cell_weights_source: 'Finance GP1 shares FY2025' }) });
    render(<ShiftAnalysis />);
    expect(screen.getByTestId('matrix-export-notes').textContent).not.toContain('estimated');
  });

  it('opens the drill-down at the lens year chosen with the stepper', () => {
    STORE.store = makeStore();
    const { container } = render(<ShiftAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: 'Region attribution' }));
    fireEvent.click(screen.getByRole('button', { name: 'Earlier year' }));
    expect(screen.getByText('Total 2034')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open Toilet Care detail/ }));
    const aside = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(aside.getAttribute('aria-label')).toBe('Toilet Care drill-down');
    expect(aside.textContent).toContain('Force attribution · 2034');
    expect(aside.textContent).toContain('Regional shift · 2034');
    expect(aside.textContent).toContain('North America');
    expect(aside.textContent).toContain('splits the row’s median in 2034 by the size of each force’s drivers, not their direction');
  });

  it('opens the drill-down at the horizon on the Time path, whatever year the stepper was left on', () => {
    STORE.store = makeStore();
    const { container } = render(<ShiftAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: 'Force attribution' }));
    fireEvent.click(screen.getByRole('button', { name: 'Earlier year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Time path' }));
    fireEvent.click(screen.getByRole('button', { name: /Open Toilet Care detail/ }));
    const aside = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(aside.textContent).toContain('Force attribution · 2035');
    expect(aside.textContent).toContain('Regional shift · 2035');
  });

  it('shows the horizon band next to the 2035 shift in the drill-down header', () => {
    STORE.store = makeStore();
    const { container } = render(<ShiftAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /Open Toilet Care detail/ }));
    const aside = container.querySelector('[role="dialog"]') as HTMLElement;
    const header = within(aside.querySelector('header') as HTMLElement);
    // Toilet Care is category 12 of the fixture: -2% - 0.4% x 11 = -6.4%, band 1 pt each side.
    expect(header.getByText('-6.4%')).toBeTruthy();
    expect(header.getByText('P10 -7.4% to P90 -5.4%')).toBeTruthy();
    // The momentum tile is a button that controls its explainer.
    const momentum = within(aside).getByRole('button', { name: /^Momentum: / });
    expect(momentum.getAttribute('aria-expanded')).toBe('false');
    fireEvent.focus(momentum);
    expect(momentum.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(momentum.getAttribute('aria-controls')!)!.textContent).toContain('a difference of two medians');
    // The method sits behind a disclosure; the first sentence stays in view.
    expect(within(aside).getByText('How these figures are computed').tagName).toBe('SUMMARY');
    expect(within(aside).getByText(/^Shifts are cumulative against 2025, from the Monte Carlo engine\.$/)).toBeTruthy();
    // The dialog covers the page's notes, so it carries its own: what the
    // bands cover and, on this estimate run, how the figures are weighted.
    const notes = within(aside).getByTestId('drill-down-notes').textContent ?? '';
    expect(notes).toContain('They do not cover the scores themselves, the cell-weight estimate or drivers not yet listed.');
    expect(notes).toContain('not Henkel P&L');
    expect(within(aside).getByText(/an estimate from public reporting on this run/)).toBeTruthy();
  });

  it('says in the drill-down when drivers changed since the run', () => {
    STORE.store = makeStore({
      simulation: makeSimulation({ inputs_since_run: { changed: ['consumer_r01'], added: [], removed: [] } }),
    });
    const { container } = render(<ShiftAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /Open Toilet Care detail/ }));
    const aside = container.querySelector('[role="dialog"]') as HTMLElement;
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

  it('offers the matrix as CSV, as PNG and to print behind one menu button, closed again by Escape', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const button = screen.getByRole('button', { name: 'Export the matrix' });
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.closest('[data-print-hide]')).toBeTruthy();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: 'Export the matrix' });
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'CSV of this matrix', 'PNG of this matrix', 'Print',
    ]);
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('prints from the menu, and downloads the matrix as CSV with its header block', async () => {
    STORE.store = makeStore();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const blobs: Blob[] = [];
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { blobs.push(blob as Blob); return 'blob:matrix'; });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const downloads: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    try {
      render(<ShiftAnalysis />);
      fireEvent.click(screen.getByRole('button', { name: 'Export the matrix' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Print' }));
      expect(print).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Force attribution' }));
      fireEvent.click(screen.getByRole('button', { name: 'Export the matrix' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'CSV of this matrix' }));
      expect(screen.getByRole('status').textContent).toBe('CSV downloaded');
      expect(downloads).toEqual(['PRISM-shift-matrix-Force-attribution-2035.csv']);
      // A UTF-8 byte-order mark opens the file, so a spreadsheet reads the signs and dashes; text() strips it.
      expect(Array.from(new Uint8Array((await blobs[0].arrayBuffer()).slice(0, 3)))).toEqual([0xef, 0xbb, 0xbf]);
      const text = await blobs[0].text();
      expect(text.startsWith('PRISM Shift Matrix\r\nLens,Force attribution\r\nYear,2035\r\n')).toBe(true);
      expect(text).toContain(`Bands,"Bands cover 80% of simulated outcomes for each driver's size and timing.`);
    } finally {
      click.mockRestore();
      create.mockRestore();
      revoke.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('renders the matrix card without its toolbar as a PNG, and reports a renderer that fails', async () => {
    STORE.store = makeStore();
    const downloads: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(`${this.download}:${this.href}`);
    });
    try {
      PNG.toPng.mockReset();
      PNG.toPng.mockResolvedValueOnce('data:image/png;base64,AAAA');
      render(<ShiftAnalysis />);
      const exportPng = () => {
        fireEvent.click(screen.getByRole('button', { name: 'Export the matrix' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'PNG of this matrix' }));
      };
      exportPng();
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('PNG downloaded'));
      expect(downloads).toEqual(['PRISM-shift-matrix-Time-path-2026-to-2035.png:data:image/png;base64,AAAA']);
      const [node, options] = PNG.toPng.mock.calls[0];
      // The card: it holds the table, the subtitle and the legend; the toolbar is filtered out.
      expect(node.querySelector('table')).toBeTruthy();
      expect(node.textContent).toContain('MC median shifts 2026→2035');
      expect(node.textContent).toContain('zero at the centre');
      const toolbar = node.querySelector('[data-print-hide]') as HTMLElement;
      expect(toolbar.textContent).toContain('Time path');
      expect(options.filter!(toolbar)).toBe(false);
      expect(options.filter!(node.querySelector('table') as HTMLElement)).toBe(true);
      expect(node.hasAttribute('data-exporting')).toBe(false);

      PNG.toPng.mockRejectedValueOnce(new Error('canvas tainted'));
      exportPng();
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('The image could not be made: canvas tainted'));
      expect(downloads).toHaveLength(1);
    } finally {
      click.mockRestore();
    }
  });

  it('closes the peak-stress explainer on Escape and says what the button controls', () => {
    STORE.store = makeStore();
    render(<ShiftAnalysis />);
    const info = screen.getByRole('button', { name: "Why aren't the worst years at the end?" });
    expect(info.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(info);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    const panel = document.getElementById(info.getAttribute('aria-controls')!)!;
    expect(panel.textContent).toContain('Peak stress is not always terminal');
    fireEvent.keyDown(info, { key: 'Escape' });
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(info.getAttribute('aria-controls')).toBeNull();
  });
});

describe('the address bar', () => {
  const renderAt = (params: Record<string, string>) => render(
    <ViewUrlProvider initial={{ view: 'shift-analysis', params }}>
      <ShiftAnalysis />
    </ViewUrlProvider>,
  );

  afterEach(() => { window.history.replaceState(null, '', '/'); });

  it('opens the lens and year a link names, and writes the drill-down into the address', async () => {
    STORE.store = makeStore();
    const { container } = renderAt({ lens: 'force', year: '2031' });
    expect(screen.getByRole('button', { name: 'Force attribution' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Time path' }).getAttribute('aria-pressed')).toBe('false');
    expect(within(screen.getByRole('group', { name: 'Measurement year' })).getByText('2031')).toBeTruthy();
    expect(screen.getByText('Total 2031')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Open Toilet Care detail/ }));
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(window.location.search).toContain('category=');
    const address = new URLSearchParams(window.location.search);
    expect(address.get('category')).toBe('LHC: TOI');
    expect(address.get('lens')).toBe('force');
    expect(address.get('year')).toBe('2031');

    // Closing the drill-down clears the key again; the panel leaves after its exit animation.
    fireEvent.click(within(container.querySelector('[role="dialog"]') as HTMLElement).getByRole('button', { name: 'Close' }));
    expect(window.location.search).not.toContain('category=');
    await waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull());
  });

  it('writes a lens change into the address and adopts the address on Back', async () => {
    STORE.store = makeStore();
    const { container } = renderAt({});
    fireEvent.click(screen.getByRole('button', { name: 'Region attribution' }));
    expect(window.location.search).toContain('lens=region');
    fireEvent.click(screen.getByRole('button', { name: /Open Toilet Care detail/ }));
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    // Back: the browser restores the address before the drill-down was
    // pushed, and the page adopts it (jsdom fires popstate asynchronously).
    window.history.back();
    await waitFor(() => expect(window.location.search).not.toContain('category='));
    await waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull());
    expect(screen.getByRole('button', { name: 'Region attribution' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the drill-down a pasted link names', () => {
    STORE.store = makeStore();
    const { container } = renderAt({ category: 'LHC: FCN' });
    const aside = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(aside.getAttribute('aria-label')).toBe('Fabric Clean drill-down');
  });

  it('copies the address of the open drill-down, and shows it in a field when the clipboard refuses', async () => {
    STORE.store = makeStore();
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      const { container } = renderAt({ lens: 'vc', year: '2030', category: 'LHC: FCN' });
      const aside = within(container.querySelector('[role="dialog"]') as HTMLElement);
      fireEvent.click(aside.getByRole('button', { name: 'Copy link to this drill-down' }));
      await waitFor(() => expect(aside.getByRole('status').textContent).toBe('Link copied'));
      expect(writeText).toHaveBeenCalledTimes(1);
      const copied = new URL(writeText.mock.calls[0][0]);
      expect(copied.origin).toBe(window.location.origin);
      expect(Object.fromEntries(copied.searchParams)).toEqual({ view: 'shift', lens: 'vc', year: '2030', category: 'LHC: FCN' });
      expect(aside.queryByLabelText('Link to this drill-down')).toBeNull();

      writeText.mockRejectedValueOnce(new Error('denied'));
      fireEvent.click(aside.getByRole('button', { name: 'Copy link to this drill-down' }));
      await waitFor(() => expect(aside.getByRole('status').textContent).toContain('copy the address from the field'));
      const field = aside.getByLabelText('Link to this drill-down') as HTMLInputElement;
      expect(field.readOnly).toBe(true);
      expect(field.value).toBe(copied.href);
    } finally {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    }
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
