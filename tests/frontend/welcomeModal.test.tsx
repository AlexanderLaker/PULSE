// @vitest-environment jsdom
/**
 * The welcome dialog: two steps, each headed by an h2 that takes focus when
 * the dialog opens and when the step changes; the step dots say the step and
 * announce a change; the early-access copy names the PRISM team through the
 * feedback link; the Close control comes last in the tab order.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

import WelcomeModal from '@/components/dashboard/WelcomeModal';

afterEach(() => cleanup());

const open = (onClose = vi.fn()) => {
  render(<WelcomeModal open onClose={onClose} />);
  return { onClose, dialog: screen.getByRole('dialog', { name: 'Welcome to PRISM' }) };
};

describe('the welcome dialog', () => {
  it('opens on step 1 with the early-access copy, its heading focused and the step said', async () => {
    const { dialog } = open();
    const heading = screen.getByRole('heading', { level: 2, name: 'Welcome to PRISM' });
    expect(heading.getAttribute('tabindex')).toBe('-1');
    await waitFor(() => expect(document.activeElement).toBe(heading));

    expect(screen.getByText(
      "You are an early-access user. We are testing whether PRISM’s logic and workflow hold up; the numbers may still change as sources are checked.",
    )).toBeTruthy();
    expect(screen.getByText(/^Tell us what works, what confuses and what is missing: /)).toBeTruthy();
    expect(screen.getByText('the PRISM team')).toBeTruthy();
    expect(within(dialog).getByRole('status').textContent).toBe('Step 1 of 2');

    // The primary button comes before Close in the tab order; Close is last.
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Next', 'Close']);
  });

  it('moves focus to the new heading and announces the step on Next and Back', async () => {
    const { dialog } = open();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Welcome to PRISM' })));

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const inside = screen.getByRole('heading', { level: 2, name: 'What’s inside' });
    expect(within(dialog).getByRole('status').textContent).toBe('Step 2 of 2');
    await waitFor(() => expect(document.activeElement).toBe(inside));

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(within(dialog).getByRole('status').textContent).toBe('Step 1 of 2');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Welcome to PRISM' })));
  });

  it('introduces the three views from the drivers and keeps the exposure note on the Shift Analysis card', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/^Three views, left to right in the header\./)).toBeTruthy();
    expect(screen.getByText(/everything the model computes comes from their scores\./)).toBeTruthy();
    expect(screen.queryByText(/gross-profit mix/)).toBeNull();
    for (const title of ['Drivers', 'Consumer Journey', 'Profit Pool Shift Analysis']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    expect(screen.getByText(/Read them as exposure, not as a forecast\.$/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Got it, let’s go' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
