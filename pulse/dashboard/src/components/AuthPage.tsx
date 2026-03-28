/**
 * PULSE War Room — Authentication Page
 * Supports: Sign In, Register, Forgot Password (email-based via Resend),
 * and Reset Password (via token from email link).
 */
import { useState, useEffect, type FormEvent } from 'react';
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
  green:    '#34C759',
  red:      '#FF453A',
  redDim:   'rgba(255,69,58,0.06)',
  greenDim: 'rgba(52,199,89,0.06)',
  text:     '#1D1D1F',
  text2:    '#6E6E73',
  text3:    '#999999',
  sans:     "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
  mono:     "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
};

type PageMode = 'login' | 'register' | 'forgot' | 'reset-token';

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onRegister: (email: string, password: string, name: string, inviteCode: string) => Promise<unknown>;
  error: string | null;
  loading: boolean;
  onClearError: () => void;
}

export default function AuthPage({ onLogin, onRegister, error, loading, onClearError }: AuthPageProps) {
  const [mode, setMode] = useState<PageMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  // Check for #reset=TOKEN in URL on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#reset=')) {
      const token = hash.replace('#reset=', '');
      if (token) {
        setResetToken(token);
        setMode('reset-token');
        // Clean up hash
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else if (mode === 'register') {
        await onRegister(email, password, name, inviteCode);
      }
    } catch {
      // error is handled by useAuth hook
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLocalLoading(true);
    setLocalError(null);
    setLocalSuccess(null);

    try {
      const res = await fetch('/api/v1/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setLocalSuccess('Check your email — a password reset link has been sent.');
      } else {
        const data = await res.json().catch(() => ({}));
        setLocalError(data.detail || 'Something went wrong. Please try again.');
      }
    } catch {
      setLocalError('Unable to reach server. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleResetWithToken = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    setLocalLoading(true);
    setLocalError(null);
    setLocalSuccess(null);

    try {
      const res = await fetch('/api/v1/auth/confirm-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, new_password: newPassword }),
      });
      if (res.ok) {
        setLocalSuccess('Password updated! You can now sign in.');
        setTimeout(() => {
          setMode('login');
          setLocalSuccess(null);
          setResetToken('');
          setNewPassword('');
          setConfirmPassword('');
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setLocalError(data.detail || 'Reset failed. The link may have expired.');
      }
    } catch {
      setLocalError('Unable to reach server. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  const switchMode = (newMode: PageMode) => {
    onClearError();
    setLocalError(null);
    setLocalSuccess(null);
    setMode(newMode);
  };

  const displayError = localError || error;
  const isLoading = localLoading || loading;

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

          {/* ─── FORGOT PASSWORD MODE ─── */}
          {mode === 'forgot' && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: T.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                Reset Password
              </h2>
              <p style={{ fontSize: 13, color: T.text2, margin: '0 0 20px', lineHeight: 1.5 }}>
                Enter your email and we'll send you a link to set a new password.
              </p>
              <form onSubmit={handleForgotPassword}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                  style={inputStyle}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />

                <MessageBanner type="error" message={localError} />
                <MessageBanner type="success" message={localSuccess} />

                <button type="submit" disabled={isLoading} style={submitStyle(isLoading)}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={linkBtnStyle}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}

          {/* ─── RESET WITH TOKEN MODE (from email link) ─── */}
          {mode === 'reset-token' && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: T.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                Set New Password
              </h2>
              <p style={{ fontSize: 13, color: T.text2, margin: '0 0 20px', lineHeight: 1.5 }}>
                Choose a new password for your account.
              </p>
              <form onSubmit={handleResetWithToken}>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={inputStyle}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={inputStyle}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />

                <MessageBanner type="error" message={localError} />
                <MessageBanner type="success" message={localSuccess} />

                <button type="submit" disabled={isLoading} style={submitStyle(isLoading)}>
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </>
          )}

          {/* ─── LOGIN / REGISTER MODE ─── */}
          {(mode === 'login' || mode === 'register') && (
            <>
              {/* Mode Tabs */}
              <div style={{
                display: 'flex', gap: 4, marginBottom: 24,
                background: T.bg1,
                borderRadius: 10, padding: 3,
              }}>
                {(['login', 'register'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { if (m !== mode) switchMode(m); }}
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
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                      />
                      <label style={labelStyle}>Invite Code</label>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="Enter invite code"
                        required
                        style={inputStyle}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
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
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
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
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />

                {/* Error */}
                <AnimatePresence>
                  {displayError && (
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
                      {displayError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Forgot Password link (login only) */}
                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      style={linkBtnStyle}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button type="submit" disabled={isLoading} style={submitStyle(isLoading)}>
                  {isLoading
                    ? 'Processing...'
                    : mode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* spacer */}
        <div style={{ height: 20 }} />
      </motion.div>
    </div>
  );
}

// ── Message Banner ────────────────────────────────────────────────
function MessageBanner({ type, message }: { type: 'error' | 'success'; message: string | null }) {
  if (!message) return null;
  const isErr = type === 'error';
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '10px 14px', borderRadius: 10, marginTop: 12, marginBottom: 4,
        background: isErr ? T.redDim : T.greenDim,
        border: `1px solid ${isErr ? 'rgba(255,69,58,0.15)' : 'rgba(52,199,89,0.15)'}`,
        color: isErr ? '#CC3730' : '#1B7A3D',
        fontSize: 13, fontWeight: 500,
      }}
    >
      {message}
    </motion.div>
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

const linkBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: T.accent,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
  letterSpacing: '-0.01em',
  fontFamily: T.sans,
};

function submitStyle(isLoading: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '12px 0', border: 'none', borderRadius: 10,
    background: isLoading ? 'rgba(0, 113, 227, 0.4)' : T.accent,
    color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: isLoading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    boxShadow: isLoading ? 'none' : '0 2px 8px rgba(0, 113, 227, 0.2)',
    marginTop: 16,
    letterSpacing: '-0.01em',
    fontFamily: T.sans,
  };
}

function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = T.accent;
  e.target.style.boxShadow = `0 0 0 3px rgba(0, 113, 227, 0.1)`;
}
function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'rgba(0,0,0,0.12)';
  e.target.style.boxShadow = 'none';
}
