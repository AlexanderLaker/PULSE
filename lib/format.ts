/**
 * PRISM — Formatting & Shift-Semantic Tokens
 * Maritime editorial system — the single source of truth for how a profit-pool
 * shift is coloured, signed, and rounded across every dashboard view.
 *
 * June 2026 reconciliation:
 *   • The legacy "Apple/Reno" token mirror (`T`) and its unused colour helpers
 *     (`shiftColorHex`, `shiftBgHex`, `heatColor`, `pill`, `tooltipStyle`) were
 *     removed — nothing imported them, and they carried the old #0071E3 palette.
 *   • Expansion / contraction now resolve to ONE pair, matched to the maritime
 *     semantic palette used by Trends, Consumer Journey, Profit Pool and the
 *     drill-down. No more #10b981 / #22c55e / #2d7d3f / #059669 drift.
 *   • Every shift value carries a directional ARROW (▲/▼) and a sign, so the
 *     grow-vs-shrink signal never depends on colour alone (red-green colour
 *     deficiency, projectors, greyscale print).
 *   • Shift percentages render to AT MOST ONE decimal, everywhere — the
 *     formatter clamps it so a stray `…, 2)` can never reintroduce false
 *     precision on a Monte-Carlo median.
 */

import type { ForceDefinition, CategoryDefinition, ForceName } from '../types';

// ─── Shift semantics — the one expansion / contraction pair ──────────
/** Profit pool expanding (positive shift) — maritime success green. */
export const EXPANSION = '#1f7a3d';
/** Profit pool contracting (negative shift) — maritime error red. */
export const CONTRACTION = '#9f403d';
/** Flat / negligible shift — muted slate. */
export const NEUTRAL = '#64748b';

/** Tinted backgrounds for chips / cells. */
export const EXPANSION_SOFT = 'rgba(31, 122, 61, 0.10)';
export const CONTRACTION_SOFT = 'rgba(159, 64, 61, 0.10)';
export const NEUTRAL_SOFT = 'rgba(100, 116, 139, 0.10)';

/** Below this absolute shift, a value is treated as flat: no sign, no arrow, no colour. */
export const FLAT_EPS = 0.0005;

// ─── Force Definitions (6 strategic forces) ─────────────────────────
// Distinct, maritime-harmonious categorical hues. The `emoji` field is part of
// the type contract and kept for back-compat, but the UI no longer renders it —
// forces are shown with a colour dot (see CategoryDetailPanel).
export const FORCES: Record<ForceName, ForceDefinition> = {
  Consumer:      { color: '#005db5', label: 'Consumer',      emoji: '' },
  Customer:      { color: '#6b4fc4', label: 'Customer',      emoji: '' },
  Technology:    { color: '#0e8aa8', label: 'Technology',    emoji: '' },
  Government:    { color: '#b07d2b', label: 'Government',     emoji: '' },
  Environmental: { color: '#2f8f4e', label: 'Environmental', emoji: '' },
  Competitive:   { color: '#b0504a', label: 'Competitive',   emoji: '' },
};

export const FORCE_COLORS: Record<ForceName, string> = Object.fromEntries(
  Object.entries(FORCES).map(([k, v]) => [k, v.color])
) as Record<ForceName, string>;

// ─── Category Definitions ───────────────────────────────────────────
export const CATEGORIES: CategoryDefinition[] = [
  { id: 'hair_color',   name: 'Hair: Color',   short: 'Color',   group: 'Hair', color: '#b0504a' },
  { id: 'hair_care',    name: 'Hair: Care',     short: 'Care',    group: 'Hair', color: '#b07d2b' },
  { id: 'hair_styling', name: 'Hair: Styling',  short: 'Styling', group: 'Hair', color: '#c79a3a' },
  { id: 'hair_body',    name: 'Hair: Body',     short: 'Body',    group: 'Hair', color: '#6f9c3a' },
  { id: 'lhc_fcn',      name: 'LHC: FCN',       short: 'FCN',     group: 'LHC',  color: '#2f8f4e' },
  { id: 'lhc_fca',      name: 'LHC: FCA',       short: 'FCA',     group: 'LHC',  color: '#0f9b8e' },
  { id: 'lhc_ffi',      name: 'LHC: FFI',       short: 'FFI',     group: 'LHC',  color: '#0e8aa8' },
  { id: 'lhc_lad',      name: 'LHC: LAD',       short: 'LAD',     group: 'LHC',  color: '#005db5' },
  { id: 'lhc_hdw',      name: 'LHC: HDW',       short: 'HDW',     group: 'LHC',  color: '#3f4fb0' },
  { id: 'lhc_adw',      name: 'LHC: ADW',       short: 'ADW',     group: 'LHC',  color: '#6b4fc4' },
  { id: 'lhc_hsc',      name: 'LHC: HSC',       short: 'HSC',     group: 'LHC',  color: '#8a4fb8' },
  { id: 'lhc_ic',       name: 'LHC: IC',        short: 'IC',      group: 'LHC',  color: '#b0479e' },
];

