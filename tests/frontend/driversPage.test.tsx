// @vitest-environment jsdom
/**
 * The Drivers page around the list: a drill-through from another view, the
 * states a failed load leaves, and the Expert Rating panel's own proposal.
 *
 *   - A drill-through replaces the search and clears the category filter,
 *     every time, even for the same driver twice; one by code opens that
 *     driver through the address, and a code in the search or in a boundary
 *     sentence opens its driver without dropping an admin's unsaved edits.
 *   - A list that failed to load says so instead of "no drivers match".
 *   - A source names the host it is published on.
 *   - The Expert Rating panel cannot be edited before the expert's stored
 *     proposal has loaded (a save from a blank draft would overwrite it); its
 *     saves go out one at a time with the newest draft; a field clicked again
 *     is cleared (sent as null); a half-typed year, or one not after the
 *     driver's onset, is never sent and stays in the field with a message.
 *     A panel opened again waits for a save
 *     still on its way before it loads, and an edit held back is sent as soon
 *     as the session ends.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react';
import type { DriverProposal, DriverProposalsResponse } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { BASE_BY_CODE, categoryMap, makeDriver, makeStore } from './fixtures/prism';

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
import { drillThroughParams } from '@/lib/driverNames';

/** The address a drill-through writes, as the initial address of a provider (no empty keys). */
const drillThroughAddress = (query: string): Record<string, string> =>
  Object.fromEntries(Object.entries(drillThroughParams(query)).filter((e): e is [string, string] => e[1] != null));
import { TECHNICAL_SCOPE_LABEL } from '@/components/dashboard/drivers/DriverHeading';
import { ExpertRatingPanel } from '@/components/dashboard/drivers/ExpertRating';
import { SourceItem, sourceHost } from '@/components/dashboard/drivers/cards';
import { settleProposalSaves } from '@/lib/proposalSaves';

// framer-motion restores the scroll position after measuring an expanded panel.
window.scrollTo = (() => {}) as typeof window.scrollTo;

const PRIVATE_LABEL = makeDriver();
const GLP1 = makeDriver({
  id: 'consumer_r02', name: 'GLP-1 adoption reshapes personal-care demand', direction: 'Expansion',
  category_exposure: categoryMap({ 'Hair: Care': 5 }),
});

const response = (my: DriverProposal | null): DriverProposalsResponse => ({
  driver_id: PRIVATE_LABEL.id, my, scorers: [],
  aggregate: {
    probability: null, gp1_pct_affected: null, peak_year: null, diffusion_curve: null, uncertainty: null,
    vc_epicentre: null, category_exposure: {}, regional_exposure: {},
  },
});

