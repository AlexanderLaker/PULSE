/**
 * Central state hook for PRISM Profit Pool Shift Model.
 *
 * June 2026 refactor:
 *   - Single shared instance: `PrismProvider` (mounted once in
 *     app/dashboard/page.tsx) runs the data lifecycle; every tab reads the
 *     same store via `usePrism()`. Previously each tab mounted its own copy
 *     of this hook, so every tab switch re-fetched the entire world and
 *     dropped all in-view state.
 *   - Pruned to what the live UI consumes. The analytics endpoints
 *     (CVaR / Sobol / tipping points — deleted from the backend entirely,
 *     D14 + Sobol rider June 2026), AI insights / triggers, scenario
 *     list, force summaries and the in-app `simulate()` belonged to the
 *     v1 dashboard, which no longer exists. Simulations are CLI-only
 *     (scripts/run_50k_prod.py); the UI renders the latest persisted run.
 *
 * Kept as a .ts file (no JSX) so the module specifier `@/hooks/usePrism`
 * is untouched; the provider is built with React.createElement.
 */
'use client';

import {
  createContext, createElement, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode, type FC,
} from 'react';
import * as api from '@/api/client';
import type {
  HealthStatus, Trend, SimulationResult, ModelConfig, TrendUpdate,
} from '@/types';

/** Return type for the usePrism hook. */
export interface UsePrismReturn {
  health: HealthStatus | null;
  trends: Trend[];
  simulation: SimulationResult | null;
  config: ModelConfig | null;
  loading: boolean;
  error: string | null;
  backendAvailable: boolean;
  connectionState: 'connected' | 'reconnecting' | 'offline';
  updateTrend: (trendId: string, updates: TrendUpdate) => Promise<void>;
  reload: () => Promise<void>;
  reconnect: () => Promise<void>;
}