// ─── Category display labels (plain-English, no brand refs) ─────────
// Keyed by the canonical `name` (the backend lookup key, e.g. "LHC: FCN").
// We NEVER change `name` — only how it is shown — so shift-matrix and
// exposure lookups keyed by display name keep working. The optional `code`
// is shown as a muted chip next to LHC labels (the acronyms a CEO can't
// decode at a glance); Hair sub-categories are self-evident and carry none.
export const CATEGORY_DISPLAY: Record<string, { label: string; code?: string }> = {
  'Hair: Color':   { label: 'Colour' },
  'Hair: Care':    { label: 'Care' },
  'Hair: Styling': { label: 'Styling' },
  'Hair: Body':    { label: 'Body' },
  'LHC: FCN':      { label: 'Fabric Clean',         code: 'FCN' },
  'LHC: FCA':      { label: 'Fabric Care',          code: 'FCA' },
  'LHC: FFI':      { label: 'Fabric Finishers',     code: 'FFI' },
  'LHC: LAD':      { label: 'Laundry Additives',    code: 'LAD' },
  'LHC: HDW':      { label: 'Hand Dishwash',        code: 'HDW' },
  'LHC: ADW':      { label: 'Auto Dishwash',        code: 'ADW' },
  'LHC: HSC':      { label: 'Hard-Surface Cleaner', code: 'HSC' },
  'LHC: IC':       { label: 'Insect Control',       code: 'IC' },
};

/** Plain-English category label for display. Falls back to the raw name. */
export function categoryDisplay(name: string | null | undefined): string {
  if (!name) return '';
  return CATEGORY_DISPLAY[name]?.label ?? name;
}
/** Short code chip (LHC acronyms only); undefined for self-evident Hair rows. */
export function categoryCode(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  return CATEGORY_DISPLAY[name]?.code;
}
/** Expand a group key for headers: "LHC" → "Laundry & Home Care". */
export function groupDisplay(group: string | null | undefined): string {
  if (!group) return '';
  return group === 'LHC' ? 'Laundry & Home Care' : group;
}

// 10-year strategic horizon (2026–2035), mirroring backend
// pulse/config.py::DEFAULT_PATH_YEARS. Keep in sync — a short horizon
// here truncates the S-curve materialization (default peaks at 2030 only
// ~62% of full impact) and makes the Bayesian MC output look flat in
// the Time Path view.
export const YEARS: number[] = [
  2026, 2027, 2028, 2029, 2030,
  2031, 2032, 2033, 2034, 2035,
];

// ─── Formatting Functions ───────────────────────────────────────────

/**
 * Format a decimal as a signed percentage: 0.032 → "+3.2%".
 * Clamped to at most ONE decimal place (executive-legibility rule) — passing
 * a higher `decimals` is silently capped so no view can show false precision.
 */
export function fmtShift(v: number | null | undefined, decimals = 1): string {
  if (v == null || isNaN(v)) return '—';
  const d = Math.max(0, Math.min(decimals, 1));
  const pct = (v * 100).toFixed(d);
  return v >= FLAT_EPS ? `+${pct}%` : `${pct}%`;
}

/** Format a decimal as an absolute percentage (no sign). Clamped to ≤ 1 decimal. */
export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null || isNaN(v)) return '—';
  const d = Math.max(0, Math.min(decimals, 1));
  return `${(v * 100).toFixed(d)}%`;
}

