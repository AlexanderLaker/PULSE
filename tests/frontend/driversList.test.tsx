// @vitest-environment jsdom
/**
 * The Drivers list around its rows: the filters and the result count, the
 * table semantics, the address bar, the export, the keyboard on the radio
 * groups, the rating progress and the unsaved-edit guard.
 *
 *   - The force filter narrows the list and the count reads "n of m drivers";
 *     Clear puts everything back.
 *   - The list is an ARIA table whose column headers carry the sort state.
 *   - Inside the address-bar provider the page opens on the mode and driver
 *     the address names, writes a toggled row and the search back, and
 *     offers a link to the open driver.
 *   - The CSV export leads with the title, the date, the filter and the note.
 *   - A radio group has one tab stop and the arrow keys move the check.
 *   - Expert Rating counts the rated drivers, hides them on request and
 *     moves to the next unrated one.
 *   - A row or mode change that would drop unsaved edits asks first.
 *   - The Edited chip opens the list of changes and gives focus back.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react';
import type { DriverProposal, DriverProposalsResponse } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { categoryMap, makeDriver, makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ current: null as PrismStore | null }));
const API = vi.hoisted(() => ({ getDriverProposals: vi.fn(), saveMyProposal: vi.fn() }));

vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.current }));
vi.mock('@/lib/apiClient', async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import('@/lib/apiClient')>()).ApiError,
  getDriverProposals: API.getDriverProposals,
  saveMyProposal: API.saveMyProposal,
}));

import Drivers from '@/components/dashboard/Drivers';
import { ViewUrlProvider } from '@/hooks/useViewUrl';
import { CSV_NOTE, driversCsvParts, driversCsvText } from '@/components/dashboard/drivers/driversCsv';

// framer-motion restores the scroll position after measuring an expanded panel.
window.scrollTo = (() => {}) as typeof window.scrollTo;

const PRIVATE_LABEL = makeDriver();
const GLP1 = makeDriver({
  id: 'consumer_r02', name: 'GLP-1 adoption reshapes personal-care demand', direction: 'Expansion',
  category_exposure: categoryMap({ 'Hair: Care': 5 }),
});
const PACKAGING = makeDriver({
  id: 'government_r04', name: 'Packaging regulation cost stack', force: 'Government',
  category_exposure: categoryMap({ 'LHC: FCN': 4 }),
});
const RATED: DriverProposal = { probability: 3, gp1_pct_affected: 0.2, category_exposure: { 'Hair: Care': 4 } };

const response = (driverId: string, my: DriverProposal | null): DriverProposalsResponse => ({
  driver_id: driverId, my, scorers: [],
  aggregate: {
    probability: null, gp1_pct_affected: null, peak_year: null, diffusion_curve: null, uncertainty: null,
    vc_epicentre: null, category_exposure: {}, regional_exposure: {},
  },
});

beforeEach(() => {
  STORE.current = makeStore({ drivers: [PRIVATE_LABEL, GLP1, PACKAGING] });
  API.getDriverProposals.mockReset().mockImplementation(async (id: string) => response(id, null));
  API.saveMyProposal.mockReset().mockImplementation(async (id: string) => response(id, null));
  window.history.replaceState(null, '', '/dashboard');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const rowButton = (name: RegExp) => screen.getByRole('button', { name });
const rowNames = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '');

describe('the filters and the count', () => {
  it('narrows the list by force, counts the result and clears', () => {
    render(<Drivers />);
    expect(screen.getByText('3 drivers')).toBeTruthy();
    const forces = screen.getByRole('group', { name: 'Filter by force' });
    const government = within(forces).getByRole('button', { name: 'Government' });
    fireEvent.click(government);
    expect(government.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('1 of 3 drivers')).toBeTruthy();
    expect(rowNames().some((t) => t.includes('Packaging Rules & Fees'))).toBe(true);
    expect(rowNames().some((t) => t.includes('Private Label Share Gain'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('3 drivers')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('labels the category chips with the code in brackets for Laundry & Home Care', () => {
    render(<Drivers />);
    const categories = screen.getByRole('group', { name: 'Filter by category' });
    expect(within(categories).getByRole('button', { name: 'Fabric Clean (FCN)' })).toBeTruthy();
    expect(within(categories).getByRole('button', { name: 'Care' })).toBeTruthy();
    fireEvent.click(within(categories).getByRole('button', { name: 'Fabric Clean (FCN)' }));
    expect(screen.getByText('2 of 3 drivers')).toBeTruthy();   // the GLP-1 driver is not exposed to FCN
  });

  it('finds a driver by its code', () => {
    render(<Drivers />);
    fireEvent.change(screen.getByPlaceholderText('Search drivers…'), { target: { value: 'g-04' } });
    expect(screen.getByText('1 of 3 drivers')).toBeTruthy();
    expect(rowNames()[0]).toContain('G-04');
  });
});

describe('the table', () => {
  it('is an ARIA table whose column headers carry the sort state', () => {
    render(<Drivers />);
    const table = screen.getByRole('table', { name: 'Profit Pool Drivers' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(6);
    expect(headers.map((h) => h.getAttribute('aria-sort'))).toEqual(['none', 'none', 'none', 'none', 'none', null]);
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Probability' }));
    expect(headers[2]!.getAttribute('aria-sort')).toBe('descending');
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Probability' }));
    expect(headers[2]!.getAttribute('aria-sort')).toBe('ascending');
    expect(within(table).getAllByRole('row').length).toBe(4);   // the header and three drivers
    expect(within(table).getAllByRole('cell').length).toBe(18);
  });

  it('shows each driver with its code, its force and GP1 % as the model stores it, one decimal', () => {
    render(<Drivers />);
    const first = screen.getAllByRole('row')[1]!;
    expect(within(first).getByText('C-01')).toBeTruthy();
    expect(within(first).getByText('Consumer')).toBeTruthy();
    expect(within(first).getByText('22.0%')).toBeTruthy();
    expect(rowButton(/Private Label Share Gain/).getAttribute('aria-expanded')).toBe('false');
  });
});

describe('the address bar', () => {
  const withUrl = (ui: React.ReactElement, params: Record<string, string>) =>
    render(<ViewUrlProvider initial={{ view: 'drivers', params }}>{ui}</ViewUrlProvider>);

  it('opens on the mode and the driver the address names', async () => {
    withUrl(<Drivers />, { mode: 'rating', driver: 'consumer_r01' });
    expect(screen.getByRole('tab', { name: /Expert Rating/ }).getAttribute('aria-selected')).toBe('true');
    expect(rowButton(/Private Label Share Gain/).getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByText(/Expert Rating · your proposal/)).toBeTruthy();
  });

  it('applies the force and category filters from the address', () => {
    withUrl(<Drivers />, { force: 'Government', category: 'LHC: FCN', q: 'pack' });
    expect(screen.getByText('1 of 3 drivers')).toBeTruthy();
    expect((screen.getByPlaceholderText('Search drivers…') as HTMLInputElement).value).toBe('pack');
  });

  it('writes a toggled row, the mode and the search back to the address', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    withUrl(<Drivers />, {});
    fireEvent.click(rowButton(/GLP-1 Hair & Beauty Demand/));
    expect(window.location.search).toBe('?view=drivers&driver=consumer_r02');
    fireEvent.click(screen.getByRole('tab', { name: /Expert Rating/ }));
    expect(window.location.search).toBe('?view=drivers&driver=consumer_r02&mode=rating');
    fireEvent.change(screen.getByPlaceholderText('Search drivers…'), { target: { value: 'GLP' } });
    expect(window.location.search).not.toContain('q=');   // not before the pause in typing
    await act(async () => { vi.advanceTimersByTime(350); });
    expect(window.location.search).toBe('?view=drivers&driver=consumer_r02&mode=rating&q=GLP');
  });

  it('offers a link to the open driver and confirms the copy', async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    withUrl(<Drivers />, { driver: 'consumer_r02' });
    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toContain('view=drivers&driver=consumer_r02');
    expect(await screen.findByText('Link copied')).toBeTruthy();
  });
});

describe('the CSV export', () => {
  it('leads with the title, the date, the filter and the note, then the columns', () => {
    const filter = 'Filter: force Consumer; in the base order';
    const { preamble, header, rows } = driversCsvParts([PRIVATE_LABEL], filter, new Date('2026-10-15T12:00:00Z'));
    expect(preamble).toEqual([['PRISM drivers'], ['15 Oct 2026'], [filter], [CSV_NOTE]]);
    expect(header.slice(0, 14)).toEqual([
      'id', 'code', 'short name', 'long name', 'technical scope', 'force', 'direction', 'confidence', 'probability',
      'GP1 % affected', 'expected effect',
      'peak year', 'diffusion curve', 'uncertainty',
    ]);
    expect(header).toContain('Fabric Clean (FCN) exposure');
    expect(header).toContain('Europe exposure');
    expect(header.slice(-3)).toEqual(['value-chain epicentre', 'sources', 'edited']);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.slice(0, 14)).toEqual([
      'consumer_r01', 'C-01', 'Private Label Share Gain', 'Private label takes share from brands',
      'Private label structural penetration', 'Consumer', 'Contraction', 'Medium',
      '5', '22.0%', '-18.3%', '2030', 'S-Curve', '2',
    ]);
    expect(rows[0]!.slice(-3)).toEqual(['Commercial', '1', 'no']);
    const text = driversCsvText([PRIVATE_LABEL], filter, new Date('2026-10-15T12:00:00Z'));
    // The note holds commas, so it is quoted; an empty line separates the preamble from the table.
    expect(text.split('\r\n').slice(0, 5)).toEqual(['PRISM drivers', '15 Oct 2026', filter, `"${CSV_NOTE}"`, '']);
    expect(text.split('\r\n')[5]).toMatch(/^id,code,short name,long name,technical scope,force,/);
  });
});

describe('a radio group', () => {
  it('has one tab stop and moves the check with the arrow keys', async () => {
    STORE.current = makeStore({ drivers: [makeDriver({ category_exposure: categoryMap({ 'Hair: Color': 2 }) })] });
    render(<Drivers isAdmin />);
    fireEvent.click(rowButton(/Private Label Share Gain/));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const group = screen.getByRole('radiogroup', { name: 'Hair: Color exposure: 2 of 5' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '-1', '0', '-1', '-1', '-1']);
    fireEvent.keyDown(radios[2]!, { key: 'ArrowRight' });
    const after = within(screen.getByRole('radiogroup', { name: 'Hair: Color exposure: 3 of 5' })).getAllByRole('radio');
    expect(after[3]!.getAttribute('aria-checked')).toBe('true');
    expect(after.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1', '0', '-1', '-1']);
    expect(document.activeElement).toBe(after[3]);
    fireEvent.keyDown(after[3]!, { key: 'Home' });
    expect(within(screen.getByRole('radiogroup', { name: 'Hair: Color exposure: 0 of 5' })).getAllByRole('radio')[0]!.getAttribute('aria-checked')).toBe('true');
  });

  it('marks the baseline score on its dot', async () => {
    render(<Drivers isAdmin />);
    fireEvent.click(rowButton(/Private Label Share Gain/));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const group = screen.getByRole('radiogroup', { name: 'Hair: Care exposure: 3 of 5' });
    expect(within(group).getByText('Baseline 3 of 5')).toBeTruthy();
  });
});

describe('Expert Rating', () => {
  const ratedStore = () => makeStore({ drivers: [
    { ...PRIVATE_LABEL, proposal_summary: { ...PRIVATE_LABEL.proposal_summary, my: RATED } },
    GLP1,
    PACKAGING,
  ] });

  it('counts the rated drivers and can hide them', () => {
    STORE.current = ratedStore();
    render(<Drivers />);
    fireEvent.click(screen.getByRole('tab', { name: /Expert Rating/ }));
    expect(screen.getByRole('status').textContent).toBe('1 of 3 rated');
    fireEvent.click(screen.getByRole('button', { name: 'Not rated' }));
    expect(screen.getByText('2 of 3 drivers')).toBeTruthy();
    expect(rowNames().some((t) => t.includes('Private Label Share Gain'))).toBe(false);
  });

  it('keeps the row being scored in the list under "Not rated" until another opens', async () => {
    // The open driver becomes rated as the expert scores it; it stays until Next unrated moves on.
    STORE.current = makeStore({ drivers: [PRIVATE_LABEL, GLP1, PACKAGING] });
    render(<Drivers />);
    fireEvent.click(screen.getByRole('tab', { name: /Expert Rating/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Not rated' }));
    expect(screen.getByText('3 of 3 drivers')).toBeTruthy();
    fireEvent.click(rowButton(/Private Label Share Gain/));
    const group = await screen.findByRole('radiogroup', { name: /^Probability/ });
    fireEvent.click(within(group).getByRole('radio', { name: '4 of 5' }));
    const slider = screen.getByRole('slider', { name: /GP1/ });
    fireEvent.change(slider, { target: { value: '30' } });
    const hair = await screen.findByRole('radiogroup', { name: /Hair: Care/ });
    fireEvent.click(within(hair).getByRole('radio', { name: '4 of 5' }));
    // Rated now, and still open in the list.
    expect(screen.getByText('1 of 3 rated')).toBeTruthy();
    expect(rowButton(/Private Label Share Gain/).getAttribute('aria-expanded')).toBe('true');
    expect(rowNames().some((t) => t.includes('Private Label Share Gain'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next unrated' }));
    await waitFor(() => expect(rowNames().some((t) => t.includes('Private Label Share Gain'))).toBe(false));
    expect(rowButton(/GLP-1 Hair & Beauty Demand/).getAttribute('aria-expanded')).toBe('true');
  });

  it('moves to the next unrated driver in the list order, and says when none is left', async () => {
    // The panel loads the stored proposal, which is the rating the list already knows.
    API.getDriverProposals.mockImplementation(async (id: string) => response(id, id === 'consumer_r01' ? RATED : null));
    STORE.current = ratedStore();
    render(<Drivers />);
    fireEvent.click(screen.getByRole('tab', { name: /Expert Rating/ }));
    fireEvent.click(rowButton(/Private Label Share Gain/));
    fireEvent.click(await screen.findByRole('button', { name: 'Next unrated' }));
    expect(rowButton(/Private Label Share Gain/).getAttribute('aria-expanded')).toBe('false');
    expect(rowButton(/GLP-1 Hair & Beauty Demand/).getAttribute('aria-expanded')).toBe('true');

    cleanup();
    STORE.current = makeStore({ drivers: [
      { ...PRIVATE_LABEL, proposal_summary: { ...PRIVATE_LABEL.proposal_summary, my: RATED } },
      { ...GLP1, proposal_summary: { ...GLP1.proposal_summary, my: RATED } },
    ] });
    render(<Drivers />);
    fireEvent.click(screen.getByRole('tab', { name: /Expert Rating/ }));
    fireEvent.click(rowButton(/Private Label Share Gain/));
    const next = await screen.findByRole('button', { name: 'Next unrated' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(screen.getByText('Every other driver in this list is rated')).toBeTruthy();
  });

  it('offers a retry when a save fails, and the status lives in a status region', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    API.saveMyProposal.mockRejectedValueOnce(new Error('offline')).mockImplementation(async (id: string) => response(id, null));
    render(<Drivers />);
    fireEvent.click(screen.getByRole('tab', { name: /Expert Rating/ }));
    fireEvent.click(rowButton(/Private Label Share Gain/));
    const group = await screen.findByRole('radiogroup', { name: /^Probability/ });
    fireEvent.click(within(group).getByRole('radio', { name: '4 of 5' }));
    await act(async () => { vi.advanceTimersByTime(700); });
    const failed = await screen.findByText('Save failed');
    expect(failed.closest('[role="status"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(API.saveMyProposal).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('All changes saved')).toBeTruthy();
  });
});

describe('the unsaved-edit guard', () => {
  async function startEditing() {
    render(<Drivers isAdmin />);
    fireEvent.click(rowButton(/Private Label Share Gain/));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue(PRIVATE_LABEL.description), { target: { value: 'My wording.' } });
  }

  it('asks before a row toggle drops the edits, and Keep editing keeps them', async () => {
    await startEditing();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(rowButton(/Private Label Share Gain/));
    const dialog = screen.getByRole('dialog', { name: 'Discard the edits to Private Label Share Gain?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByDisplayValue('My wording.')).toBeTruthy();
    expect(rowButton(/Private Label Share Gain/).getAttribute('aria-expanded')).toBe('true');
  });

  it('asks before a mode change, and Discard goes ahead', async () => {
    await startEditing();
    fireEvent.click(screen.getByRole('tab', { name: /Expert Rating/ }));
    expect(screen.getByRole('tab', { name: /Expert Rating/ }).getAttribute('aria-selected')).toBe('false');
    const dialog = screen.getByRole('dialog', { name: /Discard the edits/ });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('tab', { name: /Expert Rating/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByDisplayValue('My wording.')).toBeNull();
  });

  it('does not ask when nothing was edited', async () => {
    render(<Drivers isAdmin />);
    fireEvent.click(rowButton(/Private Label Share Gain/));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByText('No changes yet')).toBeTruthy();
    fireEvent.click(rowButton(/Private Label Share Gain/));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rowButton(/Private Label Share Gain/).getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps a dirty row in the list when a search or filter would drop it', async () => {
    await startEditing();
    fireEvent.change(screen.getByPlaceholderText('Search drivers…'), { target: { value: 'GLP' } });
    expect(screen.getByText('2 of 3 drivers')).toBeTruthy();   // GLP-1 and the pinned editor
    expect(rowButton(/GLP-1 Hair & Beauty Demand/)).toBeTruthy();
    expect(screen.getByDisplayValue('My wording.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Government' }));
    expect(screen.getByText('1 of 3 drivers')).toBeTruthy();   // the pinned editor alone (the search still applies)
    expect(screen.getByDisplayValue('My wording.')).toBeTruthy();
  });

  it('asks when the address moves away from a dirty editor, and keeps the address on it meanwhile', async () => {
    render(<ViewUrlProvider initial={{ view: 'drivers', params: { driver: 'consumer_r01' } }}><Drivers isAdmin /></ViewUrlProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue(PRIVATE_LABEL.description), { target: { value: 'My wording.' } });
    // Back to an address without the driver.
    await act(async () => {
      window.history.replaceState(null, '', '/dashboard?view=drivers');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    const dialog = screen.getByRole('dialog', { name: /Discard the edits/ });
    expect(screen.getByDisplayValue('My wording.')).toBeTruthy();
    expect(window.location.search).toBe('?view=drivers&driver=consumer_r01');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.search).toBe('?view=drivers');
    expect(rowButton(/Private Label Share Gain/).getAttribute('aria-expanded')).toBe('false');
  });

  it('warns before the page unloads with edits, except while the session is ending', async () => {
    await startEditing();
    const leave = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };
    expect(leave()).toBe(true);
    // The flag is module state and nothing resets it: this stays the last
    // test in the file that leaves the page, so no later test expects the warning.
    const session = await import('@/lib/session');
    session.markSessionEnded();
    expect(leave()).toBe(false);
  });
});

describe('the Edited chip', () => {
  it('opens the list of changes, closes on Escape and gives focus back', () => {
    STORE.current = makeStore({ drivers: [makeDriver({ probability: 4, scores_edited: true })] });
    render(<Drivers />);
    const chip = screen.getByRole('button', { name: 'Edited' });
    fireEvent.click(chip);
    const popover = screen.getByRole('dialog', { name: 'Changed from the baseline' });
    expect(within(popover).getByText('Probability: 4 / 5 (baseline 5 / 5)')).toBeTruthy();
    expect(rowButton(/Private Label Share Gain/).getAttribute('aria-expanded')).toBe('false');   // the row did not toggle
    fireEvent.keyDown(popover, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(chip);
  });
});
