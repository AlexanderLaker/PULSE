'use client';

/**
 * PRISM Dashboard Page
 *
 * Main entry point for the Profit Pool Shift Model.
 * Handles authentication, error boundaries, and component composition.
 *
 * Auth model (Clerk):
 *   - The Clerk middleware (middleware.ts) already guarantees the user
 *     is signed in before this component renders. Unauthenticated
 *     visitors are redirected to /sign-in before hitting this route.
 *   - `useUser()` gives us reactive access to the current user for
 *     display (email, avatar) without any fetch.
 *   - `<SignOutButton>` / `useClerk().signOut()` handles logout —
 *     Clerk invalidates the session on the server and clears cookies.
 *
 * Authorization (admin-only tabs):
 *   Identity comes from Clerk; *authorization* (admin vs viewer) is
 *   served by our own /api/me endpoint, which reads user_roles in Neon
 *   Postgres. We mirror the pattern used in SettingsModal.tsx. The
 *   Profit Pool Explorer tab is admin-gated.
 *
 * Tab navigation (constant across all pages):
 *   Trends | Consumer Journey | Profit Pool Shift Analysis
 *   [+ Profit Pool Explorer — Beta, pinned right]
 *   Below md: a menu button opens the same tab list as a sheet.
 *
 * Data (single store): one <PrismProvider> wraps all tabs, so the data
 * layer loads once and is shared. Tabs are mounted on first visit and
 * then KEPT MOUNTED (hidden via display:none), so in-view state — lens,
 * year, filters, open drill-down, scroll — survives tab switches and no
 * refetch is triggered on switch.
 */

