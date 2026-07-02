# Profit Pool Explorer — Passport Alignment Audit & Category Crosswalk

**Date:** 2026-07-02 · **Scope:** `lib/profitPoolData.ts` (v2, 2026-06-11) market sizings vs. Euromonitor Passport taxonomy · **Trigger:** internal Passport data diverges from the tool's figures
**Verdict up front:** Your Passport numbers and the tool's numbers differ because the tool does **not** use Passport category boundaries. The GP1 margin anchors (FY2025 filings) are solid; the **revenue slicing is a patchwork of 8+ tier-2 research firms with incompatible scopes and base years 2022–2026**. The fix is structural, not cosmetic: rebuild the revenue layer on Passport's category tree and let internal Passport values be the single sizing authority.

---

## 1 · What is wrong with the current data (finding by finding)

### F-A: The sub-segment views use non-Passport category boundaries

**Hair.** The tool's 8 bars are Shampoo / Conditioner / Hair Color / Styling / Masks / Hair Oil / Serums / Supplements — sourced from Fortune BI, GVR, Mordor, IMARC, CMI. Passport's 8 categories are: 2-in-1 · Colourants · Conditioners & Treatments · Hair Loss Treatments · Perms & Relaxants · Salon Professional · Shampoos · Styling Agents. Consequences:

- **Conditioners & Treatments is shattered into 4 bars** (Conditioner $5.3bn + Masks $0.7bn + Serums $1.3bn + Oils $4.7bn = **$12.0bn**) that sum to roughly **35% below** the Passport C&T line (~$18bn triangulated 2025). The FBI "conditioner" figure is rinse-off conditioner only.
- **Shampoo $38.2bn (FBI)** is ~30% above a Passport-consistent shampoos line (~$29–30bn; Europe cross-check: shampoos $7.6bn of $23.2bn Europe total = 33% share ⇒ ~$30bn world).
- **Hair Color $26.1bn (GVR)** includes professional colourants — while the tool *also* shows a separate Professional Products tier. Double counting; Passport retail Colourants is ~$15–16bn.
- **Salon Professional is missing** from the sub-segment view although it sits **inside** the Passport hair care total the view claims to reconcile against.
- **Supplements** aren't Hair Care in Passport at all (Consumer Health/VMS) but are normalized into the hair pool.
- The advertised "reconciles within ~1% of Euromonitor's total" is a **coincidence of offsetting scope errors** (shampoo +30%, C&T −35%, colour +65%, salon pro −100%). The total matched; every slice was wrong — which is precisely what you saw against Passport. Display distortion at share level: the tool shows shampoo at 43% and colour at 30% of the pool; Passport-consistent shares are ~32% and ~17%.

**Laundry.** The tool's bars mix hierarchy levels: detergent *formats* (Liquid, Powder, Pods = Passport's sub-sub-categories of Laundry Detergents) sit next to *categories* (Fabric Softener = Passport Fabric Softeners; Stain Removers ≈ part of Passport Laundry Aids) and non-Passport slices (Scent Boosters, "Specialty/delicates" proxied by *baby cleaning products*). Consequences:

- **Stain Removers at 12% of the pool** uses GVR's $22.3bn scope that *includes surface stain products*; the entire Passport Laundry Aids category (stain removers + whiteners + water softeners + boosters etc.) is ~$6–7bn ≈ 6% of Laundry Care. Overweighted ~2–3×.
- **"Specialty (Delicates)"** — Passport has no such category; fine-fabric detergents live *inside* Laundry Detergents. The baby-cleaning proxy is scope-noise.
- **Carpet Cleaners** (a real Passport Laundry Care sub-category) are absent — immaterial in €, but it signals the taxonomy mismatch.

### F-B: Anchors are stale and derived, not recent and reported

