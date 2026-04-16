'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    // Token is present — we'll validate it server-side on submit
    setTokenValid(true);
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter a new password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password. The link may have expired.');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setIsLoading(false);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  // No token provided
  if (tokenValid === false) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Invalid Reset Link</h2>
            <p className="text-sm text-gray-500 mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link href="/forgot-password" className="btn-primary inline-flex">
              Request New Link
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
            <p>PRISM Profit Pool Shift Model v3.1</p>
            <p className="mt-1">Strategic FMCG Analysis Platform</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Password Reset Successfully</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your password has been updated. You can now sign in with your new password.
            </p>
            <Link href="/login" className="btn-primary inline-flex">
              Sign In
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
            <p>PRISM Profit Pool Shift Model v3.1</p>
            <p className="mt-1">Strategic FMCG Analysis Platform</p>
          </div>
        </div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-black">PRISM</span>
          </h1>
          <p className="text-sm text-gray-500 mt-2">Profit Pool Shift Model</p>
          <p className="text-xs text-gray-400 mt-1">Set New Password</p>
        </div>

        <p className="text-sm text-gray-500 mb-6 text-center">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1.5">Minimum 8 characters</p>
          </div>

          {/* Confirm New Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              className="input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
              <span className="text-red-600 text-lg leading-none mt-0.5">!</span>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary w-full mt-6"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Resetting password...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        {/* Back to login */}
        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Back to Sign In
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>PRISM Profit Pool Shift Model v3.1</p>
          <p className="mt-1">Strategic FMCG Analysis Platform</p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-container">
          <div className="auth-card flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
            <p className="mt-4 text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
