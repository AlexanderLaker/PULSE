// @vitest-environment jsdom
/**
 * hooks/useOverlay with two overlays open at once (Settings over a category
 * drill-down): only the one opened last answers Escape and Tab, and the page
 * stays locked until the last one closes, whichever closes first.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useRef, useState, type FC } from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import useOverlay from '@/hooks/useOverlay';

const Overlay: FC<{ name: string; onClose: () => void }> = ({ name, onClose }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useOverlay(true, onClose, ref);
  return (
    <div ref={ref} role="dialog" aria-label={name}>
      <button type="button">{name} first</button>
      <button type="button">{name} last</button>
    </div>
  );
};

const Page: FC = () => {
  const [open, setOpen] = useState({ drillDown: true, settings: true });
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => ({ ...o, drillDown: false }))}>close drill-down</button>
      {open.drillDown && <Overlay name="Drill-down" onClose={() => setOpen((o) => ({ ...o, drillDown: false }))} />}
      {open.settings && <Overlay name="Settings" onClose={() => setOpen((o) => ({ ...o, settings: false }))} />}
    </>
  );
};

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('stacked overlays', () => {
  it('Escape closes the overlay opened last, then the one below it', () => {
    render(<Page />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Drill-down' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Drill-down' })).toBeNull();
  });

  it('Tab stays inside the overlay opened last', () => {
    // jsdom lays nothing out, so every element would count as hidden to the trap.
    const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true, get() { return (this as HTMLElement).parentNode; },
    });
    try {
      render(<Page />);
      const first = screen.getByRole('button', { name: 'Settings first' });
      const last = screen.getByRole('button', { name: 'Settings last' });
      // Inside Settings, Tab is left to the browser: the drill-down below does not pull focus away.
      first.focus();
      expect(fireEvent.keyDown(window, { key: 'Tab' })).toBe(true);
      expect(document.activeElement).toBe(first);
      // At the edges it wraps within Settings.
      last.focus();
      expect(fireEvent.keyDown(window, { key: 'Tab' })).toBe(false);
      expect(document.activeElement).toBe(first);
      expect(fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })).toBe(false);
      expect(document.activeElement).toBe(last);
    } finally {
      if (offsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParent);
    }
  });

  it('keeps the page locked until the last overlay closes, whichever closes first', () => {
    document.body.style.overflow = 'auto';
    render(<Page />);
    expect(document.body.style.overflow).toBe('hidden');
    act(() => { screen.getByRole('button', { name: 'close drill-down' }).click(); });
    expect(screen.queryByRole('dialog', { name: 'Drill-down' })).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    expect(document.body.style.overflow).toBe('auto');
  });
});
