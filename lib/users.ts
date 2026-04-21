/**
 * Deprecated. Filesystem-based user store from the v1 custom auth.
 *
 * This file previously wrote users to `data/users.json` — unusable on
 * Vercel (ephemeral filesystem) and redundant with the Neon-backed store.
 * Kept as an empty stub so any stale imports fail loudly at TypeScript
 * compile time rather than silently at runtime.
 *
 * Use `@/lib/roles` for role management and `@clerk/nextjs/server`
 * (`currentUser`, `auth`) for identity.
 */
export {};
