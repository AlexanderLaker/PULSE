/**
 * Tokens for the PRISM API.
 *
 * The API verifies an HS256 token signed with PRISM_JWT_SECRET
 * (prism/api/auth.py). The dashboard signs two kinds, always for the user of
 * the Clerk session: a viewer token that /api/prism-cookie puts in the httpOnly
 * cookie the reads use, and a five-minute admin token for each write it
 * forwards (lib/backend.ts).
 *
 * Server-side only. Returns null when the secret is missing or shorter than
 * 32 characters, which the API would refuse as well.
 */
import crypto from 'node:crypto';
import type { Role } from '@/types';

export interface PrismJwtClaims {
  sub: string;
  email: string;
  /** The user's full name in Clerk, shown with their expert proposals; left out when empty. */
  name?: string;
  role: Role;
}

const b64url = (input: Buffer | string): string =>
  (typeof input === 'string' ? Buffer.from(input, 'utf8') : input).toString('base64url');

export function signPrismJwt(claims: PrismJwtClaims, ttlSeconds = 300): string | null {
  const secret = process.env.PRISM_JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body: Record<string, unknown> = { ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  if (!claims.name) delete body.name;
  const payload = b64url(JSON.stringify(body));
  const signature = b64url(crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}
