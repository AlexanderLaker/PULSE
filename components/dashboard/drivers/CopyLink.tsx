/**
 * "Copy link": the address of the view as it is, for a driver to paste into a
 * note or a deck. The address comes from the address-bar state
 * (hooks/useViewUrl.tsx), so it carries the expanded driver and the mode.
 * The clipboard confirms in a status line; where the browser refuses the
 * clipboard, the address shows in a read-only field to copy by hand.
 */
import { useEffect, useRef, useState, type FC } from 'react';
import { Link2 } from 'lucide-react';
import useViewUrl from '@/hooks/useViewUrl';
import { S, HEADLINE_FONT } from '@/lib/theme';

export const CopyLinkButton: FC<{ what?: string }> = ({ what = 'this driver' }) => {
  const { href } = useViewUrl();
  const [state, setState] = useState<'idle' | 'copied' | 'shown'>('idle');
  const [address, setAddress] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    const url = href();
    setAddress(url);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('The clipboard is not available');
      await navigator.clipboard.writeText(url);
      setState('copied');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('shown');
    }
  };

  return (
    <span className="inline-flex items-center gap-2 flex-wrap min-w-0">
      <button type="button" onClick={copy} data-print-hide
        className="inline-flex items-center gap-1.5"
        style={{
          padding: '5px 12px', borderRadius: 999, border: `1px solid ${S.cardBorder}`,
          background: S.surface, color: S.primary, fontFamily: HEADLINE_FONT,
          fontSize: 11, fontWeight: 700, cursor: 'pointer', minHeight: 24,
        }}>
        <Link2 size={12} strokeWidth={2.4} aria-hidden />
        Copy link
      </button>
      <span role="status" style={{ fontSize: 11, fontWeight: 700, color: S.onSurfaceVariant }}>
        {state === 'copied' ? 'Link copied' : ''}
      </span>
      {state === 'shown' && (
        <input
          readOnly
          value={address}
          aria-label={`Link to ${what}`}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            minWidth: 0, width: 'min(420px, 100%)', padding: '4px 8px', borderRadius: 6,
            border: `1px solid ${S.cardBorder}`, backgroundColor: S.surfaceLow,
            color: S.onSurface, fontSize: 11,
          }}
        />
      )}
    </span>
  );
};
