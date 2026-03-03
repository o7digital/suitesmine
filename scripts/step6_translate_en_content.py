#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import re
import time
from pathlib import Path
from typing import Dict, List, Tuple

from deep_translator import GoogleTranslator
from langdetect import DetectorFactory, LangDetectException, detect


DetectorFactory.seed = 0

EN_ROOT = Path("site-mirror/suitesmine.com/en")
CACHE_PATH = Path("scripts/reports/translation_cache_es_to_en.json")
REPORT_PATH = Path("scripts/reports/translation_report_en.json")

MASK_BLOCK_RE = re.compile(
    r"(<(script|style|noscript|pre|code|svg|textarea)\b[^>]*>.*?</\2>)",
    re.IGNORECASE | re.DOTALL,
)
TEXT_NODE_RE = re.compile(r">([^<>]+)<", re.DOTALL)
ATTR_RE = re.compile(
    r"(\b(?:alt|title|placeholder|aria-label)\s*=\s*)([\"'])(.*?)(\2)",
    re.IGNORECASE | re.DOTALL,
)
META_TAG_RE = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
META_CONTENT_RE = re.compile(r"(\bcontent\s*=\s*)([\"'])(.*?)(\2)", re.IGNORECASE | re.DOTALL)
META_KEY_RE = re.compile(r"\b(?:name|property)\s*=\s*([\"'])(.*?)(\1)", re.IGNORECASE | re.DOTALL)

LETTER_RE = re.compile(r"[A-Za-z\u00C0-\u024F]")
URL_RE = re.compile(r"^(?:https?:)?//|^mailto:|^tel:", re.IGNORECASE)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TOKEN_RE = re.compile(r"^[@#%_:/\-\d\s\.,;|+*()]+$")
SPANISH_HINT_RE = re.compile(
    r"[áéíóúñ¿¡]"
    r"|\b(inicio|amenidades|servicios|eventos|contacto|preguntas|frecuentes|reservaciones|"
    r"alojamiento|quedate|centro|ciudad|lujosos|apartamentos|elige|departamento|disfruta|"
    r"cocina|mundo|altos|estandares|hospitalidad|esforzamos|huespedes|comodidad|servicio|"
    r"personalizado|tours|actividades|descubre|museo|historia|entretenimiento|mantengase|"
    r"informado|deje|datos|informacion|aviso|privacidad|correo|telefono|habitaciones|"
    r"ubicacion|colonia|bar|jacuzzi|terraza|menu|carta|hospedaje|nuestros|sus|mas|"
    r"para|con|sin|del|de|las|los|una|uno|que|como|todo)\b",
    re.IGNORECASE,
)

PROTECTED_SNIPPETS = (
    "rio ebro",
    "río ebro",
    "cuauht",
    "cdmx",
    "suitesmine.com",
    "contacto@suitesmine.com",
)

POST_REPLACEMENTS = {
    "RIVER HEBREW 64, COLONY CUAUHTÉMO": "RIO EBRO 64, COLONIA CUAUHTÉMOC",
    "RIVER HEBREW 64, COLONY CUAUHTEMO": "RIO EBRO 64, COLONIA CUAUHTEMOC",
    "COLONIA CUAUHTÉMO,": "COLONIA CUAUHTÉMOC,",
    "COLONIA CUAUHTEMO,": "COLONIA CUAUHTEMOC,",
    "colony Cuauhtémoc": "Colonia Cuauhtémoc",
    "colony Cuauhtemoc": "Colonia Cuauhtemoc",
    "Rio Ebro 64, Cuauhtémoc neighborhood": "Rio Ebro 64, Colonia Cuauhtémoc",
    "Good luck during vacations and trips": "ENJOY GREAT FOOD DURING VACATIONS AND TRAVEL",
    "Platos - Suites Mine": "Dining - Suites Mine",
    "Conciertos Archives - Suites Mine": "Concerts Archives - Suites Mine",
    "Preguntas Frecuentes - Suites Mine": "FAQ - Suites Mine",
    "Preguntas Frecuentes | Suites Mine": "FAQ | Suites Mine",
}


def load_cache() -> Dict[str, str]:
    if CACHE_PATH.is_file():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: Dict[str, str]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def should_translate(text: str) -> bool:
    s = text.strip()
    if len(s) < 2:
        return False
    s_lower = s.lower()
    if any(snippet in s_lower for snippet in PROTECTED_SNIPPETS):
        return False
    if not LETTER_RE.search(s):
        return False
    if URL_RE.search(s) or EMAIL_RE.match(s):
        return False
    if TOKEN_RE.match(s):
        return False
    if s.upper() in {"EN", "ES"}:
        return False
    if "{{" in s or "}}" in s or "{%" in s or "%}" in s:
        return False
    if SPANISH_HINT_RE.search(s):
        return True
    if len(s) < 18:
        return False
    try:
        lang = detect(s)
    except LangDetectException:
        return False
    return lang in {"es", "pt", "ca", "fr", "it"}


def chunk_text(text: str, max_len: int = 3500) -> List[str]:
    if len(text) <= max_len:
        return [text]
    chunks: List[str] = []
    current = []
    current_len = 0
    for part in re.split(r"(\.\s+)", text):
        if not part:
            continue
        if current_len + len(part) > max_len and current:
            chunks.append("".join(current))
            current = [part]
            current_len = len(part)
        else:
            current.append(part)
            current_len += len(part)
    if current:
        chunks.append("".join(current))
    return chunks


