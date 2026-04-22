/**
 * PRISM backend JWT bridging.
 *
 * The Python FastAPI backend (pulse/api/app.py) still gates most of its
 * endpoints with its original HS256 JWT system (`require_auth` /
 * `require_admin`). After the Clerk migration, the Next.js frontend no
 * longer issues those tokens — all user-facing auth flows go through
 * Clerk instead.
 *
 * To let server-side Next.js proxies (like `/api/config`) forward
 * requests into the Python backend, we mint a short-lived "service"
 * JWT here using the same `PRISM_JWT_SECRET` the Python code verifies
 * against. We set sub/email/role to the authenticated caller's values,
 * so the Python layer's audit logs and role gates continue to work
 * unchanged.
 *
 * Payload shape matches pulse/api/auth.py's _create_jwt:
 *   { sub, email, role, exp }  (exp = epoch seconds)
 *
 * Security:
 *   - Only call this from server components / API routes, never ship
 *     `PRISM_JWT_SECRET` to the client.
 *   - The token is 5-minute-TTL, single-use-ish — don't cache it.
 *   - If PRISM_JWT_SECRET isn't set we return null and let the caller
 *     handle it (the proxy will surface a 502 with a useful message).
 */
import crypto from 'node:crypto';

export interface PrismJwtClaims {
  sub: string;
  email: string;
  role: 'admin' | 'viewer' | 'analyst';
}

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function signPrismJwt(claims: PrismJwtClaims, ttlSeconds = 300): string | null {
  const secret = process.env.PRISM_JWT_SECRET;
  if (!secret || secret.length < 32) return null;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: claims.sub,
    email: claims.email,
    role: claims.role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const headerB64 = b64urlEncode(JSON.stringify(header));
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  const sigB64 = b64urlEncode(sig);

  return `${signingInput}.${sigB64}`;
}
