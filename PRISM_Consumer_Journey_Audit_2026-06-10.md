# PRISM — Consumer Journey Layer: Strategic Review & Precision Audit

**Date:** 2026-06-10 · **Scope:** Consumer Journey module (logic, trend linkage, scoring, UI/UX)
**Lens:** Strategy Partner (MECE / driver-tree / so-what) × HCB Strategist (Ehrenberg-Bass / CEP / profit-pool)
**Basis:** Source-grounded read of the live code on this branch. Every count below was computed programmatically from the files listed in §2. Evidence grades: ✅ verified in code/data · 🌐 verified via external source · ⚡ consulting estimate · ⚠️ hypothesis.

---

## 1. Executive Summary

**Verdict: the consumer-journey layer is an editorial overlay, not model logic.** It is 100% hand-authored content hard-coded inside one React component; nothing in it feeds — or is fed by — the simulation. It cannot legitimately be presented as "the demand-side logic behind the model," and in its current state it should not go in front of senior HCB stakeholders unlabelled. The three highest-leverage findings: (1) zero propagation — no journey table, no `journey_exposure`, no effect on the Shift Matrix; (2) linkage decay — only ~half the v3.3 trend base is referenced; retired and renamed trends still drive tiles, and ≥1 stakeholder-visible factual error contradicts PRISM's own trend DB; (3) the "blackbox" feeling is a provenance problem — authored prose labelled "PRISM Analysis," dead links to the evidence layer, no sources, dates, or grades. **Single most important fix:** make the layer honest about what it is (authored strategist overlay, scope-labelled), wire every tile to real trend IDs with working drill-through, and refresh against v3.3 — then decide whether to graduate it into the simulation via the already-blueprinted `journey_exposure` dimension. **Overall confidence: High conviction** (all core claims verified in code).

---

## 2. Inventory (Step 0 — what is actually there)

### 2.1 The journey models ✅

| | LHC tab | Hair tab |
|---|---|---|
| Stages | 13: Sorting → Pre-Treating → Loading → Add Products → Select Wash Settings → Washing Cycle → Unloading → Drying → Ironing → Folding & Storing → Taking Out of Closet → Wearing → Between Washes | 8: Inspire → Diagnose → Prepare → Remedy → Transform → Lock & Finish → Maintain & Optimize → Refresh / In-Between |
| Product entries | 144 (87 benefiting / 57 declining) | 110 (68 / 42) |
| Journey logic | **Usage-only** — starts post-purchase | **Hybrid** — includes pre-purchase decision stages (Inspire, Diagnose) |

254 entries total; each = `{name, type (product 165 / tech 59 / service 30), trendDrivers (free-text string), intensity 1–3 (52 / 147 / 55)}`.

### 2.2 Data structures and how they're populated ✅

Everything lives **hard-coded inside `components/dashboard/ConsumerJourney2.tsx` (2,518 lines)** — no database table, no API, no fetch:

- `LHC_JOURNEY` / `HAIR_JOURNEY` — the 254 tiles.
- `TREND_CONTEXT` — 102 display codes (C-01…C-33, T-01…T-19, G-01…G-14, K-01…K-11, E-01…E-11, X-01…X-14) with frozen copies of name/force/description.
- `PRISM_OVERRIDES` — 254 hand-written analyses (Summary + Strategic Evaluation), exactly one per tile (100% coverage).
- `LHC_CTX` / `HAIR_CTX` — 21 stage-context blocks (Henkel brands / competitors / opportunity), hard-coded market claims included.
- `generatePrismAnalysis()` — a ~300-line regex/template text generator. **Dead code path**: overrides cover all 254 tiles, so the template fires only after an (unreachable, see §2.4) admin edit.
- `getProductBrands()` + a hard-coded competitor name list — string-matching heuristics for brand routing.

### 2.3 Trend → journey mechanism ✅

A free-text string per tile (e.g. `'T-07 AI Personalization + K-04 Social Commerce'`), parsed by regex `[TCGKXE]-\d+`. The display codes exist **nowhere in the data model** — `types/trends.ts` has no code field; the only code↔ID mapping is comments in `pulse/seed_trends.py` covering 37 of 99 trends. There is no foreign key, no validation, no sync with the trend DB.

### 2.4 Feed into the simulation ✅

