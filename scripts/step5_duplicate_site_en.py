#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
from pathlib import Path


ROOT = Path("site-mirror/suitesmine.com")
EN_ROOT = ROOT / "en"
SKIP_TOP_LEVEL = {"wp-content", "wp-includes", "wp-json", "en"}

TRANSLATIONS = [
    ("Inicio", "Home"),
    ("Amenidades &#038; Servicios", "Amenities &amp; Services"),
    ("Amenidades & Servicios", "Amenities & Services"),
    ("Eventos", "Events"),
    ("Contacto", "Contact"),
    ("PREGUNTAS FRECUENTES", "FAQ"),
    ("Reservaciones:", "Reservations:"),
    ("Alojamineto Extraordinario", "Extraordinary Accommodation"),
    ("Quedate en el centro de CDMX", "Stay in the heart of CDMX"),
    ("Lujosos Apartamentos con Amenidades", "Luxury Apartments with Amenities"),
    ("Elige tu Departamento", "Choose Your Apartment"),
    (
        "Disfruta de la exquisita cocina de todo el mundo",
        "Enjoy exquisite cuisine from around the world",
    ),
    ("Altos estándares de hospitalidad", "High standards of hospitality"),
    (
        "Nos esforzamos por ofrecer a nuestros huéspedes lujo, comodidad y un servicio personalizado.",
        "We strive to offer our guests luxury, comfort, and personalized service.",
    ),
    ("Tours y Actividades Locales", "Local Tours & Activities"),
    ("Descubre la Ciudad", "Discover the City"),
    ("Museo", "Museum"),
    ("Historia", "History"),
    ("Entretenimiento", "Entertainment"),
    ("Manténgase informado con Suites Mine", "Stay informed with Suites Mine"),
    (
        "Deje sus datos para que le hagamos llegar mas informacion.",
        "Leave your details so we can send you more information.",
    ),
    ("Mantente conectado:", "Stay connected:"),
    ("AVISO DE PRIVACIDAD", "PRIVACY NOTICE"),
]


def is_page_html(path: Path) -> bool:
    if path.suffix.lower() != ".html":
        return False
    rel = path.relative_to(ROOT)
    return not rel.parts or rel.parts[0] not in SKIP_TOP_LEVEL


def to_web_path(rel: Path) -> str:
    if rel.as_posix() == "index.html":
        return "/"
    if rel.name == "index.html":
        return f"/{rel.parent.as_posix()}/"
    return f"/{rel.as_posix()}"


def prefix_en(path: str) -> str:
    if not path.startswith("/") or path.startswith("//"):
        return path
    if path == "/":
        return "/en/"
    static_prefixes = (
        "/assets/",
        "/core/",
        "/wp-content/",
        "/wp-includes/",
        "/wp-json/",
        "/api/",
        "/en/",
    )
    if path.startswith(static_prefixes):
        return path
    return f"/en{path}"


def rewrite_absolute_paths(html: str) -> str:
    attr_path_re = re.compile(r'((?:href|src|action|content)=["\'])(/[^"\']*)(["\'])', re.IGNORECASE)

    def repl(match: re.Match[str]) -> str:
        return f"{match.group(1)}{prefix_en(match.group(2))}{match.group(3)}"

    return attr_path_re.sub(repl, html)


def rewrite_lang_switcher(html: str, en_path: str, es_path: str) -> str:
    html = re.sub(
        r'<a\s+href=["\'][^"\']*["\']>\s*EN\s*</a>',
        f'<a href="{en_path}">EN</a>',
        html,
        flags=re.IGNORECASE,
    )
    html = re.sub(
        r'<a\s+href=["\'][^"\']*["\']>\s*ES\s*</a>',
        f'<a href="{es_path}">ES</a>',
        html,
        flags=re.IGNORECASE,
    )

    html = re.sub(
        r'<link[^>]+hreflang=["\']es["\'][^>]*>',
        f'<link rel="alternate" href="{es_path}" hreflang="es"/>',
        html,
        flags=re.IGNORECASE,
    )
    html = re.sub(
        r'<link[^>]+hreflang=["\']en["\'][^>]*>',
        f'<link rel="alternate" href="{en_path}" hreflang="en"/>',
        html,
        flags=re.IGNORECASE,
    )

    return html


def apply_translations(html: str) -> str:
    for src, dst in TRANSLATIONS:
        html = html.replace(src, dst)
    return html


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"Missing site root: {ROOT}")

    if EN_ROOT.exists():
        shutil.rmtree(EN_ROOT)
    EN_ROOT.mkdir(parents=True, exist_ok=True)

    pages = [p for p in ROOT.rglob("*.html") if is_page_html(p)]
    generated = 0
    updated_es = 0

    for src in pages:
        rel = src.relative_to(ROOT)
        web_path = to_web_path(rel)
        en_path = f"/en{web_path}" if web_path != "/" else "/en/"
        es_path = web_path

        # Keep ES pages intact but wire EN/ES links to real paths.
        es_html = src.read_text(encoding="utf-8", errors="ignore")
        es_updated_html = rewrite_lang_switcher(es_html, en_path, es_path)
        if es_updated_html != es_html:
            src.write_text(es_updated_html, encoding="utf-8")
            updated_es += 1

        dst = EN_ROOT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)

        html = es_updated_html

        # Normalize locale to English for EN pages.
        html = re.sub(r'(<html[^>]*\blang=["\'])[^"\']+(["\'])', r"\1en-US\2", html, flags=re.IGNORECASE)
        html = re.sub(r'(<meta[^>]+property=["\']og:locale["\'][^>]+content=["\'])[^"\']+(["\'])', r"\1en_US\2", html, flags=re.IGNORECASE)

        # Prefix absolute internal paths with /en.
        html = rewrite_absolute_paths(html)

        # Page-specific EN/ES links.
        html = rewrite_lang_switcher(html, en_path, es_path)

        # Lightweight text translation for main recurring labels.
        html = apply_translations(html)

        dst.write_text(html, encoding="utf-8")
        generated += 1

    print(f"updated_es_pages={updated_es}")
    print(f"generated_en_pages={generated}")
    print(f"en_root={EN_ROOT}")


if __name__ == "__main__":
    main()
