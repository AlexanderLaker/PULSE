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
  FC, useCallback, useEffect, useMemo, useState,
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

// ─── Editorial design tokens (mirrors Trends2 / DESIGN.md) ──────────
const S = {
  bg:                  '#f8f9ff',
  surface:             '#ffffff',
  surfaceLow:          '#eff4ff',
  surfaceContainer:    '#e5eeff',
  surfaceHigh:         '#dce9ff',
  surfaceHighest:      '#d2e4ff',
  primary:             '#005db5',
  primaryDim:          '#0052a0',
  primaryContainer:    '#d6e3ff',
  onPrimaryContainer:  '#00519e',
  onBg:                '#00345e',
  onSurface:           '#00345e',
  onSurfaceVariant:    '#26619d',
  secondaryContainer:  '#d5e3fc',
  onSecondaryContainer:'#455367',
  tertiaryContainer:   '#dae2fd',
  onTertiaryContainer: '#4a5167',
  error:               '#9f403d',
  errorContainer:      '#fe8983',
  onErrorContainer:    '#752121',
  success:             '#1f7a3d',
  successContainer:    '#cfead8',
  warning:             '#8a5a00',
  warningContainer:    '#ffe1a8',
  outline:             '#477dbb',
  outlineVariant:      '#81b5f6',
  cardBorder:          'rgba(0, 52, 94, 0.10)',
  cardBorderStrong:    'rgba(0, 52, 94, 0.16)',
  mutedText:           '#64748B',
};

const HEADLINE_FONT =
  "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

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
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase"
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
  outline: 'none',
  transition: 'border-color 0.15s, background-color 0.15s',
};

