/**
 * PULSE War Room — Authentication Page
 * White / slate design matching the main War Room aesthetic.
 */
import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Design tokens (mirrored from lib/format.ts) ─────────────── */
const T = {
  bg:       '#FFFFFF',
  bg1:      '#F5F5F7',
  bg2:      '#FBFBFD',
  border:   'rgba(0,0,0,0.06)',
  border2:  'rgba(0,0,0,0.12)',
  accent:   '#0071E3',
  purple:   '#7B61FF',
  red:      '#FF453A',
  redDim:   'rgba(255,69,58,0.06)',
  text:     '#1D1D1F',
  text2:    '#6E6E73',
  text3:    '#999999',
  sans:     "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
  mono:     "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
};

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
      background: T.bg1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: T.sans,
      padding: 24,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: '100%',
          maxWidth: 400,
          position: 'relative',
        }}
      >
        {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 4px 20px rgba(0, 113, 227, 0.2)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: T.text,
            letterSpacing: '-0.025em', margin: '0 0 4px',
          }}>
            PULSE
          </h1>
          <p style={{
            fontSize: 12, color: T.text3, margin: 0, letterSpacing: '0.06em',
            textTransform: 'uppercase', fontWeight: 500,
          }}>
            Profit Pool Simulation Engine
          </p>
        </div>

        {/* Auth Card */}
        <div style={{
          background: T.bg,
          borderRadius: 16,
          border: `1px solid ${T.border2}`,
          padding: '28px 28px 24px',
          boxShadow: '0 2px 20px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.02)',
        }}>
          {/* Mode Tabs */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 24,
            background: T.bg1,
            borderRadius: 10, padding: 3,
          }}>
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { if (m !== mode) switchMode(); }}
                style={{
                  flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer',
                  borderRadius: 8, fontSize: 13, fontWeight: 600,
                  transition: 'all 0.2s',
                  background: mode === m ? T.bg : 'transparent',
                  color: mode === m ? T.text : T.text3,
                  boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  letterSpacing: '-0.01em',
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
                  key="register-fields"
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
                    placeholder="Enter name"
                    required
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                  <label style={labelStyle}>Invite Code</label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Enter invite code"
                    required
                    style={{ ...inputStyle, fontFamily: T.mono, letterSpacing: '0.04em' }}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
              required
              autoComplete="email"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
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
              onFocus={handleFocus}
              onBlur={handleBlur}
            />

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    padding: '10px 14px', borderRadius: 10, marginTop: 12, marginBottom: 4,
                    background: T.redDim,
                    border: `1px solid rgba(255, 69, 58, 0.15)`,
                    color: '#CC3730', fontSize: 13, fontWeight: 500,
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
                  ? 'rgba(0, 113, 227, 0.4)'
                  : T.accent,
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 2px 8px rgba(0, 113, 227, 0.2)',
                marginTop: 16,
                letterSpacing: '-0.01em',
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
          fontSize: 11, color: T.text3, fontWeight: 500,
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
  fontSize: 12,
  fontWeight: 600,
  color: T.text2,
  marginBottom: 6,
  marginTop: 14,
  letterSpacing: '-0.01em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: `1px solid ${T.border2}`,
  background: T.bg1,
  color: T.text,
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
  marginBottom: 2,
  fontFamily: T.sans,
};

/* Focus handler: blue ring on focus */
function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = T.accent;
  e.target.style.boxShadow = `0 0 0 3px rgba(0, 113, 227, 0.1)`;
}
function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'rgba(0,0,0,0.12)';
  e.target.style.boxShadow = 'none';
}
