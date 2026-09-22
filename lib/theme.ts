/**
 * The dashboard's colour tokens and font stacks, defined once; components
 * import them instead of declaring their own.
 *
 * Manrope, Inter and JetBrains Mono are self-hosted with next/font
 * (app/layout.tsx) and exposed as CSS variables; the stacks fall back to
 * installed copies, then to system fonts. The shift colours and the heat ramp
 * live in lib/format.ts; S mirrors that pair for surfaces.
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

  /* ─── Status ─── */
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
