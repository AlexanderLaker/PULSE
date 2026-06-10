/**
 * PRISM Profit Pool Shift Model v3 — Formatting & Design Tokens
 * Apple × Bain × Goldman Sachs
 */

import type { DesignTokens, ForceDefinition, CategoryDefinition, ForceName } from '../types';

// ─── Design Tokens (JS-side mirror of CSS vars) ────────────
export const T: DesignTokens = {
  bg:       '#FFFFFF',
  bg1:      '#F5F5F7',
  bg2:      '#FBFBFD',
  bg3:      '#F9F9FB',
  bg4:      '#EFEFEF',
  border:   'rgba(0,0,0,0.06)',
  border1:  'rgba(0,0,0,0.08)',
  border2:  'rgba(0,0,0,0.12)',
  accent:   '#0071E3',
  accentDim:'rgba(0,113,227,0.08)',
  gold:     '#D4A847',
  goldDim:  'rgba(212,168,71,0.08)',
  green:    '#30D158',
  greenDim: 'rgba(48,209,88,0.08)',
  red:      '#FF453A',
  redDim:   'rgba(255,69,58,0.08)',
  amber:    '#FF9F0A',
  amberDim: 'rgba(255,159,10,0.08)',
  purple:   '#7B61FF',
  purpleDim:'rgba(123,97,255,0.08)',
  cyan:     '#00B4D8',
  cyanDim:  'rgba(0,180,216,0.08)',
  text:     '#1D1D1F',
  text2:    '#6E6E73',
  text3:    '#999999',
  text4:    '#ADADAD',
  mono:     "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  sans:     "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
};

// ─── Force Definitions ──────────────────────────────────────
export const FORCES: Record<ForceName, ForceDefinition> = {
  Consumer:      { color: '#0071E3', label: 'Consumer',      emoji: '👤' },
  Customer:      { color: '#7B61FF', label: 'Customer',      emoji: '🏪' },
  Technology:    { color: '#00B4D8', label: 'Technology',     emoji: '⚡' },
  Government:    { color: '#FF9F0A', label: 'Government',     emoji: '🏛' },
  Environmental: { color: '#30D158', label: 'Environmental',  emoji: '🌱' },
  Competitive:   { color: '#FF453A', label: 'Competitive',    emoji: '⚔' },
};

export const FORCE_COLORS: Record<ForceName, string> = Object.fromEntries(
  Object.entries(FORCES).map(([k, v]) => [k, v.color])
) as Record<ForceName, string>;

export const FORCE_ICONS: Record<ForceName, string> = Object.fromEntries(
  Object.entries(FORCES).map(([k, v]) => [k, v.emoji])
) as Record<ForceName, string>;

// ─── Category Definitions ───────────────────────────────────
export const CATEGORIES: CategoryDefinition[] = [
  { id: 'hair_color',   name: 'Hair: Color',   short: 'Color',   group: 'Hair', color: '#FF453A' },
  { id: 'hair_care',    name: 'Hair: Care',     short: 'Care',    group: 'Hair', color: '#FF9F0A' },
  { id: 'hair_styling', name: 'Hair: Styling',  short: 'Styling', group: 'Hair', color: '#FFB81D' },
  { id: 'hair_body',    name: 'Hair: Body',     short: 'Body',    group: 'Hair', color: '#85C715' },
  { id: 'lhc_fcn',      name: 'LHC: FCN',       short: 'FCN',     group: 'LHC',  color: '#30D158' },
  { id: 'lhc_fca',      name: 'LHC: FCA',       short: 'FCA',     group: 'LHC',  color: '#00BFA5' },
  { id: 'lhc_ffi',      name: 'LHC: FFI',       short: 'FFI',     group: 'LHC',  color: '#00B4D8' },
  { id: 'lhc_lad',      name: 'LHC: LAD',       short: 'LAD',     group: 'LHC',  color: '#0071E3' },
  { id: 'lhc_hdw',      name: 'LHC: HDW',       short: 'HDW',     group: 'LHC',  color: '#5856D6' },
  { id: 'lhc_adw',      name: 'LHC: ADW',       short: 'ADW',     group: 'LHC',  color: '#7B61FF' },
  { id: 'lhc_hsc',      name: 'LHC: HSC',       short: 'HSC',     group: 'LHC',  color: '#AF52DE' },
  { id: 'lhc_ic',       name: 'LHC: IC',        short: 'IC',      group: 'LHC',  color: '#FF00FF' },
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

// ─── Formatting Functions ───────────────────────────────────

/** Format decimal as signed percentage: 0.032 → "+3.2%" */
export function fmtShift(v: number | null | undefined, decimals = 1): string {
  if (v == null || isNaN(v)) return '—';
  const pct = (v * 100).toFixed(decimals);
  return v >= 0.0005 ? `+${pct}%` : `${pct}%`;
}

/** Format decimal as absolute percentage (no sign) */
export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null || isNaN(v)) return '—';
  return `${(v * 100).toFixed(decimals)}%`;
}

/** Short category name: "Hair: Color" → "Color" */
export function shortCat(cat: string | null | undefined): string {
  if (!cat) return '';
  const parts = cat.split(':');
  return parts.length > 1 ? (parts[1]?.trim() ?? cat) : cat;
}

// ─── Color Utilities ────────────────────────────────────────

/** Hex color for positive/negative/neutral shift */
export function shiftColorHex(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < 0.001) return T.text3;
  return v > 0 ? T.green : T.red;
}

/** Background color for shift badges */
export function shiftBgHex(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < 0.001) return 'transparent';
  return v > 0 ? T.greenDim : T.redDim;
}

/** Diverging heatmap color: green for positive, red for negative, intensity by magnitude */
export function heatColor(v: number | null | undefined): string {
  if (v == null) return T.bg3;
  const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
  const intensity = clamp(Math.abs(v) / 0.05, 0, 1);
  if (v > 0) {
    const r = Math.round(255 - (255 - 48) * intensity);
    const g = Math.round(255 - (255 - 209) * intensity);
    const b = Math.round(255 - (255 - 88) * intensity);
    return `rgba(${r},${g},${b},${(0.2 + intensity * 0.5).toFixed(2)})`;
  } else {
    const r = Math.round(255 - (255 - 255) * intensity);
    const g = Math.round(255 - (255 - 69) * intensity);
    const b = Math.round(255 - (255 - 58) * intensity);
    return `rgba(${r},${g},${b},${(0.2 + intensity * 0.5).toFixed(2)})`;
  }
}

// ─── Inline Style Helpers ───────────────────────────────────

export const pill = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 600,
  fontFamily: T.mono,
  color,
  background: bg,
  lineHeight: 1,
  whiteSpace: 'nowrap',
});

export const tooltipStyle: React.CSSProperties = {
  background: T.bg1,
  border: `1px solid ${T.border2}`,
  borderRadius: 12,
  padding: '10px 14px',
  fontFamily: T.sans,
  fontSize: 11,
};
