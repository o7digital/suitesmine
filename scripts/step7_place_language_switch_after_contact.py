#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
from pathlib import Path


ROOT = Path("site-mirror/suitesmine.com")
SKIP_TOP_LEVEL = {"wp-content", "wp-includes", "wp-json"}

PRIMARY_MENU_RE = re.compile(
    r'(<ul[^>]*class="menu primary-menu"[^>]*>)(.*?)(</ul></nav>)',
    re.IGNORECASE | re.DOTALL,
)

STYLE_BLOCK = """
<style id="sm-language-switch-css" type="text/css">
.cs-menu .menu-item-language-switch {
  position: relative;
}
.cs-menu .menu-item-language-switch > a span {
  letter-spacing: 0.14em;
  font-size: 0.9em;
}
.cs-menu .menu-item-language-switch .dropdown-toggle {
  margin-left: 4px;
}
.cs-menu .menu-item-language-switch .sub-menu {
  min-width: 64px;
}
.cs-menu .menu-item-language-switch .sub-menu a {
  padding: 10px 14px;
}
@media (min-width: 1025px) {
  .cs-menu.main-navigation .menu-item-language-switch > .sub-menu {
    background: rgba(9, 10, 13, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
}
/* Hide old, barely visible language widget blocks in header templates. */
.elementor-element-73b67ae,
.elementor-element-3205728c {
  display: none !important;
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


def build_language_item(locale: str, es_path: str, en_path: str) -> str:
    if locale == "en":
        current_label, current_href = "EN", en_path
        alt_label, alt_href = "ES", es_path
    else:
        current_label, current_href = "ES", es_path
        alt_label, alt_href = "EN", en_path

    return (
        '<li class="menu-item menu-item-type-custom menu-item-object-custom '
        'menu-item-has-children menu-item-language-switch">'
        f'<a href="{current_href}"><span>{current_label}</span></a>'
        '<button class="dropdown-toggle" aria-expanded="false">'
        '<span class="screen-reader-text">expand child menu</span></button>'
        '<ul class="sub-menu">'
        '<li class="menu-item menu-item-type-custom menu-item-object-custom">'
        f'<a href="{alt_href}"><span>{alt_label}</span></a></li>'
        "</ul>"
        "</li>"
    )


def insert_style(html: str) -> str:
    if 'id="sm-language-switch-css"' in html:
        return html
    if "</head>" not in html:
        return html
    return html.replace("</head>", f"{STYLE_BLOCK}\n</head>", 1)


def insert_menu_switch(html: str, lang_item: str) -> tuple[str, int]:
    inserted = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal inserted
        opening, body, closing = match.groups()
        if "menu-item-language-switch" in body:
            return match.group(0)
        inserted += 1
        return f"{opening}{body}\n{lang_item}\n{closing}"

    updated = PRIMARY_MENU_RE.sub(repl, html)
    return updated, inserted


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"Missing site root: {ROOT}")

    pages = [p for p in ROOT.rglob("*.html") if is_page_html(p)]
    changed_files = 0
    menus_inserted = 0

    for page in pages:
        rel = page.relative_to(ROOT)
        locale, es_path, en_path = page_lang_and_paths(rel)
        lang_item = build_language_item(locale, es_path, en_path)

        original = page.read_text(encoding="utf-8", errors="ignore")
        updated = insert_style(original)
        updated, inserted_here = insert_menu_switch(updated, lang_item)

        if updated != original:
            page.write_text(updated, encoding="utf-8")
            changed_files += 1
            menus_inserted += inserted_here

    # Keep root entrypoint in sync so local servers and some deployments
    # render the same homepage as the mirrored source.
    shutil.copy2(ROOT / "index.html", Path("index.html"))

    print(f"pages_scanned={len(pages)}")
    print(f"pages_changed={changed_files}")
    print(f"menus_inserted={menus_inserted}")
    print("root_index_synced=index.html")


if __name__ == "__main__":
    main()