import { useEffect, useState } from 'react';
import { LogOut, Settings, Menu, X } from 'lucide-react';
import { useUser, useClerk, useSession } from '@clerk/nextjs';
import dynamic from 'next/dynamic';
import ProfitPoolAnalysis2 from '@/components/dashboard/ProfitPoolAnalysis2';
import Trends2 from '@/components/dashboard/Trends2';
import ConsumerJourney2 from '@/components/dashboard/ConsumerJourney2';
// The Profit Pool Explorer (Beta) tab is dynamically imported (review
// F10): it pulls lib/profitPoolData, which does not belong in the
// initial bundle of the three production tabs.
const ProfitPoolExplorer = dynamic(
  () => import('@/components/dashboard/ProfitPoolExplorer'),
  { loading: () => <FullPageSkeleton />, ssr: false },
);
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';
import SettingsModal from '@/components/dashboard/SettingsModal';
import WelcomeModal from '@/components/dashboard/WelcomeModal';
import { FullPageSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { PrismProvider } from '@/hooks/usePrism';

type DashboardTab =
  | 'profit-pool-2'
  | 'trends-2'
  | 'consumer-journey-2'
  | 'profit-pool-explorer';

interface TabDef {
  id: DashboardTab;
  label: string;
  adminOnly?: boolean;
  /** Render in a muted gray to signal "(Beta)" status. */
  beta?: boolean;
  /** Excluded from the top nav (kept for potential future use). */
  hidden?: boolean;
}

const TABS: TabDef[] = [
  // Production views — left side of the top nav, in maritime blue.
  { id: 'trends-2',              label: 'Trends' },
  { id: 'consumer-journey-2',    label: 'Consumer Journey' },
  { id: 'profit-pool-2',         label: 'Profit Pool Shift Analysis' },
  // Beta views — pinned to the right side of the top nav, in muted gray.
  { id: 'profit-pool-explorer',  label: 'Profit Pool Explorer (Beta)', beta: true },
];

// Editorial top-nav tokens (mirrors Trends2 / DESIGN.md palette)
const NAV = {
  primary:          '#005db5',
  onBg:             '#00345e',
  onSurfaceVariant: '#26619d',
  surfaceLow:       '#eff4ff',
  surfaceHigh:      '#dce9ff',
  outlineVariant:   '#81b5f6',
  // Muted gray scale for "(Beta)" tabs — readable but visually
  // de-emphasized vs. the production tabs in maritime blue.
  betaInactive:     '#94a3b8',
  betaActive:       '#64748b',
};
const HEADLINE_FONT =
  "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

export default function DashboardPage() {
  // Clerk: `isLoaded` flips true once the session state has been hydrated.
  // `isSignedIn` and `user` come straight from the active session — no
  // fetch, no race condition against middleware.
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const { session } = useSession();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('profit-pool-2');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ─── Journey → Trends drill-through (v3.6 journey layer) ─────────
  // The Consumer Journey's evidence cards navigate to the Trends tab
  // with a search query (trend name) pre-applied via Trends2's
  // initialSearch prop.
  const [trendsSearch, setTrendsSearch] = useState<string | null>(null);

  // ─── Keep-alive tabs ─────────────────────────────────────────────
  // A tab is mounted the first time it is visited and stays mounted
  // afterwards (hidden with display:none). In-view state — lens, year,
  // filters, open drill-down, scroll — survives tab switches.
  const [visitedTabs, setVisitedTabs] = useState<DashboardTab[]>(['profit-pool-2']);

  // ─── Profit Pool Explorer mock-up notice ────────────────────────────
  // The Explorer is a visualization mock-up — the underlying data sources
  // have not yet been validated. Surface that fact every time the tab is
  // opened so beta users don't mistake it for production data.
  const [explorerNoticeOpen, setExplorerNoticeOpen] = useState(false);

  // ─── Welcome / MVP onboarding modal ─────────────────────────────────
  // Shown on every fresh login (v3.6 owner-verified semantics). Keyed by
  // the active Clerk session ID in sessionStorage — a tab refresh inside
  // an active session stays silent, but a new sign-in produces a new
  // session ID and the modal re-appears.
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  useEffect(() => {
    if (!isSignedIn || !session?.id) return;
    if (typeof window === 'undefined') return;
    const key = `prism.welcomeSeen.${session.id}`;
    try {
      if (!window.sessionStorage.getItem(key)) {
        setWelcomeOpen(true);
      }
    } catch {
      // sessionStorage unavailable (e.g. privacy mode) — show anyway.
      setWelcomeOpen(true);
    }
  }, [isSignedIn, session?.id]);

  const handleWelcomeClose = () => {
    setWelcomeOpen(false);
    if (typeof window !== 'undefined' && session?.id) {
      try {
        window.sessionStorage.setItem(`prism.welcomeSeen.${session.id}`, '1');
      } catch {
        /* noop */
      }
    }
  };

  // Central tab opener — marks the tab visited (keep-alive), fires the
  // beta notice on the two Beta tabs (unchanged behaviour), and closes
  // the mobile sheet.
  const openTab = (id: DashboardTab) => {
    setActiveTab(id);
    setVisitedTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (id === 'profit-pool-explorer') setExplorerNoticeOpen(true);
    setMobileNavOpen(false);
  };

  // Authorization — same pattern as SettingsModal.tsx. 'unknown' until fetched;
  // we fall back to 'viewer' on error so admin-only UI stays hidden by default.
  const [role, setRole] = useState<'admin' | 'viewer' | 'unknown'>('unknown');

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { role: 'admin' | 'viewer' };
        if (!cancelled) setRole(data.role);
      } catch {
        if (!cancelled) setRole('viewer');
      }
    })();
    return () => { cancelled = true; };
  }, [isSignedIn]);

  const isAdmin = role === 'admin';
  // All tabs visible to all users; the `adminOnly` flag is no longer used.
  const visibleTabs = TABS.filter((t) => (!t.adminOnly || isAdmin) && !t.hidden);
  // Split for layout: production tabs anchor to the brand on the left,
  // Beta tabs are pinned to the right of the nav next to the Settings icon.
  const mainTabs = visibleTabs.filter((t) => !t.beta);
  const betaTabs = visibleTabs.filter((t) => t.beta);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Redirect explicitly to /sign-in after Clerk clears the session.
      // Without redirectUrl, Clerk would send the user to the app's
      // configured after-sign-out URL (defaults to "/"), which our
      // middleware would then bounce to /sign-in anyway — passing it
      // here saves one hop.
      await signOut({ redirectUrl: '/sign-in' });
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  // Show the loading skeleton while Clerk is initializing. Middleware
  // has already guaranteed authentication before we render, so the
  // `!isSignedIn` branch should only fire in edge cases (token expiry
  // mid-session, for example).
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-surface-primary">
        <FullPageSkeleton />
      </div>
    );
  }

  if (!isSignedIn) {
    // Middleware normally prevents this, but we handle it defensively
    // rather than rendering nothing. Push to /sign-in via a full
    // navigation so the middleware re-evaluates.
    if (typeof window !== 'undefined') window.location.href = '/sign-in';
    return null;
  }

  const userEmail = user.primaryEmailAddress?.emailAddress ?? 'Signed in';

  // Renders one tab button. Beta tabs use a muted gray scale to clearly
  // differentiate them from the production tabs (which use maritime blue).
  const renderTabButton = (tab: TabDef) => {
    const isActive = activeTab === tab.id;
    const activeColor   = tab.beta ? NAV.betaActive   : NAV.primary;
    const inactiveColor = tab.beta ? NAV.betaInactive : NAV.onSurfaceVariant;
    return (
      <button
        key={tab.id}
        onClick={() => openTab(tab.id)}
        className="relative pb-1 text-sm font-semibold tracking-tight transition-colors"
        style={{
          fontFamily: HEADLINE_FONT,
          color: isActive ? activeColor : inactiveColor,
        }}
      >
        {tab.label}
        {isActive && (
          <span
            className="absolute left-0 right-0 -bottom-[2px] h-[2px] rounded-full"
            style={{ backgroundColor: activeColor }}
          />
        )}
      </button>
    );
  };

  // Mobile sheet row — full-width tap target (below md).
  const renderMobileTabRow = (tab: TabDef) => {
    const isActive = activeTab === tab.id;
    const activeColor   = tab.beta ? NAV.betaActive   : NAV.primary;
    const inactiveColor = tab.beta ? NAV.betaInactive : NAV.onBg;
    return (
      <button
        key={tab.id}
        onClick={() => openTab(tab.id)}
        className="w-full text-left px-6 py-3.5 text-[15px] font-semibold"
        style={{
          fontFamily: HEADLINE_FONT,
          color: isActive ? activeColor : inactiveColor,
          backgroundColor: isActive ? NAV.surfaceLow : 'transparent',
        }}
      >
        {tab.label}
      </button>
    );
  };

  // Keep-alive wrapper: mounted once visited, hidden when inactive.
  const tabPane = (id: DashboardTab, node: React.ReactNode) => (
    <div style={{ display: activeTab === id ? undefined : 'none' }}>
      {visitedTabs.includes(id) && <ErrorBoundary>{node}</ErrorBoundary>}
    </div>
  );

  return (
    <PrismProvider>
    <div className="min-h-screen" style={{ backgroundColor: '#f8f9ff' }}>
      {/* ─── Editorial Top Navigation (constant across all tabs) ─── */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(255,255,255,0.75)',
          boxShadow: '0 32px 64px -15px rgba(0, 52, 94, 0.06)',
        }}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4 md:gap-6">
          {/* Brand + tabs */}
          <div className="flex items-center gap-4 md:gap-8 min-w-0">
            {/* Mobile menu toggle — the only tab access below md. */}
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileNavOpen}
              className="md:hidden p-2 -ml-1 rounded-full transition-colors hover:bg-black/5"
              style={{ color: NAV.onBg }}
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div
              className="text-2xl font-extrabold tracking-tighter uppercase"
              style={{ fontFamily: HEADLINE_FONT, color: NAV.onBg }}
            >
              PRISM
            </div>

            <div className="hidden md:flex items-center gap-6">
              {mainTabs.map((tab) => renderTabButton(tab))}
            </div>
          </div>

          {/* Utilities */}
          <div className="flex items-center gap-3">
            {/* Beta tabs — pinned to the far right, immediately before the
                Settings icon. Hidden below md to mirror the main tab group. */}
            {betaTabs.length > 0 && (
              <div
                className="hidden md:flex items-center gap-5 pr-3 mr-1 border-r"
                style={{ borderColor: 'rgba(0, 52, 94, 0.10)' }}
              >
                {betaTabs.map((tab) => renderTabButton(tab))}
              </div>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="p-2 rounded-full transition-colors hover:bg-black/5"
              style={{ color: NAV.onSurfaceVariant }}
            >
              <Settings size={18} />
            </button>

            <div
              className="hidden sm:flex flex-col items-end leading-tight"
              style={{ color: NAV.onBg }}
            >
              <span className="text-xs font-semibold">{userEmail}</span>
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Logout"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50"
              style={{
                backgroundColor: NAV.surfaceLow,
                color: NAV.primary,
              }}
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">
                {isLoggingOut ? 'Signing out…' : 'Sign out'}
              </span>
            </button>
          </div>
        </div>

        {/* ── Mobile nav sheet (below md) ─────────────────────────── */}
        {mobileNavOpen && (
          <div
            className="md:hidden border-t"
            style={{
              backgroundColor: '#ffffff',
              borderColor: 'rgba(0, 52, 94, 0.10)',
              boxShadow: '0 24px 48px -12px rgba(0, 52, 94, 0.18)',
            }}
          >
            {mainTabs.map((tab) => renderMobileTabRow(tab))}
            {betaTabs.length > 0 && (
              <>
                <div
                  className="px-6 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: NAV.betaInactive, fontFamily: HEADLINE_FONT }}
                >
                  Beta
                </div>
                {betaTabs.map((tab) => renderMobileTabRow(tab))}
              </>
            )}
            <div className="h-2" />
          </div>
        )}
      </nav>

      {/* ─── Main Content — keep-alive panes ──────────────────────
          Every visited tab stays mounted; only the active one is
          displayed. Switching back is instant and stateful. */}
      <div className="relative">
        {tabPane('profit-pool-2', (
          <ProfitPoolAnalysis2
            isAdmin={isAdmin}
            onNavigateToTrend={(query: string) => {
              setTrendsSearch(query);
              openTab('trends-2');
            }}
          />
        ))}
        {tabPane('trends-2', <Trends2 initialSearch={trendsSearch} />)}
        {tabPane('consumer-journey-2', (
          <ConsumerJourney2
            onNavigateProfitPoolShiftModel={() => openTab('profit-pool-2')}
            onNavigateTrends={() => openTab('trends-2')}
            onNavigateToTrend={(query: string) => {
              setTrendsSearch(query);
              openTab('trends-2');
            }}
            isAdmin={isAdmin}
          />
        ))}
        {tabPane('profit-pool-explorer', <ProfitPoolExplorer />)}
      </div>

      {/* ─── Settings Modal (gear icon in top nav) ─────────────────── */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* ─── Welcome / MVP modal — shown on every fresh login ──────── */}
      <WelcomeModal open={welcomeOpen} onClose={handleWelcomeClose} />

      {/* ─── Profit Pool Explorer mock-up notice ─────────────────────
          Beta disclaimer surfaced every time the Explorer tab is opened.
          The Explorer is a visualization mock-up; data sources have not
          yet been validated. Users acknowledge with "Got it" to proceed. */}
      {explorerNoticeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="explorer-notice-title"
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 52, 94, 0.45)' }}
          onClick={() => setExplorerNoticeOpen(false)}
        >
          <div
            className="max-w-md w-full rounded-2xl bg-white shadow-2xl p-6"
            style={{ fontFamily: HEADLINE_FONT }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-2"
              style={{ color: NAV.betaActive }}
            >
              Beta · Mock-up
            </div>
            <h2
              id="explorer-notice-title"
              className="text-xl font-extrabold tracking-tight mb-2"
              style={{ color: NAV.onBg }}
            >
              Profit Pool Explorer
            </h2>
            <p
              className="text-sm leading-relaxed mb-5"
              style={{ color: NAV.onSurfaceVariant }}
            >
              This is a visualization mock-up. The data sources are not yet
              validated.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setExplorerNoticeOpen(false)}
                className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: NAV.surfaceLow,
                  color: NAV.primary,
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </PrismProvider>
  );
}
