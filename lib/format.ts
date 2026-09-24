/**
 * How the dashboard shows a shift: colour, sign, arrow and rounding, the
 * force, region and category lists, a driver's directions and confidence
 * levels, the date format and a driver's one-line evidence. Every view
 * formats through here, so a shift reads the same everywhere.
 *
 *   - One colour pair: green for expansion, red for contraction. A shift also
 *     carries a sign and an arrow, so its direction never depends on colour.
 *   - A percentage shows at most one decimal: a Monte Carlo median does not
 *     support more.
 *   - Below FLAT_EPS a shift counts as flat: no sign, no arrow, no colour.
 */
import type { Confidence, Direction, ForceName } from '@/types';
import { CONTRACTION_RGB, EXPANSION_RGB, S } from '@/lib/theme';

// ── Shift colours ───────────────────────────────────────────────────────────
// The pair is the theme's (lib/theme.ts), so a surface and a number in the
// same hue never drift apart. Tints with their own alpha use the theme's
// channels: `rgba(${EXPANSION_RGB}, 0.2)`.

export const EXPANSION = S.expansion;
export const CONTRACTION = S.contraction;
const NEUTRAL = S.mutedText;

/** A light expansion tint for badges (the Rated pill). */
export const EXPANSION_SOFT = `rgba(${EXPANSION_RGB}, 0.10)`;

/** Below this absolute shift a value is flat. */
export const FLAT_EPS = 0.0005;

/** Shown where a value is missing. */
export const NO_VALUE = '–';

// ── Forces, regions and categories ──────────────────────────────────────────

/** The six forces in the engine's order (prism/config.py FORCES). */
export const FORCES: ForceName[] = ['Consumer', 'Customer', 'Technology', 'Government', 'Environmental', 'Competitive'];

/** A driver's two directions (prism/drivers.py DIRECTIONS). */
export const DIRECTIONS: Direction[] = ['Expansion', 'Contraction'];

/** How well a driver's present state is evidenced, strongest first (prism/drivers.py CONFIDENCE_LEVELS). */
export const CONFIDENCE_LEVELS: Confidence[] = ['High', 'Medium', 'Low'];

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

/** A category's group: Hair, or Laundry & Home Care. */
export type CategoryGroup = 'Hair' | 'LHC';

export interface CategoryDefinition {
  /** The key the API uses, e.g. "LHC: FCN". */
  name: string;
  /** Plain-English label, e.g. "Fabric Clean". */
  label: string;
  /** Short form for tight spaces, e.g. "FCN" or "Care". */
  short: string;
  /** Acronym chip next to a Laundry & Home Care label; Hair labels need none. */
  code?: string;
  group: CategoryGroup;
  color: string;
}

/** The 13 categories in the engine's order (prism/config.py CATEGORIES). */
export const CATEGORIES: CategoryDefinition[] = [
  { name: 'Hair: Color',   label: 'Colour',               short: 'Colour',  group: 'Hair', color: '#b0504a' },
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

/** The category keys in the engine's order: the keys of every category-keyed block in a run. */
export const CATEGORY_NAMES: string[] = CATEGORIES.map((c) => c.name);

const CATEGORY_BY_NAME = new Map(CATEGORIES.map((c) => [c.name, c]));

/** A category by its key. Every key the dashboard shows is the taxonomy's (the
 *  API serves no other), so an unknown one is an error, not a label. */
export function categoryOf(name: string): CategoryDefinition {
  const category = CATEGORY_BY_NAME.get(name);
  if (!category) throw new Error(`${name} is not a category of the taxonomy`);
  return category;
}

/** The plain-English label of a category key ("LHC: FCN" -> "Fabric Clean"). */
export function categoryDisplay(name: string): string {
  return categoryOf(name).label;
}

/** A category named in full where no group heading stands over it: a hair
 *  category carries its group ("Hair Colour", "Body Care"), a laundry and
 *  home care one its label ("Fabric Clean"). The PRISM Analysis names the
 *  categories the same way, in lower case (prism/readings.py CATEGORY_SHORT). */
export function categoryFullName(name: string): string {
  const { group, label } = categoryOf(name);
  if (group === 'LHC') return label;
  return label === 'Body' ? 'Body Care' : `Hair ${label}`;
}

/** A group's heading: "LHC" reads "Laundry & Home Care". */
export function groupDisplay(group: CategoryGroup): string {
  return group === 'LHC' ? 'Laundry & Home Care' : 'Hair';
}

/** The short label of a category key ("Hair: Color" -> "Colour", "LHC: FCN" -> "FCN"). */
export function shortCat(name: string): string {
  return categoryOf(name).short;
}

/** prism/config.py BASE_YEAR: the year every shift is measured against. */
export const BASE_YEAR = 2025;

/** The path years (prism/config.py DEFAULT_PATH_YEARS): the ten-year horizon. */
export const YEARS: number[] = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];
/** The first path year, and the last: the horizon every headline quotes. */
export const FIRST_YEAR = YEARS[0]!;
export const HORIZON = YEARS[YEARS.length - 1]!;

