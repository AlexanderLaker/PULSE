# PRISM — UI/UX Review (Executive-Audience Pass)

**Reviewer lens:** Senior product designer, analytical tools for executive audiences
**Date:** 2026-06-09 · **Scope:** UI/UX only
**Basis:** Source-grounded walk of the live screens on branch `feature/test-ci-reconcile`, every cited behaviour verified in the current code (file + line). This is a *fresh* pass that re-checks the 2026-06-05 review against today's code — several of its top findings are now shipped (see §3).

---

## 1. The flow, as I read it

**Entry.** Any route hits the Clerk middleware first; unauthenticated users land on an editorial-styled sign-in card; `/` server-redirects to `/dashboard`. On first visit a **WelcomeModal** opens once per user (localStorage-gated): Step 1 is an "MVP (Minimum Viable Product)" disclaimer with feedback routed to *Alexander Laker* by name; Step 2 explains the three views and states "**Trends is the main input page**." The user then lands on **tab 3 — Profit Pool Shift Analysis** (not Trends).

**Top nav** (sticky, glass): `PRISM` wordmark · Trends · Consumer Journey · Profit Pool Shift Analysis, then two muted-gray **Beta** tabs (Innovation Explorer, Profit Pool Explorer) pinned right, a gear (Settings), the user's email, and Sign out.

**There is no simulation setup inside the product.** Runs are **CLI-only** (`scripts/run_50k_prod.py` → Neon Postgres); the UI renders the *latest persisted run*. So "setup," from a user's seat, means: an **admin** edits trend inputs in **Trends** (GP1 % affected, probability, diffusion curve) and the **Config sheet** in Settings (force weights, copula ρ/df, attenuation); then *someone re-runs from a terminal*. A **viewer** can change nothing that moves a number. The gear → SettingsModal is account/admin only (Profile, Password, Sessions, Config sheet, User management) — not scenario design.

**The main screen** (Profit Pool Shift Analysis):
- Editorial header: overline "PROFIT POOL ANALYSIS · SHIFT MATRIX", H1 "*The Shift Matrix, Four Lenses*", a paragraph of method context.
- **Run ribbon** (top-right): Run # · scenario tag · timestamp · "50k iterations", with an ⓘ popover for R̂ convergence, seed, engine build/git SHA.
- **Headline band**: a "Portfolio · 2035" card (median shift, 30px, green/red) with category-weighted P10–P90 beneath; a "Largest expansion" card; a "Deepest contraction" card; and a plain-language sentence ("By 2035, the weighted portfolio shift is X% (P10 …, P90 …). Expansion concentrates in … the deepest contraction is …. Cumulative vs 2025, MC median.").
- Controls: **lens** toggle (Time Path / Force / Value Chain / Region); **impact filter** (Total / Upside Share / Downside Share, Time-Path only) + a "**Show ranges**" toggle (Time-Path + Total only); **year pills** on the lens views.
- The **matrix**: 12 HCB categories × columns, each cell a signed % heat-shaded green (expansion) / red (contraction); row totals, column totals, grand total. Default landing = **Time Path** → 12 × 10 = **120 cells**, medians only.
- Row-click → **CategoryDetailPanel** (the strongest screen in the product): fan chart with P10–P90 band + median across 2026–2035, force decomposition, ranked contributing trends with attribution shares, an auto-generated "Strategic Read."
- Footer: collapsible "**About this model**" — "Bayesian Monte Carlo · 50,000 iterations · 99 trends" + a glossary (GP1, P10/P90, R̂…).

**Interpretation path:** headline band → scan matrix → hover a cell (median + P10/P90) → drill into a category (fan chart + Strategic Read) → methodology footer.

**The other tabs:** **Trends** = the input layer (99 trends across 6 forces — Consumer, Customer, Technology, Government, Environmental, Competitive — each with direction, confidence, data source; admin-editable, viewer-inert). **Consumer Journey** = a narrative, sentence-driven view with hand-authored white-space / innovation content per journey stage. **Innovation Explorer (Beta)** = synthesized concept ideas (every-visit "directional hypotheses" disclaimer). **Profit Pool Explorer (Beta)** = a visualization mock-up on unvalidated data (every-visit "mock-up" disclaimer).

---

## 2. Assessment against the four questions

**Can a CEO trust and read the output without a translator?** Closer than most internal tools — the headline band + one-sentence read + collapsible glossary mean the answer is *stated*, not just plotted. But the page still leads with the *instrument* (the 40px title "The Shift Matrix, Four Lenses" outweighs the 30px decision number), the **default landing is the densest view** (120 signed-% cells), and the genuinely legible artifacts (fan chart, Strategic Read) are one click *past* the wall of numbers. A first-time exec still meets the matrix before the message.