// ─── Dates (R-12): one format everywhere — "26 Jun 2026" ────────────
// The previous bare `toLocaleDateString()` calls rendered in the BROWSER
// locale (German browser → "26.6.2026") inside an all-English UI.
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "26 Jun 2026" — UI-wide date format. Returns '—' for invalid input. */
export function fmtDate(d: string | number | Date | null | undefined): string {
  if (d == null) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${dt.getDate()} ${MONTHS_EN[dt.getMonth()]} ${dt.getFullYear()}`;
}

/** "26 Jun 2026, 08:38" — date + time for run metadata / sessions. */
export function fmtDateTime(d: string | number | Date | null | undefined): string {
  if (d == null) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${fmtDate(dt)}, ${hh}:${mm}`;
}

/** Short category name: "Hair: Color" → "Color" */
export function shortCat(cat: string | null | undefined): string {
  if (!cat) return '';
  const parts = cat.split(':');
  return parts.length > 1 ? (parts[1]?.trim() ?? cat) : cat;
}

// ─── Shift colour / direction (single source of truth) ───────────────

/** Strong text colour for a shift value. */
export function shiftColor(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < FLAT_EPS) return NEUTRAL;
  return v > 0 ? EXPANSION : CONTRACTION;
}

/** Tinted background for a shift chip / cell. */
export function shiftSoft(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < FLAT_EPS) return NEUTRAL_SOFT;
  return v > 0 ? EXPANSION_SOFT : CONTRACTION_SOFT;
}

/** Directional arrow for a shift: ▲ (up), ▼ (down), '' when flat. */
export function shiftArrow(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < FLAT_EPS) return '';
  return v > 0 ? '▲' : '▼';
}

/**
 * Diverging heat fill over a white cell — same hue family as the semantic pair,
 * intensity scaled by |v| up to `scale` (default ±5%).
 *   expansion → rgb(31,122,61) · contraction → rgb(159,64,61)
 */
// Single source of truth for the matrix heat ramp (F1/U3, June 2026): the
// Shift-Matrix grid imports these instead of re-deriving its own ramp. Tiny /
// missing values fall to surfaceLow so a near-zero cell reads as blank, not a
// faint tint. `scale` is the |value| at which the gradient saturates.
const HEAT_SURFACE_LOW = '#eff4ff';
const HEAT_ON_SURFACE_VARIANT = '#26619d';

// R-01 (design review 2026-07-01): the fill alpha is capped at 0.42 and cell
// text is ALWAYS the dark ink pair — the previous white-text branch measured
// 1.9–3.9:1 against every fill it appeared on (WCAG needs 4.5:1 at 13px).
// Dark ink stays ≥ 5:1 up to the 0.42 cap. Hue never flips: negatives are
// always red-family, positives always green-family (owner note on R-06).
export function heatFill(v: number | null | undefined, scale = 0.05): string {
  if (v == null || !isFinite(v)) return HEAT_SURFACE_LOW;
  if (Math.abs(v) < FLAT_EPS) return HEAT_SURFACE_LOW;
  const s = Math.max(scale, 0.005);
  const mag = Math.min(Math.abs(v) / s, 1);
  const a = (0.14 + mag * 0.28).toFixed(2);
  return v > 0
    ? `rgba(31, 122, 61, ${a})`
    : `rgba(159, 64, 61, ${a})`;
}

/** Legible text colour over a `heatFill` cell — always the dark ink pair (R-01). */
export function heatText(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return HEAT_ON_SURFACE_VARIANT;
  if (Math.abs(v) < FLAT_EPS) return HEAT_ON_SURFACE_VARIANT;
  return v > 0 ? '#0f5132' : '#6a2a27';
}

// R-06: per-view heat scale — shading spreads over the values actually in
// view instead of a fixed ±5%, so within-view structure stays visible.
// P95 of |values| (min 2%) keeps one outlier from washing out the rest.
// The legend MUST display the scale in use (labelled in the Matrix legend).
export function heatScaleFor(values: Array<number | null | undefined>): number {
  const mags = values
    .filter((v): v is number => v != null && isFinite(v) && Math.abs(v) >= FLAT_EPS)
    .map((v) => Math.abs(v))
    .sort((a, b) => a - b);
  if (!mags.length) return 0.05;
  const p95 = mags[Math.min(mags.length - 1, Math.floor(mags.length * 0.95))]!;
  return Math.max(p95, 0.02);
}
