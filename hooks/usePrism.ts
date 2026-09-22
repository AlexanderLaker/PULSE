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
 * state, so a slow earlier load can never overwrite a later one. While the
 * service is unreachable the store checks its health every 30 s (every 60 s
 * while connected) and reloads everything once it answers again.
 *
 * A .ts module without JSX: the provider is built with createElement.
 */
'use client';

import {
  createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type FC, type ReactNode,
} from 'react';
import * as api from '@/api/client';
import type { Driver, DriverUpdate, HealthStatus, ModelConfig, SimulationResult } from '@/types';

export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

export interface PrismStore {
  health: HealthStatus | null;
  drivers: Driver[];
  /** The served run; null when there is none (the views say why). */
  simulation: SimulationResult | null;
  config: ModelConfig | null;
  /** True until the first load has finished. */
  loading: boolean;
  error: string | null;
  connectionState: ConnectionState;
  /** False while the service cannot be reached. */
  backendAvailable: boolean;
  /** Admin edit of a driver; rejects when the write fails, then refreshes the drivers. */
  updateDriver: (driverId: string, update: DriverUpdate) => Promise<void>;
  /** Load everything again (the retry and reconnect buttons). */
  reload: () => Promise<void>;
}

function usePrismStore(): PrismStore {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('reconnecting');
  const mounted = useRef(true);
  const loadSequence = useRef(0);
  // The health check reads the state through a ref, so its callback can stay stable.
  const connectionRef = useRef<ConnectionState>('reconnecting');
  useEffect(() => { connectionRef.current = connectionState; }, [connectionState]);

  // A promise chain rather than async/await: every state write happens in a
  // continuation, so the mount effect can start a load without setting state
  // synchronously inside the effect.
  const load = useCallback(() => {
    const sequence = ++loadSequence.current;
    const current = () => mounted.current && sequence === loadSequence.current;
    return api.primeViewerCookie()
      .then(() => Promise.all([
        api.getHealth(),
        api.getDrivers().catch((): Driver[] => []),
        api.getConfig().catch((): null => null),
      ]))
      .then(([h, d, c]) => {
        if (!current()) return null;
        setConnectionState('connected');
        setHealth(h);
        setDrivers(d);
        setConfig(c);
        return h.has_simulation ? api.getSimulation().catch((): null => null) : null;
      })
      .then((run) => {
        if (current()) setSimulation(run);
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
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setConnectionState('reconnecting');
    return load();
  }, [load]);

  const checkHealth = useCallback(async () => {
    try {
      await api.getHealth();
      if (!mounted.current) return;
      const wasDisconnected = connectionRef.current !== 'connected';
      setConnectionState('connected');
      setError(null);
      if (wasDisconnected) void reload();   // the data may be stale or missing
    } catch {
      if (mounted.current) setConnectionState('offline');
    }
  }, [reload]);

  useEffect(() => {
    const timer = setInterval(() => { void checkHealth(); }, connectionState === 'connected' ? 60_000 : 30_000);
    return () => clearInterval(timer);
  }, [connectionState, checkHealth]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load]);

  const updateDriver = useCallback(async (driverId: string, update: DriverUpdate) => {
    try {
      await api.updateDriver(driverId, update);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
      throw e;
    }
    const fresh = await api.getDrivers().catch((): Driver[] | null => null);
    if (fresh && mounted.current) setDrivers(fresh);
  }, []);

  // One object per state change, so a re-render of the page alone (a tab
  // switch) does not re-render every view that reads the store.
  return useMemo(() => ({
    health, drivers, simulation, config, loading, error, connectionState,
    backendAvailable: connectionState !== 'offline',
    updateDriver, reload,
  }), [health, drivers, simulation, config, loading, error, connectionState, updateDriver, reload]);
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
