/**
 * User management, for admins: every user with their role, and the change of
 * a role through the dashboard's own route (lib/roles.ts).
 */
import { useEffect, useState, type FC } from 'react';
import { UsersIcon } from 'lucide-react';
import * as api from '@/lib/apiClient';
import type { ManagedUser } from '@/lib/apiClient';
import SectionCard from '@/components/dashboard/SectionCard';
import { S, HEADLINE_FONT } from '@/lib/theme';
import { NO_VALUE, fmtDate } from '@/lib/format';
import type { Role } from '@/types';
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
    <SectionCard size="regular"
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
