/**
 * Ending the session on the page (lib/session.ts) and the expert's proposal
 * saves it waits for (lib/proposalSaves.ts): edits held back or on their way
 * are sent and settled before the viewer cookie is expired, for a few seconds
 * at most, and a sign-out that fails lets the page read again.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const API = vi.hoisted(() => ({
  clearViewerCookie: vi.fn(async () => {}),
  resumeViewerCookie: vi.fn(),
}));
vi.mock('@/lib/apiClient', () => API);

import { SAVE_WAIT_MS, endSession } from '@/lib/session';
import {
  proposalSavesSettled, queueProposalSave, registerPendingSave, settleProposalSaves,
} from '@/lib/proposalSaves';

/** Lets every pending promise callback run. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  API.clearViewerCookie.mockClear();
  API.resumeViewerCookie.mockClear();
});

describe('the proposal saves', () => {
  it('reach the API one at a time, in order, and a failed one does not stop the next', async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const first = queueProposalSave('consumer_r01', () => new Promise<void>((_resolve, reject) => {
      release = () => { order.push('first'); reject(new Error('refused')); };
    }));
    const second = queueProposalSave('consumer_r01', async () => { order.push('second'); });
    await tick();
    expect(order).toEqual([]);   // the second waits for the first
    release();
    await expect(first).rejects.toThrow('refused');
    await second;
    expect(order).toEqual(['first', 'second']);
    await proposalSavesSettled('consumer_r01');
  });

  it('are all sent and settled on request, held-back edits included', async () => {
    const sent: string[] = [];
    let land: () => void = () => {};
    queueProposalSave('consumer_r02', () => new Promise<void>((resolve) => {
      land = () => { sent.push('on its way'); resolve(); };
    }));
    const unregister = registerPendingSave(() => {
      void queueProposalSave('consumer_r03', async () => { sent.push('held back'); });
    });
    const settled = settleProposalSaves();
    let done = false;
    void settled.then(() => { done = true; });
    await tick();
    expect(sent).toEqual(['held back']);
    expect(done).toBe(false);   // the save on its way has not landed
    land();
    await settled;
    expect(sent.sort()).toEqual(['held back', 'on its way']);
    unregister();
  });

  it('forget a panel once it has unregistered', async () => {
    const send = vi.fn();
    registerPendingSave(send)();
    await settleProposalSaves();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('ending the session', () => {
  it('sends the held-back edits and lets them land before the cookie is expired and Clerk signs out', async () => {
    const steps: string[] = [];
    const unregister = registerPendingSave(() => {
      void queueProposalSave('consumer_r04', async () => { steps.push('save landed'); });
    });
    API.clearViewerCookie.mockImplementationOnce(async () => { steps.push('cookie expired'); });
    await endSession(async () => { steps.push('signed out'); });
    expect(steps).toEqual(['save landed', 'cookie expired', 'signed out']);
    expect(API.resumeViewerCookie).not.toHaveBeenCalled();
    unregister();
  });

  it('gives up on a save that does not land within the wait, and signs out', async () => {
    let land: () => void = () => {};
    void queueProposalSave('consumer_r05', () => new Promise<void>((resolve) => { land = resolve; }));
    vi.useFakeTimers();
    try {
      const signOut = vi.fn(async () => {});
      const ended = endSession(signOut);
      await vi.advanceTimersByTimeAsync(SAVE_WAIT_MS - 1);
      expect(API.clearViewerCookie).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await ended;
      expect(API.clearViewerCookie).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      land();   // the save lands late, so no later test waits for it
      await proposalSavesSettled('consumer_r05');
    }
  });

  it('lets the page read again when signing out fails, and passes the error on', async () => {
    await expect(endSession(async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect(API.clearViewerCookie).toHaveBeenCalledTimes(1);
    expect(API.resumeViewerCookie).toHaveBeenCalledTimes(1);
  });
});
