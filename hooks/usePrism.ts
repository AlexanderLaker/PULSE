/**
 * The dashboard's data: the drivers, the served run, the model configuration
 * and the service's health, loaded once and shared by every view.
 *
 * Mount <PrismProvider> once (app/dashboard/page.tsx); every view reads the
 * same store with usePrism(). The dashboard never simulates: it shows the
 * newest run the production job persisted.
 *
 * A load first asks /api/prism-cookie for the viewer cookie the /api/v1 reads
 * need. Every load takes a new sequence number and only the newest may write
 * state, so a slow earlier load can never overwrite a later one. Each part
 * (drivers, configuration, run) keeps its last good value when a reload of it
 * fails and reports the failure in its own error field, so a view can tell
 * "nothing there" from "could not be loaded". The store checks the
 * service's health every 60 s, and every 30 s while the service is
 * unreachable or its database cannot be used. It loads everything again
 * when the service answers again, when its database state changes (after a
 * migration or an outage) and when a newer run appears.
 *
 * A .ts module without JSX: the provider is built with createElement.
 */
'use client';

import {
  createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type FC, type ReactNode,
} from 'react';
import * as api from '@/lib/apiClient';
import type { DatabaseFailure, Driver, DriverUpdate, HealthStatus, ModelConfig, SimulationResult } from '@/types';

type ConnectionState = 'connected' | 'reconnecting' | 'offline';

export interface PrismStore {
  health: HealthStatus | null;
  drivers: Driver[];
  /** The served run; null when there is none (the views say why). */
  simulation: SimulationResult | null;
  config: ModelConfig | null;
  /** Why the last load of each part failed; null when it succeeded. */
  driversError: string | null;
  configError: string | null;
  simulationError: string | null;
  /** Set while the service answers but its database cannot be used. */
  databaseFailure: DatabaseFailure | null;
  /** True until the first load has finished. */
  loading: boolean;
  /** Set when the service itself could not be reached. */
  error: string | null;
  /** False while the service cannot be reached. */
  backendAvailable: boolean;
  /**
   * Admin edit of a driver. Rejects when the write fails (with status 409 when
   * the driver changed after `update.revision`); either way the drivers are
   * reloaded afterwards, and after a save the run too, so the "edited since
   * the run" notice follows.
   */
  updateDriver: (driverId: string, update: DriverUpdate) => Promise<void>;
  /** Load everything again (the retry and reconnect buttons). */
  reload: () => Promise<void>;
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: string };

const settle = <T,>(promise: Promise<T>): Promise<Settled<T>> =>
  promise.then(
    (value): Settled<T> => ({ ok: true, value }),
    (e: unknown): Settled<T> => ({ ok: false, error: (e as Error)?.message || 'Request failed' }),
  );

