'use client';

/**
 * PRISM Dashboard Page
 *
 * Main entry point for the Profit Pool Shift Model.
 * Handles authentication, error boundaries, and component composition.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import ProfitPoolShiftModel from '@/components/dashboard/ProfitPoolShiftModel';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';
import { FullPageSkeleton } from '@/components/dashboard/LoadingSkeleton';

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
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-40 border-b border-border bg-surface-primary/95 backdrop-blur supports-[backdrop-filter]:bg-surface-primary/60">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <h1 className="text-lg font-semibold text-content-primary">PRISM Profit Pool Shift Model</h1>
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

      {/* Main Content */}
      <div className="relative">
        <ErrorBoundary>
          <ProfitPoolShiftModel />
        </ErrorBoundary>
      </div>
    </div>
  );
}
