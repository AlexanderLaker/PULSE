'use client';

/**
 * The dashboard: the top navigation, the panes behind it and three dialogs
 * (settings, help and the welcome dialog), all inside one PrismProvider, so
 * the data loads once and every pane reads the same store.
 *
 * Only users with a role get here: proxy.ts sends everyone else away, and
 * app/dashboard/page.tsx reads the role again on the server and passes it
 * in; the dashboard hands it to every view with admin controls as
 * `isAdmin`. Clerk supplies the identity. Every tab is open to both roles.
 *
 * The address bar carries the active view and its parameters
 * (lib/viewUrl.ts, hooks/useViewUrl.tsx): a view can be linked, and Back
 * returns to the previous one. A new sign-in without an address lands on the
 * entry gate; a returning user lands on the view they left (remembered per
 * user in this browser), with the gate one click away on the wordmark. A
 * pane mounts on its first visit and then stays mounted, hidden while another
 * shows, so its lens, year, filters, open drill-down and scroll survive a tab
 * switch and nothing reloads; an overlay in a hidden pane lets go of the page
 * (PaneActiveContext, hooks/useOverlay). Below lg the tabs sit behind a menu
 * button.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { MotionConfig } from 'framer-motion';
import { AlertTriangle, CircleHelp, LogOut, Settings, Menu, MessageSquare, Sparkles, X } from 'lucide-react';
import { useUser, useClerk, useSession } from '@clerk/nextjs';
import * as api from '@/lib/apiClient';
import { endSession, markSessionEnded } from '@/lib/session';
import { FEEDBACK_URL } from '@/lib/feedback';
import { type ViewId, type ViewUrlState } from '@/lib/viewUrl';
import ShiftAnalysis from '@/components/dashboard/ShiftAnalysis';
import Drivers, { type DriverSearch } from '@/components/dashboard/Drivers';
import { drillThroughParams } from '@/lib/driverNames';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';
import HomeGate from '@/components/dashboard/HomeGate';
import ServiceNotice from '@/components/dashboard/ServiceNotice';
import SettingsModal from '@/components/dashboard/SettingsModal';
import WelcomeModal from '@/components/dashboard/WelcomeModal';
import { FullPageSkeleton, PaneSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { PrismProvider } from '@/hooks/usePrism';
import { PaneActiveContext } from '@/hooks/useOverlay';
import useViewUrl, { ViewUrlProvider } from '@/hooks/useViewUrl';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import type { Role } from '@/types';

// The Consumer Journey and the Explorer load on their first visit: their code
// (the board, the chart and the drawer) does not belong in the initial bundle.
// Their content is not in any bundle: each fetches it from the API when it
// opens (GET /api/v1/journey, GET /api/v1/explorer).
const ConsumerJourney = dynamic(
  () => import('@/components/dashboard/ConsumerJourney'),
  { loading: () => <PaneSkeleton />, ssr: false },
);
const ProfitPoolExplorer = dynamic(
  () => import('@/components/dashboard/ProfitPoolExplorer'),
  { loading: () => <PaneSkeleton />, ssr: false },
);

type DashboardTab = ViewId;

interface TabDef {
  id: DashboardTab;
  label: string;
  /** Beta: muted, pinned to the right of the nav. */
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
const VIEW_IDS = new Set<string>(TABS.map((t) => t.id));

// Beta tabs read in the muted scale, a step back from the production tabs'
// blue; both shades keep 4.5:1 on the bar.
const BETA_INACTIVE = S.mutedText;
const BETA_ACTIVE = S.onSurfaceVariant;

// The welcome dialog opens once per user in a browser: dismissing it stores
// the user's id in localStorage, so a new sign-in stays quiet; Help offers it
// again. The key carries a version, so a rewritten welcome shows once more.
const welcomeSeenKey = (userId: string) => `prism.welcomeSeen.v2.${userId}`;
/** The view a user left last, remembered per user in this browser. */
const lastViewKey = (userId: string) => `prism.lastView.${userId}`;

/** Subscribers to the welcome flag: this page's own writes and other tabs' storage events. */
const welcomeListeners = new Set<() => void>();
const subscribeToWelcomeFlag = (listener: () => void) => {
  welcomeListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => { welcomeListeners.delete(listener); window.removeEventListener('storage', listener); };
};

const readStorage = (key: string): string | null => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};
const writeStorage = (key: string, value: string) => {
  try { window.localStorage.setItem(key, value); } catch { /* private mode: nothing is remembered */ }
};

/** The gate, parsed from no address: what the dashboard shows without one. */
const HOME: ViewUrlState = { view: 'home', params: {} };

