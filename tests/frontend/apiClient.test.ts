/**
 * lib/apiClient.ts: every request the dashboard makes. The viewer cookie lasts
 * thirty minutes, so a /api/v1 request answered 401 asks /api/prism-cookie for a
 * new one and is sent once more; the dashboard's own routes are never retried,
 * and a second 401 is the answer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, getDrivers, getJourneyContent, saveJourneyContent, updateDriver } from '@/lib/apiClient';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let calls: string[];

function answer(...responses: Response[]) {
  calls = [];
  const queue = [...responses];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(String(url));
    if (String(url) === '/api/prism-cookie') return json(200, { ok: true });
    return queue.shift() ?? json(500, { detail: 'unexpected request' });
  }));
}

beforeEach(() => { calls = []; });
afterEach(() => vi.unstubAllGlobals());

describe('the viewer cookie', () => {
  it('is renewed once when a read is answered 401, and the read is sent again', async () => {
    answer(json(401, { detail: 'Invalid or expired token' }), json(200, [{ id: 'consumer_r01' }]));
    await expect(getDrivers()).resolves.toEqual([{ id: 'consumer_r01' }]);
    expect(calls).toEqual(['/api/v1/drivers', '/api/prism-cookie', '/api/v1/drivers']);
  });

  it('is renewed at most once: a second 401 is the answer', async () => {
    answer(json(401, { detail: 'Invalid or expired token' }), json(401, { detail: 'Authentication required' }));
    const failure = await getDrivers().catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(401);
    expect((failure as ApiError).message).toBe('Authentication required');
    expect(calls).toEqual(['/api/v1/drivers', '/api/prism-cookie', '/api/v1/drivers']);
  });

  it('is not what a dashboard route answers 401 about, so those are not retried', async () => {
    answer(json(401, { error: 'Sign in again' }));
    await expect(updateDriver('consumer_r01', { revision: 1, probability: 3 })).rejects.toThrow('Sign in again');
    expect(calls).toEqual(['/api/drivers/consumer_r01']);
  });
});

describe('the journey content', () => {
  it('reads the stored version and saves with the version it started from', async () => {
    answer(json(200, { version: 7, content: null }), json(200, { status: 'saved', version: 8, tiles: 0 }));
    await expect(getJourneyContent()).resolves.toEqual({ version: 7, content: null });
    await saveJourneyContent({ lhc: [], hair: [] }, 7);
    const save = vi.mocked(fetch).mock.calls[1]!;
    expect(save[0]).toBe('/api/journey');
    expect(JSON.parse(String((save[1] as RequestInit).body))).toEqual({ base_version: 7, content: { lhc: [], hair: [] } });
  });
});

describe('an error answer', () => {
  it('reads as one line: the detail, the validation list, or the status', async () => {
    answer(json(409, { detail: 'This driver was changed after you opened it.' }));
    await expect(getDrivers()).rejects.toThrow('This driver was changed after you opened it.');
    answer(json(422, { detail: [{ loc: ['body', 'probability'], msg: 'Input should be less than or equal to 5' }] }));
    await expect(getDrivers()).rejects.toThrow('probability: Input should be less than or equal to 5');
    answer(json(403, { error: 'Admins only' }));
    await expect(getDrivers()).rejects.toThrow('Admins only');
    answer(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(getDrivers()).rejects.toThrow('Request failed (502)');
  });
});
