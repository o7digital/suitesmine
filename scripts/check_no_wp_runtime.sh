#!/usr/bin/env bash
set -euo pipefail

# Runtime WordPress patterns that must not leak into the detached static app.
PATTERN='wp-admin|admin-ajax|wp-json|https://api\.w\.org|elementorFrontendConfig|cozystayAjaxNavigation|loftoceanSocialAjax'

TARGETS=(
  "src"
  "public"
  "index.html"
)

if rg -n -S -e "$PATTERN" "${TARGETS[@]}" -g '!src/lib/mirror.ts'; then
  echo ""
  echo "detach check failed: WordPress runtime references found"
  exit 1
fi

echo "detach check passed"
