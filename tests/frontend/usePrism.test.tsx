// @vitest-environment jsdom
/**
 * Behavior pins for hooks/usePrism (review #7) — the contract any
 * rewrite must honor:
 *   1. happy load: health+trends+config fetched, simulation loaded
 *      only when health.has_simulation, state becomes "connected"
 *   2. backend down: offline state + error string + backendAvailable=false
 *   3. reconnect(): offline -> connected once the backend answers again
 *   4. health.has_simulation=false: simulation stays null and
 *      getSimulation is never called
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';

vi.mock('@/api/client', () => ({
  getHealth: vi.fn(),
  getTrends: vi.fn(),
  getConfig: vi.fn(),
  getSimulation: vi.fn(),
  updateTrend: vi.fn(),
}));

import * as api from '@/api/client';
import usePrism, { PrismProvider } from '@/hooks/usePrism';

const HEALTH_OK = { status: 'ok', version: 't', has_simulation: true } as never;
const SIM = { shifts: { 'Hair: Color': { 2030: { median: -0.01 } } } } as never;

function Probe() {
  const { connectionState, backendAvailable, trends, simulation, error, loading, reconnect } = usePrism();
  return (
    <div>
      <span data-testid="conn">{connectionState}</span>
      <span data-testid="avail">{String(backendAvailable)}</span>
      <span data-testid="trends">{trends.length}</span>
      <span data-testid="sim">{simulation ? 'yes' : 'no'}</span>
      <span data-testid="err">{error ?? ''}</span>
      <span data-testid="loading">{String(loading)}</span>
      <button data-testid="reconnect" onClick={() => void reconnect()}>r</button>
    </div>
  );
}

const mount = () => render(<PrismProvider><Probe /></PrismProvider>);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('usePrism', () => {
  it('happy load: connected, data set, simulation loaded when has_simulation', async () => {
    vi.mocked(api.getHealth).mockResolvedValue(HEALTH_OK);
    vi.mocked(api.getTrends).mockResolvedValue([{ id: 't1' }] as never);
    vi.mocked(api.getConfig).mockResolvedValue({ iterations: 1000 } as never);
    vi.mocked(api.getSimulation).mockResolvedValue(SIM);
    mount();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('conn').textContent).toBe('connected');
    expect(screen.getByTestId('avail').textContent).toBe('true');
    expect(screen.getByTestId('trends').textContent).toBe('1');
    expect(screen.getByTestId('sim').textContent).toBe('yes');
    expect(screen.getByTestId('err').textContent).toBe('');
  });

  it('backend down: offline + error + backendAvailable=false', async () => {
    vi.mocked(api.getHealth).mockRejectedValue(new Error('boom'));
    vi.mocked(api.getTrends).mockResolvedValue([] as never);
    vi.mocked(api.getConfig).mockResolvedValue(null as never);
    mount();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('conn').textContent).toBe('offline');
    expect(screen.getByTestId('avail').textContent).toBe('false');
    expect(screen.getByTestId('err').textContent).toContain('Backend unavailable');
    expect(screen.getByTestId('sim').textContent).toBe('no');
  });

  it('reconnect(): offline -> connected when backend answers again', async () => {
    vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('cold'));
    vi.mocked(api.getTrends).mockResolvedValue([] as never);
    vi.mocked(api.getConfig).mockResolvedValue(null as never);
    mount();
    await waitFor(() => expect(screen.getByTestId('conn').textContent).toBe('offline'));
    vi.mocked(api.getHealth).mockResolvedValue(HEALTH_OK);
    vi.mocked(api.getSimulation).mockResolvedValue(SIM);
    act(() => { screen.getByTestId('reconnect').click(); });
    await waitFor(() => expect(screen.getByTestId('conn').textContent).toBe('connected'));
    expect(screen.getByTestId('sim').textContent).toBe('yes');
  });

  it('has_simulation=false: simulation stays null, getSimulation never called', async () => {
    vi.mocked(api.getHealth).mockResolvedValue({ status: 'ok', version: 't', has_simulation: false } as never);
    vi.mocked(api.getTrends).mockResolvedValue([] as never);
    vi.mocked(api.getConfig).mockResolvedValue(null as never);
    mount();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('sim').textContent).toBe('no');
    expect(api.getSimulation).not.toHaveBeenCalled();
  });
});
