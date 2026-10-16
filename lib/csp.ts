/**
 * The Content Security Policy the proxy sends with every page and route
 * (proxy.ts). Pure functions: the proxy reads the environment and calls them.
 *
 * The policy is nonce-based. Each request gets a fresh nonce; the policy
 * allows a script with that nonce and, through 'strict-dynamic', the scripts
 * it loads, which is how Next.js's own scripts and Clerk's reach the page.
 * `https:` and 'unsafe-inline' are the fallback for a browser without
 * 'strict-dynamic' support and are ignored by one with it. Styles stay
 * 'unsafe-inline' because Next.js, Clerk and the dashboard's own components
 * set style attributes. Images allow `data:` and `blob:` for the PNG export
 * (html-to-image) and img.clerk.com for the avatars in Settings; fonts come
 * from the build (next/font). Clerk's components talk to the Clerk frontend
 * API, whose host is encoded in the publishable key, and to Clerk's telemetry;
 * the frame for Clerk's bot check comes from Cloudflare. Development adds
 * 'unsafe-eval' and the websocket schemes, which Next.js's dev server needs.
 *
 * Next.js reads the nonce from the request's content-security-policy header
 * and puts it on the scripts it renders, so the proxy sets the policy on the
 * request it forwards as well as on the response; the request also carries
 * the nonce as x-nonce, where Clerk's provider (`dynamic` in app/layout.tsx)
 * reads it for the script tag it renders for its own code.
 */

/** The response header that enforces the policy. */
export const POLICY_HEADER = 'Content-Security-Policy';
/** The response header that reports violations in the browser console without enforcing. */
export const REPORT_ONLY_HEADER = 'Content-Security-Policy-Report-Only';
/** The request header Next.js reads the nonce from; always this name, whichever the response carries. */
export const REQUEST_POLICY_HEADER = 'content-security-policy';
/** The request header that carries the nonce on its own. */
export const NONCE_HEADER = 'x-nonce';

const PUBLISHABLE_KEY = /^pk_(?:test|live)_([A-Za-z0-9+/]+={0,2})$/;
const HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

/**
 * The Clerk frontend API host a publishable key names: `pk_test_` or
 * `pk_live_` followed by base64 of the host with a trailing `$`. Null for a
 * missing key or anything that does not decode to a host; never throws.
 */
export function clerkFrontendApi(publishableKey: string | undefined): string | null {
  const encoded = publishableKey ? PUBLISHABLE_KEY.exec(publishableKey)?.[1] : undefined;
  if (!encoded) return null;
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }
  if (!decoded.endsWith('$')) return null;
  const host = decoded.slice(0, -1);
  return HOST.test(host) ? host : null;
}

export interface PolicyInput {
  /** The nonce of this request, as newNonce() makes it. */
  nonce: string;
  /** The Clerk frontend API host, or null to add no Clerk hosts. */
  clerkHost: string | null;
  /** Whether Next.js runs its development server, which needs eval and websockets. */
  development: boolean;
}

/** The policy as one header value: directives separated by `; `, sources by one space, no trailing semicolon. */
export function buildContentSecurityPolicy({ nonce, clerkHost, development }: PolicyInput): string {
  const clerk = clerkHost ? [`https://${clerkHost}`] : [];
  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", 'https:', "'unsafe-inline'",
      ...(development ? ["'unsafe-eval'"] : [])]],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:', 'https://img.clerk.com']],
    ['font-src', ["'self'"]],
    ['connect-src', ["'self'", ...clerk, 'https://clerk-telemetry.com', 'https://*.clerk-telemetry.com',
      ...(development ? ['ws:', 'wss:'] : [])]],
    ['frame-src', ["'self'", 'https://challenges.cloudflare.com', ...clerk]],
    ['worker-src', ["'self'", 'blob:']],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
  ];
  return directives.map(([name, sources]) => [name, ...sources].join(' ')).join('; ');
}

/** A fresh nonce: 16 random bytes, base64. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** The response header to send the policy under: report-only while a deployment watches the console first. */
export function cspHeaderName(reportOnly: boolean): string {
  return reportOnly ? REPORT_ONLY_HEADER : POLICY_HEADER;
}
