// @vitest-environment jsdom
/**
 * The states a pane shows instead of its content:
 *
 *   - ErrorBoundary: a pane's error fills the pane, not the page, is headed
 *     by an h2 under the page's own heading, names the PRISM team through the
 *     feedback link and offers to try again.
 *   - PaneSkeleton: its bars take a share of the width with a cap, so a phone
 *     shows nothing wider than its screen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState, type FC } from 'react';

import ErrorBoundary from '@/components/dashboard/ErrorBoundary';
import { PaneSkeleton } from '@/components/dashboard/LoadingSkeleton';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Throws while `pane.broken`, like a pane whose data is wrong until a retry. */
const pane = { broken: true };
const Flaky: FC = () => {
  if (pane.broken) throw new Error('matrix exploded');
  return <p>the pane</p>;
};

describe('ErrorBoundary', () => {
  it("shows a pane-sized error with an h2 and the feedback link, and Try again renders the pane", () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    pane.broken = true;
    const { container } = render(<ErrorBoundary><Flaky /></ErrorBoundary>);

    const heading = screen.getByRole('heading', { level: 2, name: 'Something went wrong' });
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    const box = heading.closest('div')!.parentElement as HTMLElement;
    expect(box.style.minHeight).toBe('60vh');
    expect(screen.getByText(/^The page hit an unexpected error\. Try again; if it happens again, tell /)).toBeTruthy();
    expect(screen.getByText('the PRISM team')).toBeTruthy();

    pane.broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('the pane')).toBeTruthy();
    expect(container.textContent).not.toContain('Something went wrong');
  });
});

describe('PaneSkeleton', () => {
  it('draws its bars in shares of the width, capped, never in fixed widths a phone cannot hold', () => {
    const { container } = render(<PaneSkeleton />);
    const bars = Array.from(container.querySelectorAll<HTMLElement>('[style*="animation"]'));
    expect(bars.length).toBeGreaterThan(10);
    const fixed = bars.map((b) => b.style.width).filter((w) => w.endsWith('px')).map((w) => parseFloat(w));
    expect(fixed).toEqual([]);
    const capped = bars.filter((b) => b.style.width.endsWith('%') && b.style.width !== '100%');
    expect(capped.length).toBeGreaterThanOrEqual(2);
    expect(capped.every((b) => parseFloat(b.style.maxWidth) <= 560)).toBe(true);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
  });
});

/** A pane that can be told to throw, for a boundary already showing content. */
const Toggle: FC = () => {
  const [broken, setBroken] = useState(false);
  if (broken) throw new Error('later');
  return <button type="button" onClick={() => setBroken(true)}>break</button>;
};

describe('ErrorBoundary around a live pane', () => {
  it('catches an error thrown after the first render too', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Toggle /></ErrorBoundary>);
    fireEvent.click(screen.getByRole('button', { name: 'break' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Something went wrong' })).toBeTruthy();
  });
});
