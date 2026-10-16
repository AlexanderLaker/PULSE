// @vitest-environment jsdom
/**
 * The access gate's pages (proxy.test.ts has the check in front of them).
 *
 *   - /dashboard (app/dashboard/page.tsx) reads the role on the server again:
 *     a user with one gets the dashboard with that role, a pending user and a
 *     failed check go to /pending, a visitor without a session to /sign-in.
 *   - /pending (app/(auth)/pending/page.tsx) says that access awaits
 *     approval, reports a failed check as such, and sends a user who has a
 *     role by now on to the dashboard.
 *   - It expires any viewer cookie left in the browser; Check again goes to
 *     /dashboard and, back on the waiting page, says the account still has
 *     no access; Sign out expires the cookie first.
 *   - Nothing the waiting page imports, its layouts included, reaches the
 *     dashboard's code (the feedback link it names the PRISM team with is a
 *     leaf piece, not the dashboard).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';

const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT ${url}`); }),
  push: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: nav.redirect, useRouter: () => ({ push: nav.push }) }));

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn(), signOut: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: clerk.auth, currentUser: clerk.currentUser }));
vi.mock('@clerk/nextjs', () => ({ useClerk: () => ({ signOut: clerk.signOut }) }));

const db = vi.hoisted(() => ({ roleRows: [] as Array<{ role: string }>, down: false }));
vi.mock('@/lib/db', () => ({
  getSQL: () => (strings: TemplateStringsArray) => {
    if (db.down) return Promise.reject(new Error('connection refused'));
    return Promise.resolve(strings.join('?').includes('SELECT role') ? db.roleRows : []);
  },
}));

// The dashboard itself stays out of this test: only whether it is rendered, and with which role, matters.
vi.mock('@/app/dashboard/DashboardApp', () => ({ default: function DashboardApp() { return null; } }));

import DashboardPage from '@/app/dashboard/page';
import DashboardApp from '@/app/dashboard/DashboardApp';
import PendingPage from '@/app/(auth)/pending/page';

/** Signed in as user_1 with this role; null: pending, without a row. */
const signedIn = (role: 'admin' | 'viewer' | null) => {
  clerk.auth.mockResolvedValue({ userId: 'user_1' });
  clerk.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'ana@example.com' } });
  db.roleRows = role ? [{ role }] : [];
};
const signedOut = () => clerk.auth.mockResolvedValue({ userId: null });

let requests: string[];