**Is uncertainty honest and legible?** Honest — yes; legible by default — no. The model's native output is the MC **median**, and percentile bands (P10/P25/P75/P90) exist throughout. But the matrix shows **medians only** unless you find the "Show ranges" toggle (which only works in Time-Path + Total); otherwise dispersion lives in hover tooltips and the drill-down fan chart. So point estimates *look* deterministic at a glance. One integrity nuance: the headline's P10–P90 is a **category-weighted average of per-category bands** — the code itself flags it is "not a joint portfolio percentile," i.e. it is narrower than the portfolio's true range. The number a CEO actually sees slightly understates uncertainty.

**Bain-grade or internal prototype?** The *live* surface is Bain-credible: one disciplined maritime/editorial system across tabs, real provenance in the run ribbon, row totals that reconcile across all four lenses (a genuine trust mechanism), and impact-filter captions that honestly admit their own limits. What still reads "internal": false-precision numbers (2-decimal percentages on an MC median), red/green as the sole encoding of the key signal, and the fact that the only way this reaches the boardroom is a screenshot.

**Setup friction / where users guess.** The biggest guess is structural: the product *implies* an analyst will "run" something, but nothing runnable exists in the UI — the WelcomeModal even points to Trends as "the main input page" while dropping the user on Profit Pool. Viewers can click trend dots and year pills that look editable/active but change nothing. These are honest gaps in a CLI-driven tool, but the UI doesn't yet set that expectation.

---

## 3. What's already fixed since the 2026-06-05 pass (credit, verified)

So this review doesn't re-litigate solved problems — these are confirmed resolved in the current code:
- **Scenario-pill placebo (was CRITICAL):** removed. `ScenarioSelectorPanel` is referenced in zero live files; "scenario" now appears only as a read-only run-ribbon label.
- **"The tool never states its answer":** a headline band now sits above the matrix.
- **Ops-leak empty states:** now role-gated — viewers get "No simulation run has been published yet… contact the PRISM team"; only admins see `POSTGRES_URL` / `run_50k_prod.py`.
- **Static "Connected" nav label:** gone.
- **Misleading "Switch to Time Path" tooltip:** fixed — `noBandsNote` now distinguishes lens-view from Upside/Downside filter.
- **Per-tab refetch / lost state:** `usePrism` is now a single provider with keep-alive tabs.
- **No mobile nav:** a below-`md` sheet menu now exists.
- **Quick wins shipped:** Welcome modal once-per-user; run audit detail behind an ⓘ popover; methodology now a collapsible "About this model" + glossary.

That's most of the prior list. The findings below are what remains, plus what that pass under-weighted.

---

## 4. Structural findings (ranked)

### S1 · The page leads with the instrument, not the answer — Impact: High · Effort: M
**Problem.** The largest element on the page is the editorial title "*The Shift Matrix, Four Lenses*" (40px). The decision figure — portfolio Δ to 2035 — is one of **three equal-weight 30px cards** (median / largest expansion / deepest contraction). Nothing is unmistakably "the number." The hierarchy says *here is a tool*; a CEO needs it to say *here is the answer*.
**Fix.** One hero number — **portfolio profit-pool shift to 2035, with its range** — at roughly 2× the type size of everything around it. Demote "largest expansion / deepest contraction" to supporting stats. Turn the H1 into a small overline. The matrix becomes the evidence under the answer, not the headline.

### S2 · Uncertainty is honest-on-demand, not honest-by-default — Impact: High · Effort: M (display) / L (true joint band)
**Problem.** `showRanges` defaults **false**; the matrix renders medians with no visible dispersion cue; ranges are gated to Time-Path + Total, hover tooltips, and the drill-down. And the one range on the headline is a **weighted average of bands**, not a portfolio percentile — narrower than reality, by the engine's own admission.
**Fix.** Show dispersion by **default** — band-width shading on cells, or median±range in the hero and Time-Path cells. Then either compute a real joint-distribution P10–P90 for the portfolio headline (the engine already stores percentiles) or label that figure explicitly as "indicative band, category-weighted." For this audience, a visible-but-honest range beats an invisible-but-precise median.

