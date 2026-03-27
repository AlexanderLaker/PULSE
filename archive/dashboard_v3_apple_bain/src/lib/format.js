/**
 * PULSE War Room v3 — Formatting & Design Tokens
 * Apple × Bain × Goldman Sachs
 */

// ─── Design Tokens (JS-side mirror of CSS vars) ────────────
export const T = {
  bg:       '#06080D',
  bg1:      '#0C0F16',
  bg2:      '#12161F',
  bg3:      '#1A1F2B',
  bg4:      '#232937',
  border:   'rgba(255,255,255,0.04)',
  border1:  'rgba(255,255,255,0.07)',
  border2:  'rgba(255,255,255,0.12)',
  accent:   '#3B82F6',
  accentDim:'rgba(59,130,246,0.12)',
  gold:     '#C9A84C',
  goldDim:  'rgba(201,168,76,0.10)',
  green:    '#34D399',
  greenDim: 'rgba(52,211,153,0.10)',
  red:      '#F87171',
  redDim:   'rgba(248,113,113,0.10)',
  amber:    '#FBBF24',
  amberDim: 'rgba(251,191,36,0.10)',
  purple:   '#A78BFA',
  purpleDim:'rgba(167,139,250,0.10)',
  cyan:     '#22D3EE',
  cyanDim:  'rgba(34,211,238,0.10)',
  text:     '#F0F2F5',
  text2:    '#8B93A5',
  text3:    '#555D6E',
  text4:    '#343A47',
  mono:     "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
  sans:     "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
};

// ─── Force Definitions ──────────────────────────────────────
export const FORCES = {
  Consumer:      { color: '#3B82F6', label: 'Consumer',      emoji: '👤' },
  Customer:      { color: '#A78BFA', label: 'Customer',      emoji: '🏪' },
  Technology:    { color: '#22D3EE', label: 'Technology',     emoji: '⚡' },
  Government:    { color: '#FBBF24', label: 'Government',     emoji: '🏛' },
  Environmental: { color: '#34D399', label: 'Environmental',  emoji: '🌱' },
  Competitive:   { color: '#F87171', label: 'Competitive',    emoji: '⚔' },
};

export const FORCE_COLORS = Object.fromEntries(
  Object.entries(FORCES).map(([k, v]) => [k, v.color])
);

export const FORCE_ICONS = Object.fromEntries(
  Object.entries(FORCES).map(([k, v]) => [k, v.emoji])
);

// ─── Category Definitions ───────────────────────────────────
export const CATEGORIES = [
  { id: 'hair_color',   name: 'Hair: Color',   short: 'Color',   group: 'Hair', color: '#F87171' },
  { id: 'hair_care',    name: 'Hair: Care',     short: 'Care',    group: 'Hair', color: '#FB923C' },
  { id: 'hair_styling', name: 'Hair: Styling',  short: 'Styling', group: 'Hair', color: '#FBBF24' },
  { id: 'hair_body',    name: 'Hair: Body',     short: 'Body',    group: 'Hair', color: '#A3E635' },
  { id: 'lhc_fcn',      name: 'LHC: FCN',       short: 'FCN',     group: 'LHC',  color: '#34D399' },
  { id: 'lhc_fca',      name: 'LHC: FCA',       short: 'FCA',     group: 'LHC',  color: '#2DD4BF' },
  { id: 'lhc_ffi',      name: 'LHC: FFI',       short: 'FFI',     group: 'LHC',  color: '#22D3EE' },
  { id: 'lhc_lad',      name: 'LHC: LAD',       short: 'LAD',     group: 'LHC',  color: '#60A5FA' },
  { id: 'lhc_hdw',      name: 'LHC: HDW',       short: 'HDW',     group: 'LHC',  color: '#818CF8' },
  { id: 'lhc_adw',      name: 'LHC: ADW',       short: 'ADW',     group: 'LHC',  color: '#A78BFA' },
  { id: 'lhc_hsc',      name: 'LHC: HSC',       short: 'HSC',     group: 'LHC',  color: '#C084FC' },
  { id: 'lhc_ic',       name: 'LHC: IC',        short: 'IC',      group: 'LHC',  color: '#E879F9' },
];

export const YEARS = [2026, 2027, 2028, 2029, 2030];

// ─── Formatting Functions ───────────────────────────────────

/** Format decimal as signed percentage: 0.032 → "+3.2%" */
export function fmtShift(v, decimals = 1) {
  if (v == null || isNaN(v)) return '—';
  const pct = (v * 100).toFixed(decimals);
  return v >= 0.0005 ? `+${pct}%` : `${pct}%`;
}

/** Format decimal as absolute percentage (no sign) */
export function fmtPct(v, decimals = 1) {
  if (v == null || isNaN(v)) return '—';
  return `${(v * 100).toFixed(decimals)}%`;
}

/** Short category name: "Hair: Color" → "Color" */
export function shortCat(cat) {
  if (!cat) return '';
  const parts = cat.split(':');
  return parts.length > 1 ? parts[1].trim() : cat;
}

// ─── Color Utilities ────────────────────────────────────────

/** Hex color for positive/negative/neutral shift */
export function shiftColorHex(v) {
  if (v == null || Math.abs(v) < 0.001) return T.text3;
  return v > 0 ? T.green : T.red;
}

/** Background color for shift badges */
export function shiftBgHex(v) {
  if (v == null || Math.abs(v) < 0.001) return 'transparent';
  return v > 0 ? T.greenDim : T.redDim;
}

/** Diverging heatmap color: green for positive, red for negative, intensity by magnitude */
export function heatColor(v) {
  if (v == null) return T.bg3;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const intensity = clamp(Math.abs(v) / 0.05, 0, 1);
  if (v > 0) {
    const r = Math.round(18 + (52 - 18) * intensity);
    const g = Math.round(31 + (211 - 31) * intensity);
    const b = Math.round(43 + (153 - 43) * intensity);
    return `rgba(${r},${g},${b},${(0.15 + intensity * 0.55).toFixed(2)})`;
  } else {
    const r = Math.round(31 + (248 - 31) * intensity);
    const g = Math.round(18 + (113 - 18) * intensity);
    const b = Math.round(43 + (113 - 43) * intensity);
    return `rgba(${r},${g},${b},${(0.15 + intensity * 0.55).toFixed(2)})`;
  }
}

// ─── Inline Style Helpers ───────────────────────────────────

export const pill = (color, bg) => ({
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

export const tooltipStyle = {
  background: T.bg1,
  border: `1px solid ${T.border2}`,
  borderRadius: 12,
  padding: '10px 14px',
  fontFamily: T.sans,
  fontSize: 11,
};
