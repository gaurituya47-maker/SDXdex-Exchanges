#!/usr/bin/env bash
set -euo pipefail

# Usage:
# Export the secrets in your shell, then run this script from the repo root.
# Example:
# export MAINNET_RPC_URL="https://..."
# export PRIVATE_KEY="0x..."
# ./scripts/set_github_secrets.sh owner repo

OWNER=${1:-}
REPO=${2:-}

if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
  echo "Usage: $0 <owner> <repo>" >&2
  exit 2
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install from https://cli.github.com/" >&2
  exit 3
fi

echo "Ensure you're authenticated with 'gh auth login' and have repo admin access."

set_secret() {
  local name="$1"
  local val="${!1:-}"
  if [ -z "$val" ]; then
    echo "Skipping $name (env var not set)"
    return
  fi
  echo "Setting secret $name..."
  printf '%s' "$val" | gh secret set "$name" --repo "$OWNER/$REPO" --body -
}

SECRETS=(
  MAINNET_RPC_URL
  PRIVATE_KEY
  ETHERSCAN_API_KEY
  VERCEL_TOKEN
  ORG_ID
  PROJECT_ID
  RENDER_API_KEY
  RENDER_SERVICE_ID
)

for s in "${SECRETS[@]}"; do
  set_secret "$s"
done

echo "Done. Verify in https://github.com/$OWNER/$REPO/settings/secrets/actions"
