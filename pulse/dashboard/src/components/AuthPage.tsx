/**
 * PRISM Profit Pool Shift Model — Authentication Page
 * Professional auth flow: Sign In, Register, Forgot Password (email-based via Resend),
 * and Reset Password (via token from email link).
 */
import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Design tokens ─────────────────────────────────────────────── */
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
};

type PageMode = 'login' | 'register' | 'forgot' | 'reset-token';

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onRegister: (email: string, password: string, name: string, inviteCode: string) => Promise<unknown>;
  error: string | null;
  loading: boolean;
  onClearError: () => void;
}

/* ── Eye icon SVGs ───────────────────────────────────────────── */
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="9 12 11.5 14.5 16 10"/>
  </svg>
);

const MailIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0071E3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <polyline points="22,4 12,13 2,4"/>
  </svg>
);

export default function AuthPage({ onLogin, onRegister, error, loading, onClearError }: AuthPageProps) {
  const [mode, setMode] = useState<PageMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);

  // Check for #reset=TOKEN in URL on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#reset=')) {
      const token = hash.replace('#reset=', '');
      if (token) {
        setResetToken(token);
        setMode('reset-token');
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
        const data = await res.json().catch(() => ({}));
        if (data.reset_token) {
          // Email sending failed but we got a direct token (pre-production fallback)
          // Set the token and navigate directly to the reset form
          setResetToken(data.reset_token);
          setLocalError(null);
          setMode('reset-token');
        } else {
          setEmailSent(true);
        }
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
        setPasswordReset(true);
        setTimeout(() => {
          setMode('login');
          setPasswordReset(false);
          setResetToken('');
          setNewPassword('');
          setConfirmPassword('');
        }, 3000);
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
    setEmailSent(false);
    setPasswordReset(false);
    setMode(newMode);
  };

  const displayError = localError || error;
  const isLoading = localLoading || loading;

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${T.bg1} 0%, #E8ECF4 100%)`,
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
        style={{ width: '100%', maxWidth: 400 }}
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
            PRISM
          </h1>
          <p style={{
            fontSize: 12, color: T.text3, margin: 0, letterSpacing: '0.06em',
            textTransform: 'uppercase', fontWeight: 500,
          }}>
            Profit Pool Risk & Intelligence Simulation Model
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
          <AnimatePresence mode="wait">

            {/* ─── FORGOT PASSWORD — Email Sent Success ─── */}
            {mode === 'forgot' && emailSent && (
              <motion.div
                key="email-sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{ textAlign: 'center', padding: '20px 0' }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                >
                  <MailIcon />
                </motion.div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: T.text, margin: '20px 0 8px', letterSpacing: '-0.02em' }}>
                  Check your email
                </h2>
                <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.6, margin: '0 0 8px' }}>
                  We sent a password reset link to
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: '0 0 24px' }}>
                  {email}
                </p>
                <p style={{ fontSize: 12, color: T.text3, lineHeight: 1.5, margin: '0 0 20px' }}>
                  Click the link in the email to reset your password. The link expires in 1 hour.
                </p>
                <button
                  type="button"
                  onClick={() => { setEmailSent(false); }}
                  style={{ ...linkBtnStyle, fontSize: 13, marginBottom: 8, display: 'block', margin: '0 auto 8px' }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                >
                  Didn't receive it? Send again
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{ ...linkBtnStyle, color: T.text3, fontSize: 12, display: 'block', margin: '0 auto' }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                >
                  Back to Sign In
                </button>
              </motion.div>
            )}

            {/* ─── FORGOT PASSWORD — Email Input ─── */}
            {mode === 'forgot' && !emailSent && (
              <motion.div key="forgot-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: T.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                  Reset your password
                </h2>
                <p style={{ fontSize: 13, color: T.text2, margin: '0 0 20px', lineHeight: 1.5 }}>
                  Enter the email address associated with your account and we'll send you a link to reset your password.
                </p>
                <form onSubmit={handleForgotPassword}>
                  <label style={labelStyle}>Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                    autoFocus
                    style={inputStyle}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  />

                  {localError && <ErrorBanner message={localError} />}

                  <button type="submit" disabled={isLoading || !email} style={submitStyle(isLoading || !email)}>
                    {isLoading ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Spinner /> Sending...
                      </span>
                    ) : 'Send Reset Link'}
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
              </motion.div>
            )}

            {/* ─── RESET WITH TOKEN — Success ─── */}
            {mode === 'reset-token' && passwordReset && (
              <motion.div
                key="reset-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{ textAlign: 'center', padding: '20px 0' }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                >
                  <CheckCircleIcon />
                </motion.div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: T.text, margin: '20px 0 8px', letterSpacing: '-0.02em' }}>
                  Password updated
                </h2>
                <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.6, margin: 0 }}>
                  Your password has been reset successfully. Redirecting you to sign in...
                </p>
              </motion.div>
            )}

            {/* ─── RESET WITH TOKEN — Form ─── */}
            {mode === 'reset-token' && !passwordReset && (
              <motion.div key="reset-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: T.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                  Set new password
                </h2>
                <p style={{ fontSize: 13, color: T.text2, margin: '0 0 20px', lineHeight: 1.5 }}>
                  Your new password must be at least 6 characters long.
                </p>
                <form onSubmit={handleResetWithToken}>
                  <label style={labelStyle}>New password</label>
                  <PasswordInput
                    value={newPassword}
                    onChange={setNewPassword}
                    show={showNewPassword}
                    onToggle={() => setShowNewPassword(!showNewPassword)}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    autoFocus
                  />

                  <label style={labelStyle}>Confirm password</label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    show={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />

                  {/* Password match indicator */}
                  {confirmPassword && (
                    <div style={{
                      fontSize: 12, marginTop: 6, fontWeight: 500,
                      color: newPassword === confirmPassword ? T.green : T.red,
                    }}>
                      {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </div>
                  )}

                  {localError && <ErrorBanner message={localError} />}

                  <button
                    type="submit"
                    disabled={isLoading || newPassword.length < 6 || newPassword !== confirmPassword}
                    style={submitStyle(isLoading || newPassword.length < 6 || newPassword !== confirmPassword)}
                  >
                    {isLoading ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Spinner /> Updating...
                      </span>
                    ) : 'Reset Password'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ─── LOGIN / REGISTER ─── */}
            {(mode === 'login' || mode === 'register') && (
              <motion.div key="auth-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Mode Tabs */}
                <div style={{
                  display: 'flex', gap: 4, marginBottom: 24,
                  background: T.bg1, borderRadius: 10, padding: 3,
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
                        fontFamily: T.sans,
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
                          placeholder="Your full name"
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
                          placeholder="PRISM-2026"
                          required
                          style={inputStyle}
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <label style={labelStyle}>Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                    style={inputStyle}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  />

                  <label style={labelStyle}>Password</label>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    onToggle={() => setShowPassword(!showPassword)}
                    placeholder="Enter password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />

                  {/* Error */}
                  {displayError && <ErrorBanner message={displayError} />}

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
                    {isLoading ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Spinner /> Processing...
                      </span>
                    ) : mode === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <div style={{ height: 20 }} />
      </motion.div>
    </div>
  );
}

// ── Password Input with visibility toggle ─────────────────────────
function PasswordInput({
  value, onChange, show, onToggle, placeholder, autoComplete, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        minLength={6}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        style={{ ...inputStyle, paddingRight: 44 }}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#999',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

// ── Error Banner ──────────────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '10px 14px', borderRadius: 10, marginTop: 12, marginBottom: 4,
        background: 'rgba(255,69,58,0.06)',
        border: '1px solid rgba(255,69,58,0.15)',
        color: '#CC3730', fontSize: 13, fontWeight: 500,
      }}
    >
      {message}
    </motion.div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

// ── Shared Styles ─────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#6E6E73',
  marginBottom: 6,
  marginTop: 14,
  letterSpacing: '-0.01em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.12)',
  background: '#F5F5F7',
  color: '#1D1D1F',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
  marginBottom: 2,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#0071E3',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
  letterSpacing: '-0.01em',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
};

function submitStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '12px 0', border: 'none', borderRadius: 10,
    background: disabled ? 'rgba(0, 113, 227, 0.35)' : '#0071E3',
    color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    boxShadow: disabled ? 'none' : '0 2px 8px rgba(0, 113, 227, 0.2)',
    marginTop: 16,
    letterSpacing: '-0.01em',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  };
}

function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = '#0071E3';
  e.target.style.boxShadow = '0 0 0 3px rgba(0, 113, 227, 0.1)';
}
function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'rgba(0,0,0,0.12)';
  e.target.style.boxShadow = 'none';
}
