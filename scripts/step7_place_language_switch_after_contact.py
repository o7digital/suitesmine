#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
from pathlib import Path


ROOT = Path("site-mirror/suitesmine.com")
SKIP_TOP_LEVEL = {"wp-content", "wp-includes", "wp-json"}

LANG_ITEM_BLOCK_RE = re.compile(
    r"\s*<li[^>]*menu-item-language-switch[^>]*>.*?</ul>\s*</li>",
    re.IGNORECASE | re.DOTALL,
)

INLINE_SWITCH_RE = re.compile(
    r"\s*<div class=\"sm-language-switch-right\"[^>]*>.*?</div>",
    re.IGNORECASE | re.DOTALL,
)

STYLE_BLOCK_RE = re.compile(
    r"<style id=\"sm-language-switch-css\"[^>]*>.*?</style>",
    re.IGNORECASE | re.DOTALL,
)

STYLE_BLOCK = """
<style id="sm-language-switch-css" type="text/css">
.sm-language-switch-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 6px;
}
.sm-language-switch-right a {
  color: rgba(255, 255, 255, 0.78);
  text-decoration: none;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 13px;
  line-height: 1;
  padding-bottom: 8px;
  position: relative;
}
.sm-language-switch-right a:hover,
.sm-language-switch-right a:focus {
  color: #fff;
}
.sm-language-switch-right a.is-active {
  color: #fff;
}
.sm-language-switch-right a.is-active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: #fff;
}
.elementor-element-70da6a1 .sm-language-switch-right {
  justify-content: center;
  margin-top: 0;
}
</style>
""".strip()


def is_page_html(path: Path) -> bool:
    if path.suffix.lower() != ".html":
        return False
    rel = path.relative_to(ROOT)
    return bool(rel.parts) and rel.parts[0] not in SKIP_TOP_LEVEL


def to_web_path(rel: Path) -> str:
    if rel.as_posix() == "index.html":
        return "/"
    if rel.name == "index.html":
        return f"/{rel.parent.as_posix()}/"
    return f"/{rel.as_posix()}"


def page_lang_and_paths(rel: Path) -> tuple[str, str, str]:
    if rel.parts and rel.parts[0] == "en":
        locale = "en"
        es_rel = Path(*rel.parts[1:])
    else:
        locale = "es"
        es_rel = rel

    es_path = to_web_path(es_rel)
    en_path = "/en/" if es_path == "/" else f"/en{es_path}"
    return locale, es_path, en_path


def build_switch_markup(locale: str, es_path: str, en_path: str) -> str:
    es_cls = "is-active" if locale == "es" else ""
    en_cls = "is-active" if locale == "en" else ""
    return (
        '<div class="sm-language-switch-right">'
        f'<a class="{es_cls}" href="{es_path}">ES</a>'
        f'<a class="{en_cls}" href="{en_path}">EN</a>'
        "</div>"
    )


def insert_style(html: str) -> str:
    if STYLE_BLOCK_RE.search(html):
        return STYLE_BLOCK_RE.sub(STYLE_BLOCK, html, count=1)
    if "</head>" not in html:
        return html
    return html.replace("</head>", f"{STYLE_BLOCK}\n</head>", 1)


def remove_menu_switch_items(html: str) -> tuple[str, int]:
    updated, removed = LANG_ITEM_BLOCK_RE.subn("", html)
    return updated, removed


def insert_right_switch(html: str, switch_markup: str) -> tuple[str, int]:
    updated = INLINE_SWITCH_RE.sub("", html)
    inserted = 0

    for element_id in ("373d1868", "70da6a1"):
        pattern = re.compile(
            rf'(<div class="elementor-column[^"]*elementor-element-{element_id}[^"]*"[^>]*>\s*'
            r'<div class="elementor-widget-wrap elementor-element-populated">)',
            re.IGNORECASE | re.DOTALL,
        )
        updated, count = pattern.subn(rf"\1\n{switch_markup}", updated, count=1)
        inserted += count

    return updated, inserted


def cleanup_seo_artifacts(html: str) -> tuple[str, int]:
    cleaned = 0
    updated, count_link = re.subn(r"^\s*link\s*$\n?", "", html, flags=re.MULTILINE)
    cleaned += count_link
    updated, count_canon = re.subn(r"^\s*rel=canonical\s*$\n?", "", updated, flags=re.MULTILINE)
    cleaned += count_canon
    return updated, cleaned


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"Missing site root: {ROOT}")

    pages = [p for p in ROOT.rglob("*.html") if is_page_html(p)]
    changed_files = 0
    menu_items_removed = 0
    switch_blocks_inserted = 0
    seo_lines_cleaned = 0

    for page in pages:
        rel = page.relative_to(ROOT)
        locale, es_path, en_path = page_lang_and_paths(rel)
        switch_markup = build_switch_markup(locale, es_path, en_path)

        original = page.read_text(encoding="utf-8", errors="ignore")
        updated = insert_style(original)
        updated, removed_here = remove_menu_switch_items(updated)
        updated, inserted_here = insert_right_switch(updated, switch_markup)
        updated, cleaned_here = cleanup_seo_artifacts(updated)

        if updated != original:
            page.write_text(updated, encoding="utf-8")
            changed_files += 1
        menu_items_removed += removed_here
        switch_blocks_inserted += inserted_here
        seo_lines_cleaned += cleaned_here

    # Keep root entrypoint in sync so local servers and some deployments
    # render the same homepage as the mirrored source.
    shutil.copy2(ROOT / "index.html", Path("index.html"))

    print(f"pages_scanned={len(pages)}")
    print(f"pages_changed={changed_files}")
    print(f"menu_items_removed={menu_items_removed}")
    print(f"switch_blocks_inserted={switch_blocks_inserted}")
    print(f"seo_lines_cleaned={seo_lines_cleaned}")
    print("root_index_synced=index.html")


if __name__ == "__main__":
    main()
