# PRISM — Design & UI/UX Review (Pre-CEO Deployment)

**Date:** June 10, 2026 · **Scope:** Full front-end (5 views, nav shell, modals, auth, support states) · **Method:** Static code review — no code was changed.

---

## 1. Assessment Approach

The review followed five steps:

1. **Foundation audit** — design tokens, typography, color, spacing in `tailwind.config.js`, `globals.css`, `layout.tsx`.
2. **Per-view audit** — all five tabs (Trends, Consumer Journey, Profit Pool Shift Analysis, Innovation Explorer, Profit Pool Explorer) plus SettingsModal, WelcomeModal, auth flow. Three parallel deep-dives covering ~10,000 lines of UI code.
3. **Cross-view consistency check** — verified independently by extracting every hex color, font, radius, and shadow per file and comparing.
4. **Benchmark comparison** — against proven patterns from the strongest tools in this class: Stripe Dashboard (number discipline, restraint), Linear (token rigor, consistency), Tableau/Power BI executive dashboards (answer-first hierarchy), and consulting-grade tools like McKinsey Wave (narrative framing).
5. **CEO-demo lens** — every finding ranked by "would the CEO see this in a 15-minute session?"

**Limitation:** assessed from code, not a rendered session. The code fully specifies the visuals, but live QA on the demo device is still recommended.

---

## 2. Verdict

**The five production views are genuinely strong — near benchmark. The full experience around them is not yet.**

PRISM has a distinctive, coherent "editorial maritime blue" design language (Manrope headlines, navy `#00345e`, soft `#f8f9ff` canvas, pill buttons) applied consistently across all five tabs, the nav, the welcome modal, settings, and the Clerk auth screens. That is rarer than it sounds — most internal tools never achieve one voice. It looks designed, not assembled.

What keeps it short of world-class is the **second, older design system still living in the codebase** (white/Apple-blue `#0071E3`, Inter-only) that surfaces exactly in the moments polish matters most: the loading skeleton, the error screen, onboarding tooltips, and the dormant AI components. Plus: no mobile navigation, repeated beta pop-ups, dense 11px data tables, and accessibility gaps.

**Scorecard (5 = benchmark):**

| Dimension | Score | Comment |
|---|---|---|
| Visual identity & aesthetics | 4.5 | Distinctive, executive-grade; better than generic dashboards |
| Consistency — across the 5 main tabs | 4 | Same palette/fonts everywhere; minor radius (12 vs 16px) and table-style drift |
| Consistency — full experience (loading/error/onboarding/AI) | 2.5 | Old design system shows through at the seams |
| Information hierarchy | 3.5 | Good KPI framing in Profit Pool; Trends tables too dense (11px) |
| Interaction & flow | 3.5 | Clean drill-downs; beta modals fire on *every* tab open |
| Responsiveness | 2 | Below tablet width the tab navigation disappears entirely — no fallback |
| Accessibility | 2.5 | Good focus-visible base; missing focus traps/ESC, low-contrast beta tabs, sub-12px text |
| Craft hygiene | 2.5 | 117 OneDrive-conflict duplicate files, backup component wired in, orphaned components |

**Bottom line: demo-ready on a laptop with three small fixes. Not yet ready to hand out as a link without device guidance.**

---

## 3. What Is Already Benchmark-Level (Keep)

- **One recognizable voice across all five tabs** — verified: every main view draws from the same palette (`#00345e`, `#005db5`, `#eff4ff`, `#f8f9ff`) and Manrope/Inter pairing. This is the hardest thing to get right and it's done.
- **The editorial style itself.** It reads more premium than the standard SaaS look. Closer to a published McKinsey artifact than an internal tool. Don't trade it for a generic template.
- **Thoughtful trust framing** — beta disclaimers, "directional hypotheses, not validated launches" wording. Exactly right for an executive audience; Stripe-level honesty.
- **Solid plumbing** — error boundary exists, loading skeletons exist, legacy `/login` routes cleanly redirect to Clerk, shared `lib/format.ts` for numbers, welcome modal keyed per session.

---

## 4. Gaps vs. Benchmark — and What to Change

Ordered by visibility to the CEO. Each: the issue → options → risk.

### 4.1 Beta pop-ups fire on every tab switch (highest demo friction)
Clicking Innovation Explorer or Profit Pool Explorer opens a "Got it" modal **every single time**, even when toggling back and forth in one session. In a live demo this reads as nagging.
- **Option A (recommended):** show once per session (same sessionStorage pattern already used by the welcome modal).
- **Option B:** replace the modal with a slim persistent banner inside the tab — disclaimer stays visible, zero clicks.
- **Risk:** minimal; Option B is even safer legally since the disclaimer never disappears.

