# 05 — The Ten Hardest Questions

The questions a hostile McKinsey partner or skeptical board member will ask, PRISM's best *current* answer, and an honest call: **survives / survives with caveats / does not survive**. Use this as prep material — every answer is backed by the register (F-xx) and the verification runs.

---

**Q1. "You multiplied two gut-feel ratings and ran 50,000 simulations on the product. Why is this better than my Excel scorecard?"**
*Best current answer:* The atom is no longer two gut-feels — probability is tier-gated to sourced evidence and gp1_pct_affected is an economically anchored exposure estimate with documented calibration bands per trend type. And the Excel comparison is fair: the median ranking is indeed reproducible deterministically (we checked: Spearman 0.98+). What 50k iterations buys is *calibration of confidence in that ranking* — e.g. P(ADW deteriorates more than FCN) = 0.99, while IC-vs-FFI is a coin flip — which no scorecard gives you.
*Call:* **Survives with caveats** — only if the rank-confidence view actually ships (today it is computed but shown nowhere, F-Pass6/H12), and only if you concede the headline ranking doesn't need MC. If you defend the MC as the *source of the ranking*, you lose.

**Q2. "Your default correlation matrix isn't even a valid correlation matrix. What else don't you know about your own model?"**
*Best current answer:* Correct — found in this audit (λmin=−1.68, silent repair shrinks correlations ×0.37, F-01). Two mitigations: the engine logs an integrity event rather than hiding the repair, and the quantitative effect on bands is ×1.08. Fix (reject invalid configs, recalibrate defaults) is scoped at days, not months.
*Call:* **Does not survive today.** Survives in 2 weeks if the fix plus a configured-vs-effective disclosure ships. Do not enter a leadership room before then.

**Q3. "When has PRISM ever been right? Show me one validated prediction."**
*Best current answer:* Never — by design honesty: the backtesting module was deleted in v3.2 precisely because no historical data was wired in, and we do not claim predictive validity (F-08). PRISM is positioned as structured judgment with uncertainty discipline, the same epistemic class as any partner-led trend review — but reproducible, versioned, and auditable, which partner judgment is not. A 2015→2025 hindcast on three categories is scoped (3 analyst-weeks) and will give the first real calibration point.
*Call:* **Survives only with the honest positioning** ("judgment engine, not forecaster") **and a dated hindcast commitment.** Any "predictive platform" framing dies here.

**Q4. "Every single category contracts. Ten years, twelve categories, not one grows. Do you actually believe that?"**
*Best current answer:* The trend base is deliberately bear-tilted (52 contraction trends, larger gp1 on the contraction side) because its job is risk triage, and the direction grammar is one-signed — so read the output as *relative headwind intensity*, not net pool change. The differentiation (ADW −6% vs HSC −3%) is the signal; the level is grammar.
*Call:* **Survives with caveats** if reframed exactly like that — and it must be, proactively, because as a literal forecast it contradicts the base rate that nominal FMCG pools grow (F-21) and the model has no mechanism to disagree (F-09: no trend can surprise positively).

**Q5. "I move two sliders and Hair Color flips from deep red to green. Why should I trust anything this shows me?"**
*Best current answer:* True (we demonstrated −34%…+24%, F-07). That is the nature of *every* weighted scorecard — PRISM at least snapshots every config, stamps every run, and ships a calibrated default set with provenance. What's missing is the lock-and-disclose layer: defaults locked, overrides flagged on every exhibit with a reason string.
*Call:* **Does not survive today** (the disclosure layer doesn't exist on screen). Survives once locked defaults + non-default chips + a parameter-band exhibit ship. Note: "everyone's scorecards do this" is an explanation, not a defense — the board will accept it only alongside the guardrails.

**Q6. "Your Sobol chart says Technology doesn't matter. Half your trend base is technology disruption. Which is wrong?"**
*Best current answer:* Both, in a sense — which is why no Sobol chart should be shown today. The endpoint is broken (returns NaN, F-02), and the design measures one-sidedness of force sums, not uncertainty: Technology's large *offsetting* trends net to ~zero, so weight-sensitivity is tiny even though it's the most contested battleground (F-03, verified `v3b`). The right tool under our own copula is Shapley effects per trend cluster.
*Call:* **Does not survive — retire the exhibit** until reframed as Shapley-based "uncertainty drivers" plus separately labeled "knob sensitivity". (The honest version of this answer is itself credibility-positive: we found it ourselves.)

**Q7. "Your CVaR says the worst case for ADW is −6.8%. Your own matrix shows −7% as the *median* in 2035. Explain."**
*Best current answer:* Caught: the CVaR endpoint averages over the whole path before taking the tail, so it's a different (and softer) object than the terminal-year figures on screen (F-04, 21% understatement on ADW). Estimator itself is stable (bootstrap SE <0.1pp); the aggregation choice is simply wrong and is a one-line fix.
*Call:* **Does not survive today; trivially fixed.** Until fixed, CVaR stays out of every conversation.

**Q8. "Where is Henkel in all of this? You show me category weather, not our position — and if we act, your model doesn't even notice."**
*Best current answer:* Correct twice. PRISM is an exogenous-trends model: it maps where pools shift, not what HCB or competitors do about it (F-20, H6). Share data per category exists in the repo; the 2×2 overlay (shift attractiveness × Henkel relative position) is buildable from existing data in weeks. Endogeneity (reaction functions, war-gaming) is honestly out of scope — the wargaming concept exists as a separate deck, not as code.
*Call:* **Survives as a scoping statement** — *if* the exhibits say "exogenous trend pressure" and the overlay ships. Dies if anyone has meanwhile presented the allocation optimizer's "invest more / harvest" output as a position-aware recommendation (F-17 — retire that label now).

**Q9. "€38 billion pool, you tell me hair care shifts −3.7%, so we lose €1.4 billion of pool — can I put that in the budget discussion?"**
*Best current answer:* No. The € conversion in the Beta explorer multiplies an EBIT pool by a GP1-anchored index whose absolute scale is compressed by arbitrary constants (weights × attenuation ≈ ×0.075) — the ranking is meaningful, the €bn delta is not (F-06). That's exactly why the explorer carries a mock-up disclaimer and why the € lens was doctrine-bound to Power BI with finance-owned figures.
*Call:* **Survives only as the refusal.** Any €bn number quoted from today's tool does not survive 60 seconds of margin-stack arithmetic (GP1 vs EBIT leverage ≈ ×2–3).

**Q10. "Who, besides you, has ever checked any of this?"**
*Best current answer:* The trend *content* has been through external-style reviews (Bain-format April-2026 review, Gemini external-model review, source audit — all documented in-repo); the *code and statistics* had their first independent validation in this audit, which found the issues in this register and verified the core engine exactly correct (S-02), bit-reproducible (S-01), with honest internal accounting (S-05). The findings are specific, fixable, and now have a roadmap.
*Call:* **Survives with this audit in hand** — it is the answer. Without it (or with the findings unaddressed next quarter), it does not: a one-owner, never-validated model carrying leadership numbers is the textbook model-risk pattern.

---

### Scorecard of the red team
Survives clean: none. Survives with caveats/positioning: Q1, Q3, Q4, Q8, Q10. Does not survive today, fixable in ≤2 weeks: Q2, Q5, Q6, Q7, Q9. **The pattern: PRISM's honest positioning survives everywhere; its numbers, nowhere yet.** That is precisely the "Internal decision-support only" verdict.
