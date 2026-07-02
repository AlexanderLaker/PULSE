'use client';

/**
 * useOverlay — the ONE overlay behavior contract (R-03, design review
 * 2026-07-01). Every PRISM overlay (drill-down, settings, welcome, journey
 * panel, explorer drawer/notice) gets identical mechanics:
 *
 *   1. Escape closes.
 *   2. Body scroll is locked while open (no page scrolling behind).
 *   3. Focus moves into the dialog on open (container fallback).
 *   4. Tab / Shift+Tab are trapped inside the dialog.
 *   5. Focus RETURNS to the triggering element on close.
 *
 * Usage:
 *   const ref = useRef<HTMLElement | null>(null);
 *   useOverlay(open, onClose, ref);
 *   <aside ref={ref} role="dialog" aria-modal="true">…</aside>
 */

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useOverlay(
  open: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement | null>,
) {
  // Keep the latest onClose without re-binding listeners every render
  // (assigned in an effect — refs must not be written during render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    // (5) Remember the trigger to restore focus on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // (2) Body scroll lock — width-stable (avoid layout shift from the
    // disappearing scrollbar).
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;

    // (3) Move focus into the dialog (first focusable, else the container).
    const container = containerRef.current;
    const focusFirst = () => {
      if (!container) return;
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? container).focus({ preventScroll: true });
    };
    // After the open animation has mounted content.
    const raf = requestAnimationFrame(focusFirst);

    // (1) Escape + (4) focus trap.
    const onKeyDown = (e: KeyboardEvent) => {
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
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      // (5) Restore focus to the trigger.
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, containerRef]);
}