### 4.2 Loading & error screens wear the wrong brand
First thing seen on login is a white/gray Apple-style skeleton, then the maritime-blue app appears — a visible "flash of the old design." Same for the error screen and onboarding tooltips (white, `#0071E3` blue).
- **Option A (minimum):** recolor skeleton + error boundary to the maritime palette (`#f8f9ff` canvas, navy text). Hours of work.
- **Option B (proper):** retire the old system entirely — see 4.7.
- **Risk:** low; these components are isolated.

### 4.3 No navigation below tablet width
Tabs are `hidden md:flex` with no mobile alternative: on a phone the CEO sees the dashboard but **cannot switch tabs**. Even on smaller laptop windows the 5 long tab labels + email + sign-out get cramped (768–1100px).
- **Option A (before demo, cheap):** demo on a full-width laptop/external screen; don't send the link without "best on desktop" guidance.
- **Option B (quick win):** a polite "PRISM is designed for desktop" interstitial below `md` — benchmark tools gate rather than break.
- **Option C (proper, later):** real responsive nav (menu/dropdown). 
- **Risk:** Option C rushed before the demo is the riskiest path — regression potential across every view. Do A/B now, C later.

### 4.4 Data density in Trends — 11px tables
The Trends table uses ~11px type and tight padding. Stripe/Tableau-grade tools never go below 12px for data, 13px preferred; executives in their 50s read at arm's length on big screens.
- **Suggestion:** 12–13px minimum, +2–4px row padding, drop one low-value column rather than shrinking type.
- **Risk:** layout shift — needs one QA pass on the tab. Worth it; this is a tab the CEO will study, not skim.

### 4.5 Hierarchy: not every view answers "so what?" first
Profit Pool Shift Analysis does this well (KPI headline up top). Trends and parts of Consumer Journey open with dense grids — the benchmark pattern (McKinsey Wave, exec Power BI) is one sentence-level takeaway per view, then the evidence.
- **Suggestion:** add a single headline insight line ("Mass hair care pool shifting −€120M to premium by 2028") atop Trends and Consumer Journey. Content exists; it's a framing change.
- **Risk:** none technically; requires someone to own the wording.

### 4.6 Small consistency drift inside the main views
- Card radii mix 12px and 16px side by side; shadows mix black-based and navy-based.
- Profit Pool Explorer (beta) hand-rolls number formatting (14 inline `toFixed`) instead of `lib/format.ts` — decimals/units can drift from the main analysis tab. Numbers that disagree in format are the kind of thing CEOs notice.
- Beta tab labels in `#94a3b8` gray on near-white — borderline contrast (fails WCAG for text).
- **Suggestion:** pick 16px cards / navy shadows as the standard; route all numbers through `format.ts`; darken beta gray one step.
- **Risk:** cosmetic only; an afternoon of work, QA per tab.

### 4.7 Two design systems in one codebase (root cause)
`globals.css` + `tailwind.config.js` still define the old Apple system; the live app uses maritime tokens defined ad-hoc inside components (`NAV = {...}` in page.tsx, repeated per view). The code even references a `DESIGN.md` that **does not exist**. This is why seams keep appearing.
- **Option A (recommended):** promote the maritime palette into `tailwind.config.js` as the single token source, write the missing `DESIGN.md`, restyle the four support components, delete the unused Apple tokens.
- **Option B:** live with it, fix only visible seams (4.2). Cheaper now, but every new feature re-rolls the dice on consistency.
- **Risk A:** token refactor touches everything — do it in one sprint with per-tab visual QA, not piecemeal. **Risk B:** drift compounds; the next hire builds on the wrong system.

### 4.8 Accessibility gaps
Modals lack focus traps and (mostly) ESC-to-close; some meaning is color-only; several labels sit at 11px; Settings uses 13px section titles.
- **Suggestion:** standard pass — focus trap + ESC on all dialogs, 12px floor, contrast check. ~1–2 days.
- **Risk:** none. Note: if this tool later rolls out org-wide at Henkel, accessibility stops being optional (EU/BFSG compliance).

### 4.9 Repo hygiene (invisible in demo, real deploy risk)
117 OneDrive sync-conflict duplicates (`…-MacBook Air von Alexander.*`) including inside `app/`, a hidden "Backup" analysis tab wired into the bundle, and four orphaned old-design components (AI bar/chat, onboarding, HeadlineKPI).
- **Suggestion:** archive duplicates outside the project, remove dead components (git history preserves them). Also: stop syncing a build repo through OneDrive — this *will* eventually break a Vercel build with a stale conflicted file.
- **Risk of not acting:** a sync-conflict file with a type error fails the next production build — potentially the morning of the demo.

---

## 5. Direct Answers

