#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-site-mirror/suitesmine.com}"
BASE_URL="${2:-https://suitesmine.com}"
OUT_FILE="${3:-sitemap.xml}"
TODAY="$(date +%F)"

if [[ ! -d "$ROOT" ]]; then
  echo "Directory not found: $ROOT" >&2
  exit 1
fi

canonical_path() {
  local file="$1"
  local rel="${file#$ROOT/}"

  if [[ "$rel" == "index.html" ]]; then
    printf "/"
    return
  fi

  if [[ "$rel" == */index.html ]]; then
    printf "/%s/" "${rel%/index.html}"
    return
  fi

  printf "/%s" "$rel"
}

is_excluded() {
  local path="$1"
  case "$path" in
    /cart/|/cart-2/|/checkout/|/checkout-2/|/shop/|/shop-2/|/my-account/|/my-account-2/)
      return 0
      ;;
    /my-account/*|/product/*|/wp-admin/*|/wp-login.php)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  while IFS= read -r -d '' file; do
    path="$(canonical_path "$file")"
    if is_excluded "$path"; then
      continue
    fi

    printf '  <url>\n'
    printf '    <loc>%s%s</loc>\n' "$BASE_URL" "$path"
    printf '    <lastmod>%s</lastmod>\n' "$TODAY"
    printf '  </url>\n'
  done < <(find "$ROOT" -type f -name "*.html" -print0 | sort -z)
  echo '</urlset>'
} > "$OUT_FILE"

echo "Generated $OUT_FILE"
