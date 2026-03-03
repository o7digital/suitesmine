#!/usr/bin/env python3
"""
Cleanup pass for missing JPG/PNG refs in a static mirror.

What it does:
1) Audit all text files for JPG/PNG refs under /assets/uploads (and absolute suitesmine uploads URLs).
2) Recover missing assets from suitesmine.com with conservative fallbacks.
3) Convert recovered JPG/PNG to WebP when missing.
4) Rewrite refs in text files to WebP only when that WebP exists.
5) Emit reports for remaining non-replaceable refs.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import urllib.parse
from collections import defaultdict
from pathlib import Path
from typing import Iterable


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "site-mirror/suitesmine.com")
UPLOADS = ROOT / "wp-content" / "uploads"
BASE_UPLOADS_URL = "https://suitesmine.com/wp-content/uploads/"
REPORT_DIR = Path("scripts/reports")
QUALITY = "82"

TEXT_EXTS = {".html", ".htm", ".css", ".js", ".json", ".xml", ".txt", ".svg"}

# Local and absolute uploads URLs (plain + escaped variants handled in rewrite phase).
LOCAL_JPGPNG_RE = re.compile(
    r"(/assets/uploads/[A-Za-z0-9._~/%:+@,\-]+?\.(?:jpe?g|png))(\?[^\"'\s<)]*)?",
    re.IGNORECASE,
)
ABS_JPGPNG_RE = re.compile(
    r"(https?://(?:www\.)?suitesmine\.com/wp-content/uploads/[A-Za-z0-9._~/%:+@,\-]+?\.(?:jpe?g|png))(\?[^\"'\s<)]*)?",
    re.IGNORECASE,
)
SIZE_SUFFIX_RE = re.compile(r"-\d+x\d+$", re.IGNORECASE)


def run(cmd: list[str], check: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, capture_output=True, check=check)


def iter_text_files() -> Iterable[Path]:
    for p in ROOT.rglob("*"):
        if p.is_file() and p.suffix.lower() in TEXT_EXTS:
            yield p


def safe_rel_uploads_from_url(url: str) -> str | None:
    if url.startswith("/assets/uploads/"):
        rel = url[len("/assets/uploads/") :]
    elif re.match(r"^https?://(?:www\.)?suitesmine\.com/wp-content/uploads/", url, re.I):
        rel = re.sub(
            r"^https?://(?:www\.)?suitesmine\.com/wp-content/uploads/",
            "",
            url,
            flags=re.IGNORECASE,
        )
    else:
        return None
    rel = rel.split("?", 1)[0].split("#", 1)[0]
    return urllib.parse.unquote(rel)


def local_path_for_upload_rel(rel: str) -> Path:
    return UPLOADS / rel


def webp_path_for_upload_rel(rel: str) -> Path:
    return local_path_for_upload_rel(rel).with_suffix(".webp")


def file_is_image(path: Path) -> bool:
    if not path.exists() or path.stat().st_size <= 0:
        return False
    out = run(["file", "-b", str(path)])
    if out.returncode != 0:
        return False
    text = out.stdout
    keys = ("JPEG image data", "PNG image data", "Web/P image", "RIFF (little-endian) data, Web/P")
    return any(k in text for k in keys)


def audit_refs() -> dict[str, set[str]]:
    refs: dict[str, set[str]] = defaultdict(set)
    for p in iter_text_files():
        text = p.read_text(encoding="utf-8", errors="ignore")
        for m in LOCAL_JPGPNG_RE.finditer(text):
            refs[m.group(1).split("?", 1)[0].split("#", 1)[0]].add(str(p.relative_to(ROOT)))
        for m in ABS_JPGPNG_RE.finditer(text):
            refs[m.group(1).split("?", 1)[0].split("#", 1)[0]].add(str(p.relative_to(ROOT)))
    return refs


def candidate_rels(rel: str) -> list[str]:
    p = Path(rel)
    ext = p.suffix.lower()
    stem = p.stem
    parent = p.parent

    # Keep fallback search conservative to avoid very slow network probing.
    out: list[str] = []
    seen = set()

    def add(relpath: str) -> None:
        if relpath not in seen:
            seen.add(relpath)
            out.append(relpath)

    # 1) Exact name + same basename as webp.
    add((parent / f"{stem}{ext}").as_posix())
    add((parent / f"{stem}.webp").as_posix())

    # 2) If "-scaled" variant is missing, try non-scaled counterpart.
    no_scaled = re.sub(r"-scaled$", "", stem, flags=re.IGNORECASE)
    if no_scaled != stem:
        add((parent / f"{no_scaled}{ext}").as_posix())
        add((parent / f"{no_scaled}.webp").as_posix())

    # 3) If size variant is missing, try base counterpart.
    no_size = SIZE_SUFFIX_RE.sub("", stem)
    if no_size != stem:
        add((parent / f"{no_size}{ext}").as_posix())
        add((parent / f"{no_size}.webp").as_posix())

    return out


def fetch_url_to_path(url: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    cmd = [
        "curl",
        "--fail",
        "--location",
        "--silent",
        "--show-error",
        "--max-time",
        "10",
        "--user-agent",
        "Mozilla/5.0 (suitesmine-cleanup)",
        url,
        "-o",
        str(tmp),
    ]
    res = run(cmd)
    if res.returncode != 0 or not tmp.exists() or tmp.stat().st_size == 0:
        tmp.unlink(missing_ok=True)
        return False
    tmp.replace(dest)
    return True


def ensure_webp_from_source(src: Path, webp: Path) -> bool:
    if file_is_image(webp):
        return True
    if not file_is_image(src):
        return False
    webp.parent.mkdir(parents=True, exist_ok=True)
    res = run(
        ["cwebp", "-quiet", "-mt", "-m", "6", "-q", QUALITY, str(src), "-o", str(webp)],
        check=False,
    )
    return res.returncode == 0 and file_is_image(webp)


def upload_url_from_rel(rel: str) -> str:
    quoted = urllib.parse.quote(rel, safe="/%:+@,._~-")
    return BASE_UPLOADS_URL + quoted


def recover_missing_refs(refs: dict[str, set[str]]) -> dict[str, str]:
    outcomes: dict[str, str] = {}
    for ref in sorted(refs):
        rel = safe_rel_uploads_from_url(ref)
        if rel is None:
            outcomes[ref] = "skip_non_upload_url"
            continue

        src = local_path_for_upload_rel(rel)
        webp = webp_path_for_upload_rel(rel)
        if file_is_image(src) or file_is_image(webp):
            outcomes[ref] = "already_present"
            continue

        restored = False
        mode = "unresolved"
        for cand_rel in candidate_rels(rel):
            cand_local = local_path_for_upload_rel(cand_rel)

            # Prefer local mirrors first to avoid network if possible.
            if file_is_image(cand_local):
                if cand_local.suffix.lower() == ".webp":
                    webp.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(cand_local, webp)
                    restored = file_is_image(webp)
                    mode = "reused_local_webp" if restored else mode
                else:
                    src.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(cand_local, src)
                    restored = file_is_image(src)
                    mode = "reused_local_src" if restored else mode
                if restored:
                    break

            # Then try remote candidate.
            url = upload_url_from_rel(cand_rel)
            if cand_local.suffix.lower() == ".webp":
                if fetch_url_to_path(url, webp) and file_is_image(webp):
                    restored = True
                    mode = "downloaded_webp"
                    break
            else:
                if fetch_url_to_path(url, src) and file_is_image(src):
                    restored = True
                    mode = "downloaded_src"
                    break

        # If we got a source, ensure webp pair exists for later rewrite.
        if restored and file_is_image(src):
            ensure_webp_from_source(src, webp)

        outcomes[ref] = mode
    return outcomes


def webp_exists_for_url(url: str) -> bool:
    rel = safe_rel_uploads_from_url(url)
    if rel is None:
        return False
    return file_is_image(webp_path_for_upload_rel(rel))


def to_local_webp_url(url: str) -> str:
    if url.startswith("/assets/uploads/"):
        return re.sub(r"\.(?:jpe?g|png)$", ".webp", url, flags=re.IGNORECASE)
    url2 = re.sub(
        r"^https?://(?:www\.)?suitesmine\.com/wp-content/uploads/",
        "/assets/uploads/",
        url,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\.(?:jpe?g|png)$", ".webp", url2, flags=re.IGNORECASE)


def rewrite_refs_to_webp() -> tuple[int, int]:
    changed_files = 0
    rewrites = 0

    escaped_local_re = re.compile(
        r"(\\/assets\\/uploads\\/[A-Za-z0-9._~/%:+@,\-]+?\.(?:jpe?g|png))(\\?[^\"'\s<)]*)?",
        re.IGNORECASE,
    )
    escaped_abs_re = re.compile(
        r"(https?:\\\\/\\\\/(?:www\\.)?suitesmine\\.com\\\\/wp-content\\\\/uploads\\\\/[A-Za-z0-9._~/%:+@,\-]+?\.(?:jpe?g|png))(\\?[^\"'\s<)]*)?",
        re.IGNORECASE,
    )

    for p in iter_text_files():
        text = p.read_text(encoding="utf-8", errors="ignore")
        original = text
        local_count = 0

        def repl_plain_local(m: re.Match[str]) -> str:
            nonlocal local_count
            path, q = m.group(1), m.group(2) or ""
            if webp_exists_for_url(path):
                local_count += 1
                return to_local_webp_url(path) + q
            return m.group(0)

        def repl_plain_abs(m: re.Match[str]) -> str:
            nonlocal local_count
            path, q = m.group(1), m.group(2) or ""
            if webp_exists_for_url(path):
                local_count += 1
                return to_local_webp_url(path) + q
            return m.group(0)

        def repl_escaped_local(m: re.Match[str]) -> str:
            nonlocal local_count
            esc_path, q = m.group(1), m.group(2) or ""
            path = esc_path.replace("\\/", "/")
            if webp_exists_for_url(path):
                local_count += 1
                return to_local_webp_url(path).replace("/", "\\/") + q
            return m.group(0)

        def repl_escaped_abs(m: re.Match[str]) -> str:
            nonlocal local_count
            esc_path, q = m.group(1), m.group(2) or ""
            # Decode escaped absolute URL into plain absolute.
            path = esc_path.replace("\\/", "/").replace("\\.", ".")
            if webp_exists_for_url(path):
                local_count += 1
                return to_local_webp_url(path).replace("/", "\\/") + q
            return m.group(0)

        text = LOCAL_JPGPNG_RE.sub(repl_plain_local, text)
        text = ABS_JPGPNG_RE.sub(repl_plain_abs, text)
        text = escaped_local_re.sub(repl_escaped_local, text)
        text = escaped_abs_re.sub(repl_escaped_abs, text)

        if text != original:
            p.write_text(text, encoding="utf-8")
            changed_files += 1
            rewrites += local_count

    return changed_files, rewrites


def build_final_report(refs: dict[str, set[str]], recover_outcomes: dict[str, str]) -> dict:
    rows = []
    non_replaceable = []
    for ref in sorted(refs):
        rel = safe_rel_uploads_from_url(ref)
        if rel is None:
            continue
        src = local_path_for_upload_rel(rel)
        webp = webp_path_for_upload_rel(rel)
        src_ok = file_is_image(src)
        webp_ok = file_is_image(webp)
        row = {
            "ref": ref,
            "src": str(src),
            "src_ok": src_ok,
            "webp": str(webp),
            "webp_ok": webp_ok,
            "pages": sorted(refs[ref]),
            "recovery": recover_outcomes.get(ref, "n/a"),
        }
        rows.append(row)
        if not src_ok and not webp_ok:
            non_replaceable.append(row)

    by_page: dict[str, list[str]] = defaultdict(list)
    for row in non_replaceable:
        for page in row["pages"]:
            by_page[page].append(row["ref"])

    return {
        "total_refs": len(rows),
        "non_replaceable_count": len(non_replaceable),
        "non_replaceable_by_page_count": {k: len(v) for k, v in sorted(by_page.items())},
        "rows": rows,
        "non_replaceable": non_replaceable,
    }


def main() -> int:
    if not ROOT.is_dir():
        print(f"Missing mirror root: {ROOT}", file=sys.stderr)
        return 1
    if not UPLOADS.is_dir():
        print(f"Missing uploads dir: {UPLOADS}", file=sys.stderr)
        return 1
    if run(["command", "-v", "cwebp"]).returncode != 0:
        print("Missing cwebp in PATH", file=sys.stderr)
        return 1

    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    refs_before = audit_refs()
    outcomes = recover_missing_refs(refs_before)
    changed_files, rewrites = rewrite_refs_to_webp()
    refs_after = audit_refs()
    final = build_final_report(refs_after, outcomes)

    (REPORT_DIR / "cleanup_missing_images_outcomes.json").write_text(
        json.dumps(outcomes, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (REPORT_DIR / "cleanup_missing_images_final.json").write_text(
        json.dumps(final, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    non_rep_txt = REPORT_DIR / "cleanup_missing_images_non_replaceable.txt"
    lines = []
    for row in final["non_replaceable"]:
        lines.append(
            f"{row['ref']} | pages={','.join(row['pages'])} | recovery={row['recovery']}"
        )
    non_rep_txt.write_text("\n".join(lines), encoding="utf-8")

    print(f"refs_before={len(refs_before)}")
    print(f"rewritten_files={changed_files}")
    print(f"url_rewrites={rewrites}")
    print(f"refs_after={len(refs_after)}")
    print(f"non_replaceable={final['non_replaceable_count']}")
    print(f"report_final={REPORT_DIR / 'cleanup_missing_images_final.json'}")
    print(f"report_non_replaceable={non_rep_txt}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
