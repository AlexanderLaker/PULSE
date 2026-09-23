// @vitest-environment jsdom
/**
 * Two pieces of the dashboard shell:
 *
 *   - the service notice under the navigation says why nothing new loads
 *     while the database cannot be used (migration, no database, outage);
 *   - an overlay inside a hidden dashboard pane lets go of the page: the
 *     scroll lock and its keys come back when the pane shows again, and
 *     focus returns to the element that opened it when it closes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useRef, type FC } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { PrismStore } from '@/hooks/usePrism';
import type { DatabaseFailure } from '@/types';
import { makeStore } from './fixtures/prism';

const STORE = vi.hoisted(() => ({ current: null as PrismStore | null }));
vi.mock('@/hooks/usePrism', () => ({ default: () => STORE.current }));

import ServiceNotice, { SERVICE_NOTICES } from '@/components/dashboard/ServiceNotice';
import useOverlay, { PaneActiveContext } from '@/hooks/useOverlay';

afterEach(() => cleanup());

describe('the service notice', () => {
  it.each(['migration_pending', 'no_database', 'db_error'] as DatabaseFailure[])('explains %s', (failure) => {
    STORE.current = makeStore({ databaseFailure: failure });
    render(<ServiceNotice />);
    expect(screen.getByRole('status').textContent).toContain(SERVICE_NOTICES[failure]);
  });

  it('is absent while the database works', () => {
    STORE.current = makeStore();
    const { container } = render(<ServiceNotice />);
    expect(container.textContent).toBe('');
  });
});

const Dialog: FC<{ onClose: () => void }> = ({ onClose }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useOverlay(true, onClose, ref);
  return <div ref={ref} role="dialog"><button type="button">inside</button></div>;
};

const Overlay: FC<{ open: boolean }> = ({ open }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useOverlay(open, () => {}, ref);
  return open ? <div ref={ref} role="dialog"><button type="button">inside</button></div> : null;
};

describe('an overlay in a dashboard pane', () => {
  it('gives focus back to the element that opened it, even after its pane was hidden', () => {
    const tree = (open: boolean, paneOn: boolean) => (
      <>
        <button type="button">nav tab</button>
        <PaneActiveContext.Provider value={paneOn}>
          <button type="button">opener</button>
          <Overlay open={open} />
        </PaneActiveContext.Provider>
      </>
    );
    const { rerender } = render(tree(false, true));
    screen.getByRole('button', { name: 'opener' }).focus();
    rerender(tree(true, true));
    screen.getByRole('button', { name: 'nav tab' }).focus();   // another tab is chosen
    rerender(tree(true, false));
    rerender(tree(true, true));                                 // and this pane again
    rerender(tree(false, true));                                // the overlay closes
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'opener' }));
  });

  it('locks the page only while its pane is on screen', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <PaneActiveContext.Provider value><Dialog onClose={onClose} /></PaneActiveContext.Provider>);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<PaneActiveContext.Provider value={false}><Dialog onClose={onClose} /></PaneActiveContext.Provider>);
    expect(document.body.style.overflow).toBe('');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();   // the other pane's keys are its own

    rerender(<PaneActiveContext.Provider value><Dialog onClose={onClose} /></PaneActiveContext.Provider>);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
