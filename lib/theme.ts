/**
 * The dashboard's colour tokens, shadows and font stacks, defined once;
 * components import them instead of declaring their own, and Tailwind reads
 * the colours and shadows from here too (tailwind.config.ts), so a class and
 * an inline style name the same value. lib/format.ts builds the shift colours
 * (shiftColor, the heat ramp) on the shift pair defined here, and holds the
 * force and category palettes.
 *
 * Manrope, Inter and JetBrains Mono are self-hosted with next/font
 * (app/layout.tsx) and exposed as CSS variables; the stacks fall back to
 * installed copies, then to system fonts.
 */

export const HEADLINE_FONT =
  "var(--font-manrope), 'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
export const BODY_FONT =
  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
export const MONO_FONT =
  "var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** RGB channels of the text navy, the primary blue and the shift pair, for
 *  tints with their own alpha: `rgba(${INK_RGB}, 0.12)`. */
export const INK_RGB = '0, 52, 94';
export const PRIMARY_RGB = '0, 93, 181';
export const EXPANSION_RGB = '31, 122, 61';
export const CONTRACTION_RGB = '159, 64, 61';

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
  primarySoft:        `rgba(${PRIMARY_RGB}, 0.08)`,
  /** Text and icons on a filled primary, dark or coloured surface. */
  onPrimary:          '#ffffff',
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
  cardBorder:       `rgba(${INK_RGB}, 0.10)`,
  cardBorderStrong: `rgba(${INK_RGB}, 0.16)`,
  mutedText:        '#64748b',
  /** The backdrop behind a dialog or drawer. */
  scrim:            `rgba(${INK_RGB}, 0.35)`,
  /** The translucent top bar. */
  glass:            'rgba(255, 255, 255, 0.75)',
  /** The sticky header of a dialog, over the page background. */
  headerGlass:      'rgba(248, 249, 255, 0.92)',
  /** A veil over content that is loading. */
  veil:             'rgba(255, 255, 255, 0.6)',

  /* ─── The shift pair (lib/format.ts builds on it) ─── */
  expansion:            '#1f7a3d',
  expansionDim:         `rgba(${EXPANSION_RGB}, 0.14)`,
  expansionInk:         '#0f5132',
  expansionContainer:   '#d6ecdb',
  onExpansionContainer: '#1e5f2e',
  contraction:          '#9f403d',
  contractionDim:       `rgba(${CONTRACTION_RGB}, 0.14)`,
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

  /* ─── Drivers page: the expert aggregate and the delta chip ─── */
  expert:     '#6b4fc4',
  expertSoft: 'rgba(107, 79, 196, 0.10)',
  delta:      '#b07d2b',
  deltaSoft:  'rgba(176, 125, 43, 0.15)',
} as const;

const ink = (alpha: number) => `rgba(${INK_RGB}, ${alpha})`;
const blue = (alpha: number) => `rgba(${PRIMARY_RGB}, ${alpha})`;

/** Elevation: one shadow per kind of surface, in the navy of the text; the
 *  glow under a primary button and a card lifting under the pointer take the
 *  primary blue. */
export const SHADOW = {
  /** A card or panel on the page. */
  card:          `0 4px 60px -15px ${ink(0.08)}`,
  /** A popover, hover card, chart tooltip or menu above the page. */
  popover:       `0 16px 40px -10px ${ink(0.22)}`,
  /** A dark tooltip: the info tips and the expert tips on the Drivers page. */
  tip:           `0 10px 24px ${ink(0.28)}`,
  /** A dialog or drawer over the page. */
  dialog:        `0 32px 96px -20px ${ink(0.35)}`,
  /** A sheet that slides in from the right edge. */
  sheet:         `-32px 0 80px -32px ${ink(0.35)}`,
  /** The sticky top navigation. */
  nav:           `0 32px 64px -15px ${ink(0.06)}`,
  /** The glow under a primary button. */
  primaryButton: `0 6px 18px -6px ${blue(0.45)}`,
  /** The card of the sign-in and sign-up pages. */
  authCard:      `0 24px 80px -24px ${ink(0.18)}`,
  /** The active segment of a segmented control. */
  raised:        `0 1px 2px ${ink(0.12)}`,
  /** A card that lifts under the pointer (a contributing driver in the drill-down). */
  lift:          `0 6px 20px -8px ${blue(0.35)}`,
  /** A door of the entry view, at rest and under the pointer. */
  door:          `0 1px 2px ${ink(0.03)}, 0 24px 48px -28px ${ink(0.12)}`,
  doorHover:     `0 2px 4px ${ink(0.04)}, 0 40px 80px -32px ${ink(0.22)}`,
} as const;
