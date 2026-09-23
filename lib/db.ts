/**
 * PRISM's database for the dashboard's own tables (user_roles) and the audit
 * entries it writes. The same Neon database the API uses, through Neon's
 * serverless driver, chosen the same way: POSTGRES_URL when it is set,
 * otherwise DATABASE_URL (prism/database.py).
 */
import { neon } from '@neondatabase/serverless';

/**
 * A tagged-template SQL client. Created per call, so importing this module
 * never fails without a database URL (the build imports it with no environment).
 */
export function getSQL() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Neither POSTGRES_URL nor DATABASE_URL is set: connect the Neon database to the Vercel project, '
      + 'or set DATABASE_URL in .env.');
  }
  return neon(url);
}
