/**
 * PRISM's database for the dashboard's own tables (user_roles) and the audit
 * entries it writes. The same Neon database the API uses, through Neon's
 * serverless driver.
 */
import { neon } from '@neondatabase/serverless';

/**
 * A tagged-template SQL client. Created per call, so importing this module
 * never fails without DATABASE_URL (the build imports it with no environment).
 */
export function getSQL() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set: connect the Neon database to the Vercel project, or set it in .env.');
  }
  return neon(url);
}
