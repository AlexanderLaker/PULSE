/**
 * The account sections of the Settings sheet: the profile, the password and
 * the active sessions, all read from and written to Clerk.
 */
import { useEffect, useId, useState, type FC, type FormEvent } from 'react';
import { User, KeyRound, Monitor, LogOut } from 'lucide-react';
import { useUser, useClerk, useSession } from '@clerk/nextjs';
import SectionCard from '@/components/dashboard/SectionCard';
import { S } from '@/lib/theme';
import { NO_VALUE, fmtDate, fmtDateTime } from '@/lib/format';
import { endSession } from '@/lib/session';
import type { Role } from '@/types';
import {
  DESTRUCTIVE_BUTTON, errorText, Field, INPUT_STYLE, Muted, PRIMARY_BUTTON, READONLY_INPUT_STYLE,
  RolePill, type Status, StatusBanner, SubBlock,
} from './parts';

/** Two fields side by side from md up, one under the other on a phone. */
const TWO_UP = 'grid grid-cols-1 md:grid-cols-2 gap-3';

// ═══════════════════════════════════════════════════════════════════
// Account: profile
// ═══════════════════════════════════════════════════════════════════

export const ProfileSection: FC<{ role: Role }> = ({ role }) => {
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
    return <SectionCard size="regular" title="Profile" icon={User}><Muted>Loading…</Muted></SectionCard>;
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
    <SectionCard size="regular"
      title="Identity"
      icon={User}
      description="Your identity is managed by Clerk. You can change your name here, not your email address."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Email">
          <input type="email" value={user.primaryEmailAddress?.emailAddress ?? NO_VALUE} readOnly style={READONLY_INPUT_STYLE} />
        </Field>
        <div className={TWO_UP}>
          <Field label="First name">
            <input
              type="text"
              name="given-name"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              style={INPUT_STYLE}
            />
          </Field>
          <Field label="Last name">
            <input
              type="text"
              name="family-name"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              style={INPUT_STYLE}
            />
          </Field>
        </div>
        <div className={TWO_UP}>
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
          <button type="button" onClick={save} disabled={saving} style={{ ...PRIMARY_BUTTON, opacity: saving ? 0.6 : 1 }}>
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

export const PasswordSection: FC = () => {
  const { user, isLoaded } = useUser();
  const hintId = useId();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  if (!isLoaded || !user) {
    return <SectionCard size="regular" title="Password" icon={KeyRound}><Muted>Loading…</Muted></SectionCard>;
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
    <SectionCard size="regular"
      title="Change password"
      icon={KeyRound}
      description={'Use a strong, unique password of at least 8 characters. Forgotten your current password? Sign out and choose "Forgot password?" on the sign-in page.'}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Current password">
          <input
            type="password"
            name="current-password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            style={INPUT_STYLE}
            required
          />
        </Field>
        <div className={TWO_UP}>
          <Field label="New password" hint="At least 8 characters." hintId={hintId}>
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              aria-describedby={hintId}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              style={INPUT_STYLE}
              required
              minLength={8}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              aria-describedby={hintId}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={INPUT_STYLE}
              required
              minLength={8}
            />
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

const SIGN_OUT_QUESTION_ID = 'sign-out-everywhere-question';

type ClerkUser = NonNullable<ReturnType<typeof useUser>['user']>;
/** One of the user's active sessions, on any device, with its latest activity. */
type DeviceSession = Awaited<ReturnType<ClerkUser['getSessions']>>[number];

export const SessionsSection: FC = () => {
  const { user } = useUser();
  const { session: currentSession } = useSession();
  const { signOut } = useClerk();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);
  // Sign out everywhere waits for a confirmation under its button.
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
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
    return <SectionCard size="regular" title="Active sessions" icon={Monitor}><Muted>Loading…</Muted></SectionCard>;
  }

  const others = sessions.filter((s) => s.id !== currentSession?.id);

  const revoke = async (session: DeviceSession) => {
    setRevokingId(session.id);
    setStatus(null);
    try {
      await session.revoke();
      setSessions((list) => list && list.filter((s) => s.id !== session.id));
      setStatus({ kind: 'success', message: 'Session revoked. That device loses access to PRISM data within 30 minutes.' });
    } catch (err) {
      setStatus({ kind: 'error', message: errorText(err, 'Failed to revoke session.') });
    } finally {
      setRevokingId(null);
    }
  };

  // Every other device first, then this browser, which lands on /sign-in.
  const signOutEverywhere = async () => {
    setConfirmingSignOut(false);
    setSigningOutAll(true);
    setStatus(null);
    try {
      await Promise.all(others.map((s) => s.revoke()));
      await endSession(() => signOut({ redirectUrl: '/sign-in' }));
    } catch (err) {
      setStatus({ kind: 'error', message: errorText(err, 'Failed to sign out.') });
      setSigningOutAll(false);
    }
  };

  const sorted = [...sessions].sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard size="regular"
        title={`Active sessions (${sorted.length})`}
        icon={Monitor}
        description="Each device or browser where you are signed in appears here. Revoke any you don't recognise."
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
                        style={{ backgroundColor: S.primary, color: S.onPrimary }}>
                        This device
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: S.mutedText, marginTop: 2 }}>
                    {location} · Last active {fmtDateTime(s.lastActiveAt)}
                  </div>
                </div>
                {!isCurrent && (
                  <button type="button"
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

      <SectionCard size="regular"
        title="Sign out everywhere"
        icon={LogOut}
        accent={S.error}
        description="End every session on every device, this one included. You'll need to sign in again. A device signed out this way can still read PRISM data for up to 30 minutes."
      >
        <button type="button"
          onClick={() => setConfirmingSignOut(true)}
          disabled={signingOutAll}
          aria-expanded={confirmingSignOut}
          aria-controls={confirmingSignOut ? SIGN_OUT_QUESTION_ID : undefined}
          style={{ ...DESTRUCTIVE_BUTTON, opacity: signingOutAll ? 0.6 : 1 }}
        >
          {signingOutAll ? 'Signing out…' : 'Sign out of every session'}
        </button>
        {confirmingSignOut && (
          <div id={SIGN_OUT_QUESTION_ID} role="group" aria-label="Confirm signing out of every session"
            style={{
              marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              flexWrap: 'wrap', gap: 8, fontSize: 12.5,
            }}>
            <span style={{ marginRight: 'auto', color: S.onSurfaceVariant }}>This signs you out here as well. Continue?</span>
            <button type="button" onClick={() => setConfirmingSignOut(false)}
              style={{ ...PRIMARY_BUTTON, color: S.primary, backgroundColor: S.surfaceLow, padding: '6px 14px' }}>
              Cancel
            </button>
            <button type="button" onClick={signOutEverywhere} style={{ ...DESTRUCTIVE_BUTTON, padding: '6px 14px' }}>
              Continue
            </button>
          </div>
        )}
        {/* Says the question to a screen reader as it appears. */}
        <p role="status" className="sr-only">
          {confirmingSignOut ? 'This signs you out here as well. Continue or cancel under the button.' : ''}
        </p>
      </SectionCard>
    </div>
  );
};
