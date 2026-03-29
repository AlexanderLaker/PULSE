import { Suspense, lazy, useState, useCallback } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { FullPageSkeleton } from './components/LoadingSkeleton';
import { useAuth } from './hooks/useAuth';
import AuthPage from './components/AuthPage';
import AdminUsersPanel from './components/AdminUsersPanel';
import AdminConfigPanel from './components/AdminConfigPanel';
import BurgerMenu from './components/BurgerMenu';

const WarRoom = lazy(() => import('./components/WarRoom'));

export default function App() {
  const { user, loading, error, isAuthenticated, login, register, logout, clearError } = useAuth();
  const [showUsers, setShowUsers] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Refs for WarRoom actions exposed via burger menu
  const [burgerExport, setBurgerExport] = useState(false);
  const [burgerDelphi, setBurgerDelphi] = useState(false);
  const [burgerSnapshots, setBurgerSnapshots] = useState(false);

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

  // Authenticated → show War Room
  return (
    <ErrorBoundary>
      <Suspense fallback={<FullPageSkeleton />}>
        <WarRoom isAdmin={isAdmin} />
      </Suspense>

      {/* Burger Menu — top-right, replaces old floating user bar */}
      <div style={{
        position: 'fixed', top: 12, right: 16, zIndex: 9999,
        fontFamily: "'Inter', sans-serif",
      }}>
        <BurgerMenu
          user={user}
          isAdmin={isAdmin}
          onLogout={logout}
          onShowUsers={() => setShowUsers(true)}
          onShowConfig={() => setShowConfig(true)}
          onShowExport={() => {
            // Toggle the export panel inside WarRoom — dispatch custom event
            window.dispatchEvent(new CustomEvent('pulse:toggle-export'));
          }}
          onShowDelphi={() => {
            window.dispatchEvent(new CustomEvent('pulse:toggle-delphi'));
          }}
          onShowSnapshots={() => {
            window.dispatchEvent(new CustomEvent('pulse:toggle-snapshots'));
          }}
          onChangePassword={() => {
            // Simple password change via prompt for now
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

      {/* Admin panels */}
      {isAdmin && (
        <>
          <AdminUsersPanel isOpen={showUsers} onClose={() => setShowUsers(false)} currentUserId={user?.id} />
          <AdminConfigPanel isOpen={showConfig} onClose={() => setShowConfig(false)} />
        </>
      )}
    </ErrorBoundary>
  );
}