beforeEach(() => {
  STORE.current = makeStore({ drivers: [PRIVATE_LABEL, GLP1] });
  API.getDriverProposals.mockReset().mockResolvedValue(response({ probability: 2, category_exposure: { 'Hair: Care': 4 } }));
  API.saveMyProposal.mockReset().mockImplementation(async () => response(null));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const rows = () => screen.queryAllByRole('button', { name: /Private Label Share Gain|GLP-1/ }).map((b) => b.textContent);

describe('a drill-through from another view', () => {
  it('replaces the search and clears the category filter, every time it arrives', () => {
    const { rerender } = render(<Drivers search={{ query: 'GLP-1', seq: 1 }} />);
    expect(rows().some((t) => t?.includes('GLP-1'))).toBe(true);
    expect(rows().some((t) => t?.includes('Private Label Share Gain'))).toBe(false);

    // The user clears the search and picks a category the GLP-1 driver is not exposed to.
    fireEvent.change(screen.getByPlaceholderText('Search drivers…'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fabric Clean (FCN)' }));
    expect(rows().some((t) => t?.includes('GLP-1'))).toBe(false);

    // The same driver opened again: a new drill-through, so it shows again.
    rerender(<Drivers search={{ query: 'GLP-1', seq: 2 }} />);
    expect((screen.getByPlaceholderText('Search drivers…') as HTMLInputElement).value).toBe('GLP-1');
    expect(rows().some((t) => t?.includes('GLP-1'))).toBe(true);
  });
});

describe("a driver's names on the Drivers page", () => {
  /** The last line of an opened driver's head, which only an opened driver shows. */
  const opened = (technicalScope: string) => `${TECHNICAL_SCOPE_LABEL}: ${technicalScope}`;

  it('opens the driver whose code is typed into the search, in either case, and shows it alone', async () => {
    render(<Drivers />);
    fireEvent.change(screen.getByPlaceholderText('Search drivers…'), { target: { value: 'c-02' } });
    expect(rows().some((t) => t?.includes('GLP-1'))).toBe(true);
    expect(rows().some((t) => t?.includes('Private Label Share Gain'))).toBe(false);
    expect(await screen.findByText(opened(GLP1.name))).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Search drivers…'), { target: { value: 'C-01' } });
    expect(rows().some((t) => t?.includes('GLP-1'))).toBe(false);
    expect(await screen.findByText(opened(PRIVATE_LABEL.name))).toBeTruthy();
  });

  it('builds the address of a drill-through: a code names its driver, any other query only searches', () => {
    expect(drillThroughParams('C-01')).toEqual({ q: 'C-01', driver: 'consumer_r01' });
    expect(drillThroughParams('c-02')).toEqual({ q: 'c-02', driver: 'consumer_r02' });
    expect(drillThroughParams('C-99')).toEqual({ q: 'C-99', driver: null });
    expect(drillThroughParams('Private label')).toEqual({ q: 'Private label', driver: null });
  });

  it('opens the driver a drill-through hands over by its code, through the address', async () => {
    // As DashboardApp's openDriver opens the page: the search, and the address it builds.
    render(
      <ViewUrlProvider initial={{ view: 'drivers', params: drillThroughAddress('C-01') }}>
        <Drivers search={{ query: 'C-01', seq: 1 }} />
      </ViewUrlProvider>);
    expect(rows().some((t) => t?.includes('GLP-1'))).toBe(false);
    expect(await screen.findByText(opened(PRIVATE_LABEL.name))).toBeTruthy();
  });

  it('opens the driver of a later drill-through on a page already open', async () => {
    const ui = (seq: number) => (
      <ViewUrlProvider initial={{ view: 'drivers', params: {} }}>
        <Drivers search={seq ? { query: 'C-02', seq } : null} />
      </ViewUrlProvider>);
    const { rerender } = render(ui(0));
    expect(screen.queryByText(opened(GLP1.name))).toBeNull();
    // The dashboard writes the drill-through's address, then hands down the search.
    await act(async () => {
      window.history.pushState(null, '', '/dashboard?view=drivers&q=C-02&driver=consumer_r02');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    rerender(ui(1));
    expect(rows().some((t) => t?.includes('Private Label Share Gain'))).toBe(false);
    expect(await screen.findByText(opened(GLP1.name))).toBeTruthy();
  });

  it('opens a typed code past an active filter, which it clears', async () => {
    render(
      <ViewUrlProvider initial={{ view: 'drivers', params: { force: 'Government' } }}>
        <Drivers />
      </ViewUrlProvider>);
    expect(rows()).toHaveLength(0);   // the Government filter hides both drivers
    fireEvent.change(screen.getByPlaceholderText('Search drivers…'), { target: { value: 'C-02' } });
    expect(await screen.findByText(opened(GLP1.name))).toBeTruthy();
    expect(rows().some((t) => t?.includes('GLP-1'))).toBe(true);
    expect(window.location.search).not.toContain('force=');
    expect(window.location.search).toContain('driver=consumer_r02');
  });

  it('wires the drill-through to the address: DashboardApp opens the Drivers page with drillThroughParams', () => {
    // The dashboard shell needs Clerk to render; this pins the one line the drill-through depends on.
    const source = readFileSync(resolve(__dirname, '../../app/dashboard/DashboardApp.tsx'), 'utf-8');
    expect(source).toMatch(/openView\('drivers', \{ push: true, params: drillThroughParams\(query\) \}\)/);
  });

  it('asks before a boundary link drops unsaved edits: Keep editing stays, Discard opens the cited driver', async () => {
    const k01 = BASE_BY_CODE['K-01'];
    STORE.current = makeStore({
      drivers: [PRIVATE_LABEL, GLP1, makeDriver({ id: k01.driverId, force: 'Customer', name: k01.name })],
    });
    render(
      <ViewUrlProvider initial={{ view: 'drivers', params: { driver: 'consumer_r01' } }}>
        <Drivers isAdmin />
      </ViewUrlProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue(PRIVATE_LABEL.description), { target: { value: 'My wording.' } });
    const link = () => screen.getByRole('button', { name: `K-01 ${k01.shortName}` });
    fireEvent.click(link());
    fireEvent.click(within(screen.getByRole('dialog', { name: /Discard the edits/ })).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByDisplayValue('My wording.')).toBeTruthy();
    expect(screen.queryByText(opened(k01.name))).toBeNull();
    fireEvent.click(link());
    fireEvent.click(within(screen.getByRole('dialog', { name: /Discard the edits/ })).getByRole('button', { name: 'Discard' }));
    expect(await screen.findByText(opened(k01.name))).toBeTruthy();
    expect(screen.queryByDisplayValue('My wording.')).toBeNull();
  });

  it('moves the focus to the driver a boundary link opens, and Back returns to the driver that cited it', async () => {
    const k01 = BASE_BY_CODE['K-01'];
    STORE.current = makeStore({
      drivers: [PRIVATE_LABEL, GLP1, makeDriver({ id: k01.driverId, force: 'Customer', name: k01.name })],
    });
    window.history.replaceState(null, '', '/dashboard?view=drivers&driver=consumer_r01');
    render(
      <ViewUrlProvider initial={{ view: 'drivers', params: { driver: 'consumer_r01' } }}>
        <Drivers />
      </ViewUrlProvider>);
    fireEvent.click(await screen.findByRole('button', { name: `K-01 ${k01.shortName}` }));
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-expanded')).toBe('true'));
    expect(document.activeElement?.textContent).toContain(k01.shortName);
    // A link is a step in the history: Back goes to the driver that cited it.
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(await screen.findByText(opened(PRIVATE_LABEL.name))).toBeTruthy();
  });

  it('asks once for a typed code: a keystroke that leaves the same code does not ask again', async () => {
    render(
      <ViewUrlProvider initial={{ view: 'drivers', params: { driver: 'consumer_r01' } }}>
        <Drivers isAdmin />
      </ViewUrlProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue(PRIVATE_LABEL.description), { target: { value: 'My wording.' } });
    const search = screen.getByPlaceholderText('Search drivers…');
    fireEvent.change(search, { target: { value: 'C-02' } });
    fireEvent.click(within(screen.getByRole('dialog', { name: /Discard the edits/ })).getByRole('button', { name: 'Keep editing' }));
    fireEvent.change(search, { target: { value: 'C-02 ' } });
    expect(screen.queryByRole('dialog', { name: /Discard the edits/ })).toBeNull();
    expect(screen.getByDisplayValue('My wording.')).toBeTruthy();
  });

  it('asks before a code in the search drops an admin\'s unsaved edits', async () => {
    render(
      <ViewUrlProvider initial={{ view: 'drivers', params: { driver: 'consumer_r01' } }}>
        <Drivers isAdmin />
      </ViewUrlProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue(PRIVATE_LABEL.description), { target: { value: 'My wording.' } });
    fireEvent.change(screen.getByPlaceholderText('Search drivers…'), { target: { value: 'C-02' } });
    const dialog = screen.getByRole('dialog', { name: /Discard the edits/ });
    expect(screen.getByDisplayValue('My wording.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
    expect(await screen.findByText(opened(GLP1.name))).toBeTruthy();
    expect(screen.queryByDisplayValue('My wording.')).toBeNull();
  });

  it('finds a driver by its long name, its descriptor and its technical scope', () => {
    render(<Drivers />);
    const search = screen.getByPlaceholderText('Search drivers…');
    for (const query of [BASE_BY_CODE['C-02'].longName, BASE_BY_CODE['C-02'].descriptor, 'reshapes personal-care']) {
      fireEvent.change(search, { target: { value: query } });
      expect(rows().some((t) => t?.includes('GLP-1'))).toBe(true);
      expect(rows().some((t) => t?.includes('Private Label Share Gain'))).toBe(false);
    }
  });

  it('opens a driver that a boundary sentence cites', async () => {
    const k01 = BASE_BY_CODE['K-01'];
    STORE.current = makeStore({
      drivers: [PRIVATE_LABEL, GLP1, makeDriver({ id: k01.driverId, force: 'Customer', name: k01.name })],
    });
    render(
      <ViewUrlProvider initial={{ view: 'drivers', params: drillThroughAddress('C-01') }}>
        <Drivers search={{ query: 'C-01', seq: 1 }} />
      </ViewUrlProvider>);
    fireEvent.click(await screen.findByRole('button', { name: `K-01 ${k01.shortName}` }));
    expect(await screen.findByText(opened(k01.name))).toBeTruthy();
    expect((screen.getByPlaceholderText('Search drivers…') as HTMLInputElement).value).toBe('K-01');
    expect(screen.queryByText(opened(PRIVATE_LABEL.name))).toBeNull();
    expect(window.location.search).toContain(`driver=${k01.driverId}`);
  });

  it('labels a cited code with the code alone until the drivers it names have loaded', async () => {
    render(
      <ViewUrlProvider initial={{ view: 'drivers', params: { driver: 'consumer_r01' } }}>
        <Drivers />
      </ViewUrlProvider>);
    expect(await screen.findByRole('button', { name: 'K-01' })).toBeTruthy();
  });

  it('opens a cited driver in Expert Rating and in Review & Endorse as well', async () => {
    const k01 = BASE_BY_CODE['K-01'];
    STORE.current = makeStore({
      drivers: [PRIVATE_LABEL, GLP1, makeDriver({ id: k01.driverId, force: 'Customer', name: k01.name })],
    });
    for (const mode of ['rating', 'review']) {
      const { unmount } = render(
        <ViewUrlProvider initial={{ view: 'drivers', params: { driver: 'consumer_r01', mode } }}>
          <Drivers isAdmin />
        </ViewUrlProvider>);
      // once the proposals have loaded, when the panel's head is the one that stays
      await waitFor(() => expect(screen.queryByText(/^Loading/)).toBeNull());
      fireEvent.click(await screen.findByRole('button', { name: `K-01 ${k01.shortName}` }));
      expect(await screen.findByText(opened(k01.name))).toBeTruthy();
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe(
        mode === 'rating' ? 'Expert Rating' : 'Review & Endorse');
      unmount();
    }
  });

  it('sorts the Driver column by short name, not by technical scope', () => {
    const x15 = BASE_BY_CODE['X-15'];
    STORE.current = makeStore({
      drivers: [PRIVATE_LABEL, GLP1, makeDriver({ id: x15.driverId, force: 'Competitive', name: x15.name })],
    });
    render(<Drivers />);
    const shortNames = [x15.shortName, BASE_BY_CODE['C-02'].shortName, BASE_BY_CODE['C-01'].shortName];
    const order = () => screen.getAllByRole('button', { name: new RegExp(shortNames.join('|')) })
      .map((row) => shortNames.find((n) => row.textContent?.includes(n)));
    fireEvent.click(screen.getByRole('button', { name: /^Sort by Driver/ }));
    // By technical scope X-15 ("Scale-leader innovation ...") would come last.
    expect(order()).toEqual(shortNames);
  });

  it('opens the glossary of the names from the helper line and closes it with Escape or Close', () => {
    render(<Drivers />);
    fireEvent.click(screen.getByRole('button', { name: 'How the driver names work' }));
    expect(within(screen.getByRole('dialog', { name: 'How the driver names work' })).getByText('Share Gain')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'How the driver names work' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('a source', () => {
  it('is a link when it has one, and plain text when it has none', () => {
    const { rerender } = render(<SourceItem src={{ title: 'Trade note', url: '', tier: 'B', published: 'Apr 2026' }} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Trade note')).toBeTruthy();
    rerender(<SourceItem src={{ title: '', url: 'https://www.example.org/report', tier: '', published: '' }} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://www.example.org/report');
    expect(screen.getAllByText('example.org').length).toBeGreaterThan(0);   // a source without a title shows its host
  });

  it('names the host it is published on, without guessing what kind of source it is', () => {
    expect(sourceHost('https://www.eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1781')).toBe('eur-lex.europa.eu');
    expect(sourceHost('https://pubmed.ncbi.nlm.nih.gov/?term=semaglutide')).toBe('pubmed.ncbi.nlm.nih.gov');
    expect(sourceHost('not a link')).toBeNull();
  });
});

describe('the states around the list', () => {
  it('says the list could not be loaded, with a retry, instead of "no drivers match"', () => {
    STORE.current = makeStore({ drivers: [], driversError: 'Invalid or expired token' });
    render(<Drivers />);
    expect(screen.getByText('The drivers could not be loaded: Invalid or expired token')).toBeTruthy();
    expect(screen.queryByText(/No drivers match/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(STORE.current.reload).toHaveBeenCalled();
  });

  it('says when the listed drivers could not be reloaded, in the list and in an open panel', async () => {
    // After a save whose reload failed, the list may show a driver as it was before the save.
    STORE.current = makeStore({ drivers: [PRIVATE_LABEL, GLP1], driversError: 'The PRISM service could not be reached' });
    const { rerender } = render(<Drivers isAdmin />);
    expect(screen.getByRole('status').textContent).toBe(
      'The drivers could not be reloaded: The PRISM service could not be reached. '
      + 'The list shows them as they were last loaded.Try again');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(STORE.current.reload).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Private Label Share Gain/ }));
    expect(await screen.findByText('The drivers could not be reloaded, so this may not show the latest save.')).toBeTruthy();

    // While the database cannot be used, the service notice says it for every view.
    STORE.current = makeStore({
      drivers: [PRIVATE_LABEL, GLP1], driversError: 'Try again in a moment', databaseFailure: 'db_error',
    });
    rerender(<Drivers isAdmin />);
    expect(screen.queryByText(/The list shows them as they were last loaded/)).toBeNull();
  });

  it('offers to clear a search that matches nothing', () => {
    render(<Drivers />);
    fireEvent.change(screen.getByPlaceholderText('Search drivers…'), { target: { value: 'nothing like this' } });
    expect(screen.getByText('No drivers match the current search and filter.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and filter' }));
    expect(rows()).toHaveLength(2);
  });
});

describe('the admin editor', () => {
  it('sends the changed exposure cells only, with the revision it started from', async () => {
    const driver = makeDriver({ revision: 7, category_exposure: categoryMap({ 'Hair: Care': 5, 'Hair: Color': 2 }) });
    STORE.current = makeStore({ drivers: [driver] });
    render(<Drivers isAdmin />);
    fireEvent.click(screen.getByRole('button', { name: /Private Label Share Gain/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const color = screen.getByRole('radiogroup', { name: 'Hair: Color exposure: 2 of 5' });
    fireEvent.click(within(color).getByRole('radio', { name: '4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(STORE.current!.updateDriver).toHaveBeenCalledTimes(1));
    expect(vi.mocked(STORE.current!.updateDriver).mock.calls[0]).toEqual([
      driver.id, { revision: 7, category_exposure: { 'Hair: Color': 4 } }]);
  });

  it('raises no conflict when the saved driver arrives before the save resolves', async () => {
    // The store reloads the drivers first; the saved driver is one revision on
    // while the editor is still open for a moment.
    const driver = makeDriver({ revision: 7 });
    let resolveSave: () => void = () => {};
    const updateDriver = vi.fn<PrismStore['updateDriver']>(() => new Promise((resolve) => { resolveSave = resolve; }));
    STORE.current = makeStore({ drivers: [driver], updateDriver });
    const { rerender } = render(<Drivers isAdmin />);
    fireEvent.click(screen.getByRole('button', { name: /Private Label Share Gain/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue(driver.description), { target: { value: 'My wording.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    STORE.current = makeStore({ drivers: [{ ...driver, revision: 8, description: 'My wording.' }], updateDriver });
    rerender(<Drivers isAdmin />);
    expect(screen.queryByText(/has changed since/)).toBeNull();
    await act(async () => { resolveSave(); });
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.queryByText(/has changed since/)).toBeNull();
  });

  it('says so when the driver changes while it is being edited, and saves nothing until the edits are discarded', async () => {
    const driver = makeDriver({ revision: 7 });
    STORE.current = makeStore({ drivers: [driver] });
    const { rerender } = render(<Drivers isAdmin />);
    fireEvent.click(screen.getByRole('button', { name: /Private Label Share Gain/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue(driver.description), { target: { value: 'My wording.' } });
    // Another save reaches the driver first; the store brings it.
    STORE.current = makeStore({ drivers: [{ ...driver, revision: 8, description: 'Their wording.' }] });
    rerender(<Drivers isAdmin />);
    expect(screen.getByRole('alert').textContent).toBe(
      'This driver has changed since you started editing; saving would be refused. '
      + 'Discard your edits to see the current version.');
    expect(screen.getByDisplayValue('My wording.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }));
    expect(screen.getByText('Their wording.')).toBeTruthy();
    expect(STORE.current.updateDriver).not.toHaveBeenCalled();
  });

  it('holds the form still while its save is on the way', async () => {
    // The editor closes when the save lands: an edit typed meanwhile would be lost unseen.
    const driver = makeDriver({ revision: 7 });
    let resolveSave: () => void = () => {};
    const updateDriver = vi.fn<PrismStore['updateDriver']>(() => new Promise((resolve) => { resolveSave = resolve; }));
    STORE.current = makeStore({ drivers: [driver], updateDriver });
    render(<Drivers isAdmin />);
    fireEvent.click(screen.getByRole('button', { name: /Private Label Share Gain/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue(driver.description), { target: { value: 'My wording.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.change(screen.getByDisplayValue('My wording.'), { target: { value: 'Typed while saving.' } });
    expect(screen.queryByDisplayValue('Typed while saving.')).toBeNull();
    expect(screen.getByDisplayValue('My wording.')).toBeTruthy();
    await act(async () => { resolveSave(); });
    expect(vi.mocked(updateDriver).mock.calls[0]![1]).toEqual({ revision: 7, description: 'My wording.' });
  });

  it('sends the value-chain epicentre as the stage it names', async () => {
    const driver = makeDriver({ revision: 7 });
    STORE.current = makeStore({ drivers: [driver] });
    render(<Drivers isAdmin />);
    fireEvent.click(screen.getByRole('button', { name: /Private Label Share Gain/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Comm' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Mktg' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(STORE.current!.updateDriver).toHaveBeenCalledTimes(1));
    expect(vi.mocked(STORE.current!.updateDriver).mock.calls[0]).toEqual([
      driver.id, { revision: 7, vc_epicentre: 'Marketing' }]);
  });
});

describe('the admin editor checks what the API would refuse', () => {
  async function openEditor(driver = makeDriver({ revision: 7 })) {
    STORE.current = makeStore({ drivers: [driver] });
    render(<Drivers isAdmin />);
    fireEvent.click(screen.getByRole('button', { name: /Private Label Share Gain/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    return driver;
  }
  const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

  it('holds Save while the peak year is not a year after the onset up to 2035, then sends it as typed', async () => {
    const driver = await openEditor();
    const year = screen.getByRole('textbox', { name: 'Peak year, 2026 to 2035' });
    for (const typed of ['203', '2040', '2025', 'x']) {
      fireEvent.change(year, { target: { value: typed } });
      expect(year.getAttribute('aria-invalid')).toBe('true');
      expect(save().disabled).toBe(true);
      expect(screen.getByText('A whole year from 2026 (after the onset) to 2035')).toBeTruthy();
    }
    fireEvent.change(year, { target: { value: '2033' } });
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    await waitFor(() => expect(STORE.current!.updateDriver).toHaveBeenCalledTimes(1));
    expect(vi.mocked(STORE.current!.updateDriver).mock.calls[0]).toEqual([driver.id, { revision: 7, peak_year: 2033 }]);
  });

  it('after a save that timed out, asks for the stored driver before another save', async () => {
    const { ApiError } = await import('@/lib/apiClient');
    await openEditor();
    vi.mocked(STORE.current!.updateDriver).mockRejectedValueOnce(new ApiError(0, 'The request timed out after 20 s', true));
    fireEvent.change(screen.getByRole('textbox', { name: 'Peak year, 2026 to 2035' }), { target: { value: '2033' } });
    fireEvent.click(save());
    expect(await screen.findByText(/got no answer and may still have been stored/)).toBeTruthy();
    expect(save().disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Discard edits' })).toBeTruthy();
  });

  it('holds Save while a source link is not an http(s) address', async () => {
    const driver = await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
    const titles = screen.getAllByRole('textbox', { name: 'Source title' });
    fireEvent.change(titles[titles.length - 1]!, { target: { value: 'Trade note' } });
    const links = screen.getAllByRole('textbox', { name: 'Source link' });
    const link = links[links.length - 1]!;
    for (const typed of ['www.example.org/note', 'https://example.org/a note.pdf', 'javascript:alert(1)']) {
      fireEvent.change(link, { target: { value: typed } });
      expect(link.getAttribute('aria-invalid')).toBe('true');
      expect(save().disabled).toBe(true);
    }
    fireEvent.change(link, { target: { value: ' https://example.org/note ' } });
    fireEvent.click(save());
    await waitFor(() => expect(STORE.current!.updateDriver).toHaveBeenCalledTimes(1));
    const sent = vi.mocked(STORE.current!.updateDriver).mock.calls[0]![1];
    expect(sent.revision).toBe(7);
    expect(sent.sources!.at(-1)).toEqual({ title: 'Trade note', url: 'https://example.org/note', tier: '', published: '' });
    expect(sent.sources!.length).toBe(driver.sources.length + 1);
  });
});

/** Opens the Expert Rating panel of the private-label driver. */
function openExpertRating() {
  render(<Drivers />);
  fireEvent.click(screen.getByRole('tab', { name: /Expert Rating/ }));
  fireEvent.click(screen.getByRole('button', { name: /Private Label Share Gain/ }));
}

const probabilityDot = (n: number) =>
  within(screen.getByRole('radiogroup', { name: /^Probability/ })).getByRole('radio', { name: `${n} of 5` });

describe('the Expert Rating panel', () => {
  it('cannot be edited until the stored proposal has loaded', async () => {
    let resolve!: (r: DriverProposalsResponse) => void;
    API.getDriverProposals.mockReturnValue(new Promise((r) => { resolve = r; }));
    openExpertRating();
    expect(screen.getByText('Loading your proposal…')).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: /^Probability/ })).toBeNull();
    await act(async () => { resolve(response({ probability: 2 })); });
    expect(probabilityDot(2).getAttribute('aria-checked')).toBe('true');
  });

  it('offers a retry and no editing when the stored proposal cannot be loaded', async () => {
    API.getDriverProposals.mockRejectedValueOnce(new Error('offline'));
    openExpertRating();
    expect(await screen.findByText(/your proposal cannot be edited right now/)).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: /^Probability/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('radiogroup', { name: /^Probability/ })).toBeTruthy();
  });

  it('shows an unscored exposure cell as unscored, not as 0', async () => {
    openExpertRating();
    await screen.findByRole('radiogroup', { name: /^Probability/ });
    expect(screen.getByRole('radiogroup', { name: 'Hair: Care exposure: 4 of 5' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'LHC: FCN exposure: not scored' })).toBeTruthy();
  });

  it('clears a field clicked again by sending null', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    openExpertRating();
    await screen.findByRole('radiogroup', { name: /^Probability/ });
    fireEvent.click(probabilityDot(2));   // the stored score, clicked again
    await act(async () => { vi.advanceTimersByTime(700); });
    await waitFor(() => expect(API.saveMyProposal).toHaveBeenCalledTimes(1));
    expect(API.saveMyProposal.mock.calls[0]![1]).toMatchObject({ probability: null, category_exposure: { 'Hair: Care': 4 } });
  });

  it('proposes the value-chain epicentre as a stage and clears it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    openExpertRating();
    await screen.findByRole('radiogroup', { name: /^Probability/ });
    fireEvent.click(screen.getByRole('button', { name: 'Mktg' }));
    await act(async () => { vi.advanceTimersByTime(700); });
    await waitFor(() => expect(API.saveMyProposal).toHaveBeenCalledTimes(1));
    expect(API.saveMyProposal.mock.calls[0]![1]).toMatchObject({ vc_epicentre: 'Marketing' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await act(async () => { vi.advanceTimersByTime(700); });
    await waitFor(() => expect(API.saveMyProposal).toHaveBeenCalledTimes(2));
    expect(API.saveMyProposal.mock.calls[1]![1]).toMatchObject({ vc_epicentre: null });
  });

  it('sends its saves one at a time, each with the newest draft', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let finishFirst!: () => void;
    API.saveMyProposal
      .mockImplementationOnce(() => new Promise((r) => { finishFirst = () => r(response(null)); }))
      .mockImplementation(async () => response(null));
    openExpertRating();
    await screen.findByRole('radiogroup', { name: /^Probability/ });

    fireEvent.click(probabilityDot(4));
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(API.saveMyProposal).toHaveBeenCalledTimes(1);          // the first save is in flight
    fireEvent.click(probabilityDot(5));
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(API.saveMyProposal).toHaveBeenCalledTimes(1);          // the second waits for it
    await act(async () => { finishFirst(); });
    await waitFor(() => expect(API.saveMyProposal).toHaveBeenCalledTimes(2));
    expect(API.saveMyProposal.mock.calls[1]![1]).toMatchObject({ probability: 5 });
    expect(await screen.findByText('All changes saved')).toBeTruthy();
  });

  it('sends an edit it is holding back as soon as the session ends, and only once', async () => {
    // lib/session.ts settles the proposal saves before it expires the viewer cookie.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    openExpertRating();
    await screen.findByRole('radiogroup', { name: /^Probability/ });
    fireEvent.click(probabilityDot(4));   // held back by the autosave delay
    expect(API.saveMyProposal).not.toHaveBeenCalled();
    await act(async () => { await settleProposalSaves(); });
    expect(API.saveMyProposal).toHaveBeenCalledTimes(1);
    expect(API.saveMyProposal.mock.calls[0]![1]).toMatchObject({ probability: 4 });
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(API.saveMyProposal).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('All changes saved')).toBeTruthy();
  });

  it('loads again only after the save sent on closing has landed', async () => {
    let finishSave!: () => void;
    API.saveMyProposal.mockImplementationOnce(
      () => new Promise((r) => { finishSave = () => r(response({ probability: 4 })); }));
    const first = render(<ExpertRatingPanel driver={PRIVATE_LABEL} onMyChange={() => {}} />);
    await screen.findByRole('radiogroup', { name: /^Probability/ });
    fireEvent.click(probabilityDot(4));
    first.unmount();   // closed inside the autosave delay: the pending edit is sent, not dropped
    await waitFor(() => expect(API.saveMyProposal).toHaveBeenCalledTimes(1));
    expect(API.saveMyProposal.mock.calls[0]![1]).toMatchObject({ probability: 4 });

    API.getDriverProposals.mockClear().mockResolvedValue(response({ probability: 4 }));
    render(<ExpertRatingPanel driver={PRIVATE_LABEL} onMyChange={() => {}} />);   // opened again at once
    expect(screen.getByText('Loading your proposal…')).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(API.getDriverProposals).not.toHaveBeenCalled();
    await act(async () => { finishSave(); });
    await waitFor(() => expect(probabilityDot(4).getAttribute('aria-checked')).toBe('true'));
    expect(API.getDriverProposals).toHaveBeenCalledTimes(1);
  });

  it('sends a peak year only once it is a whole year after the onset, up to 2035', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    openExpertRating();
    // The driver's onset is 2025, so its peak can be 2026 at the earliest.
    const year = await screen.findByRole('textbox', { name: 'Peak year, 2026 to 2035' });
    for (const typed of ['20', '2025']) {
      fireEvent.change(year, { target: { value: typed } });
      await act(async () => { vi.advanceTimersByTime(700); });
      expect(API.saveMyProposal).not.toHaveBeenCalled();
      expect(year.getAttribute('aria-invalid')).toBe('true');
    }
    fireEvent.change(year, { target: { value: '2031' } });
    await act(async () => { vi.advanceTimersByTime(700); });
    await waitFor(() => expect(API.saveMyProposal).toHaveBeenCalledTimes(1));
    expect(API.saveMyProposal.mock.calls[0]![1]).toMatchObject({ peak_year: 2031 });
    // A year outside the range stays in the field with a message, not silently reverted.
    fireEvent.change(year, { target: { value: '2040' } });
    fireEvent.blur(year);
    expect((year as HTMLInputElement).value).toBe('2040');
    expect(year.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('A whole year from 2026 (after the onset) to 2035; your proposal keeps 2031 until this is one')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(API.saveMyProposal).toHaveBeenCalledTimes(1);
  });
});