const READONLY_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  backgroundColor: S.surfaceContainer,
  color: S.mutedText,
  cursor: 'not-allowed',
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
  const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  }) : '—';

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
            const lastActive = s.lastActiveAt
              ? new Date(s.lastActiveAt).toLocaleString(undefined, {
                dateStyle: 'medium', timeStyle: 'short',
              })
              : 'unknown';
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
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
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
interface ModelConfigPayload {
  region?: string;
  per_force_attenuation?: Record<string, number>;
  within_force_overlap?: Record<string, number>;
  attenuation_source?: string;
  neutral_threshold?: number;
  iterations?: number;
  base_year?: number;
  path_years?: number[];
  within_force_rho?: number;
  // t_copula_df removed (D20, June 2026): the engine runs a Gaussian copula.
  residual_cross_rho?: number;
  force_weights?: Record<string, number>;
  materialization_schedule?: Record<string, number>;
  model_version?: string;
}

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

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(payload.error ?? `Save failed (${res.status})`);
      }
      setConfig(draft);
      setStatus({ kind: 'success', message: 'Configuration saved. A new snapshot has been written to the audit log.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save configuration.';
      setStatus({ kind: 'error', message });
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const handleReset = useCallback(() => {
    setDraft(config);
    setStatus({ kind: 'info', message: 'Reverted to last loaded values.' });
  }, [config]);

  const isDirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(draft), [config, draft]);

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

  const ro = readOnly;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {readOnly && (
        <StatusBanner kind="info">
          You have <b>viewer</b> access — values below are read-only. Ask an administrator to make changes.
        </StatusBanner>
      )}

      <SectionCard
        title="Simulation parameters"
        icon={SlidersHorizontal}
        description="Changes here affect every subsequent simulation run. Existing runs are immutable and remain auditable."
      >
        {loading ? (
          <div style={{ color: S.mutedText, fontSize: 13 }}>Loading configuration…</div>
        ) : !draft ? (
          <div style={{ color: S.mutedText, fontSize: 13 }}>No configuration available.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* F-27/D8 (June 2026): the legacy scalar attenuation field was a
                  silent no-op — the engine consumes six per-force values.
                  They are displayed read-only here with their source.
                  D17 (owner decision): the source is labeled "structured-
                  judgment overlap correction", not "calibrated" — the values
                  rest on a weighted-Jaccard exposure proxy plus documented
                  judgment adjustments, not on measured outcomes (F-19). */}
              <Field
                label="Per-force attenuation (read-only)"
                hint={`Effective multiplier on each force's contribution. Source: structured-judgment overlap correction (v3.5, Apr-2026)${draft.attenuation_source === 'admin_override' ? ' — admin override active' : ''}. Changed only via a correction release.`}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {Object.entries(draft.per_force_attenuation ?? {}).map(([f, v]) => (
                    <div key={f} style={{ ...READONLY_STYLE, fontSize: 12.5 }}>
                      {f}: {Number(v).toFixed(3)}
                    </div>
                  ))}
                  {!draft.per_force_attenuation && (
                    <div style={{ ...READONLY_STYLE, gridColumn: '1 / -1' }}>not returned by engine</div>
                  )}
                </div>
              </Field>
              <Field
                label="Within-force overlap (read-only)"
                hint="Dampens summed trends inside one force (mechanism redundancy). Source: structured-judgment overlap correction (v3.5, Apr-2026)."
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {Object.entries(draft.within_force_overlap ?? {}).map(([f, v]) => (
                    <div key={f} style={{ ...READONLY_STYLE, fontSize: 12.5 }}>
                      {f}: {Number(v).toFixed(3)}
                    </div>
                  ))}
                  {!draft.within_force_overlap && (
                    <div style={{ ...READONLY_STYLE, gridColumn: '1 / -1' }}>not returned by engine</div>
                  )}
                </div>
              </Field>
              <Field label="Neutral threshold" hint="Shifts below this magnitude are reported as neutral.">
                <input
                  type="number" min={0} max={0.05} step={0.0005}
                  value={draft.neutral_threshold ?? 0.001}
                  onChange={(e) => patch({ neutral_threshold: parseFloat(e.target.value) })}
                  disabled={ro} readOnly={ro}
                  style={ro ? READONLY_STYLE : INPUT_STYLE}
                />
              </Field>
              <Field label="MC iterations" hint="10 000 default. Max 100 000.">
                <input
                  type="number" min={1000} max={100000} step={1000}
                  value={draft.iterations ?? 10000}
                  onChange={(e) => patch({ iterations: parseInt(e.target.value, 10) })}
                  disabled={ro} readOnly={ro}
                  style={ro ? READONLY_STYLE : INPUT_STYLE}
                />
              </Field>
              <Field label="Base year">
                <input
                  type="number" min={2020} max={2030}
                  value={draft.base_year ?? 2025}
                  onChange={(e) => patch({ base_year: parseInt(e.target.value, 10) })}
                  disabled={ro} readOnly={ro}
                  style={ro ? READONLY_STYLE : INPUT_STYLE}
                />
              </Field>
              <Field label="Region">
                <select
                  value={draft.region ?? 'Europe'}
                  onChange={(e) => patch({ region: e.target.value })}
                  disabled={ro}
                  style={ro ? READONLY_STYLE : INPUT_STYLE}
                >
                  {['Europe', 'North America', 'Asia', 'High Growth'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Copula parameters"
        icon={SlidersHorizontal}
        description="Controls how trend correlations flow through the Monte Carlo (Gaussian copula — the t-copula tail dial was removed June 2026 after testing inert, <2% band effect). Invalid correlation settings are rejected at save time rather than silently repaired."
      >
        {draft && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Within-force ρ" hint="Default 0.30">
              <input
                type="number" min={0} max={1} step={0.01}
                value={draft.within_force_rho ?? 0.3}
                onChange={(e) => patch({ within_force_rho: parseFloat(e.target.value) })}
                disabled={ro} readOnly={ro}
                style={ro ? READONLY_STYLE : INPUT_STYLE}
              />
            </Field>
            <Field label="Residual cross-ρ" hint="Default 0.05">
              <input
                type="number" min={0} max={1} step={0.01}
                value={draft.residual_cross_rho ?? 0.05}
                onChange={(e) => patch({ residual_cross_rho: parseFloat(e.target.value) })}
                disabled={ro} readOnly={ro}
                style={ro ? READONLY_STYLE : INPUT_STYLE}
              />
            </Field>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Force weights"
        icon={SlidersHorizontal}
        description="Relative influence of each force in the aggregate shift. Weights are normalized automatically so they sum to 1.0."
      >
        {draft?.force_weights && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {Object.entries(draft.force_weights).map(([force, weight]) => (
              <Field key={force} label={force}>
                <input
                  type="number" min={0} max={1} step={0.01}
                  value={weight}
                  onChange={(e) => patch({
                    force_weights: { ...draft.force_weights, [force]: parseFloat(e.target.value) },
                  })}
                  disabled={ro} readOnly={ro}
                  style={ro ? READONLY_STYLE : INPUT_STYLE}
                />
              </Field>
            ))}
          </div>
        )}
        {!draft?.force_weights && (
          <div style={{ color: S.mutedText, fontSize: 12.5 }}>
            No force weights returned by the backend — defaults are used (equal weight per force).
          </div>
        )}
      </SectionCard>

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
              {saving ? 'Saving…' : 'Save configuration'}
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
              fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em',
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
              const lastSignIn = u.lastSignInAt
                ? new Date(u.lastSignInAt).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                })
                : '—';
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
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
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

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

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
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
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
                fontFamily: HEADLINE_FONT, fontSize: 10, fontWeight: 800,
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
                    fontFamily: HEADLINE_FONT, fontSize: 10, fontWeight: 800,
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
                      <div style={{ fontSize: 10, color: S.mutedText }}>
                        {roleLoaded ? role : 'Loading role…'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Content area */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
                flex: 1, overflow: 'auto',
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
