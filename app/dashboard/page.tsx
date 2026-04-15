'use client';

/**
 * PRISM Dashboard Page
 *
 * Main entry point for the Profit Pool Shift Model.
 * Handles authentication, error boundaries, and component composition.
 * Tab navigation: Profit Pool Analysis | Trends | Consumer Journey | Innovation Explorer
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, BarChart3, TrendingUp, Users, Lightbulb } from 'lucide-react';
import ProfitPoolShiftModel from '@/components/dashboard/ProfitPoolShiftModel';
import InnovationExplorer from '@/components/dashboard/InnovationExplorer';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';
import { FullPageSkeleton } from '@/components/dashboard/LoadingSkeleton';

type DashboardTab = 'profit-pool' | 'trends' | 'consumer-journey' | 'innovation-explorer';

interface TabDef {
  id: DashboardTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: 'profit-pool', label: 'Profit Pool Analysis', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'trends', label: 'Trends', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'consumer-journey', label: 'Consumer Journey', icon: <Users className="w-4 h-4" /> },
  { id: 'innovation-explorer', label: 'Innovation Explorer', icon: <Lightbulb className="w-4 h-4" /> },
];

interface AuthCheck {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
  };
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

        // Redirect to login if not authenticated
        if (!data.authenticated) {
          router.push('/login');
        }
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

  // Show loading skeleton while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-primary">
        <FullPageSkeleton />
      </div>
    );
  }

  // Show error if not authenticated (shouldn't reach here due to redirect, but safety net)
  if (!authCheck?.authenticated) {
    return null; // Router will redirect
  }

  return (
    <div className="min-h-screen bg-surface-primary">
      {/* Top Navigation Bar — prime navigation, fully opaque so it never
          inherits colours from the tab content below it */}
      <nav className="sticky top-0 z-50 border-b border-border bg-surface-primary">
        <div className="px-6 py-3 flex items-center justify-between max-w-[1440px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <h1 className="text-lg font-semibold text-content-primary">PRISM</h1>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive
                      ? 'bg-content-primary text-white shadow-sm'
                      : 'text-content-secondary hover:bg-surface-tertiary hover:text-content-primary'
                    }
                  `}
                >
                  {tab.icon}
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-6">
            {/* User Info */}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-content-primary">
                {authCheck.user?.email || 'User'}
              </p>
              <p className="text-xs text-content-secondary">Connected</p>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-content-primary hover:bg-surface-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content — Tab-Switched */}
      <div className="relative">
        <ErrorBoundary>
          {activeTab === 'profit-pool' && <ProfitPoolShiftModel />}
          {activeTab === 'trends' && <ProfitPoolShiftModel />}
          {activeTab === 'consumer-journey' && <ProfitPoolShiftModel />}
          {activeTab === 'innovation-explorer' && (
            <InnovationExplorer
              onNavigateToTrend={(code) => {
                // Navigate to trends tab and filter by trend code
                setActiveTab('trends');
              }}
              onNavigateToConsumerJourney={(stage) => {
                // Navigate to consumer journey tab
                setActiveTab('consumer-journey');
              }}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
