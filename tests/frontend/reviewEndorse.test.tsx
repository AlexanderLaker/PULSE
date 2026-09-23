// @vitest-environment jsdom
/**
 * Review & Endorse on the Drivers page: endorsing the expert mean writes the
 * mean of every cell an expert scored and keeps every other cell at its
 * baseline, so a partial proposal never drops a category or a region.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { DriverProposalsResponse } from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { CATEGORY_NAMES, REGIONS, makeDriver, makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ current: null as PrismStore | null }));
const PROPOSALS = vi.hoisted(() => ({ current: null as DriverProposalsResponse | null }));

vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.current }));
vi.mock('@/api/client', () => ({
  getDriverProposals: vi.fn(async () => PROPOSALS.current),
  saveMyProposal: vi.fn(async () => PROPOSALS.current),
}));

import Drivers from '@/components/dashboard/Drivers';

// framer-motion restores the scroll position after measuring the expanded
// panel; jsdom has no window.scrollTo.
window.scrollTo = (() => {}) as typeof window.scrollTo;

afterEach(() => cleanup());

const scorer = (userId: string, name: string) => ({
  user_id: userId, name, role: 'viewer', probability: 4, gp1_pct_affected: null, peak_year: null,
  diffusion_curve: null, uncertainty: null, vc_exposure: null, comment: null,
});

describe('Review & Endorse', () => {
  it('endorses the expert mean cell by cell and keeps the unscored cells at their baseline', async () => {
    const driver = makeDriver({ proposal_summary: {
      count: 2, probability: { avg: 4, count: 2 }, gp1_pct_affected: null, peak_year: null,
      diffusion_curve: null, uncertainty: null, my: null,
    } });
    PROPOSALS.current = {
      driver_id: driver.id,
      my: null,
      aggregate: {
        probability: { avg: 4, count: 2 }, gp1_pct_affected: null, peak_year: null, diffusion_curve: null,
        uncertainty: null,
        category_exposure: { 'Hair: Care': { avg: 4.6, count: 2 } },
        regional_exposure: { Asia: { avg: 1.4, count: 1 } },
        vc_exposure: {},
      },
      scorers: [scorer('ana', 'Ana'), scorer('ben', 'Ben')],
    };
    STORE.current = makeStore({ drivers: [driver] });
    render(<Drivers isAdmin />);

    fireEvent.click(screen.getByRole('tab', { name: /Review & Endorse/ }));
    fireEvent.click(screen.getByRole('button', { name: /Private label structural penetration/ }));
    const endorse = await screen.findByRole('button', { name: /Endorse driver/ });
    await waitFor(() => expect(screen.getByText(/2 experts scored/)).toBeTruthy());
    fireEvent.click(endorse);

    await waitFor(() => expect(STORE.current!.updateDriver).toHaveBeenCalledTimes(1));
    const [id, update] = vi.mocked(STORE.current!.updateDriver).mock.calls[0];
    expect(id).toBe(driver.id);
    expect(update.probability).toBe(4);
    const baseline = driver.baseline!;
    expect(update.category_exposure).toEqual(Object.fromEntries(CATEGORY_NAMES.map((c) => [
      c, c === 'Hair: Care' ? 5 : baseline.category_exposure[c],
    ])));
    expect(update.regional_exposure).toEqual(Object.fromEntries(REGIONS.map((r) => [
      r, r === 'Asia' ? 1 : baseline.regional_exposure[r],
    ])));
  });
});
