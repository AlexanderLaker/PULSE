# PRISM — Documentation Index (`docs/`)

Deep-dive documentation for PRISM. The five **canonical** docs live at the repo
root: `README.md` (setup), `HANDOVER.md` (developer takeover), `CLAUDE.md`
(full handbook / single source of truth), `DEPLOY.md` (deploy runbook), and
`CONCEPT_PRISM_ONLINE_AI.md` (target-state concept for the Henkel-hosted,
AI-enabled version). Everything below is reference material consolidated here in
the June 2026 pre-handover cleanup.

## Methodology & data provenance
| Doc | What it covers |
|-----|----------------|
| `Attenuation_Calibration_Methodology.md` | Derivation of the per-force attenuation + within-force overlap matrices (structured-judgment overlap correction, v3.5). Companion scripts: `scripts/compute_attenuation_v3_5.py`, `scripts/build_attenuation_xlsx.py`. |
| `HENKEL_BRAND_CATEGORY_MAPPING.md` | Category/brand taxonomy (Hair, LHC) used across the model and dashboard. |
| `CONSUMER_JOURNEY_BLUEPRINT.md` | Spec of the Consumer Journey overlay (Laundry/Hair stages, tile model, provenance grading). |
| `SEED_DATA_README.md` | The 99-trend seed data and how it is loaded. |
| `TREND_RESEARCH_GUIDE.md` | Process for researching and scoring trends. |
| `TRENDS_VERIFICATION.md` | Trend verification notes. |
| `TRENDS_SOURCE_AUDIT_2026-05-01.md` | Point-in-time source audit of the trend base. |
| `TREND_SOURCE_AUDIT_AND_GAP_ANALYSIS.md` | Full source-provenance audit + gap analysis of the 99 trends. |

## Engineering & operations
| Doc | What it covers |
|-----|----------------|
| `DESIGN.md` | "Maritime Editorial" design system — token source of truth (mirrors `tailwind.config.js` + `app/globals.css`). |
| `TESTING.md` | Canonical testing guide (run commands, fixtures, suite layout). |
| `DEPLOYMENT_NOTES.md` | JWT-secret synchronization between the Next.js proxy and the FastAPI engine. |
| `AUTH_PAGES_REFERENCE.md` | Auth page flows (sign-in/up, forgot/reset password). |
| `CLERK_MIGRATION.md` | History of the Clerk auth integration. |
| `CONNECTION_STATUS_GUIDE.md` | Health/connection-status behavior in the dashboard. |

## Dormant AI layer (roadmap)
These document `pulse/ai/` and the unmounted scanner surface, kept fenced for the
online/AI concept. Not wired into the live app — read alongside
`CONCEPT_PRISM_ONLINE_AI.md`.

| Doc | What it covers |
|-----|----------------|
| `AI_QUICKSTART.md` | How the (dormant) AI provider/scanner/narrator/calibrator layer is structured. |
| `SCANNER_API.md` | The trend-scanner API surface and the long-term integration catalogue. |
