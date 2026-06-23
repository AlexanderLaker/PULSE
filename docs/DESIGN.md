# PRISM Design System — "Maritime Editorial"

Single source of truth for the PRISM UI. Tokens are defined in `tailwind.config.js`
(Tailwind classes) and `app/globals.css` (CSS variables). Views may mirror these values
in a local `const S = {...}` — values must match this file exactly.

## Principles

1. **One language everywhere.** Every surface — views, modals, loading, error, auth — uses
   this palette. No second system.
2. **Editorial, not dashboard-generic.** Manrope display type, generous whitespace,
   pill-shaped controls, soft navy shadows.
3. **Answer-first.** Numbers carry the hierarchy; chrome stays quiet.

## Color Tokens

| Token | Value | Tailwind | Use |
|---|---|---|---|
| Canvas | `#f8f9ff` | `bg-canvas` | Page background |
| Surface | `#ffffff` | `bg-surface` | Cards, nav, modals |
| Surface Low | `#eff4ff` | `bg-surface-low` | Chips, secondary buttons, table headers |
| Surface Container | `#e5eeff` | `bg-surface-container` | Nested panels |
| Surface High | `#dce9ff` | `bg-surface-high` | Hover fills, scrollbar |
| Surface Highest | `#d2e4ff` | `bg-surface-highest` | Pressed/selected fills |
| Primary | `#005db5` | `text-primary` / `bg-primary` | Brand, active tab, primary actions |
| Primary Dim | `#0052a0` | `*-primary-dim` | Primary hover |
| Primary Container | `#d6e3ff` | `bg-primary-container` | Selected chips |
| On Primary Container | `#00519e` | `text-primary-oncontainer` | Text on primary container |
| Ink | `#00345e` | `text-ink` | Headlines, primary text |
| Ink Variant | `#26619d` | `text-ink-variant` | Secondary text, inactive tabs |
| Ink Muted | `#64748b` | `text-ink-muted` | Captions, helper text, beta labels |
| Outline | `#477dbb` | `border-outline` | Strong borders |
| Outline Variant | `#81b5f6` | `border-outline-variant` | Decorative borders |
| Card Border | `rgba(0,52,94,0.10)` | `border-outline-faint` | Default card/divider border |
| Danger | `#9f403d` | `text-danger` | Errors, negative values |
| Danger Container | `#fe8983` | `bg-danger-container` | Error fills |
| On Danger Container | `#752121` | `text-danger-oncontainer` | Text on error fills |

**Data palette (charts only, not UI chrome):** the six force colors and category colors
live in `lib/format.ts` (`FORCES`, `CATEGORIES`). They encode data series identity and are
allowed to differ from the UI tokens above.

## Typography

| Role | Font | Tailwind |
|---|---|---|
| Display / headlines / numbers | Manrope (800 for headlines) | `font-display` |
| Body / UI | Inter | `font-sans` |
| Code / formulas | JetBrains Mono → ui-monospace | `font-mono` |

Loaded in `app/layout.tsx` via Google Fonts (Inter 400–800, Manrope 400–800).
Minimum text size: **12px**. Uppercase micro-labels use `tracking-[0.15em]` and ≥11px
only for decorative overlines, never for data.

## Shape & Elevation

- Cards: `rounded-2xl` (16px) + `shadow-card` (`0 4px 60px -15px rgba(0,52,94,0.08)`)
- Controls (buttons, chips, tabs-pills): `rounded-full`
- Small nested elements (inputs, selects): 8–10px radius
- Nav: white at 75% opacity + `backdrop-blur-xl` + `shadow-nav`
- Modal overlay: `rgba(0,52,94,0.45)` + `shadow-overlay` on the dialog
- All shadows are **navy-based** (`rgba(0,52,94,…)`) — never pure black

## Recurring Patterns

- **Top nav:** brand wordmark + production tabs (left), beta tabs + settings + identity +
  sign-out pill (right). Active tab = `#005db5` with 2px underline; beta tabs use the
  muted ink scale.
- **Filter chips:** `rounded-full`, `bg-surface-low` inactive / `bg-primary-container` active.
- **Tables:** header row `bg-surface-low`, 12px uppercase tracked labels, sortable headers
  with direction icon; data cells ≥12px.
- **Beta disclaimers:** one modal per session (sessionStorage-keyed), or persistent inline
  banner — never repeat-on-every-open.
- **States:** loading skeletons, empty rows and error screens use this palette
  (`components/dashboard/LoadingSkeleton.tsx`, `ErrorBoundary.tsx`).

## Don'ts

- No second palette: any hex not in this file (outside the data palette) is a bug.
- No black-based shadows; no pure-black text.
- No text below 12px for data or labels users must read.
- No new fonts.
