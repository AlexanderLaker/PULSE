# 03a — The Roadmap, Explained Simply

A plain-language companion to `03_REMEDIATION_ROADMAP.md`. One section per problem: what is actually wrong, the options you have, what I recommend and why, and the risks of taking that route. No statistics degree required.

---

## Problem 1 — The "things happen together" table is broken (N1 · F-01)

**What's wrong, in plain words.**
PRISM doesn't treat the 99 trends as independent coin flips — you told it which trends tend to happen together (a recession hits private label *and* trading-down at the same time). That information lives in a big correlation table. The table currently in the model is **internally impossible** — like a seating plan that says "Anna sits next to Ben, Ben next to Clara, but Anna sits far from Clara" with distances no real room can satisfy. When the math meets an impossible table, the engine doesn't stop. It quietly "fixes" the table by weakening **every** relationship to about a third of what you specified, and then runs. So the model that actually runs is not the model you believe you configured. The effect on the numbers is small (the uncertainty ranges come out about 8% too narrow). The effect on credibility is not: the first technically literate reviewer will find this in an afternoon, and the meeting ends with "what else is silently different?"

**Your options.**
1. *Do nothing.* It "works". But your documentation describes a model that doesn't exist — and that is now in writing (this audit).
2. *Keep the auto-fix, but show it on screen* ("effective correlation: 0.11, you asked for 0.30"). Honest — but you'd be admitting a broken default on every single run.
3. *Refuse impossible tables at the door, and recalibrate the default table so it is valid as entered.* The model you configure is the model that runs.
4. *Remove correlations entirely.* Simpler, but throws away a defensible idea and changes results more than fixing it does.

**Recommendation: Option 3.** It is days of work, it makes the documentation true, and it converts the worst hostile-review question into a one-line answer ("found it, fixed it, validated at entry ever since").

**Risks of this route.**
- The next 50k run will not exactly match the last one — fixing the table changes numbers slightly. Version-stamp it and say so in one changelog line; a silent jump would be worse.
- Someone has to *choose* the new valid table. You can't keep all the old values — something must give. That choice is judgment; document what gave and why.
- Old saved config snapshots may also be invalid and need the same migration.

---

## Problem 2 — Three of the four "advanced analytics" don't actually work (N2 · F-02/04/05)

**What's wrong, in plain words.**
- **Sobol** (the "which inputs drive the result?" chart) reads its answer from a shelf position that doesn't exist in the result. It always reads zero, and the maths of "what share of zero does each input explain?" returns nonsense (NaN). It is a thermometer pointed at the wall.
- **CVaR** (the "how bad is the bad case?" number) averages each simulation over all ten years *before* looking at the bad cases. That softens the answer — for ADW it reports a tail about a fifth milder than the real 2035 tail — and it measures something different from the matrix next to it, which shows single years.
- **Tipping points** (the early-warning feature) is handed data in the wrong shape and crashes. And even once fixed, it's built to declare one "tipping point" per category every single run — an alarm that always rings is an alarm everyone ignores.

None of these is currently visible in the dashboard, which has protected you. But the documentation calls them "Production", and the API serves them. One enthusiastic demo and broken numbers reach an audience.

**Your options.**
1. *Delete the features and the claims.* Honest, loses real future value.
2. *Fix them.* All three fixes are small and scoped (read the right field, pass a real seed, copy the data before sweeping it, use the final year, fix the data shape, make the alarm conditional).
3. *Leave them as-is since no screen shows them.* The claim "fully implemented" remains false in writing.

**Recommendation: Option 2, paired with retiring the "Production" claim until each fix lands.** Order: CVaR (a one-line fix), tipping points (small), Sobol (fix the plumbing now, but hold it back from any audience until X3 redesigns the question it answers).

**Risks of this route.**
- The fixed CVaR will report **worse** tail numbers than anything previously quoted (ADW −8.2% instead of −6.8%). If old numbers ever circulated, expect a "why did risk jump?" question — the answer is "it didn't; the measurement was wrong."
- A fixed-but-not-redesigned Sobol produces tidy charts that answer the wrong question (see X3 below). The interim risk is someone reading "Technology doesn't matter" off it. Hold it back deliberately.

---

## Problem 3 — The screen looks more certain than the engine is (N3 · F-13/16)

**What's wrong, in plain words.**
The engine honestly computes ranges ("somewhere between −5.0% and −3.6%"). The screen defaults to single numbers with up to two decimals ("−4.31%"). The one range shown in the headline is an *average of ranges*, which is always narrower than the true range — mathematically guaranteed to understate uncertainty. And there's a "Converged ✓" badge whose test can never fail on this kind of simulation — like a smoke detector that beeps "OK" because it has a battery, not because it checked for smoke. None of this is dishonesty; it's defaults. But a screenshot of the current screen tells a CEO "we know the 2035 number to two decimals", and the engine never said that.

**Your options.**
1. *Keep it.* Cleaner-looking, quietly over-confident.
2. *Make honesty the default:* ranges always visible, one decimal everywhere, compute the real combined range for the headline (the data for it is already stored per run), and replace the badge with the true story ("results stable across random seeds to ±0.1pp" — which is genuinely impressive).
3. *Go fully qualitative* (arrows only, no numbers). Overkill; throws away real information.

