/**
 * Every request the dashboard makes.
 *
 * Reads and the user's own expert proposals go straight to the PRISM API
 * under /api/v1 and are authenticated by the httpOnly viewer cookie that
 * /api/prism-cookie sets (see hooks/usePrism.ts). Admin writes go to the
 * dashboard's own routes under /api, which check the signed-in user's role
 * and forward the write with a short-lived admin token (lib/backend.ts): the
 * viewer cookie can never authorise an admin write. User management and the
 * role lookup are dashboard routes too (lib/roles.ts).
 */
import type {
  DiagnosticsResult, Driver, DriverProposal, DriverProposalsResponse, DriverUpdate,
  HealthStatus, ModelConfig, Role, SimulationPayload, SimulationResult,
} from '@/types';
import type { JourneyContent } from '@/data/consumerJourney';

/** No request may hang: 20 s covers a serverless database waking up. */
const REQUEST_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** One readable line from an error body ({detail} from the API, {error} from the dashboard routes). */
function errorMessage(body: unknown, status: number): string {
  const b = (body ?? {}) as { detail?: unknown; error?: unknown };
  const detail = b.detail ?? b.error;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && typeof (detail as { error?: unknown }).error === 'string') {
    return (detail as { error: string }).error;
  }
  return detail != null ? JSON.stringify(detail) : `Request failed (${status})`;
}

async function send<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new ApiError(0, `The request timed out after ${REQUEST_TIMEOUT_MS / 1000} s`);
    }
    throw new ApiError(0, 'The PRISM service could not be reached');
  }
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(await res.json().catch(() => null), res.status));
  }
  return (await res.json()) as T;
}

const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) });

// ── Service status ──────────────────────────────────────────────────────────

export const getHealth = (): Promise<HealthStatus> => send('/api/v1/health');

/** What the service sees of its database; null when the service itself cannot be reached. */
export const getDiagnostics = (): Promise<DiagnosticsResult | null> =>
  send<DiagnosticsResult>('/api/v1/diagnostics').catch(() => null);

/** Sets the viewer cookie the /api/v1 reads need. Resolves whether or not it succeeded. */
export const primeViewerCookie = (): Promise<void> =>
  fetch('/api/prism-cookie').then(() => undefined, () => undefined);

// ── Drivers ─────────────────────────────────────────────────────────────────

export const getDrivers = (): Promise<Driver[]> => send('/api/v1/drivers');

export interface DriverUpdateResult {
  status: 'updated' | 'unchanged';
  driver_id: string;
  /** The fields that changed; absent when nothing did. */
  changed?: string[];
}

/** Admin edit, through the dashboard route that checks the role. */
export const updateDriver = (id: string, update: DriverUpdate): Promise<DriverUpdateResult> =>
  send(`/api/drivers/${encodeURIComponent(id)}`, put(update));

/** The caller's own proposal, the aggregate across experts and who scored what. */
export const getDriverProposals = (id: string): Promise<DriverProposalsResponse> =>
  send(`/api/v1/drivers/${encodeURIComponent(id)}/proposals`);

/** Merge fields into the caller's own proposal; any signed-in user may propose. */
export const saveMyProposal = (id: string, proposal: DriverProposal): Promise<DriverProposalsResponse> =>
  send(`/api/v1/drivers/${encodeURIComponent(id)}/proposals`, put(proposal));

// ── The run and the configuration ───────────────────────────────────────────

/** The served run with each category's percentile path lifted into `shifts`. */
export function normalizeSimulation(payload: SimulationPayload): SimulationResult {
  const { shift_matrix, ...rest } = payload;
  const shifts = Object.fromEntries(Object.entries(shift_matrix).map(([cat, cell]) => [cat, cell.path]));
  return { ...rest, shifts };
}

export const getSimulation = async (): Promise<SimulationResult> =>
  normalizeSimulation(await send<SimulationPayload>('/api/v1/simulation'));

export const getConfig = (): Promise<ModelConfig> => send('/api/v1/config');

// ── Consumer Journey content ────────────────────────────────────────────────

/** The newest content an admin saved; null while the bundled content applies. */
export const getJourneyContent = (): Promise<JourneyContent | null> =>
  send<JourneyContent>('/api/v1/journey').catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });

/** Admin save of the whole tile map, through the dashboard route that checks the role. */
export const saveJourneyContent = (content: JourneyContent): Promise<{ status: 'saved'; tiles: number }> =>
  send('/api/journey', put(content));

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
