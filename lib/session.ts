/**
 * Ending the session on this page, for the sign-out button and for "sign out
 * everywhere" in Settings.
 *
 * The expert's proposal edits still held back or on their way are sent and
 * settled first, while the viewer cookie still authorises them, for at most
 * SAVE_WAIT_MS: a save that has not landed by then is given up rather than
 * holding the user. Then the cookie is expired, because it is not tied to the
 * Clerk session and would otherwise outlive it in this browser; then Clerk
 * signs out. If signing out fails, the user is still signed in, so the page
 * may read again, and the error goes to the caller to show.
 */
import { clearViewerCookie, resumeViewerCookie } from '@/lib/apiClient';
import { settleProposalSaves } from '@/lib/proposalSaves';

/** How long signing out waits for the expert's saves to land. */
export const SAVE_WAIT_MS = 5_000;

// Whether this page is leaving its session: signing out, or signed out
// elsewhere and on its way to /sign-in. A "leave the page?" prompt over
// unsaved edits would then protect nothing, so the views that raise one ask
// first.
let ending = false;
export const sessionEnding = (): boolean => ending;
/** The session ended outside this page (expired or revoked); the page is about to leave. */
export function markSessionEnded(): void { ending = true; }

/** Resolves when `work` settles or after `ms`, whichever comes first. */
function within(ms: number, work: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}

export async function endSession(signOut: () => Promise<unknown>): Promise<void> {
  ending = true;
  try {
    await within(SAVE_WAIT_MS, settleProposalSaves());
    await clearViewerCookie();
  } catch (e) {
    ending = false;
    throw e;
  }
  try {
    await signOut();
  } catch (e) {
    // The user is still signed in: the page may read, and may warn, again.
    ending = false;
    resumeViewerCookie();
    throw e;
  }
}
