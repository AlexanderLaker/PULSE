/**
 * Settings, opened from the gear in the top nav: a rail of sections on the
 * left, the chosen section on the right.
 *
 *   Account (everyone): profile, password and active sessions. Identity lives
 *     in Clerk, so these sections talk to Clerk directly.
 *   Model (everyone): the model configuration, read-only. The parameters are
 *     the code's (the store's config); the cell weights are the ones the
 *     served run used.
 *   Administration (admins): user management, through the dashboard's
 *     /api/users routes.
 *
 * The page resolves the role once and passes it in as `isAdmin`.
 */

'use client';

import {
  useEffect, useRef, useState,
  type CSSProperties, type FC, type FormEvent, type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, KeyRound, Monitor, SlidersHorizontal, Users as UsersIcon,
  ShieldCheck, Check, AlertCircle, Info, LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUser, useClerk, useSession } from '@clerk/nextjs';
import * as api from '@/lib/apiClient';
import type { ManagedUser } from '@/lib/apiClient';
import usePrism from '@/hooks/usePrism';
import useOverlay from '@/hooks/useOverlay';
import { S, HEADLINE_FONT, BODY_FONT, MONO_FONT } from '@/lib/theme';
import { CATEGORIES, FORCES, FORCE_COLORS, NO_VALUE, REGIONS, fmtDate, fmtDateTime, fmtPct } from '@/lib/format';
import { cellMarginals, cellWeightsBasis } from '@/lib/cellWeights';
import {
  BLOCK_SPLIT, CATEGORY_MIX, ESTIMATE_MARGINALS, ESTIMATE_VERSION, GRADE_LEGEND,
  MARGIN_INDEX, MARGIN_INDEX_NOTE, REGION_MIX, REGION_MIX_NOTE, type Grade,
} from '@/lib/cellWeightProvenance';
import type { ForceName, ModelConfig, Role, SimulationResult } from '@/types';

// ─── Sections ───────────────────────────────────────────────────────

type SectionId = 'profile' | 'password' | 'sessions' | 'model' | 'users';
type GroupId = 'account' | 'model' | 'admin';

interface SectionDef {
  id: SectionId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  group: GroupId;
}

const SECTIONS: SectionDef[] = [
  { id: 'profile',  label: 'Profile',             subtitle: 'Your identity and display name',                icon: User,              group: 'account' },
  { id: 'password', label: 'Password',            subtitle: 'Rotate your credentials',                       icon: KeyRound,          group: 'account' },
  { id: 'sessions', label: 'Active sessions',     subtitle: 'Devices and browsers with an active session',   icon: Monitor,           group: 'account' },
  { id: 'model',    label: 'Model configuration', subtitle: "The model's parameters and the served run's cell weights", icon: SlidersHorizontal, group: 'model' },
  { id: 'users',    label: 'User management',     subtitle: 'Team access and roles',                         icon: UsersIcon,         group: 'admin' },
];

const GROUPS: Array<{ id: GroupId; label: string; adminOnly?: boolean }> = [
  { id: 'account', label: 'Account' },
  { id: 'model', label: 'Model' },
  { id: 'admin', label: 'Administration', adminOnly: true },
];

// ─── Building blocks ────────────────────────────────────────────────

type Status = { kind: 'success' | 'error' | 'info'; message: string };

/** The message of a failed call, or a fallback line. */
const errorText = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

const SectionCard: FC<{
  title: string;
  icon: LucideIcon;
  accent?: string;
  description?: ReactNode;
  children: ReactNode;
}> = ({ title, icon: Icon, accent, description, children }) => (
  <div style={{
    backgroundColor: S.surface,
    border: `1px solid ${S.cardBorder}`,
    borderRadius: 14,
    padding: '18px 20px 20px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
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
      <div style={{ marginBottom: 14, fontSize: 12.5, lineHeight: 1.55, color: S.mutedText }}>
        {description}
      </div>
    )}
    {children}
  </div>
);

const Muted: FC<{ children: ReactNode }> = ({ children }) => (
  <div style={{ color: S.mutedText, fontSize: 13 }}>{children}</div>
);

const RolePill: FC<{ role: Role }> = ({ role }) => {
  const isAdmin = role === 'admin';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase"
      style={{
        backgroundColor: isAdmin ? S.primaryContainer : S.secondaryContainer,
        color: isAdmin ? S.onPrimaryContainer : S.onSecondaryContainer,
      }}
    >
      {isAdmin && <ShieldCheck size={11} strokeWidth={2.5} />}
      {role}
    </span>
  );
};

const LABEL_STYLE: CSSProperties = {
  fontFamily: HEADLINE_FONT,
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: S.onSurfaceVariant,
};