function usePrismStore(): PrismStore {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('reconnecting');
  const mounted = useRef(true);
  const loadSequence = useRef(0);
  // The health check reads the state through a ref, so its callback can stay stable.
  const connectionRef = useRef<ConnectionState>('reconnecting');
  useEffect(() => { connectionRef.current = connectionState; }, [connectionState]);

  /** Load the served run (when health says there is one); keeps the last good run on failure. */
  const loadSimulation = useCallback((hasSimulation: boolean, current: () => boolean) => {
    if (!hasSimulation) {
      setSimulation(null);
      setSimulationError(null);
      return Promise.resolve();
    }
    return settle(api.getSimulation()).then((run) => {
      if (!current()) return;
      if (run.ok) {
        setSimulation(run.value);
        setSimulationError(null);
      } else {
        setSimulationError(run.error);
      }
    });
  }, []);

  // A promise chain rather than async/await: every state write happens in a
  // continuation, so the mount effect can start a load without setting state
  // synchronously inside the effect.
  const load = useCallback(() => {
    const sequence = ++loadSequence.current;
    const current = () => mounted.current && sequence === loadSequence.current;
    return api.primeViewerCookie()
      .then(() => Promise.all([api.getHealth(), settle(api.getDrivers()), settle(api.getConfig())]))
      .then(([h, d, c]) => {
        if (!current()) return undefined;
        setConnectionState('connected');
        setError(null);
        setHealth(h);
        if (d.ok) { setDrivers(d.value); setDriversError(null); } else setDriversError(d.error);
        if (c.ok) { setConfig(c.value); setConfigError(null); } else setConfigError(c.error);
        return loadSimulation(h.has_simulation, current);
      })
      .catch((e: unknown) => {
        if (!current()) return;
        setConnectionState('offline');
        setHealth(null);
        setError(`The PRISM service is unavailable: ${(e as Error).message}`);
      })
      .finally(() => {
        if (current()) setLoading(false);
      });
  }, [loadSimulation]);

  const reload = useCallback(() => {
    setLoading(true);
    setConnectionState('reconnecting');
    return load();
  }, [load]);

  // The poll compares each answer with the last one through a ref, so its
  // callback can stay stable.
  const healthRef = useRef<HealthStatus | null>(null);
  useEffect(() => { healthRef.current = health; }, [health]);

  const checkHealth = useCallback(async () => {
    try {
      const h = await api.getHealth();
      if (!mounted.current) return;
      const wasDisconnected = connectionRef.current !== 'connected';
      setConnectionState('connected');
      setError(null);
      if (wasDisconnected) {
        void reload();   // the data may be stale or missing
        return;
      }
      const prev = healthRef.current;
      setHealth(h);
      // The database became usable or failed, or a production run wrote a
      // newer run: load again, without the loading state, so open views keep
      // their place.
      if (!prev || prev.status !== h.status || prev.simulation_reason !== h.simulation_reason
          || prev.latest_run_id !== h.latest_run_id) void load();
    } catch {
      if (mounted.current) setConnectionState('offline');
    }
  }, [reload, load]);

  const degraded = health?.status === 'degraded';
  useEffect(() => {
    const every = connectionState === 'connected' && !degraded ? 60_000 : 30_000;
    const timer = setInterval(() => { void checkHealth(); }, every);
    return () => clearInterval(timer);
  }, [connectionState, degraded, checkHealth]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load]);

  // updateDriver reads whether a run is shown through a ref, so it stays stable.
  const simulationRef = useRef<SimulationResult | null>(null);
  useEffect(() => { simulationRef.current = simulation; }, [simulation]);

  const updateDriver = useCallback(async (driverId: string, update: DriverUpdate) => {
    let saved = false;
    try {
      await api.updateDriver(driverId, update);
      saved = true;
    } finally {
      // After a save, and after a refusal (another change got there first),
      // show the drivers as they now are. A failed edit is the editor's
      // message to show, not a store-wide error.
      const fresh = await settle(api.getDrivers());
      if (mounted.current && fresh.ok) {
        setDrivers(fresh.value);
        setDriversError(null);
      }
      if (saved && mounted.current) {
        const sequence = loadSequence.current;
        void loadSimulation(simulationRef.current !== null, () => mounted.current && sequence === loadSequence.current);
      }
    }
  }, [loadSimulation]);

  const databaseFailure: DatabaseFailure | null = health?.status === 'degraded'
    && (health.simulation_reason === 'migration_pending' || health.simulation_reason === 'no_database'
      || health.simulation_reason === 'db_error')
    ? health.simulation_reason
    : null;

  // One object per state change, so a re-render of the page alone (a tab
  // switch) does not re-render every view that reads the store.
  return useMemo(() => ({
    health, drivers, simulation, config, driversError, configError, simulationError, databaseFailure,
    loading, error,
    backendAvailable: connectionState !== 'offline',
    updateDriver, reload,
  }), [health, drivers, simulation, config, driversError, configError, simulationError, databaseFailure,
    loading, error, connectionState, updateDriver, reload]);
}

const PrismContext = createContext<PrismStore | null>(null);

/** Mount once (app/dashboard/page.tsx); every view shares this store. */
export const PrismProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const store = usePrismStore();
  return createElement(PrismContext.Provider, { value: store }, children);
};

/** The shared store. Must be used inside <PrismProvider>. */
export default function usePrism(): PrismStore {
  const store = useContext(PrismContext);
  if (!store) throw new Error('usePrism must be used inside <PrismProvider> (app/dashboard/page.tsx)');
  return store;
}
