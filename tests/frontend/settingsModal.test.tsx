// @vitest-environment jsdom
/**
 * The settings dialog.
 *
 *   - Model configuration is a read-only view of what the model uses: the
 *     parameters from the store's config and the served run's cell weights,
 *     with their marginals and basis. It has no inputs and asks for nothing.
 *   - User management is for admins only and goes through lib/apiClient:
 *     pending users first, approved with one of two buttons, and a role taken
 *     away by setting the user back to pending in the access list.
 *   - Active sessions lists the user's sessions on every device; signing out
 *     everywhere asks first.
 *   - The dialog's own shape: the section title is a heading, the rail
 *     marks the chosen section, the role reads capitalised.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import type { PrismStore } from '@/hooks/usePrism';
import { ESTIMATED_CELL_WEIGHTS } from '@/lib/cellWeightProvenance';
import { makeConfig, makeSimulation, makeStore } from './fixtures/prism';

const STATE = vi.hoisted(() => ({ store: null as unknown as PrismStore }));
vi.mock('@/hooks/usePrism', () => ({ default: () => STATE.store }));

const API = vi.hoisted(() => ({
  getUsers: vi.fn(), setUserRole: vi.fn(), revokeUserRole: vi.fn(),
  clearViewerCookie: vi.fn(async () => {}), resumeViewerCookie: vi.fn(),
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

// As /api/users sends them: pending users first.
const USERS = [
  { id: 'user_alan', email: 'alan@example.com', firstName: 'Alan', lastName: 'Turing', role: 'pending', lastSignInAt: null, createdAt: null },
  { id: 'user_ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', role: 'admin', lastSignInAt: null, createdAt: null },
  { id: 'user_grace', email: 'grace@example.com', firstName: 'Grace', lastName: 'Hopper', role: 'viewer', lastSignInAt: null, createdAt: null },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  STATE.store = makeStore();
  API.getUsers.mockResolvedValue({ users: USERS });
  API.setUserRole.mockImplementation(async (_id: string, role: string) => ({ role }));
  API.revokeUserRole.mockImplementation(async () => ({ role: 'pending' }));
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
/** The user list's row for an address (the dialog's footer shows the admin's own address too). */
const userRow = (email: string) => within(screen.getByRole('region', { name: 'All users' })).getByText(email).closest('tr')!;
const findUserRow = async (email: string) =>
  within(await screen.findByRole('region', { name: 'All users' })).getByText(email).closest('tr')!;

