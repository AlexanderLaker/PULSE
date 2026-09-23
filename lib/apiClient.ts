/**
 * Every request the dashboard makes.
 *
 * Reads and the user's own expert proposals go straight to the PRISM API
 * under /api/v1 and are authenticated by the httpOnly viewer cookie that
 * /api/prism-cookie sets (see hooks/usePrism.tsx). The cookie lasts thirty
 * minutes; a /api/v1 request answered 401 asks for a new one and is sent once
 * more, so a dashboard left open keeps working while the session lasts, and
 * signing out expires the cookie first (clearViewerCookie). Admin writes go to the
 * dashboard's own routes under /api, which check the signed-in user's role
 * and forward the write with a short-lived admin token (lib/adminWrite.ts): the
 * viewer cookie can never authorise an admin write. User management and the
 * role lookup are dashboard routes too (lib/roles.ts).
 */
import type {
  DiagnosticsResult, Driver, DriverProposal, DriverProposalsResponse, DriverUpdate,
  HealthStatus, ModelConfig, Role, SimulationPayload, SimulationResult,
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

/** Set once the viewer cookie is expired for a sign-out or an ended session:
 *  no request of this page may set it again (the page navigates away next). */
let cookieRetired = false;

/** Expires the viewer cookie. Resolves whether or not it succeeded. */
const expireViewerCookie = (): Promise<void> =>
  fetch('/api/prism-cookie', { method: 'DELETE' }).then(() => undefined, () => undefined);

/** Sets the viewer cookie the /api/v1 reads need. When it cannot be set, any
 *  cookie left in the browser (perhaps another user's) is expired instead, so
 *  the reads that follow fail rather than go out under it. Resolves either way. */
export const primeViewerCookie = (): Promise<void> =>
  cookieRetired
    ? Promise.resolve()
    : fetch('/api/prism-cookie').then((res) => (res.ok ? undefined : expireViewerCookie()), expireViewerCookie);

/** Expires the viewer cookie for good on this page: before signing out, and
 *  when the session has ended. Resolves whether or not it succeeded. */
export const clearViewerCookie = (): Promise<void> => {
  cookieRetired = true;
  return expireViewerCookie();
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

/** Merge fields into the caller's own proposal; any signed-in user may propose. */
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

// ── Identity and users (dashboard routes) ───────────────────────────────────

export interface Me {
  clerkUserId: string;
  email: string;
  role: Role;
}

export const getMe = (): Promise<Me> => send('/api/me');

/** A user as the admin's user list shows it: Clerk's identity with PRISM's role. */
export interface ManagedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  lastSignInAt: string | null;
  createdAt: string | null;
}

export const getUsers = (): Promise<{ users: ManagedUser[] }> => send('/api/users');

export const setUserRole = (userId: string, role: Role): Promise<{ role: Role }> =>
  send(`/api/users/${encodeURIComponent(userId)}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
