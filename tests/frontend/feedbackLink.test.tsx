// @vitest-environment jsdom
/**
 * FeedbackLink names the PRISM team: as plain words while no feedback address
 * is configured, as a link to NEXT_PUBLIC_PRISM_FEEDBACK_URL when one is. The
 * address is read when lib/feedback.ts loads, so each case loads the module
 * afresh under its own environment.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** FeedbackLink loaded with the feedback address set to `url` ('' for none). */
const loadWith = async (url: string) => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_PRISM_FEEDBACK_URL', url);
  return (await import('@/components/dashboard/FeedbackLink')).default;
};

describe('FeedbackLink', () => {
  it('is plain text without the variable', async () => {
    const FeedbackLink = await loadWith('');
    render(<p>Ask <FeedbackLink />.</p>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('the PRISM team').tagName).toBe('SPAN');
  });

  it('is plain text when the variable is not a web or mail address', async () => {
    const FeedbackLink = await loadWith('javascript:alert(1)');
    render(<FeedbackLink />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('the PRISM team')).toBeTruthy();
  });

  it('links to a web address in a new tab, and says so', async () => {
    const FeedbackLink = await loadWith('https://teams.example.com/prism-feedback');
    render(<FeedbackLink />);
    // The hidden words join the name; the name computation may drop the space between them.
    const link = screen.getByRole('link', { name: /^the PRISM team\s?\(opens in a new tab\)$/ });
    expect(link.getAttribute('href')).toBe('https://teams.example.com/prism-feedback');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('links to a mail address in the same tab, with the words it is given', async () => {
    const FeedbackLink = await loadWith('mailto:prism@example.com');
    render(<FeedbackLink>write to us</FeedbackLink>);
    const link = screen.getByRole('link', { name: 'write to us' });
    expect(link.getAttribute('href')).toBe('mailto:prism@example.com');
    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('rel')).toBeNull();
  });
});