**None.** `pulse/` contains no `journey_exposure`, no `JOURNEY_STAGES`, no journey table; `bayesian_mc.py` computes only `category/vc/regional` decompositions. The supply-side **Value Chain** lens (8 steps, `trend_vc_exposure`) *is* implemented and propagates — it is a different module that `CLAUDE.md` v3.2 conflates with this one ("Consumer Journey (Value Chain)"). The March 2026 `CONSUMER_JOURNEY_BLUEPRINT.md` (journey_exposure dimension, White Spot Analyzer, journey-stage competitor sets) was **never implemented**.

Dead wiring on top: `app/dashboard/page.tsx` passes three navigation props the component declares but never uses, while the two props the component *does* use (`onNavigateToTrend`, `isAdmin`) are never passed — so **admin editing and "View full trend details" are unreachable in production**. Even if reached, edits are `useState`-only (lost on refresh) and the edit UI offers only the stale 102-code list.

### 2.5 Files relied on

`components/dashboard/ConsumerJourney2.tsx` · `app/dashboard/page.tsx` · `pulse/seed_trends.py` · `pulse/simulation/bayesian_mc.py` · `pulse/ingestion/models.py` · `types/trends.ts` · `lib/format.ts` · `CLAUDE.md` · `CONSUMER_JOURNEY_BLUEPRINT.md` · `PRISM_Consumer_Journey_Review.docx` (2026-04-09) · `PRISM_Consumer_Journey_Gap_Analysis.docx` (2026-04-09) · `PRISM_UX_Review_2026-06-09.md` · `PRISM_Handover_Audit_2026-06-05.md` · `deploy_consumer_journey_readout.sh` · legacy: `pulse/dashboard/src/components/ConsumerJourney.tsx`.

---

## 3. Findings by workstream

### A — Journey structure & completeness

**A1 · The two tabs follow different journey logics, and both omit the purchase moment. ✅**
Hair includes pre-purchase stages (Inspire, Diagnose); LHC starts at Sorting — *after* the product is already bought. Neither journey has a shop/buy/replenish stage (search → shelf → checkout → re-purchase). Mapped against the classic CDJ, the entire Awareness→Purchase front end is missing for LHC; mapped against a CEP/demand-moment view, the usage moments are well covered but the *category entry* and *buying* moments are not.
**So what:** the stages where the FMCG profit fight is actually being decided — retail media, agentic commerce, PL substitution at shelf, TikTok Shop, auto-replenishment — have no home in this model. That is exactly where the unmapped v3.1/v3.3 trends cluster (see B2). The taxonomy structurally cannot absorb the newest, highest-stakes trends.

**A2 · "Laundry & Home Care" is laundry-only. ✅**
8 of 12 PRISM categories are LHC, but dish (HDW/ADW), surface (HSC), WC and insect control have no journey; Pril and Somat are shoehorned into *laundry* stage contexts (Pre-Treating, Add Products). Hair is deep; everything else is absent or mislabelled.
**So what:** category heterogeneity is the point of a 12-category model; a one-size laundry journey presented under an "& Home Care" label overstates coverage to exactly the audience this needs to convince.

**A3 · Loyalty/lock-in bias (Sharp check). ✅ pattern / ⚡ magnitude**
The authored opportunities lean heavily on "brand lock-in," "Nespresso-like switching costs," "subscription moats," "ecosystem lock-in." Ehrenberg-Bass evidence says FMCG growth comes overwhelmingly from penetration and mental/physical availability, not retention mechanics; double jeopardy makes lock-in plays low-leverage for share gain. Some entries are availability plays correctly framed (e.g., being the default recommendation inside wardrobe/washer apps **is** mental/physical availability at a new entry point) — but the language and prioritisation skew loyalty-first.
**So what:** a senior reader fluent in Sharp will flag this in minutes; it reads like brand-team wishful thinking rather than evidence-based category strategy.

**A4 · The green/red framing invites misreading. ✅**
Tiles are "Benefiting/Declining" *for the product type*, not for Henkel — 61% of tiles are green (155/254) while PRISM's own trend base is deliberately bear-biased (50 Contraction / 45 Expansion) and many green tiles are *threats* (profit migrating to appliances, apps, PL). Nothing on screen says so.

### B — Trend → journey linkage