### S3 · The path to the boardroom strips the uncertainty the tool computes — Impact: High · Effort: M
**Problem.** There is **no export/share**. The only route from PRISM to the CEO is a screenshot — and the ranges, fan charts, and Strategic Reads all live in hover/drill interactions a screenshot can't capture. The version that reaches leadership is therefore the most deterministic-looking, least honest one.
**Fix.** "**Export 1-page brief / Copy view as image**" that bakes in the hero number + range + top movers + "as of {date}" + run #. Even a print stylesheet for the matrix and CategoryDetailPanel is a meaningful start.

### S4 · The default door is the densest room; the narrative view isn't the entrance — Impact: High · Effort: M
**Problem.** The user lands on the 120-cell heat matrix. The narrative, sentence-driven view (Consumer Journey) and the auto-generated Strategic Read are *elsewhere* / one click down. A non-technical exec meets a quant artifact first.
**Fix.** Land on a one-screen **Executive Summary** (hero number + 3 movers + a two-sentence read + freshness), or promote the per-category Strategic Read generator to the top of Profit Pool. Make the matrix the drill-down, not the landing. Reuses content that already exists.

### S5 · Two design systems still coexist in the repo (latent, not yet on-screen) — Impact: Med · Effort: M
**Problem.** The live tabs are consistently maritime/editorial — good. But `app/globals.css` base classes (`.btn-primary` = black pill, `.pill-blue` = #0071E3, the Apple-blue segmented control) and `lib/format.ts` tokens (accent #0071E3, an emoji force-icon map 👤🏪⚡🏛🌱⚔) are the *older* Apple system. `format.ts` is still imported for forces/categories, so the old palette is one careless `className` away from surfacing. (The emojis are **not** rendered on any live screen today — they're dead constants.)
**Fix.** Reconcile `format.ts` + `globals.css` to the maritime tokens, or delete the unused Apple tokens and emoji map. One system, enforced.

---

## 5. Quick visual wins (all Effort: S)

1. **Let the number win the type contest.** If S1 is too big a change, the 30-minute version: shrink the H1 "The Shift Matrix, Four Lenses" to an overline and make the portfolio figure the largest thing on the page.
2. **Kill false precision.** The screen mixes 1-decimal (cells, headline) and **2-decimal** percentages (cell/row/column/grand-total tooltips, drill-down) — e.g. a grand-total tooltip reading "+3.21%" on a Monte-Carlo median whose P10–P90 spans whole points. Round everything to one decimal; reserve 2-dp for an explicit "precision" mode.
3. **Don't encode grow-vs-shrink by hue alone.** Keep the sign on the number and add a ▲/▼ glyph so the key signal survives red-green color deficiency, projectors, and B/W print. While there: unify the three greens/reds currently in play (#30D158 / #22C55E / #10b981 and #FF453A / #EF4444 / #dc2626) into one expansion/contraction token.
4. **Turn the run ribbon from "audit" into "confidence."** It's genuinely good. Add a plain "**as of {Month YYYY}**" and a "**Converged ✓**" chip *next to the headline* so freshness and trust are legible without opening the ⓘ popover.
5. **Reconcile the Welcome modal.** Step 2 says "Trends is the main input page" but the app lands on Profit Pool — align them. And soften the permanent "MVP (Minimum Viable Product)" framing; a senior user re-reads the whole tool as provisional. (Once-per-user gating is already fixed — good.)
6. **Beta disclaimers as a banner, not a gate.** Innovation Explorer / Profit Pool Explorer fire a click-through dialog *every* time the tab opens. Convert to a persistent inline banner on the tab — same honesty, no repeated dismissal.
7. **Sell the drill-down.** Row → CategoryDetailPanel is the best screen in the product but is signalled only by a hover underline and a faint chevron. Add a visible "View details →" affordance so execs actually discover the fan chart and Strategic Read.

---

## 6. Recommended sequence

1. **Quick wins 1–4** (one focused session) — they directly move "can a CEO read this without a translator" and "is uncertainty legible," at S effort.
2. **S1 + S2** — make one number the hero and make dispersion visible by default. This is the core of the executive-trust brief.
3. **S3 (export)** — so the honest version is the one that reaches leadership.
4. **S4** — reframe the entrance around the answer.
5. **S5** — collapse to one design system during the next cleanup/handover.

**Bottom line.** The live surface is already visually credible for a Bain-style audience, and the prior pass's trust-killers (the placebo scenario switch, ops-leak errors, the "Connected" lie) are fixed. The remaining gap is one of *emphasis*, not polish: the tool computes an honest, uncertain answer but still presents it as a precise-looking matrix and lets only the median escape to the boardroom. Make one number the hero, make the range visible by default, and give it an export that carries both — then PRISM reads the way it already computes.
