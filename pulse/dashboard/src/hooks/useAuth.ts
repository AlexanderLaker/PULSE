/**
 * PRISM War Room — Authentication Hook
 * Manages login/register state, token persistence, and user context.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  setStoredToken,
  getStoredToken,
  clearStoredToken,
  ApiError,
} from '../api/client';
import type { AuthUser } from '../api/client';

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // On mount: check for existing token and validate it
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setState({ user: null, loading: false, error: null });
      return;
    }
    getMe()
      .then((user) => {
        setState({ user, loading: false, error: null });
      })
      .catch(() => {
        clearStoredToken();
        setState({ user: null, loading: false, error: null });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await apiLogin({ email, password });
      setStoredToken(res.token);
      setState({ user: res.user, loading: false, error: null });
      return res.user;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Login failed';
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw e;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, inviteCode: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await apiRegister({ email, password, name, invite_code: inviteCode });
      setStoredToken(res.token);
      setState({ user: res.user, loading: false, error: null });
      return res.user;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Registration failed';
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw e;
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setState({ user: null, loading: false, error: null });
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    login,
    register,
    logout,
    clearError,
  };
}
