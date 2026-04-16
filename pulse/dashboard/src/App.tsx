import { Suspense, lazy, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { FullPageSkeleton } from './components/LoadingSkeleton';
import { useAuth } from './hooks/useAuth';
import AuthPage from './components/AuthPage';
import AdminUsersPanel from './components/AdminUsersPanel';
import SettingsPage from './components/SettingsPage';
import BurgerMenu from './components/BurgerMenu';

const ProfitPoolShiftModel = lazy(() => import('./components/ProfitPoolShiftModel'));
const ConsumerJourney = lazy(() => import('./components/ConsumerJourney'));
const InnovationExplorer = lazy(() => import('./components/InnovationExplorer'));

type Page = 'profitpoolshiftmodel' | 'settings' | 'journey' | 'innovation';

export default function App() {
  const { user, loading, error, isAuthenticated, login, register, logout, clearError } = useAuth();
  const [showUsers, setShowUsers] = useState(false);
  const [page, setPage] = useState<Page>('profitpoolshiftmodel');
  const [trendSearch, setTrendSearch] = useState<string | undefined>(undefined);

  // Still checking stored token
  if (loading && !user) {
    return <FullPageSkeleton />;
  }

  // Not authenticated → show login/register
  if (!isAuthenticated) {
    return (
      <AuthPage
        onLogin={login}
        onRegister={register}
        error={error}
        loading={loading}
        onClearError={clearError}
      />
    );
  }

  const isAdmin = user?.role === 'admin';

  // Settings page — full screen, no burger menu overlay
  if (page === 'settings' && isAdmin) {
    return (
      <ErrorBoundary>
        <SettingsPage onBack={() => setPage('profitpoolshiftmodel')} />
      </ErrorBoundary>
    );
  }

  // Consumer Journey page — full screen with own back navigation
  if (page === 'journey') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<FullPageSkeleton />}>
          <ConsumerJourney
            onBack={() => { setTrendSearch(undefined); setPage('profitpoolshiftmodel'); }}
            onNavigateProfitPoolShiftModel={() => { setTrendSearch(undefined); setPage('profitpoolshiftmodel'); }}
            onNavigateTrends={() => { setTrendSearch(undefined); setPage('profitpoolshiftmodel'); }}
            onNavigateToTrend={(search) => { setTrendSearch(search); setPage('profitpoolshiftmodel'); }}
            onNavigateInnovation={() => setPage('innovation')}
            isAdmin={isAdmin}
          />
        </Suspense>
        {/* Burger Menu — top-right */}
        <div style={{
          position: 'fixed', top: 12, left: 16, zIndex: 9999,
          fontFamily: "'Inter', sans-serif",
        }}>
          <BurgerMenu
            user={user}
            isAdmin={isAdmin}
            onLogout={logout}
            onShowUsers={() => setShowUsers(true)}
            onShowConfig={() => setPage('settings')}
            onShowExport={() => {
              setTrendSearch(undefined);
              setPage('profitpoolshiftmodel');
              setTimeout(() => window.dispatchEvent(new CustomEvent('pulse:toggle-export')), 100);
            }}
            onShowDelphi={() => {
              setTrendSearch(undefined);
              setPage('profitpoolshiftmodel');
              setTimeout(() => window.dispatchEvent(new CustomEvent('pulse:toggle-delphi')), 100);
            }}
            onShowSnapshots={() => {
              setTrendSearch(undefined);
              setPage('profitpoolshiftmodel');
              setTimeout(() => window.dispatchEvent(new CustomEvent('pulse:toggle-snapshots')), 100);
            }}
            onChangePassword={() => {
              const newPw = window.prompt('Enter new password (min 6 characters):');
              if (newPw && newPw.length >= 6) {
                const token = localStorage.getItem('pulse_token');
                fetch('/api/v1/auth/change-password', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ new_password: newPw }),
                })
                  .then(r => r.ok ? alert('Password changed successfully.') : alert('Failed to change password.'))
                  .catch(() => alert('Failed to change password.'));
              } else if (newPw !== null) {
                alert('Password must be at least 6 characters.');
              }
            }}
          />
        </div>
        {isAdmin && (
          <AdminUsersPanel isOpen={showUsers} onClose={() => setShowUsers(false)} currentUserId={user?.id} />
        )}
      </ErrorBoundary>
    );
  }

  // Innovation Explorer page — full screen with own back navigation
  if (page === 'innovation') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<FullPageSkeleton />}>
          <InnovationExplorer
            onNavigateToTrend={(search: string) => { setTrendSearch(search); setPage('profitpoolshiftmodel'); }}
            onNavigateToConsumerJourney={() => setPage('journey')}
            onNavigateProfitPoolShiftModel={() => { setTrendSearch(undefined); setPage('profitpoolshiftmodel'); }}
            onNavigateTrends={() => { setTrendSearch(undefined); setPage('profitpoolshiftmodel'); }}
          />
        </Suspense>
        {/* Burger Menu */}
        <div style={{
          position: 'fixed', top: 12, left: 16, zIndex: 9999,
          fontFamily: "'Inter', sans-serif",
        }}>
          <BurgerMenu
            user={user}
            isAdmin={isAdmin}
            onLogout={logout}
            onShowUsers={() => setShowUsers(true)}
            onShowConfig={() => setPage('settings')}
            onShowExport={() => {
              setTrendSearch(undefined);
              setPage('profitpoolshiftmodel');
              setTimeout(() => window.dispatchEvent(new CustomEvent('pulse:toggle-export')), 100);
            }}
            onShowDelphi={() => {
              setTrendSearch(undefined);
              setPage('profitpoolshiftmodel');
              setTimeout(() => window.dispatchEvent(new CustomEvent('pulse:toggle-delphi')), 100);
            }}
            onShowSnapshots={() => {
              setTrendSearch(undefined);
              setPage('profitpoolshiftmodel');
              setTimeout(() => window.dispatchEvent(new CustomEvent('pulse:toggle-snapshots')), 100);
            }}
            onChangePassword={() => {
              const newPw = window.prompt('Enter new password (min 6 characters):');
              if (newPw && newPw.length >= 6) {
                const token = localStorage.getItem('pulse_token');
                fetch('/api/v1/auth/change-password', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ new_password: newPw }),
                })
                  .then(r => r.ok ? alert('Password changed successfully.') : alert('Failed to change password.'))
                  .catch(() => alert('Failed to change password.'));
              } else if (newPw !== null) {
                alert('Password must be at least 6 characters.');
              }
            }}
          />
        </div>
        {isAdmin && (
          <AdminUsersPanel isOpen={showUsers} onClose={() => setShowUsers(false)} currentUserId={user?.id} />
        )}
      </ErrorBoundary>
    );
  }

  // Authenticated → show Profit Pool Shift Model
  return (
    <ErrorBoundary>
      <Suspense fallback={<FullPageSkeleton />}>
        <ProfitPoolShiftModel isAdmin={isAdmin} onNavigateJourney={() => setPage('journey')} onNavigateInnovation={() => setPage('innovation')} initialTrendSearch={trendSearch} />
      </Suspense>

      {/* Burger Menu — top-left */}
      <div style={{
        position: 'fixed', top: 12, left: 16, zIndex: 9999,
        fontFamily: "'Inter', sans-serif",
      }}>
        <BurgerMenu
          user={user}
          isAdmin={isAdmin}
          onLogout={logout}
          onShowUsers={() => setShowUsers(true)}
          onShowConfig={() => setPage('settings')}
          onShowExport={() => {
            window.dispatchEvent(new CustomEvent('pulse:toggle-export'));
          }}
          onShowDelphi={() => {
            window.dispatchEvent(new CustomEvent('pulse:toggle-delphi'));
          }}
          onShowSnapshots={() => {
            window.dispatchEvent(new CustomEvent('pulse:toggle-snapshots'));
          }}
          onChangePassword={() => {
            const newPw = window.prompt('Enter new password (min 6 characters):');
            if (newPw && newPw.length >= 6) {
              const token = localStorage.getItem('pulse_token');
              fetch('/api/v1/auth/change-password', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ new_password: newPw }),
              })
                .then(r => r.ok ? alert('Password changed successfully.') : alert('Failed to change password.'))
                .catch(() => alert('Failed to change password.'));
            } else if (newPw !== null) {
              alert('Password must be at least 6 characters.');
            }
          }}
        />
      </div>

      {/* Admin user management panel */}
      {isAdmin && (
        <AdminUsersPanel isOpen={showUsers} onClose={() => setShowUsers(false)} currentUserId={user?.id} />
      )}
    </ErrorBoundary>
  );
}
