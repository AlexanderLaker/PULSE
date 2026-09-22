/**
 * How the dashboard shows a shift: colour, sign, arrow and rounding, the
 * force, region and category lists, and the date format. Every view formats through
 * here, so a shift reads the same everywhere.
 *
 *   - One colour pair: green for expansion, red for contraction. A shift also
 *     carries a sign and an arrow, so its direction never depends on colour.
 *   - A percentage shows at most one decimal: a Monte Carlo median does not
 *     support more.
 *   - Below FLAT_EPS a shift counts as flat: no sign, no arrow, no colour.
 */
import type { ForceName } from '@/types';

// ── Shift colours ───────────────────────────────────────────────────────────

export const EXPANSION = '#1f7a3d';
export const CONTRACTION = '#9f403d';
export const NEUTRAL = '#64748b';

export const EXPANSION_SOFT = 'rgba(31, 122, 61, 0.10)';
export const CONTRACTION_SOFT = 'rgba(159, 64, 61, 0.10)';
export const NEUTRAL_SOFT = 'rgba(100, 116, 139, 0.10)';

/** RGB channels of the pair, for tints with their own alpha: `rgba(${EXPANSION_RGB}, 0.2)`. */
export const EXPANSION_RGB = '31, 122, 61';
export const CONTRACTION_RGB = '159, 64, 61';

/** Below this absolute shift a value is flat. */
export const FLAT_EPS = 0.0005;

/** Shown where a value is missing. */
export const NO_VALUE = '–';

// ── Forces, regions and categories ──────────────────────────────────────────

/** The six forces in the engine's order (prism/config.py FORCES). */
export const FORCES: ForceName[] = ['Consumer', 'Customer', 'Technology', 'Government', 'Environmental', 'Competitive'];

/** The four regions in the engine's order (prism/config.py REGIONS). */
export const REGIONS: string[] = ['Europe', 'North America', 'Asia', 'High Growth'];

export const FORCE_COLORS: Record<ForceName, string> = {
  Consumer: '#005db5',
  Customer: '#6b4fc4',
  Technology: '#0e8aa8',
  Government: '#b07d2b',
  Environmental: '#2f8f4e',
  Competitive: '#b0504a',
};

export interface CategoryDefinition {
  /** The key the API uses, e.g. "LHC: FCN". */
  name: string;
  /** Plain-English label, e.g. "Fabric Clean". */
  label: string;
  /** Short form for tight spaces, e.g. "FCN" or "Care". */
  short: string;
  /** Acronym chip next to a Laundry & Home Care label; Hair labels need none. */
  code?: string;
  group: 'Hair' | 'LHC';
  color: string;
}

/** The 13 categories in the engine's order (prism/config.py CATEGORIES). */
export const CATEGORIES: CategoryDefinition[] = [
  { name: 'Hair: Color',   label: 'Colour',               short: 'Color',   group: 'Hair', color: '#b0504a' },
  { name: 'Hair: Care',    label: 'Care',                 short: 'Care',    group: 'Hair', color: '#b07d2b' },
  { name: 'Hair: Styling', label: 'Styling',              short: 'Styling', group: 'Hair', color: '#c79a3a' },
  { name: 'Hair: Body',    label: 'Body',                 short: 'Body',    group: 'Hair', color: '#6f9c3a' },
  { name: 'LHC: FCN',      label: 'Fabric Clean',         short: 'FCN', code: 'FCN', group: 'LHC', color: '#2f8f4e' },
  { name: 'LHC: FCA',      label: 'Fabric Care',          short: 'FCA', code: 'FCA', group: 'LHC', color: '#0f9b8e' },
  { name: 'LHC: FFI',      label: 'Fabric Finishers',     short: 'FFI', code: 'FFI', group: 'LHC', color: '#0e8aa8' },
  { name: 'LHC: LAD',      label: 'Laundry Additives',    short: 'LAD', code: 'LAD', group: 'LHC', color: '#005db5' },
  { name: 'LHC: HDW',      label: 'Hand Dishwash',        short: 'HDW', code: 'HDW', group: 'LHC', color: '#3f4fb0' },
  { name: 'LHC: ADW',      label: 'Auto Dishwash',        short: 'ADW', code: 'ADW', group: 'LHC', color: '#6b4fc4' },
  { name: 'LHC: HSC',      label: 'Hard-Surface Cleaner', short: 'HSC', code: 'HSC', group: 'LHC', color: '#8a4fb8' },
  { name: 'LHC: TOI',      label: 'Toilet Care',          short: 'TOI', code: 'TOI', group: 'LHC', color: '#9d4bab' },
  { name: 'LHC: IC',       label: 'Insect Control',       short: 'IC',  code: 'IC',  group: 'LHC', color: '#b0479e' },
];

const CATEGORY_BY_NAME: Record<string, CategoryDefinition> = Object.fromEntries(CATEGORIES.map((c) => [c.name, c]));

