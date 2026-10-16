/**
 * Where a reader sends feedback: NEXT_PUBLIC_PRISM_FEEDBACK_URL, a mailto:
 * address or a link (a Teams channel, a form), read at build time. Unset, the
 * dashboard names the PRISM team without a link, so nothing points nowhere.
 */
const configured = (process.env.NEXT_PUBLIC_PRISM_FEEDBACK_URL ?? '').trim();

/** The feedback address, or null while none is configured. */
export const FEEDBACK_URL: string | null = /^(https?:|mailto:)/i.test(configured) ? configured : null;
