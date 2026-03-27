import { Suspense, lazy, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { FullPageSkeleton } from './components/LoadingSkeleton';
import { useAuth } from './hooks/useAuth';
import AuthPage from './components/AuthPage';
import AdminUsersPanel from './components/AdminUsersPanel';

const WarRoom = lazy(() => import('./components/WarRoom'));

export default function App() {
  const { user, loading, error, isAuthenticated, login, register, logout, clearError } = useAuth();
  const [showUsers, setShowUsers] = useState(false);

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
        <WarRoom />
      </Suspense>
      {/* Top-right user bar */}
      <div style={{
        position: 'fixed', top: 14, right: 16, zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: "'Inter', sans-serif",
      }}>
        {isAdmin && (
          <button
            onClick={() => setShowUsers(true)}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: '1px solid rgba(212, 168, 71, 0.3)',
              background: 'rgba(212, 168, 71, 0.1)',
              color: '#D4A847', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(212, 168, 71, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(212, 168, 71, 0.1)';
            }}
          >
            Users
          </button>
        )}
        <span style={{ fontSize: 12, color: '#64748B' }}>
          {user?.name}
          {isAdmin && (
            <span style={{
              marginLeft: 6, fontSize: 10, fontWeight: 600,
              color: '#D4A847', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Admin
            </span>
          )}
        </span>
        <button
          onClick={logout}
          style={{
            padding: '6px 14px', borderRadius: 8,
            border: '1px solid rgba(71, 85, 105, 0.4)',
            background: 'rgba(30, 41, 59, 0.8)',
            color: '#94A3B8', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            e.currentTarget.style.color = '#FCA5A5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.4)';
            e.currentTarget.style.color = '#94A3B8';
          }}
        >
          Sign Out
        </button>
      </div>
      {/* Admin users panel */}
      {isAdmin && (
        <AdminUsersPanel isOpen={showUsers} onClose={() => setShowUsers(false)} currentUserId={user?.id} />
      )}
    </ErrorBoundary>
  );
}