/** The plain-English label of a category key; the key itself if unknown. */
export function categoryDisplay(name: string | null | undefined): string {
  if (!name) return '';
  return CATEGORY_BY_NAME[name]?.label ?? name;
}

/** The acronym chip of a Laundry & Home Care category; undefined for Hair. */
export function categoryCode(name: string | null | undefined): string | undefined {
  return name ? CATEGORY_BY_NAME[name]?.code : undefined;
}

/** A group's heading: "LHC" reads "Laundry & Home Care". */
export function groupDisplay(group: string | null | undefined): string {
  if (!group) return '';
  return group === 'LHC' ? 'Laundry & Home Care' : group;
}

/** "Hair: Color" -> "Color". */
export function shortCat(cat: string | null | undefined): string {
  if (!cat) return '';
  const parts = cat.split(':');
  return parts.length > 1 ? (parts[1]?.trim() ?? cat) : cat;
}

/** The path years (prism/config.py DEFAULT_PATH_YEARS): the ten-year horizon. */
export const YEARS: number[] = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];

// ── Numbers ─────────────────────────────────────────────────────────────────

/** Rounded to at most one decimal; a tiny negative that rounds to zero reads 0.0, not -0.0. */
function percent(v: number, decimals: number): string {
  const d = Math.max(0, Math.min(decimals, 1));
  const pct = (v * 100).toFixed(d);
  return parseFloat(pct) === 0 ? (0).toFixed(d) : pct;
}

/** A shift as a signed percentage: 0.032 -> "+3.2%", -0.0555 -> "-5.6%". */
export function fmtShift(v: number | null | undefined, decimals = 1): string {
  if (v == null || isNaN(v)) return NO_VALUE;
  const pct = percent(v, decimals);
  return v >= FLAT_EPS ? `+${pct}%` : `${pct}%`;
}

/** A share or magnitude as a percentage without sign: 0.514 -> "51.4%". */
export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null || isNaN(v)) return NO_VALUE;
  return `${percent(v, decimals)}%`;
}

// ── Dates: one format, whatever the browser's locale ───────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "26 Jun 2026". */
export function fmtDate(d: string | number | Date | null | undefined): string {
  if (d == null) return NO_VALUE;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return NO_VALUE;
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

/** "26 Jun 2026, 08:38". */
export function fmtDateTime(d: string | number | Date | null | undefined): string {
  if (d == null) return NO_VALUE;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return NO_VALUE;
  return `${fmtDate(dt)}, ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

// ── Shift colour and direction ──────────────────────────────────────────────

export function shiftColor(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < FLAT_EPS) return NEUTRAL;
  return v > 0 ? EXPANSION : CONTRACTION;
}

export function shiftSoft(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < FLAT_EPS) return NEUTRAL_SOFT;
  return v > 0 ? EXPANSION_SOFT : CONTRACTION_SOFT;
}

/** "▲" up, "▼" down, "" when flat. */
export function shiftArrow(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < FLAT_EPS) return '';
  return v > 0 ? '▲' : '▼';
}

// ── The matrix heat ramp ────────────────────────────────────────────────────
// Cells are tinted in the shift's own hue, stronger with |value| up to
// `scale`, where the tint saturates. The alpha stops at 0.42 so the dark cell
// text keeps at least 5:1 contrast; flat and missing cells take the surface
// colour, so a near-zero cell reads as blank rather than faintly tinted.

const HEAT_SURFACE = '#eff4ff';
const HEAT_NEUTRAL_TEXT = '#26619d';

export function heatFill(v: number | null | undefined, scale = 0.05): string {
  if (v == null || !isFinite(v) || Math.abs(v) < FLAT_EPS) return HEAT_SURFACE;
  const magnitude = Math.min(Math.abs(v) / Math.max(scale, 0.005), 1);
  const alpha = (0.14 + magnitude * 0.28).toFixed(2);
  return `rgba(${v > 0 ? EXPANSION_RGB : CONTRACTION_RGB}, ${alpha})`;
}

/** Text over a heatFill cell: the dark ink of the shift's hue. */
export function heatText(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || Math.abs(v) < FLAT_EPS) return HEAT_NEUTRAL_TEXT;
  return v > 0 ? '#0f5132' : '#6a2a27';
}

/**
 * The saturation point for the values in view: their 95th percentile of
 * |value|, at least 2 percent, so structure stays visible and one outlier
 * cannot wash out the rest. The legend states the scale in use.
 */
export function heatScaleFor(values: Array<number | null | undefined>): number {
  const magnitudes = values
    .filter((v): v is number => v != null && isFinite(v) && Math.abs(v) >= FLAT_EPS)
    .map((v) => Math.abs(v))
    .sort((a, b) => a - b);
  if (!magnitudes.length) return 0.05;
  return Math.max(magnitudes[Math.min(magnitudes.length - 1, Math.floor(magnitudes.length * 0.95))]!, 0.02);
}
