/**
 * SettingsModal — Editorial-style settings drawer for PRISM.
 *
 * Replaces the legacy export-only SettingsPanel. Opened from the gear icon
 * in the top nav. Six sections organized in a left-rail / content layout:
 *
 *   Account (everyone):
 *     • Profile      — email, display name, role badge
 *     • Password     — change password via Clerk
 *     • Sessions     — active sessions + sign out everywhere
 *     • Session Info — JWT refresh status, current token lifetime
 *
 *   Admin only:
 *     • Config Sheet — model configuration variables (admin-editable)
 *     • User Management — list users, edit roles
 *
 * Design language mirrors Trends2 / ConsumerJourney2 / ProfitPoolAnalysis2
 * ("Digital Curator" editorial style — Maritime blue tonal palette, Manrope
 * headlines, pill-shaped chips, rounded section cards). See Trends2.tsx for
 * the reference tokens.
 *
 * Auth model:
 *   Identity / password / sessions live in Clerk (`useUser`, `useClerk`,
 *   `useSessionList`). Authorization (admin vs viewer) is read from our own
 *   /api/me endpoint (which reads user_roles in Neon Postgres).
 */

'use client';

import React, {
  FC, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, KeyRound, Monitor, SlidersHorizontal, Users as UsersIcon,
  ShieldCheck, Check, AlertCircle, LogOut,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useUser, useClerk, useSessionList, useSession,
} from '@clerk/nextjs';
import { S, HEADLINE_FONT, BODY_FONT, MONO_FONT } from '@/lib/theme';
import { fmtDate, fmtDateTime } from '@/lib/format';
import useOverlay from '@/hooks/useOverlay';

// ─── Section nav definition ─────────────────────────────────────────
type SectionId =
  | 'profile'
  | 'password'
  | 'sessions'
  | 'config'
  | 'users';

interface SectionDef {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  group: 'account' | 'admin';
}

const SECTIONS: SectionDef[] = [
  { id: 'profile',       label: 'Profile',          icon: User,             group: 'account' },
  { id: 'password',      label: 'Password',         icon: KeyRound,         group: 'account' },
  { id: 'sessions',      label: 'Active sessions',  icon: Monitor,          group: 'account' },
  { id: 'config',        label: 'Config sheet',     icon: SlidersHorizontal, group: 'admin' },
  { id: 'users',         label: 'User management',  icon: UsersIcon,        group: 'admin', adminOnly: true },
];

// ─── SectionCard — reused from Trends2 pattern ──────────────────────
interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  accent?: string;
  description?: string;
  children: React.ReactNode;
  footnote?: React.ReactNode;
}
const SectionCard: FC<SectionCardProps> = ({
  title, icon: Icon, accent, description, children, footnote,
}) => (
  <div style={{
    backgroundColor: S.surface,
    border: `1px solid ${S.cardBorder}`,
    borderRadius: 14,
    padding: '18px 20px 20px',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
    }}>
      <span style={{
        width: 30, height: 30, borderRadius: 9,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: S.surfaceLow,
        color: accent ?? S.primary,
      }}>
        <Icon size={16} strokeWidth={2.25} />
      </span>
      <div style={{
        fontFamily: HEADLINE_FONT,
        fontSize: 13, fontWeight: 800, letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: S.onSurface,
      }}>
        {title}
      </div>
    </div>
    {description && (
      <div style={{
        marginBottom: 14, fontSize: 12.5, lineHeight: 1.55, color: S.mutedText,
      }}>
        {description}
      </div>
    )}
    {children}
    {footnote && (
      <div style={{
        marginTop: 12, fontSize: 11, lineHeight: 1.55, color: S.mutedText,
      }}>
        {footnote}
      </div>
    )}
  </div>
);

// ─── Role pill ─────────────────────────────────────────────────────
const RolePill: FC<{ role: 'admin' | 'viewer' | 'unknown' }> = ({ role }) => {
  const isAdmin = role === 'admin';
  const isUnknown = role === 'unknown';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase"
      style={{
        backgroundColor: isUnknown
          ? S.surfaceHigh
          : (isAdmin ? S.primaryContainer : S.secondaryContainer),
        color: isUnknown
          ? S.mutedText
          : (isAdmin ? S.onPrimaryContainer : S.onSecondaryContainer),
      }}
    >
      {isAdmin && <ShieldCheck size={11} strokeWidth={2.5} />}
      {role}
    </span>
  );
};

// ─── Field row (label + input) — editorial styling ─────────────────
interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}
const Field: FC<FieldProps> = ({ label, hint, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={{
      fontFamily: HEADLINE_FONT,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: S.onSurfaceVariant,
    }}>
      {label}
    </span>
    {children}
    {hint && (
      <span style={{ fontSize: 11, color: S.mutedText }}>{hint}</span>
    )}
  </label>
);

const INPUT_STYLE: React.CSSProperties = {
  fontFamily: BODY_FONT,
  fontSize: 13.5,
  color: S.onSurface,
  backgroundColor: S.surfaceLow,
  border: `1px solid ${S.cardBorder}`,
  borderRadius: 10,
  padding: '9px 12px',
  // R-14: no `outline: 'none'` here — the global input:focus ring and the
  // :focus-visible outline (globals.css) provide the visible focus
  // indicator, which the inline override used to suppress (fully so on
  // <select>, which the input:focus ring doesn't cover).
  transition: 'border-color 0.15s, background-color 0.15s',
};

const READONLY_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  backgroundColor: S.surfaceContainer,
  color: S.mutedText,
  cursor: 'not-allowed',
};