- The **Home Care context total is a 2020 figure** ($167bn, via the KDC/ONE SEC S-1) — six years old.
- The **Laundry Care total (~$85bn "2024 est.")** is a derivation chain *from* that 2020 figure and is ~**15% below** a 2025-consistent value (~$100bn; see §3). The file itself grades it "estimate — confirm in Passport".
- Base years across sources span **2022–2026**; Passport reports one consistent year at RSP with fixed-FX growth. Divergence vs. your internal extract is guaranteed by construction.

### F-C: Passport Home Care categories are missing entirely

**Toilet Care (~$10.5bn — Bref's core category!), Bleach (~$7bn), Polishes (~$4.5bn), Home Insecticides (~$14.5bn)** appear nowhere. `lhc_ic` (Insect Control) — a live PRISM category with trend exposure — has **no pool representation at all**. "Surface Cleaners ~$55bn" is a derived blob (Mordor household-cleaners minus laundry) that silently mashes Surface Care + Toilet Care + Bleach + Polishes together.

### F-D: What is *not* wrong

- **GP1 margin anchors**: all 25 company margin sources are FY2025/FY2026 primary filings, re-verified in the T13 pass. Keep unchanged.
- **Value-chain tier logic and Core+Adjacent concept**: sound; only the revenue bases need re-anchoring.
- **Adjacency sizings that Passport can't provide** (salon services, washing machines, laundry services, on-demand apps): correctly flagged; Passport has no series for these — keep the triangulated estimates with their grades.

---

## 2 · What the public record supports today (most recent, verified 2026-07-02)

Genuinely Euromonitor-sourced public breadcrumbs (✅ = attributable to Euromonitor):

| Fact | Value | Vintage | Source |
|---|---|---|---|
| ✅ US Home Care retail value | **$40.2bn**, +2% | 2025 | Euromonitor, Home Care in the US |
| ✅ US Laundry Care retail value | **$18.5bn** | 2025 | Euromonitor, Home Care in the US |
| ✅ Global home care growth to 2029 | **+$17.4bn**; **Dishwashing fastest (+12% constant 2024–29)**, then Laundry Care, Surface Care | May 2025 | [Euromonitor Home Care Industry Overview](https://www.euromonitor.com/article/home-care-industry-overview) |
| ✅ Europe hair care | **$23.2bn**, +3.3% | 2025 | [Euromonitor via Happi (Mar 2026)](https://www.happi.com/haircare-market-sees-shift-towards-multi-step-routines/) |
| ✅ Europe shampoos | **$7.6bn** (≈33% of Europe hair) | 2025 | same |
| ✅ Styling agents Europe forecast | **+5.1%** | 2026 | same |
| Kline: global professional hair growth | **~4% avg**; US pro market $5.3bn; China salon sales −20% in 2025; NA e-com ≈25% of pro sales | 2025/26 | [Kline](https://klinegroup.com/beauty-and-wellbeing/professional-hair-care-industry-a-decade-of-change/) |
| Reckitt Essential Home (air care/surface/pest/laundry) | **£2.0bn net revenue (2024)**; sold to Advent ("Vestacy"), EV $4.8bn, **completed 31-Dec-2025** | 2025 | [Reckitt](https://www.reckitt.com/media-landing/press-releases/2025/reckitt-completes-divestment-of-essential-home/) |
| Circana (scanner POS, US): FY2025 beauty | Mass beauty **$72.7bn (+5%)**; prestige beauty **$36bn (+4%)**; **hair +8% prestige / +4% mass** — fastest-growing prestige category; prestige hair $2.3bn in H1-25; scalp care 3rd straight year of double-digit growth | 2025 | [Circana](https://www.circana.com/post/us-prestige-and-mass-beauty-retail-deliver-a-positive-performance-in-2025-circana-reports) |
| Circana Home Care Evolution (US) | Laundry care **+4.7% y/y** (incl. additives/odour care) vs. regular detergent **+2.6%** — additives outgrow base detergent | Jan 2025 | [Circana via Modern Retail](https://www.modernretail.co/marketing/brands-briefing-why-specialty-laundry-care-products-are-the-next-big-home-care-category/) |
| ✅ US Laundry Care (independent confirmation) | ~**$18bn (2024)** ≈ "nearly half" of US home care | 2024 | [Euromonitor country report via R&M](https://www.researchandmarkets.com/report/united-states-laundry-care-detergents-market) |
| Statista Market Insights (own model, cross-check only) | Home & Laundry Care world **$208.9bn (2026F)**, ~$193bn (2024); Laundry Care ~$103bn; Dishwashing detergents ~$26.6bn; Hair Care (retail-only, excl. professional) **$99.9bn (2026F)** | 2024–26 | [Statista CMO](https://www.statista.com/outlook/cmo/home-laundry-care/worldwide/) |

**The decisive finding:** no public source publishes current Euromonitor *global category-level* values (Home Care total, Laundry Detergents, Colourants, Toilet Care, …). Those live only in Passport — which Henkel licenses. **Public data can triangulate and cross-check; it cannot be the sizing authority for a Passport-aligned view.** That inverts the tool's current sourcing hierarchy, where tier-2 firms provide the headline numbers.

### 2b · Source hierarchy & value denominations (owner instruction, 2026-07-02)

Sizing authority ladder — a lower tier may only be cited when every higher tier is silent:

1. **Euromonitor Passport (internal)** — world/regional category values. Denomination: **RSP** (retail selling price, incl. sales tax, all retail channels).
2. **Kline** — **professional hair only** (salon channel). Denomination: **manufacturer-level salon sales** — NOT comparable 1:1 with Passport's Salon Professional line at RSP; expect Kline < EMI on the same market.
3. **Circana / NielsenIQ** — scanner **POS retail sales, tracked channels only** (misses parts of discounters, DTC, salons; public data US-centric). Best use: US cross-checks and growth pulses, not global levels.
4. **Company filings** — net sales = **MSP** (manufacturer selling price after trade terms). The margin layer; also supply-side sanity checks (P&G Fabric & Home Care $29.6bn FY2025 MSP vs. world laundry ~$100bn RSP).
5. **Tier-2 research firms** — last resort, denominations usually unstated/mixed, which is *the* structural reason their figures disagree with Passport. Grade ⚠️ always.

**Denomination bridge:** for these categories RSP ≈ **1.8–2.2× MSP** (retailer margin + wholesale + VAT). The explorer's value-chain construction already encodes this ("brand-owner net sales ≈ 50% of retail value") — keep it, but state it as an explicit RSP→MSP bridge, and give **every figure in `profitPoolData.ts` a `denomination` tag** (`RSP` | `MSP` | `scanner-POS` | `salon-mfr` | `model`) so mixed-denomination bars can never be summed silently again. Passport values drop into the end-consumer pools 1:1 (both RSP); Kline professional values must not be restated to RSP without an explicit bridge factor — show them labelled instead.

---

## 3 · Passport-aligned triangulation (2025 base, USD **RSP**, planning rate 1.15)

All values below are stated at **RSP** to be drop-in compatible with Passport. Prefilled midpoints for the rebuild — every figure graded ⚠️ *estimate, pending Passport confirmation* unless noted. Internal consistency verified: US share of world home care = 18.8%; US laundry share (46.0%) ≈ world (46.8%); Europe hair share = 24.9%.

**Home Care — world ≈ $210–220bn (2025)** *(2020: $167bn ✅; Statista model $193bn 2024 ⚡)*

| Passport category | ~$bn 2025 | Share | Cross-checks |
|---|---:|---:|---|
| Laundry Care | **100** | 47% | Statista ~$103bn ⚡; US $18.5bn ✅ |
| — Laundry Detergents (all formats) | ~80 | | formats (powder/liquid/tabs) = drill-down level |
| — Fabric Softeners | ~13–14 | | GVR $14.6bn (2023) ⚡ |
| — Laundry Aids (incl. boosters) | ~6–7 | | GVR stain-remover $22bn is scope-inflated ~3× |
| — Carpet Cleaners | ~0.5 | | immaterial |
| Dishwashing | **33** | 15% | fastest-growing HC category ✅ (+12% constant 24–29); Statista detergents-only $26.6bn ⚡ |
| — Hand (HDW) ~55–60% / Auto (ADW) ~40–45% | ~19 / ~14 | | ADW skews DM, grows faster |
| Surface Care | **30** | 14% | 3rd-fastest ✅ |
| Home Insecticides | **14.5** | 7% | tier-2 range $12.6–20.9bn — widest uncertainty |
| Air Care | **14** | 7% | Precedence $17.2bn is scope-inflated; Reckitt EH context |
| Toilet Care | **10.5** | 5% | IMARC $10.4bn (2025) ⚡ |
| Bleach | **7** | 3% | DM decline, EM habit |
| Polishes | **4.5** | 2% | structurally declining |

**Hair Care — world ≈ $93–96bn (2025, Euromonitor scope incl. Salon Professional)** *(Europe $23.2bn ✅ ≈ 25%; Statista retail-only model $99.9bn 2026F ⚡)*

| Passport category | ~$bn 2025 | Share | Cross-checks |
|---|---:|---:|---|
| Shampoos | **29.5** | 32% | Europe 33% share ✅ |
| Conditioners & Treatments | **18** | 19% | tool's 4 fragments sum to only $12bn |
| Salon Professional Hair Care | **16.5** | 18% | Kline salon channel ~$17bn (2024) ⚡, ~4% growth |
| Colourants | **15.5** | 17% | GVR $26.1bn incl. professional — do not use |
| Styling Agents | **9** | 10% | Mordor $10.0bn (2026) ⚡; Europe +5.1% 2026F ✅ |
| 2-in-1 Products | **2** | 2% | declining legacy format |
| Hair Loss Treatments | **1.8** | 2% | fastest %-growth, low base ✅ (Euromonitor) |
| Perms & Relaxants | **0.8** | 1% | immaterial, declining |

---

## 4 · The crosswalk: Passport ↔ HCB/PRISM categories (the proposal)

Principle: **rows in the explorer = Passport categories** (so your internal extract drops in 1:1); **grouping = HCB categories** (so the Shift Matrix linkage stays). Two structures, one dataset.

### Home Care → LHC

| Passport category | → PRISM category | Mapping quality | Notes |
|---|---|---|---|
| Laundry Detergents | **FCN + FCA** | ⚠️ needs internal split | Passport does not separate fine-fabric/specialty detergents (Perwoll) from heavy-duty (Persil) at category level — they're formats/positionings *within* Laundry Detergents. Use Henkel's internal FCN/FCA split on top of the Passport total. Passport's format tree (powder/liquid/tabs × standard/concentrate) becomes the **drill-down**, replacing today's mixed-level bars. |
| Fabric Softeners | **FFI** | ✅ 1:1 | Vernel/Silan. Scent boosters: confirm Passport placement (typically Laundry Aids); Henkel steers them with FFI — footnote, don't re-map. |
| Laundry Aids | **LAD** | ✅ ≈1:1 | Sil, K2r. ~$6–7bn world — the honest number; retire the $22bn stain-remover source. |
| Carpet Cleaners | **LAD** (fold in) | ✅ | immaterial; footnote. |
| Dishwashing – Hand | **HDW** | ✅ 1:1 | Pril. |
| Dishwashing – Automatic | **ADW** | ✅ 1:1 | Somat. Fastest-growing pool — the "fund ADW" insight survives re-basing, now on honest numbers. |
| Surface Care | **HSC** | ✅ core | Biff, Sidolin, general purpose. |
| Toilet Care | **HSC** (cluster) | ✅ | **Bref** — today invisible in the explorer; must become a visible row. |
| Bleach | **HSC** (cluster) | ⚠️ | Henkel marginal; show as Passport row inside the HSC cluster for pool completeness. |
| Polishes | **HSC** (cluster) or exclude | ⚠️ | declining; recommend showing greyed/"no Henkel play". |
| Home Insecticides | **IC** | ✅ 1:1 | Currently missing entirely; PRISM `lhc_ic` finally gets a pool row. |
| Air Care | **— (adjacency)** | n/a | No HCB category; keep as white-space adjacency (post-Vestacy entry-window insight stays), resized to ~$14bn. |

### Hair Care (BPC) → Hair

| Passport category | → PRISM category | Mapping quality | Notes |
|---|---|---|---|
| Colourants | **Hair: Color** | ✅ 1:1 | Retail colour only — professional colour lives in Salon Professional. Fixes today's double count. |
| Shampoos | **Hair: Care** | ✅ | |
| Conditioners & Treatments | **Hair: Care** | ✅ | Absorbs today's Conditioner/Masks/Serums/Oils fragments as an optional drill-down. |
| 2-in-1 Products | **Hair: Care** | ✅ | small, declining. |
| Hair Loss Treatments | **Hair: Care** | ✅ | keep visible — fastest grower, scalp/longevity narrative. |
| Styling Agents | **Hair: Styling** | ✅ 1:1 | Taft, got2b. |
| Perms & Relaxants | **Hair: Styling** (fold in) | ⚠️ judgment | immaterial (~$0.8bn); footnote the fold. |
| Salon Professional Hair Care | **— (adjacency, inside total)** | ⚠️ structural | Schwarzkopf Professional revenue is HCB, but PRISM has no professional category. Show as its own row (~18% of the Passport hair total) tagged "in-total adjacency" — eliminates double counting with Colourants. **Authority: Kline** (owner instruction) — but Kline reports manufacturer-level salon sales while Passport's line is RSP-equivalent; show both labelled, never mixed in one sum. |
| *(Bath & Shower + Deodorants)* | **Hair: Body** | ❗ gap | Fa/Dial/Barnängen map to Passport **BPC > Bath & Shower + Deodorants**, not Hair Care. Today `hair_body` has zero pool representation. Decide: (a) add a Body row from those two Passport categories, or (b) declare Body out of explorer scope with an honest caption. Recommend (a) — it's one Passport pull. |

### What changes per view

- **Sub-segment views** → become **"Category Profit Pools"** on Passport rows: Hair = the 8 Passport categories; LHC = the 8 Home Care categories (not just laundry — HDW/ADW/HSC/IC finally shown at the same level as FCN/FFI). Detergent formats (liquid/powder/pods) move to a drill-down inside Laundry Detergents, matching Passport's sub-sub-category tree.
- **Value-chain views** → keep tiers and GP1 logic; re-base end-consumer pools to Passport totals (Laundry Care ~$100bn ⇒ ~€87bn; Hair ~$93–96bn ⇒ ~€81–83bn at 1.15).
- **Core+Adjacent views** → unchanged concept; core bars re-based; salon services / appliances / laundry services keep their triangulated grades (Passport has no series for them); air care resized ~$14bn.
- **GP1 margins, drift estimates, insights** → margins keep their FY2025 filing anchors; insights re-checked after re-basing (the ADW and air-care insights survive; the "31% powder" bar becomes a detergent-format drill-down fact).

---

## 5 · Recommended operating model for sizing data

1. **Passport internal = the sizing authority** (RSP). Fill the v2 validation worklist (companion file) from Passport: world + EU + NA, current year, RSP, USD & fixed-FX CAGR 2025–2030. ~20 numbers, one sitting.
2. **Kline = the professional-hair authority; Circana/NielsenIQ = US/tracked-channel cross-checks and growth pulses** (owner instruction 2026-07-02). Tier-2 firms only where all of the above are silent — grades stay honest (⚡/⚠️). Every figure carries a denomination tag (§2b).
3. **Company filings stay the GP1 margin layer** (MSP) — unchanged.
4. **Licensing note:** absolute Passport figures in an internal tool are fine under Henkel's license, but keep the source labels "Euromonitor Passport, [edition year]" and avoid re-publishing exact figures in exports that leave the company. Worth a 5-minute check with whoever owns the Euromonitor contract.
5. **D5 unchanged:** the explorer stays the one owner-sanctioned absolute-€ surface; the Shift Analysis remains relative-%.

### Suggested Passport pull-list (copy to your Passport session)

> Home Care: world retail value RSP 2025 + %CAGR 2025–30 (fixed FX) for: Home Care total; Laundry Care; Laundry Detergents (+ formats); Fabric Softeners; Laundry Aids; Carpet Cleaners; Dishwashing (Hand / Automatic); Surface Care; Toilet Care; Bleach; Polishes; Air Care; Home Insecticides.
> BPC: Hair Care total; Shampoos; Conditioners & Treatments; Colourants; Styling Agents; Salon Professional Hair Care; 2-in-1; Hair Loss Treatments; Perms & Relaxants; Bath & Shower; Deodorants.
> Same set for Europe + North America (for the regional lens), plus company/brand shares if you want a share overlay later.

---

## 6 · Answers to your three questions, in one line each

1. **"Are you using the right sizing?"** — No. Right margins, wrong revenue taxonomy: 8+ tier-2 sources with incompatible scopes; totals coincidentally reconciled while every slice deviated from Passport.
2. **"What to match the HCB structure?"** — The §4 crosswalk: Passport categories as rows, HCB categories as grouping; FCN/FCA via internal split of Laundry Detergents; Toilet Care/Bleach/Polishes clustered under HSC; Insecticides = IC; Salon Professional and Air Care as flagged adjacencies; decide on a Bath & Shower row for Hair: Body.
3. **"Reliable sources?"** — Ladder, not list: **Passport (RSP)** for category sizes; **Kline** for professional hair (manufacturer-level — bridge before comparing); **Circana/NielsenIQ** for US scanner cross-checks and growth pulses; **filings (MSP)** for margins. The public record (verified this week, most recent vintages) supports §2 and the cross-checks in §3 — nothing more granular; tier-2 stays graded ⚠️ and is used only where all four upper tiers are silent.

---

*Companion file: `2026-07-02_PRISM_market-size_validation_list_v2_passport-aligned.xlsx` — the June-30 worklist rebuilt on Passport rows with triangulated prefills; fill the "Passport value" column and variances auto-flag.*
*Sources for every figure are linked in §2/§3; figures marked ✅ are Euromonitor-attributable, ⚡ derived cross-checks, ⚠️ structured estimates pending Passport.*

---

## Addendum — IMPLEMENTED (2026-07-02, same day)

Owner ruling: Passport data cannot be shared into the tool (licence) — **the §3 triangulations were therefore implemented as the live values**, with derivation flagged to viewers. `lib/profitPoolData.ts` is now **v3**:

- Both sub-segment views rebuilt on Passport rows: Hair = 8 Passport categories (Salon Professional shown in-total, Kline-anchored, salon-mfr denomination); Home Care = 11 rows covering all 8 Passport categories — **every PRISM LHC category now has a pool row** (Toilet Care ~$10.5bn and Home Insecticides ~$14.5bn were previously invisible).
- Totals re-based: Laundry Care $85→**$100bn** (€87bn), Hair $88–90→**$94bn** (€82bn), Home Care context **~$213bn** (€186bn); Core+Adjacent combined pools recomputed (hair ~€254bn, laundry ~€315bn). ADW resized ~35% down, growth 8%→6.5%; air care resized to ~$14bn, growth 9%→5% — both conclusions ("fund Somat", "Vestacy entry window") survive on honest bases.
- **Derivation is viewer-visible**: every triangulated size carries a "PRISM triangulation" label + full recipe in the source `detail`, rendered in the source-chip hover ("How this was derived: …"); slide `construction` blocks state the method and the ±10–15% error band (insecticides ±25%); grades stay ⚡/⚠️ — never ✅ — until Passport values replace them via the worklist.
- `SourceRef.denomination` added (RSP | MSP | scanner-POS | salon-mfr | model); 17 retired tier-2 anchors deleted.
- Verified: typecheck clean, lint 0 errors (single-source guard OK), 36/36 vitest, all slide shares normalize to 1.000±0.002.
