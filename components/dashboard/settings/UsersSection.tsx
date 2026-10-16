/**
 * User management, for admins: every user with their access, pending users
 * first. A pending user is approved with one of two buttons, as a viewer or
 * as an admin; a user who has a role gets a list of the three states. Either
 * asks for a confirmation first, so a stray key on the list changes nobody;
 * the question is announced to a screen reader, and the list keeps showing
 * the saved access until the change is confirmed. Giving a pending user a
 * role approves them; setting a user back to pending takes their role away.
 * Both go through the dashboard's own route (lib/roles.ts), which refuses an
 * admin's change of their own role (the admin's own row says so instead of
 * offering a control); they send the access the list shows, so the route
 * also refuses a change made on a list that is out of date, and the list
 * then loads again.
 *
 * The list is a table. On a phone its rows stack into cards (the header
 * stays for a screen reader); from md up it is laid out as a table.
 */
import { Fragment, useCallback, useEffect, useState, type CSSProperties, type FC } from 'react';
import { UsersIcon } from 'lucide-react';
import * as api from '@/lib/apiClient';
import type { ManagedUser } from '@/lib/apiClient';
import SectionCard from '@/components/dashboard/SectionCard';
import { S, HEADLINE_FONT } from '@/lib/theme';
import { NO_VALUE, fmtDate } from '@/lib/format';
import type { Access } from '@/types';
import {
  DESTRUCTIVE_BUTTON, errorText, INPUT_STYLE, Muted, PRIMARY_BUTTON, RolePill, type Status, StatusBanner,
  TableScroller,
} from './parts';

const article = (access: Access) => (access === 'admin' ? 'an admin' : 'a viewer');

/** The question the confirmation asks before a change of access. */
function confirmation(user: ManagedUser, to: Access): string {
  if (user.role === 'pending') return `Approve ${user.email} as ${article(to)}?`;
  if (to === 'pending') {
    return `Take access away from ${user.email}? From their next page load they see the waiting page.`;
  }
  return `Make ${user.email} ${article(to)}?`;
}

// The table's parts carry their roles explicitly: below md the rows and
// cells are blocks, and a block loses its implicit table role.
const ROW_CLASS = 'block md:table-row border-t first:border-t-0 md:border-t-0 border-theme-card-border py-2.5 md:py-0';
const CELL_CLASS = 'block md:table-cell px-3.5 py-[3px] md:py-3 md:border-t border-theme-card-border md:align-middle';
const TH_STYLE: CSSProperties = {
  padding: '10px 14px',
  backgroundColor: S.surfaceContainer,
  fontFamily: HEADLINE_FONT,
  fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: S.onSurfaceVariant,
  whiteSpace: 'nowrap',
};
const SMALL_BUTTON: CSSProperties = { padding: '6px 14px', fontSize: 12 };
const SECONDARY_SMALL: CSSProperties = { ...PRIMARY_BUTTON, ...SMALL_BUTTON, color: S.primary, backgroundColor: S.surfaceLow };

