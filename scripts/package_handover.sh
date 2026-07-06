#!/usr/bin/env bash
# PRISM — build the DX handover package (H4/R4, owner decision 2026-07-06).
#
# Produces PRISM_HANDOVER_DX_<date>.zip at the repo root: a FRESH-HISTORY
# git repository containing exactly the tracked tree at HEAD.
#
# Why fresh history: the working repo's history (personal GitHub remote)
# still contains confidential strategy decks from before the June 2026
# quarantine. `git archive` exports only tracked content at HEAD, so
# everything gitignored (.env, .clerk/, _NOT_FOR_HANDOVER/, *.db, run
# outputs) is excluded by construction; the re-init gives DX a clean
# history whose first commit is the handover snapshot.
#
# Usage:  bash scripts/package_handover.sh
# Output: PRISM_HANDOVER_DX_YYYY-MM-DD.zip  (gitignored by pattern)
#
# The DATABASE is handed over separately as a pg_dump (see HANDOVER.md §7)
# and every credential is rotated at handover — nothing in this package
# contains a secret (verified below; the build FAILS if that ever changes).
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"
DATE="$(date +%F)"
OUT="PRISM_HANDOVER_DX_${DATE}.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "── PRISM handover packager ──────────────────────────────────"

# 0. Refuse to package uncommitted work.
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree not clean — commit or stash first." >&2
  git status --short >&2
  exit 1
fi
HEAD_SHA="$(git rev-parse --short HEAD)"
echo "Source: $(git rev-parse --abbrev-ref HEAD) @ ${HEAD_SHA}"

# 1. Export exactly the tracked tree at HEAD.
git archive HEAD | tar -x -C "$STAGE"

# 2. Safety gate — the package must contain no secrets and no quarantine.
fail=0
for forbidden in .env .env.deploy .clerk _NOT_FOR_HANDOVER data/prism.db data/pulse.db; do
  if [ -e "$STAGE/$forbidden" ]; then
    echo "ERROR: forbidden path in package: $forbidden" >&2
    fail=1
  fi
done
# Secret-shaped strings anywhere in the exported tree (values, not var names).
if grep -rInE "(sk_(live|test)_[A-Za-z0-9]{8,}|postgres(ql)?://[^ '\"]*:[^ '\"]*@)" "$STAGE" \
     --exclude-dir=.git >/dev/null 2>&1; then
  echo "ERROR: secret-shaped string found in the exported tree:" >&2
  grep -rInE "(sk_(live|test)_[A-Za-z0-9]{8,}|postgres(ql)?://[^ '\"]*:[^ '\"]*@)" "$STAGE" --exclude-dir=.git | head -5 >&2
  fail=1
fi
[ "$fail" -ne 0 ] && exit 1
echo "Safety gate: no secrets, no quarantine, no local databases ✓"

# 3. Fresh history.
(
  cd "$STAGE"
  git init -q -b main
  git add -A
  git -c user.name="PRISM Handover" -c user.email="handover@prism.local" \
      commit -q -m "PRISM handover snapshot ${DATE} (fresh history)

Exported from the owner repository at ${HEAD_SHA}. Full provenance:
docs/governance/ (decision log, findings register, remediation records).
Prior git history is retained privately by the owner — it is not part
of this handover (H4, owner decision 2026-07-06)."
)

# 4. Zip it.
rm -f "$REPO_ROOT/$OUT"
( cd "$STAGE" && zip -qr "$REPO_ROOT/$OUT" . )
SIZE="$(du -h "$REPO_ROOT/$OUT" | cut -f1)"

# 5. Housekeeping on the source repo (L21): prune loose objects.
git gc --quiet || true

echo "──────────────────────────────────────────────────────────────"
echo "Package: $OUT ($SIZE)"
echo "Contents: $(find "$STAGE" -type f ! -path '*/.git/*' | wc -l | tr -d ' ') files, fresh-history git repo (single commit)"
echo
echo "Remaining handover checklist (manual — see HANDOVER.md):"
echo "  1. pg_dump of the Neon database (schema in CLAUDE.md §6)"
echo "  2. Rotate ALL credentials (Clerk, Neon, PRISM_JWT_SECRET, signup code)"
echo "  3. Hand over Vercel/Clerk/Neon accounts or stand up DX-owned ones"