/** The earliest peak year a driver may take: the year after its onset (the
 *  later of the base year and its start year), as the API requires. */
export function firstPeakYear(startYear: number): number {
  return Math.max(BASE_YEAR, startYear) + 1;
}

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

/** "26 Jun 2026, 08:38" in the browser's time zone. */
export function fmtDateTime(d: string | number | Date | null | undefined): string {
  if (d == null) return NO_VALUE;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return NO_VALUE;
  return `${fmtDate(dt)}, ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

/** "13 Sep 2026" in UTC: the day of a moment everyone reads the same, as the run's date. */
export function fmtDateUtc(d: string | number | Date | null | undefined): string {
  if (d == null) return NO_VALUE;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return NO_VALUE;
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

/** "13 Sep 2026, 08:12 UTC": a moment everyone reads the same, wherever they are. */
export function fmtDateTimeUtc(d: string | number | Date | null | undefined): string {
  if (d == null) return NO_VALUE;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return NO_VALUE;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${fmtDateUtc(dt)}, ${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())} UTC`;
}

// ── Evidence ────────────────────────────────────────────────────────────────

/** The credibility tiers of a source, strongest first (prism/drivers.py
 *  SOURCE_TIERS holds the same list; docs/DRIVERS.md describes them). */
export const SOURCE_TIERS = ['S', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D', 'E'] as const;

/** A source's link, when it has one: an http(s) address without spaces
 *  (prism/drivers.py SOURCE_URL_PATTERN; the API refuses any other). */
export const SOURCE_URL = /^https?:\/\/\S+$/;

/** The most characters a source's title, link and publication note may hold
 *  (prism/drivers.py SOURCE_FIELD_LIMITS). */
export const SOURCE_FIELD_LIMITS = { title: 500, url: 2000, published: 500 } as const;

/**
 * A driver's evidence in one line: the publisher of each of its first three
 * sources with its publication date, as in "Circana (Apr 2026); YouGov
 * Germany (Jul 2026)". The publisher is the title before its first colon,
 * shortened to 48 characters; a source without a title is left out.
 */
export function evidenceLine(sources: ReadonlyArray<{ title: string; published: string }>): string {
  return sources.slice(0, 3)
    .map((s) => {
      const title = s.title.split(':')[0]!.trim();
      const publisher = title.length <= 48 ? title : `${title.slice(0, 47).trimEnd()}…`;
      return publisher && s.published.trim() ? `${publisher} (${s.published.trim()})` : publisher;
    })
    .filter(Boolean)
    .join('; ');
}

// ── Shift colour and direction ──────────────────────────────────────────────

export function shiftColor(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < FLAT_EPS) return NEUTRAL;
  return v > 0 ? EXPANSION : CONTRACTION;
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

const HEAT_SURFACE = S.surfaceLow;
const HEAT_NEUTRAL_TEXT = S.onSurfaceVariant;

export function heatFill(v: number | null | undefined, scale = 0.05): string {
  if (v == null || !isFinite(v) || Math.abs(v) < FLAT_EPS) return HEAT_SURFACE;
  const magnitude = Math.min(Math.abs(v) / Math.max(scale, 0.005), 1);
  const alpha = (0.14 + magnitude * 0.28).toFixed(2);
  return `rgba(${v > 0 ? EXPANSION_RGB : CONTRACTION_RGB}, ${alpha})`;
}

/** Text over a heatFill cell: the dark ink of the shift's hue. */
export function heatText(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || Math.abs(v) < FLAT_EPS) return HEAT_NEUTRAL_TEXT;
  return v > 0 ? S.expansionInk : S.contractionInk;
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
