/**
 * Every request the dashboard makes.
 *
 * Reads and the user's own expert proposals go straight to the PRISM API
 * under /api/v1 and are authenticated by the httpOnly viewer cookie that
 * /api/prism-cookie sets (see hooks/usePrism.tsx). The cookie lasts thirty
 * minutes; a /api/v1 request answered 401 asks for a new one and is sent
 * once more, so a dashboard left open keeps working while the session lasts,
 * and signing out expires the cookie first (clearViewerCookie). Admin writes
 * go to the dashboard's own routes under /api, which check the signed-in
 * user's role and forward the write with a short-lived admin token
 * (lib/adminWrite.ts): the viewer cookie can never authorise an admin write.
 * User management is a dashboard route too (lib/roles.ts).
 */
import type {
  DiagnosticsResult, Driver, DriverProposal, DriverProposalsResponse, DriverUpdate,
  Access, HealthStatus, ModelConfig, Role, SimulationPayload, SimulationResult,
} from '@/types';
import type { JourneyContent } from '@/data/consumerJourney';
import { errorDetail } from '@/lib/apiError';

/** No request may hang: 20 s covers a serverless database waking up. */
const REQUEST_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  /** `outcomeUnknown`: a write went out and no answer came back from the API
   *  (a timeout, a lost connection, or a gateway that gave up with 502 or 504),
   *  so it may still have been carried out. */
  constructor(public status: number, message: string, public outcomeUnknown = false) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Gateway answers: the API's own answer never arrived. */
const GATEWAY_STATUSES = new Set([502, 504]);

async function send<T>(url: string, init: RequestInit = {}, retried = false): Promise<T> {
  const write = (init.method ?? 'GET') !== 'GET';
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new ApiError(0, `The request timed out after ${REQUEST_TIMEOUT_MS / 1000} s`, write);
    }
    throw new ApiError(0, 'The PRISM service could not be reached', write);
  }
  if (res.status === 401 && !retried && url.startsWith('/api/v1/')) {
    await primeViewerCookie();
    return send<T>(url, init, true);
  }
  if (!res.ok) {
    throw new ApiError(res.status, errorDetail(await res.json().catch(() => null)) ?? `Request failed (${res.status})`,
      write && GATEWAY_STATUSES.has(res.status));
  }
  return (await res.json()) as T;
}

const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) });

// ── Service status ──────────────────────────────────────────────────────────

export const getHealth = (): Promise<HealthStatus> => send('/api/v1/health');

/** What the service sees of its database; null when the service itself cannot be reached. */
export const getDiagnostics = (): Promise<DiagnosticsResult | null> =>
  send<DiagnosticsResult>('/api/v1/diagnostics').catch(() => null);

/** Set while the page is signing out, or its session has ended: no request
 *  may set the viewer cookie again until a signed-in store starts
 *  (resumeViewerCookie). */
let cookieRetired = false;
/** The request setting the viewer cookie, while one is on its way: requests
 *  answered 401 at the same moment share it, and an expiry waits for it. */
let priming: Promise<void> | null = null;

/** Expires the viewer cookie. Resolves whether or not it succeeded. */
const expireViewerCookie = (): Promise<void> =>
  fetch('/api/prism-cookie', { method: 'DELETE' }).then(() => undefined, () => undefined);

/** The user's role was taken away while the page was open: a full navigation
 *  to /dashboard, whose check on the server (app/dashboard/page.tsx) sends
 *  them to the waiting page instead of leaving a dashboard whose reads fail. */
const accessWithdrawn = (): void => { window.location.replace('/dashboard'); };

/** Sets the viewer cookie the /api/v1 reads need. When it cannot be set, any
 *  cookie left in the browser (perhaps another user's) is expired instead, so
 *  the reads that follow fail rather than go out under it; when it is refused
 *  because the user no longer has a role (403), the page then leaves the
 *  dashboard (accessWithdrawn). Resolves either way. */
export const primeViewerCookie = (): Promise<void> => {
  if (cookieRetired) return Promise.resolve();
  priming ??= fetch('/api/prism-cookie')
    .then(async (res) => {
      if (res.ok) return;
      await expireViewerCookie();
      if (res.status === 403) accessWithdrawn();
    }, expireViewerCookie)
    .finally(() => { priming = null; });
  return priming;
};

