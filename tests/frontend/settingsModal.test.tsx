// @vitest-environment jsdom
/**
 * The settings dialog.
 *
 *   - Model configuration is a read-only view of what the model uses: the
 *     parameters from the store's config and the served run's cell weights,
 *     with their marginals and basis. It has no inputs and asks for nothing.
 *   - User management is for admins only and goes through lib/apiClient.
 *   - Active sessions lists the user's sessions on every device.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import type { PrismStore } from '@/hooks/usePrism';
import { ESTIMATED_CELL_WEIGHTS } from '@/lib/cellWeightProvenance';
import { makeConfig, makeSimulation, makeStore } from './fixtures/prism';

const STATE = vi.hoisted(() => ({ store: null as unknown as PrismStore }));
vi.mock('@/hooks/usePrism', () => ({ default: () => STATE.store }));

const API = vi.hoisted(() => ({
  getUsers: vi.fn(), setUserRole: vi.fn(), clearViewerCookie: vi.fn(async () => {}), resumeViewerCookie: vi.fn(),
}));
vi.mock('@/lib/apiClient', () => API);

// Every hook returns the same objects on every call: the profile form syncs
// from the user object and the sessions list reloads when it changes.
const CLERK = vi.hoisted(() => {
  const laptop = {
    id: 'sess_laptop',
    lastActiveAt: new Date(Date.UTC(2026, 8, 19, 8, 30)),
    latestActivity: { id: 'act_laptop', deviceType: 'Macintosh', browserName: 'Safari', city: 'Düsseldorf', country: 'DE' },
    revoke: vi.fn(async () => ({})),
  };
  const here = {
    id: 'sess_here',
    lastActiveAt: new Date(Date.UTC(2026, 8, 20, 9, 0)),
    latestActivity: { id: 'act_here', deviceType: 'Windows', browserName: 'Chrome', city: 'Berlin', country: 'DE' },
    revoke: vi.fn(async () => ({})),
  };
  const user = {
    id: 'user_ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    primaryEmailAddress: { emailAddress: 'ada@example.com' },
    createdAt: new Date(Date.UTC(2026, 0, 1)),
    update: vi.fn(async () => ({})),
    updatePassword: vi.fn(async () => ({})),
    getSessions: vi.fn(async () => [laptop, here]),
  };
  return {
    laptop,
    here,
    useUser: { isLoaded: true, isSignedIn: true, user },
    clerk: { signOut: vi.fn(async () => {}) },
    session: { session: { id: 'sess_here' } },
  };
});

vi.mock('@clerk/nextjs', () => ({
  useUser: () => CLERK.useUser,
  useClerk: () => CLERK.clerk,
  useSession: () => CLERK.session,
}));

import SettingsModal from '@/components/dashboard/SettingsModal';

const USERS = [
  { id: 'user_ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', role: 'admin', lastSignInAt: null, createdAt: null },
  { id: 'user_grace', email: 'grace@example.com', firstName: 'Grace', lastName: 'Hopper', role: 'viewer', lastSignInAt: null, createdAt: null },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  STATE.store = makeStore();
  API.getUsers.mockResolvedValue({ users: USERS });
  API.setUserRole.mockImplementation(async (_id: string, role: string) => ({ role }));
  fetchMock = vi.fn(async () => new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const openModal = (isAdmin = false) => render(<SettingsModal open onClose={() => {}} isAdmin={isAdmin} />);
const openSection = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));
const region = (name: string) => screen.getByRole('region', { name });
/** The block of a labelled parameter: its label, value and hint. */
const parameter = (label: string) => within(screen.getByText(label).parentElement!);
const cellGrid = () => region('Cell weights: share of HCB gross profit per category and region');

