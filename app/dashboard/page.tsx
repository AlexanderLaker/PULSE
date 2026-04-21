'use client';

/**
 * PRISM Dashboard Page
 *
 * Main entry point for the Profit Pool Shift Model.
 * Handles authentication, error boundaries, and component composition.
 *
 * Tab navigation (constant across all pages):
 *   Profit Pool Analysis | Profit Pool Analysis 2 | Trends | Trends 2 | Consumer Journey | Innovation Explorer
 *
 * The top navigation has been redesigned in the "Editorial Intelligence" style
 * (see stitch_fmcg_trend_navigator-3/DESIGN.md) — a softer, magazine-inspired
 * chrome that stays constant across every tab.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Search, Settings } from 'lucide-react';
import ProfitPoolShiftModel from '@/components/dashboard/ProfitPoolShiftModel';
import ProfitPoolAnalysis2 from '@/components/dashboard/ProfitPoolAnalysis2';
import InnovationExplorer from '@/components/dashboard/InnovationExplorer';
import Trends2 from '@/components/dashboard/Trends2';
import ConsumerJourney from '@/components/dashboard/ConsumerJourney';
import ConsumerJourney2 from '@/components/dashboard/ConsumerJourney2';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';
import { FullPageSkeleton } from '@/components/dashboard/LoadingSkeleton';

type DashboardTab =
  | 'profit-pool'
  | 'profit-pool-2'
  | 'trends'
  | 'trends-2'
  | 'consumer-journey'
  | 'consumer-journey-2'
  | 'innovation-explorer';

interface TabDef {
  id: DashboardTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'profit-pool',         label: 'Profit Pool Analysis' },
  { id: 'profit-pool-2',       label: 'Profit Pool Analysis 2' },
  { id: 'trends',              label: 'Trends' },
  { id: 'trends-2',            label: 'Trends 2' },
  { id: 'consumer-journey',    label: 'Consumer Journey' },
  { id: 'consumer-journey-2',  label: 'Consumer Journey 2' },
  { id: 'innovation-explorer', label: 'Innovation Explorer' },
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

interface AuthCheck {
  authenticated: boolean;
  user?: { id: string; email: string };
  error?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [authCheck, setAuthCheck] = useState<AuthCheck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('profit-pool');

  // Check authentication on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/check');
        const data: AuthCheck = await response.json();
        setAuthCheck(data);
        if (!data.authenticated) router.push('/login');
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthCheck({ authenticated: false, error: 'Auth check failed' });
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-primary">
        <FullPageSkeleton />
      </div>
    );
  }

  if (!authCheck?.authenticated) return null;

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
            <div className="relative hidden lg:block">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: NAV.onSurfaceVariant }}
              />
              <input
                type="text"
                placeholder="Search trends…"
                className="pl-10 pr-4 py-1.5 rounded-full text-sm focus:outline-none focus:ring-2 w-64"
                style={{
                  backgroundColor: NAV.surfaceLow,
                  color: NAV.onBg,
                  border: 'none',
                }}
              />
            </div>

            <button
              aria-label="Settings"
              className="p-2 rounded-full transition-colors"
              style={{ color: NAV.onSurfaceVariant }}
            >
              <Settings size={18} />
            </button>

            <div
              className="hidden sm:flex flex-col items-end leading-tight"
              style={{ color: NAV.onBg }}
            >
              <span className="text-xs font-semibold">
                {authCheck.user?.email || 'User'}
              </span>
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
          {activeTab === 'profit-pool' && <ProfitPoolShiftModel />}
          {activeTab === 'profit-pool-2' && <ProfitPoolAnalysis2 />}
          {activeTab === 'trends' && <ProfitPoolShiftModel />}
          {activeTab === 'trends-2' && <Trends2 />}
          {activeTab === 'consumer-journey' && (
            <ConsumerJourney
              onNavigateProfitPoolShiftModel={() => setActiveTab('profit-pool')}
              onNavigateTrends={() => setActiveTab('trends')}
              onNavigateInnovation={() => setActiveTab('innovation-explorer')}
            />
          )}
          {activeTab === 'consumer-journey-2' && (
            <ConsumerJourney2
              onNavigateProfitPoolShiftModel={() => setActiveTab('profit-pool')}
              onNavigateTrends={() => setActiveTab('trends')}
              onNavigateInnovation={() => setActiveTab('innovation-explorer')}
            />
          )}
          {activeTab === 'innovation-explorer' && (
            <InnovationExplorer
              onNavigateToTrend={() => setActiveTab('trends')}
              onNavigateToConsumerJourney={() => setActiveTab('consumer-journey')}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
