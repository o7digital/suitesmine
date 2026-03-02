#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-site-mirror/suitesmine.com}"

if [[ ! -d "$ROOT" ]]; then
  echo "Directory not found: $ROOT" >&2
  exit 1
fi

rewrite_text_references() {
  local file="$1"

  STATIC_ROOT="$ROOT" perl -0777 -i -pe '
    our $root = $ENV{"STATIC_ROOT"} // "";

    # Keep only one language tree for static export.
    s{(["\047])\/en\/([^"\047]*)\1}{$1/$2$1}gsi;

    # Replace uploads refs with WebP only when the converted target exists.
    s{(/wp-content/uploads/[^ \t\r\n"<>()\x27]+?)\.(jpe?g|png)}{
      my ($stem, $ext) = ($1, $2);
      my $candidate = "$root$stem.webp";
      -f $candidate ? "$stem.webp" : "$stem.$ext";
    }gsei;
  ' "$file"

  perl -0777 -i -pe '
    # Remove explicit WordPress/Yoast markers and API links.
    s{<!--\s*This site is optimized with the Yoast SEO plugin.*?-->}{}gsi;
    s{<!--\s*/\s*Yoast SEO plugin\.\s*-->}{}gsi;
    s{<link[^>]+(?:oembed|api\.w\.org|xmlrpc\.php\?rsd|wlwmanifest\.xml|EditURI)[^>]*>\s*}{}gsi;
    s{<link[^>]+/wp-json/[^>]*>\s*}{}gsi;
    s{<link[^>]+shortlink[^>]*>\s*}{}gsi;
    s{<link[^>]+(?:/feed/|application/rss\+xml)[^>]*>\s*}{}gsi;
    s{<link[^>]+hreflang=["\047]en["\047][^>]*>\s*}{}gsi;
    s{<meta[^>]+name=["\047]generator["\047][^>]*>\s*}{}gsi;
    s{var\s+wpApiSettings\s*=\s*\{.*?\};\s*}{}gsi;
    s{<script[^>]*>\s*var\s+wcSettings\s*=.*?</script>\s*}{}gsi;
    s{<script[^>]+/wp-admin/[^>]*></script>\s*}{}gsi;
    s{<script[^>]*type=["\047]application/ld\+json["\047][^>]*>.*?</script>\s*}{}gsi;
    s{var\s+wc_add_to_cart_params\s*=\s*\{.*?\};\s*}{var wc_add_to_cart_params = {}; }gsi;
    s{var\s+woocommerce_params\s*=\s*\{.*?\};\s*}{var woocommerce_params = {}; }gsi;
    s{var\s+wc_order_attribution\s*=\s*\{.*?\};\s*}{var wc_order_attribution = {}; }gsi;
    s{var\s+cozystayAjaxNavigation\s*=\s*\{.*?\};\s*}{var cozystayAjaxNavigation = {}; }gsi;
    s{var\s+loftoceanSocialAjax\s*=\s*\{.*?\};\s*}{var loftoceanSocialAjax = {}; }gsi;

    # Make site references local (static clone).
    s{https?://suitesmine\.com/}{/}gsi;
    s{https?:\\\/\\\/suitesmine\.com\\\/}{/}gsi;
    s{/\\&quot;https?://en\.gravatar\.com/\\&quot}{/}gsi;
    s{/wp-admin/admin-ajax\.php}{/api/ajax-disabled}gsi;
    s{\\\/wp-admin\\\/admin-ajax\.php}{/api/ajax-disabled}gsi;
    s{(["\047])/wp-admin/[^"\047]*\1}{$1/$1}gsi;
    s{/admin-disabled/?}{/}gsi;
    s{/xmlrpc\.php}{/api/xmlrpc-disabled}gsi;
    s{\\\/xmlrpc\.php}{/api/xmlrpc-disabled}gsi;

    # Strip cache-busting query strings on static assets.
    s{(/[^ \t\r\n"<>()\x27]+?\.(?:css|js|mjs|json|xml|map|woff2?|ttf|otf|eot|svg|png|jpe?g|gif|webp))(?:\?[^ \t\r\n"<>()\x27]*)}{$1}gsi;
  ' "$file"
}

echo "1/4 Normalize filenames with query strings..."
while IFS= read -r -d '' file_path; do
  dir="$(dirname "$file_path")"
  base="$(basename "$file_path")"
  clean="${base%%\?*}"
  target="$dir/$clean"

  # Nothing to change.
  [[ "$file_path" == "$target" ]] && continue

  if [[ -e "$target" ]]; then
    if cmp -s "$file_path" "$target"; then
      rm -f "$file_path"
    else
      ext="${clean##*.}"
      stem="${clean%.*}"
      hash="$(printf '%s' "$base" | shasum | cut -c1-8)"
      alt="$dir/${stem}.q${hash}.${ext}"
      mv "$file_path" "$alt"
    fi
  else
    mv "$file_path" "$target"
  fi
done < <(find "$ROOT" -type f -name '*\?*' -print0)

echo "2/4 Convert uploads images to WebP..."
converted=0
skipped=0
while IFS= read -r -d '' image; do
  webp="${image%.*}.webp"
  if cwebp -quiet -q 82 "$image" -o "$webp" >/dev/null 2>&1; then
    rm -f "$image"
    converted=$((converted + 1))
    continue
  fi

  # Fallback for files that cwebp cannot parse.
  if magick "$image" -quality 82 "$webp" >/dev/null 2>&1; then
    rm -f "$image"
    converted=$((converted + 1))
    continue
  fi

  rm -f "$webp"
  echo "WARN: cannot convert $image" >&2
  skipped=$((skipped + 1))
done < <(find "$ROOT/wp-content/uploads" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) -print0)
echo "Converted: $converted | Skipped: $skipped"

echo "3/4 Rewrite HTML/CSS/JS references..."
while IFS= read -r -d '' file; do
  rewrite_text_references "$file"
done < <(find "$ROOT" -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" -o -name "*.xml" -o -name "*.txt" -o -name "*.svg" \) -print0)

echo "4/4 Sync root entry page..."
mkdir -p "$ROOT/api"
printf '%s\n' '{"status":"disabled"}' > "$ROOT/api/ajax-disabled"
printf '%s\n' '{"status":"disabled"}' > "$ROOT/api/xmlrpc-disabled"
if [[ -f "$ROOT/index.html" ]]; then
  cp "$ROOT/index.html" "index.html"
fi

echo "Done."