/** A form control with its label; the <label> wraps the control. */
const Field: FC<{ label: string; hint?: string; children: ReactNode }> = ({ label, hint, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={LABEL_STYLE}>{label}</span>
    {children}
    {hint && <span style={{ fontSize: 11, color: S.mutedText }}>{hint}</span>}
  </label>
);

/** A labelled value, table or note that is not a form control. */
const SubBlock: FC<{ label: string; hint?: string; children: ReactNode }> = ({ label, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={LABEL_STYLE}>{label}</span>
    {children}
    {hint && <span style={{ fontSize: 11, lineHeight: 1.55, color: S.mutedText }}>{hint}</span>}
  </div>
);

const INPUT_STYLE: CSSProperties = {
  fontFamily: BODY_FONT,
  fontSize: 13.5,
  color: S.onSurface,
  backgroundColor: S.surfaceLow,
  border: `1px solid ${S.cardBorder}`,
  borderRadius: 10,
  padding: '9px 12px',
  // No outline override: the focus indicator comes from globals.css (the
  // input:focus ring, and :focus-visible for every control, <select> included).
  transition: 'border-color 0.15s, background-color 0.15s',
};

/** A value shown in a field's frame, not editable. */
const VALUE_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  backgroundColor: S.surfaceContainer,
  color: S.mutedText,
};

const READONLY_INPUT_STYLE: CSSProperties = { ...VALUE_STYLE, cursor: 'not-allowed' };

const BUTTON: CSSProperties = {
  fontFamily: HEADLINE_FONT,
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.02em',
  border: 'none',
  borderRadius: 999,
  padding: '9px 18px',
  cursor: 'pointer',
  transition: 'background-color 0.15s, opacity 0.15s',
};
const PRIMARY_BUTTON: CSSProperties = { ...BUTTON, color: '#ffffff', backgroundColor: S.primary };
const DESTRUCTIVE_BUTTON: CSSProperties = { ...BUTTON, color: S.error, backgroundColor: S.errorContainer };

const StatusBanner: FC<{ kind: Status['kind']; children: ReactNode }> = ({ kind, children }) => {
  const { bg, fg, Icon } = kind === 'success'
    ? { bg: S.successContainer, fg: S.success, Icon: Check }
    : kind === 'error'
      ? { bg: S.errorContainer, fg: S.onErrorContainer, Icon: AlertCircle }
      : { bg: S.surfaceLow, fg: S.primary, Icon: Info };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 10,
      backgroundColor: bg, color: fg,
      fontSize: 12.5, fontWeight: 500,
    }}>
      <Icon size={14} strokeWidth={2.25} />
      <span>{children}</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Account: profile
// ═══════════════════════════════════════════════════════════════════

