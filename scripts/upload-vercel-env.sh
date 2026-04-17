#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  PRISM — Vercel env var upload helper
# ─────────────────────────────────────────────────────────────────
#
#  Reads .env.vercel-upload and pushes each KEY=VALUE pair to Vercel
#  for the Production + Preview + Development environments.
#
#  Usage:
#     bash upload-vercel-env.sh                    # all three envs
#     bash upload-vercel-env.sh production         # only production
#     bash upload-vercel-env.sh production preview # two envs
#
#  Prerequisites:
#     1. Vercel CLI installed:  npm i -g vercel
#     2. Logged in:              vercel login
#     3. Project linked:         vercel link   (picks up .vercel/project.json)
#
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.vercel-upload"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found." >&2
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "ERROR: Vercel CLI not found. Install with: npm i -g vercel" >&2
  exit 1
fi

# Which environments to push to
if [[ $# -eq 0 ]]; then
  ENVIRONMENTS=(production preview development)
else
  ENVIRONMENTS=("$@")
fi

echo "Uploading env vars from $ENV_FILE"
echo "Target environments: ${ENVIRONMENTS[*]}"
echo

# Parse the env file: skip comments, blank lines, and empty-value lines
while IFS='=' read -r KEY VALUE; do
  # Trim whitespace
  KEY="$(echo "$KEY" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  # Skip comments and blanks
  [[ -z "$KEY" || "$KEY" =~ ^# ]] && continue
  # Skip empty values (e.g. RESEND_API_KEY= when not set)
  [[ -z "${VALUE:-}" ]] && { echo "SKIP $KEY (empty)"; continue; }

  for ENV_TARGET in "${ENVIRONMENTS[@]}"; do
    echo "→ $KEY  →  $ENV_TARGET"
    # `vercel env add` prompts interactively; pipe value in
    # --force overwrites existing var with the same name
    printf '%s\n' "$VALUE" | vercel env add "$KEY" "$ENV_TARGET" --force 2>&1 | \
      sed 's/^/    /' || echo "    (failed — you may need to 'vercel env rm' first)"
  done
  echo
done < "$ENV_FILE"

echo
echo "Done. Trigger a new deployment for the changes to take effect:"
echo "    vercel --prod"
echo
echo "Then delete this upload file:"
echo "    rm .env.vercel-upload upload-vercel-env.sh"