function usePrismStore(): UsePrismReturn {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'offline'>('reconnecting');
  const mounted = useRef(true);
  const healthCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // M7 (July 2026 review): request ordering. Every loadAll() takes a new
  // epoch; only the newest epoch may write state, so a slow older load can
  // never overwrite a newer one.
  const loadEpochRef = useRef(0);
  // Mirror of connectionState for use inside stable callbacks (avoids the
  // stale-closure variant of the reconnect bug). Kept in sync via an effect
  // — refs must not be written during render (react-hooks/refs).
  const connectionStateRef = useRef<'connected' | 'reconnecting' | 'offline'>('reconnecting');
  useEffect(() => { connectionStateRef.current = connectionState; }, [connectionState]);

  // -- Initial load with graceful degradation -------------------
  // Written as a promise chain rather than async/await on purpose: every
  // state write lives in a continuation, so the mount effect below can start
  // the load without setting state synchronously during the effect. The two
  // commit stages (core payload, then the stored run) and the `finally` are
  // the same ones the async version had.
  const loadAll = useCallback(() => {
    // M7: claim a new epoch; stale loads may not write state.
    const epoch = ++loadEpochRef.current;
    const fresh = () => mounted.current && epoch === loadEpochRef.current;
    // F3: prime the httpOnly engine cookie (pulse-token) so the
    // authenticated /api/v1 reads succeed. Errors are non-fatal here —
    // if priming failed, the reads below 401 and we surface offline.
    return fetch('/api/prism-cookie', { credentials: 'include' })
      .catch(() => undefined)
      .then(() => Promise.all([
        api.getHealth().catch((err: Error) => { throw err; }),
        api.getTrends().catch((): Trend[] => []),
        api.getConfig().catch((): null => null),
      ]))
      .then(([h, t, c]) => {
        if (!fresh()) return null;

        setBackendAvailable(true);
        setConnectionState('connected');
        setHealth(h);
        setTrends(Array.isArray(t) ? t : []);
        setConfig(c);

        // Load stored simulation if available
        return h?.has_simulation
          ? api.getSimulation().catch((): null => null)
          : null;
      })
      .then((sim) => {
        // If no stored simulation, leave it null -- the dashboard explains why.
        if (sim && fresh()) setSimulation(sim);
      })
      .catch((e: unknown) => {
        if (fresh()) {
          setBackendAvailable(false);
          setConnectionState('offline');
          setHealth({ status: 'offline', version: 'unknown' });
          setError(`Backend unavailable. ${(e as Error).message}`);
        }
      })
      .finally(() => {
        if (fresh()) setLoading(false);
      });
  }, []);

  // -- Reload entry point ----------------------------------------
  // Re-enter the loading state, then run the same load. Every caller that
  // reaches the store from the UI (retry button, explicit reconnect, the
  // health check's offline -> connected recovery) goes through here; the
  // mount effect calls `loadAll` directly because the store already starts
  // in exactly this state, so the three writes below would be no-ops.
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setConnectionState('reconnecting');
    return loadAll();
  }, [loadAll]);

  // -- Health check with reconnect logic ------------------------
  const performHealthCheck = useCallback(async () => {
    try {
      await api.getHealth();
      if (mounted.current) {
        // M7: transitioning offline → connected must RELOAD data, not just
        // flip the badge — the dashboard used to read "connected" over
        // stale/empty data until a manual page refresh.
        const wasDisconnected = connectionStateRef.current !== 'connected';
        setBackendAvailable(true);
        setConnectionState('connected');
        setError(null);
        if (wasDisconnected) void reload();
      }
    } catch {
      if (mounted.current) {
        setBackendAvailable(false);
        setConnectionState('offline');
      }
    }
  }, [reload]);

  // -- Schedule periodic health checks --------------------------
  const scheduleHealthCheck = useCallback(() => {
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }
    // 60 s when connected, 30 s while offline/reconnecting.
    const intervalMs = connectionState === 'connected' ? 60000 : 30000;
    healthCheckIntervalRef.current = setInterval(() => {
      void performHealthCheck();
    }, intervalMs);
  }, [connectionState, performHealthCheck]);

  useEffect(() => {
    scheduleHealthCheck();
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [scheduleHealthCheck]);

  useEffect(() => {
    mounted.current = true;
    void loadAll();
    return () => { mounted.current = false; };
  }, [loadAll]);

  // -- Update trend score ----------------------------------------
  const updateTrend = useCallback(async (trendId: string, updates: TrendUpdate) => {
    // M6 (July 2026 review): ALWAYS attempt the write and rethrow on
    // failure. The old `if (!backendAvailable) return;` guard silently
    // dropped saves whenever the (up to 60s stale) offline flag was up,
    // while callers' success paths showed "✓ saved". Callers already have
    // try/catch + error UI — they just never received the rejection.
    try {
      await api.updateTrend(trendId, updates);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
      throw e;
    }
    const t = await api.getTrends().catch((): Trend[] => []);
    if (mounted.current) setTrends(t);
  }, []);

  // -- Explicit reconnect function --------------------------------
  // `reload` already flips the badge to "reconnecting" before it fetches.
  const reconnect = useCallback(async () => {
    await reload();
  }, [reload]);

  return {
    health, trends, simulation, config,
    loading, error, backendAvailable, connectionState,
    updateTrend, reload, reconnect,
  };
}

// --- Context plumbing -------------------------------------------
const PrismContext = createContext<UsePrismReturn | null>(null);

/** Mount once (dashboard page). All tabs share this single store. */
export const PrismProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const value = usePrismStore();
  return createElement(PrismContext.Provider, { value }, children);
};

/** Read the shared PRISM store. Must be used inside <PrismProvider>. */
export default function usePrism(): UsePrismReturn {
  const ctx = useContext(PrismContext);
  if (!ctx) {
    throw new Error('usePrism must be used within <PrismProvider> (see app/dashboard/page.tsx)');
  }
  return ctx;
}
