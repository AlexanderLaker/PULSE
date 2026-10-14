/**
 * User management, for admins: every user with their access, pending users
 * first. Giving a pending user a role approves them; setting a user back to
 * pending takes their role away. Both go through the dashboard's own route
 * (lib/roles.ts), which also refuses an admin's change of their own role.
 */
import { useEffect, useState, type FC } from 'react';
import { UsersIcon } from 'lucide-react';
import * as api from '@/lib/apiClient';
import type { ManagedUser } from '@/lib/apiClient';
import SectionCard from '@/components/dashboard/SectionCard';
import { S, HEADLINE_FONT } from '@/lib/theme';
import { NO_VALUE, fmtDate } from '@/lib/format';
import type { Access } from '@/types';
import { errorText, INPUT_STYLE, Muted, RolePill, type Status, StatusBanner } from './parts';

const USER_GRID = '2fr 1.2fr 0.8fr 1fr 0.8fr';

export const UsersSection: FC<{ currentUserId: string | null }> = ({ currentUserId }) => {
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

  const changeAccess = async (user: ManagedUser, next: Access) => {
    setUpdatingId(user.id);
    setStatus(null);
    try {
      const saved = next === 'pending'
        ? await api.revokeUserRole(user.id)
        : await api.setUserRole(user.id, next);
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
      setStatus({ kind: 'error', message: errorText(err, 'Failed to update access.') });
    } finally {
      setUpdatingId(null);
    }
  };

  const pending = users?.filter((u) => u.role === 'pending').length ?? 0;

  return (
    <SectionCard size="regular"
      title={`All users${users?.length ? ` (${users.length}${pending ? `, ${pending} pending` : ''})` : ''}`}
      icon={UsersIcon}
      description="A new account is pending, and sees only a page saying that access awaits approval, until you give it a role here. Admins edit drivers and Consumer Journey content and manage users; viewers have read-only access. Setting a user back to pending takes their access away."
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
                    onChange={(e) => changeAccess(u, e.target.value as Access)}
                    disabled={locked}
                    aria-label={`Access of ${u.email}`}
                    title={isSelf ? "You can't change your own role." : u.role === 'pending' ? 'Approve with a role' : 'Change role'}
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
