#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-site-mirror/suitesmine.com}"
BASE_URL="${2:-https://suitesmine.com}"

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

process_html_file() {
  local file="$1"
  local cpath canon

  cpath="$(canonical_path "$file")"
  canon="${BASE_URL}${cpath}"

  perl -0777 -i -pe '
    # Locale and host cleanup.
    s{<html\s+lang=["\047][^"\047]+["\047]}{<html lang="es-MX"}gsi;
    s{\s-\s+oliviers38\.sg-host\.com}{}gsi;
    s{https?://oliviers38\.sg-host\.com}{https://suitesmine.com}gsi;
    s{oliviers38\.sg-host\.com}{suitesmine.com}gsi;
    s{content=["\047]oliviers38\.sg-host\.com["\047]}{content="Suites Mine"}gsi;

    # Remove Weglot runtime assets/config to avoid dead /en links.
    s{<link[^>]+id=["\047](?:weglot-css-css|new-flag-css-css)["\047][^>]*>\s*}{}gsi;
    s{<script[^>]+id=["\047]wp-weglot-js-js["\047][^>]*></script>\s*}{}gsi;
    s{<script[^>]+id=["\047]weglot-data["\047][^>]*>.*?</script>\s*}{}gsi;
    s{<link[^>]+id=["\047](?:weglot-css-css|new-flag-css-css)["\047][^>]*>\s*}{}gsi;
    s{<script[^>]+/assets/plugins/weglot/[^>]*></script>\s*}{}gsi;
    s{<link[^>]+hreflang=["\047]en["\047][^>]*>\s*}{}gsi;

    # Keep only ES paths.
    s{(["\047])\/en\/([^"\047]*)\1}{$1/$2$1}gsi;
    s{\\\/en\\\/}{/}gsi;

    # Disable ecommerce/account routes in links.
    s{(["\047])/(?:cart|cart-2|checkout|checkout-2|my-account|my-account-2|shop|shop-2)(?:/[^"\047]*)?\1}{$1/contact/$1}gsi;
    s{(["\047])(?:\.\./)+(?:cart|cart-2|checkout|checkout-2|my-account|my-account-2|shop|shop-2)/index\.html(?:#[^"\047]*)?\1}{$1/contact/$1}gsi;
    s{(["\047])/(?:product|wp-admin|wp-login\.php)[^"\047]*\1}{$1/contact/$1}gsi;
    s{(["\047])(?:\.\./)+(?:product|wp-admin|wp-login\.php)[^"\047]*\1}{$1/contact/$1}gsi;

    # Remove Woo runtime scripts/vars to keep vitrines static.
    s{<script[^>]+(?:/wp-content/plugins/woocommerce/|/assets/plugins/woocommerce/)[^>]*></script>\s*}{}gsi;
    s{<script[^>]+id=["\047](?:wc-[^"\047]+|woocommerce[^"\047]*|sourcebuster-js-js)[^>]*>.*?</script>\s*}{}gsi;
    s{<script[^>]*>\s*var\s+wcSettings\s*=.*?</script>\s*}{}gsi;
    s{var\s+wc_add_to_cart_params\s*=\s*\{.*?\};\s*}{}gsi;
    s{var\s+woocommerce_params\s*=\s*\{.*?\};\s*}{}gsi;
    s{var\s+wc_order_attribution\s*=\s*\{.*?\};\s*}{}gsi;
    s{if\s*\(\s*c\s*&&\s*c\.replace\s*\)\s*\{\s*c\s*=\s*c\.replace\(/woocommerce-no-js/,\s*["\047]woocommerce-js["\047]\);\s*\}\s*}{}gsi;
    s{c\s*=\s*c\.replace\(/woocommerce-no-js/,\s*["\047]woocommerce-js["\047]\);\s*}{}gsi;

    # Hide WordPress path signatures from public URLs.
    s{/wp-content/}{/assets/}gsi;
    s{/wp-includes/}{/core/}gsi;
    s{/wp-content\\\/}{/assets\\\/}gsi;
    s{/wp-includes\\\/}{/core\\\/}gsi;
    s{\\\/wp-content\\\/}{/assets/}gsi;
    s{\\\/wp-includes\\\/}{/core/}gsi;

    # Avoid hardcoded production asset hosts so preview/local keep working.
    s{https?://(?:www\.)?suitesmine\.com/assets/}{/assets/}gsi;
    s{https?://(?:www\.)?suitesmine\.com/core/}{/core/}gsi;
    s{https?://(?:www\.)?suitesmine\.com/wp-content/}{/assets/}gsi;
    s{https?://(?:www\.)?suitesmine\.com/wp-includes/}{/core/}gsi;
    s{https:\\/\\/(?:www\\.)?suitesmine\\.com\\/assets\\/}{/assets/}gsi;
    s{https:\\/\\/(?:www\\.)?suitesmine\\.com\\/core\\/}{/core/}gsi;
    s{https:\\/\\/(?:www\\.)?suitesmine\\.com\\/wp-content\\/}{/assets/}gsi;
    s{https:\\/\\/(?:www\\.)?suitesmine\\.com\\/wp-includes\\/}{/core/}gsi;

    # Normalize old demo absolute media links to local mirrored uploads.
    s{https?://cozystay\.loftocean\.com/[^/\s"'"'"']+/assets/uploads/sites/\d+/}{/assets/uploads/}gsi;
    s{https?://cozystay\.loftocean\.com/[^/\s"'"'"']+/wp-content/uploads/sites/\d+/}{/assets/uploads/}gsi;

    # Fallback replacements for missing original demo files.
    s{/assets/uploads/2023/03/img-40\.webp}{/assets/uploads/2023/03/img-35.webp}gsi;
    s{/assets/uploads/2023/04/eaters-collective-ESmxug33C0c-unsplash\.webp}{/assets/uploads/2023/04/content-pixie-9l7r-n1zt-Y-unsplash.webp}gsi;
    s{/assets/uploads/2023/04/le-quan-H2NpsZJe2IA-unsplash-1024x576\.jpg}{/assets/uploads/2023/04/le-quan-H2NpsZJe2IA-unsplash-1024x576.webp}gsi;
    s{/assets/uploads/2023/04/lindsay-cash-Md_DhaFsnCQ-unsplash\.webp}{/assets/uploads/2023/04/content-pixie-9l7r-n1zt-Y-unsplash.webp}gsi;
    s{/assets/uploads/2023/04/tamara-bellis-ZvPoZtY-0ng-unsplash\.webp}{/assets/uploads/2023/04/nati-melnychuk-dFBhXJHKNeo-unsplash-600x900.webp}gsi;
    s{/assets/uploads/2023/05/annie-spratt-l-eemJU0vE-unsplash\.webp}{/assets/uploads/2023/05/r-architecture-wDDfbanbhl8-unsplash.webp}gsi;
    s{/assets/uploads/2023/05/claudio-testa-iqeG5xA96M4-unsplash\.webp}{/assets/uploads/2023/04/toomas-tartes-41gqn1q-tqc-unsplash.webp}gsi;
    s{/assets/uploads/2023/03/img-75-683x1024\.(?:jpg|webp)}{/assets/uploads/2023/04/le-quan-H2NpsZJe2IA-unsplash-1024x576.webp}gsi;

    # Remove wp-* CSS classes to reduce WP fingerprint.
    s{class=(["\047])([^"\047]*)\1}{
      my ($q, $classes) = ($1, $2);
      my @clean = grep {
        $_ ne "" &&
        $_ !~ /^wp-/ &&
        $_ ne "woocommerce-no-js" &&
        $_ ne "woocommerce-js"
      } split(/\s+/, $classes);
      "class=$q" . join(" ", @clean) . "$q";
    }gsei;

    s{\sdata-rsssl=1}{}gsi;
  ' "$file"

  CANON="$canon" perl -0777 -i -pe '
    my $canon = $ENV{"CANON"} // "";
    if ($canon ne "") {
      s{<link\s+rel=["\047]canonical["\047][^>]*>\s*}{}gsi;
      s{<meta\s+property=["\047]og:url["\047][^>]*>\s*}{}gsi;
      s{<meta\s+property=["\047]og:site_name["\047][^>]*>} {<meta property="og:site_name" content="Suites Mine" />}gsi;

      if ($canon =~ /\/$/) {
        s{<title>([^<]*)</title>}{
          "<title>$1</title>\n\t<link rel=\"canonical\" href=\"$canon\" />\n\t<meta property=\"og:url\" content=\"$canon\" />"
        }esi;
      } else {
        s{<title>([^<]*)</title>}{
          "<title>$1</title>\n\t<link rel=\"canonical\" href=\"$canon\" />\n\t<meta property=\"og:url\" content=\"$canon\" />"
        }esi;
      }
    }
  ' "$file"

  perl -0777 -i -pe '
    # Make static booking/search forms point to contact page.
    s{(<form[^>]*class=["\047][^"\047]*cs-form-wrap[^"\047]*["\047][^>]*action=["\047])[^"\047]*(["\047])}{$1/contact/$2}gsi;
    s{(<form[^>]*class=["\047][^"\047]*search-form[^"\047]*["\047][^>]*action=["\047])[^"\047]*(["\047])}{$1/contact/$2}gsi;
    s{(<form[^>]*class=["\047][^"\047]*comment-form[^"\047]*["\047][^>]*action=["\047])[^"\047]*(["\047])}{$1/contact/$2}gsi;
    s{(<form[^>]*id=["\047]commentform["\047][^>]*action=["\047])[^"\047]*(["\047])}{$1/contact/$2}gsi;
    s{action=["\047]/wp-comments-post\.php["\047]}{action="/contact/"}gsi;

    # Fix malformed mirrored links like ".../;".
    s{href=(["\047])([^"\047]*?)/;\1}{href=$1$2/$1}gsi;
  ' "$file"
}

repair_missing_critical_assets() {
  local refs_file missing_count created_count
  local ref rel target dir stem candidate base

  refs_file="$(mktemp)"
  created_count=0

  rg --pcre2 -No --glob '*.html' --no-filename \
    '(?<=\b(?:href|src|data-cs-background-image|content)=["\x27])/assets/uploads/[^"\x27]+' \
    "$ROOT" | sed 's/[?#].*$//' | sort -u > "$refs_file"

  while IFS= read -r ref; do
    rel="${ref#/assets/uploads/}"
    target="$ROOT/wp-content/uploads/$rel"
    [[ -f "$target" ]] && continue

    dir="$(dirname "$rel")"
    stem="$(basename "$rel" .webp)"
    candidate=""

    candidate="$(find "$ROOT/wp-content/uploads/$dir" -maxdepth 1 -type f -name "${stem}-*.webp" 2>/dev/null | head -n 1 || true)"

    if [[ -z "$candidate" && "$stem" == *-scaled ]]; then
      base="${stem%-scaled}"
      candidate="$(find "$ROOT/wp-content/uploads/$dir" -maxdepth 1 -type f \( -name "${base}-*.webp" -o -name "${base}.webp" \) 2>/dev/null | head -n 1 || true)"
    fi

    if [[ -z "$candidate" ]]; then
      candidate="$(find "$ROOT/wp-content/uploads/elementor/thumbs" -type f -name "${stem}-*.webp" 2>/dev/null | head -n 1 || true)"
    fi

    if [[ -z "$candidate" ]]; then
      case "$ref" in
        /assets/uploads/2024/09/Angel-de-la-Independencia.webp)
          candidate="$ROOT/wp-content/uploads/2024/09/Lobby-scaled.webp"
          ;;
        /assets/uploads/2024/09/HSM2-12.webp)
          candidate="$ROOT/wp-content/uploads/2024/09/HSM2-23.webp"
          ;;
        /assets/uploads/2024/10/HSM2-3.webp)
          candidate="$ROOT/wp-content/uploads/2024/10/pexels-leorossatti-2598638-scaled.webp"
          ;;
        /assets/uploads/2024/10/cama-queen-scaled.webp)
          candidate="$ROOT/wp-content/uploads/2024/10/BSM5.webp"
          ;;
      esac
    fi

    if [[ -n "$candidate" && -f "$candidate" ]]; then
      mkdir -p "$(dirname "$target")"
      cp "$candidate" "$target"
      created_count=$((created_count + 1))
    fi
  done < "$refs_file"

  missing_count=0
  while IFS= read -r ref; do
    rel="${ref#/assets/uploads/}"
    target="$ROOT/wp-content/uploads/$rel"
    [[ -f "$target" ]] || missing_count=$((missing_count + 1))
  done < "$refs_file"

  rm -f "$refs_file"
  echo "Repair summary: created=$created_count missing_after=$missing_count"
}

echo "1/4 Process HTML pages for vitrine + de-WP + SEO..."
while IFS= read -r -d '' file; do
  process_html_file "$file"
done < <(find "$ROOT" -type f -name "*.html" -print0)

echo "2/4 Repair missing critical assets..."
repair_missing_critical_assets

echo "3/4 Sync root index..."
cp "$ROOT/index.html" "index.html"

echo "4/4 Done."
