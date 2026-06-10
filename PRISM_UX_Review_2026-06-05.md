# PRISM — UI/UX Review (Executive-Audience Pass)

**Reviewer lens:** Senior product designer, analytical tools for executive audiences
**Date:** 2026-06-05 · **Basis:** Full walk of the live screens via source (`main`), incl. verification of every cited behavior
**Scope:** UI/UX only

---

## 1. The flow as I understand it

Sign-in (Clerk, editorial-styled) → **WelcomeModal** on every fresh login: Step 1 "Early Access / MVP" disclaimer with feedback routed to Alexander Laker by name; Step 2 explains "Three views — Trends is the main input page." The user then lands on **tab 3, Profit Pool Shift Analysis** (not Trends, despite the narrative).

Nav: Trends · Consumer Journey · Profit Pool Shift Analysis, plus two gray Beta tabs (Innovation Explorer, Profit Pool Explorer), gear → SettingsModal, email + static "Connected" label.

**There is no in-UI simulation setup.** Runs are CLI-only (`scripts/run_50k_prod.py` → Neon); the UI shows the latest persisted run, identified by the run ribbon (Run #, scenario tag, date, iterations × chains, R̂ convergence, git SHA, seed). "Setup" from a user's seat means: admins edit trend inputs in Trends (GP1 %, probability dots, diffusion curve) and the Config sheet in Settings (attenuation, copula ρ/df, force weights); someone re-runs from a terminal.

The main screen is a 12-category × 10-year heat matrix with four lenses (Time Path / Force / Value Chain / Region), a Total / Upside / Downside impact filter, year pills on lens views, hover tooltips with median + P10/P90, and a row-click drill-down (**CategoryDetailPanel**: fan chart with P10–P90 band, force decomposition, ranked contributing trends with attribution shares, auto-generated "Strategic Read"). Interpretation path: matrix → hover → drill-down → methodology footer.

**What's good, and deliberately so:** the live tabs share one disciplined maritime/editorial system; the run ribbon is real provenance; row totals reconciling across all four lenses is a genuine trust mechanism; the impact-filter descriptions honestly state "not equivalent to a positive-only re-run"; the drill-down panel is the strongest screen in the product.

---

## 2. Structural findings (ranked)

### 1. Scenario pills are a placebo — CRITICAL · Effort M (or S to remove)
**Problem:** `setActiveScenario` only flips local state; `getSimulation()` takes no scenario argument and `simulate()` is never called from the live UI. An executive clicks "Downside," the pill highlights, and every number stays Base — silently. Relic of the v1 in-app `simulate()` flow.
**Fix:** Either wire pills to fetch per-scenario persisted runs, or remove the row and let the run ribbon state the scenario.
**Impact:** Existential for trust. A control that does nothing is the fastest way to lose a leadership audience that catches it.

### 2. The tool never states its answer — HIGH · Effort M
**Problem:** The most prominent elements are the H1 and 120 monospace cells. The decision-relevant number — portfolio-weighted shift at horizon, biggest mover, downside concentration — exists (weighted column totals) but lives in the bottom row at 13 px. A CEO needs a translator to find the takeaway.
**Fix:** Headline band above the matrix — three figures (portfolio shift 2035 with P10–P90 range, largest expansion, largest contraction) + one auto-generated sentence, reusing the per-category "Strategic Read" generator. The matrix becomes evidence, not the message.

### 3. Empty/error states speak ops, not strategy — HIGH · Effort S–M
**Problem:** The diagnostics-driven empty states (good engineering, built for debugging Vercel↔Neon) print `POSTGRES_URL`, `python3 scripts/run_50k_prod.py`, `diagnose_prism.py` to every viewer. Same pattern: "Re-run the simulation on the v2.5+ engine" on the lens views.
**Fix:** Role-gate the detail — viewers get "No simulation available yet — contact the PRISM team"; admins keep the full readout.
**Impact:** An exec who ever hits this state files the tool as an engineering prototype.

### 4. Nav says "Connected" unconditionally — HIGH · Effort S
**Problem:** Static string in `app/dashboard/page.tsx`; `usePrism` tracks `connected/reconnecting/offline` but nothing surfaces it in the nav. Offline + "Connected" = the interface lying next to an error banner.
**Fix:** Wire it to `connectionState` or delete it.

### 5. Uncertainty is honest but hidden, with one misleading message — HIGH · Effort M
**Problem:** Bands exist only in hover tooltips; the matrix renders medians with no visible uncertainty cue; switching to Upside/Downside silently drops bands — and the tooltip then says "Switch to Time Path for P10 / P90 bands" *while the user is on Time Path* (the `cellDetails`-undefined branch can't distinguish lens from filter).
**Fix:** Correct the microcopy ("Bands unavailable in Upside/Downside view"); add an optional "show range" mode (median ± band in cells, or band-width shading toggle); the headline band from #2 should always carry its range.

### 6. Tab switches discard state and refetch everything — MED · Effort M
**Problem:** Each tab mounts its own `usePrism`, so switching tabs unmounts the matrix (losing lens/year/filter/drill-down), re-runs `loadAll`, and re-fires five analytics calls (`getCVaR`, `getSobol`, `getTippingPoints`, AI insights, triggers) whose results **nothing in the live UI consumes**.
**Fix:** Lift `usePrism` to a provider at dashboard level; keep tabs mounted (CSS hide) or persist per-tab state; stop fetching analytics nobody renders.

### 7. ~8k lines of orphaned UI, including the entire uncertainty/risk toolkit — MED · Effort M (delete) / L (revive)
**Problem:** HeadlineKPI, DelphiPanel, CVaR/Sobol/TippingPoints/ReverseStress panels, AIChat, AllocationChart, PathTimeline, Heatmap (v1), ScenarioSelector, OnboardingTooltips, ConnectionStatus, ConvergenceBadge are imported nowhere — most still in the old Apple-palette system (`#0071E3`, `#1D1D1F`), which makes the repo look two-toned even though the *live* app is consistent.
**Fix:** Decide deliberately: delete (handover audit concurs) or redesign the two with executive value (CVaR, tipping points) into the editorial system. Don't leave them ambient.

### 8. Beta tabs contain dead controls — MED · Effort S each
**Problem:** Profit Pool Explorer's year selector (2027/2030/2032/2035) sets state that `PoolChart` never receives — clicks change nothing visibly. InnovationDeepDive's trend/journey rows render clickable but no-op when callbacks are absent.
**Fix:** Wire the year or remove the selector; disable rows without handlers. "Beta" buys grace; visibly broken controls spend it.

### 9. No export path — MED · Effort M–L
**Problem:** Output "reaches the CEO," but the only route is screenshots of a hover-dependent UI.
**Fix:** "Copy view as image / Export PDF brief" on the matrix and drill-down panel; even a print stylesheet is a meaningful S-effort start.

### 10. Below `md` the product has no navigation — MED · Effort M
**Problem:** Main and beta tab groups are `hidden md:flex` with no fallback menu: on a phone (and split-screen iPad) users are locked to the Shift Matrix with no way to switch.
**Fix:** Overflow/sheet menu below `md`.

---

## 3. Quick visual wins (all Effort S)

1. **Methodology footer** → collapsible "About this model" with a 3-line summary; fold in a glossary for GP1, P10/P90, R̂, attenuation. The current 200-word 12 px paragraph is rigorous and unread.
2. **Run ribbon** → keep Run # · scenario · date · iterations; move git SHA, seed, R̂ detail behind an ⓘ popover. Auditability without terminal aesthetics.
3. **Drill-down affordance:** the `›` at 50 % opacity undersells the best screen in the product. Visible underline-on-hover + "View details" hint (currently only a `title` attribute).
4. **Welcome modal:** show once per user (localStorage), not every login — a permanent MVP disclaimer reads as permanent beta to a repeat exec. Reconcile "Trends is the main input page" with landing on Shift Analysis (land on Trends, or reframe step 2 as "start from the output, drill to inputs").
5. **Beta notices:** convert the every-visit dialogs to a persistent inline banner on those tabs — same honesty, no repeated click-through.
6. **Semantic color drift:** Consumer Journey green/red (#10b981/#dc2626) vs matrix green/red (#22C55E/#EF4444) — unify expansion/contraction tokens across tabs.
7. **GP1 % Affected** column in Trends needs its tooltip at the header (currently only inside expanded rows); spell out "share of category gross profit exposed."
8. **Viewer affordance** in Trends: admins get click-to-edit dots/numbers; viewers get identical-looking, silently inert ones. Add a lock glyph or read-only hint.
9. **Innovation Explorer empty state:** add "Clear filters."
10. **Tier-1 amber badge** (#fde68a) is the one accent outside the system — adopt it as a named token or restyle.

---

## 4. Verdict

The live surface is visually credible enough for a Bain-style audience, and the statistical honesty is mostly already built — but **finding #1 alone (a scenario switch that doesn't switch anything) would undo all of it in one meeting**. Fix the placebo controls and put the answer above the matrix before polishing anything else.

**Recommended sequence:** #1 + #4 (one afternoon) → #3 (role-gate error states) → #2 (headline band) → quick wins 1–5 → then decide #7 (orphan cleanup) alongside the IT handover.
