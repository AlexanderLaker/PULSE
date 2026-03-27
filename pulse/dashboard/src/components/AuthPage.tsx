/**
 * PULSE War Room — Authentication Page
 * Login / Register with dark-mode, glassmorphism design.
 */
import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onRegister: (email: string, password: string, name: string, inviteCode: string) => Promise<unknown>;
  error: string | null;
  loading: boolean;
  onClearError: () => void;
}

export default function AuthPage({ onLogin, onRegister, error, loading, onClearError }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister(email, password, name, inviteCode);
      }
    } catch {
      // error is handled by useAuth hook
    }
  };

  const switchMode = () => {
    onClearError();
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: 24,
    }}>
      {/* Subtle grid pattern overlay */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.03,
        backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: '100%',
          maxWidth: 420,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 700, color: '#F8FAFC',
            letterSpacing: '-0.02em', margin: '0 0 4px',
          }}>
            PULSE
          </h1>
          <p style={{
            fontSize: 13, color: '#64748B', margin: 0, letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Profit Pool Simulation Engine
          </p>
        </div>

        {/* Auth Card */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.8)',
          backdropFilter: 'blur(20px)',
          borderRadius: 16,
          border: '1px solid rgba(71, 85, 105, 0.4)',
          padding: 32,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
        }}>
          {/* Mode Tabs */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 28,
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: 10, padding: 4,
          }}>
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { if (m !== mode) switchMode(); }}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                  borderRadius: 8, fontSize: 14, fontWeight: 500,
                  transition: 'all 0.2s',
                  background: mode === m ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: mode === m ? '#3B82F6' : '#64748B',
                  boxShadow: mode === m ? '0 1px 4px rgba(59, 130, 246, 0.1)' : 'none',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  key="name"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <label style={labelStyle}>Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Laker"
                    required
                    style={inputStyle}
                  />
                  <label style={labelStyle}>Invite Code</label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="PULSE-2026"
                    required
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@henkel.com"
              required
              autoComplete="email"
              style={inputStyle}
            />

            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={inputStyle}
            />

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#FCA5A5', fontSize: 13,
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px 0', border: 'none', borderRadius: 10,
                background: loading
                  ? 'rgba(59, 130, 246, 0.3)'
                  : 'linear-gradient(135deg, #3B82F6, #2563EB)',
                color: '#fff', fontSize: 15, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(59, 130, 246, 0.3)',
                marginTop: 4,
              }}
            >
              {loading
                ? 'Processing...'
                : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 12, color: '#475569',
        }}>
          Henkel Consumer Brands &middot; Strategy Intelligence Platform
        </p>
      </motion.div>
    </div>
  );
}

// ── Shared Styles ──────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#94A3B8',
  marginBottom: 6,
  marginTop: 16,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid rgba(71, 85, 105, 0.4)',
  background: 'rgba(15, 23, 42, 0.6)',
  color: '#F8FAFC',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
  marginBottom: 4,
};
