#!/usr/bin/env bash
# Build a handover archive: PRISM_HANDOVER_<date>.zip at the repository root,
# holding a git repository with a single commit of the tracked tree at HEAD.
#
# `git archive` exports tracked files only, so .env, .clerk/, local databases,
# workbooks and run outputs never reach the archive. A tracked file is
# exported even if a later .gitignore rule matches it, so the safety gate
# below checks the exported tree itself: forbidden paths and secret-shaped
# strings stop the build. The database is handed over separately (pg_dump),
# and every credential is rotated at handover.
#
# Usage: bash scripts/package_handover.sh
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"
DATE="$(date +%F)"
OUT="PRISM_HANDOVER_${DATE}.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

if [ -n "$(git status --porcelain)" ]; then
  echo "The working tree has uncommitted changes; commit or stash them first." >&2
  git status --short >&2
  exit 1
fi
HEAD_SHA="$(git rev-parse --short HEAD)"
echo "Packaging $(git rev-parse --abbrev-ref HEAD) at ${HEAD_SHA}"

git archive HEAD | tar -x -C "$STAGE"

fail=0
# Any .env file but the example, anywhere in the tree (.gitignore keeps them
# out at every depth).
while IFS= read -r path; do
  echo "Forbidden file in the archive: ${path#"$STAGE"/}" >&2
  fail=1
done < <(find "$STAGE" -name '.env*' ! -path "$STAGE/.env.example")
# Local state: at the root, Clerk's folder and the local working folders (a
# leading underscore); anywhere in the tree, the folders .gitignore keeps out
# at every depth (run outputs and migration archives), database files, dumps
# and workbooks, which can hold confidential figures or personal data.
for path in "$STAGE"/.clerk "$STAGE"/_*; do
  [ -e "$path" ] || continue
  echo "Forbidden path in the archive: ${path#"$STAGE"/}" >&2
  fail=1
done
while IFS= read -r path; do
  echo "Forbidden folder in the archive: ${path#"$STAGE"/}" >&2
  fail=1
done < <(find "$STAGE" -type d \( -name runs -o -name archive \))
while IFS= read -r path; do
  echo "Forbidden file in the archive: ${path#"$STAGE"/}" >&2
  fail=1
done < <(find "$STAGE" -type f \( -name '*.db' -o -name '*.db-*' -o -name '*.sqlite' -o -name '*.sqlite3' \
                                  -o -name '*.dump' -o -name '*.xlsx' \))
# A Clerk secret key or webhook secret, a value assigned to one of PRISM's
# secrets (the token secret, the bootstrap secret), or a connection string
# with a password. The test database on localhost (CI and docs/OPERATIONS.md)
# is not a secret. Each match is checked on its own, so a local URL cannot hide
# a real one on the same line.
SECRET_PATTERN="(sk_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9+/=]{16,}|(PRISM_JWT_SECRET|ADMIN_BOOTSTRAP_SECRET|CLERK_SECRET_KEY|CLERK_WEBHOOK_SIGNING_SECRET)[\"']?[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9_+/=-]{16,}|postgres(ql)?://[^ '\"]*:[^ '\"]*@[^ '\"/:?]*)"
LOCAL_DATABASE="@(localhost|127\.0\.0\.1)$"
hits="$(grep -rIonE "$SECRET_PATTERN" "$STAGE" | grep -vE "$LOCAL_DATABASE" || true)"
if [ -n "$hits" ]; then
  echo "Secret-shaped strings in the exported tree (file:line; the strings are not printed):" >&2
  echo "$hits" | sed -E 's/^([^:]+:[0-9]+):.*/\1/' | sed "s|^$STAGE/||" | sort -u | head -10 >&2
  fail=1
fi
[ "$fail" -ne 0 ] && exit 1
echo "Safety check passed: no secrets, no local databases, dumps or workbooks, no run outputs"

(
  cd "$STAGE"
  git init -q -b main
  git add -A
  git -c user.name="PRISM Handover" -c user.email="handover@prism.local" \
      commit -q -m "PRISM ${DATE}"
)

rm -f "$REPO_ROOT/$OUT"
( cd "$STAGE" && zip -qr "$REPO_ROOT/$OUT" . )
echo "Wrote $OUT from ${HEAD_SHA} ($(du -h "$REPO_ROOT/$OUT" | cut -f1), $(find "$STAGE" -type f ! -path '*/.git/*' | wc -l | tr -d ' ') files)"
echo "Still to do by hand: pg_dump of the database, rotation of every credential (docs/OPERATIONS.md)."
