/**
 * Auth surface re-exports for backward compatibility with callers that
 * imported from `@/lib/auth`. New code should import from `@clerk/nextjs`
 * (client) or `@clerk/nextjs/server` (server) directly, plus `@/lib/roles`
 * for authorization checks.
 */
export { auth, currentUser } from '@clerk/nextjs/server';
export { requireAuth, requireAdmin, getRole, setRole } from './roles';
export type { Role } from './roles';
