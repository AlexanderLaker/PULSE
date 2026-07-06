# PRISM Governance Record (`docs/governance/`)

The auditable decision trail of the PRISM model and platform — committed to
the repository (H5, owner decision 2026-07-06) so the credibility record
travels with the code it governs.

Reading order:

| Doc | What it is |
|-----|------------|
| `DECISION_LOG.md` | The owner rulings D1–D21 (June 2026 strategy-review rounds) with full decision text and execution records. `CLAUDE.md` §1 summarises them; this is the source. |
| `FINDINGS_REGISTER.md` | The strategy-review findings register (F-01…F-27): every audit finding with evidence, status, and — where the owner ruled a finding *open-by-decision* — the standing rationale (F-08 no hindcast, F-09 one-sided trend grammar, F-20 no Henkel-position overlay). |
| `CODE_REVIEW_2026-07-01_DECISIONS.md` | The July 2026 external-style code review: 2 critical / 6 high / 17 medium / 29 low findings with options and recommendations, as presented to the owner. |
| `REMEDIATION_2026-07-06.md` | What was actually done about it — the July 6 handover-review remediation record: every finding's disposition (fixed / owner-decided / declined-with-reason), the owner decisions R1–R4, and the commits that carry each fix. |

Conventions: findings are cited by ID everywhere in the codebase
(`C1`, `H6`, `M12`, `L25`, …). A code comment reading
`# M4 (July 2026 review): …` refers to `CODE_REVIEW_2026-07-01_DECISIONS.md`;
`D13` / `F-16` style IDs refer to the decision log / findings register.

Governance rules that bind future work are summarised in `HANDOVER.md` §6
("landmines") — the most important: golden pins are regenerated only for
deliberate model changes, in the same commit, with an owner-approved
MODEL_VERSION bump; and no positioning language may claim predictive
validity while F-08 stays open.