describe('Model configuration: the parameters', () => {
  it("shows the code's parameters from the store's config", () => {
    STATE.store = makeStore({
      config: makeConfig({ within_force_rho: 0.27, overlap_correction_source: 'overlap-correction-test', peak_year_jitter: false }),
    });
    openModal();
    openSection('Model configuration');

    expect(screen.queryByText('Default iterations')).toBeNull();   // a production run sets its own
    expect(parameter('Path horizon').getByText('2026–2035 · 10 years')).toBeTruthy();
    expect(parameter('Base year').getByText('2025')).toBeTruthy();
    expect(parameter('Peak-year jitter').getByText('Off')).toBeTruthy();
    expect(parameter('Within-force correlation (rho)').getByText('0.27')).toBeTruthy();
    // the realised rank correlation of the draws, (6 / pi) asin(0.27 / 2)
    expect(screen.getByText(/whose rank correlation is a little lower \(0\.26 for a latent 0\.27 within a force\)/)).toBeTruthy();
    expect(screen.getByText(/Source: overlap-correction-test, a structured-judgment overlap correction/)).toBeTruthy();

    const attenuation = region('Per-force attenuation and within-force overlap');
    expect(within(attenuation).getByText('0.487')).toBeTruthy();
    expect(within(attenuation).getByText('0.384')).toBeTruthy();
    expect(within(region('Force weights')).getAllByText('0.167')).toHaveLength(6);
    expect(within(region('Force correlation matrix')).getAllByText('0.18').length).toBeGreaterThan(0);
    expect(within(region('Between-force overlap matrix')).getByText('0.450')).toBeTruthy();
  });

  it('lists the parameters as a definition list, each name a term and each value its definition', () => {
    const { container } = openModal();
    openSection('Model configuration');
    const lists = container.querySelectorAll('main dl');
    expect(lists.length).toBe(2);   // the simulation parameters, and the copula's within-force correlation
    for (const label of ['Path horizon', 'Base year', 'Peak-year jitter', 'Within-force correlation (rho)']) {
      const term = screen.getByText(label);
      expect(term.tagName).toBe('DT');
      expect(term.closest('dl')).not.toBeNull();
    }
    expect(screen.getByText('2026–2035 · 10 years').closest('dd')).not.toBeNull();
    expect(screen.getByText('On').closest('dd')).not.toBeNull();
    // Plain values, not inputs in a field's frame.
    expect(container.querySelectorAll('main dd input')).toHaveLength(0);
  });

  it('heads the force tables with the full force names and explains the Σ columns under the cell weights', () => {
    openModal();
    openSection('Model configuration');
    const correlation = region('Force correlation matrix');
    expect(within(correlation).getAllByRole('columnheader').map((th) => th.textContent))
      .toEqual(['row \\ col', 'Consumer', 'Customer', 'Technology', 'Government', 'Environmental', 'Competitive']);
    expect(within(correlation).queryByText('Cons.')).toBeNull();
    expect(screen.getByText(/^Σ category is the row sum: the category's share of the pool\. Σ region is the column sum/))
      .toBeTruthy();
    expect(screen.getByText(/Drivers of the same force tend to happen together; this number says how strongly\./)).toBeTruthy();
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
    const colour = within(grid).getByRole('row', { name: /^Hair Colour/ });
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
    const colour = within(cellGrid()).getByRole('row', { name: /^Hair Colour/ });
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
    expect(screen.getByText('All users (3, 1 pending)')).toBeTruthy();
    // The admin's own row offers no control: the route would refuse the change anyway.
    expect(screen.queryByRole('combobox', { name: 'Access of ada@example.com' })).toBeNull();
    expect(within(userRow('ada@example.com')).getByText('Your own role: ask another admin to change it')).toBeTruthy();
  });

  it('is a table: column headers, one row per user, the access as a capitalised pill', async () => {
    openModal(true);
    openSection('User management');
    const table = within(await screen.findByRole('region', { name: 'All users' }));
    expect(table.getAllByRole('columnheader').map((th) => th.textContent))
      .toEqual(['User', 'Name', 'Access', 'Last sign-in', 'Actions']);
    expect(table.getAllByRole('columnheader').every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    expect(table.getAllByRole('row')).toHaveLength(1 + 3);
    // The pill, as distinct from the access list's options.
    expect(within(userRow('alan@example.com')).getByText('Pending', { selector: 'span' })).toBeTruthy();
    expect(within(userRow('ada@example.com')).getByText('Admin', { selector: 'span' })).toBeTruthy();
    expect(within(userRow('grace@example.com')).getByText('Viewer', { selector: 'span' })).toBeTruthy();
  });

  it('keeps the list empty, without "No users returned", when it cannot be loaded', async () => {
    API.getUsers.mockRejectedValueOnce(new Error('Admin role required'));
    openModal(true);
    openSection('User management');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Admin role required')).toBeTruthy();
    expect(screen.queryByText('No users returned from the directory.')).toBeNull();
    expect(screen.queryByText('Loading users…')).toBeNull();
    expect(screen.queryByRole('region', { name: 'All users' })).toBeNull();
  });

  /** The confirmation a change of access waits for, inside the user's row. */
  const confirmationFor = (email: string) => within(screen.getByRole('group', { name: `Confirm the change for ${email}` }));

  it('offers a pending user two approval buttons, each of which opens the confirmation', async () => {
    openModal(true);
    openSection('User management');
    const row = within(await findUserRow('alan@example.com'));
    expect(row.queryByRole('combobox')).toBeNull();
    const asViewer = row.getByRole('button', { name: 'Approve as viewer' });
    const asAdmin = row.getByRole('button', { name: 'Approve as admin' });

    fireEvent.click(asAdmin);
    expect(confirmationFor('alan@example.com').getByText('Approve alan@example.com as an admin?')).toBeTruthy();
    expect(asAdmin.getAttribute('aria-describedby')).toBe('confirm-user_alan');
    fireEvent.click(confirmationFor('alan@example.com').getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Confirm the change for alan@example.com' })).toBeNull();

    fireEvent.click(asViewer);
    expect(confirmationFor('alan@example.com').getByText('Approve alan@example.com as a viewer?')).toBeTruthy();
    expect(API.setUserRole).not.toHaveBeenCalled();
    expect(API.revokeUserRole).not.toHaveBeenCalled();
    // Users with a role keep the access list.
    expect(screen.getByRole('combobox', { name: 'Access of grace@example.com' })).toBeTruthy();
  });

  it('approves a pending user with a role through api.setUserRole, once the admin confirms', async () => {
    openModal(true);
    openSection('User management');
    const asViewer = within(await findUserRow('alan@example.com')).getByRole('button', { name: 'Approve as viewer' });

    fireEvent.click(asViewer);
    expect(API.setUserRole).not.toHaveBeenCalled();
    expect(within(userRow('alan@example.com')).getByText('Pending')).toBeTruthy();   // the saved access, until the change is confirmed
    expect(confirmationFor('alan@example.com').getByText('Approve alan@example.com as a viewer?')).toBeTruthy();
    expect(screen.getByText("Approve alan@example.com as a viewer? Confirm or cancel under the user's row.")
      .getAttribute('role')).toBe('status');
    expect(asViewer.getAttribute('aria-describedby')).toBe('confirm-user_alan');
    fireEvent.click(confirmationFor('alan@example.com').getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('alan@example.com is approved as viewer.')).toBeTruthy();
    expect(API.setUserRole).toHaveBeenCalledWith('user_alan', 'viewer', 'pending');
    // Approved, the row offers the access list with the saved role.
    expect((screen.getByRole('combobox', { name: 'Access of alan@example.com' }) as HTMLSelectElement).value).toBe('viewer');
    expect(screen.queryByRole('button', { name: 'Approve as viewer' })).toBeNull();
    expect(screen.getByText('All users (3)')).toBeTruthy();
  });

  it('takes a role away through api.revokeUserRole once the admin confirms: the user is pending again', async () => {
    openModal(true);
    openSection('User management');
    const grace = await screen.findByRole('combobox', { name: 'Access of grace@example.com' }) as HTMLSelectElement;

    fireEvent.change(grace, { target: { value: 'pending' } });
    expect(confirmationFor('grace@example.com')
      .getByText('Take access away from grace@example.com? From their next page load they see the waiting page.')).toBeTruthy();
    fireEvent.click(confirmationFor('grace@example.com').getByRole('button', { name: 'Take access away' }));
    expect(await screen.findByText(/^grace@example\.com is pending again: from their next page load they see the waiting page/))
      .toBeTruthy();
    expect(API.revokeUserRole).toHaveBeenCalledWith('user_grace', 'viewer');
    expect(API.setUserRole).not.toHaveBeenCalled();
    // Pending again, the row offers the approval buttons instead of the list.
    expect(screen.queryByRole('combobox', { name: 'Access of grace@example.com' })).toBeNull();
    expect(within(userRow('grace@example.com')).getByRole('button', { name: 'Approve as viewer' })).toBeTruthy();
    expect(within(userRow('grace@example.com')).getByText('Pending')).toBeTruthy();
  });

  it('changes nothing when the admin cancels, or picks the access the user has', async () => {
    openModal(true);
    openSection('User management');
    const grace = await screen.findByRole('combobox', { name: 'Access of grace@example.com' }) as HTMLSelectElement;

    fireEvent.change(grace, { target: { value: 'pending' } });
    fireEvent.click(confirmationFor('grace@example.com').getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Confirm the change for grace@example.com' })).toBeNull();
    expect(grace.value).toBe('viewer');

    fireEvent.change(grace, { target: { value: 'admin' } });
    fireEvent.change(grace, { target: { value: 'viewer' } });
    expect(screen.queryByRole('group', { name: 'Confirm the change for grace@example.com' })).toBeNull();
    expect(API.revokeUserRole).not.toHaveBeenCalled();
    expect(API.setUserRole).not.toHaveBeenCalled();
  });

  it('loads the list again when the route finds it out of date', async () => {
    openModal(true);
    openSection('User management');
    const grace = await screen.findByRole('combobox', { name: 'Access of grace@example.com' }) as HTMLSelectElement;
    API.revokeUserRole.mockRejectedValueOnce(Object.assign(new Error('changed in the meantime'), { status: 409, code: 'changed' }));
    // Meanwhile another admin made Grace an admin.
    API.getUsers.mockResolvedValueOnce({ users: USERS.map((u) => (u.id === 'user_grace' ? { ...u, role: 'admin' } : u)) });

    fireEvent.change(grace, { target: { value: 'pending' } });
    fireEvent.click(confirmationFor('grace@example.com').getByRole('button', { name: 'Take access away' }));
    expect(await screen.findByText(
      'The access of grace@example.com, or your own role, changed in the meantime. The list now shows the current state.',
    )).toBeTruthy();
    expect(API.getUsers).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(grace.value).toBe('admin'));
  });

  it("shows the route's own reason for any other refusal, such as an address Clerk has not verified", async () => {
    openModal(true);
    openSection('User management');
    const asViewer = within(await findUserRow('alan@example.com')).getByRole('button', { name: 'Approve as viewer' });
    API.setUserRole.mockRejectedValueOnce(Object.assign(
      new Error('Clerk has not verified alan@example.com yet; approve the user once they have confirmed it.'),
      { status: 409, code: null },
    ));
    fireEvent.click(asViewer);
    fireEvent.click(confirmationFor('alan@example.com').getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Clerk has not verified alan@example.com yet; approve the user once they have confirmed it.'))
      .toBeTruthy();
    expect(API.getUsers).toHaveBeenCalledTimes(1);
    // Still pending: the approval buttons stay.
    expect(within(userRow('alan@example.com')).getByRole('button', { name: 'Approve as viewer' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Access of alan@example.com' })).toBeNull();
  });

  it('changes a role through api.setUserRole and shows a failure', async () => {
    openModal(true);
    openSection('User management');
    const grace = await screen.findByRole('combobox', { name: 'Access of grace@example.com' }) as HTMLSelectElement;

    fireEvent.change(grace, { target: { value: 'admin' } });
    expect(confirmationFor('grace@example.com').getByText('Make grace@example.com an admin?')).toBeTruthy();
    fireEvent.click(confirmationFor('grace@example.com').getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Role updated.')).toBeTruthy();
    expect(API.setUserRole).toHaveBeenCalledWith('user_grace', 'admin', 'viewer');
    expect(grace.value).toBe('admin');

    API.setUserRole.mockRejectedValueOnce(new Error('Admin role required'));
    fireEvent.change(grace, { target: { value: 'viewer' } });
    fireEvent.click(confirmationFor('grace@example.com').getByRole('button', { name: 'Confirm' }));
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

  it('asks before signing out everywhere, and Cancel keeps every session', async () => {
    openModal();
    openSection('Active sessions');
    await screen.findByText('Macintosh · Safari');

    const trigger = screen.getByRole('button', { name: 'Sign out of every session' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('This signs you out here as well. Continue?')).toBeNull();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const question = within(screen.getByRole('group', { name: 'Confirm signing out of every session' }));
    expect(question.getByText('This signs you out here as well. Continue?')).toBeTruthy();
    expect(screen.getByText('This signs you out here as well. Continue or cancel under the button.').getAttribute('role'))
      .toBe('status');
    expect(CLERK.clerk.signOut).not.toHaveBeenCalled();
    expect(CLERK.laptop.revoke).not.toHaveBeenCalled();

    fireEvent.click(question.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Confirm signing out of every session' })).toBeNull();
    expect(CLERK.clerk.signOut).not.toHaveBeenCalled();
    expect(CLERK.laptop.revoke).not.toHaveBeenCalled();
  });

  it("signs out everywhere once confirmed: the other devices first, then this browser's API cookie and session", async () => {
    openModal();
    openSection('Active sessions');
    await screen.findByText('Macintosh · Safari');

    fireEvent.click(screen.getByRole('button', { name: 'Sign out of every session' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirm signing out of every session' }))
      .getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(CLERK.clerk.signOut).toHaveBeenCalledWith({ redirectUrl: '/sign-in' }));
    expect(CLERK.laptop.revoke).toHaveBeenCalledTimes(1);
    expect(CLERK.here.revoke).not.toHaveBeenCalled();
    expect(API.clearViewerCookie).toHaveBeenCalledTimes(1);
    expect(API.clearViewerCookie.mock.invocationCallOrder[0])
      .toBeLessThan(CLERK.clerk.signOut.mock.invocationCallOrder[0]);
  });
});

describe('Password', () => {
  it('names the password fields for the browser and points the new password at its hint', () => {
    openModal();
    openSection('Password');
    const current = screen.getByLabelText('Current password') as HTMLInputElement;
    const next = screen.getByLabelText(/^New password/) as HTMLInputElement;
    const confirm = screen.getByLabelText('Confirm new password') as HTMLInputElement;
    expect([current, next, confirm].map((i) => i.type)).toEqual(['password', 'password', 'password']);
    expect([current, next, confirm].map((i) => i.getAttribute('autocomplete')))
      .toEqual(['current-password', 'new-password', 'new-password']);
    expect([current, next, confirm].map((i) => i.name)).toEqual(['current-password', 'new-password', 'confirm-password']);
    const hintId = next.getAttribute('aria-describedby')!;
    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId)!.textContent).toBe('At least 8 characters.');
    expect(confirm.getAttribute('aria-describedby')).toBe(hintId);
  });
});

describe('the dialog', () => {
  it('heads the chosen section with an h2 and marks its pill in the rail', () => {
    openModal(true);
    expect(screen.getByRole('heading', { level: 2, name: 'Profile' })).toBeTruthy();
    const rail = within(screen.getByRole('navigation', { name: 'Settings sections' }));
    expect(rail.getByRole('button', { name: 'Profile' }).getAttribute('aria-current')).toBe('page');
    expect(rail.getByRole('button', { name: 'Model configuration' }).getAttribute('aria-current')).toBeNull();

    openSection('Model configuration');
    expect(screen.getByRole('heading', { level: 2, name: 'Model configuration' })).toBeTruthy();
    expect(rail.getByRole('button', { name: 'Model configuration' }).getAttribute('aria-current')).toBe('page');
    expect(rail.getByRole('button', { name: 'Profile' }).getAttribute('aria-current')).toBeNull();
  });

  it('shows the role capitalised in the footer and in the profile', () => {
    const { container } = openModal(true);
    const aside = container.querySelector('aside')!;
    expect(within(aside).getByText('Admin')).toBeTruthy();
    expect(within(aside).queryByText('admin')).toBeNull();
    const main = container.querySelector('main')!;
    expect(within(main).getByText('Admin')).toBeTruthy();
    cleanup();

    openModal(false);
    expect(screen.getAllByText('Viewer').length).toBeGreaterThanOrEqual(2);   // the footer and the profile's pill
    expect(screen.queryByText('viewer')).toBeNull();
  });
});
