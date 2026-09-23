// @vitest-environment jsdom
/**
 * The Drivers page around the list: a drill-through from another view, the
 * states a failed load leaves, and the Expert Rating panel's own proposal.
 *
 *   - A drill-through replaces the search and clears the category filter,
 *     every time, even for the same driver twice.
 *   - A list that failed to load says so instead of "no drivers match".
 *   - The Expert Rating panel cannot be edited before the expert's stored
 *     proposal has loaded (a save from a blank draft would overwrite it); its
 *     saves go out one at a time with the newest draft; a field clicked again
 *     is cleared (sent as null); a half-typed year, or one not after the
 *     driver's onset, is never sent. A panel
 *     opened again waits for a save still on its way before it loads.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react';
import type { DriverProposal, DriverProposalsResponse } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { makeDriver, makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ current: null as PrismStore | null }));
const API = vi.hoisted(() => ({ getDriverProposals: vi.fn(), saveMyProposal: vi.fn() }));

vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.current }));
vi.mock('@/lib/apiClient', async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import('@/lib/apiClient')>()).ApiError,
  getDriverProposals: API.getDriverProposals,
  saveMyProposal: API.saveMyProposal,
}));

import Drivers from '@/components/dashboard/Drivers';
import { ExpertInputPanel } from '@/components/dashboard/drivers/ExpertRating';

// framer-motion restores the scroll position after measuring an expanded panel.
window.scrollTo = (() => {}) as typeof window.scrollTo;

const PRIVATE_LABEL = makeDriver();
const GLP1 = makeDriver({
  id: 'consumer_r02', name: 'GLP-1 adoption reshapes personal-care demand', direction: 'Expansion',
  category_exposure: { 'Hair: Care': 5 },
});

const response = (my: DriverProposal | null): DriverProposalsResponse => ({
  driver_id: PRIVATE_LABEL.id, my, scorers: [],
  aggregate: {
    probability: null, gp1_pct_affected: null, peak_year: null, diffusion_curve: null, uncertainty: null,
    category_exposure: {}, regional_exposure: {}, vc_exposure: {},
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

const rows = () => screen.queryAllByRole('button', { name: /Private label|GLP-1/ }).map((b) => b.textContent);

describe('a drill-through from another view', () => {
  it('replaces the search and clears the category filter, every time it arrives', () => {
    const { rerender } = render(<Drivers search={{ query: 'GLP-1', seq: 1 }} />);
    expect(rows().some((t) => t?.includes('GLP-1'))).toBe(true);
    expect(rows().some((t) => t?.includes('Private label'))).toBe(false);

    // The user clears the search and picks a category the GLP-1 driver is not exposed to.
    fireEvent.change(screen.getByPlaceholderText('Search drivers…'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'FCN' }));
    expect(rows().some((t) => t?.includes('GLP-1'))).toBe(false);

    // The same driver opened again: a new drill-through, so it shows again.
    rerender(<Drivers search={{ query: 'GLP-1', seq: 2 }} />);
    expect((screen.getByPlaceholderText('Search drivers…') as HTMLInputElement).value).toBe('GLP-1');
    expect(rows().some((t) => t?.includes('GLP-1'))).toBe(true);
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
    const driver = makeDriver({ revision: 7, category_exposure: { 'Hair: Care': 5, 'Hair: Color': 2 } });
    STORE.current = makeStore({ drivers: [driver] });
    render(<Drivers isAdmin />);
    fireEvent.click(screen.getByRole('button', { name: /Private label structural penetration/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const color = screen.getByRole('radiogroup', { name: 'Hair: Color exposure: 2 of 5' });
    fireEvent.click(within(color).getByRole('radio', { name: '4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(STORE.current!.updateDriver).toHaveBeenCalledTimes(1));
    expect(vi.mocked(STORE.current!.updateDriver).mock.calls[0]).toEqual([
      driver.id, { revision: 7, category_exposure: { 'Hair: Color': 4 } }]);
  });
});

/** Opens the Expert Rating panel of the private-label driver. */
function openExpertRating() {
  render(<Drivers />);
  fireEvent.click(screen.getByRole('tab', { name: /Expert Rating/ }));
  fireEvent.click(screen.getByRole('button', { name: /Private label structural penetration/ }));
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
    expect(await screen.findByText('✓ All changes saved')).toBeTruthy();
  });

  it('loads again only after the save sent on closing has landed', async () => {
    let finishSave!: () => void;
    API.saveMyProposal.mockImplementationOnce(
      () => new Promise((r) => { finishSave = () => r(response({ probability: 4 })); }));
    const first = render(<ExpertInputPanel driver={PRIVATE_LABEL} onMyChange={() => {}} />);
    await screen.findByRole('radiogroup', { name: /^Probability/ });
    fireEvent.click(probabilityDot(4));
    first.unmount();   // closed inside the autosave delay: the pending edit is sent, not dropped
    await waitFor(() => expect(API.saveMyProposal).toHaveBeenCalledTimes(1));
    expect(API.saveMyProposal.mock.calls[0]![1]).toMatchObject({ probability: 4 });

    API.getDriverProposals.mockClear().mockResolvedValue(response({ probability: 4 }));
    render(<ExpertInputPanel driver={PRIVATE_LABEL} onMyChange={() => {}} />);   // opened again at once
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
    fireEvent.change(year, { target: { value: '2040' } });
    fireEvent.blur(year);
    expect((year as HTMLInputElement).value).toBe('2031');
  });
});