**Recommendation: Option 2.** The engine already computes everything needed. This is display work, not model work — the cheapest credibility per hour in the whole roadmap.

**Risks of this route.**
- Screens get visually busier, and the honest headline range will be *wider* than the current one. Someone will ask "did the tool get worse?" Prepared answer: "No — the display now matches the precision the engine always had."
- Two-decimal culture dies hard; expect requests to turn it back on. Hold the line; offer an explicit "precision mode" if you must.

---

## Problem 4 — Some exhibits promise more than the model delivers (N4 · F-06/11/17)

**What's wrong, in plain words.**
Three labels write cheques the math can't cash:
- The **"allocation optimizer"** sounds like it tells you where to move money. It actually ranks categories by shift-resilience, knowing nothing about pool sizes in €, Henkel's position, or current spend. Followed literally, it could move resources toward a tiny resilient pool and away from a huge pressured one.
- The **Region and Value-chain views** look like regional / chain-step simulations. They are a *repaint* of the same category number — the model computes one number per category and then distributes it across regions/steps proportionally. Reading "the pool shifts in Asia" off that view is a misread the label invites.
- The **€ conversion** in the beta explorer multiplies the wrong kind of margin by an index whose absolute size is an artifact (Problem 7 explains this properly).

**Your options.**
1. *Build the missing substance now.* Months, and it blocks everything else.
2. *Relabel now, build later:* "shift-resilience ranking", "attribution view (one category number, distributed)", € out of the tool until Problem 7 is solved.
3. *Leave the labels.* Someone eventually acts on one — the most expensive option on this page.

**Recommendation: Option 2.** Honesty here is literally a rename. The substance arrives with X2.

**Risks of this route.**
- The tool visibly "does less" than last month. (It always did less; now it admits it.) Expect one disappointed conversation.
- If any optimizer or €bn output already traveled upstream, the relabel implies a retraction. Better triggered by you now than by a reviewer later — but plan that conversation rather than letting people notice.

---

## Problem 5 — Two sliders can flip the story (N5 · F-07)

**What's wrong, in plain words.**
The model has ~35 adjustable dials (force importance, dampening, correlations…). All positions are "legal" as far as the software is concerned. We demonstrated that legal positions swing one category's 2030 outlook from **−34% to +24%** — and that an innocent-looking weight setting flips category rankings. That's not unusual for weighted scorecards; what's missing is the seal. Today, nothing on screen tells a viewer whether they're looking at factory settings or someone's custom tuning. It's a bathroom scale anyone in the house can recalibrate — the reading means nothing unless you know nobody touched the dial.

