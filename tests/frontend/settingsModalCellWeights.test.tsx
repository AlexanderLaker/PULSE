// @vitest-environment jsdom
/**
 * SettingsModal — Config sheet cell-weight resets (2.12.0 / O14).
 *
 * The two reset buttons must write DIFFERENT provenance labels. Since O14 the
 * backend default IS the estimated HCB mix, so `cell_weights_source_default`
 * carries the estimate's provenance: writing it on a "Reset to equal" would
 * stamp the estimate's label onto the neutral 1/52 grid (the F-28 shape — a
 * layer labelled with another layer's provenance). "Reset to equal" therefore
 * writes `cell_weights_source_equal`, and on a service that does not serve it
 * the reset leaves the existing source text alone: a stale label beats a wrong
 * one.
 *
 * This is the first render test of SettingsModal, so the Clerk identity hooks
 * and the two fetches the modal makes (/api/me for the role, /api/config for
 * the sheet) are mocked here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// ProfileSection syncs its form from the Clerk user during render, so the
// mock must hand back the SAME object every call or that sync never settles.
const CLERK = vi.hoisted(() => ({
  user: {
    isLoaded: true,
    user: {
      id: 'user_test',
      firstName: 'Ada',
      lastName: 'Lovelace',
      primaryEmailAddress: { emailAddress: 'ada@example.com' },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      update: async () => {},
    },
  },
  clerk: { signOut: async () => {} },
  sessionList: { isLoaded: true, sessions: [] },
  session: { session: null },
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: () => CLERK.user,
  useClerk: () => CLERK.clerk,
  useSessionList: () => CLERK.sessionList,
  useSession: () => CLERK.session,
}));

import SettingsModal from '@/components/dashboard/SettingsModal';
import { equalCellWeights, estimatedCellWeights } from '@/lib/cellWeights';

// Abridged stand-ins for the backend's DEFAULT_CELL_WEIGHTS_SOURCE (the O14
// estimate) and EQUAL_CELL_WEIGHTS_SOURCE (pulse/config.py). The sheet only
// echoes whatever GET serves, so the test needs the two to differ, not to
// match the backend wording; both stay under the 400-char PUT cap.
const DEFAULT_LABEL =
  'ESTIMATE, not Henkel P&L: HCB gross-profit share per category x region, built 2026-09-11 '
  + 'from public reporting and category knowledge (owner ruling O14).';
const EQUAL_LABEL =
  'Equal placeholder: each of the 52 category x region cells = 1/52 of the HCB gross-profit '
  + 'pool (owner decision 2026-09-03/10, extended to 13 categories by O13, superseded as the '
  + 'default by O14).';

const CATS = [
  'Hair: Color', 'Hair: Care', 'Hair: Styling', 'Hair: Body',
  'LHC: FCN', 'LHC: FCA', 'LHC: FFI', 'LHC: LAD',
  'LHC: HDW', 'LHC: ADW', 'LHC: HSC', 'LHC: TOI', 'LHC: IC',
];
const REGS = ['Europe', 'North America', 'Asia', 'High Growth'];

/** GET /api/config as the 2.12.0 backend serves it (both labels). */
const configPayload = (overrides: Record<string, unknown> = {}) => ({
  per_force_attenuation: { Consumer: 0.487 },
  attenuation_source: 'calibrated_v3.12_september2026',
  force_weights: Object.fromEntries(
    ['Consumer', 'Customer', 'Technology', 'Government', 'Environmental', 'Competitive']
      .map((f) => [f, 1 / 6]),
  ),
  cell_weights: estimatedCellWeights(),
  cell_weights_source: DEFAULT_LABEL,
  cell_weights_source_default: DEFAULT_LABEL,
  cell_weights_source_equal: EQUAL_LABEL,
  derived_weights: ['region_weights', 'category_weights'],
  path_years: [2026, 2030, 2035],
  base_year: 2025,
  iterations: 50000,
  within_force_rho: 0.3,
  ...overrides,
});

const mockFetch = (payload: Record<string, unknown>) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String(input);
    const body = url.includes('/api/me') ? { role: 'admin' } : payload;
    return { ok: true, status: 200, json: async () => body } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** Open the modal, switch to the Config sheet and wait for the grid. */
const openConfigSheet = async () => {
  render(<SettingsModal open onClose={() => {}} />);
  const navButton = await screen.findByRole('button', { name: /Config sheet/ });
  fireEvent.click(navButton);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reset to equal' })).toBeTruthy());
};

const sourceInput = () => screen.getByLabelText(/Cell weights source/) as HTMLInputElement;

beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Config sheet — the two cell-weight resets write different source labels', () => {
  it('"Reset to equal" writes the equal label, "Reset to estimate" the default (estimate) one', async () => {
    // Guard the fixture itself: the whole point is that the labels differ.
    expect(EQUAL_LABEL).not.toBe(DEFAULT_LABEL);
    mockFetch(configPayload());
    await openConfigSheet();

    // Loaded on the estimate: the estimate reset is the disabled one.
    expect(sourceInput().value).toBe(DEFAULT_LABEL);
    expect((screen.getByRole('button', { name: 'Reset to estimate' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Reset to equal' }));
    await waitFor(() => expect(sourceInput().value).toBe(EQUAL_LABEL));
    // The estimate's provenance must NOT survive onto the equal grid.
    expect(sourceInput().value).not.toBe(DEFAULT_LABEL);

    fireEvent.click(screen.getByRole('button', { name: 'Reset to estimate' }));
    await waitFor(() => expect(sourceInput().value).toBe(DEFAULT_LABEL));
  });

  it('leaves the source text alone when an older service omits the equal label', async () => {
    const custom = equalCellWeights(CATS, REGS);
    custom['Hair: Color']!['Europe'] = 0.05;          // neither basis → both resets enabled
    const payload = configPayload({
      cell_weights: custom,
      cell_weights_source: 'Finance FY2025 gross-profit shares (loaded from file)',
    });
    delete (payload as Record<string, unknown>).cell_weights_source_equal;   // pre-O14 service
    mockFetch(payload);
    await openConfigSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Reset to equal' }));
    // The grid became the equal grid…
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Reset to equal' }) as HTMLButtonElement).disabled).toBe(true));
    // …and the stale label stayed: a wrong provenance is worse than an old one.
    expect(sourceInput().value).toBe('Finance FY2025 gross-profit shares (loaded from file)');
    expect(sourceInput().value).not.toBe(DEFAULT_LABEL);
  });
});
