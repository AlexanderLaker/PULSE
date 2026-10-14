/**
 * User management, for admins: every user with their access, pending users
 * first. Choosing a new access for a user asks for a confirmation first, so a
 * stray key on the list changes nobody; the question is announced to a
 * screen reader, and the list keeps showing the saved access until the
 * change is confirmed. Giving a pending user a role approves them; setting a
 * user back to pending takes their role away. Both go through the
 * dashboard's own route (lib/roles.ts), which refuses an admin's change of
 * their own role; they send the access the list shows, so the route also
 * refuses a change made on a list that is out of date, and the list then
 * loads again.
 */
import { useCallback, useEffect, useState, type FC } from 'react';
import { UsersIcon } from 'lucide-react';
import * as api from '@/lib/apiClient';
import type { ManagedUser } from '@/lib/apiClient';
import SectionCard from '@/components/dashboard/SectionCard';
import { S, HEADLINE_FONT } from '@/lib/theme';
import { NO_VALUE, fmtDate } from '@/lib/format';
import type { Access } from '@/types';
import {
  DESTRUCTIVE_BUTTON, errorText, INPUT_STYLE, Muted, PRIMARY_BUTTON, RolePill, type Status, StatusBanner,
} from './parts';

const USER_GRID = '2fr 1.2fr 0.8fr 1fr 0.8fr';

const article = (access: Access) => (access === 'admin' ? 'an admin' : 'a viewer');

/** The question the confirmation asks before a change of access. */
function confirmation(user: ManagedUser, to: Access): string {
  if (user.role === 'pending') return `Approve ${user.email} as ${article(to)}?`;
  if (to === 'pending') {
    return `Take access away from ${user.email}? From their next page load they see the waiting page.`;
  }
  return `Make ${user.email} ${article(to)}?`;
}

export const UsersSection: FC<{ currentUserId: string | null }> = ({ currentUserId }) => {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  // The change chosen in a user's list, waiting for its confirmation.
  const [draft, setDraft] = useState<{ id: string; to: Access } | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  // Loads the list; `cancelled` lets an effect drop an answer that comes after it ended.
  const loadUsers = useCallback((cancelled: () => boolean = () => false) => api.getUsers().then(
    (res) => { if (!cancelled()) setUsers(res.users); },
    (err: unknown) => {
      if (cancelled()) return;
      setUsers([]);
      setStatus({ kind: 'error', message: errorText(err, 'Failed to load users.') });
    },
  ), []);

  useEffect(() => {
    let cancelled = false;
    void loadUsers(() => cancelled);
    return () => { cancelled = true; };
  }, [loadUsers]);

  const changeAccess = async (user: ManagedUser, next: Access) => {
    setDraft(null);
    setUpdatingId(user.id);
    setStatus(null);
    try {
      const saved = next === 'pending'
        ? await api.revokeUserRole(user.id, user.role)
        : await api.setUserRole(user.id, next, user.role);
      setUsers((list) => list && list.map((u) => (u.id === user.id ? { ...u, role: saved.role } : u)));
      setStatus({
        kind: 'success',
        message: saved.role === 'pending'
          ? `${user.email} is pending again: from their next page load they see the waiting page, and a dashboard they have open loses access within 30 minutes.`
          : user.role === 'pending'
            ? `${user.email} is approved as ${saved.role}.`
            : 'Role updated.',
      });
    } catch (err) {
      if ((err as { code?: unknown }).code === 'changed') {
        // Someone changed this user's access, or the admin's own role, since the list was loaded.
        setStatus({
          kind: 'error',
          message: `The access of ${user.email}, or your own role, changed in the meantime. The list now shows the current state.`,
        });
        await loadUsers();
      } else {
        setStatus({ kind: 'error', message: errorText(err, 'Failed to update access.') });
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const pending = users?.filter((u) => u.role === 'pending').length ?? 0;
  const drafted = draft && users?.find((u) => u.id === draft.id);

  return (
    <SectionCard size="regular"
      title={`All users${users?.length ? ` (${users.length}${pending ? `, ${pending} pending` : ''})` : ''}`}
      icon={UsersIcon}
      description="A new account is pending, and sees only a page saying that access awaits approval, until you give it a role here. Admins edit drivers and Consumer Journey content and manage users; viewers read everything and propose scores under Expert Rating. Setting a user back to pending takes their access away."
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
            <span>Access</span>
            <span>Last sign-in</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>
          {users.map((u) => {
            const isSelf = currentUserId === u.id;
            const locked = updatingId === u.id || isSelf;
            const chosen = draft?.id === u.id ? draft.to : null;
            const questionId = `confirm-${u.id}`;
            return (
              <div
                key={u.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: USER_GRID,
                  padding: '12px 14px',
                  borderTop: `1px solid ${S.cardBorder}`,
                  alignItems: 'center',
                  rowGap: 10,
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
                    onChange={(e) => {
                      const to = e.target.value as Access;
                      setDraft(to === u.role ? null : { id: u.id, to });
                    }}
                    disabled={locked}
                    aria-label={`Access of ${u.email}`}
                    aria-describedby={chosen ? questionId : undefined}
                    title={isSelf ? "You can't change your own role." : u.role === 'pending' ? 'Approve with a role' : 'Change access'}
                    style={{
                      ...INPUT_STYLE,
                      padding: '5px 10px',
                      fontSize: 12,
                      opacity: locked ? 0.55 : 1,
                      cursor: isSelf ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </span>
                {chosen && (
                  <div role="group" aria-label={`Confirm the change for ${u.email}`}
                    style={{
                      gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                      flexWrap: 'wrap', gap: 8,
                    }}>
                    <span id={questionId} style={{ marginRight: 'auto', color: S.onSurfaceVariant }}>
                      {confirmation(u, chosen)}
                    </span>
                    <button type="button" onClick={() => setDraft(null)}
                      style={{ ...PRIMARY_BUTTON, color: S.primary, backgroundColor: S.surfaceLow, padding: '6px 14px' }}>
                      Cancel
                    </button>
                    <button type="button" onClick={() => changeAccess(u, chosen)}
                      style={{ ...(chosen === 'pending' ? DESTRUCTIVE_BUTTON : PRIMARY_BUTTON), padding: '6px 14px' }}>
                      {chosen === 'pending' ? 'Take access away' : 'Confirm'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Says the confirmation's question to a screen reader as it appears. */}
      <p role="status" className="sr-only">
        {drafted ? `${confirmation(drafted, draft.to)} Confirm or cancel under the user's row.` : ''}
      </p>
      {status && (
        <div style={{ marginTop: 12 }}><StatusBanner kind={status.kind}>{status.message}</StatusBanner></div>
      )}
    </SectionCard>
  );
};
