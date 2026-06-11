# PRISM — AI-Suggested Journey Content: Review Record

**Date:** 2026-06-11 · **Scope:** the 46 ✨ AI-suggested tiles (2026-06-10) + the 260 seeded journey-exposure scores
**Reviewer:** AI review pass (two independent Opus reviewers + mechanical re-derivation), commissioned by the owner. Provenance consequence: tiles **remain ✍️/✨-labelled as before** — this review changes evidence *grades*, never authorship. The in-app "AI-suggested" chips stay visible.
**Method:** per-tile cross-check against the live trend DB (name/force/direction/probability/confidence/description/gp1), retired-code screen (C-12/K-05/T-09), side-placement logic (audit B5 rule), stage fit, Ehrenberg-Bass bias screen (audit A3), intensity sanity, plus 13 external web verifications on the most decision-relevant claims. Grading rule: ⚠️ hypothesis for speculative/unverifiable, ⚡ estimate for internally-consistent-with-DB and error-free, ✅ verified only for fully externally verified content (none awarded — strategy prose never fully verifies).

---

## 1. Results

| Slice | Tiles | Keep | Fix | Flag | → ⚡ estimate | stays ⚠️ |
|---|---:|---:|---:|---:|---:|---:|
| Hair journey | 23 | 23 | 0 | 0 | 21 | 2 |
| Laundry journey | 23 | 21 | 0 | 2 | 23 | 0 |
| **Total** | **46** | **44** | **0** | **2** | **44** | **2** |

*(Updated same day after the owner delegated the ruling on the two flags — see §2.)*

**Zero factual errors. Zero invalid or retired code citations. Zero text fixes required.** All 13 external checks confirmed tile claims, including the M&A class that produced the original Vanish/Advent error: Rhode→e.l.f., Dr Squatch→Unilever, Color Wow→L'Oréal, Reckitt *retaining* Finish, EU AI Act application dates, Morgan Stanley agentic-commerce sizing, US retail-media concentration ("incremental" correctly qualified), PVA reclassification framed conditionally (correct — the 2023 EPA petition was denied; the matter is unresolved).

**gp1 figures verified mechanically:** 8 tiles cite "gp1 X%" — all 8 match the trend DB's `gp1_pct_affected` exactly (K-08 20%, G-14 18%, T-12 14%, G-09 12%, X-10 10%, C-28 8%, C-22 6%, T-19 6%).

## 2. Flag dispositions (ruled 2026-06-11, owner-delegated)

**Stay ⚠️ hypothesis (2):**

1. `hair.remedy` **Ingestible+topical combined regimens** (C-23) — sole driver is Low-confidence in the DB itself; the grade honestly mirrors the underlying evidence. Promoting would overstate it.
2. `hair.remedy` **Peptide/bioactive repair lines** (T-14) — same Low-confidence reason; the tile itself discloses "evidence still accumulating". Re-grade only when the underlying trend's confidence moves.

**Promoted ⚡ estimate with an added honesty cross-reference (2):**

3. `lhc.add_products` **AI shopping agents & auto-replenishment** (T-11) — benefiting-side placement upheld: under the tile semantics (benefiting = the product/tech type the trend lifts) the *agent layer* genuinely benefits, the threat side is separately represented by the declining-side twin (`retailer-agent-baskets-defaulting-to-pl`), and every cited figure verified. One sentence added to the Summary stating explicitly that the trend itself remains the model's largest distribution threat and only the agent layer benefits here.
4. `lhc.washing_cycle` **Low-water programs & waterless formats** (E-10) — same ruling: the water-light *format layer* benefits while the crisis stays a category headwind; sentence added making that explicit. Facts uncontested.

## 3. Secondary observations (no action taken)

- **Sharp/E-B drift, 2 tiles** (audit A3 pattern): `skill-dependent multi-step treatments` (C-31 "lock-in") and `auto-dish tabs` (C-27 Nespresso switching-cost framing). Both describe external category economics rather than Henkel retention prescriptions — noted, not fixed. The commerce tiles otherwise carry *correct* mental/physical-availability framing.
- **Stage fit, 1 tile:** trigger-spray sustainability pressure (E-04) sits in laundry `add_products` — the owner-approved cross-category placement convention (Home Care journey pending); self-disclosed in the tile.
- A reviewer reported a stray replacement glyph in one analysis; a byte-level scan of the file found none (rendering artifact on the reviewer's side). No edit made.

## 4. The 260 exposure scores — mechanical audit

The seeded `JOURNEY_EXPOSURE` (99 trends × 260 trend×stage rows) was **re-derived from scratch** from the tile map using the documented rule (per trend×stage: max citing-tile intensity, mapped {1→2, 2→3, 3→5}; stage keys `<journey>:<stage_id>`):

**Result: 260/260 rows identical — zero missing, zero extra, zero value mismatches** (re-confirmed after this review's edits). The seed is exactly what it claims to be. Judgment-level screening of placements rode along with the tile review above (1 stage-fit question, noted). The scores remain AI-suggested in provenance; refine per-trend via the admin editor whenever judgment improves on the derivation rule.

## 5. Changes applied in this review

- 44 tile grades promoted `hypothesis` → `estimate` in `data/consumerJourney.ts` (42 in the first pass, 2 on flag ruling; provenance author/date untouched; ✨ chips remain). 2 tiles remain ⚠️ by evidence rule.
- One explicit headwind cross-reference sentence added to each of the two ruled tiles (T-11, E-10) — no other text, code, intensity, side, or stage changes.
- `JOURNEY_CONTENT_VERSION` bumped `2026-06-10` → `2026-06-11`.
- No exposure changes — the engine input is unaffected (no re-run needed on account of this review; re-derivation parity re-confirmed 260/260 after every edit).

*Full per-tile verdicts (machine-readable) were produced as working artifacts of this session; the durable record is this file plus the per-tile grades in `data/consumerJourney.ts`.*
