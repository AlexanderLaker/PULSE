/**
 * Forwarding an admin write from a dashboard route to the PRISM API.
 *
 * The browser's viewer cookie carries the viewer role, so it can never
 * authorise an admin write: every admin write goes through a dashboard route.
 * The route checks the signed-in user's role (lib/roles.ts) and calls the API
 * with a five-minute admin token that carries the user's identity; the API
 * verifies the token and writes that identity to its audit log. The call goes
 * to PRISM_API_ORIGIN when that is set, else to the host the request came in
 * on. On Vercel the /api/v1 path is rewritten to the Python function
 * (vercel.json); in local development next.config.js rewrites it to the API
 * server at PRISM_BACKEND_URL.
 *
 * Server-side only: it signs with PRISM_JWT_SECRET.
 */
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { errorDetail } from './apiError';
import { signPrismJwt } from './prismJwt';
import { ForbiddenError, UnauthorizedError, requireAdmin } from './roles';

/** An absolute URL for an API path: on PRISM_API_ORIGIN when set, else on the
 *  origin this request came in on. */
async function apiUrl(path: string): Promise<string> {
  const origin = process.env.PRISM_API_ORIGIN?.trim().replace(/\/+$/, '');
  if (origin) return `${origin}${path}`;
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}${path}`;
}

/** One readable line from the API's error body (lib/apiError.ts), else its raw text. */
function formatApiError(body: string, status: number): string {
  let detail: string | null = null;
  try {
    detail = errorDetail(JSON.parse(body));
  } catch {
    // not JSON: the raw text follows
  }
  return detail ?? (body || `The PRISM API answered ${status}`);
}

/**
 * Forward the request's JSON body as an admin PUT to the API at `path`.
 * `validate` may refuse the body with a message (400) before anything is sent.
 */
export async function forwardAdminWrite(
  req: Request,
  path: string,
  validate?: (body: Record<string, unknown>) => string | null,
): Promise<NextResponse> {
  try {
    const admin = await requireAdmin();
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'The body must be a JSON object' }, { status: 400 });
    }
    const problem = validate?.(body as Record<string, unknown>);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const token = signPrismJwt({ sub: admin.clerkUserId, email: admin.email, name: admin.name, role: 'admin' });
    if (!token) {
      return NextResponse.json(
        { error: 'PRISM_JWT_SECRET is not set (it needs at least 32 characters), so changes cannot be saved.' },
        { status: 503 },
      );
    }
    const res = await fetch(await apiUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: formatApiError(text, res.status) }, { status: res.status });
    }
    return new NextResponse(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(`[admin write ${path}]`, err);
    return NextResponse.json({ error: 'The change could not be saved' }, { status: 502 });
  }
}