**B1 · Linkage is editorial, not data. ✅**
Free-text codes, regex-parsed, no join to the DB (§2.3). Five context entries no longer match any current DB trend name (T-04 Microbiome, K-04 Social Commerce, K-06 Subscription/Auto-Replenishment, C-12 Post-COVID, K-05 Quick Commerce); 56 match exactly, 41 partially. The descriptions shown in the side panel are frozen April copies, while the DB has since been re-scored twice.

**B2 · Coverage has decayed from 87% to ~51%. ✅**
The April 2026 gap analysis certified "48 of 55 trends (87%) referenced; no further action required." Since then the DB grew 55 → 99 trends (95 active) with **no journey refresh**: today 52 of 102 display codes are referenced; the 50 unreferenced are almost exactly the v3.1/v3.3 additions — agentic commerce (T-11/T-12/T-13), retail media & loyalty-program economics (K-08…K-11), Gen Alpha & birth-rate demographics (C-25/C-26), longevity (C-21/C-30), EU AI Act/EUDR/textile regs (G-09…G-12), retailer vertical manufacturing & Amazon PL (X-05, X-10), HDW→ADW conversion (C-27), scent boosters (C-28) etc.
**So what:** the layer silently encodes the *April* worldview. The "orphan" problem is one-directional: it's not that stages lack trend support — it's that the newest profit-pool-moving trends lack stages (cf. A1).

**B3 · Tiles still cite retired trends as live drivers. ✅**
Two "Between Washes" tiles (UV garment sanitizers, antibacterial sprays) are driven by C-12 "Post-COVID Hygiene Persistence (20–30% above pre-COVID baseline)" — a trend PRISM **retired in v3.1** as "normalized or structurally failed" — complete with launch recommendations ("Market entry: Q4 2026").
**So what:** the journey layer contradicts the model's own evidence base on the same screen-set shown to stakeholders.

**B4 · Tile count acts as an implicit weight, and it is uncalibrated. ✅ counts / ⚡ interpretation**
T-01 (47 refs), T-08 (31), T-07 (25) — three highly correlated AI trends appear on 92 of 254 tiles (36%). C-01 Private Label — among the largest single contraction forces in the DB — appears 4 times. The engine models trend correlation with a t-Copula; the journey view has no concept of correlation, so collinear AI trends visually triple-count while the biggest bear trend nearly vanishes. Salience in this view is a function of authoring enthusiasm, not modelled impact.

**B5 · Direction handling is structurally fine. ✅**
The same trend is allowed to benefit one tile and hurt another (correct, e.g. T-01 expansion for AI apps, contraction for manual aids). Spot-checks found no sign inversions. This part of the design is sound.

### C — Scoring, evidence, propagation

**C1 · Propagation: none. The layer is presentational. ✅**
Stated up front per the brief: nothing here influences force weights, trend scores, shift deltas, or any simulation output, and no simulation output flows back in. The downstream answer to "which journey weights move the profit pool" is: *none — there are no weights.*

**C2 · "Scoring" is a hand-set 1–3 intensity with no rubric. ✅**
Distribution 20%/58%/22% (centre-default pattern ⚡). No reconciliation with `probability × gp1_pct_affected`; a tile's intensity can exceed or contradict the cited trend's modelled materiality and nothing would flag it.

**C3 · Evidence is ungraded, and at least one material claim is wrong. ✅/🌐**
The 254 overrides and 21 stage contexts embed hundreds of specific figures, dates and prescriptions ("negotiate by Q3 2026," "100K Smartwash households," "expand IMEA Hair from 8% to 14% by 2029," "€8–12 annually") with no source, date, or grade — hard data, Fermi estimates and hypotheses are indistinguishable. Spot-verification:
- PL "42% EU6 value share (Circana)" — **correct** 🌐, and now understated (unit share hit a record 50% in April 2026).
- "Vanish (now Advent-owned post-Reckitt $4.8B divestiture)" + the Pre-Treating opportunity built on it — **very likely wrong** 🌐. The Essential Home perimeter sold to Advent (completed 31 Dec 2025) comprised ~80 brands incl. Air Wick, Cillit Bang, Calgon, Woolite; **Vanish is listed by Reckitt as a retained powerbrand**, and PRISM's own trend DB describes the deal correctly (Calgon vs Somat, Cillit Bang vs Bref, Woolite vs Perwoll — no Vanish). The journey layer contradicts both reality and the model it fronts.