export const UsersSection: FC<{ currentUserId: string | null }> = ({ currentUserId }) => {
  // null until the list has loaded; a failed load leaves it null and shows the error.
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  // The change chosen for a user, waiting for its confirmation.
  const [draft, setDraft] = useState<{ id: string; to: Access } | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  // Loads the list; `cancelled` lets an effect drop an answer that comes after it ended.
  const loadUsers = useCallback((cancelled: () => boolean = () => false) => api.getUsers().then(
    (res) => { if (!cancelled()) setUsers(res.users); },
    (err: unknown) => {
      if (cancelled()) return;
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

  /** The control of a user's row: approval buttons, the access list, or a note on the admin's own row. */
  const control = (u: ManagedUser) => {
    const busy = updatingId === u.id;
    const chosen = draft?.id === u.id ? draft.to : null;
    const questionId = `confirm-${u.id}`;
    if (currentUserId === u.id) {
      return <span style={{ fontSize: 12, color: S.mutedText }}>Your own role: ask another admin to change it</span>;
    }
    if (u.role === 'pending') {
      return (
        <div className="inline-flex flex-wrap gap-2 md:justify-end">
          <button type="button"
            onClick={() => setDraft({ id: u.id, to: 'viewer' })}
            disabled={busy}
            aria-describedby={chosen ? questionId : undefined}
            style={{ ...PRIMARY_BUTTON, ...SMALL_BUTTON, opacity: busy ? 0.55 : 1 }}>
            Approve as viewer
          </button>
          <button type="button"
            onClick={() => setDraft({ id: u.id, to: 'admin' })}
            disabled={busy}
            aria-describedby={chosen ? questionId : undefined}
            style={{ ...SECONDARY_SMALL, opacity: busy ? 0.55 : 1 }}>
            Approve as admin
          </button>
        </div>
      );
    }
    return (
      <select
        value={u.role}
        onChange={(e) => {
          const to = e.target.value as Access;
          setDraft(to === u.role ? null : { id: u.id, to });
        }}
        disabled={busy}
        aria-label={`Access of ${u.email}`}
        aria-describedby={chosen ? questionId : undefined}
        title="Change access"
        style={{ ...INPUT_STYLE, padding: '5px 10px', fontSize: 12, opacity: busy ? 0.55 : 1, cursor: 'pointer' }}
      >
        <option value="pending">Pending</option>
        <option value="viewer">Viewer</option>
        <option value="admin">Admin</option>
      </select>
    );
  };

  return (
    <SectionCard size="regular"
      title={`All users${users?.length ? ` (${users.length}${pending ? `, ${pending} pending` : ''})` : ''}`}
      icon={UsersIcon}
      description="A new account is pending, and sees only a page saying that access awaits approval, until you give it a role here. Admins edit drivers and Consumer Journey content and manage users; viewers read everything and propose scores under Expert Rating. Setting a user back to pending takes their access away."
    >
      {users === null ? (
        status?.kind === 'error' ? null : <Muted>Loading users…</Muted>
      ) : users.length === 0 ? (
        <Muted>No users returned from the directory.</Muted>
      ) : (
        <TableScroller label="All users" tableClassName="block md:table">
          <thead role="rowgroup" className="sr-only md:not-sr-only">
            <tr role="row" className="block md:table-row">
              <th role="columnheader" scope="col" className="block md:table-cell text-left" style={TH_STYLE}>User</th>
              <th role="columnheader" scope="col" className="block md:table-cell text-left" style={TH_STYLE}>Name</th>
              <th role="columnheader" scope="col" className="block md:table-cell text-left" style={TH_STYLE}>Access</th>
              <th role="columnheader" scope="col" className="block md:table-cell text-left" style={TH_STYLE}>Last sign-in</th>
              <th role="columnheader" scope="col" className="block md:table-cell text-left md:text-right" style={TH_STYLE}>Actions</th>
            </tr>
          </thead>
          <tbody role="rowgroup" className="block md:table-row-group">
            {users.map((u) => {
              const isSelf = currentUserId === u.id;
              const chosen = draft?.id === u.id ? draft.to : null;
              const questionId = `confirm-${u.id}`;
              return (
                <Fragment key={u.id}>
                  <tr role="row" className={ROW_CLASS} style={{ fontSize: 12.5, color: S.onSurface }}>
                    <td role="cell" className={`${CELL_CLASS} break-words`} style={{ fontWeight: 500 }}>
                      {u.email}
                      {isSelf && (
                        <span className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: S.primaryContainer, color: S.onPrimaryContainer }}>
                          You
                        </span>
                      )}
                    </td>
                    <td role="cell" className={CELL_CLASS} style={{ color: S.mutedText }}>
                      {[u.firstName, u.lastName].filter(Boolean).join(' ') || NO_VALUE}
                    </td>
                    <td role="cell" className={CELL_CLASS}><RolePill role={u.role} /></td>
                    <td role="cell" className={CELL_CLASS} style={{ color: S.mutedText, whiteSpace: 'nowrap' }}>
                      <span className="md:hidden">Last sign-in: </span>
                      {fmtDate(u.lastSignInAt)}
                    </td>
                    <td role="cell" className={`${CELL_CLASS} pt-2 md:pt-3 text-left md:text-right`}>
                      {control(u)}
                    </td>
                  </tr>
                  {chosen && (
                    <tr role="row" className="block md:table-row">
                      <td role="cell" colSpan={5} className="block md:table-cell px-3.5 pb-3 md:pt-0">
                        <div role="group" aria-label={`Confirm the change for ${u.email}`}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                            flexWrap: 'wrap', gap: 8, fontSize: 12.5,
                          }}>
                          <span id={questionId} style={{ marginRight: 'auto', color: S.onSurfaceVariant }}>
                            {confirmation(u, chosen)}
                          </span>
                          <button type="button" onClick={() => setDraft(null)} style={SECONDARY_SMALL}>
                            Cancel
                          </button>
                          <button type="button" onClick={() => changeAccess(u, chosen)}
                            style={{ ...(chosen === 'pending' ? DESTRUCTIVE_BUTTON : PRIMARY_BUTTON), ...SMALL_BUTTON }}>
                            {chosen === 'pending' ? 'Take access away' : 'Confirm'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </TableScroller>
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
