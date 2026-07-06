# PRISM Code Review — Decision List

A one-block-per-item companion to `2026-07-01_PRISM_code-review_v1.md`. Same IDs. For each item: what it is, your options, my recommendation, and the risk. Tick a box per item.

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low

---

## 🔴 Critical

### C1 — `full-reseed` endpoint has no admin auth
- **Description:** Anyone on the internet can call it (even via a browser link) and wipe the production trend database. Every similar endpoint requires admin; this one was missed.
- **Options:** A) Add admin auth + allow POST only.  B) Leave it.
- **Recommendation:** **A.** One line.
- **Risk of fixing:** None. Legitimate callers are already admins.
- [ ] Do it  [ ] Skip  [ ] Decide later

### C2 — Trend load has no `ORDER BY`, so runs aren't reproducible
- **Description:** Trend order changes after edits/VACUUM, and order changes every number in the run. "Same inputs + seed → same result" is currently false.
- **Options:** A) Add `ORDER BY id` to the query.  B) Sort in the engine.  C) Leave it.
- **Recommendation:** **A** (or B — either works; B also protects future callers).
- **Risk of fixing:** Current persisted numbers shift slightly; re-run golden pins + the 50k prod run once and commit new pins.
- [ ] Do it  [ ] Skip  [ ] Decide later

---

## 🟠 High

### H1 — A missing DB driver silently makes a "prod run" write to local SQLite
- **Description:** If `psycopg2` isn't installed, the run falls back to a local file, says "saved", and exits 0 — nothing reaches Neon.
- **Options:** A) Assert Postgres is active + add the driver to dev requirements.  B) Make the DB layer refuse to fall back when a Postgres URL is set.
- **Recommendation:** **A** (and B is a good belt-and-braces addition).
- **Risk of fixing:** None; turns a silent wrong-mode into a loud stop.
- [ ] Do it  [ ] Skip  [ ] Decide later

### H2 — Prod run script hides a save failure and still exits 0
- **Description:** If the Neon write fails, it logs an error but returns success, so cron/operators think it worked.
- **Options:** A) Return a non-zero exit code on persist failure.  B) Leave it.
- **Recommendation:** **A.**
- **Risk of fixing:** None.
- [ ] Do it  [ ] Skip  [ ] Decide later

### H3 — `pulse.ai` package is broken on import (class-name typo)
- **Description:** The "dormant but revivable" AI layer can't actually be imported. Its own docs teach the broken name.
- **Options:** A) Fix the name + add a CI import test.  B) Delete/quarantine the AI layer and drop its unused dependencies.
- **Recommendation:** **B if you don't plan to revive it soon; A if you do.**
- **Risk of fixing:** Low either way. B is cleaner and removes supply-chain surface.
- [ ] Fix (A)  [ ] Delete (B)  [ ] Decide later

### H4 — Confidential decks live in git history
- **Description:** Old CEO briefings and closure docs are recoverable from history on the personal GitHub remote, even though the current tree is clean.
- **Options:** A) Rewrite history to strip them + review GitHub access.  B) Start a fresh repo for handover, archive the old one privately.  C) Leave it.
- **Recommendation:** **B** (less error-prone than a rewrite) — but back up first either way.
- **Risk of fixing:** History rewrite forces everyone to re-clone; needs coordination + a backup. Schedule, don't rush.
- [ ] Rewrite (A)  [ ] Fresh repo (B)  [ ] Skip  [ ] Decide later

### H5 — The governance/audit record isn't in version control
- **Description:** The D1–D21 decision log and findings register — the product's credibility trail — exist only in a gitignored folder, excluded from handover.
- **Options:** A) Commit (redacted) copies under `docs/governance/`.  B) Just fix the doc paths + back up outside the repo.
- **Recommendation:** **A.**
- **Risk of fixing:** Low; mainly deciding what's safe to commit.
- [ ] Do it  [ ] Skip  [ ] Decide later

### H6 — Expert edits can be lost on unmount (with a false "saved" message)
- **Description:** Collapsing a row within ~0.6s of typing cancels the pending autosave, but the UI already shows the value as saved.
- **Options:** A) Flush the save on unmount.  B) Save on blur/collapse instead of a timer.
- **Recommendation:** **A** (simplest); B is also fine.
- **Risk of fixing:** Low — guard against a double-save with a "dirty" flag.
- [ ] Do it  [ ] Skip  [ ] Decide later

---

## 🟡 Medium

### M1 — DB loader invents `gp1 = 10%` for missing values
- **Description:** A missing gp1 value is silently replaced with 10%, defeating the engine's deliberate data-quality stop.
- **Options:** A) Pass missing through so the engine raises.  B) Validate 0–1 at ingestion.
- **Recommendation:** **A.**
- **Risk of fixing:** A prod run will now stop if any trend has a null gp1 — intended; confirm all 99 are populated first.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M2 — Docs promise `seed_stability`; code removed it
- **Description:** A feature described as shipped doesn't exist in the code or types.
- **Options:** A) Re-add it (~5 lines, data already computed).  B) Remove it from the docs.
- **Recommendation:** **A if you want the reassurance metric back; B otherwise.**
- **Risk of fixing:** Low.
- [ ] Re-add (A)  [ ] Doc-only (B)  [ ] Decide later

