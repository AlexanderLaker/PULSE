// @vitest-environment jsdom
/**
 * The Profit Pool Explorer: the chart's text alternative and keyboard hover
 * card, the drawer's calculations, the 2030 column, the sources with their
 * grades in words, the header's separation sentence, the controls as pressed
 * buttons, and the address.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import ProfitPoolExplorer from '@/components/dashboard/ProfitPoolExplorer';
import { yAxisMax } from '@/components/dashboard/explorer/PoolChart';
import { ViewUrlProvider } from '@/hooks/useViewUrl';
import { NOTICE_ACK_KEY } from '@/components/dashboard/explorer/BetaNotice';

// No ResizeObserver stub: jsdom has none, so the chart draws at its fallback width.

beforeEach(() => {
  window.localStorage.setItem(NOTICE_ACK_KEY, '1');   // the first-visit notice stays closed
  window.history.replaceState(null, '', '/dashboard');
});
afterEach(() => cleanup());

/** The first bar of the Laundry value chain. */
const firstBar = () => screen.getByRole('button', { name: /^Commodity Chemicals: / });

describe('ProfitPoolExplorer: the page', () => {
  it('says once that its figures sit apart from the simulation, and names the sources once, in About this view', () => {
    const { container } = render(<ProfitPoolExplorer />);
    expect(screen.getByText(/These are published industry figures and PRISM’s own estimates on them; nothing here comes from the simulation and nothing feeds the Shift Matrix\./)).toBeTruthy();
    expect((container.textContent ?? '').match(/Kline/g)?.length).toBe(1);
    expect(screen.getByText('Reported = as published; Derived = arithmetic on published figures; Estimate = structured judgment.')).toBeTruthy();
    expect(screen.getByText('Every development rate compounds over these five years.')).toBeTruthy();
  });

  it('switches the business area and the view with pressed buttons, not tabs', () => {
    render(<ProfitPoolExplorer />);
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

  it('reopens the beta notice from the header', () => {
    render(<ProfitPoolExplorer />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'About this data' }));
    expect(screen.getByRole('dialog', { name: 'Profit Pool Explorer' })).toBeTruthy();
  });
});

describe('ProfitPoolExplorer: the chart', () => {
  it('draws at its fallback width in CSS pixels and lists every bar in a table', () => {
    const { container } = render(<ProfitPoolExplorer />);
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
    render(<ProfitPoolExplorer />);
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
  it('heads the 2030 column "if rates hold", chips the pool figure as an estimate and lists the calculations on request', () => {
    render(<ProfitPoolExplorer />);
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

  it('names each source with its grade in words and says that the link opens a new tab', () => {
    render(<ProfitPoolExplorer />);
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
  it('opens the group and kind the address names', () => {
    render(
      <ViewUrlProvider initial={{ view: 'profit-pool-explorer', params: { group: 'Hair', kind: 'Categories' } }}>
        <ProfitPoolExplorer />
      </ViewUrlProvider>,
    );
    expect(screen.getByText('Hair Care: Passport Category Profit Pools')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Business area' })).getByRole('button', { name: 'Hair' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the pool the address names', () => {
    render(
      <ViewUrlProvider initial={{ view: 'profit-pool-explorer', params: { group: 'LHC', kind: 'ValueChain', pool: 'l_vc_1' } }}>
        <ProfitPoolExplorer />
      </ViewUrlProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Commodity Chemicals: profit pool assessment' })).toBeTruthy();
  });

  it('writes group, kind and pool to the address and adopts the address when it changes', async () => {
    render(
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