export default function DashboardApp({ role, initialView = HOME }: { role: Role; initialView?: ViewUrlState }) {
  // The visited panes, kept mounted; the provider tells the shell of every
  // change of view, including Back and Forward.
  const [visitedTabs, setVisitedTabs] = useState<DashboardTab[]>([initialView.view]);
  const onViewChange = useCallback((view: ViewId) => {
    setVisitedTabs((prev) => (prev.includes(view) ? prev : [...prev, view]));
  }, []);
  return (
    <ViewUrlProvider initial={initialView} onViewChange={onViewChange}>
      <DashboardShell role={role} visitedTabs={visitedTabs} initialView={initialView} />
    </ViewUrlProvider>
  );
}

function DashboardShell({ role, visitedTabs, initialView }: {
  role: Role; visitedTabs: DashboardTab[]; initialView: ViewUrlState;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const { session } = useSession();
  const { view: activeTab, openView } = useViewUrl();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // Why the last sign-out failed, without closing punctuation; the user is
  // still signed in.
  const [logoutError, setLogoutError] = useState<string | null>(null);
  // The search the Drivers tab applies when another view opens it on a driver;
  // each opening counts, even for the same driver twice.
  const [driversSearch, setDriversSearch] = useState<DriverSearch | null>(null);

  // Every admin write is checked on the server again, whatever this says.
  const isAdmin = role === 'admin';
  const userId = user?.id ?? null;

  // The welcome flag lives in localStorage, outside React, so it is read with
  // useSyncExternalStore; the server snapshot says "seen", so the dialog never
  // opens while hydrating. Dismissing closes it at once (private mode cannot
  // store the flag); Help can open it again at any time.
  const seenInStorage = useSyncExternalStore(
    subscribeToWelcomeFlag,
    () => (userId ? !!readStorage(welcomeSeenKey(userId)) : true),
    () => true,
  );
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [welcomeForced, setWelcomeForced] = useState(false);
  const welcomeOpen = !!isSignedIn && userId !== null
    && (welcomeForced || (!seenInStorage && dismissedFor !== userId));
  const closeWelcome = () => {
    setWelcomeForced(false);
    setDismissedFor(userId);
    if (userId) { writeStorage(welcomeSeenKey(userId), '1'); welcomeListeners.forEach((listener) => listener()); }
  };

  // A returning user who opened the bare address lands on the view they left.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !userId) return;
    landed.current = true;
    if (initialView.view !== 'home' || Object.keys(initialView.params).length) return;
    const last = readStorage(lastViewKey(userId));
    if (last && last !== 'home' && VIEW_IDS.has(last)) openView(last as ViewId, { push: false });
  }, [userId, initialView, openView]);

  // A session that ends while the page is open: the viewer cookie is expired
  // (it is not tied to the Clerk session), then a full navigation to /sign-in
  // that replaces this page, so proxy.ts runs again and Back does not return
  // to a dashboard that can no longer load its data.
  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    markSessionEnded();
    void api.clearViewerCookie().then(() => { window.location.replace('/sign-in'); });
  }, [isLoaded, isSignedIn]);

  // Opening a tab pushes a history entry, mounts the pane for good and closes
  // the mobile menu. The panes share the window's scroll position, so every
  // switch starts at the top.
  const openTab = (id: DashboardTab) => {
    openView(id, { push: true });
    setMobileNavOpen(false);
    if (userId) writeStorage(lastViewKey(userId), id);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // A drill-through hands over a driver's code: the Drivers page shows that
  // driver alone and opens it, as a typed code does (lib/driverNames.ts).
  const openDriver = (query: string) => {
    setDriversSearch((prev) => ({ query, seq: (prev?.seq ?? 0) + 1 }));
    openView('drivers', { push: true, params: drillThroughParams(query) });
    if (userId) writeStorage(lastViewKey(userId), 'drivers');
    window.scrollTo({ top: 0, behavior: 'auto' });
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
  const sessionId = session?.id ?? null;

  const renderTabButton = (tab: TabDef) => {
    const isActive = activeTab === tab.id;
    const activeColor = tab.beta ? BETA_ACTIVE : S.primary;
    const inactiveColor = tab.beta ? BETA_INACTIVE : S.onSurfaceVariant;
    return (
      <button type="button"
        key={tab.id}
        onClick={() => openTab(tab.id)}
        aria-current={isActive ? 'page' : undefined}
        className="relative pb-1 text-sm font-semibold tracking-tight transition-colors whitespace-nowrap"
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
        data-print-hide
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          backgroundColor: S.glass,
          boxShadow: SHADOW.nav,
        }}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-3 md:gap-6">
          <div className="flex items-center gap-3 md:gap-6 xl:gap-8 min-w-0">
            <button type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileNavOpen}
              className="lg:hidden p-2 -ml-1 rounded-full transition-colors hover:bg-theme-on-surface/5"
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

            <div className="hidden lg:flex items-center gap-5 xl:gap-6">
              {MAIN_TABS.map(renderTabButton)}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div
              className="hidden lg:flex items-center gap-5 pr-3 mr-1 border-r"
              style={{ borderColor: S.cardBorder }}
            >
              {BETA_TABS.map(renderTabButton)}
            </div>
            <HelpMenu onShowWelcome={() => setWelcomeForced(true)} />
            <button type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="p-2 rounded-full transition-colors hover:bg-theme-on-surface/5"
              style={{ color: S.onSurfaceVariant }}
            >
              <Settings size={18} />
            </button>

            <div
              className="hidden xl:flex flex-col items-end leading-tight"
              style={{ color: S.onBg }}
            >
              <span className="text-xs font-semibold">{userEmail}</span>
            </div>

            <button type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Sign out"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
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
            className="lg:hidden border-t"
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
            <div className="px-6 pt-2 pb-3 text-xs" style={{ color: S.onSurfaceVariant }}>
              {userEmail}
            </div>
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
      <WelcomeModal open={welcomeOpen} onClose={closeWelcome} key={sessionId ?? 'welcome'} />
    </div>
    </MotionConfig>
    </PrismProvider>
  );
}

