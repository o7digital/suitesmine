#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-site-mirror/suitesmine.com}"

if [[ ! -d "$ROOT" ]]; then
  echo "missing mirror root: $ROOT" >&2
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

rewrite_html() {
  local file="$1"
  local path
  path="$(canonical_path "$file")"

  PAGE_PATH="$path" perl -0777 -i -pe '
    # Normalize legacy hosts first.
    s{https?://oliviers38\.sg-host\.com/wp-content/}{/assets/}gsi;
    s{https?://oliviers38\.sg-host\.com/wp-includes/}{/core/}gsi;
    s{https?://oliviers38\.sg-host\.com/}{/}gsi;

    # Convert WordPress absolute assets to local static aliases.
    s{https?://(?:www\.)?suitesmine\.com/wp-content/}{/assets/}gsi;
    s{https?://(?:www\.)?suitesmine\.com/wp-includes/}{/core/}gsi;
    s{https:\\\\\\/\\\\\\/(?:www\\.)?suitesmine\\.com\\\\/wp-content\\\\/}{/assets/}gsi;
    s{https:\\\\\\/\\\\\\/(?:www\\.)?suitesmine\\.com\\\\/wp-includes\\\\/}{/core/}gsi;
    s{https:\\\\\\/\\\\\\/oliviers38\\.sg-host\\.com\\\\/wp-content\\\\/}{/assets/}gsi;
    s{https:\\\\\\/\\\\\\/oliviers38\\.sg-host\\.com\\\\/wp-includes\\\\/}{/core/}gsi;

    # Keep local navigation static.
    s{https?://(?:www\.)?suitesmine\.com/}{/}gsi;
    s{https:\\\\\\/\\\\\\/(?:www\\.)?suitesmine\\.com\\\\/}{/}gsi;
    s{https:\\\\\\/\\\\\\/oliviers38\\.sg-host\\.com\\\\/}{/}gsi;

    # Reduce noisy/broken WP runtime integrations for static mode.
    s{<script[^>]+id=["\047]wp-weglot-js-js["\047][^>]*></script>\s*}{}gsi;
    s{<script[^>]+id=["\047]weglot-data["\047][^>]*>.*?</script>\s*}{}gsi;
    s{<link[^>]+id=["\047](?:weglot-css-css|new-flag-css-css)["\047][^>]*>\s*}{}gsi;
    s{<script[^>]+id=["\047]weglot-switcher-[^"\047]+["\047][^>]*></script>\s*}{}gsi;
    s{<script[^>]*>\s*var\s+_paq\s*=\s*window\._paq\s*\|\|\s*\[\];.*?</script>\s*}{}gsi;
    s{<script id=["\047]wp-emoji-settings["\047][^>]*>.*?</script>\s*<script type=["\047]module["\047]>.*?</script>\s*}{}gsi;

    # Force visibility in static mode (animations require WP runtime hooks).
    s{\belementor-invisible\b}{}gsi;

    # Canonical should point to static path.
    my $p = $ENV{"PAGE_PATH"} // "/";
    s{<link\s+rel=["\047]canonical["\047][^>]*>} {<link rel="canonical" href="$p" />}gsei;

    # Ensure language/root metadata is coherent.
    s{<html\s+lang=["\047][^"\047]+["\047]}{<html lang="es-MX"}gsi;
    s{oliviers38\.sg-host\.com}{Suites Mine}gsi;
  ' "$file"
}

append_fallback_script() {
  local file="$1"
  python3 - "$file" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
html = path.read_text(encoding="utf-8", errors="ignore")
marker = 'id="static-fallback-visuals"'
if marker in html:
    sys.exit(0)

snippet = """
<script id="static-fallback-visuals">
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("[data-cs-background-image]").forEach(function (el) {
    var bg = el.getAttribute("data-cs-background-image");
    if (!bg) return;
    var current = (el.style.backgroundImage || "").trim();
    if (!current || current === "none") {
      el.style.backgroundImage = "url('" + bg + "')";
    }
    if (!el.style.backgroundSize) el.style.backgroundSize = "cover";
    if (!el.style.backgroundPosition) el.style.backgroundPosition = "center center";
  });
});
</script>
"""

if "</body>" in html:
    html = html.replace("</body>", snippet + "\n</body>", 1)
else:
    html += snippet
path.write_text(html, encoding="utf-8")
PY
}

normalize_query_filenames() {
  local src clean
  while IFS= read -r -d '' src; do
    clean="${src%%\?*}"
    if [[ "$clean" != "$src" && ! -e "$clean" ]]; then
      mkdir -p "$(dirname "$clean")"
      cp "$src" "$clean"
    fi
  done < <(find "$ROOT/wp-content" "$ROOT/wp-includes" -type f -name '*\?*' -print0)
}

while IFS= read -r -d '' html; do
  rewrite_html "$html"
  append_fallback_script "$html"
done < <(find "$ROOT" -type f -name '*.html' -print0)

# Mirror files were saved with ?ver suffixes in names. Create clean duplicates.
normalize_query_filenames

# Local aliases for static servers (python, Vercel, etc.).
ln -sfn "wp-content" "$ROOT/assets"
ln -sfn "wp-includes" "$ROOT/core"
ln -sfn "$ROOT/wp-content" assets
ln -sfn "$ROOT/wp-includes" core

# Root entrypoint mirrors site root.
cp "$ROOT/index.html" index.html

cat > vercel.json <<'JSON'
{
  "rewrites": [
    {
      "source": "/assets/:path*",
      "destination": "/site-mirror/suitesmine.com/wp-content/:path*"
    },
    {
      "source": "/core/:path*",
      "destination": "/site-mirror/suitesmine.com/wp-includes/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/site-mirror/suitesmine.com/$1"
    }
  ]
}
JSON

echo "step1 complete"
