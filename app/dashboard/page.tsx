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
 * Tab navigation (constant across all pages):
 *   Profit Pool Analysis 2 | Trends 2 | Consumer Journey 2 | Innovation Explorer
 *
 * The top navigation has been redesigned in the "Editorial Intelligence" style
 * (see stitch_fmcg_trend_navigator-3/DESIGN.md) — a softer, magazine-inspired
 * chrome that stays constant across every tab.
 */

import { useState } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';
import ProfitPoolAnalysis2 from '@/components/dashboard/ProfitPoolAnalysis2';
import InnovationExplorer from '@/components/dashboard/InnovationExplorer';
import InnovationExplorer3 from '@/components/dashboard/InnovationExplorer3';
import Trends2 from '@/components/dashboard/Trends2';
import ConsumerJourney2 from '@/components/dashboard/ConsumerJourney2';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';
import SettingsModal from '@/components/dashboard/SettingsModal';
import { FullPageSkeleton } from '@/components/dashboard/LoadingSkeleton';

type DashboardTab =
  | 'profit-pool-2'
  | 'trends-2'
  | 'consumer-journey-2'
  | 'innovation-explorer'
  | 'innovation-explorer-3';

interface TabDef {
  id: DashboardTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'profit-pool-2',         label: 'Profit Pool Shift Analysis' },
  { id: 'trends-2',              label: 'Trends' },
  { id: 'consumer-journey-2',    label: 'Consumer Journey' },
  { id: 'innovation-explorer',   label: 'Innovation Explorer' },
  { id: 'innovation-explorer-3', label: 'Innovation Explorer Alternative' },
];

// Editorial top-nav tokens (mirrors Trends2 / DESIGN.md palette)
const NAV = {
  primary:          '#005db5',
  onBg:             '#00345e',
  onSurfaceVariant: '#26619d',
  surfaceLow:       '#eff4ff',
  surfaceHigh:      '#dce9ff',
  outlineVariant:   '#81b5f6',
};
const HEADLINE_FONT =
  "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

export default function DashboardPage() {
  // Clerk: `isLoaded` flips true once the session state has been hydrated.
  // `isSignedIn` and `user` come straight from the active session — no
  // fetch, no race condition against middleware.
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('profit-pool-2');
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f9ff' }}>
      {/* ─── Editorial Top Navigation (constant across all tabs) ─── */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(255,255,255,0.75)',
          boxShadow: '0 32px 64px -15px rgba(0, 52, 94, 0.06)',
        }}
      >
        <div className="max-w-[1440px] mx-auto px-8 h-16 flex items-center justify-between gap-6">
          {/* Brand + tabs */}
          <div className="flex items-center gap-8 min-w-0">
            <div
              className="text-2xl font-extrabold tracking-tighter uppercase"
              style={{ fontFamily: HEADLINE_FONT, color: NAV.onBg }}
            >
              PRISM
            </div>

            <div className="hidden md:flex items-center gap-6">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative pb-1 text-sm font-semibold tracking-tight transition-colors"
                    style={{
                      fontFamily: HEADLINE_FONT,
                      color: isActive ? NAV.primary : NAV.onSurfaceVariant,
                    }}
                  >
                    {tab.label}
                    {isActive && (
                      <span
                        className="absolute left-0 right-0 -bottom-[2px] h-[2px] rounded-full"
                        style={{ backgroundColor: NAV.primary }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Utilities */}
          <div className="flex items-center gap-3">
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
              <span className="text-[11px]" style={{ color: NAV.onSurfaceVariant }}>
                Connected
              </span>
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
      </nav>

      {/* ─── Main Content — Tab-Switched ─────────────────────────── */}
      <div className="relative">
        <ErrorBoundary>
          {activeTab === 'profit-pool-2' && <ProfitPoolAnalysis2 />}
          {activeTab === 'trends-2' && <Trends2 />}
          {activeTab === 'consumer-journey-2' && (
            <ConsumerJourney2
              onNavigateProfitPoolShiftModel={() => setActiveTab('profit-pool-2')}
              onNavigateTrends={() => setActiveTab('trends-2')}
              onNavigateInnovation={() => setActiveTab('innovation-explorer')}
            />
          )}
          {activeTab === 'innovation-explorer' && (
            <InnovationExplorer
              onNavigateToTrend={() => setActiveTab('trends-2')}
              onNavigateToConsumerJourney={() => setActiveTab('consumer-journey-2')}
            />
          )}
          {activeTab === 'innovation-explorer-3' && (
            <InnovationExplorer3
              onNavigateToTrend={() => setActiveTab('trends-2')}
              onNavigateToConsumerJourney={() => setActiveTab('consumer-journey-2')}
            />
          )}
        </ErrorBoundary>
      </div>

      {/* ─── Settings Modal (gear icon in top nav) ─────────────────── */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