### M3 — Admin config changes are logged as "system", not the person
- **Description:** The audit can't say who changed the correlation matrix; the identity headers it forwards are also client-spoofable.
- **Options:** A) Log the real user from the verified token + drop the spoofable headers.  B) Leave it.
- **Recommendation:** **A.**
- **Risk of fixing:** Low.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M4 — `/diagnostics` crashes on the outage it's meant to report
- **Description:** A missing import makes the DB-failure branch throw, so the page can't explain a real Neon outage.
- **Options:** A) Add the import + a test.  B) Leave it.
- **Recommendation:** **A.**
- **Risk of fixing:** None.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M5 — The "single-source" guard misses inline copies in its own file
- **Description:** The weighting math is re-implemented three times in one component; the lint guard only catches one style, so they can silently diverge.
- **Options:** A) Consolidate to the shared function + harden the guard.  B) Switch to an ESLint rule.
- **Recommendation:** **A.**
- **Risk of fixing:** Low — confirm the three sites produce identical numbers.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M6 — `updateTrend` silently does nothing when the backend looks offline
- **Description:** "✓ Endorsed" shows even though nothing was written; the offline flag can be up to 60s stale.
- **Options:** A) Throw so the UI shows an error.  B) Drop the guard and let the request fail loudly.
- **Recommendation:** **A.**
- **Risk of fixing:** Low.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M7 — After reconnect, the dashboard doesn't reload; loads can race
- **Description:** UI can read "connected" but empty; a slow load can overwrite a newer one.
- **Options:** A) Reload on reconnect + add request-ordering/abort.  B) Adopt a data-fetching library (SWR/React Query).
- **Recommendation:** **A** now; **B** if you want this class of bug gone app-wide.
- **Risk of fixing:** A is low; B is more churn.
- [ ] Fix (A)  [ ] Library (B)  [ ] Decide later

### M8 — `Trend.impact` is typed as required but never sent — a metric is dead
- **Description:** The Journey "Strength" bar always computes 0 and never renders, because the backend doesn't send the field.
- **Options:** A) Send the field from the backend.  B) Remove the field + dead UI honestly.
- **Recommendation:** **A if "Strength" is wanted; B if not.** Add a contract test either way.
- **Risk of fixing:** Low.
- [ ] Send it (A)  [ ] Remove it (B)  [ ] Decide later

### M9 — CI installs unpinned packages instead of the dev requirements
- **Description:** A new numpy/scipy release can flip golden pins on an unrelated PR; CI ≠ documented dev env.
- **Options:** A) Install from `requirements-dev.txt` + fix the cache key.  B) Add a lock/constraints file.
- **Recommendation:** **A** now; **B** for full reproducibility later.
- **Risk of fixing:** May surface a version that needs pinning — that's the point.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M10 — CI never tests the prod entrypoint or Excel writer
- **Description:** An import-time break in the prod path only appears on run day.
- **Options:** A) Add import + writer round-trip tests, install openpyxl in CI.  B) Add a `--dry-run` mode run in CI.
- **Recommendation:** **A.**
- **Risk of fixing:** Low.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M11 — Serverless runtime ships 3 unused libraries
- **Description:** `aiohttp`, `feedparser`, `requests` have no importers; dead weight + supply-chain surface.
- **Options:** A) Remove all three + preview-deploy to confirm.  B) Leave them.
- **Recommendation:** **A.**
- **Risk of fixing:** Low; a preview deploy confirms.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M12 — Any viewer can write unlimited, permanent snapshots
- **Description:** The lowest-privilege role can fill the Neon table with large blobs.
- **Options:** A) Cap size/count + add retention.  B) Require a higher role.  C) Both.
- **Recommendation:** **C.**
- **Risk of fixing:** Low.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M13 — Time Path lens shows a dead "Total" column of dashes
- **Description:** A totals column renders ~12 em-dashes on the flagship view.
- **Options:** A) Split the totals flags so the empty column is hidden.  B) Fill it with real horizon medians.
- **Recommendation:** **A.**
- **Risk of fixing:** Low; visual only.
- [ ] Hide (A)  [ ] Fill (B)  [ ] Decide later

### M14 — `CLAUDE.md` contradicts the code in several concrete places
- **Description:** Deleted files, moved export modules, missing DB tables/endpoints, unused D3 — the handbook misleads the next engineer (and external reviewers check claims first).
- **Options:** A) One reconciliation pass against the actual tree.  B) Leave it.
- **Recommendation:** **A.**
- **Risk of fixing:** None; docs only, high value.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M15 — The live API reports version 6.0.0
- **Description:** Four different version numbers exist; the API advertises the oldest, wrongest one.
- **Options:** A) One authoritative version constant, others derived from it.  B) Leave it.
- **Recommendation:** **A.**
- **Risk of fixing:** Low.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M16 — Calibration provenance scripts can't run (dead hardcoded path)
- **Description:** The scripts that derive a tracked governance input point at an old sandbox path.
- **Options:** A) Make paths repo-relative.  B) Leave it.
- **Recommendation:** **A.**
- **Risk of fixing:** Low.
- [ ] Do it  [ ] Skip  [ ] Decide later

