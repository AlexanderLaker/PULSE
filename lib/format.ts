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

// Retained for back-compat; no longer rendered.
export const FORCE_ICONS: Record<ForceName, string> = Object.fromEntries(
  Object.entries(FORCES).map(([k, v]) => [k, v.emoji])
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
export function heatFill(v: number | null | undefined, scale = 0.05): string {
  if (v == null) return 'transparent';
  const intensity = Math.max(0, Math.min(Math.abs(v) / scale, 1));
  const a = (0.06 + intensity * 0.5).toFixed(3);
  return v > 0
    ? `rgba(31, 122, 61, ${a})`
    : `rgba(159, 64, 61, ${a})`;
}
