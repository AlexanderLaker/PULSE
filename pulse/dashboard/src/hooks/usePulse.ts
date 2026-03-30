/**
 * Central state hook for PRISM War Room.
 * Single source of truth — all components read from here.
 * Connects to real FastAPI backend. No mock data — shows empty state when backend unavailable.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../api/client';
import type {
  HealthStatus, Trend, ForceSummary, SimulationResult, Scenario,
  CausalDAG, ModelConfig, AnalyticsState, AISuggestion, TriggerStatus,
  ShiftMatrix, ConvergenceDiagnostics, SimulationParams,
  TrendUpdate,
} from '../types';

/** Return type for the usePulse hook. */
export interface UsePulseReturn {
  health: HealthStatus | null;
  trends: Trend[];
  forces: ForceSummary[];
  simulation: SimulationResult | null;
  scenarios: Scenario[];
  dag: CausalDAG | null;
  config: ModelConfig | null;
  analytics: AnalyticsState | null;
  aiSuggestions: AISuggestion[];
  triggers: TriggerStatus[];
  loading: boolean;
  simulating: boolean;
  error: string | null;
  backendAvailable: boolean;
  activeScenario: string;
  setActiveScenario: (scenario: string) => void;
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
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [dag, setDag] = useState<CausalDAG | null>(null);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [triggers, setTriggers] = useState<TriggerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [activeScenario, setActiveScenario] = useState('base');
  const mounted = useRef(true);

  // ── Initial load with graceful degradation ─────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, t, f, sc, d, c] = await Promise.all([
        api.getHealth().catch((err: Error) => { throw err; }),
        api.getTrends().catch((): Trend[] => []),
        api.getForces().catch((): ForceSummary[] => []),
        api.getScenarios().catch((): Scenario[] => []),
        api.getDAG().catch((): null => null),
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

      setScenarios(Array.isArray(sc) ? sc : []);
      setDag(d);
      setConfig(c);

      // Load simulation if available
      if (h?.has_simulation) {
        const sim = await api.getSimulation().catch((): null => null);
        if (sim && mounted.current) setSimulation(sim);
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

  // ── Listen for config updates (from SettingsPage) and auto-reload ──
  useEffect(() => {
    const handleConfigUpdate = () => {
      // Re-fetch config and simulation results after settings change
      api.getConfig().then(c => { if (mounted.current) setConfig(c); }).catch(() => {});
      // Wait a moment for the fire-and-forget re-simulation to complete, then reload
      setTimeout(() => {
        api.getSimulation().then(sim => { if (mounted.current && sim) setSimulation(sim); }).catch(() => {});
      }, 2000);
    };
    window.addEventListener('pulse:config-updated', handleConfigUpdate);
    return () => window.removeEventListener('pulse:config-updated', handleConfigUpdate);
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
        scenario: activeScenario,
        iterations: configIterations,
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
        setError((e as Error).message);
      }
    } finally {
      if (mounted.current) setSimulating(false);
    }
  }, [activeScenario, backendAvailable, config]);

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

  return {
    health, trends, forces, simulation, scenarios, dag, config,
    analytics, aiSuggestions, triggers,
    loading, simulating, error, backendAvailable,
    activeScenario, setActiveScenario,
    simulate, updateTrend, reload: loadAll, loadAnalytics,
  };
}
