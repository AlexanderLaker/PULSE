# Design

The dashboard uses one visual language on every surface: views, dialogs,
loading and error states, and the sign-in pages. It is a light editorial
look: navy ink on pale blue surfaces, Manrope headlines, Inter text, and
numbers that carry the hierarchy while the chrome stays quiet.

## Where the tokens live

| File | Holds |
|---|---|
| `lib/theme.ts` | `S`, the colour tokens of surfaces, text, borders and status; the three font stacks (`HEADLINE_FONT`, `BODY_FONT`, `MONO_FONT`) |
| `lib/format.ts` | the shift colours (`EXPANSION`, `CONTRACTION`, `NEUTRAL` and their soft tints), the matrix heat ramp, the force colours (`FORCE_COLORS`) and the category colours (`CATEGORIES`) |
| `app/globals.css` | the base layer: reset, focus ring, selection, scrollbar, input focus, Recharts grid lines, reduced motion |
| `app/layout.tsx` | the fonts (self-hosted with next/font) and Clerk's appearance, built from the same tokens |

Components style themselves inline from these tokens and use Tailwind's
default utilities for layout and spacing only. A colour that appears in a
component and in none of these files is a bug, with two deliberate
exceptions: the source-tier colours on the Drivers page and the tints of the
entry gate's four tiles.

## Colour

| Token (`S`) | Value | Use |
|---|---|---|
| `bg` | `#f8f9ff` | page background |
| `surface` | `#ffffff` | cards, navigation, dialogs |
| `surfaceLow` | `#eff4ff` | chips, secondary buttons, table headers |
| `surfaceContainer` | `#e5eeff` | nested panels |
| `surfaceHigh`, `surfaceHighest` | `#dce9ff`, `#d2e4ff` | hover and selected fills |
| `primary` | `#005db5` | the active tab, primary actions, links |
| `onSurface` | `#00345e` | headlines and body text (the deep navy of the brand) |
| `onSurfaceVariant` | `#26619d` | secondary text, inactive tabs |
| `mutedText` | `#64748b` | captions, helper text, beta labels |
| `cardBorder` | `rgba(0, 52, 94, 0.10)` | card and divider borders |
| `error` | `#9f403d` | errors |
| `amber` | `#b45309` | warnings, estimate grades |

Shadows are navy-based (`rgba(0, 52, 94, ...)`), never black; the card shadow
is `0 4px 60px -15px rgba(0, 52, 94, 0.08)`.

### Shifts

One colour pair means direction everywhere: green `#1f7a3d` for expansion,
red `#9f403d` for contraction, slate for flat. Colour is never the only
signal: a shift always carries its sign, and headline figures an arrow as
well (`components/dashboard/ShiftValue.tsx`), so the direction survives
colour-vision deficiency, a projector and greyscale print. The Shift Matrix
tints its cells in the shift's own hue, stronger with the magnitude up to the
95th percentile of the values in view; the tint stops where the cell text
would drop below 5:1 contrast, and the legend states the scale in use.

### Forces and categories

The six forces have one palette (`FORCE_COLORS`): Consumer `#005db5`,
Customer `#6b4fc4`, Technology `#0e8aa8`, Government `#b07d2b`, Environmental
`#2f8f4e`, Competitive `#b0504a`. Each category has its own colour in
`CATEGORIES`. These identify data series in charts and legends; they are not
used for interface chrome.

## Type

| Role | Font |
|---|---|
| Headlines, tab labels, large figures | Manrope, 700 to 800 |
| Body text and controls | Inter |
| Figures in tables and formulas | JetBrains Mono, or Inter with tabular numerals |

The fonts are self-hosted at build time, so the page makes no request to a
font service. Body text is 13 to 14 px, labels and table text 11 to 12 px,
and small uppercase overlines use wide letter spacing. The smallest
annotations (grade legends, counters) go down to 9 px and never carry a
value a reader needs.

## Numbers

- A percentage shows at most one decimal: a Monte Carlo median does not
  support more. `fmtShift` and `fmtPct` in `lib/format.ts` are the only
  formatters.
- A shift always shows its sign; below 0.05 percent it counts as flat and
  shows neither sign nor colour.
- A missing value shows `–`.
- A band is written P10 to P90. The matrix cells show medians only; on the
  time-path lens the band is in the cell's tooltip, and every category's band
  is in its drill-down's fan chart, so the grid stays readable.
- Dates read "26 Jun 2026" whatever the browser's locale.

## Shapes and patterns

- Cards: 16 px radius, white, the card shadow. Controls (buttons, chips, tab
  pills): fully rounded. Inputs and small nested elements: 8 to 10 px.
- Top navigation: the wordmark and the production tabs on the left; the beta
  tab, settings and the user on the right. The active tab is primary blue with
  an underline; beta tabs use the muted scale.
- Tables: a `surfaceLow` header row with small uppercase labels, sortable
  headers with a direction icon.
- Provenance and grades are chips with text (`components/dashboard/Chip.tsx`),
  never colour alone.
- Loading, empty and error states use the same palette
  (`LoadingSkeleton.tsx`, `ErrorBoundary.tsx`) and say what is missing and why.
- Overlays close on Escape, keep the page behind them from scrolling, keep
  focus inside while open and return it afterwards (`hooks/useOverlay.ts`).

## Accessibility

- Interactive elements are real buttons or links, reachable by keyboard,
  with the focus ring from `globals.css`.
- Time-path cells of the matrix carry an accessible label with the median and
  the band.
- Ratings are radio groups; the scoring mode toggle is a tab list.
- Motion respects `prefers-reduced-motion`.