// ─── Locale-proof numeric field (R-11, design review 2026-07-01) ────
// CAUSE of the "0,001 / 0,3 / 0,05 next to 10000" finding: these fields
// were `<input type="number">`, whose DISPLAYED value is formatted by the
// browser in the OS/browser locale — a German locale renders the JSON
// number 0.001 as "0,001" while integers get no separator at all. The
// stored config values were always plain JSON numbers. Typing a comma in
// a point-locale browser (or clearing the field) also made
// `e.target.value` return "" → parseFloat → NaN entered the draft and
// serialized to `null` in the PUT /api/config payload.
//
// Convention now: canonical decimal-POINT display ("0.001", "0.3");
// editable integers stay plain ("10000") so they parse back; comma AND
// point are accepted on entry; only finite numbers are committed to the
// draft, so the PUT body always carries valid JSON numbers.
const parseDecimal = (raw: string): number =>
  parseFloat(raw.trim().replace(/\s+/g, '').replace(',', '.'));
/** Integers: strip grouping separators — "10,000" / "10.000" / "10 000" → 10000. */
const parseInteger = (raw: string): number =>
  parseInt(raw.replace(/[.,\s]/g, ''), 10);

/** Trim float noise for display: 0.08333333333333333 → "0.083333". */
const fmtShortNumber = (v: number): string => String(parseFloat(v.toFixed(6)));

interface NumberFieldProps {
  value: number;
  onCommit: (v: number) => void;
  integer?: boolean;
  readOnly?: boolean;
  inputStyle: React.CSSProperties;
  /** Display formatter (default String). Parsing/committing stays exact. */
  format?: (v: number) => string;
}
const NumberField: FC<NumberFieldProps> = ({
  value, onCommit, integer, readOnly, inputStyle, format,
}) => {
  const fmt = format ?? String;
  const [text, setText] = useState(() => fmt(value));
  const parse = integer ? parseInteger : parseDecimal;
  // Resync when the draft changes elsewhere (load / discard) without
  // clobbering in-progress typing that already parses to `value`.
  useEffect(() => {
    setText((t) => (parse(t) === value || fmt(parse(t)) === fmt(value) ? t : fmt(value)));
  }, [value, parse, fmt]);
  return (
    <input
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const parsed = parse(raw);
        if (Number.isFinite(parsed)) onCommit(parsed);
      }}
      onBlur={() => setText(fmt(value))}
      disabled={readOnly}
      readOnly={readOnly}
      style={inputStyle}
    />
  );
};

const PRIMARY_BUTTON: React.CSSProperties = {
  fontFamily: HEADLINE_FONT,
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.02em',
  color: '#ffffff',
  backgroundColor: S.primary,
  border: 'none',
  borderRadius: 999,
  padding: '9px 18px',
  cursor: 'pointer',
  transition: 'background-color 0.15s, opacity 0.15s',
};

const SECONDARY_BUTTON: React.CSSProperties = {
  fontFamily: HEADLINE_FONT,
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.02em',
  color: S.primary,
  backgroundColor: S.surfaceLow,
  border: 'none',
  borderRadius: 999,
  padding: '9px 18px',
  cursor: 'pointer',
  transition: 'background-color 0.15s, opacity 0.15s',
};

const DESTRUCTIVE_BUTTON: React.CSSProperties = {
  ...SECONDARY_BUTTON,
  color: S.error,
  backgroundColor: S.errorContainer,
};

// ─── Toast (inline status banner) ──────────────────────────────────
interface StatusBannerProps {
  kind: 'success' | 'error' | 'info';
  children: React.ReactNode;
}
const StatusBanner: FC<StatusBannerProps> = ({ kind, children }) => {
  const palette = kind === 'success'
    ? { bg: S.successContainer, fg: S.success, Icon: Check }
    : kind === 'error'
      ? { bg: S.errorContainer, fg: S.onErrorContainer, Icon: AlertCircle }
      : { bg: S.surfaceLow, fg: S.primary, Icon: Sparkles };
  const Icon = palette.Icon;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 10,
      backgroundColor: palette.bg, color: palette.fg,
      fontSize: 12.5, fontWeight: 500,
    }}>
      <Icon size={14} strokeWidth={2.25} />
      <span>{children}</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Section: Profile