const ProfileSection: FC<{ role: Role }> = ({ role }) => {
  const { user, isLoaded } = useUser();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  // The form follows the Clerk user: it is filled in the render that first
  // sees the user, and again whenever Clerk hands over a new user object
  // (after a save, for instance).
  const [syncedUser, setSyncedUser] = useState<typeof user>(undefined);
  if (user && syncedUser !== user) {
    setSyncedUser(user);
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
  }

  if (!isLoaded || !user) {
    return <SectionCard title="Profile" icon={User}><Muted>Loading…</Muted></SectionCard>;
  }

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await user.update({ firstName, lastName });
      setStatus({ kind: 'success', message: 'Profile updated.' });
    } catch (err) {
      setStatus({ kind: 'error', message: errorText(err, 'Failed to update profile.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="Identity"
      icon={User}
      description="Your identity is managed by Clerk. You can change your name here, not your email address."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Email">
          <input type="email" value={user.primaryEmailAddress?.emailAddress ?? NO_VALUE} readOnly style={READONLY_INPUT_STYLE} />
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
          <SubBlock label="Role">
            <div style={{ padding: '9px 12px' }}>
              <RolePill role={role} />
            </div>
          </SubBlock>
          <Field label="Member since">
            <input type="text" value={fmtDate(user.createdAt)} readOnly style={READONLY_INPUT_STYLE} />
          </Field>
        </div>
        {status && <StatusBanner kind={status.kind}>{status.message}</StatusBanner>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={save} disabled={saving} style={{ ...PRIMARY_BUTTON, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </SectionCard>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Account: password
// ═══════════════════════════════════════════════════════════════════

const PasswordSection: FC = () => {
  const { user, isLoaded } = useUser();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  if (!isLoaded || !user) {
    return <SectionCard title="Password" icon={KeyRound}><Muted>Loading…</Muted></SectionCard>;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
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
      // Clerk puts its readable explanation in errors[0].longMessage.
      const clerk = err as { errors?: Array<{ longMessage?: string; message?: string }> };
      const message = clerk.errors?.[0]?.longMessage ?? clerk.errors?.[0]?.message;
      setStatus({ kind: 'error', message: message ?? errorText(err, 'Failed to update password.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="Change password"
      icon={KeyRound}
      description={'Use a strong, unique password of at least 8 characters. Forgotten your current password? Sign out and choose "Forgot password?" on the sign-in page.'}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="submit" disabled={saving} style={{ ...PRIMARY_BUTTON, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
    </SectionCard>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Account: active sessions
// ═══════════════════════════════════════════════════════════════════

type ClerkUser = NonNullable<ReturnType<typeof useUser>['user']>;
/** One of the user's active sessions, on any device, with its latest activity. */
type DeviceSession = Awaited<ReturnType<ClerkUser['getSessions']>>[number];

const SessionsSection: FC = () => {
  const { user } = useUser();
  const { session: currentSession } = useSession();
  const { signOut } = useClerk();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  // user.getSessions() lists the user's sessions on every device; the
  // browser's own session list would show this browser only.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    user.getSessions().then(
      (list) => { if (!cancelled) setSessions(list); },
      (err: unknown) => {
        if (cancelled) return;
        setSessions([]);
        setStatus({ kind: 'error', message: errorText(err, 'Failed to load sessions.') });
      },
    );
    return () => { cancelled = true; };
  }, [user]);

  if (!sessions) {
    return <SectionCard title="Active sessions" icon={Monitor}><Muted>Loading…</Muted></SectionCard>;
  }

  const others = sessions.filter((s) => s.id !== currentSession?.id);

  const revoke = async (session: DeviceSession) => {
    setRevokingId(session.id);
    setStatus(null);
    try {
      await session.revoke();
      setSessions((list) => list && list.filter((s) => s.id !== session.id));
      setStatus({ kind: 'success', message: 'Session revoked.' });
    } catch (err) {
      setStatus({ kind: 'error', message: errorText(err, 'Failed to revoke session.') });
    } finally {
      setRevokingId(null);
    }
  };

  // Every other device first, then this browser, which lands on /sign-in.
  const signOutEverywhere = async () => {
    setSigningOutAll(true);
    setStatus(null);
    try {
      await Promise.all(others.map((s) => s.revoke()));
      await signOut({ redirectUrl: '/sign-in' });
    } catch (err) {
      setStatus({ kind: 'error', message: errorText(err, 'Failed to sign out.') });
      setSigningOutAll(false);
    }
  };

  const sorted = [...sessions].sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard
        title={`Active sessions (${sorted.length})`}
        icon={Monitor}
        description="Each device or browser where you are signed in appears here. Revoke any you don't recognize."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.length === 0 && <Muted>No active sessions.</Muted>}
          {sorted.map((s) => {
            const isCurrent = currentSession?.id === s.id;
            const activity = s.latestActivity;
            const location = [activity?.city, activity?.country].filter(Boolean).join(', ') || 'Location unknown';
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
                    <span>{activity?.deviceType || 'Device'} · {activity?.browserName || 'Browser'}</span>
                    {isCurrent && (
                      <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: S.primary, color: '#fff' }}>
                        This device
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: S.mutedText, marginTop: 2 }}>
                    {location} · Last active {fmtDateTime(s.lastActiveAt)}
                  </div>
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => revoke(s)}
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
        description="End every session on every device, this one included. You'll need to sign in again."
      >
        <button
          onClick={signOutEverywhere}
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
// Model configuration (read-only)
// ═══════════════════════════════════════════════════════════════════

const FORCE_ABBR: Record<ForceName, string> = {
  Consumer: 'Cons.', Customer: 'Cust.', Technology: 'Tech.',
  Government: 'Gov.', Environmental: 'Env.', Competitive: 'Comp.',
};
const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);

/** A number to fixed digits; the missing-value mark when there is none. */
const fixed = (v: number | undefined, digits: number): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : NO_VALUE;

/** A share in percent with two decimals: several cells hold less than 0.1 %. */
const pct2 = (share: number): string => (share * 100).toFixed(2);

const CELL_TH: CSSProperties = {
  fontFamily: HEADLINE_FONT, fontSize: 10.5, fontWeight: 800,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: S.onSurfaceVariant, backgroundColor: S.surfaceContainer,
  padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap',
};
const CELL_LABEL: CSSProperties = {
  ...CELL_TH,
  textAlign: 'left', backgroundColor: S.surfaceLow,
  position: 'sticky', left: 0, zIndex: 1,
};
const ROW_LABEL: CSSProperties = {
  ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}`,
  textTransform: 'none', letterSpacing: 0, fontSize: 11.5,
};
const CELL_NUM: CSSProperties = {
  fontFamily: MONO_FONT, fontSize: 12, color: S.onSurface,
  padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  borderTop: `1px solid ${S.cardBorder}`,
};
const CELL_SUM: CSSProperties = { ...CELL_NUM, fontWeight: 700, color: S.onSurfaceVariant };

/** Scrolls a wide table sideways instead of clipping it. */
const TableScroller: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
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

/** Per-force values: one row per parameter, one column per force. */
const ForceRowsTable: FC<{
  label: string;
  rows: Array<{ name: string; values: Record<ForceName, number> }>;
}> = ({ label, rows }) => (
  <TableScroller label={label}>
    <thead>
      <tr>
        <th style={{ ...CELL_LABEL, backgroundColor: S.surfaceContainer }} aria-label="Parameter" />
        {FORCES.map((f) => <th key={f} style={CELL_TH} title={f}>{FORCE_ABBR[f]}</th>)}
      </tr>
    </thead>
    <tbody>
      {rows.map(({ name, values }) => (
        <tr key={name}>
          <th scope="row" style={ROW_LABEL}>{name}</th>
          {FORCES.map((f) => <td key={f} style={CELL_NUM}>{fixed(values[f], 3)}</td>)}
        </tr>
      ))}
    </tbody>
  </TableScroller>
);

/** A 6 x 6 force matrix, read row by column. */
const ForceMatrixTable: FC<{
  matrix: Record<ForceName, Record<ForceName, number>>;
  digits: number;
  /** The overlap matrix has no diagonal of its own: the within-force overlap covers it. */
  hideDiagonal?: boolean;
  label: string;
}> = ({ matrix, digits, hideDiagonal = false, label }) => (
  <TableScroller label={label}>
    <thead>
      <tr>
        <th style={{ ...CELL_LABEL, backgroundColor: S.surfaceContainer, textTransform: 'none', letterSpacing: 0 }}>
          row \ col
        </th>
        {FORCES.map((f) => <th key={f} style={CELL_TH} title={f}>{FORCE_ABBR[f]}</th>)}
      </tr>
    </thead>
    <tbody>
      {FORCES.map((row) => (
        <tr key={row}>
          <th scope="row" style={{ ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}` }}>{row}</th>
          {FORCES.map((col) => (
            <td key={col} style={{ ...CELL_NUM, color: row === col ? S.mutedText : S.onSurface }}>
              {row === col && hideDiagonal ? NO_VALUE : fixed(matrix[row]?.[col], digits)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </TableScroller>
);

const PARAM_GRID: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12,
};

/** The code's parameters, from GET /api/v1/config. */
const ParameterCards: FC<{ config: ModelConfig }> = ({ config }) => {
  const years = config.path_years;
  const horizon = years.length
    ? `${years[0]}–${years[years.length - 1]} · ${years.length} years`
    : NO_VALUE;
  const jitter = config.peak_year_jitter;
  return (
    <>
      <SectionCard
        title="Simulation parameters"
        icon={SlidersHorizontal}
        description="The engine's defaults, as the code sets them."
      >
        <div style={PARAM_GRID}>
          <SubBlock label="Path horizon" hint="Relative-shift paths over these years.">
            <div style={VALUE_STYLE}>{horizon}</div>
          </SubBlock>
          <SubBlock label="Base year" hint="Materialisation anchor.">
            <div style={VALUE_STYLE}>{config.base_year}</div>
          </SubBlock>
          <SubBlock
            label="Peak-year jitter"
            hint={jitter > 0
              ? `Each iteration moves every driver's peak year by up to the width its uncertainty score sets, 0 to 4 years (±${jitter} for a driver without a score).`
              : 'Every driver peaks in its scored year in every iteration.'}
          >
            <div style={VALUE_STYLE}>{jitter > 0 ? 'On' : 'Off'}</div>
          </SubBlock>
        </div>
      </SectionCard>

      <SectionCard
        title="Copula dependence (Gaussian)"
        icon={SlidersHorizontal}
        description="How driver correlations flow through the Monte Carlo. The correlations are latent-scale: they set the co-movement of the underlying Gaussian variables, not of the delivered Beta scores, so the realised score-to-score correlation is a little lower (about 0.28 for a latent 0.30). They lie between 0 and 1, so negative dependence cannot be expressed. The production run refuses a setting that is not positive definite on the loaded drivers rather than repairing it silently."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={PARAM_GRID}>
            <SubBlock label="Within-force ρ" hint="Correlation between two drivers of the same force.">
              <div style={VALUE_STYLE}>{fixed(config.within_force_rho, 2)}</div>
            </SubBlock>
          </div>
          <SubBlock
            label="Force correlation matrix"
            hint="Correlation between drivers of two forces; positive definite as entered on the current drivers. A force pair the matrix does not name takes 0.05."
          >
            <ForceMatrixTable matrix={config.force_correlation_matrix} digits={2} label="Force correlation matrix" />
          </SubBlock>
        </div>
      </SectionCard>

      <SectionCard
        title="Attenuation & overlap"
        icon={SlidersHorizontal}
        description={`The engine dampens each force's combined driver effect with a per-force attenuation, 0.5 × (1 − mean between-force overlap of that force's row), and dampens the drivers within a force by their within-force overlap, for the mechanisms they share. Source: ${config.attenuation_source}, a structured-judgment overlap correction built on the drivers' category exposures.`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ForceRowsTable
            label="Per-force attenuation and within-force overlap"
            rows={[
              { name: 'Attenuation', values: config.per_force_attenuation },
              { name: 'Within-force overlap', values: config.within_force_overlap },
            ]}
          />
          <SubBlock
            label="Between-force overlap matrix"
            hint="The input the attenuation is derived from; the engine reads the attenuation. Read row → column: the share of the row force's signal already captured by the column force. Asymmetric by design (a narrow force is covered by a broad one more than the other way round), bounded 0–0.45. The within-force overlap above covers the diagonal."
          >
            <ForceMatrixTable matrix={config.force_overlap_matrix} digits={3} hideDiagonal label="Between-force overlap matrix" />
          </SubBlock>
        </div>
      </SectionCard>
    </>
  );
};

// ── How the estimated mix is built ──────────────────────────────────
// Every number comes from the generated record (lib/cellWeightProvenance.ts);
// none is repeated here.

const GRADE_COLOR: Record<Grade, { bg: string; fg: string }> = {
  B: { bg: S.successContainer, fg: S.success },
  E: { bg: S.amberContainer, fg: S.onAmberContainer },
  G: { bg: S.errorContainer, fg: S.onErrorContainer },
};

const GradeChip: FC<{ grade: Grade }> = ({ grade }) => (
  <span
    title={`${grade}: ${GRADE_LEGEND[grade]}`}
    style={{
      display: 'inline-block', minWidth: 10, textAlign: 'center',
      fontFamily: MONO_FONT, fontSize: 10, fontWeight: 700,
      padding: '1px 7px', borderRadius: 999,
      backgroundColor: GRADE_COLOR[grade].bg, color: GRADE_COLOR[grade].fg,
    }}
  >
    {grade}
  </span>
);

const PROV_TEXT: CSSProperties = { fontSize: 11.5, lineHeight: 1.6, color: S.mutedText };
const PROV_HEAD: CSSProperties = {
  fontFamily: HEADLINE_FONT, fontSize: 10.5, fontWeight: 800,
  letterSpacing: '0.06em', textTransform: 'uppercase', color: S.onSurfaceVariant,
};
const PROV_TH_LEFT: CSSProperties = { ...CELL_TH, textAlign: 'left' };
const PROV_TH_MID: CSSProperties = { ...CELL_TH, textAlign: 'center' };
const PROV_GROUP_ROW: CSSProperties = {
  ...CELL_TH, textAlign: 'left', textTransform: 'none', letterSpacing: '0.03em',
  fontSize: 11, borderTop: `1px solid ${S.cardBorder}`,
};
const PROV_NUM: CSSProperties = {
  fontFamily: MONO_FONT, fontSize: 11.5, color: S.onSurface,
  padding: '5px 10px', textAlign: 'right', whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${S.cardBorder}`,
};
const PROV_ROW_LABEL: CSSProperties = {
  fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700, color: S.onSurface,
  padding: '5px 10px', textAlign: 'left', whiteSpace: 'nowrap',
  borderTop: `1px solid ${S.cardBorder}`,
};
const PROV_GRADE_CELL: CSSProperties = {
  padding: '5px 10px', textAlign: 'center', borderTop: `1px solid ${S.cardBorder}`,
};
const PROV_NOTE_CELL: CSSProperties = {
  fontSize: 10.5, lineHeight: 1.5, color: S.mutedText,
  padding: '5px 10px', textAlign: 'left', minWidth: 210,
  borderTop: `1px solid ${S.cardBorder}`,
};

/** `obj`'s keys in the given order first, then any others. */
const orderedKeys = (obj: Record<string, unknown>, order: string[]): string[] => [
  ...order.filter((k) => k in obj),
  ...Object.keys(obj).filter((k) => !order.includes(k)),
];

const BLOCK_SHARES: Record<string, number> = BLOCK_SPLIT.shares;
const PROV_CATEGORIES = orderedKeys(CATEGORY_MIX, CATEGORY_NAMES);
const PROV_REGION_CATEGORIES = orderedKeys(REGION_MIX, CATEGORY_NAMES);
const PROV_REGIONS = Object.keys(ESTIMATE_MARGINALS.region);
const PROV_CELL_COUNT = PROV_CATEGORIES.length * PROV_REGIONS.length;
const PROV_REGION_LINE = Object.entries(ESTIMATE_MARGINALS.region)
  .map(([r, w]) => `${r} ${fmtPct(w)}`).join(' · ');
const PROV_TOP_CATEGORIES = Object.entries(ESTIMATE_MARGINALS.category)
  .sort((a, b) => b[1] - a[1]).slice(0, 3)
  .map(([c, w]) => `${c} ${fmtPct(w)}`).join(' · ');

/** The graded derivation of the estimated mix. */
const CellWeightProvenance: FC = () => (
  <details style={{
    border: `1px solid ${S.cardBorder}`, borderRadius: 10,
    backgroundColor: S.surfaceLow, padding: '10px 12px',
  }}>
    <summary style={{
      cursor: 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11.5,
      fontWeight: 700, color: S.onSurfaceVariant,
    }}>
      How these {PROV_CELL_COUNT} shares were built: {PROV_CATEGORIES.length} category mixes,{' '}
      {Object.keys(MARGIN_INDEX).length} margin indices, {PROV_REGION_CATEGORIES.length} regional mixes, each graded
    </summary>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
      <div style={PROV_TEXT}>
        These {PROV_CELL_COUNT} shares are an <strong>estimate</strong> of the HCB gross-profit mix, built from
        public reporting and category knowledge. They are not Henkel P&amp;L: a finance file passed
        to <code>scripts/run_production.py --cell-weights</code> replaces them. Each cell is the category's share
        of its block, times the block's share of HCB, times a GP1 margin index, times that category's own
        regional mix, normalised to 1.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {(Object.keys(GRADE_LEGEND) as Grade[]).map((g) => (
          <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <GradeChip grade={g} />
            <span style={{ fontSize: 10.5, lineHeight: 1.5, color: S.mutedText }}>{GRADE_LEGEND[g]}</span>
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={PROV_HEAD}>Block split</span>
        <TableScroller label="Block split: each block's share of HCB gross profit">
          <thead>
            <tr>
              {Object.keys(BLOCK_SHARES).map((b) => <th key={b} style={CELL_TH}>{b}</th>)}
              <th style={PROV_TH_MID}>Grade</th>
              <th style={PROV_TH_LEFT}>Basis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {Object.entries(BLOCK_SHARES).map(([b, w]) => <td key={b} style={PROV_NUM}>{fmtPct(w)}</td>)}
              <td style={PROV_GRADE_CELL}><GradeChip grade={BLOCK_SPLIT.grade} /></td>
              <td style={PROV_NOTE_CELL}>{BLOCK_SPLIT.note}</td>
            </tr>
          </tbody>
        </TableScroller>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={PROV_HEAD}>Category mix and GP1 margin index</span>
        <span style={PROV_TEXT}>{MARGIN_INDEX_NOTE}</span>
        <TableScroller label="Category mix: each category's share of its block and its GP1 margin index">
          <thead>
            <tr>
              <th style={PROV_TH_LEFT}>Category</th>
              <th style={CELL_TH} title="The category's share of its block, before the margin index and the regional mix">
                Share of block
              </th>
              <th style={PROV_TH_MID}>Grade</th>
              <th style={CELL_TH} title="GP1 gross margin relative to the HCB average (1.00 = average)">
                GP1 index
              </th>
              <th style={PROV_TH_MID}>Grade</th>
              <th style={PROV_TH_LEFT}>Basis</th>
            </tr>
          </thead>
          {Object.keys(BLOCK_SHARES).map((b) => (
            <tbody key={b}>
              <tr>
                <td colSpan={6} style={PROV_GROUP_ROW}>
                  {b} · {fmtPct(BLOCK_SHARES[b])} of HCB gross profit
                </td>
              </tr>
              {PROV_CATEGORIES.filter((c) => CATEGORY_MIX[c].block === b).map((c) => {
                const mix = CATEGORY_MIX[c];
                const margin = MARGIN_INDEX[c];
                return (
                  <tr key={c}>
                    <td style={PROV_ROW_LABEL}>{c}</td>
                    <td style={PROV_NUM}>{fmtPct(mix.shareOfBlock)}</td>
                    <td style={PROV_GRADE_CELL}><GradeChip grade={mix.grade} /></td>
                    <td style={PROV_NUM}>{margin ? margin.index.toFixed(2) : ''}</td>
                    <td style={PROV_GRADE_CELL}>{margin ? <GradeChip grade={margin.grade} /> : null}</td>
                    <td style={PROV_NOTE_CELL}>{mix.note}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </TableScroller>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={PROV_HEAD}>Regional mix inside each category</span>
        <span style={PROV_TEXT}>{REGION_MIX_NOTE}</span>
        <TableScroller label="Region mix: each category's own regional split, the reason the matrix is not separable">
          <thead>
            <tr>
              <th style={PROV_TH_LEFT}>Category</th>
              {PROV_REGIONS.map((r) => <th key={r} style={CELL_TH}>{r}</th>)}
              <th style={PROV_TH_MID}>Grade</th>
              <th style={PROV_TH_LEFT}>Basis</th>
            </tr>
          </thead>
          <tbody>
            {PROV_REGION_CATEGORIES.map((c) => {
              const rm = REGION_MIX[c];
              return (
                <tr key={c}>
                  <td style={PROV_ROW_LABEL}>{c}</td>
                  {PROV_REGIONS.map((r) => <td key={r} style={PROV_NUM}>{fmtPct(rm.mix[r] ?? 0)}</td>)}
                  <td style={PROV_GRADE_CELL}><GradeChip grade={rm.grade} /></td>
                  <td style={PROV_NOTE_CELL}>{rm.note}</td>
                </tr>
              );
            })}
          </tbody>
        </TableScroller>
      </div>

      <div style={PROV_TEXT}>
        Normalised, the estimate lands on {PROV_REGION_LINE} of the gross-profit pool. Europe's share is the
        number that matters most, because each category is rolled up on its own regional mix, so the region
        split is what moves the category results. The heaviest categories are {PROV_TOP_CATEGORIES}.
      </div>
      <div style={{ fontFamily: MONO_FONT, fontSize: 10, color: S.mutedText }}>
        estimate version {ESTIMATE_VERSION}
      </div>
    </div>
  </details>
);

const BasisBadge: FC<{ estimate: boolean }> = ({ estimate }) => (
  <span
    title={estimate
      ? 'An estimate of the HCB gross-profit mix from public reporting, not Henkel P&L'
      : 'The shares of the file the production run was given; its label says where they come from'}
    style={{
      fontFamily: MONO_FONT, fontSize: 10.5, fontWeight: 700,
      padding: '2px 8px', borderRadius: 999,
      backgroundColor: estimate ? S.amberContainer : S.surfaceLow,
      color: estimate ? S.onAmberContainer : S.onSurfaceVariant,
    }}
  >
    {estimate ? 'Estimated HCB mix' : 'From a weights file'}
  </span>
);

/** The served run's cell weights with their marginals and where they come from. */
const RunCellWeights: FC<{ run: SimulationResult }> = ({ run }) => {
  const m = cellMarginals(run.cell_weights_used, CATEGORY_NAMES, run.decompositions.dimensions.regions);
  // The run's own label says what the weights are; the graded derivation
  // below documents the current estimate, so it shows only when the run's
  // shares are that estimate.
  const estimate = cellWeightsBasis(run.cell_weights_source) === 'estimate';
  const documented = estimate && m.matchesEstimate;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...LABEL_STYLE, fontWeight: 800, letterSpacing: '0.08em' }}>
          Cell weights of run #{run.run_meta.run_id}: share of HCB gross profit per category × region (%)
        </span>
        <BasisBadge estimate={estimate} />
      </div>
      {!estimate && (
        <div style={{ fontSize: 11.5, lineHeight: 1.55, color: S.onSurfaceVariant }}>
          Source: {run.cell_weights_source}
        </div>
      )}
      <TableScroller label="Cell weights: share of HCB gross profit per category and region">
        <thead>
          <tr>
            <th style={CELL_LABEL}>Category</th>
            {m.regions.map((r) => <th key={r} style={CELL_TH}>{r}</th>)}
            <th style={CELL_TH} title="Row sum: the category's share of the pool">Σ category</th>
          </tr>
        </thead>
        <tbody>
          {m.categories.map((c) => (
            <tr key={c}>
              <th scope="row" style={{ ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}` }}>{c}</th>
              {m.regions.map((r) => <td key={r} style={CELL_NUM}>{pct2(run.cell_weights_used[c]?.[r] ?? 0)}</td>)}
              <td style={CELL_SUM}>{pct2(m.rowSums[c])}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" style={{ ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}` }} title="Column sum: the region's share of the pool">
              Σ region
            </th>
            {m.regions.map((r) => <td key={r} style={CELL_SUM}>{pct2(m.colSums[r])}%</td>)}
            <td style={{ ...CELL_SUM, fontWeight: 800 }}>{pct2(m.total)}%</td>
          </tr>
        </tfoot>
      </TableScroller>
      <div style={{ fontSize: 11.5, color: S.mutedText, lineHeight: 1.55 }}>
        {estimate ? (
          <>
            <strong>An estimate from public reporting, not Henkel P&amp;L.</strong> A finance file passed
            to <code>scripts/run_production.py --cell-weights</code> replaces it.
            {!documented && ' This run used an earlier version of the estimate than the one documented below this dashboard version.'}
          </>
        ) : (
          <>These shares come from the file the production run was given (<code>scripts/run_production.py --cell-weights</code>); the source above says what it holds.</>
        )}{' '}
        Only shares enter PRISM, never euro figures. A cell with share 0 contributes nothing to the roll-up
        however exposed its drivers are: HCB's presence in a region enters here, not through the exposures.
      </div>
      {documented && <CellWeightProvenance />}
    </div>
  );
};

const ModelSection: FC = () => {
  const { config, configError, simulation, simulationError, loading } = usePrism();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <StatusBanner kind="info">
        Read-only: a parameter change is a code change followed by a production run.
      </StatusBanner>

      {config ? <ParameterCards config={config} /> : (
        <SectionCard title="Simulation parameters" icon={SlidersHorizontal}>
          <Muted>
            {loading ? 'Loading the configuration…'
              : configError ? `The model configuration could not be loaded: ${configError}`
                : 'No model configuration is available yet.'}
          </Muted>
        </SectionCard>
      )}

      <SectionCard
        title="Aggregation weights"
        icon={SlidersHorizontal}
        description="Force weights scale each force's contribution before the forces compound. A run rolls its category × region cells up with one matrix of gross-profit shares: a category's shift is the share-weighted mean of its row, the portfolio's the share-weighted sum of all cells. Row sums are the category shares, column sums the region shares. The value-chain lens carries no weights: it assigns each driver wholly to its epicentre stage."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {config && (
            <SubBlock label="Force weights">
              <ForceRowsTable label="Force weights" rows={[{ name: 'Weight', values: config.force_weights }]} />
            </SubBlock>
          )}
          {simulation ? <RunCellWeights run={simulation} /> : (
            <Muted>
              {loading ? 'Loading the run…'
                : simulationError ? `The run could not be loaded, so its cell weights cannot be shown: ${simulationError}`
                  : 'There is no run yet, so there are no cell weights to show.'}
            </Muted>
          )}
        </div>
      </SectionCard>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Administration: user management
// ═══════════════════════════════════════════════════════════════════

const USER_GRID = '2fr 1.2fr 0.8fr 1fr 0.8fr';

const UsersSection: FC<{ currentUserId: string | null }> = ({ currentUserId }) => {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getUsers().then(
      (res) => { if (!cancelled) setUsers(res.users); },
      (err: unknown) => {
        if (cancelled) return;
        setUsers([]);
        setStatus({ kind: 'error', message: errorText(err, 'Failed to load users.') });
      },
    );
    return () => { cancelled = true; };
  }, []);

  const changeRole = async (userId: string, role: Role) => {
    setUpdatingId(userId);
    setStatus(null);
    try {
      const saved = await api.setUserRole(userId, role);
      setUsers((list) => list && list.map((u) => (u.id === userId ? { ...u, role: saved.role } : u)));
      setStatus({ kind: 'success', message: 'Role updated.' });
    } catch (err) {
      setStatus({ kind: 'error', message: errorText(err, 'Failed to update role.') });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <SectionCard
      title={`All users${users?.length ? ` (${users.length})` : ''}`}
      icon={UsersIcon}
      description="Promote teammates to admin or demote them to viewer. Admins edit drivers and Consumer Journey content and manage users; viewers have read-only access."
    >
      {users === null ? (
        <Muted>Loading users…</Muted>
      ) : users.length === 0 ? (
        <Muted>No users returned from the directory.</Muted>
      ) : (
        <div style={{
          border: `1px solid ${S.cardBorder}`, borderRadius: 12, overflow: 'hidden',
          backgroundColor: S.surface,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: USER_GRID,
            padding: '10px 14px',
            backgroundColor: S.surfaceContainer,
            fontFamily: HEADLINE_FONT,
            fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: S.onSurfaceVariant,
          }}>
            <span>User</span>
            <span>Name</span>
            <span>Role</span>
            <span>Last sign-in</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>
          {users.map((u) => {
            const isSelf = currentUserId === u.id;
            const locked = updatingId === u.id || isSelf;
            return (
              <div
                key={u.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: USER_GRID,
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
                <span style={{ color: S.mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[u.firstName, u.lastName].filter(Boolean).join(' ') || NO_VALUE}
                </span>
                <span><RolePill role={u.role} /></span>
                <span style={{ color: S.mutedText }}>{fmtDate(u.lastSignInAt)}</span>
                <span style={{ textAlign: 'right' }}>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value as Role)}
                    disabled={locked}
                    aria-label={`Role of ${u.email}`}
                    title={isSelf ? "You can't change your own role." : 'Change role'}
                    style={{
                      ...INPUT_STYLE,
                      padding: '5px 10px',
                      fontSize: 12,
                      opacity: locked ? 0.55 : 1,
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
  );
};

// ═══════════════════════════════════════════════════════════════════
// The dialog
// ═══════════════════════════════════════════════════════════════════

const RAIL_HEADING: CSSProperties = {
  padding: '4px 10px 6px',
  fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 800,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: S.onSurfaceVariant,
  display: 'flex', alignItems: 'center', gap: 6,
};

const RailButton: FC<{ section: SectionDef; active: boolean; onSelect: () => void }> = ({ section, active, onSelect }) => {
  const Icon = section.icon;
  return (
    <button
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 10,
        backgroundColor: active ? S.primaryContainer : 'transparent',
        color: active ? S.onPrimaryContainer : S.onSurface,
        border: 'none', cursor: 'pointer',
        textAlign: 'left',
        fontFamily: BODY_FONT,
        fontSize: 13, fontWeight: active ? 600 : 500,
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = S.surfaceLow; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <Icon size={15} strokeWidth={2.25} />
      {section.label}
    </button>
  );
};

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

const SettingsModal: FC<SettingsModalProps> = ({ open, onClose, isAdmin }) => {
  const { user, isLoaded } = useUser();
  const [chosen, setChosen] = useState<SectionId>('profile');
  const modalRef = useRef<HTMLDivElement | null>(null);
  useOverlay(open, onClose, modalRef);

  const role: Role = isAdmin ? 'admin' : 'viewer';
  const groups = GROUPS.filter((g) => !g.adminOnly || isAdmin);
  const visible = SECTIONS.filter((s) => groups.some((g) => g.id === s.group));
  // A chosen section the role now hides gives way to the first visible one.
  const active = visible.find((s) => s.id === chosen) ?? visible[0];

  const renderSection = () => {
    switch (active.id) {
      case 'profile':  return <ProfileSection role={role} />;
      case 'password': return <PasswordSection />;
      case 'sessions': return <SessionsSection />;
      case 'model':    return <ModelSection />;
      case 'users':    return <UsersSection currentUserId={user?.id ?? null} />;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
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
              // The explicit row size keeps both panes inside the dialog: an
              // implicit row would grow with its content, the dialog would clip
              // it and <main> would never scroll.
              gridTemplateRows: 'minmax(0, 1fr)',
              fontFamily: BODY_FONT,
            }}
          >
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

              {groups.map((group) => (
                <div key={group.id} style={{ marginBottom: 16 }}>
                  <div style={RAIL_HEADING}>
                    {group.adminOnly && <ShieldCheck size={11} />}
                    {group.label}
                  </div>
                  <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {visible.filter((s) => s.group === group.id).map((section) => (
                      <RailButton
                        key={section.id}
                        section={section}
                        active={section.id === active.id}
                        onSelect={() => setChosen(section.id)}
                      />
                    ))}
                  </nav>
                </div>
              ))}

              <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1px solid ${S.cardBorder}` }}>
                {isLoaded && user && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
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
                      <div style={{ fontSize: 11, color: S.mutedText }}>{role}</div>
                    </div>
                  </div>
                )}
              </div>
            </aside>

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
                    {active.label}
                  </div>
                  <div style={{ fontSize: 12, color: S.mutedText, marginTop: 2 }}>{active.subtitle}</div>
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
