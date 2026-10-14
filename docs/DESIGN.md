# Design

The dashboard uses one visual language on every surface: views, dialogs,
loading and error states, and the sign-in and waiting pages. It is a light
editorial look: navy ink on pale blue surfaces, Manrope headlines, Inter
text, and numbers that carry the hierarchy while the chrome stays quiet.

## Where the tokens live

| File | Holds |
|---|---|
| `lib/theme.ts` | `S`, the colour tokens of surfaces, text, borders, status and overlays, and the shift pair; `SHADOW`, one shadow per kind of surface; `INK_RGB`, `PRIMARY_RGB`, `EXPANSION_RGB` and `CONTRACTION_RGB` for tints with their own alpha; the three font stacks (`HEADLINE_FONT`, `BODY_FONT`, `MONO_FONT`) |
| `lib/format.ts` | the shift colours as the views use them (`EXPANSION`, `CONTRACTION`, `EXPANSION_SOFT`, `shiftColor`, which falls back to `mutedText` for a flat shift), built on the theme's pair; the matrix heat ramp; the force colours (`FORCE_COLORS`) and the category colours (`CATEGORIES`) |
| `tailwind.config.ts` | Tailwind's colours and shadows, read from `lib/theme.ts` under kebab-case names: `bg-theme-primary`, `text-theme-on-surface-variant`, `shadow-door` |
| `app/globals.css` | the base layer: reset, focus ring, selection, scrollbar, input focus, Recharts grid lines, reduced motion and the frame of Clerk's forms; its colours come from the same tokens through Tailwind's `theme()` |
| `app/layout.tsx` | the fonts (self-hosted with next/font) and Clerk's appearance: its variables from `S`, its element classes in the theme's Tailwind names |

Components style themselves inline from these tokens and use Tailwind for
layout and spacing; where a class has to carry a colour or a shadow (Clerk's
elements take classes, and a hover state is simplest as a class), it uses the
theme's names. A literal colour (a hex or `rgb()` value) anywhere else in
the dashboard's code fails `tests/test_repository.py`, and so do `white` or
`black` as a style value and a class of Tailwind's own palette (`bg-white`,
`text-slate-500`), which bypass the tokens the same way. Three palettes
belong to a single view and live in it: the source-tier colours on the
Drivers page (`components/dashboard/drivers/cards.tsx`), the washes of the
entry gate's doors (`HomeGate.tsx`) and the Explorer's bar fills
(`components/dashboard/explorer/PoolChart.tsx`).

The pieces several views share are components of their own: `Chip.tsx` (a
label with its meaning in text) and `SectionCard.tsx` (a boxed section with
an icon, a title and optional help).

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
| `onPrimary` | `#ffffff` | text and icons on a filled primary, dark or coloured surface |
| `cardBorder` | `rgba(0, 52, 94, 0.10)` | card and divider borders |
| `scrim` | `rgba(0, 52, 94, 0.35)` | the backdrop behind a dialog or drawer |
| `error` | `#9f403d` | errors |
| `amber` | `#b45309` | warnings, estimate grades |
| `expert`, `delta` | `#6b4fc4`, `#b07d2b` | on the Drivers page, the expert aggregate and the chip with its delta to the baseline |

Shadows are tinted, never black: navy (`rgba(0, 52, 94, ...)`) under
surfaces, the primary blue under a primary button (`primaryButton`) and a card
lifting under the pointer (`lift`). There is one per kind of surface
(`SHADOW`): `card` (`0 4px 60px -15px rgba(0, 52, 94, 0.08)`), `popover` for
hover cards, chart tooltips and menus, `tip` for the dark tooltips, `dialog`,
`sheet` for the Explorer's side panel, `nav`, `raised` for the active segment
of a segmented control, `lift`, `primaryButton`, `authCard`, and `door` and
`doorHover` for the entry gate.

### Shifts

One colour pair means direction wherever a shift or a driver's direction is
shown: green `#1f7a3d` for expansion, red `#9f403d` for contraction, slate for
flat. On the Drivers page the green also marks a finished review (an edited or
endorsed value, a saved proposal) and the evidence grade Reported, each with a
text label, so none of them reads as a direction. Colour is never the only
signal: a shift always carries its sign, and headline figures an arrow as well
(`components/dashboard/shift/ShiftValue.tsx`), so the direction survives
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
| Headlines and large figures | Manrope, 700 to 800 |
| Navigation tabs | Manrope, 600 |
| Body text and controls | Inter |
| Figures in tables and formulas | JetBrains Mono, or Inter with tabular numerals |

The fonts are self-hosted at build time, so the page makes no request to a
font service. Body text is 13 to 14 px, labels and table text 11 to 12 px,
and small uppercase overlines use wide letter spacing. The smallest
annotations (grade legends, counters) go down to 9 px and never carry a
value a reader needs.

## Numbers

- A shift or a share shows at most one decimal: a Monte Carlo median does
  not support more. `fmtShift` and `fmtPct` in `lib/format.ts` format them and
  never show a second decimal. Three places state more on purpose: the PRISM
  Analysis gives contributions in points with two decimals, so that close
  drivers can be told apart (docs/DRIVER_ANALYSIS.md); the Settings sheet
  gives the cell weights with two decimals, because several cells hold less
  than 0.1 percent of the pool; and the About this model section gives the
  sampling noise (the Monte Carlo standard error and the seed stability) to
  three decimals of a point, because it is that small. The Profit Pool
  Explorer shows no model output; its derivation tooltips give their
  arithmetic at the precision of their inputs.
- A shift always shows its sign; below 0.05 percent it counts as flat and
  shows neither sign nor colour.
- A missing value shows `–`.
- A band is written P10 to P90. The matrix cells show medians only; on the
  time-path lens the band is in the cell's tooltip, and every category's band
  is in its drill-down's fan chart, so the grid stays readable.
- Dates read "26 Jun 2026" whatever the browser's locale.

## Shapes and patterns

- Cards: 12 to 16 px radius, white, with the card shadow or a hairline
  border. Buttons, chips and tab pills: fully rounded. Segmented controls (the
  lens and filter toggles of the Shift Analysis) and the year stepper: a 9 to
  10 px track with 7 px segments. Inputs and small nested elements: 8 to
  10 px.
- Top navigation: the wordmark and the production tabs on the left; the beta
  tab, settings and the user on the right. The active tab is primary blue with
  an underline; beta tabs use the muted scale.
- Tables: a `surfaceLow` header row with small uppercase labels, sortable
  headers with a direction icon.
- Provenance and grades are chips with text (`components/dashboard/Chip.tsx`),
  never colour alone.
- Loading, empty and error states use the same palette (`LoadingSkeleton.tsx`,
  `ErrorBoundary.tsx`) and say what is missing and why.
- Overlays close on Escape, keep the page behind them from scrolling, keep
  focus inside while open and return it afterwards (`hooks/useOverlay.ts`).

## Accessibility

- Interactive elements are real buttons or links, reachable by keyboard,
  with the focus ring from `globals.css`.
- Time-path cells of the matrix carry an accessible label with the median and
  the band.
- Ratings are radio groups; the scoring mode toggle is a tab list.
- Motion respects `prefers-reduced-motion`: the CSS animations and
  transitions through `globals.css`, the framer-motion animations through
  `MotionConfig` in the dashboard page.