### M17 — `.env` overrides real shell environment variables
- **Description:** Setting a staging URL on the command line is silently ignored in favour of the `.env` prod value.
- **Options:** A) Stop overriding (dotenv default).  B) Log what got overridden.
- **Recommendation:** **A.**
- **Risk of fixing:** Low; check nothing relied on the file winning.
- [ ] Do it  [ ] Skip  [ ] Decide later

---

## ⚪ Low / hygiene

Grouped so you can bulk-decide. Each is small; the recommendation for almost all is "do it when you're next in that file".

### Correctness / small bugs
- **L1** — `python -m pulse --seeds` crashes (wrong dict key); also hardcodes 2030 + a dead flag. → **Fix.**
- **L2** — One of three matrix-repair sites is silent (no integrity event). → **Emit the event or delete the redundant block.**
- **L3** — Copula tails clipped too aggressively, biasing std/mean inward. → **Clip at float-safety only.**
- **L4** — Compounding has no guard for a factor going ≤ 0. → **Floor it + count affected iterations.**
- **L5** — `fmtShift` can print "-0.0%". → **Normalize to "0.0%"; add a test.**
- **L6** — Drift fingerprint ignores exposure maps / peak-year / curve (a vandal edit reads "no change"). → **Include them.**
- **L7** — Mass trend deletion never raises drift severity. → **Escalate on add/remove.**
- **L8** — Persisted seed is a derived chain seed, not the master 42. → **Persist master + chain seeds.**
- [ ] Do all  [ ] Pick individually (see full review)  [ ] Skip

### Consistency / honest display
- **L9** — Trends table shift numbers render blue, not expansion-green. → **Route through the shared color/component.**
- **L10** — Semantic colors copy-pasted into ~6 components. → **Import from one source; add a hex ban-list.**
- **L11** — Two different force-color palettes render at once. → **Pick one.**
- **L12** — Missing GP1 shown as a fake "10%"; bar drawn at 2× with no axis. → **Show "—"; label or drop the 2×.**
- **L13** — Prod run banner/headline is stale and off-message. → **Derive from MODEL_VERSION; match the product headline.**
- **L14** — Engine docstring overclaims "tail dependence" (Gaussian copula has none). → **Reword.**
- **L15** — "2030" hardcoded in two log strings that are really 2035. → **Interpolate the real year.**
- [ ] Do all  [ ] Pick individually  [ ] Skip

### Accessibility (the uncertainty bands are a governance feature)
- **L16** — P10–P90 bands show on mouse-hover only; invisible to keyboard/screen-reader. → **Add focus handlers + aria labels.**
- **L17** — Three modals behave differently (Escape/focus-trap). → **One shared modal hook.**
- **L18** — Misused ARIA roles on rows/sort/dots. → **Fix per pattern.**
- [ ] Do all  [ ] Pick individually  [ ] Skip

### Repo hygiene
- **L19** — 26 untracked working files in root, one `git add` from handover. → **Ignore or move them.**
- **L20** — 425 KB `.bak` file not ignored. → **Delete; add `*.bak` to gitignore.**
- **L21** — ~200 orphaned git objects ("garbage found"). → **Back up, then `git gc`.**
- **L22** — Secrets stored inside the repo tree + a stale `.env`. → **Move out; prune; revoke dead-feature keys.**
- **L23** — Dead rewrites/excludes/lint-ignores in config. → **Remove at next touch.**
- **L24** — `d3` unused dependency; `@types/node` behind Node version. → **Drop d3; bump types.**
- **L25** — Dead client exports incl. `runSimulation`; no request timeout. → **Delete; add a timeout.**
- **L26** — Tombstone stub files + unused password columns (Clerk owns auth now). → **Remove via migration.**
- [ ] Do all  [ ] Pick individually  [ ] Skip

### Dormant AI layer (only if you keep it — otherwise covered by H3-delete)
- **L27** — The "financial-data firewall" is fake (always returns OK, never called). → **Implement it, or delete the pretend security.**
- **L28** — Prompt-injection / unrestricted fetch in the scanner. → **Delimit + allowlist + size-cap before any revival.**
- [ ] Keep + harden  [ ] Delete layer  [ ] Decide later

### Tests
- **L29** — A vacuous assertion, an unimplemented documented invariant, two identical golden pins, and no test for the headline band. → **Differentiate the fixture; pin the portfolio band + one reconciliation + empty-events.**
- [ ] Do it  [ ] Skip  [ ] Decide later

---

## Fast path if you only do a little

- **Must:** C1, C2.
- **Before next prod run:** H1, H2, M1 (then re-pin + re-run).
- **Cheap + high-credibility:** M2, M4, M14, M15, H3.
- **Schedule with a backup:** H4, H5, L22.
