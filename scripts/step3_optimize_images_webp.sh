#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-site-mirror/suitesmine.com}"
QUALITY="${QUALITY:-82}"

if [[ ! -d "$ROOT" ]]; then
  echo "missing mirror root: $ROOT" >&2
  exit 1
fi

if ! command -v cwebp >/dev/null 2>&1; then
  echo "missing dependency: cwebp" >&2
  exit 1
fi

UPLOADS="$ROOT/wp-content/uploads"
if [[ ! -d "$UPLOADS" ]]; then
  echo "missing uploads directory: $UPLOADS" >&2
  exit 1
fi

converted=0
skipped=0
failed=0

while IFS= read -r -d '' src; do
  dst="${src%.*}.webp"
  if [[ -f "$dst" && "$dst" -nt "$src" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  if cwebp -quiet -mt -m 6 -q "$QUALITY" "$src" -o "$dst"; then
    converted=$((converted + 1))
  else
    failed=$((failed + 1))
  fi
done < <(find "$UPLOADS" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -print0)

python3 - "$ROOT" <<'PY'
import re
import sys
import shutil
from pathlib import Path

root = Path(sys.argv[1])
uploads = root / "wp-content" / "uploads"

plain_pattern = re.compile(
    r'(/assets/uploads/[A-Za-z0-9._~/%:+@,\-]+?\.(?:jpe?g|png))(\?[^"\'\s<)]*)?',
    re.IGNORECASE,
)
escaped_pattern = re.compile(
    r'(\\/assets\\/uploads\\/[A-Za-z0-9._~/%:+@,\-]+?\.(?:jpe?g|png))(\\?[^"\'\s<)]*)?',
    re.IGNORECASE,
)

html_changed = 0
url_rewrites = 0

def webp_exists_from_url(url_path: str) -> bool:
    if not url_path.startswith("/assets/uploads/"):
        return False
    rel = url_path[len("/assets/uploads/") :]
    if "?" in rel:
        rel = rel.split("?", 1)[0]
    src = uploads / rel
    dst = src.with_suffix(".webp")
    return dst.exists()

def to_webp_url(url_path: str) -> str:
    return re.sub(r"\.(?:jpe?g|png)$", ".webp", url_path, flags=re.IGNORECASE)

for html in root.rglob("*.html"):
    text = html.read_text(encoding="utf-8", errors="ignore")
    changed = [False]
    rewritten = [0]

    def repl_plain(m: re.Match[str]) -> str:
        path, query = m.group(1), m.group(2) or ""
        if webp_exists_from_url(path):
            changed[0] = True
            rewritten[0] += 1
            return to_webp_url(path) + query
        return path + query

    out = plain_pattern.sub(repl_plain, text)

    def repl_escaped(m: re.Match[str]) -> str:
        esc_path, query = m.group(1), m.group(2) or ""
        path = esc_path.replace("\\/", "/")
        if webp_exists_from_url(path):
            changed[0] = True
            rewritten[0] += 1
            return to_webp_url(path).replace("/", "\\/") + query
        return esc_path + query

    out = escaped_pattern.sub(repl_escaped, out)

    if changed[0] and out != text:
        url_rewrites += rewritten[0]
        html.write_text(out, encoding="utf-8")
        html_changed += 1

# Keep root entrypoint mirrored.
shutil.copy2(root / "index.html", Path("index.html"))
print(f"html_changed={html_changed}")
print(f"url_rewrites={url_rewrites}")
PY

echo "webp_converted=$converted"
echo "webp_skipped=$skipped"
echo "webp_failed=$failed"
echo "step3 complete"
