// @vitest-environment jsdom
/**
 * The Profit Pool Explorer: the views fetched from the API on the first open
 * (the skeleton until they arrive, the notice with Try again when they cannot
 * be loaded, then the chart), the chart's text alternative and keyboard hover
 * card, the drawer's calculations, the 2030 column, the sources with their
 * grades in words, the header's separation sentence, the controls as pressed
 * buttons, and the address.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { PoolView } from '@/lib/profitPoolData';
import { ApiError } from '@/lib/apiClient';
import pools from '@/data/content/profit_pools.json';

const API = vi.hoisted(() => ({ getExplorerViews: vi.fn() }));
vi.mock('@/lib/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/apiClient')>()),
  getExplorerViews: API.getExplorerViews,
}));

import ProfitPoolExplorer from '@/components/dashboard/ProfitPoolExplorer';
import { yAxisMax } from '@/components/dashboard/explorer/PoolChart';
import { ViewUrlProvider } from '@/hooks/useViewUrl';
import { NOTICE_ACK_KEY } from '@/components/dashboard/explorer/BetaNotice';

/** The views as the API serves them: the hand-authored JSON. */
const VIEWS = (pools as unknown as { views: PoolView[] }).views;

// No ResizeObserver stub: jsdom has none, so the chart draws at its fallback width.

beforeEach(() => {
  window.localStorage.setItem(NOTICE_ACK_KEY, '1');   // the first-visit notice stays closed
  window.history.replaceState(null, '', '/dashboard');
  API.getExplorerViews.mockReset().mockResolvedValue({ views: VIEWS });
});
afterEach(() => cleanup());

/** The first bar of the Laundry value chain. */
const firstBar = () => screen.getByRole('button', { name: /^Commodity Chemicals: / });

/** Renders the Explorer and waits for the views to arrive (the chart draws then). */
async function renderReady(ui: ReactElement) {
  const result = render(ui);
  await screen.findByRole('group', { name: 'Business area' });
  return result;
}

const UNAVAILABLE = /The profit pool views could not be loaded from the PRISM service, so there is no chart to show; the chart and its sources appear once it answers\./;

describe('ProfitPoolExplorer: the views from the API', () => {
  it('keeps the skeleton until the views arrive, showing nothing of the chart', async () => {
    let answer: (served: { views: PoolView[] }) => void = () => {};
    API.getExplorerViews.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const { container } = render(<ProfitPoolExplorer />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Business area' })).toBeNull();
    expect(container.textContent).not.toContain('Industry Profit Pools');
    answer({ views: VIEWS });
    expect(await screen.findByText('Laundry Care: Industry Value Chain Profit Pool')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
    expect(API.getExplorerViews).toHaveBeenCalledTimes(1);
  });

  it('with the API down, shows the notice with Try again and no chart, and loads the views again on request', async () => {
    API.getExplorerViews.mockRejectedValueOnce(new ApiError(503, 'The database cannot be reached'));
    const { container } = render(<ProfitPoolExplorer />);
    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('could not be loaded');
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Business area' })).toBeNull();
    expect(container.textContent).not.toContain('Commodity');
    // the page still says what the view is
    expect(screen.getByText('Industry Profit Pools: HCB Lens')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(await screen.findByText('Laundry Care: Industry Value Chain Profit Pool')).toBeTruthy();
    expect(API.getExplorerViews).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(UNAVAILABLE)).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('runs its arithmetic on the fetched views, not on a copy of its own', async () => {
    const served: PoolView = {
      ...VIEWS[0]!, id: 'laundry_value_chain', group: 'LHC', kind: 'ValueChain',
      title: 'Served value chain', poolSize: '~€10bn', poolSizeEurBn: 10,
      items: [{
        ...VIEWS[0]!.items[0]!, id: 'served_1', label: 'Served tier', sublabel: undefined,
        revenueShare: 1, gp1Margin: 0.5, revenueCAGR: 0, gp1DeltaBps: 0,
      }],
    };
    API.getExplorerViews.mockResolvedValue({ views: [served] });
    await renderReady(<ProfitPoolExplorer />);
    expect(screen.getByText('Served value chain')).toBeTruthy();
    expect(screen.getByText('Value Chain · revenue pool ~€10bn')).toBeTruthy();
    // 10 bn x 50 % = 5 bn today and, with flat rates, in 2030
    expect(screen.getByText('€5.0bn → €5.0bn')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Served tier: 100\.0% revenue share, 50\.0% GP1/ })).toBeTruthy();
  });
});

describe('ProfitPoolExplorer: the page', () => {
  it('says once that its figures sit apart from the simulation, and names the sources once, in About this view', async () => {
    const { container } = await renderReady(<ProfitPoolExplorer />);
    expect(screen.getByText(/These are published industry figures and PRISM’s own estimates on them; nothing here comes from the simulation and nothing feeds the Shift Matrix\./)).toBeTruthy();
    expect((container.textContent ?? '').match(/Kline/g)?.length).toBe(1);
    expect(screen.getByText('Reported = as published; Derived = arithmetic on published figures; Estimate = structured judgment.')).toBeTruthy();
    expect(screen.getByText('Every development rate compounds over these five years.')).toBeTruthy();
  });

  it('switches the business area and the view with pressed buttons, not tabs', async () => {
    await renderReady(<ProfitPoolExplorer />);
    expect(screen.queryAllByRole('tab')).toEqual([]);
    const area = screen.getByRole('group', { name: 'Business area' });
    const hair = within(area).getByRole('button', { name: 'Hair' });
    expect(hair.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(hair);
    expect(hair.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Hair Care: Industry Value Chain Profit Pool')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Categories' }));
    expect(screen.getByText('Hair Care: Passport Category Profit Pools')).toBeTruthy();
  });

  it('reopens the beta notice from the header', async () => {
    await renderReady(<ProfitPoolExplorer />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'About this data' }));
    expect(screen.getByRole('dialog', { name: 'Profit Pool Explorer' })).toBeTruthy();
  });
});

