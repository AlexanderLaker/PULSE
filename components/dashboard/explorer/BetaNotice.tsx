/**
 * The Beta notice, shown on a viewer's first visit to the Explorer and
 * remembered in their browser once acknowledged.
 */
import { useRef, type FC } from 'react';
import useOverlay from '@/hooks/useOverlay';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';

export const NOTICE_ACK_KEY = 'prism.explorerNoticeAck.v1';

/** SSR-safe ack read. On the server we report "acked" so the dialog can
 *  never try to auto-open outside the browser; storage failures (privacy
 *  mode) read as not-acked, so the notice still shows. */
export function noticeAcked(): boolean {
  if (typeof window === 'undefined') return true;
  try { return window.localStorage.getItem(NOTICE_ACK_KEY) === '1'; } catch { return false; }
}

export const ExplorerBetaNotice: FC<{ open: boolean; onAck: () => void; onClose: () => void }> = ({
  open, onAck, onClose,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  // The shared overlay behaviour: Escape, focus trap, initial focus, focus
  // return, scroll lock.
  useOverlay(open, onClose, ref);
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1120,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: S.scrim,
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explorer-notice-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 448, width: '100%', background: S.surface, borderRadius: 16,
          boxShadow: SHADOW.dialog, padding: 24,
          fontFamily: BODY_FONT, color: S.onSurface,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: S.primaryDim, marginBottom: 8 }}>
          Beta
        </div>
        <h2
          id="explorer-notice-title"
          style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 20, color: S.onBg, margin: '0 0 8px', letterSpacing: -0.2 }}
        >
          Profit Pool Explorer
        </h2>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: S.onSurfaceVariant, margin: '0 0 18px' }}>
          Market sizes are public triangulations on Euromonitor&rsquo;s
          category tree (consumer hair, laundry and home care) and on Kline
          (professional hair); none is confirmed against Passport yet.
          Margins are GP1 estimates calibrated to company filings.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button"
            onClick={onAck}
            style={{
              padding: '9px 18px', borderRadius: 999, border: 'none',
              background: S.surfaceLow, color: S.primary,
              fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
