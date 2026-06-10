/**
 * Central state hook for PRISM Profit Pool Shift Model.
 * Single source of truth — all components read from here.
 * Connects to real FastAPI backend. No mock data — shows empty state when backend unavailable.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../api/client';
import type {
  HealthStatus, Trend, ForceSummary, SimulationResult,
  ModelConfig, AnalyticsState, AISuggestion, TriggerStatus,
  ShiftMatrix, ConvergenceDiagnostics, SimulationParams,
  TrendUpdate,
} from '../types';

/** Return type for the usePulse hook. */
export interface UsePulseReturn {
  health: HealthStatus | null;
  trends: Trend[];
  forces: ForceSummary[];
  simulation: SimulationResult | null;
  config: ModelConfig | null;
  analytics: AnalyticsState | null;
  aiSuggestions: AISuggestion[];
  triggers: TriggerStatus[];
  loading: boolean;
  simulating: boolean;
  simulationStale: boolean;
  staleReason: string;
  error: string | null;
  backendAvailable: boolean;
  simulate: (params?: SimulationParams) => Promise<void>;
  updateTrend: (trendId: string, updates: TrendUpdate) => Promise<void>;
  reload: () => Promise<void>;
  loadAnalytics: () => Promise<void>;
}

export default function usePulse(): UsePulseReturn {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [forces, setForces] = useState<ForceSummary[]>([]);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [triggers, setTriggers] = useState<TriggerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simulationStale, setSimulationStale] = useState(false);
  const [staleReason, setStaleReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const mounted = useRef(true);

  // ── Initial load with graceful degradation ─────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, t, f, c] = await Promise.all([
        api.getHealth().catch((err: Error) => { throw err; }),
        api.getTrends().catch((): Trend[] => []),
        api.getForces().catch((): ForceSummary[] => []),
        api.getConfig().catch((): null => null),
      ]);

      if (!mounted.current) return;

      setBackendAvailable(true);
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

      setConfig(c);

      // Always try to load simulation (don't depend on has_simulation flag)
      {
        const sim = await api.getSimulation().catch((): null => null);
        if (sim && mounted.current) setSimulation(sim);
      }

      // Check if simulation is stale
      const status = await api.getSimulationStatus().catch(() => null);
      if (status && mounted.current) {
        setSimulationStale(status.stale);
        setStaleReason(status.reason || '');
      }

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
        setHealth({ status: 'offline', version: 'unavailable' });
        setSimulation(null);
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

  // ── Listen for config updates (from SettingsPage) ──
  useEffect(() => {
    const handleConfigUpdate = () => {
      // Re-fetch config after settings change (but don't auto-simulate)
      api.getConfig().then(c => { if (mounted.current) setConfig(c); }).catch(() => {});
      // Check stale status
      api.getSimulationStatus().then(s => {
        if (mounted.current) { setSimulationStale(s.stale); setStaleReason(s.reason || ''); }
      }).catch(() => {});
    };
    const handleStale = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (mounted.current) {
        setSimulationStale(true);
        setStaleReason(detail?.reason || 'Changes were made');
      }
    };
    window.addEventListener('pulse:config-updated', handleConfigUpdate);
    window.addEventListener('pulse:simulation-stale', handleStale);
    return () => {
      window.removeEventListener('pulse:config-updated', handleConfigUpdate);
      window.removeEventListener('pulse:simulation-stale', handleStale);
    };
  }, []);

  // ── Run simulation ──────────────────────────────────────────
  const simulate = useCallback(async (params: SimulationParams = {}) => {
    setSimulating(true);
    setError(null);
    try {
      if (!backendAvailable) {
        if (mounted.current) setError('Backend unavailable. Cannot run simulation.');
        return;
      }

      // Use iterations from config if available, otherwise default to 5000
      const configIterations = config?.iterations ?? 5000;

      const result = await api.runSimulation({
        iterations: configIterations,
        include_allocation: true,
        ...params,
      });
      if (mounted.current) {
        setSimulation(result);
        setSimulationStale(false);
        setStaleReason('');
        const t = await api.getTrends().catch((): Trend[] => []);
        if (mounted.current) setTrends(t);
      }
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
      }
    } finally {
      if (mounted.current) setSimulating(false);
    }
  }, [backendAvailable, config]);

  // ── Update trend score ──────────────────────────────────────
  const updateTrend = useCallback(async (trendId: string, updates: TrendUpdate) => {
    try {
      if (!backendAvailable) return;
      await api.updateTrend(trendId, updates);
      const t = await api.getTrends().catch((): Trend[] => []);
      if (mounted.current) {
        setTrends(t);
        setSimulationStale(true);
        setStaleReason(`Trend '${trendId}' was updated`);
      }
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

  return {
    health, trends, forces, simulation, config,
    analytics, aiSuggestions, triggers,
    loading, simulating, simulationStale, staleReason,
    error, backendAvailable,
    simulate, updateTrend, reload: loadAll, loadAnalytics,
  };
}