beforeEach(() => {
  vi.clearAllMocks();
  db.down = false;
  requests = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    requests.push(`${init?.method ?? 'GET'} ${url}`);
    return new Response('{"ok":true}', { status: 200 });
  }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('/dashboard', () => {
  it('renders the dashboard for a user with a role, with that role', async () => {
    for (const role of ['admin', 'viewer'] as const) {
      signedIn(role);
      const page = await DashboardPage();
      expect(page.type).toBe(DashboardApp);
      expect(page.props).toEqual({ role, initialView: { view: 'home', params: {} } });
    }
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it('hands the dashboard the view the address names, and drops what the taxonomy does not know', async () => {
    signedIn('viewer');
    const page = await DashboardPage({
      searchParams: Promise.resolve({ view: 'shift', lens: 'force', year: '2031', category: 'LHC: FCN', bogus: 'x' }),
    });
    expect(page.props).toEqual({
      role: 'viewer',
      initialView: { view: 'shift-analysis', params: { lens: 'force', year: '2031', category: 'LHC: FCN' } },
    });
  });

  it('sends a pending user to the waiting page, without the dashboard, and logs no failure', async () => {
    signedIn(null);
    await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT /pending');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('sends everyone to the waiting page while the role cannot be read', async () => {
    signedIn('admin');
    db.down = true;
    await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT /pending');
    expect(console.error).toHaveBeenCalled();
  });

  it('sends a visitor without a session to sign in', async () => {
    signedOut();
    await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT /sign-in');
  });
});

describe('/pending', () => {
  it('tells a pending user that access awaits approval, with the address they signed in with', async () => {
    signedIn(null);
    render(await PendingPage());
    expect(screen.getByRole('heading', { name: 'Waiting for approval' })).toBeTruthy();
    expect(screen.getByText(
      /^Your account is signed in as ana@example\.com but not yet approved\. An admin has to approve it; once they tell you, press Check again\. Not sure who your admin is\? Ask /,
    )).toBeTruthy();
    expect(screen.getByText('the PRISM team')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('sends a user who has a role by now on to the dashboard', async () => {
    signedIn('viewer');
    await expect(PendingPage()).rejects.toThrow('NEXT_REDIRECT /dashboard');
  });

  it('reports a check that failed as such, not as a missing approval, and logs the cause', async () => {
    signedIn('viewer');
    db.down = true;
    render(await PendingPage());
    expect(screen.getByRole('heading', { name: 'Access could not be checked' })).toBeTruthy();
    expect(screen.queryByText(/Waiting for approval/)).toBeNull();
    expect(console.error).toHaveBeenCalledWith('[/pending] access check failed:', expect.any(Error));
  });

  it('sends a visitor without a session to sign in', async () => {
    signedOut();
    await expect(PendingPage()).rejects.toThrow('NEXT_REDIRECT /sign-in');
  });

  it('expires any viewer cookie left in the browser when it loads', async () => {
    signedIn(null);
    render(await PendingPage());
    await waitFor(() => expect(requests).toEqual(['DELETE /api/prism-cookie']));
  });

  it('checks again by going to /dashboard and, back here, says the account still has no access', async () => {
    signedIn(null);
    render(await PendingPage());
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(nav.push).toHaveBeenCalledWith('/dashboard');
    expect((await screen.findByRole('status')).textContent).toBe('Still no access: an admin has to approve this account.');
  });

  it('says so when checking again finds the check still failing', async () => {
    signedIn('viewer');
    db.down = true;
    render(await PendingPage());
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect((await screen.findByRole('status')).textContent).toBe('Your access still could not be checked.');
  });

  it('shows a failed sign-out, and signs out with the viewer cookie expired first', async () => {
    signedIn(null);
    render(await PendingPage());
    await waitFor(() => expect(requests).toEqual(['DELETE /api/prism-cookie']));

    clerk.signOut.mockRejectedValueOnce(new Error('Network error.'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Signing out failed (Network error). You are still signed in; try again.'))
      .toBeTruthy();

    requests = [];
    clerk.signOut.mockImplementationOnce(async () => { requests.push('sign out'); });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(requests).toEqual(['DELETE /api/prism-cookie', 'sign out']));
    expect(clerk.signOut).toHaveBeenLastCalledWith({ redirectUrl: '/sign-in' });
  });
});

describe("the waiting page's code", () => {
  const ROOT = path.resolve(__dirname, '../..');
  /** The local files a module imports at run time (type-only imports are erased). */
  const localImports = (file: string): string[] => {
    const source = readFileSync(file, 'utf8');
    const specs = [...source.matchAll(/^\s*(?:import|export)\s+(?!type\s)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)]
      .map((m) => m[1]!)
      .concat([...source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]!));
    return specs.flatMap((spec) => {
      const base = spec.startsWith('@/') ? path.join(ROOT, spec.slice(2))
        : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null;
      if (!base) return [];   // a package
      const found = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((ext) => base + ext)
        .find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
      if (!found) throw new Error(`${file} imports ${spec}, which does not resolve`);
      return [found];
    });
  };

  it('reaches only the layouts, the auth frame, the role check, the feedback link and the theme, never the dashboard', () => {
    const seen = new Set<string>();
    const queue = ['app/layout.tsx', 'app/(auth)/layout.tsx', 'app/(auth)/pending/page.tsx'].map((f) => path.join(ROOT, f));
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      queue.push(...localImports(file));
    }
    expect([...seen].map((f) => path.relative(ROOT, f)).sort()).toEqual([
      'app/(auth)/layout.tsx',
      'app/(auth)/pending/PendingActions.tsx',
      'app/(auth)/pending/page.tsx',
      'app/(auth)/shared.tsx',
      'app/globals.css',
      'app/layout.tsx',
      'components/dashboard/FeedbackLink.tsx',
      'lib/db.ts',
      'lib/feedback.ts',
      'lib/roles.ts',
      'lib/theme.ts',
    ]);
  });
});