**C4 · The "PRISM Analysis" label misattributes authorship. ✅**
Hand-written April 2026 prose is rendered under the header "PRISM Analysis" inside a model named PRISM, one tab away from genuinely computed outputs (50k-iteration MC with run ribbons, R̂, percentiles). A reader cannot tell the computed from the composed. **This is the single deepest root of the "blackbox" feedback** — the module makes confident claims whose provenance is invisible and whose generator (model? analyst? template?) is undisclosed.

**C5 · Consistency & maintainability. ✅**
`CLAUDE.md` conflates this module with the VC decomposition; the April gap-analysis docx contains internally impossible counts (claims LHC 254 + Hair 148 = 402 entries; the code has 254 total — the QA artifact itself appears partly confabulated and should not be cited); content updates require code deploys (`deploy_consumer_journey_readout.sh`); the component is a flagged god-file (handover audit M4); there is no last-reviewed metadata anywhere.

### Where the two lenses diverge (held, not averaged)

The **Strategy Partner** lens says: quantify it or cut it — an unquantified overlay in a quantified product erodes trust in everything around it. The **HCB Strategist** lens pushes back: the usage-stage map is genuinely rare and valuable — it is in effect a CEP/demand-moment inventory (the kind of thing Ehrenberg-Bass institutes get paid to build), and force-fitting 21 stages × 99 trends into pseudo-precise weights would manufacture exactly the false precision the rest of PRISM carefully avoids. **Resolution proposed:** quantify only at the level the evidence supports (stage-level shift attribution via `journey_exposure`, clearly banded), keep tile-level content qualitative but *graded and sourced*, and never let narrative count masquerade as weight. The tension is real; the answer is honest layering, not averaging.

---

## 4. Precision scorecard (1–5; no vanity)

| Dimension | Score | One-line justification |
|---|:---:|---|
| Journey completeness | **2** | Two deep, well-crafted journeys — but no purchase/replenish stage, no home care, asymmetric logic between tabs. |
| Linkage rigour | **2** | Every tile names its drivers (good discipline) — but free-text codes, no data join, retired/renamed refs, ~51% coverage. |
| Evidence quality | **2** | Rich, specific, often correct (PL 42% verified) — yet ungraded, unsourced, undated, with ≥1 material factual error. |
| Propagation / impact | **1** | Purely presentational; zero effect on the simulation it visually belongs to. |
| Internal consistency | **2** | Contradicts the trend DB (C-12, Vanish), the bear-biased direction split, and its own QA documentation. |

---

## 5. Prioritised fix list (impact × effort)

### Must fix before this is shown as "the demand-side logic" or claimed to drive anything

