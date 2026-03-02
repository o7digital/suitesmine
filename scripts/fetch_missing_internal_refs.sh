#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-site-mirror/suitesmine.com}"
BASE_URL="${2:-https://suitesmine.com}"
MAX_ROUNDS="${MAX_ROUNDS:-3}"
WORK_DIR="${WORK_DIR:-tmp}"
HAS_CWEBP=0
HAS_MAGICK=0

if [[ ! -d "$ROOT" ]]; then
  echo "Directory not found: $ROOT" >&2
  exit 1
fi

for cmd in rg curl sed sort wc; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
done

if command -v cwebp >/dev/null 2>&1; then
  HAS_CWEBP=1
fi

if command -v magick >/dev/null 2>&1; then
  HAS_MAGICK=1
fi

mkdir -p "$WORK_DIR"

extract_refs() {
  local output_file="$1"
  local raw_file="$WORK_DIR/raw_refs.txt"
  local ref

  : > "$raw_file"
  : > "$output_file"

  rg --no-filename -o "(?:src|href|poster|data-src|data-lazy-src|data-srcset|content)=[\"'][^\"']+[\"']" \
    "$ROOT" -g "*.html" -g "*.css" -g "*.js" -g "*.json" -g "*.xml" -g "*.txt" -g "*.svg" >> "$raw_file" || true

  rg --no-filename -o "url\\([\"']?/[^)\"']+[\"']?\\)" \
    "$ROOT" -g "*.html" -g "*.css" -g "*.js" >> "$raw_file" || true

  while IFS= read -r ref; do
    if [[ "$ref" == url\(* ]]; then
      ref="${ref#url(}"
      ref="${ref%)}"
      ref="${ref#\"}"
      ref="${ref%\"}"
      ref="${ref#\'}"
      ref="${ref%\'}"
    else
      ref="${ref#*=}"
      ref="${ref#\"}"
      ref="${ref%\"}"
      ref="${ref#\'}"
      ref="${ref%\'}"
    fi

    ref="${ref//\\\//\/}"
    ref="${ref//&amp;/&}"
    ref="${ref//\\&quot;/}"
    ref="${ref//&quot;/}"
    ref="${ref%%#*}"
    ref="${ref%%\?*}"
    ref="${ref%%,*}"
    ref="${ref#"${ref%%[![:space:]]*}"}"
    ref="${ref%%[[:space:]]*}"

    [[ -z "$ref" ]] && continue
    [[ "$ref" != /* ]] && continue
    [[ "$ref" == //* ]] && continue
    [[ "$ref" == *"://"* ]] && continue
    [[ "$ref" == *"{"* ]] && continue
    [[ "$ref" == *"}"* ]] && continue
    [[ "$ref" == *"&#"* ]] && continue
    [[ "$ref" == *"&quot;"* ]] && continue
    [[ "$ref" == /xmlrpc.php ]] && continue
    [[ "$ref" == /en/* ]] && continue
    [[ "$ref" == */feed || "$ref" == */feed/ ]] && continue
    [[ "$ref" == /category/dining/ ]] && continue
    [[ "$ref" == /category/news/ ]] && continue
    [[ "$ref" == /category/sightseeing/ ]] && continue
    [[ "$ref" == /category/wellness/ ]] && continue
    [[ "$ref" == /api/* ]] && continue
    [[ "$ref" == /admin-disabled/* ]] && continue

    printf '%s\n' "$ref"
  done < "$raw_file" | sort -u > "$output_file"
}

compute_missing_refs() {
  local refs_file="$1"
  local missing_file="$2"
  local ref
  local target_file

  : > "$missing_file"

  while IFS= read -r ref; do
    if [[ "$ref" == */ || "${ref##*/}" != *.* ]]; then
      target_file="$ROOT${ref%/}/index.html"
    else
      target_file="$ROOT$ref"
    fi

    if [[ ! -f "$target_file" && ! -d "$target_file" ]]; then
      printf '%s\n' "$ref" >> "$missing_file"
    fi
  done < "$refs_file"
}

fetch_ref() {
  local ref="$1"
  local target_file url tmp_file
  local source_ext alt_ref alt_url alt_tmp

  if [[ "$ref" == */ || "${ref##*/}" != *.* ]]; then
    url="${BASE_URL}${ref%/}/"
    target_file="$ROOT${ref%/}/index.html"
  else
    url="${BASE_URL}${ref}"
    target_file="$ROOT$ref"
  fi

  mkdir -p "$(dirname "$target_file")"
  tmp_file="${target_file}.tmp.$$"

  if curl --fail --location --silent --show-error --max-time 30 \
    --user-agent "Mozilla/5.0 (static-clone-fetcher)" \
    "$url" -o "$tmp_file"; then
    if [[ -s "$tmp_file" ]]; then
      mv "$tmp_file" "$target_file"
      return 0
    fi
  fi

  # Fallback: if a WebP is missing remotely, try jpg/jpeg/png and convert.
  if [[ "$ref" == *.webp ]]; then
    for source_ext in jpg jpeg png; do
      alt_ref="${ref%.webp}.${source_ext}"
      alt_url="${BASE_URL}${alt_ref}"
      alt_tmp="${tmp_file}.${source_ext}"

      if curl --fail --location --silent --show-error --max-time 30 \
        --user-agent "Mozilla/5.0 (static-clone-fetcher)" \
        "$alt_url" -o "$alt_tmp"; then
        if [[ -s "$alt_tmp" ]]; then
          if [[ "$HAS_CWEBP" -eq 1 ]] && cwebp -quiet -q 82 "$alt_tmp" -o "$tmp_file" >/dev/null 2>&1; then
            mv "$tmp_file" "$target_file"
            rm -f "$alt_tmp"
            return 0
          fi
          if [[ "$HAS_MAGICK" -eq 1 ]] && magick "$alt_tmp" -quality 82 "$tmp_file" >/dev/null 2>&1; then
            mv "$tmp_file" "$target_file"
            rm -f "$alt_tmp"
            return 0
          fi
        fi
      fi

      rm -f "$alt_tmp"
    done
  fi

  rm -f "$tmp_file"
  return 1
}

total_fetched=0
total_failed=0

for ((round = 1; round <= MAX_ROUNDS; round++)); do
  refs_file="$WORK_DIR/refs_round_${round}.txt"
  missing_file="$WORK_DIR/missing_round_${round}.txt"

  extract_refs "$refs_file"
  compute_missing_refs "$refs_file" "$missing_file"

  missing_count="$(wc -l < "$missing_file" | tr -d ' ')"
  echo "Round $round: missing refs = $missing_count"

  if [[ "$missing_count" -eq 0 ]]; then
    break
  fi

  round_fetched=0
  round_failed=0

  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    if fetch_ref "$ref"; then
      round_fetched=$((round_fetched + 1))
    else
      echo "WARN: failed to fetch $ref" >&2
      round_failed=$((round_failed + 1))
    fi
  done < "$missing_file"

  echo "Round $round: fetched=$round_fetched failed=$round_failed"

  total_fetched=$((total_fetched + round_fetched))
  total_failed=$((total_failed + round_failed))

  if [[ "$round_fetched" -eq 0 ]]; then
    break
  fi
done

echo "Done: fetched=$total_fetched failed=$total_failed"
