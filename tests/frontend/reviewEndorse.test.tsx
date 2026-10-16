// @vitest-environment jsdom
/**
 * Review & Endorse on the Drivers page. Endorsing writes the expert mean of
 * the fields and cells experts scored and leaves every other value as it is
 * now, so an admin's earlier edit is never reverted to the baseline without a
 * choice to do so; every endorse names the revision it was made on. A value
 * the driver already holds is not written, and when nothing would be, the
 * Endorse button says so and stays off.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
import type { Driver, DriverProposalsResponse } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { makeDriver, makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ current: null as PrismStore | null }));
const PROPOSALS = vi.hoisted(() => ({ current: null as DriverProposalsResponse | null, fail: false }));

vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.current }));
vi.mock('@/lib/apiClient', async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import('@/lib/apiClient')>()).ApiError,
  getDriverProposals: vi.fn(async () => {
    if (PROPOSALS.fail) throw new Error('offline');
    return PROPOSALS.current;
  }),
  saveMyProposal: vi.fn(async () => PROPOSALS.current),
}));

import { ApiError, getDriverProposals } from '@/lib/apiClient';
import Drivers from '@/components/dashboard/Drivers';

// framer-motion restores the scroll position after measuring the expanded
// panel; jsdom has no window.scrollTo.
window.scrollTo = (() => {}) as typeof window.scrollTo;

afterEach(() => {
  cleanup();
  PROPOSALS.fail = false;
});

const scorer = (userId: string, name: string, stage: string | null = null) => ({
  user_id: userId, name, probability: 4, gp1_pct_affected: null, peak_year: null,
  diffusion_curve: null, uncertainty: null, vc_epicentre: stage, comment: null,
});

/** A driver an admin has edited (probability 3 and GP1 30 %, against a baseline
 *  of 5 and 22 %) that two experts scored: probability, one category, one region. */
function reviewedDriver(): Driver {
  const driver = makeDriver({
    probability: 3, gp1_pct_affected: 0.30, revision: 4, scores_edited: true,
    proposal_summary: { count: 2, probability: { avg: 4, count: 2 }, gp1_pct_affected: null, my: null },
  });
  PROPOSALS.current = {
    driver_id: driver.id,
    my: null,
    aggregate: {
      probability: { avg: 4, count: 2 }, gp1_pct_affected: null, peak_year: null, diffusion_curve: null,
      uncertainty: null, vc_epicentre: null,
      category_exposure: { 'Hair: Care': { avg: 4.6, count: 2 } },
      regional_exposure: { Asia: { avg: 1.4, count: 1 } },
    },
    scorers: [scorer('ana', 'Ana'), scorer('ben', 'Ben')],
  };
  return driver;
}

async function openReview(driver: Driver, store: Partial<PrismStore> = {}) {
  STORE.current = makeStore({ drivers: [driver], ...store });
  render(<Drivers isAdmin />);
  fireEvent.click(screen.getByRole('tab', { name: /Review & Endorse/ }));
  fireEvent.click(screen.getByRole('button', { name: /Private label structural penetration/ }));
}

async function endorse() {
  const button = await screen.findByRole('button', { name: /Endorse driver/ });
  await waitFor(() => expect(screen.getByText(/2 experts scored/)).toBeTruthy());
  fireEvent.click(button);
  await waitFor(() => expect(STORE.current!.updateDriver).toHaveBeenCalledTimes(1));
  return vi.mocked(STORE.current!.updateDriver).mock.calls[0]!;
}

