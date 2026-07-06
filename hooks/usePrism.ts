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
        if (wasDisconnected) void loadAllRef.current?.();
      }
    } catch {
      if (mounted.current) {
        setBackendAvailable(false);
        setConnectionState('offline');
      }
    }
  }, []);

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

  // -- Initial load with graceful degradation -------------------
  const loadAll = useCallback(async () => {
    // M7: claim a new epoch; stale loads may not write state.
    const epoch = ++loadEpochRef.current;
    const fresh = () => mounted.current && epoch === loadEpochRef.current;
    setLoading(true);
    setError(null);
    setConnectionState('reconnecting');
    try {
      // F3: prime the httpOnly engine cookie (pulse-token) so the
      // authenticated /api/v1 reads succeed. Errors are non-fatal here —
      // if priming failed, the reads below 401 and we surface offline.
      await fetch('/api/prism-cookie', { credentials: 'include' }).catch(() => undefined);
      const [h, t, c] = await Promise.all([
        api.getHealth().catch((err: Error) => { throw err; }),
        api.getTrends().catch((): Trend[] => []),
        api.getConfig().catch((): null => null),
      ]);

      if (!fresh()) return;

      setBackendAvailable(true);
      setConnectionState('connected');
      setHealth(h);
      setTrends(Array.isArray(t) ? t : []);
      setConfig(c);

      // Load stored simulation if available
      if (h?.has_simulation) {
        const sim = await api.getSimulation().catch((): null => null);
        if (sim && fresh()) setSimulation(sim);
      }
      // If no stored simulation, leave it null -- the dashboard explains why.
    } catch (e) {
      if (fresh()) {
        setBackendAvailable(false);
        setConnectionState('offline');
        setHealth({ status: 'offline', version: 'unknown' });
        setError(`Backend unavailable. ${(e as Error).message}`);
      }
    } finally {
      if (fresh()) setLoading(false);
    }
  }, []);

  // Stable reference for performHealthCheck's reconnect reload (M7) —
  // avoids a circular useCallback dependency. Written in an effect (refs
  // must not be written during render).
  const loadAllRef = useRef<typeof loadAll | null>(null);
  useEffect(() => { loadAllRef.current = loadAll; }, [loadAll]);

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
  const reconnect = useCallback(async () => {
    setConnectionState('reconnecting');
    await loadAll();
  }, [loadAll]);

  return {
    health, trends, simulation, config,
    loading, error, backendAvailable, connectionState,
    updateTrend, reload: loadAll, reconnect,
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