1. **Truth-in-labelling (S effort, highest impact).** Rename "PRISM Analysis" → "Strategist Read — authored, not simulated," add author/date/evidence-grade chips (✅/⚡/⚠️) per tile, and a one-line scope banner: *"Qualitative overlay mapping trends to consumer moments — does not feed the Shift Matrix."* Kills the misattribution instantly, costs an afternoon. The Innovation Explorer already has exactly this disclaimer pattern.
2. **Correct the factual errors (S).** Fix the Vanish/Advent claim (Pre-Treating CTX + related overrides) to the Calgon/Woolite/Cillit Bang perimeter already correctly described in the trend DB; remove or re-base the two C-12 (retired trend) tiles; re-verify the ~20 most material hard numbers in CTX/overrides.
3. **Reconnect the evidence path (S–M).** Pass `onNavigateToTrend` and `isAdmin` from `app/dashboard/page.tsx` (the props exist; they're just not wired), key every tile on real trend IDs (one canonical code↔ID map, generated from `seed_trends.py`, replacing the 37-comment partial mapping), and render code chips on tiles so force/trend is visible pre-click. The Trends tab already holds sources, confidence tiers and live descriptions — the journey just needs a working road to them.
4. **Refresh to the v3.3 base (M).** Triage all ~50 unmapped trends: map into stages, or park on an explicit, visible "macro — modelled in Shift Matrix only" list (extending April's 7-trend rationale). Fix the K-04/K-06/T-04 phantom names. Then make this a release-gated checklist item: *no trend-DB release without a journey-coverage pass.*
5. **Add the missing "Shop & Replenish" stage(s) to both journeys (M).** Mental availability → discovery/search → shelf/checkout → replenishment. This is where agentic commerce, retail media, PL substitution and social commerce live — and it rebalances the loyalty-heavy language toward penetration and availability (A3).

### Nice to have / next horizon

6. **Content out of code (M).** Move the 254 tiles + contexts + overrides into a DB table (or JSON) with admin CRUD and persistence; delete the ~500 lines of dead template generator and the duplicate legacy component. Content updates stop being deploys.
7. **Quantitative integration — the blueprint already exists (L).** Implement `journey_exposure` (trend × stage, 0–5) per `CONSUMER_JOURNEY_BLUEPRINT.md` WS1, add `journey_decomposition` to the MC output (same pattern as `vc_decomposition`), and show per-stage shift contribution bands in the UI. This — not more prose — is what makes the layer methodologically defensible as demand-side logic. Score the exposures in a structured workshop (Delphi machinery already exists in PRISM).
8. **White Spot quadrant (L).** Blueprint WS2: Henkel presence × profit migration per stage → Defend/Harvest/Watch/White-Spot. This is the "ExCo leans forward" view and the natural payoff of step 7.
9. **Home Care journey (M).** Even a 6-stage dish/surface version; until then relabel the tab "Laundry."
10. **Change journal (S).** "What changed since last review" diff per release, so the layer visibly lives with the model.

---

## 6. What I deliberately did not deep-dive

- **Tile-by-tile verification of all 254 overrides** — sampled ~15 instead; a full pass only makes sense after fix #1/#2 define grading rules (low marginal decision-relevance now).
- **The legacy Vite component and built assets** (`pulse/dashboard/...`, `api/public/assets/ConsumerJourney-*.js`) — superseded; relevant only as cleanup targets.
- **Hair journey stage semantics vs. salon-industry journey models** — needs HCB category-team input; flagged A1/A3 cover the structural risk.
- **Henkel-internal validation** of footprint/brand claims in CTX (e.g., Sil positioning, OEM partnership status, Smartwash household counts) — requires internal data; everything of this type should be treated as ⚠️ until confirmed.
- **Re-verification of every market figure** in overrides — I verified the two most decision-relevant (PL share ✅, Vanish ✗) and the pattern (ungraded, undated) is the finding; itemised fact-checking belongs to fix #2.

---

*Sources for external verifications: Circana EU6 private-label release (April 2026: 50% unit / 42% value share); Reckitt "Completes Divestment of Essential Home" (31 Dec 2025, Advent International, EV up to $4.8B, ~80 brands incl. Air Wick/Cillit Bang/Mortein); Reckitt powerbrands page listing Vanish as retained.*

---

## 7. Implementation addendum (same day, 2026-06-10)

Fixes #1–#7 and #9 from §5 were implemented directly after the audit (user-approved scope: map all unmapped trends rather than parking them; no new stages — commerce trends placed in decision-adjacent existing stages; exposure scoring AI-suggested rather than Delphi; LHC tab relabelled "Laundry"; change journal skipped).

**Shipped:** content extracted to `data/consumerJourney.ts` with per-tile provenance and 300 tiles (254 original + 46 AI-suggested covering 100% of the 99 active trends); canonical code↔ID map `data/trendCodeMap.ts`; Vanish/Advent error corrected in stage context + 9 analyses; both C-12 tiles re-based (C-30/T-18), T-09 tile re-based (T-13), G-13/X-14 miscite fixed, PFAS over-claim softened; component rebuilt (2,518 → ~1,175 lines) with scope banner, "Strategist Read" rename, provenance chips, live trend evidence cards with working Trends navigation, working admin editing persisted via new `/api/journey` route + `journey_content` table; `journey_exposure` (99 trends × 260 stage scores, AI-suggested) and `journey_decomposition` implemented end-to-end in the engine (verified: per-category stage sums reconcile exactly with terminal MC medians, 12/12) and surfaced in the UI with an honest empty-state.

**To activate the quantitative layer in production:** deploy, run `scripts/backfill_journey_exposure.py` (non-destructive), then `scripts/run_50k_prod.py`.

**Now true:** the journey layer is labelled for what it is, every claim drills through to the live trend database, and the demand-side stage attribution is computed by the simulation rather than implied by tile counts. **Still open (by choice):** #9-full Home Care journey, #10 change journal (#8 White Spot Analyzer shipped same day as an isolated beta tab); AI-suggested tiles & exposures awaiting strategist review — they are visibly flagged until then.