**Is it world-class / benchmark?** The visible product (five tabs, nav, auth) is close — top-decile for an internal strategy tool, with a more distinctive identity than most commercial BI dashboards. The total experience is not yet benchmark: transition states, mobile, accessibility, and hygiene trail the visuals by a clear margin. Stripe/Linear earn "benchmark" precisely because their loading screens, errors and edge cases match the happy path.

**Is it consistent across pages/tabs/views?** Across the five main tabs: **yes** — verifiably one design language, with minor radius/shadow/number-format drift. Across the full experience: **no** — loading, error, onboarding and the dormant AI layer still wear the previous design.

---

## 6. Suggested Sequence

| Priority | Action | Effort |
|---|---|---|
| **P0 — before CEO session** | Beta modals → once per session or banner (4.1); recolor skeleton + error screen (4.2); demo on laptop, don't share link unguided (4.3-A); darken beta-tab gray (4.6) | ~1 day |
| **P1 — next sprint** | Single token source + DESIGN.md (4.7-A); Trends type bump (4.4); number formatting through format.ts (4.6); headline insights per view (4.5); a11y pass on dialogs (4.8) | ~1–2 weeks |
| **P2 — structural** | Real responsive strategy or desktop gate (4.3-B/C); repo hygiene + move dev off OneDrive (4.9); design empty/error states per view | ongoing |

**Biggest overall risk** is not visual: it's attempting the P1 refactor *between now and the demo*. Freeze after P0, demo, then refactor.

---

## 7. Implementation Record — June 10, 2026

All approved items implemented (4.5 and 4.8 deliberately skipped per decision). TypeScript
compiles clean across the live codebase.

| Item | Decision | What was done |
|---|---|---|
| 4.1 | Option A | Beta modals now show once per session (sessionStorage keyed by Clerk session ID, same mechanism as the welcome modal). Tab switching consolidated into one `selectTab` handler. |
| 4.2 | Option B | LoadingSkeleton rewritten — now mirrors the live maritime shell (nav, chips, table card) instead of the retired Apple layout. ErrorBoundary restyled to maritime (same recovery logic). |
| 4.3 | Option C | Real mobile navigation added: below `lg` the tab rows collapse into a menu button with a dropdown panel (production tabs + Beta section). Desktop tab rows moved from `md` to `lg` breakpoint, which also fixes the cramped 768–1100px zone. |
| 4.4 | Font only | Trends table type raised 11/11.5px → 12px (column headers, sort headers, shift-calculation tooltip, expanded-row captions). Padding and columns untouched. |
| 4.6 | As suggested | Beta tab grays darkened one step (#64748b / #475569). Profit Pool Explorer data values now formatted via `lib/format.ts` (`fmtPct`/`fmtShift`); tooltip card radius 14→16px. Note: the static CAGR threshold legend keeps hand-built range labels ("1–3% growth") — converting would produce "1%–3%". |
| 4.7 | Substitute + delete | `tailwind.config.js` and `app/globals.css` rewritten as the maritime token source (canvas/surface/primary/ink/outline/danger, Manrope/Inter, navy shadows, 16px cards). Apple tokens, component classes, `T` design tokens + color helpers in `lib/format.ts`, and the `DesignTokens` type removed. 'SF Pro Display' dropped from font stacks. **DESIGN.md created at repo root** as single source of truth. The six FORCES colors in `lib/format.ts` were kept intentionally — they are the chart *data palette*, documented as such. |
| 4.9 | Delete/collect | Everything collected in **`archive/`** (excluded from builds via tsconfig) for you to move out: 58 OneDrive conflict duplicates (50 more deleted from `.next/` build cache), 20 dead components + analytics/, the hidden Backup tab (unwired from page.tsx), a stale 25MB git agent worktree, stray test file. `pulse/` was NOT touched — it is the live Python backend. |

### Verification
- `tsc --noEmit` clean on all live code.
- Zero occurrences of the old palette/classes/fonts outside `archive/` and the documented data palette.
- Auth, settings, welcome, skeleton, error and all five views now share one design language.

### Flags for Alex — updated after re-verification
1. **Resolved — no code change needed.** The `role/route.ts` typing error reported earlier was a stale TypeScript incremental-cache artifact; the route source already uses the correct Next.js async-params signature. A from-scratch typecheck (`tsc --noEmit --incremental false`) passes all application code. The only remaining errors are two test files that can't resolve `@testing-library/react` because the local `node_modules` is incomplete — it IS declared in package.json; a plain `npm install` fixes it locally, and Vercel installs it during deploys regardless. Bonus cleanup: `hooks/usePulse.ts` (dead predecessor of `usePrism`, zero importers) moved to `archive/dead-components/`.
2. Git worktree metadata couldn't be pruned from this environment (OneDrive locks `.git` internals). Run `git worktree prune` once on your machine. Conflict-file duplicates will keep appearing as long as the repo lives in a OneDrive-synced folder.
