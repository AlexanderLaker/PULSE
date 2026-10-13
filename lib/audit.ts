/**
 * The dashboard's entries in PRISM's audit log: role changes, including the
 * role the Clerk webhook grants at sign-up and the one it removes with a
 * deleted user. (The API writes its own entries in the same transaction as
 * each change, prism/database.py.) A role change stands even if its entry
 * cannot be written; the failure is logged on the server.
 *
 * Server-side only.
 */
import type { Role } from '@/types';
import { getSQL } from './db';

export async function recordRoleChange(change: {
  /** The Clerk user id whose role changed. */
  userId: string;
  /** null: the user had no row (a sign-up). */
  from: Role | null;
  /** null: the row was removed with the deleted Clerk user. */
  to: Role | null;
  /** How the change was made, for the reason column: the route. */
  via: string;
  /** Who made it: an admin's Clerk user id, or the mechanism. */
  actor: string;
}): Promise<void> {
  try {
    await getSQL()`
      INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, reason, user_id)
      VALUES ('role_change', 'user', ${change.userId}, ${change.from}, ${change.to}, ${change.via},
              ${change.actor})
    `;
  } catch (err) {
    console.warn(`[audit] the role change of ${change.userId} was not logged:`, err);
  }
}