describe('Review & Endorse', () => {
  it('offers nothing to endorse before the proposals have loaded', async () => {
    const driver = reviewedDriver();
    let resolve!: (r: DriverProposalsResponse) => void;
    vi.mocked(getDriverProposals).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    await openReview(driver);
    expect(await screen.findByText('Loading the proposals…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Endorse driver/ })).toBeNull();
    await act(async () => { resolve(PROPOSALS.current!); });
    expect(await screen.findByRole('button', { name: /Endorse driver/ })).toBeTruthy();
  });

  it('names the fields it wrote, and clears the mark when a choice changes', async () => {
    await openReview(reviewedDriver());
    await endorse();
    expect(await screen.findByText('Endorsed: probability, category exposure (Care), regional exposure (Asia)')).toBeTruthy();
    const gp1 = screen.getByRole('group', { name: 'GP1 % affected' });
    fireEvent.click(within(gp1).getByRole('radio', { name: 'Baseline' }));
    expect(screen.queryByText(/^Endorsed: /)).toBeNull();
  });

  it('writes the expert mean where experts scored and keeps every other value as it is now', async () => {
    const driver = reviewedDriver();
    await openReview(driver);
    const [id, update] = await endorse();
    expect(id).toBe(driver.id);
    // No GP1 share, timing, uncertainty or value-chain stage: nobody scored
    // them, so the admin's current values stand (the API keeps what is not sent).
    expect(update).toEqual({
      revision: 4,
      probability: 4,
      category_exposure: { 'Hair: Care': 5 },
      regional_exposure: { Asia: 1 },
    });
  });

  it('endorses the stage the experts agree on, by name', async () => {
    const driver = reviewedDriver();
    PROPOSALS.current!.scorers = [scorer('ana', 'Ana', 'Marketing'), scorer('ben', 'Ben', 'Marketing')];
    PROPOSALS.current!.aggregate.vc_epicentre = { mode: 'Marketing', distribution: { Marketing: 2 }, count: 2 };
    await openReview(driver);
    const [, update] = await endorse();
    expect(update.vc_epicentre).toBe('Marketing');
  });

  it('keeps the current stage when the expert votes tie', async () => {
    const driver = reviewedDriver();
    PROPOSALS.current!.scorers = [scorer('ana', 'Ana', 'Marketing'), scorer('ben', 'Ben', 'Consumer')];
    // A tie has no majority: the API's aggregate says so with mode null.
    PROPOSALS.current!.aggregate.vc_epicentre = { mode: null, distribution: { Marketing: 1, Consumer: 1 }, count: 2 };
    await openReview(driver);
    expect(await screen.findByText(/no majority/)).toBeTruthy();
    const [, update] = await endorse();
    expect(update).not.toHaveProperty('vc_epicentre');
  });

  it('writes the baseline only where the admin chooses it', async () => {
    await openReview(reviewedDriver());
    await waitFor(() => expect(screen.getByText(/2 experts scored/)).toBeTruthy());
    const gp1 = screen.getByRole('group', { name: 'GP1 % affected' });
    fireEvent.click(within(gp1).getByRole('radio', { name: 'Baseline' }));
    const [, update] = await endorse();
    expect(update.gp1_pct_affected).toBe(0.22);
  });

  it('holds Endorse, with the reason, when nothing differs from the stored driver', async () => {
    // Every field kept: the update would carry the revision alone, so it is not sent.
    await openReview(reviewedDriver());
    fireEvent.click(await screen.findByRole('button', { name: 'Keep current' }));
    const button = screen.getByRole('button', { name: /Endorse driver/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const reason = screen.getByText('Nothing differs from the stored driver');
    expect(button.getAttribute('aria-describedby')).toBe(reason.getAttribute('id'));
    expect(STORE.current!.updateDriver).not.toHaveBeenCalled();
    // A choice that differs from the stored driver enables it again.
    const gp1 = screen.getByRole('group', { name: 'GP1 % affected' });
    fireEvent.click(within(gp1).getByRole('radio', { name: 'Baseline' }));
    expect((screen.getByRole('button', { name: /Endorse driver/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('leaves out a chosen value the driver already holds', async () => {
    // The expert mean of Hair: Care rounds to 5; a driver already at 5 there gets no cell for it.
    const driver = reviewedDriver();
    driver.category_exposure = { ...driver.category_exposure, 'Hair: Care': 5 };
    await openReview(driver);
    const [, update] = await endorse();
    expect(update).toEqual({ revision: 4, probability: 4, regional_exposure: { Asia: 1 } });
  });

  it('explains a refusal because the driver changed meanwhile', async () => {
    const updateDriver = vi.fn<PrismStore['updateDriver']>(async () => {
      throw new ApiError(409, 'This driver was changed after you opened it.');
    });
    await openReview(reviewedDriver(), { updateDriver });
    await endorse();
    expect(await screen.findByText(/The driver changed after this panel loaded/)).toBeTruthy();
  });

  it('offers a retry instead of an empty review when the proposals cannot be loaded', async () => {
    PROPOSALS.fail = true;
    await openReview(reviewedDriver());
    expect(await screen.findByText(/could not be loaded, so there is nothing to endorse right now/)).toBeTruthy();
    expect(screen.queryByText(/No expert proposals yet/)).toBeNull();
    PROPOSALS.fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /Endorse driver/ })).toBeTruthy();
  });
});
