'use client';

/**
 * The dashboard: the top navigation, the panes behind it and two dialogs
 * (settings and the welcome dialog), all inside one PrismProvider, so the
 * data loads once and every pane reads the same store.
 *
 * Only signed-in users get here: proxy.ts sends everyone else to /sign-in.
 * Clerk (v6) supplies the identity; the role comes from /api/me, asked once
 * here and handed to every view with admin controls as `isAdmin`. Every tab
 * is open to every role.
 *
 * Users land on the entry gate, a pane outside the top nav that the PRISM
 * wordmark returns to. A pane mounts on its first visit and then stays
 * mounted, hidden while another shows, so its lens, year, filters, open
 * drill-down and scroll survive a tab switch and nothing reloads. Below md
 * the tabs sit behind a menu button.
 */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { LogOut, Settings, Menu, X } from 'lucide-react';
import { useUser, useClerk, useSession } from '@clerk/nextjs';
import * as api from '@/api/client';
import ShiftAnalysis from '@/components/dashboard/ShiftAnalysis';
import Drivers from '@/components/dashboard/Drivers';
import ConsumerJourney from '@/components/dashboard/ConsumerJourney';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';
import HomeGate from '@/components/dashboard/HomeGate';
import SettingsModal from '@/components/dashboard/SettingsModal';
import WelcomeModal from '@/components/dashboard/WelcomeModal';
import { FullPageSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { PrismProvider } from '@/hooks/usePrism';
import { S, HEADLINE_FONT } from '@/lib/theme';
import type { Role } from '@/types';

// The Explorer loads on its first visit: lib/profitPoolData does not belong
// in the initial bundle.
const ProfitPoolExplorer = dynamic(
  () => import('@/components/dashboard/ProfitPoolExplorer'),
  { loading: () => <FullPageSkeleton />, ssr: false },
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
  // The search the Drivers tab applies when another view opens it on a driver.
  const [driversSearch, setDriversSearch] = useState<string | null>(null);

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

  // A session that ends while the page is open: a full navigation to
  // /sign-in, so proxy.ts runs again.
  useEffect(() => {
    if (isLoaded && !isSignedIn) window.location.href = '/sign-in';
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
    setDriversSearch(query);
    openTab('drivers');
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Straight to /sign-in: Clerk's default ("/") would only bounce there through proxy.ts.
      await signOut({ redirectUrl: '/sign-in' });
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white">
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

  // A full-width row in the mobile menu.
  const renderMobileTabRow = (tab: TabDef) => {
    const isActive = activeTab === tab.id;
    const activeColor = tab.beta ? BETA_ACTIVE : S.primary;
    const inactiveColor = tab.beta ? BETA_INACTIVE : S.onBg;
    return (
      <button
        key={tab.id}
        onClick={() => openTab(tab.id)}
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
      {visitedTabs.includes(id) && <ErrorBoundary>{node}</ErrorBoundary>}
    </div>
  );

  return (
    <PrismProvider>
    <div className="min-h-screen" style={{ backgroundColor: S.bg }}>
      <nav
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(255,255,255,0.75)',
          boxShadow: '0 32px 64px -15px rgba(0, 52, 94, 0.06)',
        }}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-4 md:gap-8 min-w-0">
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileNavOpen}
              className="md:hidden p-2 -ml-1 rounded-full transition-colors hover:bg-black/5"
              style={{ color: S.onBg }}
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <button
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
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="p-2 rounded-full transition-colors hover:bg-black/5"
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

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Logout"
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
              boxShadow: '0 24px 48px -12px rgba(0, 52, 94, 0.18)',
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

      <div className="relative">
        {tabPane('home', <HomeGate active={activeTab === 'home'} onNavigate={openTab} />)}
        {tabPane('shift-analysis', <ShiftAnalysis isAdmin={isAdmin} onNavigateToDriver={openDriver} />)}
        {tabPane('drivers', <Drivers initialSearch={driversSearch} isAdmin={isAdmin} />)}
        {tabPane('consumer-journey', <ConsumerJourney onNavigateToDriver={openDriver} isAdmin={isAdmin} />)}
        {tabPane('profit-pool-explorer', <ProfitPoolExplorer />)}
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} isAdmin={isAdmin} />
      <WelcomeModal open={welcomeOpen} onClose={closeWelcome} />
    </div>
    </PrismProvider>
  );
}
