#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-site-mirror/suitesmine.com}"

if [[ ! -d "$ROOT" ]]; then
  echo "missing mirror root: $ROOT" >&2
  exit 1
fi

strip_wp_runtime_from_html() {
  local file="$1"

  perl -0777 -i -pe '
    # Remove WooCommerce styles that are not needed for static rendering.
    s{<link[^>]+id=["\047](?:woocommerce-general-css|woocommerce-layout-css|woocommerce-smallscreen-css|cozystay-woocommerce-css|wc-blocks-style-css)["\047][^>]*>\s*}{}gsi;
    s{<style[^>]+id=["\047](?:cozystay-woocommerce-inline-css|woocommerce-inline-inline-css)["\047][^>]*>.*?</style>\s*}{}gsi;

    # Remove WooCommerce scripts and their inline data payloads.
    s{<script[^>]+id=["\047](?:wc-jquery-blockui-js|wc-add-to-cart-js|wc-js-cookie-js|woocommerce-js|sourcebuster-js-js|wc-order-attribution-js)["\047][^>]*></script>\s*}{}gsi;
    s{<script[^>]+id=["\047](?:wc-add-to-cart-js-extra|woocommerce-js-extra|wc-order-attribution-js-extra)["\047][^>]*>.*?</script>\s*}{}gsi;
    s{<script[^>]*>\s*\(\s*function\s*\(\)\s*\{\s*var\s+c\s*=\s*document\.body\.className;.*?woocommerce-no-js.*?\}\)\(\);\s*</script>\s*}{}gsi;
    s{<noscript>\s*<style>\s*\.woocommerce-product-gallery\{\s*opacity:\s*1\s*!important;\s*\}\s*</style>\s*</noscript>\s*}{}gsi;

    # Remove WordPress API/oEmbed runtime links and shortlink metadata.
    s{<link[^>]+title=["\047]oEmbed \(JSON\)["\047][^>]*>\s*}{}gsi;
    s{<link[^>]+title=["\047]oEmbed \(XML\)["\047][^>]*>\s*}{}gsi;
    s{<link[^>]+rel=["\047]https://api\.w\.org/["\047][^>]*>\s*}{}gsi;
    s{<link[^>]+title=["\047]JSON["\047][^>]*href=["\047]/wp-json/[^"\047]*["\047][^>]*>\s*}{}gsi;
    s{<link[^>]+rel=["\047]EditURI["\047][^>]*>\s*}{}gsi;
    s{<link[^>]+rel=["\047]shortlink["\047][^>]*>\s*}{}gsi;
    s{<script[^>]+id=["\047](?:wp-api-request-js-extra|wp-api-request-js|wp-api-js)["\047][^>]*>.*?</script>\s*}{}gsi;
    s{<script[^>]+id=["\047](?:wp-api-request-js|wp-api-js)["\047][^>]*></script>\s*}{}gsi;

    # Remove analytics snippets that cause noisy network errors in static mode.
    s{<script[^>]+src=["\047]https://www\.googletagmanager\.com/gtag/js[^"\047]*["\047][^>]*>\s*</script>\s*}{}gsi;
    s{<script(?![^>]*\bid=)[^>]*>[^<]*window\.dataLayer[^<]*gtag\([^<]*</script>\s*}{}gsi;

    # Keep body classes coherent for static output.
    s{\bwoocommerce-no-js\b}{}gsi;

    # De-duplicate excessive blank lines introduced by removals.
    s{\n{3,}}{\n\n}g;
  ' "$file"
}

while IFS= read -r -d '' html; do
  strip_wp_runtime_from_html "$html"
done < <(find "$ROOT" -type f -name '*.html' -print0)

# Root entrypoint mirrors site root.
cp "$ROOT/index.html" index.html

echo "step2 complete"
