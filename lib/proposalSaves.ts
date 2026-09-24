/**
 * The expert's proposal saves, which outlive the panels that make them.
 *
 * Every save of a driver's proposal goes through one queue per driver: saves
 * reach the API one at a time and in order, and a panel opened while a save
 * of its driver is still on its way loads only after that save has landed, so
 * it never shows, and then saves over, the state before it
 * (components/dashboard/drivers/useDriverProposals.ts).
 *
 * An Expert Rating panel sends its edits after a short pause. So that ending
 * the session loses none of them, a panel registers how to send the edit it
 * is holding back, and settleProposalSaves sends every such edit at once and
 * waits for all queues (lib/session.ts calls it before the viewer cookie is
 * expired).
 */

const saveQueues = new Map<string, Promise<unknown>>();
const pendingSenders = new Set<() => void>();

/** Send a save of a driver's proposal after every earlier save of it has settled. */
export function queueProposalSave<T>(driverId: string, send: () => Promise<T>): Promise<T> {
  const next = (saveQueues.get(driverId) ?? Promise.resolve()).catch(() => undefined).then(send);
  saveQueues.set(driverId, next);
  // An idle queue is forgotten; the rejection is the caller's to handle.
  const forget = () => { if (saveQueues.get(driverId) === next) saveQueues.delete(driverId); };
  next.then(forget, forget);
  return next;
}

/** Settles once every save of the driver's proposal queued so far has settled. */
export function proposalSavesSettled(driverId: string): Promise<void> {
  return (saveQueues.get(driverId) ?? Promise.resolve()).then(() => undefined, () => undefined);
}

/** Registers how to send an edit a panel is holding back; returns the unregistration. */
export function registerPendingSave(sendPending: () => void): () => void {
  pendingSenders.add(sendPending);
  return () => { pendingSenders.delete(sendPending); };
}

/** Sends every edit held back, then settles once every queued save has settled. */
export async function settleProposalSaves(): Promise<void> {
  for (const send of [...pendingSenders]) send();
  await Promise.all([...saveQueues.keys()].map(proposalSavesSettled));
}
