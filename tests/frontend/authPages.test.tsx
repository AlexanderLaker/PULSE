// @vitest-environment jsdom
/**
 * The sign-in frame and the sign-up page: the frame's overline and the card's
 * label are 11 px (the smallest size the dashboard uses), and the sign-up
 * page says who may create an account. Clerk's forms stay out of the test.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@clerk/nextjs', () => ({
  SignIn: () => <div data-testid="clerk-sign-in" />,
  SignUp: () => <div data-testid="clerk-sign-up" />,
}));

import AuthLayout from '@/app/(auth)/layout';
import SignInPage from '@/app/(auth)/sign-in/[[...sign-in]]/page';
import SignUpPage from '@/app/(auth)/sign-up/[[...sign-up]]/page';

afterEach(() => cleanup());

describe('the sign-in frame', () => {
  it('shows the wordmark, the card and an 11 px overline', () => {
    render(<AuthLayout><SignInPage /></AuthLayout>);
    expect(screen.getByText('PRISM')).toBeTruthy();
    expect(screen.getByText('Authorised users only').className).toContain('text-[11px]');
    expect(screen.getByText('Secure access').className).toContain('text-[11px]');
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy();
    expect(screen.getByTestId('clerk-sign-in')).toBeTruthy();
  });
});

describe('the sign-up page', () => {
  it('says that invited addresses, or addresses on the allowed list, may create an account', () => {
    render(<AuthLayout><SignUpPage /></AuthLayout>);
    expect(screen.getByRole('heading', { level: 1, name: 'Create account' })).toBeTruthy();
    expect(screen.getByText(
      'Only invited addresses, or addresses on the allowed list, can create an account; an admin approves each account before the dashboard opens.',
    )).toBeTruthy();
    expect(screen.getByTestId('clerk-sign-up')).toBeTruthy();
  });
});
