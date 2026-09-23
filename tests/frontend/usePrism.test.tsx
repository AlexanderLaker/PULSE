// @vitest-environment jsdom
/**
 * The shared store (hooks/usePrism.ts): what it loads, how it reports an
 * unreachable service and a part that failed to load, how it recovers, and
 * what an admin edit does to the drivers and the run.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';

vi.mock('@/lib/apiClient', () => ({
  primeViewerCookie: vi.fn(async () => undefined),
  getHealth: vi.fn(),
  getDrivers: vi.fn(),
  getConfig: vi.fn(),
  getSimulation: vi.fn(),
  updateDriver: vi.fn(),
}));

import * as api from '@/lib/apiClient';
import usePrism, { PrismProvider } from '@/hooks/usePrism';
import { makeConfig, makeDriver, makeHealth, makeSimulation } from './fixtures/prism';

let lastStore: ReturnType<typeof usePrism> | null = null;

function Probe() {
  const store = usePrism();
  lastStore = store;
  return (
    <div>
      <span data-testid="available">{String(store.backendAvailable)}</span>
      <span data-testid="drivers">{store.drivers.length}</span>
      <span data-testid="run">{store.simulation ? 'yes' : 'no'}</span>
      <span data-testid="error">{store.error ?? ''}</span>
      <span data-testid="drivers-error">{store.driversError ?? ''}</span>
      <span data-testid="run-error">{store.simulationError ?? ''}</span>
      <span data-testid="database">{store.databaseFailure ?? ''}</span>
      <span data-testid="loading">{String(store.loading)}</span>
      <button data-testid="reload" onClick={() => void store.reload()}>reload</button>
    </div>
  );
}

const mount = () => render(<PrismProvider><Probe /></PrismProvider>);
const loaded = () => waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

beforeEach(() => {
  vi.clearAllMocks();
  lastStore = null;
  vi.mocked(api.getDrivers).mockResolvedValue([makeDriver()]);
  vi.mocked(api.getConfig).mockResolvedValue(makeConfig());
  vi.mocked(api.getSimulation).mockResolvedValue(makeSimulation());
});

afterEach(() => cleanup());

describe('usePrism', () => {
  it('asks for the viewer cookie, then loads the drivers, the configuration and the run', async () => {
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth());
    mount();
    await loaded();
    expect(api.primeViewerCookie).toHaveBeenCalledBefore(vi.mocked(api.getHealth));
    expect(screen.getByTestId('available').textContent).toBe('true');
    expect(screen.getByTestId('drivers').textContent).toBe('1');
    expect(screen.getByTestId('run').textContent).toBe('yes');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('does not ask for a run the service says it does not have', async () => {
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth({ has_simulation: false, simulation_reason: 'no_rows' }));
    mount();
    await loaded();
    expect(screen.getByTestId('run').textContent).toBe('no');
    expect(api.getSimulation).not.toHaveBeenCalled();
  });

  it('reports an unreachable service', async () => {
    vi.mocked(api.getHealth).mockRejectedValue(new Error('boom'));
    mount();
    await loaded();
    expect(screen.getByTestId('available').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('The PRISM service is unavailable: boom');
    expect(screen.getByTestId('run').textContent).toBe('no');
  });

  it('loads everything again on reload once the service answers', async () => {
    vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('cold start'));
    mount();
    await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('false'));
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth());
    act(() => { screen.getByTestId('reload').click(); });
    await waitFor(() => expect(screen.getByTestId('run').textContent).toBe('yes'));
    expect(screen.getByTestId('available').textContent).toBe('true');
    expect(screen.getByTestId('run').textContent).toBe('yes');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('refreshes the drivers and the run after an admin edit', async () => {
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth());
    mount();
    await loaded();
    expect(api.getSimulation).toHaveBeenCalledTimes(1);
    vi.mocked(api.updateDriver).mockResolvedValue({
      status: 'updated', driver_id: 'consumer_r01', changed: ['probability'], revision: 2,
    });
    vi.mocked(api.getDrivers).mockResolvedValue([makeDriver({ probability: 4 }), makeDriver({ id: 'consumer_r02' })]);
    await act(async () => { await lastStore!.updateDriver('consumer_r01', { revision: 1, probability: 4 }); });
    expect(api.updateDriver).toHaveBeenCalledWith('consumer_r01', { revision: 1, probability: 4 });
    expect(screen.getByTestId('drivers').textContent).toBe('2');
    await waitFor(() => expect(api.getSimulation).toHaveBeenCalledTimes(2));   // the "edited since the run" notice follows
  });

  it('rejects a refused edit, shows the drivers as they now are, and keeps the store error clear', async () => {
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth());
    mount();
    await loaded();
    vi.mocked(api.updateDriver).mockRejectedValue(new Error('This driver was changed after you opened it'));
    vi.mocked(api.getDrivers).mockResolvedValue([makeDriver({ revision: 3 })]);
    await act(async () => {
      await expect(lastStore!.updateDriver('consumer_r01', { revision: 1, probability: 3 }))
        .rejects.toThrow('changed after you opened it');
    });
    expect(lastStore!.drivers[0]!.revision).toBe(3);
    expect(screen.getByTestId('error').textContent).toBe('');   // the editor shows the message, not the whole page
    expect(api.getSimulation).toHaveBeenCalledTimes(1);          // nothing was saved, so the run is not reloaded
  });

  it('loads the run after an edit when the service holds one, although the last load of it failed', async () => {
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth());
    vi.mocked(api.getSimulation).mockRejectedValueOnce(new Error('timed out'));
    mount();
    await loaded();
    expect(screen.getByTestId('run').textContent).toBe('no');
    expect(screen.getByTestId('run-error').textContent).toBe('timed out');
    vi.mocked(api.updateDriver).mockResolvedValue({
      status: 'updated', driver_id: 'consumer_r01', changed: ['probability'], revision: 2,
    });
    await act(async () => { await lastStore!.updateDriver('consumer_r01', { revision: 1, probability: 4 }); });
    await waitFor(() => expect(screen.getByTestId('run').textContent).toBe('yes'));
    expect(screen.getByTestId('run-error').textContent).toBe('');
  });

  it('resolves an edit once the drivers are in, while the run is still on its way', async () => {
    // The editor closes when the edit resolves; were it to wait for the run, the
    // reloaded driver (one revision on) would meet an editor still open.
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth());
    mount();
    await loaded();
    vi.mocked(api.updateDriver).mockResolvedValue({
      status: 'updated', driver_id: 'consumer_r01', changed: ['probability'], revision: 2,
    });
    vi.mocked(api.getDrivers).mockResolvedValue([makeDriver({ revision: 2 })]);
    vi.mocked(api.getSimulation).mockImplementation(() => new Promise(() => {}));
    await act(async () => { await lastStore!.updateDriver('consumer_r01', { revision: 1, probability: 4 }); });
    expect(lastStore!.drivers[0]!.revision).toBe(2);
    expect(api.getSimulation).toHaveBeenCalledTimes(2);
  });

  it('loads the run after a refused edit that replaced a load still bringing it', async () => {
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth({ latest_run_id: 99 }));
    let answerRun: (run: ReturnType<typeof makeSimulation>) => void = () => {};
    vi.mocked(api.getSimulation)
      .mockImplementationOnce(() => new Promise((resolve) => { answerRun = resolve; }))
      .mockResolvedValue(makeSimulation());
    mount();
    await waitFor(() => expect(screen.getByTestId('drivers').textContent).toBe('1'));
    vi.mocked(api.updateDriver).mockRejectedValue(new Error('This driver was changed after you opened it'));
    await act(async () => {
      await expect(lastStore!.updateDriver('consumer_r01', { revision: 1, probability: 3 })).rejects.toThrow();
    });
    await waitFor(() => expect(screen.getByTestId('run').textContent).toBe('yes'));
    expect(api.getSimulation).toHaveBeenCalledTimes(2);
    await act(async () => { answerRun(makeSimulation()); });   // the replaced load's answer changes nothing
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('never lets a load still in flight overwrite the drivers an edit reloaded', async () => {
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth());
    mount();
    await loaded();
    let answerStale: (drivers: ReturnType<typeof makeDriver>[]) => void = () => {};
    vi.mocked(api.getDrivers)
      .mockImplementationOnce(() => new Promise((resolve) => { answerStale = resolve; }))
      .mockResolvedValue([makeDriver({ revision: 2 }), makeDriver({ id: 'consumer_r02' })]);
    act(() => { screen.getByTestId('reload').click(); });
    await waitFor(() => expect(api.getDrivers).toHaveBeenCalledTimes(2));
    vi.mocked(api.updateDriver).mockResolvedValue({
      status: 'updated', driver_id: 'consumer_r01', changed: ['probability'], revision: 2,
    });
    await act(async () => { await lastStore!.updateDriver('consumer_r01', { revision: 1, probability: 4 }); });
    expect(screen.getByTestId('drivers').textContent).toBe('2');
    await act(async () => { answerStale([makeDriver({ revision: 1 })]); });
    expect(screen.getByTestId('drivers').textContent).toBe('2');
    expect(lastStore!.drivers[0]!.revision).toBe(2);
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('reports a part that failed to load and keeps what loaded before', async () => {
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth());
    mount();
    await loaded();
    vi.mocked(api.getDrivers).mockRejectedValue(new Error('Invalid or expired token'));
    vi.mocked(api.getSimulation).mockRejectedValue(new Error('timed out'));
    act(() => { screen.getByTestId('reload').click(); });
    await loaded();
    expect(screen.getByTestId('drivers-error').textContent).toBe('Invalid or expired token');
    expect(screen.getByTestId('run-error').textContent).toBe('timed out');
    expect(screen.getByTestId('drivers').textContent).toBe('1');   // the last good list stays
    expect(screen.getByTestId('run').textContent).toBe('yes');     // and so does the last good run
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('names a database the service cannot use', async () => {
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth({
      status: 'degraded', has_simulation: false, simulation_reason: 'migration_pending', driver_count: 0,
    }));
    vi.mocked(api.getDrivers).mockRejectedValue(new Error('This database needs migration 0001_driver_schema'));
    mount();
    await loaded();
    expect(screen.getByTestId('database').textContent).toBe('migration_pending');
    expect(screen.getByTestId('available').textContent).toBe('true');
    expect(screen.getByTestId('drivers-error').textContent).toContain('needs migration');
  });

  it('loads again by itself once the database can be used', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(api.getHealth).mockResolvedValue(makeHealth({
        status: 'degraded', has_simulation: false, simulation_reason: 'migration_pending', driver_count: 0,
        latest_run_id: null,
      }));
      vi.mocked(api.getDrivers).mockRejectedValue(new Error('This database needs migration 0001_driver_schema'));
      mount();
      await loaded();
      expect(screen.getByTestId('run').textContent).toBe('no');
      // The migration commits; the next check, 30 s later while degraded, finds the service healthy.
      vi.mocked(api.getHealth).mockResolvedValue(makeHealth());
      vi.mocked(api.getDrivers).mockResolvedValue([makeDriver()]);
      await act(async () => { vi.advanceTimersByTime(30_000); });
      await waitFor(() => expect(screen.getByTestId('run').textContent).toBe('yes'));
      expect(screen.getByTestId('database').textContent).toBe('');
      expect(screen.getByTestId('drivers-error').textContent).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the run through a database outage and loads again once the database answers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(api.getHealth).mockResolvedValue(makeHealth({ latest_run_id: 99 }));
      mount();
      await loaded();
      expect(api.getSimulation).toHaveBeenCalledTimes(1);
      // The database stops answering: the next check brings up the notice and nothing else.
      vi.mocked(api.getHealth).mockResolvedValue(makeHealth({
        status: 'degraded', has_simulation: false, simulation_reason: 'db_error', driver_count: 0,
        latest_run_id: null,
      }));
      await act(async () => { vi.advanceTimersByTime(60_000); });
      await waitFor(() => expect(screen.getByTestId('database').textContent).toBe('db_error'));
      expect(screen.getByTestId('run').textContent).toBe('yes');
      expect(screen.getByTestId('drivers').textContent).toBe('1');
      expect(api.getDrivers).toHaveBeenCalledTimes(1);
      // It answers again: the check 30 s later, while degraded, loads everything again.
      vi.mocked(api.getHealth).mockResolvedValue(makeHealth({ latest_run_id: 99 }));
      await act(async () => { vi.advanceTimersByTime(30_000); });
      await waitFor(() => expect(api.getSimulation).toHaveBeenCalledTimes(2));
      expect(screen.getByTestId('database').textContent).toBe('');
      expect(screen.getByTestId('run').textContent).toBe('yes');
      expect(screen.getByTestId('loading').textContent).toBe('false');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the run when the service comes back degraded after being unreachable', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(api.getHealth).mockResolvedValue(makeHealth({ latest_run_id: 99 }));
      mount();
      await loaded();
      vi.mocked(api.getHealth).mockRejectedValue(new Error('network'));
      await act(async () => { vi.advanceTimersByTime(60_000); });
      await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('false'));
      vi.mocked(api.getHealth).mockResolvedValue(makeHealth({
        status: 'degraded', has_simulation: false, simulation_reason: 'db_error', driver_count: 0,
        latest_run_id: null,
      }));
      vi.mocked(api.getDrivers).mockRejectedValue(new Error('The database cannot be reached'));
      await act(async () => { vi.advanceTimersByTime(30_000); });
      await waitFor(() => expect(screen.getByTestId('database').textContent).toBe('db_error'));
      await loaded();
      expect(screen.getByTestId('available').textContent).toBe('true');
      expect(screen.getByTestId('run').textContent).toBe('yes');
      expect(screen.getByTestId('drivers').textContent).toBe('1');
      expect(screen.getByTestId('run-error').textContent).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('picks up a newer run on its next health check, without a loading state', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(api.getHealth).mockResolvedValue(makeHealth({ latest_run_id: 99 }));
      mount();
      await loaded();
      expect(api.getSimulation).toHaveBeenCalledTimes(1);
      vi.mocked(api.getHealth).mockResolvedValue(makeHealth({ latest_run_id: 100 }));
      await act(async () => { vi.advanceTimersByTime(60_000); });
      await waitFor(() => expect(api.getSimulation).toHaveBeenCalledTimes(2));
      expect(screen.getByTestId('loading').textContent).toBe('false');
    } finally {
      vi.useRealTimers();
    }
  });
});
