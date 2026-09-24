/**
 * The proposals of one driver: the signed-in expert's own proposal, the
 * aggregate over all experts and who scored what (GET
 * /api/v1/drivers/{id}/proposals). Expert Rating and Review & Endorse load
 * them when a driver's panel opens, after any save of the driver's proposal
 * still on its way has landed (lib/proposalSaves.ts), so a panel never shows,
 * and then saves over, the state before it.
 */
import { useState, useEffect, useCallback } from 'react';
import { getDriverProposals } from '@/lib/apiClient';
import { proposalSavesSettled } from '@/lib/proposalSaves';
import type { DriverProposalsResponse } from '@/types';

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
    proposalSavesSettled(driverId)
      .then(() => getDriverProposals(driverId))
      .then((r) => { if (!cancelled) { setData(r); setFailed(false); setLoaded(true); } })
      .catch(() => { if (!cancelled) { setData(null); setFailed(true); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [driverId, attempt]);
  const retry = useCallback(() => { setLoaded(false); setAttempt((n) => n + 1); }, []);
  return { data, loaded, failed, retry };
}
