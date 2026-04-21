/**
 * Neon Postgres client.
 *
 * Single source of truth for the SQL client used by Clerk-adjacent code
 * (roles, audit log, etc.). The old custom-auth user CRUD lives in git
 * history — do not resurrect it.
 */
import { neon } from '@neondatabase/serverless';

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
        'Provision a Neon database via the Vercel dashboard (Storage → Create Database → Neon) ' +
        'and connect it to the project — this will inject DATABASE_URL automatically.'
    );
  }
  return url;
}

/**
 * Get a tagged-template SQL client.
 *
 * Lazy so module load never fails — only calling `getSQL()` at request time
 * can throw on missing DATABASE_URL. This matters during Next.js's
 * "Collect page data" build step which imports modules without env vars.
 */
export function getSQL() {
  return neon(getDatabaseUrl());
}
