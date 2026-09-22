// @vitest-environment jsdom
/**
 * The shared store (hooks/usePrism.ts): what it loads, how it reports an
 * unreachable service, how it recovers, and that an admin edit fails loudly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';

vi.mock('@/api/client', () => ({
  primeViewerCookie: vi.fn(async () => undefined),
  getHealth: vi.fn(),
  getDrivers: vi.fn(),
  getConfig: vi.fn(),
  getSimulation: vi.fn(),
  updateDriver: vi.fn(),
}));

import * as api from '@/api/client';
import usePrism, { PrismProvider } from '@/hooks/usePrism';
import { makeConfig, makeDriver, makeHealth, makeSimulation } from './fixtures/prism';

let lastStore: ReturnType<typeof usePrism> | null = null;

function Probe() {
  const store = usePrism();
  lastStore = store;
  return (
    <div>
      <span data-testid="connection">{store.connectionState}</span>
      <span data-testid="available">{String(store.backendAvailable)}</span>
      <span data-testid="drivers">{store.drivers.length}</span>
      <span data-testid="run">{store.simulation ? 'yes' : 'no'}</span>
      <span data-testid="error">{store.error ?? ''}</span>
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
    expect(screen.getByTestId('connection').textContent).toBe('connected');
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
    expect(screen.getByTestId('connection').textContent).toBe('offline');
    expect(screen.getByTestId('available').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('The PRISM service is unavailable: boom');
    expect(screen.getByTestId('run').textContent).toBe('no');
  });

  it('loads everything again on reload once the service answers', async () => {
    vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('cold start'));
    mount();
    await waitFor(() => expect(screen.getByTestId('connection').textContent).toBe('offline'));
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth());
    act(() => { screen.getByTestId('reload').click(); });
    await waitFor(() => expect(screen.getByTestId('connection').textContent).toBe('connected'));
    expect(screen.getByTestId('run').textContent).toBe('yes');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('refreshes the drivers after an admin edit and rejects a failed one', async () => {
    vi.mocked(api.getHealth).mockResolvedValue(makeHealth());
    mount();
    await loaded();
    vi.mocked(api.updateDriver).mockResolvedValue({ status: 'updated', driver_id: 'consumer_r01', changed: ['probability'] });
    vi.mocked(api.getDrivers).mockResolvedValue([makeDriver({ probability: 4 }), makeDriver({ id: 'consumer_r02' })]);
    await act(async () => { await lastStore!.updateDriver('consumer_r01', { probability: 4 }); });
    expect(api.updateDriver).toHaveBeenCalledWith('consumer_r01', { probability: 4 });
    expect(screen.getByTestId('drivers').textContent).toBe('2');

    vi.mocked(api.updateDriver).mockRejectedValue(new Error('Admin role required'));
    await act(async () => {
      await expect(lastStore!.updateDriver('consumer_r01', { probability: 3 })).rejects.toThrow('Admin role required');
    });
    expect(screen.getByTestId('error').textContent).toBe('Admin role required');
  });
});
