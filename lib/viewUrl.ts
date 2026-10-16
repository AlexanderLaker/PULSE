/**
 * The dashboard's state in the address bar, so a view can be linked, pasted
 * into a deck and reached again with the browser's Back button.
 *
 *   /dashboard                                   the entry gate
 *   /dashboard?view=shift&lens=force&year=2031   a lens and year of the matrix
 *   /dashboard?view=shift&category=LHC%3AFCN     a category's drill-down
 *   /dashboard?view=drivers&driver=<id>&mode=rating
 *   /dashboard?view=journey&journey=hair&tile=<tile id>
 *   /dashboard?view=explorer&group=Hair&kind=Categories
 *
 * Only the active view's parameters are in the address; a parameter the
 * taxonomy does not know is dropped rather than carried. The parsing and
 * formatting are pure, so they can be tested without a browser; the hook that
 * reads and writes the browser's history is hooks/useViewUrl.tsx.
 */
import { CATEGORY_NAMES, YEARS } from '@/lib/format';

/** The dashboard's panes: the entry gate and the four views. */
export type ViewId = 'home' | 'drivers' | 'consumer-journey' | 'shift-analysis' | 'profit-pool-explorer';

/** A view's parameters, as the address carries them: short names, string values. */
export type ViewParams = Record<string, string>;

export interface ViewUrlState {
  view: ViewId;
  params: ViewParams;
}

/** The short names of the views in the address. */
const VIEW_SLUGS: Record<ViewId, string> = {
  home: 'home',
  drivers: 'drivers',
  'consumer-journey': 'journey',
  'shift-analysis': 'shift',
  'profit-pool-explorer': 'explorer',
};
const VIEW_BY_SLUG = Object.fromEntries(Object.entries(VIEW_SLUGS).map(([id, slug]) => [slug, id])) as
  Record<string, ViewId>;

/** The parameters each view may carry and the values each accepts; a value
 *  outside the list is dropped. An empty list accepts any non-empty string. */
const ALLOWED: Record<ViewId, Record<string, readonly string[]>> = {
  home: {},
  'shift-analysis': {
    lens: ['time', 'force', 'vc', 'region'],
    year: YEARS.map(String),
    filter: ['total', 'expansion', 'contraction'],
    category: CATEGORY_NAMES,
  },
  drivers: {
    driver: [],
    mode: ['list', 'rating', 'review'],
    q: [],
    force: [],
    category: CATEGORY_NAMES,
  },
  'consumer-journey': {
    journey: ['lhc', 'hair'],
    tile: [],
  },
  'profit-pool-explorer': {
    group: ['LHC', 'Hair'],
    kind: ['ValueChain', 'Categories', 'CoreAdjacent'],
    pool: [],
  },
};

const MAX_VALUE_LENGTH = 200;

/** The view and parameters an address names; the gate for an address that names none. */
export function parseViewUrl(
  search: string | URLSearchParams | Record<string, string | string[] | undefined> | null | undefined,
): ViewUrlState {
  const entries = new Map<string, string>();
  if (typeof search === 'string' || search instanceof URLSearchParams) {
    const sp = typeof search === 'string' ? new URLSearchParams(search) : search;
    sp.forEach((value, key) => { if (!entries.has(key)) entries.set(key, value); });
  } else if (search) {
    for (const [key, value] of Object.entries(search)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (typeof first === 'string') entries.set(key, first);
    }
  }
  const view = VIEW_BY_SLUG[entries.get('view') ?? ''] ?? 'home';
  const allowed = ALLOWED[view];
  const params: ViewParams = {};
  for (const [key, values] of Object.entries(allowed)) {
    const value = entries.get(key);
    if (!value || value.length > MAX_VALUE_LENGTH) continue;
    if (values.length === 0 || values.includes(value)) params[key] = value;
  }
  return { view, params };
}

/** The address of a state: '' for the gate, else '?view=...' with the
 *  view's parameters in the order ALLOWED lists them. */
export function formatViewUrl(state: ViewUrlState): string {
  if (state.view === 'home') return '';
  const sp = new URLSearchParams();
  sp.set('view', VIEW_SLUGS[state.view]);
  for (const key of Object.keys(ALLOWED[state.view])) {
    const value = state.params[key];
    if (value) sp.set(key, value);
  }
  return `?${sp.toString()}`;
}

/** Whether two states name the same address. */
export function sameViewUrl(a: ViewUrlState, b: ViewUrlState): boolean {
  return formatViewUrl(a) === formatViewUrl(b);
}
