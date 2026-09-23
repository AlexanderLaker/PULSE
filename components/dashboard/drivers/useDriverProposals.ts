/**
 * The proposals of one driver: the signed-in expert's own proposal, the
 * aggregate over all experts and who scored what (GET
 * /api/v1/drivers/{id}/proposals). Expert Rating and Review & Endorse load
 * them when a driver's panel opens.
 *
 * The expert's saves of a driver's proposal go through one queue per driver
 * that outlives the panels: they reach the API one at a time and in order,
 * and a panel opened while a save is still on its way (the row was closed
 * with an edit pending, then opened again) loads only after that save has
 * landed, so it never shows, and then saves over, the state before it.
 */
import { useState, useEffect, useCallback } from 'react';
import { getDriverProposals } from '@/lib/apiClient';
import type { DriverProposalsResponse } from '@/types';

const saveQueues = new Map<string, Promise<unknown>>();

/** Send a save of a driver's proposal after every earlier save of it has settled. */
export function queueProposalSave<T>(driverId: string, send: () => Promise<T>): Promise<T> {
  const next = (saveQueues.get(driverId) ?? Promise.resolve()).catch(() => undefined).then(send);
  saveQueues.set(driverId, next);
  // An idle queue is forgotten; the rejection is the caller's to handle.
  next.then(
    () => { if (saveQueues.get(driverId) === next) saveQueues.delete(driverId); },
    () => { if (saveQueues.get(driverId) === next) saveQueues.delete(driverId); },
  );
  return next;
}

/** Settles once every save of the driver's proposal queued so far has settled. */
function savesSettled(driverId: string): Promise<void> {
  return (saveQueues.get(driverId) ?? Promise.resolve()).then(() => undefined, () => undefined);
}

/** A driver's proposals, loaded when its panel opens. `failed` is set when the
 *  request failed; `retry` asks again. */
export function useDriverProposals(driverId: string): {
  data: DriverProposalsResponse | null; loaded: boolean; failed: boolean; retry: () => void;
} {
  const [data, setData] = useState<DriverProposalsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // A new driver id invalidates the previous payload: `loaded` resets during
  // render (the documented React pattern), so no pass reports the old
  // proposals as loaded for the new driver. The fetch stays in the effect and
  // sets state only from its promise callbacks.
  const [fetchingFor, setFetchingFor] = useState(driverId);
  if (fetchingFor !== driverId) {
    setFetchingFor(driverId);
    setLoaded(false);
    setFailed(false);
  }
  useEffect(() => {
    let cancelled = false;
    savesSettled(driverId)
      .then(() => getDriverProposals(driverId))
      .then((r) => { if (!cancelled) { setData(r); setFailed(false); setLoaded(true); } })
      .catch(() => { if (!cancelled) { setData(null); setFailed(true); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [driverId, attempt]);
  const retry = useCallback(() => { setLoaded(false); setAttempt((n) => n + 1); }, []);
  return { data, loaded, failed, retry };
}
