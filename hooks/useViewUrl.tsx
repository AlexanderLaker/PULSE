'use client';

/**
 * The address bar as the dashboard's shared state (lib/viewUrl.ts describes
 * the addresses). One provider, mounted by the dashboard, holds the active
 * view and every view's last parameters; the views read their own slice and
 * write it back as the reader changes a lens, a year, a filter or opens a
 * drill-down.
 *
 * Writes go through the browser's history directly rather than the Next.js
 * router, so a lens change costs no server round trip: a change of view or an
 * opened drill-down pushes an entry (Back closes or returns), everything else
 * replaces the current one. Back and Forward arrive as popstate, which reads
 * the address again and hands every view its parameters.
 *
 * The state lives in a small store outside React (created once per provider)
 * and reaches the tree through useSyncExternalStore, so two writes in one
 * event handler build on each other and the callbacks never read a stale
 * render.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type FC, type ReactNode,
} from 'react';
import { formatViewUrl, parseViewUrl, type ViewId, type ViewParams, type ViewUrlState } from '@/lib/viewUrl';

type Patch = Record<string, string | number | null | undefined>;

export interface ViewUrlApi {
  /** The active view. */
  view: ViewId;
  /** A view's parameters as the address last carried them. */
  paramsOf: (view: ViewId) => ViewParams;
  /** Merges a patch into a view's parameters (null or '' removes a key) and
   *  writes the address when that view is active; `push` adds a history entry. */
  setParams: (view: ViewId, patch: Patch, options?: { push?: boolean }) => void;
  /** Opens a view, with its last parameters unless new ones are given. */
  openView: (view: ViewId, options?: { params?: Patch; push?: boolean }) => void;
  /** The address of the active view, for a link to copy. */
  href: () => string;
}

const ViewUrlContext = createContext<ViewUrlApi | null>(null);

const applyPatch = (params: ViewParams, patch: Patch): ViewParams => {
  const next = { ...params };
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === '') delete next[key];
    else next[key] = String(value);
  }
  return next;
};

const sameParams = (a: ViewParams, b: ViewParams): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The address for a state, on the current path; '' becomes the bare path. */
const addressOf = (state: ViewUrlState): string => {
  const path = typeof window === 'undefined' ? '/dashboard' : window.location.pathname;
  return `${path}${formatViewUrl(state)}`;
};

/** The provider's store: the view, each view's parameters, and a version that
 *  moves on every change so subscribers re-render. */
function createViewStore(initial: ViewUrlState) {
  let view: ViewId = initial.view;
  let paramsByView: Partial<Record<ViewId, ViewParams>> = { [initial.view]: initial.params };
  let version = 0;
  const listeners = new Set<() => void>();
  const emit = () => { version += 1; listeners.forEach((listener) => listener()); };
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getVersion: () => version,
    getView: () => view,
    paramsOf: (id: ViewId): ViewParams => paramsByView[id] ?? {},
    setParams: (id: ViewId, params: ViewParams) => { paramsByView = { ...paramsByView, [id]: params }; emit(); },
    setView: (id: ViewId, params?: ViewParams) => {
      view = id;
      if (params) paramsByView = { ...paramsByView, [id]: params };
      emit();
    },
  };
}
type ViewStore = ReturnType<typeof createViewStore>;

export const ViewUrlProvider: FC<{
  /** The address the page was opened with. */
  initial: ViewUrlState;
  /** Told of every change of the active view, including Back and Forward. */
  onViewChange?: (view: ViewId) => void;
  children: ReactNode;
}> = ({ initial, onViewChange, children }) => {
  const [store] = useState<ViewStore>(() => createViewStore(initial));
  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => { onViewChangeRef.current = onViewChange; }, [onViewChange]);

  const write = useCallback((state: ViewUrlState, push: boolean) => {
    if (typeof window === 'undefined') return;
    const address = addressOf(state);
    const current = `${window.location.pathname}${window.location.search}`;
    if (address === current) return;
    const entry = { prism: true };
    if (push) window.history.pushState(entry, '', address);
    else window.history.replaceState(entry, '', address);
  }, []);

  const setParams = useCallback((id: ViewId, patch: Patch, options?: { push?: boolean }) => {
    const next = applyPatch(store.paramsOf(id), patch);
    if (sameParams(next, store.paramsOf(id))) return;
    store.setParams(id, next);
    if (store.getView() === id) write({ view: id, params: next }, options?.push ?? false);
  }, [store, write]);

  const openView = useCallback((id: ViewId, options?: { params?: Patch; push?: boolean }) => {
    const params = options?.params ? applyPatch(store.paramsOf(id), options.params) : store.paramsOf(id);
    const changed = id !== store.getView();
    store.setView(id, params);
    write({ view: id, params }, options?.push ?? true);
    if (changed) onViewChangeRef.current?.(id);
  }, [store, write]);

  // Back and Forward: the address is the truth again.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPop = () => {
      const state = parseViewUrl(window.location.search);
      const changed = state.view !== store.getView();
      store.setView(state.view, state.params);
      if (changed) onViewChangeRef.current?.(state.view);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [store]);

  const href = useCallback((): string => {
    if (typeof window === 'undefined') return '';
    const id = store.getView();
    return `${window.location.origin}${addressOf({ view: id, params: store.paramsOf(id) })}`;
  }, [store]);

  // The value changes with the version, so every consumer re-renders on a write.
  const value = useMemo<ViewUrlApi>(() => ({
    view: store.getView(), paramsOf: store.paramsOf, setParams, openView, href,
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the store's change counter
  }), [store, version, setParams, openView, href]);

  return <ViewUrlContext.Provider value={value}>{children}</ViewUrlContext.Provider>;
};

const NO_PROVIDER: ViewUrlApi = {
  view: 'home',
  paramsOf: () => ({}),
  setParams: () => {},
  openView: () => {},
  href: () => '',
};

/** The address-bar state; outside a provider (a view rendered on its own, as
 *  in a test) every write is a no-op and every read is empty. */
export default function useViewUrl(): ViewUrlApi {
  return useContext(ViewUrlContext) ?? NO_PROVIDER;
}

/** One view's parameters and a setter for them: the hook a view uses. */
export function useViewParams(id: ViewId): [ViewParams, (patch: Patch, options?: { push?: boolean }) => void] {
  const api = useViewUrl();
  const params = api.paramsOf(id);
  const set = useCallback((patch: Patch, options?: { push?: boolean }) => api.setParams(id, patch, options),
    [api, id]);
  return [params, set];
}
