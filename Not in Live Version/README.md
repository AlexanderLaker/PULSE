# Not in Live Version

Files relocated here are **not part of the live, deployed PRISM application** (the Vercel
Next.js frontend + read-only Python serverless API). They are kept in the repository for
history and reference, but moved out of the live source tree so the production footprint is
unambiguous.

- **Relocated:** 2026-06-14, on a branch (`chore/separate-non-live-files`).
- **Scope:** build-safe only. Nothing required by the build, `npm run verify`, CI, or the
  documented offline simulation run was moved — `tests/`, `scripts/`, CI config, build/dev
  config, and the core handover docs (`README.md`, `CLAUDE.md`, `HANDOVER.md`) all stay in place.
- **Git:** this folder is **tracked** (unlike `_NOT_FOR_HANDOVER/`, which is git-ignored
  secrets/decks). It is excluded from the Vercel deploy via `.vercelignore`.
- **Distinction from `_NOT_FOR_HANDOVER/`:** that folder is *do-not-ship-to-Henkel* material
  (secrets, internal decks, audits). *This* folder is legitimate project material that simply
  isn't part of the running product — it travels with the handover.

## What is here, and why

| Subfolder | Came from | Why it's not live |
|---|---|---|
| `legacy-vite-dashboard/` | `pulse/dashboard/` | The old Vite dashboard (~8 MB) superseded by the Next.js 16 app. Not imported by live code (only a stale comment in `components/dashboard/Trends2.tsx`). Still contains deleted-feature surfaces (Delphi, analytics). |
| `legacy-web-assets/root-assets/` | `assets/` | Vite scaffolding leftovers (`hero.png`, `vite.svg`, `react.svg`). Unreferenced by the Next app. |
| `legacy-web-assets/public-dist/` | `public/index.html`, `public/assets/`, `public/data/latest_mc_v3.1.json` | Compiled Vite build output that was being served statically (e.g. `ProfitPoolShiftModel-*.js`) plus a v3.1 data relic. The Next App Router does not use these. `public/images/` was **kept** (live). |
| `legacy-web-assets/api-public-dist/` | `api/public/` | Another copy of the compiled Vite dashboard bundle. Not mounted by the live FastAPI app (the only static mount, `pulse/api/app.py:200`, points at `pulse/dashboard/dist` and is guarded by `.exists()`), not referenced in `vercel.json`/`api/index.py`, and already excluded from the deploy via `.vercelignore`. **It was also tripping ESLint** (`react-hooks/rules-of-hooks` on minified code), so `npm run lint` was failing at baseline — relocating it turns that gate green. |
| `one-off-scripts/` | root `build_attenuation_xlsx.py`, `compute_attenuation_v3_5.py`, `test_ai_modules.py` | One-off/ad-hoc root scripts not imported by the engine or API and not collected by `pytest tests/`. (The maintained copies under `scripts/` stay.) |
| `dead-python/` | `pulse/backup.py`, `pulse/integrations/` | `backup.py` is unimported; `integrations/` is an effectively empty package (`__init__.py` + stale `.pyc` only). |
| `documentation/` | `DOCUMENTATION/` | Auxiliary docs, largely duplicating root markdown. Not needed to build or run; not referenced by code. |
| `office-docs/` | `2026-06-11_PRISM_Online_Operating_Concept_v1.docx` | Word duplicate of `CONCEPT_PRISM_ONLINE_AI.md` (the markdown stays at root). |

## Build-gate wiring (so nothing breaks)

Because this folder lives inside the repo, the moved `.ts/.tsx` (the old Vite app) would
otherwise re-enter the TypeScript/ESLint scope. To keep `npm run verify` green it is excluded in:

- `tsconfig.json` and `tsconfig.check.json` → `exclude: ["… ", "Not in Live Version"]`
- `eslint.config.mjs` → `ignores: ["…", "Not in Live Version/**"]`
- `.vercelignore` → `Not in Live Version/`

`vitest` (`tests/frontend/**` only) and the shift-matrix lint guard (`components app hooks` only)
already ignore this path — no change needed.

## How to restore a file

Move it back to the original path shown in the table above, e.g.:

```bash
git mv "Not in Live Version/legacy-vite-dashboard" pulse/dashboard
```

…then remove the corresponding `exclude`/`ignore` entries if you are reactivating TypeScript code.