/** Expires the viewer cookie before signing out and when the session has
 *  ended, after any cookie on its way has landed; until resumeViewerCookie,
 *  nothing sets it again. Resolves whether or not it succeeded. */
export const clearViewerCookie = async (): Promise<void> => {
  cookieRetired = true;
  await priming;
  return expireViewerCookie();
};

/** Lets the viewer cookie be set again: a signed-in store starts (a sign-in
 *  that followed a sign-out on the same page), or a sign-out failed. */
export const resumeViewerCookie = (): void => {
  cookieRetired = false;
};

// ── Drivers ─────────────────────────────────────────────────────────────────

export const getDrivers = (): Promise<Driver[]> => send('/api/v1/drivers');

export interface DriverUpdateResult {
  status: 'updated' | 'unchanged';
  driver_id: string;
  /** The fields that changed; absent when nothing did. */
  changed?: string[];
  /** The driver's revision after the edit. */
  revision: number;
}

/** Admin edit, through the dashboard route that checks the role. Rejects with
 *  an ApiError of status 409 when the driver changed after `update.revision`. */
export const updateDriver = (id: string, update: DriverUpdate): Promise<DriverUpdateResult> =>
  send(`/api/drivers/${encodeURIComponent(id)}`, put(update));

/** The caller's own proposal, the aggregate across experts and who scored what. */
export const getDriverProposals = (id: string): Promise<DriverProposalsResponse> =>
  send(`/api/v1/drivers/${encodeURIComponent(id)}/proposals`);

/** Merge fields into the caller's own proposal; any viewer or admin may propose. */
export const saveMyProposal = (id: string, proposal: DriverProposal): Promise<DriverProposalsResponse> =>
  send(`/api/v1/drivers/${encodeURIComponent(id)}/proposals`, put(proposal));

// ── The run and the configuration ───────────────────────────────────────────

/** The served run with each category's percentile path lifted into `shifts`
 *  and its year-on-year change bands into `velocity`. */
export function normalizeSimulation(payload: SimulationPayload): SimulationResult {
  const { shift_matrix, ...rest } = payload;
  const shifts = Object.fromEntries(Object.entries(shift_matrix).map(([cat, cell]) => [cat, cell.path]));
  const velocity = Object.fromEntries(Object.entries(shift_matrix).map(([cat, cell]) => [cat, cell.velocity]));
  return { ...rest, shifts, velocity };
}

export const getSimulation = async (): Promise<SimulationResult> =>
  normalizeSimulation(await send<SimulationPayload>('/api/v1/simulation'));

export const getConfig = (): Promise<ModelConfig> => send('/api/v1/config');

// ── Consumer Journey content ────────────────────────────────────────────────

/** The stored journey content and its version; content null and version 0
 *  while the bundled content applies. */
export interface StoredJourney {
  version: number;
  content: JourneyContent | null;
}

export const getJourneyContent = (): Promise<StoredJourney> => send('/api/v1/journey');

/** Admin save of the whole tile map, through the dashboard route that checks
 *  the role. `baseVersion` is the version the edit started from; the save is
 *  refused with 409 if someone saved in the meantime. */
export const saveJourneyContent = (
  content: JourneyContent, baseVersion: number,
): Promise<{ status: 'saved'; version: number; tiles: number }> =>
  send('/api/journey', put({ base_version: baseVersion, content }));

// ── Users (dashboard routes) ────────────────────────────────────────────────

/** A user as the admin's user list shows it: Clerk's identity with their access in PRISM. */
export interface ManagedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Access;
  lastSignInAt: string | null;
  createdAt: string | null;
}

export const getUsers = (): Promise<{ users: ManagedUser[] }> => send('/api/users');

const roleUrl = (userId: string) => `/api/users/${encodeURIComponent(userId)}/role`;

/** Gives a user a role: for a pending user that is the approval. */
export const setUserRole = (userId: string, role: Role): Promise<{ role: Role }> =>
  send(roleUrl(userId), { method: 'PATCH', body: JSON.stringify({ role }) });

/** Takes a user's role away: they are pending again. */
export const revokeUserRole = (userId: string): Promise<{ role: 'pending' }> =>
  send(roleUrl(userId), { method: 'DELETE' });
