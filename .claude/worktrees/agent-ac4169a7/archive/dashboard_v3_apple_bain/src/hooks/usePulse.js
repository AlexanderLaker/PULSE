/**
 * Central state hook for PULSE War Room.
 * Single source of truth — all components read from here.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../lib/api';

export default function usePulse() {
  const [health, setHealth] = useState(null);
  const [trends, setTrends] = useState([]);
  const [forces, setForces] = useState([]);
  const [simulation, setSimulation] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [dag, setDag] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState(null);
  const [activeScenario, setActiveScenario] = useState('base');
  const mounted = useRef(true);

  // ── Initial load ────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, t, f, sc, d, c] = await Promise.all([
        api.getHealth(),
        api.getTrends().catch(() => []),
        api.getForces().catch(() => []),
        api.getScenarios().catch(() => []),
        api.getDAG().catch(() => null),
        api.getConfig().catch(() => null),
      ]);
      if (!mounted.current) return;
      setHealth(h);
      setTrends(t);
      setForces(Array.isArray(f) ? f : f?.forces ? f.forces.map(n => ({ name: n })) : []);
      setScenarios(sc);
      setDag(d);
      setConfig(c);

      // Load simulation if available
      if (h.has_simulation) {
        const sim = await api.getSimulation().catch(() => null);
        if (sim && mounted.current) setSimulation(sim);
      }
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadAll();
    return () => { mounted.current = false; };
  }, [loadAll]);

  // ── Run simulation ──────────────────────────────────────────
  const simulate = useCallback(async (params = {}) => {
    setSimulating(true);
    setError(null);
    try {
      const result = await api.runSimulation({
        scenario: activeScenario,
        iterations: 5000,
        include_allocation: true,
        ...params,
      });
      if (mounted.current) {
        setSimulation(result);
        // Refresh trends (scores may have changed)
        const t = await api.getTrends().catch(() => []);
        if (mounted.current) setTrends(t);
      }
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setSimulating(false);
    }
  }, [activeScenario]);

  // ── Update trend score ──────────────────────────────────────
  const updateTrend = useCallback(async (trendId, updates) => {
    try {
      await api.updateTrend(trendId, updates);
      // Refresh trends
      const t = await api.getTrends().catch(() => []);
      if (mounted.current) setTrends(t);
    } catch (e) {
      if (mounted.current) setError(e.message);
    }
  }, []);

  return {
    health, trends, forces, simulation, scenarios, dag, config,
    loading, simulating, error,
    activeScenario, setActiveScenario,
    simulate, updateTrend, reload: loadAll,
  };
}
