'use client';

/**
 * The dashboard: the top navigation, the panes behind it and two dialogs
 * (settings and the welcome dialog), all inside one PrismProvider, so the
 * data loads once and every pane reads the same store.
 *
 * Only signed-in users get here: proxy.ts sends everyone else to /sign-in.
 * Clerk supplies the identity; the role comes from /api/me, asked once
 * here and handed to every view with admin controls as `isAdmin`. Every tab
 * is open to every role.
 *
 * Users land on the entry gate, a pane outside the top nav that the PRISM
 * wordmark returns to. A pane mounts on its first visit and then stays
 * mounted, hidden while another shows, so its lens, year, filters, open
 * drill-down and scroll survive a tab switch and nothing reloads; an overlay
 * in a hidden pane lets go of the page (PaneActiveContext, hooks/useOverlay).
 * Below md the tabs sit behind a menu button.
 */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { MotionConfig } from 'framer-motion';
import { AlertTriangle, LogOut, Settings, Menu, X } from 'lucide-react';
import { useUser, useClerk, useSession } from '@clerk/nextjs';
import * as api from '@/lib/apiClient';
import { endSession } from '@/lib/session';
import ShiftAnalysis from '@/components/dashboard/ShiftAnalysis';
import Drivers, { type DriverSearch } from '@/components/dashboard/Drivers';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';
import HomeGate from '@/components/dashboard/HomeGate';
import ServiceNotice from '@/components/dashboard/ServiceNotice';
import SettingsModal from '@/components/dashboard/SettingsModal';
import WelcomeModal from '@/components/dashboard/WelcomeModal';
import { FullPageSkeleton, PaneSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { PrismProvider } from '@/hooks/usePrism';
import { PaneActiveContext } from '@/hooks/useOverlay';
import { S, SHADOW, HEADLINE_FONT } from '@/lib/theme';
import type { Role } from '@/types';

// The Consumer Journey and the Explorer load on their first visit: their
// content (data/consumerJourney.ts, lib/profitPoolData.ts) does not belong in
// the initial bundle.
const ConsumerJourney = dynamic(
  () => import('@/components/dashboard/ConsumerJourney'),
  { loading: () => <PaneSkeleton />, ssr: false },
);
const ProfitPoolExplorer = dynamic(
  () => import('@/components/dashboard/ProfitPoolExplorer'),
  { loading: () => <PaneSkeleton />, ssr: false },
);

type DashboardTab =
  | 'home'
  | 'drivers'
  | 'consumer-journey'
  | 'shift-analysis'
  | 'profit-pool-explorer';

interface TabDef {
  id: DashboardTab;
  label: string;
  /** Beta: muted grey, pinned to the right of the nav. */
  beta?: boolean;
  /** Not in the nav: the entry gate, which the wordmark opens. */
  hidden?: boolean;
}

const TABS: TabDef[] = [
  { id: 'home', label: 'Home', hidden: true },
  { id: 'drivers', label: 'Drivers' },
  { id: 'consumer-journey', label: 'Consumer Journey' },
  { id: 'shift-analysis', label: 'Profit Pool Shift Analysis' },
  { id: 'profit-pool-explorer', label: 'Profit Pool Explorer (Beta)', beta: true },
];
const MAIN_TABS = TABS.filter((t) => !t.hidden && !t.beta);
const BETA_TABS = TABS.filter((t) => !t.hidden && t.beta);

// Beta tabs read in muted grey, a step back from the production tabs' blue.
const BETA_INACTIVE = S.neutral;
const BETA_ACTIVE = S.mutedText;

// The welcome dialog opens once per Clerk session: dismissing it stores the
// session id in sessionStorage, so a refresh stays quiet and a new sign-in
// (a new session id) shows it again.
const welcomeSeenKey = (sessionId: string) => `prism.welcomeSeen.${sessionId}`;

/** Whether this session has seen the dialog. Unreadable storage (private
 *  mode) reads as not seen, so the dialog still shows. */
function welcomeSeen(sessionId: string): boolean {
  try { return !!window.sessionStorage.getItem(welcomeSeenKey(sessionId)); } catch { return false; }
}

/** Only this page writes the flag, and dismissing re-renders anyway: nothing to subscribe to. */
const subscribeToWelcomeFlag = () => () => {};

export default function DashboardPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const { session } = useSession();

  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [visitedTabs, setVisitedTabs] = useState<DashboardTab[]>(['home']);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // Why the last sign-out failed, without closing punctuation; the user is
  // still signed in.
  const [logoutError, setLogoutError] = useState<string | null>(null);
  // The search the Drivers tab applies when another view opens it on a driver;
  // each opening counts, even for the same driver twice.
  const [driversSearch, setDriversSearch] = useState<DriverSearch | null>(null);

  // Admin controls stay hidden until /api/me says otherwise, and after any failure.
  const [role, setRole] = useState<Role>('viewer');
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    api.getMe().then(
      (me) => { if (!cancelled) setRole(me.role); },
      () => { if (!cancelled) setRole('viewer'); },
    );
    return () => { cancelled = true; };
  }, [isSignedIn]);
  const isAdmin = role === 'admin';

  // The flag lives outside React, so it is read with useSyncExternalStore; the
  // server snapshot says "seen", so the dialog never opens while hydrating.
  const sessionId = session?.id ?? null;
  const seenInStorage = useSyncExternalStore(
    subscribeToWelcomeFlag,
    () => (sessionId ? welcomeSeen(sessionId) : true),
    () => true,
  );
  // Closes the dialog at once; the stored flag keeps it closed after a refresh.
  const [dismissedSession, setDismissedSession] = useState<string | null>(null);
  const welcomeOpen =
    !!isSignedIn && sessionId !== null && !seenInStorage && dismissedSession !== sessionId;

  const closeWelcome = () => {
    if (!sessionId) return;
    setDismissedSession(sessionId);
    try {
      window.sessionStorage.setItem(welcomeSeenKey(sessionId), '1');
    } catch {
      // Private mode: the dialog shows again after a refresh.
    }
  };

  // A session that ends while the page is open: the viewer cookie is expired
  // (it is not tied to the Clerk session), then a full navigation to /sign-in,
  // so proxy.ts runs again.
  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    void api.clearViewerCookie().then(() => { window.location.href = '/sign-in'; });
  }, [isLoaded, isSignedIn]);

  // Opening a tab mounts it for good and closes the mobile menu. The panes
  // share the window's scroll position, so every switch starts at the top.
  const openTab = (id: DashboardTab) => {
    setActiveTab(id);
    setVisitedTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const openDriver = (query: string) => {
    setDriversSearch((prev) => ({ query, seq: (prev?.seq ?? 0) + 1 }));
    openTab('drivers');
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      // Straight to /sign-in: Clerk's default ("/") would only bounce there through proxy.ts.
      await endSession(() => signOut({ redirectUrl: '/sign-in' }));
    } catch (error) {
      console.error('Sign-out failed:', error);
      setLogoutError(((error as Error)?.message || 'Clerk did not answer').replace(/[\s.]+$/, ''));
      setIsLoggingOut(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-theme-bg">
        <FullPageSkeleton />
      </div>
    );
  }

  // The effect above is already sending the browser to /sign-in.
  if (!isSignedIn) return null;

  const userEmail = user.primaryEmailAddress?.emailAddress ?? 'Signed in';

  const renderTabButton = (tab: TabDef) => {
    const isActive = activeTab === tab.id;
    const activeColor = tab.beta ? BETA_ACTIVE : S.primary;
    const inactiveColor = tab.beta ? BETA_INACTIVE : S.onSurfaceVariant;
    return (
      <button type="button"
        key={tab.id}
        onClick={() => openTab(tab.id)}
        aria-current={isActive ? 'page' : undefined}
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

  // A full-width row in the mobile menu.
  const renderMobileTabRow = (tab: TabDef) => {
    const isActive = activeTab === tab.id;
    const activeColor = tab.beta ? BETA_ACTIVE : S.primary;
    const inactiveColor = tab.beta ? BETA_INACTIVE : S.onBg;
    return (
      <button type="button"
        key={tab.id}
        onClick={() => openTab(tab.id)}
        aria-current={isActive ? 'page' : undefined}
        className="w-full text-left px-6 py-3.5 text-[15px] font-semibold"
        style={{
          fontFamily: HEADLINE_FONT,
          color: isActive ? activeColor : inactiveColor,
          backgroundColor: isActive ? S.surfaceLow : 'transparent',
        }}
      >
        {tab.label}
      </button>
    );
  };

  // Mounted once visited, hidden while inactive.
  const tabPane = (id: DashboardTab, node: ReactNode) => (
    <div style={{ display: activeTab === id ? undefined : 'none' }}>
      <PaneActiveContext.Provider value={activeTab === id}>
        {visitedTabs.includes(id) && <ErrorBoundary>{node}</ErrorBoundary>}
      </PaneActiveContext.Provider>
    </div>
  );

  // The framer-motion animations are script-driven, so the reduced-motion rule
  // in globals.css does not reach them: MotionConfig drops their movement for
  // a reader who asks the system for less motion.
  return (
    <PrismProvider>
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen" style={{ backgroundColor: S.bg }}>
      <nav
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          backgroundColor: S.glass,
          boxShadow: SHADOW.nav,
        }}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-4 md:gap-8 min-w-0">
            <button type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileNavOpen}
              className="md:hidden p-2 -ml-1 rounded-full transition-colors hover:bg-theme-on-surface/5"
              style={{ color: S.onBg }}
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <button type="button"
              onClick={() => openTab('home')}
              aria-label="PRISM home"
              className="text-2xl font-extrabold tracking-tighter uppercase transition-opacity hover:opacity-70"
              style={{ fontFamily: HEADLINE_FONT, color: S.onBg }}
            >
              PRISM
            </button>

            <div className="hidden md:flex items-center gap-6">
              {MAIN_TABS.map(renderTabButton)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="hidden md:flex items-center gap-5 pr-3 mr-1 border-r"
              style={{ borderColor: S.cardBorder }}
            >
              {BETA_TABS.map(renderTabButton)}
            </div>
            <button type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="p-2 rounded-full transition-colors hover:bg-theme-on-surface/5"
              style={{ color: S.onSurfaceVariant }}
            >
              <Settings size={18} />
            </button>

            <div
              className="hidden sm:flex flex-col items-end leading-tight"
              style={{ color: S.onBg }}
            >
              <span className="text-xs font-semibold">{userEmail}</span>
            </div>

            <button type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Sign out"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ backgroundColor: S.surfaceLow, color: S.primary }}
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">
                {isLoggingOut ? 'Signing out…' : 'Sign out'}
              </span>
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div
            className="md:hidden border-t"
            style={{
              backgroundColor: S.surface,
              borderColor: S.cardBorder,
              boxShadow: SHADOW.popover,
            }}
          >
            {MAIN_TABS.map(renderMobileTabRow)}
            <div
              className="px-6 pt-3 pb-1 text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: BETA_INACTIVE, fontFamily: HEADLINE_FONT }}
            >
              Beta
            </div>
            {BETA_TABS.map(renderMobileTabRow)}
            <div className="h-2" />
          </div>
        )}
      </nav>

      <ServiceNotice />

      {logoutError && (
        <div role="alert" style={{ backgroundColor: S.amberContainer, color: S.onAmberContainer }}>
          <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-2.5 flex items-start gap-2.5 text-[13px]" style={{ lineHeight: 1.5 }}>
            <AlertTriangle size={15} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong style={{ fontFamily: HEADLINE_FONT }}>Signing out failed</strong> ({logoutError}). You are
              still signed in; try again.
            </span>
          </div>
        </div>
      )}

      <div className="relative">
        {tabPane('home', <HomeGate active={activeTab === 'home'} onNavigate={openTab} />)}
        {tabPane('shift-analysis', <ShiftAnalysis isAdmin={isAdmin} onNavigateToDriver={openDriver} />)}
        {tabPane('drivers', <Drivers search={driversSearch} isAdmin={isAdmin} />)}
        {tabPane('consumer-journey', <ConsumerJourney onNavigateToDriver={openDriver} isAdmin={isAdmin} />)}
        {tabPane('profit-pool-explorer', <ProfitPoolExplorer />)}
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} isAdmin={isAdmin} />
      <WelcomeModal open={welcomeOpen} onClose={closeWelcome} />
    </div>
    </MotionConfig>
    </PrismProvider>
  );
}
