'use client';

/**
 * useOverlay: the behaviour every overlay shares (drill-down, settings,
 * welcome dialog, journey panel, explorer drawer and notice).
 *
 *   1. Escape closes it.
 *   2. The page behind it does not scroll.
 *   3. Focus moves into it on open (to the container if nothing is focusable).
 *   4. Tab and Shift+Tab stay inside it.
 *   5. Focus returns to the element that opened it.
 *
 * Overlays can stack (Settings opened over a drill-down): only the one opened
 * last answers Escape and Tab, and the page stays locked until the last one
 * closes.
 *
 *   const ref = useRef<HTMLElement | null>(null);
 *   useOverlay(open, onClose, ref);
 *   <aside ref={ref} role="dialog" aria-modal="true">...</aside>
 *
 * The dashboard keeps visited panes mounted but hidden. An overlay inside a
 * hidden pane (PaneActiveContext false) lets go of the page, the scroll lock
 * and the keys included, and takes them back when its pane shows again. The
 * element that opened it is recorded when it opens, so focus returns there
 * when it closes, however often its pane was hidden in between.
 */

import { createContext, useContext, useEffect, useRef, type RefObject } from 'react';

/** Whether the dashboard pane around an overlay is on screen (true outside the panes). */
export const PaneActiveContext = createContext(true);

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The overlays holding the page, the one opened last at the end. */
const stack: object[] = [];
/** The body's own scroll style while the page is held, restored when the last overlay lets go. */
let bodyStyle: { overflow: string; paddingRight: string } | null = null;

function hold(overlay: object) {
  if (stack.length === 0) {
    // (2) Lock the page scroll without a layout shift from the
    // disappearing scrollbar.
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    bodyStyle = { overflow: document.body.style.overflow, paddingRight: document.body.style.paddingRight };
    document.body.style.overflow = 'hidden';
    if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;
  }
  stack.push(overlay);
}

function release(overlay: object) {
  const i = stack.indexOf(overlay);
  if (i >= 0) stack.splice(i, 1);
  if (stack.length === 0 && bodyStyle) {
    document.body.style.overflow = bodyStyle.overflow;
    document.body.style.paddingRight = bodyStyle.paddingRight;
    bodyStyle = null;
  }
}

const isTopmost = (overlay: object) => stack[stack.length - 1] === overlay;

/** Whether an overlay holds the page now: the page's own shortcut keys wait until none does. */
export const overlayOpen = (): boolean => stack.length > 0;

export default function useOverlay(
  open: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement | null>,
) {
  const paneActive = useContext(PaneActiveContext);
  const active = open && paneActive;
  // Keep the latest onClose without re-binding listeners every render
  // (assigned in an effect: refs must not be written during render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // (5) Remember the trigger when the overlay opens and give focus back to it
  // when the overlay closes or unmounts.
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    return () => { trigger?.focus?.({ preventScroll: true }); };
  }, [open]);

  useEffect(() => {
    if (!active) return;
    const overlay = {};
    hold(overlay);

    // (3) Move focus into the dialog (first focusable, else the container).
    const container = containerRef.current;
    const focusFirst = () => {
      if (!container) return;
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? container).focus({ preventScroll: true });
    };
    // After the open animation has mounted content.
    const raf = requestAnimationFrame(focusFirst);

    // (1) Escape + (4) focus trap, for the overlay opened last only.
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTopmost(overlay)) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !container) return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!focusables.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    // window (not document) so a key event bubbles here from any focused
    // element and matches synthetic dispatches in tests.
    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      release(overlay);
    };
  }, [active, containerRef]);
}
