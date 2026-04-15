/**
 * Central state hook for PRISM Profit Pool Shift Model.
 * Single source of truth — all components read from here.
 * Connects to real FastAPI backend with graceful fallback to mock data.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '@/api/client';
import type {
  HealthStatus, Trend, ForceSummary, SimulationResult, Scenario,
  ModelConfig, AnalyticsState, AISuggestion, TriggerStatus,
  ShiftMatrix, ConvergenceDiagnostics, SimulationParams,
  TrendUpdate,
} from '@/types';

/** Return type for the usePrism hook. */
export interface UsePrismReturn {
  health: HealthStatus | null;
  trends: Trend[];
  forces: ForceSummary[];
  simulation: SimulationResult | null;
  scenarios: Scenario[];
  config: ModelConfig | null;
  analytics: AnalyticsState | null;
  aiSuggestions: AISuggestion[];
  triggers: TriggerStatus[];
  loading: boolean;
  simulating: boolean;
  error: string | null;
  backendAvailable: boolean;
  connectionState: 'connected' | 'reconnecting' | 'offline';
  activeScenario: string;
  setActiveScenario: (scenario: string) => void;
  simulate: (params?: SimulationParams) => Promise<void>;
  updateTrend: (trendId: string, updates: TrendUpdate) => Promise<void>;
  reload: () => Promise<void>;
  reconnect: () => Promise<void>;
  loadAnalytics: () => Promise<void>;
}

export default function usePrism(): UsePrismReturn {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [forces, setForces] = useState<ForceSummary[]>([]);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [triggers, setTriggers] = useState<TriggerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'offline'>('reconnecting');
  const [activeScenario, setActiveScenario] = useState('base');
  const mounted = useRef(true);
  const healthCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Health check with reconnect logic ───────────────────────
  const performHealthCheck = useCallback(async () => {
    try {
      await api.getHealth();
      if (mounted.current) {
        setBackendAvailable(true);
        setConnectionState('connected');
        setError(null);
      }
    } catch (e) {
      if (mounted.current) {
        setBackendAvailable(false);
        setConnectionState('offline');
      }
    }
  }, []);

  // ── Schedule periodic health checks ──────────────────────────
  const scheduleHealthCheck = useCallback(() => {
    // Clear any existing interval
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }

    // Set new interval based on connection state
    if (connectionState === 'connected') {
      // Check every 60 seconds when connected
      healthCheckIntervalRef.current = setInterval(() => {
        void performHealthCheck();
      }, 60000);
    } else {
      // Check every 30 seconds when offline/reconnecting
      healthCheckIntervalRef.current = setInterval(() => {
        void performHealthCheck();
      }, 30000);
    }
  }, [connectionState, performHealthCheck]);

  // ── Update schedule when connection state changes ────────────
  useEffect(() => {
    scheduleHealthCheck();
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [scheduleHealthCheck]);

  // ── Initial load with graceful degradation ─────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConnectionState('reconnecting');
    try {
      const [h, t, f, sc, c] = await Promise.all([
        api.getHealth().catch((err: Error) => { throw err; }),
        api.getTrends().catch((): Trend[] => []),
        api.getForces().catch((): ForceSummary[] => []),
        api.getScenarios().catch((): Scenario[] => []),
        api.getConfig().catch((): null => null),
      ]);

      if (!mounted.current) return;

      setBackendAvailable(true);
      setConnectionState('connected');
      setHealth(h);
      setTrends(Array.isArray(t) ? t : []);

      // Handle forces — API may return array or { forces: string[] }
      if (Array.isArray(f)) {
        setForces(f as ForceSummary[]);
      } else if (f && typeof f === 'object' && 'forces' in f) {
        const forceObj = f as { forces: string[] };
        setForces(forceObj.forces.map(n => ({ name: n as ForceSummary['name'] })));
      } else {
        setForces([]);
      }

      setScenarios(Array.isArray(sc) ? sc : []);
      setConfig(c);

      // Load stored simulation if available
      if (h?.has_simulation) {
        const sim = await api.getSimulation().catch((): null => null);
        if (sim && mounted.current) setSimulation(sim);
      }
      // If no stored simulation, leave simulation as null — dashboard will prompt user to run one

      // Load analytics endpoints
      void Promise.all([
        api.getCVaR().catch((): null => null),
        api.getSobol().catch((): null => null),
        api.getTippingPoints().catch((): null => null),
        api.getAIInsights().catch((): AISuggestion[] => []),
        api.getTriggers().catch((): TriggerStatus[] => []),
      ]).then(([cvar, sobol, tips, aiSugg, trig]) => {
        if (mounted.current) {
          setAnalytics({ cvar, sobol, tips });
          setAiSuggestions(aiSugg ?? []);
          setTriggers(trig ?? []);
        }
      });
    } catch (e) {
      if (mounted.current) {
        setBackendAvailable(false);
        setConnectionState('offline');
        setHealth({ status: 'offline', version: 'unknown' });
        setError(`Backend unavailable. ${(e as Error).message}`);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadAll();
    return () => { mounted.current = false; };
  }, [loadAll]);

  // ── Run simulation ──────────────────────────────────────────
  const simulate = useCallback(async (params: SimulationParams = {}) => {
    setSimulating(true);
    setError(null);
    try {
      if (!backendAvailable) {
        if (mounted.current) setError('Cannot simulate — backend is offline.');
        return;
      }

      const result = await api.runSimulation({
        scenario: activeScenario,
        iterations: 5000,
        include_allocation: true,
        ...params,
      });
      if (mounted.current) {
        setSimulation(result);
        const t = await api.getTrends().catch((): Trend[] => []);
        if (mounted.current) setTrends(t);
      }
    } catch (e) {
      if (mounted.current) {
        setError(`Simulation failed: ${(e as Error).message}`);
      }
    } finally {
      if (mounted.current) setSimulating(false);
    }
  }, [activeScenario, backendAvailable]);

  // ── Update trend score ──────────────────────────────────────
  const updateTrend = useCallback(async (trendId: string, updates: TrendUpdate) => {
    try {
      if (!backendAvailable) return;
      await api.updateTrend(trendId, updates);
      const t = await api.getTrends().catch((): Trend[] => []);
      if (mounted.current) setTrends(t);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    }
  }, [backendAvailable]);

  // ── Load analytics data ─────────────────────────────────────
  const loadAnalytics = useCallback(async () => {
    if (!backendAvailable) return;
    try {
      const [cvar, sobol, tips] = await Promise.all([
        api.getCVaR().catch((): null => null),
        api.getSobol().catch((): null => null),
        api.getTippingPoints().catch((): null => null),
      ]);
      if (mounted.current) setAnalytics({ cvar, sobol, tips });
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    }
  }, [backendAvailable]);

  // ── Explicit reconnect function ──────────────────────────────
  const reconnect = useCallback(async () => {
    setConnectionState('reconnecting');
    await loadAll();
  }, [loadAll]);

  return {
    health, trends, forces, simulation, scenarios, config,
    analytics, aiSuggestions, triggers,
    loading, simulating, error, backendAvailable, connectionState,
    activeScenario, setActiveScenario,
    simulate, updateTrend, reload: loadAll, reconnect, loadAnalytics,
  };
}