class Translator:
    def __init__(self, cache: Dict[str, str]) -> None:
        self.cache = cache
        self.client = GoogleTranslator(source="auto", target="en")
        self.failures: List[Tuple[str, str]] = []
        self.translated_count = 0

    def translate(self, text: str) -> str:
        key = text
        if key in self.cache:
            return self.cache[key]
        translated = text
        try:
            translated = self._translate_long_text(text)
        except Exception as exc:
            self.failures.append((text[:120], str(exc)))
            translated = text
        self.cache[key] = translated
        if translated != text:
            self.translated_count += 1
        return translated

    def _translate_long_text(self, text: str) -> str:
        parts = chunk_text(text)
        translated_parts = [self._translate_with_retry(part) for part in parts]
        return "".join(translated_parts)

    def _translate_with_retry(self, text: str) -> str:
        last_exc: Exception | None = None
        for wait_seconds in (0.0, 0.4, 1.0):
            if wait_seconds:
                time.sleep(wait_seconds)
            try:
                result = self.client.translate(text)
                if not result:
                    return text
                return result
            except Exception as exc:  # pragma: no cover - network / rate-limit path
                last_exc = exc
        if last_exc is not None:
            raise last_exc
        return text


def mask_blocks(content: str) -> Tuple[str, List[str]]:
    blocks: List[str] = []

    def repl(match: re.Match[str]) -> str:
        blocks.append(match.group(0))
        return f"@@{len(blocks)-1}@@"

    masked = MASK_BLOCK_RE.sub(repl, content)
    return masked, blocks


def unmask_blocks(content: str, blocks: List[str]) -> str:
    output = content
    for idx, block in enumerate(blocks):
        output = output.replace(f"@@{idx}@@", block)
    return output


def translate_meta_tag(tag_html: str, translator: Translator) -> Tuple[str, int]:
    key_match = META_KEY_RE.search(tag_html)
    if not key_match:
        return tag_html, 0
    meta_key = key_match.group(2).strip().lower()
    if not any(k in meta_key for k in ("description", "title", "keywords")):
        return tag_html, 0
    content_match = META_CONTENT_RE.search(tag_html)
    if not content_match:
        return tag_html, 0
    raw_content = html.unescape(content_match.group(3))
    if not should_translate(raw_content):
        return tag_html, 0
    translated = translator.translate(raw_content)
    if translated == raw_content:
        return tag_html, 0
    escaped = html.escape(translated, quote=True)
    updated = META_CONTENT_RE.sub(
        lambda m: f"{m.group(1)}{m.group(2)}{escaped}{m.group(4)}",
        tag_html,
        count=1,
    )
    return updated, 1


def translate_file(path: Path, translator: Translator) -> Dict[str, int]:
    original = path.read_text(encoding="utf-8", errors="ignore")
    masked, blocks = mask_blocks(original)
    stats = {"text_nodes": 0, "attrs": 0, "meta": 0}

    def text_repl(match: re.Match[str]) -> str:
        text = match.group(1)
        lead_len = len(text) - len(text.lstrip())
        tail_len = len(text) - len(text.rstrip())
        core = text[lead_len : len(text) - tail_len if tail_len else len(text)]
        plain_core = html.unescape(core)
        if not should_translate(plain_core):
            return match.group(0)
        translated = translator.translate(plain_core)
        if translated == plain_core:
            return match.group(0)
        escaped = html.escape(translated, quote=False)
        stats["text_nodes"] += 1
        return f">{text[:lead_len]}{escaped}{text[len(text)-tail_len:] if tail_len else ''}<"

    masked = TEXT_NODE_RE.sub(text_repl, masked)

    def attr_repl(match: re.Match[str]) -> str:
        raw_value = html.unescape(match.group(3))
        if not should_translate(raw_value):
            return match.group(0)
        translated = translator.translate(raw_value)
        if translated == raw_value:
            return match.group(0)
        escaped = html.escape(translated, quote=True)
        stats["attrs"] += 1
        return f"{match.group(1)}{match.group(2)}{escaped}{match.group(4)}"

    masked = ATTR_RE.sub(attr_repl, masked)

    def meta_repl(match: re.Match[str]) -> str:
        updated, changed = translate_meta_tag(match.group(0), translator)
        stats["meta"] += changed
        return updated

    masked = META_TAG_RE.sub(meta_repl, masked)
    updated = unmask_blocks(masked, blocks)
    for src, dst in POST_REPLACEMENTS.items():
        updated = updated.replace(src, dst)

    if updated != original:
        path.write_text(updated, encoding="utf-8")
    return stats


def main() -> None:
    if not EN_ROOT.is_dir():
        raise SystemExit(f"Missing EN root: {EN_ROOT}")

    cache = load_cache()
    translator = Translator(cache)
    files = sorted(EN_ROOT.rglob("*.html"))

    totals = {
        "files_total": len(files),
        "files_changed": 0,
        "text_nodes_translated": 0,
        "attributes_translated": 0,
        "meta_fields_translated": 0,
    }

    for idx, file in enumerate(files, start=1):
        file_stats = translate_file(file, translator)
        if any(file_stats.values()):
            totals["files_changed"] += 1
            totals["text_nodes_translated"] += file_stats["text_nodes"]
            totals["attributes_translated"] += file_stats["attrs"]
            totals["meta_fields_translated"] += file_stats["meta"]
        if idx % 10 == 0 or idx == len(files):
            print(
                f"progress={idx}/{len(files)} changed={totals['files_changed']} "
                f"text={totals['text_nodes_translated']} attrs={totals['attributes_translated']} "
                f"meta={totals['meta_fields_translated']}"
            )

    save_cache(cache)
    report = {
        **totals,
        "cache_size": len(cache),
        "cache_path": str(CACHE_PATH),
        "failures_count": len(translator.failures),
        "failures_sample": translator.failures[:20],
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
