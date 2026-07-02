/**
 * PRISM — Maritime Editorial theme.
 * SINGLE SOURCE OF TRUTH for colour tokens and font stacks (R-23, design
 * review 2026-07-01). The per-component `const S = {…}` copies and local
 * HEADLINE/BODY/MONO font constants were consolidated here — do not
 * re-declare tokens inside components.
 *
 * Fonts (R-17): Manrope / Inter / JetBrains Mono are self-hosted via
 * `next/font` in app/layout.tsx and exposed as CSS variables; the stacks
 * below fall back to locally-installed copies, then system fonts.
 *
 * Shift semantics (expansion / contraction / heat ramp) live in
 * lib/format.ts — this file mirrors the same pair for surface tokens.
 */

export const HEADLINE_FONT =
  "var(--font-manrope), 'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
export const BODY_FONT =
  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
export const MONO_FONT =
  "var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export const S = {
  /* ─── Surfaces ─── */
  bg:               '#f8f9ff',
  surface:          '#ffffff',
  surfaceLow:       '#eff4ff',
  surfaceContainer: '#e5eeff',
  surfaceHigh:      '#dce9ff',
  surfaceHighest:   '#d2e4ff',

  /* ─── Brand / text ─── */
  primary:            '#005db5',
  primaryDim:         '#0052a0',
  primaryContainer:   '#d6e3ff',
  onPrimaryContainer: '#00519e',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
  secondaryContainer:   '#d5e3fc',
  onSecondaryContainer: '#455367',
  tertiaryContainer:    '#dae2fd',
  onTertiaryContainer:  '#4a5167',

  /* ─── Status (R-20: one soft error container everywhere) ─── */
  error:            '#9f403d',
  errorContainer:   '#fde2e1',
  onErrorContainer: '#752121',
  success:          '#1f7a3d',
  successContainer: '#cfead8',

  /* ─── Borders / misc ─── */
  outline:          '#477dbb',
  outlineVariant:   '#81b5f6',
  cardBorder:       'rgba(0, 52, 94, 0.10)',
  cardBorderStrong: 'rgba(0, 52, 94, 0.16)',
  mutedText:        '#64748b',

  /* ─── Shift semantics (mirror of lib/format.ts) ─── */
  expansion:            '#1f7a3d',
  expansionDim:         'rgba(31, 122, 61, 0.14)',
  expansionInk:         '#0f5132',
  expansionContainer:   '#d6ecdb',
  onExpansionContainer: '#1e5f2e',
  contraction:          '#9f403d',
  contractionDim:       'rgba(159, 64, 61, 0.14)',
  contractionInk:       '#6a2a27',

  /* ─── Amber / grading accents ─── */
  amber:          '#b45309',
  amberContainer: '#fdf0d5',
  onAmberContainer: '#7a5200',
  amberSoft:      '#fef3c7',

  /* ─── Soft chip fills (source grading, tags) ─── */
  neutral:   '#94a3b8',
  greenSoft: '#d1fae5',
  blueSoft:  '#dbeafe',
} as const;

export type ThemeTokens = typeof S;