describe('ProfitPoolExplorer: the chart', () => {
  it('draws at its fallback width in CSS pixels and lists every bar in a table', async () => {
    const { container } = await renderReady(<ProfitPoolExplorer />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('960');
    expect(svg.getAttribute('viewBox')).toBe('0 0 960 448');
    const table = screen.getByRole('table');
    expect(table.parentElement?.className).toContain('sr-only');
    const row = within(table).getByRole('row', { name: /^Commodity Chemicals / });
    expect(row.textContent).toContain('3.1%');
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(5);
  });

  it('extends the y axis to the tallest bar in steps of ten percent', () => {
    expect(yAxisMax([{ gp1Margin: 0.22 }, { gp1Margin: 0.39 }] as never)).toBe(0.4);
    expect(yAxisMax([{ gp1Margin: 0.54 }] as never)).toBe(0.6);
    expect(yAxisMax([{ gp1Margin: 0.5 }] as never)).toBe(0.5);
  });

  it('opens the hover card on keyboard focus of a bar and closes it on Escape', async () => {
    await renderReady(<ProfitPoolExplorer />);
    fireEvent.mouseDown(document.body);
    fireEvent.focus(firstBar());          // focus after a pointer: no card
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    fireEvent.focus(firstBar());          // focus after a key: the card, anchored to the bar
    expect(await screen.findByRole('tooltip')).toBeTruthy();
    expect(screen.getByRole('tooltip').textContent).toContain('Commodity Chemicals');
    fireEvent.keyDown(firstBar(), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });
});

describe('ProfitPoolExplorer: the drawer', () => {
  it('heads the 2030 column "if rates hold", chips the pool figure as an estimate and lists the calculations on request', async () => {
    await renderReady(<ProfitPoolExplorer />);
    fireEvent.click(firstBar());
    const drawer = within(screen.getByRole('dialog'));
    expect(drawer.getByText('2030 if rates hold')).toBeTruthy();
    expect(drawer.getAllByText('Estimate').length).toBeGreaterThan(0);
    expect(drawer.getByText(/Show calculations lists every figure’s derivation and source\./)).toBeTruthy();

    const toggle = drawer.getByRole('button', { name: 'Show calculations' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(drawer.queryByText(/Pool CAGR = \(1 \+ revenue CAGR\)/)).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('Hide calculations');
    expect(drawer.getByText(/Pool CAGR = \(1 \+ revenue CAGR\) × \(1 \+ margin CAGR\) − 1/)).toBeTruthy();
    expect(drawer.getByText(/Revenue share = this row's revenue ÷ sum of all rows on this view/)).toBeTruthy();
    expect(drawer.getByText('GP1 profit pool: 2030 if rates hold')).toBeTruthy();
    // the titles stay as a bonus
    expect(drawer.getByTitle(/Pool CAGR = /)).toBeTruthy();
  });

  it('names each source with its grade in words and says that the link opens a new tab', async () => {
    await renderReady(<ProfitPoolExplorer />);
    fireEvent.click(firstBar());
    const links = within(screen.getByRole('dialog')).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.textContent).toMatch(/\((?:estimate|reported|derived)\) \(opens in a new tab\)$/);
      expect(link.getAttribute('target')).toBe('_blank');
    }
  });
});

describe('ProfitPoolExplorer: the address', () => {
  it('opens the group and kind the address names once the views arrive', async () => {
    await renderReady(
      <ViewUrlProvider initial={{ view: 'profit-pool-explorer', params: { group: 'Hair', kind: 'Categories' } }}>
        <ProfitPoolExplorer />
      </ViewUrlProvider>,
    );
    expect(screen.getByText('Hair Care: Passport Category Profit Pools')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Business area' })).getByRole('button', { name: 'Hair' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the pool the address names once the views arrive', async () => {
    await renderReady(
      <ViewUrlProvider initial={{ view: 'profit-pool-explorer', params: { group: 'LHC', kind: 'ValueChain', pool: 'l_vc_1' } }}>
        <ProfitPoolExplorer />
      </ViewUrlProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Commodity Chemicals: profit pool assessment' })).toBeTruthy();
  });

  it('writes group, kind and pool to the address and adopts the address when it changes', async () => {
    await renderReady(
      <ViewUrlProvider initial={{ view: 'profit-pool-explorer', params: {} }}>
        <ProfitPoolExplorer />
      </ViewUrlProvider>,
    );
    fireEvent.click(within(screen.getByRole('group', { name: 'Business area' })).getByRole('button', { name: 'Hair' }));
    expect(window.location.search).toContain('group=Hair');
    fireEvent.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Core + Adjacent' }));
    expect(window.location.search).toContain('kind=CoreAdjacent');
    fireEvent.click(screen.getAllByRole('button', { name: /Press Enter for the full assessment\.$/ })[0]!);
    expect(window.location.search).toMatch(/pool=/);
    fireEvent.click(screen.getByRole('button', { name: 'Close assessment panel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.location.search).not.toMatch(/pool=/);
    // Back: the address is the truth again.
    window.history.replaceState(null, '', '/dashboard?view=explorer&group=LHC&kind=Categories&pool=l_sub_1');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(await screen.findByRole('dialog', { name: 'Laundry Detergents: profit pool assessment' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Categories' }).getAttribute('aria-pressed')).toBe('true');
  });
});