// ─── Help ──────────────────────────────────────────────────────────────────

/** The help menu in the top bar: the welcome again, the feedback address when
 *  one is configured, and the keyboard shortcuts. A small menu rather than a
 *  page, because everything it holds is one line. */
function HelpMenu({ onShowWelcome }: { onShowWelcome: () => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // As the Export menu: Escape closes and returns focus to the button, a
  // click outside closes, the arrows move between the items and wrap, Home
  // and End go to the ends, Tab leaves and closes. A disabled note takes no focus.
  useEffect(() => {
    if (!open) return undefined;
    const items = () => Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    const focusItem = (index: number) => {
      const list = items();
      if (list.length === 0) return;
      list[((index % list.length) + list.length) % list.length]?.focus();
    };
    focusItem(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); buttonRef.current?.focus(); return; }
      if (!menuRef.current?.contains(e.target as Node)) return;
      const current = items().indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(current + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(current - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
      else if (e.key === 'End') { e.preventDefault(); focusItem(-1); }
      else if (e.key === 'Tab') setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onPointer); };
  }, [open]);

  const item: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent',
    color: S.onSurface, fontFamily: BODY_FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); }
        }}
        aria-label="Help"
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-2 rounded-full transition-colors hover:bg-theme-on-surface/5"
        style={{ color: S.onSurfaceVariant }}
      >
        <CircleHelp size={18} />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Help"
          className="absolute right-0 top-full mt-2 z-50 rounded-xl p-1.5"
          style={{
            minWidth: 260, backgroundColor: S.surface, border: `1px solid ${S.cardBorderStrong}`,
            boxShadow: SHADOW.popover,
          }}
        >
          <button type="button" role="menuitem" style={item} className="hover:bg-theme-surface-low"
            onClick={() => { setOpen(false); onShowWelcome(); }}>
            <Sparkles size={15} style={{ color: S.primary }} /> Show the welcome again
          </button>
          {FEEDBACK_URL ? (
            <a role="menuitem" href={FEEDBACK_URL}
              target={FEEDBACK_URL.startsWith('mailto:') ? undefined : '_blank'}
              rel={FEEDBACK_URL.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
              style={{ ...item, textDecoration: 'none' }} className="hover:bg-theme-surface-low"
              onClick={() => setOpen(false)}>
              <MessageSquare size={15} style={{ color: S.primary }} /> Send feedback to the PRISM team
            </a>
          ) : (
            <div role="menuitem" aria-disabled="true" style={{ ...item, color: S.onSurfaceVariant, cursor: 'default', fontWeight: 500 }}>
              <MessageSquare size={15} /> Feedback: ask your PRISM admin for the address
            </div>
          )}
          <div style={{ padding: '8px 12px 6px', fontSize: 11.5, lineHeight: 1.5, color: S.onSurfaceVariant, borderTop: `1px solid ${S.cardBorder}`, marginTop: 4 }}>
            Keys 1 to 4 open the views from the entry gate; Escape closes any dialog; the address bar carries the view you are on, so a copied link opens the same lens, year or drill-down.
          </div>
        </div>
      )}
    </div>
  );
}