// ═══════════════════════════════════════════════════════════════════
const ProfileSection: FC<{ role: 'admin' | 'viewer' | 'unknown' }> = ({ role }) => {
  const { user, isLoaded } = useUser();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
    }
  }, [user]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setStatus(null);
    try {
      await user.update({ firstName, lastName });
      setStatus({ kind: 'success', message: 'Profile updated.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile.';
      setStatus({ kind: 'error', message });
    } finally {
      setSaving(false);
    }
  }, [user, firstName, lastName]);

  if (!isLoaded || !user) {
    return <SectionCard title="Profile" icon={User}><div style={{ color: S.mutedText, fontSize: 13 }}>Loading…</div></SectionCard>;
  }

  const email = user.primaryEmailAddress?.emailAddress ?? '—';
  // R-12: locale-stable "26 Jun 2026" (was browser-locale toLocaleDateString).
  const createdAt = fmtDate(user.createdAt);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard
        title="Identity"
        icon={User}
        description="Your identity is managed by Clerk. Email changes are handled through a verification flow."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Email">
            <input type="email" value={email} readOnly style={READONLY_STYLE} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="First name">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Alex"
                style={INPUT_STYLE}
              />
            </Field>
            <Field label="Last name">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Laker"
                style={INPUT_STYLE}
              />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Role">
              <div style={{ padding: '9px 12px' }}>
                <RolePill role={role} />
              </div>
            </Field>
            <Field label="Member since">
              <input type="text" value={createdAt} readOnly style={READONLY_STYLE} />
            </Field>
          </div>
          {status && <StatusBanner kind={status.kind}>{status.message}</StatusBanner>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ ...PRIMARY_BUTTON, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Section: Password
// ═══════════════════════════════════════════════════════════════════
const PasswordSection: FC = () => {
  const { user, isLoaded } = useUser();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setStatus(null);
    if (next.length < 8) {
      setStatus({ kind: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }
    if (next !== confirm) {
      setStatus({ kind: 'error', message: "Passwords don't match." });
      return;
    }
    setSaving(true);
    try {
      await user.updatePassword({
        currentPassword: current,
        newPassword: next,
        signOutOfOtherSessions: signOutOthers,
      });
      setCurrent(''); setNext(''); setConfirm('');
      setStatus({ kind: 'success', message: 'Password updated successfully.' });
    } catch (err) {
      // Clerk error objects expose `errors[0].longMessage` for friendlier copy.
      // Fall back through message → generic text so we never show `[object Object]`.
      const anyErr = err as { errors?: Array<{ longMessage?: string; message?: string }>; message?: string };
      const msg = anyErr?.errors?.[0]?.longMessage
        ?? anyErr?.errors?.[0]?.message
        ?? anyErr?.message
        ?? 'Failed to update password.';
      setStatus({ kind: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  }, [user, current, next, confirm, signOutOthers]);

  const handleRequestReset = useCallback(async () => {
    if (!user) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) {
      setStatus({ kind: 'error', message: 'No email on file for reset.' });
      return;
    }
    setStatus({ kind: 'success', message: `Check ${email} for reset instructions via Clerk.` });
    // Full reset flow lives on the /sign-in page — link to it.
    window.open('/sign-in?reset=true', '_blank', 'noopener,noreferrer');
  }, [user]);

  if (!isLoaded || !user) {
    return <SectionCard title="Password" icon={KeyRound}><div style={{ color: S.mutedText, fontSize: 13 }}>Loading…</div></SectionCard>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard
        title="Change password"
        icon={KeyRound}
        description="Use a strong, unique password. Minimum 8 characters. If you've forgotten your current password, use the reset link below."
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Current password">
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} style={INPUT_STYLE} required />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="New password" hint="At least 8 characters.">
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} style={INPUT_STYLE} required minLength={8} />
            </Field>
            <Field label="Confirm new password">
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={INPUT_STYLE} required minLength={8} />
            </Field>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: S.onSurface, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={signOutOthers}
              onChange={(e) => setSignOutOthers(e.target.checked)}
              style={{ accentColor: S.primary }}
            />
            Sign out of all other sessions after changing password
          </label>
          {status && <StatusBanner kind={status.kind}>{status.message}</StatusBanner>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <button type="button" onClick={handleRequestReset} style={SECONDARY_BUTTON}>
              Request password reset
            </button>
            <button type="submit" disabled={saving} style={{ ...PRIMARY_BUTTON, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Section: Active Sessions
// ═══════════════════════════════════════════════════════════════════
const SessionsSection: FC = () => {
  const { sessions, isLoaded } = useSessionList();
  const { session: currentSession } = useSession();
  const { signOut } = useClerk();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const handleRevoke = useCallback(async (sessionId: string) => {
    setRevokingId(sessionId);
    setStatus(null);
    try {
      // Clerk v6: revoke a specific session by passing its ID to signOut().
      // This ends just that session (e.g. another device), leaving the
      // current session untouched. The top-level useClerk().signOut({ sessionId })
      // is the supported way to do this from the frontend SDK.
      await signOut({ sessionId });
      setStatus({ kind: 'success', message: 'Session revoked.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke session.';
      setStatus({ kind: 'error', message });
    } finally {
      setRevokingId(null);
    }
  }, [signOut]);

  const handleSignOutEverywhere = useCallback(async () => {
    setSigningOutAll(true);
    setStatus(null);
    try {
      // Clerk's top-level signOut() revokes the current session and redirects
      // to /sign-in. To sign out of every device (including this one) we
      // simply call signOut without a sessionId — Clerk handles the rest.
      await signOut({ redirectUrl: '/sign-in' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out.';
      setStatus({ kind: 'error', message });
      setSigningOutAll(false);
    }
  }, [signOut]);

  if (!isLoaded) {
    return <SectionCard title="Active sessions" icon={Monitor}><div style={{ color: S.mutedText, fontSize: 13 }}>Loading…</div></SectionCard>;
  }

  const sorted = [...(sessions ?? [])].sort((a, b) => {
    const aT = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
    const bT = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
    return bT - aT;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard
        title={`Active sessions (${sorted.length})`}
        icon={Monitor}
        description="Each device or browser that has signed in appears here. Revoke any you don't recognize."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.length === 0 && (
            <div style={{ color: S.mutedText, fontSize: 13 }}>No active sessions.</div>
          )}
          {sorted.map((s) => {
            const isCurrent = currentSession?.id === s.id;
            // R-12: locale-stable "26 Jun 2026, 08:38".
            const lastActive = s.lastActiveAt ? fmtDateTime(s.lastActiveAt) : 'unknown';
            // Clerk v6 dropped `latestActivity` from the public SessionResource
            // type, but the data is still hydrated at runtime when the session
            // has been fetched via useSessionList(). We read it through a
            // narrow cast so TypeScript doesn't block the build while still
            // letting us display useful device / location metadata when the
            // backend provided it.
            const activity = (s as unknown as {
              latestActivity?: {
                deviceType?: string;
                browserName?: string;
                city?: string;
                country?: string;
              };
            }).latestActivity;
            const device = activity?.deviceType ?? 'Device';
            const browser = activity?.browserName ?? '';
            const location = [activity?.city, activity?.country]
              .filter(Boolean).join(', ') || 'Location unknown';
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  backgroundColor: isCurrent ? S.primaryContainer : S.surfaceLow,
                  border: `1px solid ${isCurrent ? S.outlineVariant : S.cardBorder}`,
                  borderRadius: 10,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: S.surface, color: S.primary,
                }}>
                  <Monitor size={16} strokeWidth={2.25} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: S.onSurface,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span>{device} · {browser || 'Browser'}</span>
                    {isCurrent && (
                      <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: S.primary, color: '#fff' }}>
                        This device
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: S.mutedText, marginTop: 2 }}>
                    {location} · Last active {lastActive}
                  </div>
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => handleRevoke(s.id)}
                    disabled={revokingId === s.id}
                    style={{ ...DESTRUCTIVE_BUTTON, opacity: revokingId === s.id ? 0.6 : 1, padding: '6px 14px', fontSize: 11.5 }}
                  >
                    {revokingId === s.id ? 'Revoking…' : 'Revoke'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {status && (
          <div style={{ marginTop: 12 }}><StatusBanner kind={status.kind}>{status.message}</StatusBanner></div>
        )}
      </SectionCard>

      <SectionCard
        title="Sign out everywhere"
        icon={LogOut}
        accent={S.error}
        description="End every session — including this one — on every device. You'll need to sign in again."
      >
        <button
          onClick={handleSignOutEverywhere}
          disabled={signingOutAll}
          style={{ ...DESTRUCTIVE_BUTTON, opacity: signingOutAll ? 0.6 : 1 }}
        >
          {signingOutAll ? 'Signing out…' : 'Sign out of every session'}
        </button>
      </SectionCard>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Section: Config Sheet (admin-editable)
// ═══════════════════════════════════════════════════════════════════
// GET /api/config contract — mirrors pulse/api/routers/config.py get_config.
// Config-sheet review (July 2026): the sheet previously rendered fields the
// API never returned (region, neutral_threshold, base_year, residual_cross_rho)
// — those inputs showed hardcoded frontend defaults instead of server state,
// and PUT silently dropped them (pydantic ignores unknown keys), so they were
// dead dials. The payload below mirrors the real contract; engine-consumed
// values that are not admin dials render read-only.
interface ModelConfigPayload {
  per_force_attenuation?: Record<string, number>;
  within_force_overlap?: Record<string, number>;
  attenuation_source?: string;
  force_weights?: Record<string, number>;
  vc_weights?: Record<string, number>;
  region_weights?: Record<string, number>;
  category_weights?: Record<string, number>;
  force_correlation_matrix?: Record<string, Record<string, number>>;
  force_overlap_matrix?: Record<string, Record<string, number>>;
  path_years?: number[];
  base_year?: number; // read-only context (engine-consumed, not admin-editable)
  iterations?: number;
  within_force_rho?: number;
  // t_copula_df removed (D20, June 2026): the engine runs a Gaussian copula.
}

// Keys this sheet may PUT (subset of the backend ConfigUpdate model).
// The correlation/overlap matrices and attenuation stay read-only in the UI
// (D8: changed only via a correction release / the admin API and its gates).
const EDITABLE_KEYS = [
  'iterations', 'within_force_rho',
  'force_weights', 'region_weights', 'vc_weights', 'category_weights',
] as const;
type EditableKey = typeof EDITABLE_KEYS[number];
type WeightGroupKey = Exclude<EditableKey, 'iterations' | 'within_force_rho'>;

// Canonical display order — mirrors pulse/config.py taxonomies. Rendering is
// robust to drift: missing keys are skipped, unknown keys are appended.
const FORCE_ORDER = ['Consumer', 'Customer', 'Technology', 'Government', 'Environmental', 'Competitive'];
const REGION_ORDER = ['Europe', 'North America', 'Asia', 'High Growth'];
const VC_ORDER = [
  'Raw Materials', 'Formulation', 'Manufacturing', 'Packaging',
  'Supply Chain', 'Marketing', 'Commercial', 'Consumer',
];
const CATEGORY_ORDER = [
  'Hair: Color', 'Hair: Care', 'Hair: Styling', 'Hair: Body',
  'LHC: FCN', 'LHC: FCA', 'LHC: FFI', 'LHC: LAD',
  'LHC: HDW', 'LHC: ADW', 'LHC: HSC', 'LHC: IC',
];
const FORCE_ABBR: Record<string, string> = {
  Consumer: 'Cons.', Customer: 'Cust.', Technology: 'Tech.',
  Government: 'Gov.', Environmental: 'Env.', Competitive: 'Comp.',
};

const orderedKeys = (obj: Record<string, unknown>, order: string[]): string[] => [
  ...order.filter((k) => k in obj),
  ...Object.keys(obj).filter((k) => !order.includes(k)),
];

// ── Non-form sub-block (label + content + hint). Unlike Field this is NOT
//    a <label> — tables and read-only text are not form controls. ─────
const SubBlock: FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={{
      fontFamily: HEADLINE_FONT,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: S.onSurfaceVariant,
    }}>
      {label}
    </span>
    {children}
    {hint && (
      <span style={{ fontSize: 11, lineHeight: 1.55, color: S.mutedText }}>{hint}</span>
    )}
  </div>
);

// ── Read-only force tables (attenuation row-pair + 6×6 matrices) ────
const CELL_TH: React.CSSProperties = {
  fontFamily: HEADLINE_FONT, fontSize: 10.5, fontWeight: 800,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: S.onSurfaceVariant, backgroundColor: S.surfaceContainer,
  padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap',
};
const CELL_LABEL: React.CSSProperties = {
  ...CELL_TH,
  textAlign: 'left', backgroundColor: S.surfaceLow,
  position: 'sticky', left: 0, zIndex: 1,
};
const CELL_NUM: React.CSSProperties = {
  fontFamily: MONO_FONT, fontSize: 12, color: S.onSurface,
  padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  borderTop: `1px solid ${S.cardBorder}`,
};

/** Horizontal-scroll wrapper so wide tables are never clipped. */
const TableScroller: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div
    role="region"
    aria-label={label}
    tabIndex={0}
    style={{
      overflowX: 'auto',
      border: `1px solid ${S.cardBorder}`,
      borderRadius: 10,
      backgroundColor: S.surface,
    }}
  >
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>
  </div>
);

/** Read-only 6×6 force matrix, read row → column. */
const ForceMatrixTable: FC<{
  matrix: Record<string, Record<string, number>>;
  digits: number;
  diagonal: 'dash' | 'value';
  label: string;
}> = ({ matrix, digits, diagonal, label }) => {
  const forces = orderedKeys(matrix, FORCE_ORDER);
  return (
    <TableScroller label={label}>
      <thead>
        <tr>
          <th style={{ ...CELL_LABEL, backgroundColor: S.surfaceContainer, textTransform: 'none', letterSpacing: 0 }}>
            row \ col
          </th>
          {forces.map((f) => (
            <th key={f} style={CELL_TH} title={f}>{FORCE_ABBR[f] ?? f}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {forces.map((row) => (
          <tr key={row}>
            <th scope="row" style={{ ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}` }}>{row}</th>
            {forces.map((col) => {
              const isDiag = row === col;
              const v = matrix[row]?.[col];
              return (
                <td key={col} style={{ ...CELL_NUM, color: isDiag ? S.mutedText : S.onSurface }}>
                  {isDiag && diagonal === 'dash' ? '—' : typeof v === 'number' ? v.toFixed(digits) : '—'}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </TableScroller>
  );
};

/** Per-force attenuation + within-force overlap as one six-column table
    (replaces the two cramped half-width box grids that clipped). */
const AttenuationTable: FC<{
  attenuation?: Record<string, number>;
  overlap?: Record<string, number>;
}> = ({ attenuation, overlap }) => {
  const forces = orderedKeys({ ...(attenuation ?? {}), ...(overlap ?? {}) }, FORCE_ORDER);
  if (forces.length === 0) {
    return <div style={READONLY_STYLE}>not returned by engine</div>;
  }
  const renderRow = (name: string, values?: Record<string, number>) => (
    <tr>
      <th scope="row" style={{
        ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}`,
        textTransform: 'none', letterSpacing: 0, fontSize: 11.5,
      }}>
        {name}
      </th>
      {forces.map((f) => {
        const v = values?.[f];
        return (
          <td key={f} style={CELL_NUM}>
            {typeof v === 'number' ? v.toFixed(3) : '—'}
          </td>
        );
      })}
    </tr>
  );
  return (
    <TableScroller label="Per-force attenuation and within-force overlap">
      <thead>
        <tr>
          <th style={{ ...CELL_LABEL, backgroundColor: S.surfaceContainer }} aria-label="Parameter" />
          {forces.map((f) => (
            <th key={f} style={CELL_TH} title={f}>{FORCE_ABBR[f] ?? f}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {renderRow('Attenuation', attenuation)}
        {renderRow('Within-force overlap', overlap)}
      </tbody>
    </TableScroller>
  );
};

// ── Editable weight grid with a live sum badge ──────────────────────
const WeightGrid: FC<{
  title: string;
  weights: Record<string, number>;
  order: string[];
  onCommit: (key: string, v: number) => void;
  readOnly: boolean;
}> = ({ title, weights, order, onCommit, readOnly }) => {
  const keys = orderedKeys(weights, order);
  const sum = keys.reduce((a, k) => a + (Number.isFinite(weights[k]) ? weights[k] : 0), 0);
  const ok = Math.abs(sum - 1) <= 0.01; // PUT /api/v1/config tolerance
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 800,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: S.onSurfaceVariant,
        }}>
          {title}
        </span>
        <span
          style={{
            fontFamily: MONO_FONT, fontSize: 10.5, fontWeight: 700,
            padding: '2px 8px', borderRadius: 999,
            backgroundColor: ok ? S.successContainer : S.errorContainer,
            color: ok ? S.success : S.onErrorContainer,
          }}
          title={ok
            ? 'Sums to 1.0 within the ±0.01 backend tolerance.'
            : 'Must sum to 1.0 (±0.01) — the backend rejects this save.'}
        >
          Σ {sum.toFixed(3)}{ok ? '' : ' · must equal 1.0'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
        {keys.map((k) => (
          <Field key={k} label={k}>
            <NumberField
              value={weights[k]}
              onCommit={(v) => onCommit(k, v)}
              readOnly={readOnly}
              inputStyle={readOnly ? READONLY_STYLE : INPUT_STYLE}
              format={fmtShortNumber}
            />
          </Field>
        ))}
      </div>
    </div>
  );
};

const ConfigSection: FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ModelConfigPayload | null>(null);
  const [draft, setDraft] = useState<ModelConfigPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/config', { credentials: 'include' });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = (await res.json()) as ModelConfigPayload;
      setConfig(data);
      setDraft(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load config.';
      setStatus({ kind: 'error', message: `${message}. Defaults are shown — save is disabled.` });
      setConfig(null);
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Diff-only save: only keys the admin actually changed enter the PUT body.
  // The previous full-draft PUT audit-logged EVERY field as "changed" on
  // every save and leaned on pydantic silently dropping unknown keys.
  const dirtyKeys = useMemo<EditableKey[]>(() => {
    if (!config || !draft) return [];
    return EDITABLE_KEYS.filter(
      (k) => JSON.stringify(config[k]) !== JSON.stringify(draft[k]),
    );
  }, [config, draft]);
  const isDirty = dirtyKeys.length > 0;

  const handleSave = useCallback(async () => {
    if (!draft || dirtyKeys.length === 0) return;
    setSaving(true);
    setStatus(null);
    try {
      const body = Object.fromEntries(dirtyKeys.map((k) => [k, draft[k]]));
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: res.statusText }));
        const msg = typeof payload.error === 'string' ? payload.error : `Save failed (${res.status})`;
        throw new Error(msg);
      }
      setConfig(draft);
      setStatus({
        kind: 'success',
        message: `Saved and audit-logged (${dirtyKeys.join(', ')}). The persisted run is now marked stale — dashboard numbers change only after the next production CLI run.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save configuration.';
      setStatus({ kind: 'error', message });
    } finally {
      setSaving(false);
    }
  }, [draft, dirtyKeys]);

  const handleReset = useCallback(() => {
    setDraft(config);
    setStatus({ kind: 'info', message: 'Reverted to last loaded values.' });
  }, [config]);

  // Everyone can see the Config sheet — only admins can change it. Non-admins
  // get the same form but with every input disabled and the Save row hidden.
  // We thread a single `readOnly` flag through so the UI stays consistent
  // and the backend PUT gate (requireAdmin in /api/config) is the real
  // enforcement boundary — the UI just mirrors it.
  const readOnly = !isAdmin;

  const patch = (p: Partial<ModelConfigPayload>) => {
    if (readOnly) return;
    setDraft((d) => (d ? { ...d, ...p } : d));
  };

  const patchWeight = (group: WeightGroupKey) => (key: string, v: number) => {
    if (readOnly) return;
    setDraft((d) => (d ? { ...d, [group]: { ...(d[group] ?? {}), [key]: v } } : d));
  };

  const ro = readOnly;

  const horizon = draft?.path_years?.length
    ? `${draft.path_years[0]}–${draft.path_years[draft.path_years.length - 1]} · ${draft.path_years.length} years`
    : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {readOnly && (
        <StatusBanner kind="info">
          You have <b>viewer</b> access — values below are read-only. Ask an administrator to make changes.
        </StatusBanner>
      )}

      {loading || !draft ? (
        <SectionCard title="Simulation parameters" icon={SlidersHorizontal}>
          <div style={{ color: S.mutedText, fontSize: 13 }}>
            {loading ? 'Loading configuration…' : 'No configuration available.'}
          </div>
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="Simulation parameters"
            icon={SlidersHorizontal}
            description="Admin changes are audit-logged and mark the persisted run stale — dashboard numbers change only after the next production CLI run. Existing runs are immutable."
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              <Field label="MC iterations" hint="Admin bounds 1,000–100,000 · default 10,000. Production runs execute offline at 50,000 × 3 chains.">
                <NumberField
                  integer
                  value={draft.iterations ?? 10000}
                  onCommit={(v) => patch({ iterations: v })}
                  readOnly={ro}
                  inputStyle={ro ? READONLY_STYLE : INPUT_STYLE}
                />
              </Field>
              <SubBlock label="Path horizon (read-only)" hint="Relative-shift paths over the 10-year horizon.">
                <div style={READONLY_STYLE}>{horizon}</div>
              </SubBlock>
              <SubBlock label="Base year (read-only)" hint="Materialization anchor. Changed only via a correction release.">
                <div style={READONLY_STYLE}>{draft.base_year ?? '—'}</div>
              </SubBlock>
            </div>
          </SectionCard>

          <SectionCard
            title="Copula dependence — Gaussian"
            icon={SlidersHorizontal}
            description="How trend correlations flow through the Monte Carlo. The t-copula tail dial was removed June 2026 (D20) after testing inert (<2% band effect). Correlation settings implying a non-PSD trend-population matrix are rejected at save time (spectral gate, D1) rather than silently repaired."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                <Field label="Within-force ρ" hint="Correlation between trends of the same force. Bounds 0–0.9 · default 0.30.">
                  <NumberField
                    value={draft.within_force_rho ?? 0.3}
                    onCommit={(v) => patch({ within_force_rho: v })}
                    readOnly={ro}
                    inputStyle={ro ? READONLY_STYLE : INPUT_STYLE}
                  />
                </Field>
              </div>
              {draft.force_correlation_matrix && (
                <SubBlock
                  label="Force correlation matrix (read-only)"
                  hint="Cross-force correlations, PSD-valid as entered (v3.6 recalibration, D1). Pairs not covered by a trend's force row fall back to residual ρ = 0.05. Editable via the admin API only — symmetry, unit diagonal and the spectral gate are enforced there."
                >
                  <ForceMatrixTable
                    matrix={draft.force_correlation_matrix}
                    digits={2}
                    diagonal="value"
                    label="Force correlation matrix"
                  />
                </SubBlock>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Attenuation & overlap"
            icon={SlidersHorizontal}
            description={`Read-only. The engine dampens each force's combined trend effect with a per-force attenuation — derived as 0.5 × (1 − mean between-force overlap of that force's row) — plus within-force overlap dampening for mechanism redundancy. Source: structured-judgment overlap correction (v3.5, Apr-2026)${draft.attenuation_source === 'admin_override' ? ' — admin override active' : ''}. Changed only via a correction release.`}
          >
            {/* F-27/D8 (June 2026): the legacy scalar attenuation field was a
                silent no-op — the engine consumes six per-force values.
                D17 (owner decision): the source is labeled "structured-
                judgment overlap correction", not "calibrated" — the values
                rest on a weighted-Jaccard exposure proxy plus documented
                judgment adjustments, not on measured outcomes (F-19). */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <AttenuationTable
                attenuation={draft.per_force_attenuation}
                overlap={draft.within_force_overlap}
              />
              {draft.force_overlap_matrix && (
                <SubBlock
                  label="Between-force overlap matrix (read-only)"
                  hint="Read row → column: the share of the row force's signal already captured by the column force. Asymmetric by design (a narrow force is 'covered' by a broad one more than vice versa), bounded 0–0.45. The diagonal is handled by the within-force overlap above."
                >
                  <ForceMatrixTable
                    matrix={draft.force_overlap_matrix}
                    digits={3}
                    diagonal="dash"
                    label="Between-force overlap matrix"
                  />
                </SubBlock>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Aggregation weights"
            icon={SlidersHorizontal}
            description="Weights the engine consumes for portfolio aggregation and the force / value-chain / region attribution lenses. Each group must sum to 1.0 — the backend rejects saves outside ±0.01 (it does not renormalize)."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {draft.force_weights ? (
                <WeightGrid
                  title="Force weights"
                  weights={draft.force_weights}
                  order={FORCE_ORDER}
                  onCommit={patchWeight('force_weights')}
                  readOnly={ro}
                />
              ) : (
                <div style={{ color: S.mutedText, fontSize: 12.5 }}>
                  No force weights returned by the backend — defaults are used (equal weight per force).
                </div>
              )}
              {draft.region_weights && (
                <WeightGrid
                  title="Region weights"
                  weights={draft.region_weights}
                  order={REGION_ORDER}
                  onCommit={patchWeight('region_weights')}
                  readOnly={ro}
                />
              )}
              {draft.vc_weights && (
                <WeightGrid
                  title="Value-chain weights"
                  weights={draft.vc_weights}
                  order={VC_ORDER}
                  onCommit={patchWeight('vc_weights')}
                  readOnly={ro}
                />
              )}
              {draft.category_weights && (
                <WeightGrid
                  title="Category weights"
                  weights={draft.category_weights}
                  order={CATEGORY_ORDER}
                  onCommit={patchWeight('category_weights')}
                  readOnly={ro}
                />
              )}
            </div>
          </SectionCard>
        </>
      )}

      {status && <StatusBanner kind={status.kind}>{status.message}</StatusBanner>}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <button onClick={load} style={SECONDARY_BUTTON} disabled={loading}>
          Reload from backend
        </button>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleReset} disabled={!isDirty || saving} style={{ ...SECONDARY_BUTTON, opacity: (!isDirty || saving) ? 0.5 : 1 }}>
              Discard changes
            </button>
            <button onClick={handleSave} disabled={!isDirty || saving} style={{ ...PRIMARY_BUTTON, opacity: (!isDirty || saving) ? 0.5 : 1 }}>
              {saving ? 'Saving…' : isDirty ? `Save configuration (${dirtyKeys.length})` : 'Save configuration'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Section: User Management (admin only)
// ═══════════════════════════════════════════════════════════════════
interface ManagedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'admin' | 'viewer';
  lastSignInAt: string | null;
  createdAt: string | null;
}

const UsersSection: FC<{ isAdmin: boolean; currentUserId: string | null }> = ({ isAdmin, currentUserId }) => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = (await res.json()) as { users: ManagedUser[] };
      setUsers(data.users);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users.';
      setStatus({ kind: 'error', message });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); else setLoading(false); }, [isAdmin, load]);

  const handleRoleChange = useCallback(async (userId: string, role: 'admin' | 'viewer') => {
    setUpdatingId(userId);
    setStatus(null);
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(payload.error ?? `Update failed (${res.status})`);
      }
      setUsers((list) => list.map((u) => (u.id === userId ? { ...u, role } : u)));
      setStatus({ kind: 'success', message: 'Role updated.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update role.';
      setStatus({ kind: 'error', message });
    } finally {
      setUpdatingId(null);
    }
  }, []);

  if (!isAdmin) {
    return (
      <SectionCard
        title="User management"
        icon={UsersIcon}
        description="User management is restricted to administrators."
      >
        <StatusBanner kind="info">
          You don't have permission to view this section.
        </StatusBanner>
      </SectionCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard
        title={`All users${users.length ? ` (${users.length})` : ''}`}
        icon={UsersIcon}
        description="Promote teammates to admin or demote to viewer. Admins can edit model configuration and manage other users. Viewers have read-only access."
      >
        {loading ? (
          <div style={{ color: S.mutedText, fontSize: 13 }}>Loading users…</div>
        ) : users.length === 0 ? (
          <div style={{ color: S.mutedText, fontSize: 13 }}>No users returned from the directory.</div>
        ) : (
          <div style={{
            border: `1px solid ${S.cardBorder}`, borderRadius: 12, overflow: 'hidden',
            backgroundColor: S.surface,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 0.8fr',
              padding: '10px 14px',
              backgroundColor: S.surfaceContainer,
              fontFamily: HEADLINE_FONT,
              fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: S.onSurfaceVariant,
            }}>
              <span>User</span>
              <span>Name</span>
              <span>Role</span>
              <span>Last active</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            {users.map((u) => {
              const isSelf = currentUserId === u.id;
              const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
              // R-12: locale-stable "26 Jun 2026".
              const lastSignIn = fmtDate(u.lastSignInAt);
              return (
                <div
                  key={u.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 0.8fr',
                    padding: '12px 14px',
                    borderTop: `1px solid ${S.cardBorder}`,
                    alignItems: 'center',
                    fontSize: 12.5, color: S.onSurface,
                  }}
                >
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.email}
                    {isSelf && (
                      <span className="ml-2 text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: S.primaryContainer, color: S.onPrimaryContainer }}>
                        You
                      </span>
                    )}
                  </span>
                  <span style={{ color: S.mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</span>
                  <span><RolePill role={u.role} /></span>
                  <span style={{ color: S.mutedText }}>{lastSignIn}</span>
                  <span style={{ textAlign: 'right' }}>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as 'admin' | 'viewer')}
                      disabled={updatingId === u.id || isSelf}
                      title={isSelf ? "You can't change your own role." : 'Change role'}
                      style={{
                        ...INPUT_STYLE,
                        padding: '5px 10px',
                        fontSize: 12,
                        opacity: (updatingId === u.id || isSelf) ? 0.55 : 1,
                        cursor: isSelf ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {status && (
          <div style={{ marginTop: 12 }}><StatusBanner kind={status.kind}>{status.message}</StatusBanner></div>
        )}
      </SectionCard>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Main Modal
// ═══════════════════════════════════════════════════════════════════
interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const SettingsModal: FC<SettingsModalProps> = ({ open, onClose }) => {
  const { user, isLoaded } = useUser();
  const [activeSection, setActiveSection] = useState<SectionId>('profile');
  const [role, setRole] = useState<'admin' | 'viewer' | 'unknown'>('unknown');
  const [roleLoaded, setRoleLoaded] = useState(false);

  // Fetch current user's role from our Postgres (source of truth for
  // authorization in PRISM — Clerk only handles identity).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { role: 'admin' | 'viewer' };
        if (!cancelled) { setRole(data.role); setRoleLoaded(true); }
      } catch {
        if (!cancelled) { setRole('viewer'); setRoleLoaded(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // R-03 (design review 2026-07-01): shared overlay contract — Escape,
  // body scroll lock, focus trap, initial focus and focus return all come
  // from useOverlay (replaces the local Escape-only listener).
  const modalRef = useRef<HTMLDivElement | null>(null);
  useOverlay(open, onClose, modalRef);

  const isAdmin = role === 'admin';
  const visibleSections = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':      return <ProfileSection role={role} />;
      case 'password':     return <PasswordSection />;
      case 'sessions':     return <SessionsSection />;
      case 'config':       return <ConfigSection isAdmin={isAdmin} />;
      case 'users':        return <UsersSection isAdmin={isAdmin} currentUserId={user?.id ?? null} />;
      default:             return null;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              backgroundColor: 'rgba(0, 52, 94, 0.35)',
              backdropFilter: 'blur(4px)',
            }}
          />
          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            tabIndex={-1}
            style={{
              position: 'fixed',
              inset: '3vh 3vw',
              zIndex: 101,
              backgroundColor: S.bg,
              borderRadius: 18,
              boxShadow: '0 32px 96px -20px rgba(0, 52, 94, 0.35)',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '260px 1fr',
              // Scroll fix (July 2026): without an explicit row constraint the
              // single implicit grid row sizes to max-content, so content
              // taller than the fixed-inset modal grew past its bounds and the
              // outer overflow:hidden clipped it — <main>'s overflow:auto
              // never engaged and the sheet could not scroll. minmax(0, 1fr)
              // pins the row to the modal height so the panes scroll instead.
              gridTemplateRows: 'minmax(0, 1fr)',
              fontFamily: BODY_FONT,
            }}
          >
            {/* Left rail */}
            <aside style={{
              backgroundColor: S.surface,
              borderRight: `1px solid ${S.cardBorder}`,
              display: 'flex', flexDirection: 'column',
              padding: '24px 16px',
              overflow: 'auto',
            }}>
              <div style={{
                padding: '0 10px 16px',
                fontFamily: HEADLINE_FONT,
                fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
                color: S.onBg,
              }}>
                Settings
              </div>

              <div style={{
                padding: '4px 10px 6px',
                fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 800,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: S.onSurfaceVariant,
              }}>
                Account
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
                {visibleSections.filter((s) => s.group === 'account').map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 10,
                        backgroundColor: isActive ? S.primaryContainer : 'transparent',
                        color: isActive ? S.onPrimaryContainer : S.onSurface,
                        border: 'none', cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: BODY_FONT,
                        fontSize: 13, fontWeight: isActive ? 600 : 500,
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = S.surfaceLow; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <Icon size={15} strokeWidth={2.25} />
                      {section.label}
                    </button>
                  );
                })}
              </nav>

              {isAdmin && (
                <>
                  <div style={{
                    padding: '4px 10px 6px',
                    fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 800,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: S.onSurfaceVariant,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <ShieldCheck size={11} /> Administration
                  </div>
                  <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {visibleSections.filter((s) => s.group === 'admin').map((section) => {
                      const Icon = section.icon;
                      const isActive = activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          onClick={() => setActiveSection(section.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', borderRadius: 10,
                            backgroundColor: isActive ? S.primaryContainer : 'transparent',
                            color: isActive ? S.onPrimaryContainer : S.onSurface,
                            border: 'none', cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: BODY_FONT,
                            fontSize: 13, fontWeight: isActive ? 600 : 500,
                            transition: 'background-color 0.15s',
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = S.surfaceLow; }}
                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <Icon size={15} strokeWidth={2.25} />
                          {section.label}
                        </button>
                      );
                    })}
                  </nav>
                </>
              )}

              <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1px solid ${S.cardBorder}` }}>
                {isLoaded && user && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 16,
                      backgroundColor: S.primaryContainer,
                      color: S.onPrimaryContainer,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 800,
                    }}>
                      {(user.primaryEmailAddress?.emailAddress?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: S.onSurface,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {user.primaryEmailAddress?.emailAddress ?? 'Signed in'}
                      </div>
                      <div style={{ fontSize: 11, color: S.mutedText }}>
                        {roleLoaded ? role : 'Loading role…'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Content area */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
              <header style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 28px', borderBottom: `1px solid ${S.cardBorder}`,
                backgroundColor: S.surface,
              }}>
                <div>
                  <div style={{
                    fontFamily: HEADLINE_FONT,
                    fontSize: 18, fontWeight: 800, color: S.onBg,
                    letterSpacing: '-0.01em',
                  }}>
                    {SECTIONS.find((s) => s.id === activeSection)?.label ?? 'Settings'}
                  </div>
                  <div style={{ fontSize: 12, color: S.mutedText, marginTop: 2 }}>
                    {activeSection === 'profile' && 'Your identity and display name'}
                    {activeSection === 'password' && 'Rotate your credentials'}
                    {activeSection === 'sessions' && 'Devices and browsers with an active session'}
                    {activeSection === 'config' && 'PRISM simulation parameters'}
                    {activeSection === 'users' && 'Team access and roles'}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close settings"
                  style={{
                    width: 34, height: 34, borderRadius: 10,
                    border: 'none', backgroundColor: S.surfaceLow,
                    color: S.onSurfaceVariant, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = S.surfaceHigh; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = S.surfaceLow; }}
                >
                  <X size={18} />
                </button>
              </header>

              <main style={{
                flex: 1, minHeight: 0, overflow: 'auto',
                padding: '24px 28px 32px',
                backgroundColor: S.bg,
              }}>
                {renderSection()}
              </main>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