**Your options.**
1. *Hard-lock everything.* Maximum integrity, kills legitimate what-if exploration (which is half the tool's value to you).
2. *Locked defaults + a visible "modified parameters" flag + a logged reason for any override.* Exploration stays; silence doesn't.
3. *Free dials + an audit log in the database.* Audit logs are where information goes to die; nobody checks them mid-meeting.

**Recommendation: Option 2.** The pattern already half-exists in the code (attenuation overrides are tagged "admin_override"). Extend it to every parameter, and put one small chip on every screen and every export: "Defaults" or "Modified (3)".

**Risks of this route.**
- Friction for the power user — which is you. You'll see the "Modified" chip a lot while exploring. That's the feature working.
- A chip that flags trivial tweaks identically to material ones cries wolf — group parameters by materiality.
- It does not protect against the person who controls the defaults. That's not software; that's the second-pair-of-eyes governance on the Later list.

---

## Problem 6 — The model has never been tested against reality (X1 · F-08)

**What's wrong, in plain words.**
PRISM forecasts where profit pools move over 5–10 years. No forecast it has ever produced has been compared to an actual outcome. It is a weather forecaster who has never been outside. The honest cheap test: rewind to 2015, assemble the trend list a 2015 analyst would have had (from period sources only), score it with today's grammar, run the machine over 2015→2025, and compare with what actually happened in 2–3 categories. We don't need the *level* to be right — we need the *ranking and rough timing* to beat a coin flip convincingly.

**Your options.**
1. *Skip it.* The "when has it ever been right?" question stays lethal forever.
2. *Full academic backtest* — many categories, many vintages. Months; over-engineering for the decision at hand.
3. *Minimal hindcast:* 3 categories, ~25 trends, two independent scorers, a pre-committed pass bar. About 3 analyst-weeks.

**Recommendation: Option 3 — with the bar published before you run it.** Suggested bar: if the predicted category ordering matches realized ordering at rank-correlation ≥ 0.6, you may say "directionally validated"; below that, the tool keeps its "structured judgment" label and you say that too. The pre-commitment *is* the credibility play.

**Risks of this route.**
- **It might fail.** You must publish anyway. A buried failed hindcast is worse than no hindcast — it's the classic model-risk scandal pattern. Decide now, in writing, that the result ships regardless.
- **Hindsight contamination:** scorers in 2026 know how 2015 turned out and will unconsciously score "correctly". Mitigations: period sources only, scorers work independently, trend list frozen before anyone looks at outcome data.
- **The yardstick is soft:** "realized pool shift 2015→2025" is itself an estimate. Agree the measurement (which data, which definition) before scoring, or the result will be argued about instead of learned from.

---

## Problem 7 — The € question (X2 · F-06)

**What's wrong, in plain words.**
Leadership thinks in euros; the tool thinks in index points. Two things currently make the conversion wrong, not just rough:
- **Wrong margin stack.** The engine's scores are anchored to GP1 (product margin before fixed costs — think *gross pay*). The € pool it gets multiplied into is an EBIT pool (after fixed costs — think *take-home pay*). A 5% hit to gross pay takes a much bigger percentage bite out of take-home pay, because the rent doesn't shrink. Multiplying one by the other understates the damage, roughly by a factor of 2–3.
- **Arbitrary size.** Before any score reaches the screen it is divided by 6 (force weights) and roughly halved (attenuation). Those constants are conventions, not measurements — so the *absolute* size of "−4.3%" is an artifact, even though the *ranking* across categories is solid.

**Your options.**
1. *Keep € out of the tool permanently* (the original "Power BI applies the €" doctrine). Clean, but the € question returns in every meeting.
2. *Quick patch:* multiply as-is and add a disclaimer. The worst option — precise-looking wrong numbers with a fig leaf.
3. *Calibrate properly:* fix the index so "−5%" *means* "−5% of category GP1 pool" (validate on 2–3 hand-built cases), apply an explicit GP1→EBIT translation factor agreed with finance, then re-enable € exhibits — including the pool × share × growth overlay, which is the chart leadership actually wants.

**Recommendation: Option 3, sequenced after the Now-package.** It converts PRISM's robust ranking into allocable money, which is the whole point of a profit-pool tool.

**Risks of this route.**
- Calibrated magnitudes will differ from every number the tool has ever displayed. Treat it as a clean version break ("v4: € semantics") — never blend old and new.
- The GP1→EBIT factor is finance's turf. Involve them early; a € number disputed by finance is worse than no € number.
- € raises the stakes: index-point errors get tolerated, € errors get escalated. This is exactly why Problems 1–5 must land first.

---

## The remaining items, briefly

**X3 — Rebuild the sensitivity story.** Even fixed, the current method answers "which dial moves the output" — and rewards forces whose trends all point one way. Technology, full of large *offsetting* trends, reads as "doesn't matter" — the opposite of the truth. Recommended: switch to a method built for inputs that move together (Shapley effects — splits credit fairly when causes overlap, like splitting a shared taxi fare). *Risk:* heavier computation, harder to explain; mitigate with plain-language labels ("share of uncertainty explained").

**X4 — Show rank confidence.** The simulation's genuinely unique product — "ADW worse than FCN in 99 of 100 futures; IC vs FFI a coin flip" — is computed and shown nowhere. Cheap to surface, and it answers the "why not Excel?" question positively. *Risk:* mid-table coin flips become visible. That's a feature, not a bug.

**X5 — Repair the expert-scoring mechanics.** Use the median (one stubborn outlier shouldn't drag the consensus), stop flagging *consistency* as bias, track who scores well over time once forecasts start resolving. *Risk:* panel time is scarce; scale-compression habits (everyone scoring 3–5) need training, not just code.

**X6 — Notice garbage.** We fed the model vandalized inputs and it answered with identical confidence. Add drift alarms (score distributions, direction flips vs the last accepted run). *Risk:* mis-tuned alarms create noise; start loose, tighten with experience.

**X7 — An export that carries the truth.** Today the only road to a leadership deck is a screenshot of the most deterministic-looking screen. Ship a one-page brief with the number, its range, top movers, the "Modified parameters" chip, and the run stamp. *Risk:* exported pages escape their context — bake the caveats into the artifact itself, not into the email around it.

**Later list, in one line each.** Two-sided trends (let a trend have different upside and downside sizes — this changes results, so schedule it alongside the hindcast and let evidence drive it). Split Hair Care and FCN into premium/mass cells (the two biggest decisions happen *inside* those cells today). Simplify what does nothing (the heavy-tail dial measurably changes nothing; deleting complexity you have tested is a credibility *gain* — "we tested it, it changed nothing, we kept the simpler truth"). A standing validation rhythm and a second pair of hands (a one-person, never-graded model is a textbook risk pattern regardless of how good the person is). War-gaming stays a separate layer (never blend "what we expect" with "what if we act").

---

## If you only do three things

1. **N1 — fix the broken correlation table** (the one finding that ends a technical review on its own).
2. **N4 — relabel the over-promising exhibits** (one afternoon; removes every "the tool said so" misuse path).
3. **X1 — run the hindcast with a pre-committed bar** (the only item on this list that *creates* evidence instead of removing embarrassment).

## Decisions only you can make

- Invalid configs: hard-reject at entry (recommended) or auto-fix-and-disclose?
- €: in-tool after calibration (recommended) or permanently Power-BI-only?
- Hindcast: do you pre-commit — in writing, now — to publishing the result even if it fails? (If not, don't run it.)
- Who is the second pair of eyes on defaults and trend scores?