describe('Model configuration: the parameters', () => {
  it("shows the code's parameters from the store's config", () => {
    STATE.store = makeStore({
      config: makeConfig({ within_force_rho: 0.27, attenuation_source: 'overlap-correction-test', peak_year_jitter: false }),
    });
    openModal();
    openSection('Model configuration');

    expect(screen.queryByText('Default iterations')).toBeNull();   // a production run sets its own
    expect(parameter('Path horizon').getByText('2026–2035 · 10 years')).toBeTruthy();
    expect(parameter('Base year').getByText('2025')).toBeTruthy();
    expect(parameter('Peak-year jitter').getByText('Off')).toBeTruthy();
    expect(parameter('Within-force ρ').getByText('0.27')).toBeTruthy();
    expect(screen.getByText(/Source: overlap-correction-test, a structured-judgment overlap correction/)).toBeTruthy();

    const attenuation = region('Per-force attenuation and within-force overlap');
    expect(within(attenuation).getByText('0.487')).toBeTruthy();
    expect(within(attenuation).getByText('0.384')).toBeTruthy();
    expect(within(region('Force weights')).getAllByText('0.167')).toHaveLength(6);
    expect(within(region('Force correlation matrix')).getAllByText('0.18').length).toBeGreaterThan(0);
    expect(within(region('Between-force overlap matrix')).getByText('0.450')).toBeTruthy();
  });

  it('says so plainly when there is no configuration and no run', () => {
    STATE.store = makeStore({ config: null, simulation: null });
    openModal();
    openSection('Model configuration');
    expect(screen.getByText('No model configuration is available yet.')).toBeTruthy();
    expect(screen.getByText('There is no run yet, so there are no cell weights to show.')).toBeTruthy();
  });

  it('says why the configuration or the run could not be loaded', () => {
    STATE.store = makeStore({
      config: null, configError: 'Internal Server Error', simulation: null, simulationError: 'Invalid or expired token',
    });
    openModal();
    openSection('Model configuration');
    expect(screen.getByText('The model configuration could not be loaded: Internal Server Error')).toBeTruthy();
    expect(screen.getByText('The run could not be loaded, so its cell weights cannot be shown: Invalid or expired token')).toBeTruthy();
  });

  it('has no editable control and makes no request', () => {
    const { container } = openModal(true);
    openSection('Model configuration');
    const main = container.querySelector('main')!;
    expect(main.querySelectorAll('input, select, textarea')).toHaveLength(0);
    expect(within(main).queryByRole('button', { name: /reset|save|discard|reload/i })).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/config'))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Model configuration: the served run\'s cell weights', () => {
  it('shows the 13 x 4 grid with its category and region marginals', () => {
    openModal();
    openSection('Model configuration');
    expect(screen.getByText(/Cell weights of run #99/)).toBeTruthy();

    const grid = cellGrid();
    expect(within(grid).getAllByRole('row')).toHaveLength(1 + 13 + 1);
    const colour = within(grid).getByRole('row', { name: /^Hair: Color/ });
    expect(within(colour).getByText('9.40')).toBeTruthy();
    expect(within(colour).getByText('17.10%')).toBeTruthy();
    const regions = within(grid).getByRole('row', { name: /^Σ region/ });
    expect(within(regions).getByText('51.43%')).toBeTruthy();
    expect(within(regions).getByText('100.00%')).toBeTruthy();
  });

  it('marks the estimated mix, with its caveat and graded derivation', () => {
    openModal();
    openSection('Model configuration');
    expect(screen.getByText('Estimated HCB mix')).toBeTruthy();
    expect(screen.queryByText('From a weights file')).toBeNull();
    expect(screen.getByText('An estimate from public reporting, not Henkel P&L.')).toBeTruthy();
    expect(screen.getByText(/How these 52 shares were built/)).toBeTruthy();
    expect(screen.getByRole('region', { name: /Block split/ })).toBeTruthy();
  });

  it("marks other weights as coming from a file, with the run's source label", () => {
    const finance = Object.fromEntries(Object.entries(ESTIMATED_CELL_WEIGHTS).map(([c, row]) => [c, { ...row }]));
    finance['Hair: Color'].Europe = 0.08;
    finance['Hair: Color']['North America'] = 0.03969658;
    STATE.store = makeStore({
      simulation: makeSimulation({ cell_weights_used: finance, cell_weights_source: 'Finance: HCB gross-profit shares FY2025' }),
    });
    openModal();
    openSection('Model configuration');

    expect(screen.getByText('From a weights file')).toBeTruthy();
    expect(screen.getByText('Source: Finance: HCB gross-profit shares FY2025')).toBeTruthy();
    expect(screen.queryByText('Estimated HCB mix')).toBeNull();
    expect(screen.queryByText(/How these 52 shares were built/)).toBeNull();
    const colour = within(cellGrid()).getByRole('row', { name: /^Hair: Color/ });
    expect(within(colour).getByText('8.00')).toBeTruthy();
    expect(within(within(cellGrid()).getByRole('row', { name: /^Σ region/ })).getByText('50.02%')).toBeTruthy();
  });

  it('keeps the derivation off a run on another version of the estimate, and says where it is', () => {
    const earlier = Object.fromEntries(Object.entries(ESTIMATED_CELL_WEIGHTS).map(([c, row]) => [c, { ...row }]));
    earlier['Hair: Color'].Europe += 0.001;
    earlier['Hair: Care'].Europe -= 0.001;
    STATE.store = makeStore({ simulation: makeSimulation({ cell_weights_used: earlier }) });
    openModal();
    openSection('Model configuration');
    expect(screen.getByText('Estimated HCB mix')).toBeTruthy();
    expect(screen.getByText(/a version of the estimate other than the one this dashboard documents/)).toBeTruthy();
    expect(screen.getByText(/the QA workbook of that run holds it/)).toBeTruthy();
    expect(screen.queryByText(/How these 52 shares were built/)).toBeNull();
  });
});

describe('User management', () => {
  it('is visible to admins only; viewers still see the model configuration', async () => {
    openModal(false);
    expect(screen.queryByRole('button', { name: 'User management' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Model configuration' })).toBeTruthy();
    expect(API.getUsers).not.toHaveBeenCalled();
    cleanup();

    openModal(true);
    openSection('User management');
    expect(await screen.findByText('grace@example.com')).toBeTruthy();
    expect(API.getUsers).toHaveBeenCalledTimes(1);
    const own = screen.getByRole('combobox', { name: 'Role of ada@example.com' }) as HTMLSelectElement;
    expect(own.disabled).toBe(true);
  });

  it('changes a role through api.setUserRole and shows a failure', async () => {
    openModal(true);
    openSection('User management');
    const grace = await screen.findByRole('combobox', { name: 'Role of grace@example.com' }) as HTMLSelectElement;

    fireEvent.change(grace, { target: { value: 'admin' } });
    expect(await screen.findByText('Role updated.')).toBeTruthy();
    expect(API.setUserRole).toHaveBeenCalledWith('user_grace', 'admin');
    expect(grace.value).toBe('admin');

    API.setUserRole.mockRejectedValueOnce(new Error('Admin role required'));
    fireEvent.change(grace, { target: { value: 'viewer' } });
    expect(await screen.findByText('Admin role required')).toBeTruthy();
    expect(grace.value).toBe('admin');
  });
});

describe('Active sessions', () => {
  it("lists the user's sessions on every device and revokes another device's", async () => {
    openModal();
    openSection('Active sessions');
    expect(await screen.findByText('Macintosh · Safari')).toBeTruthy();
    expect(screen.getByText(/Düsseldorf, DE/)).toBeTruthy();
    expect(screen.getByText('This device')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(await screen.findByText(/^Session revoked\. That device loses access to PRISM data within 30 minutes\.$/)).toBeTruthy();
    expect(CLERK.laptop.revoke).toHaveBeenCalledTimes(1);
    expect(CLERK.here.revoke).not.toHaveBeenCalled();
    expect(screen.queryByText('Macintosh · Safari')).toBeNull();
  });

  it("signs out everywhere: the other devices first, then this browser's API cookie and session", async () => {
    openModal();
    openSection('Active sessions');
    await screen.findByText('Macintosh · Safari');

    fireEvent.click(screen.getByRole('button', { name: 'Sign out of every session' }));
    await waitFor(() => expect(CLERK.clerk.signOut).toHaveBeenCalledWith({ redirectUrl: '/sign-in' }));
    expect(CLERK.laptop.revoke).toHaveBeenCalledTimes(1);
    expect(CLERK.here.revoke).not.toHaveBeenCalled();
    expect(API.clearViewerCookie).toHaveBeenCalledTimes(1);
    expect(API.clearViewerCookie.mock.invocationCallOrder[0])
      .toBeLessThan(CLERK.clerk.signOut.mock.invocationCallOrder[0]);
  });
});
