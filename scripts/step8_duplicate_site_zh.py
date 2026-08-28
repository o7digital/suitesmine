#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
from pathlib import Path


ROOT = Path("site-mirror/suitesmine.com")
EN_ROOT = ROOT / "en"
ZH_ROOT = ROOT / "zh"


TRANSLATIONS = [
    ("PRIVACY NOTICE", "隐私声明"),
    ("Privacy Notice", "隐私声明"),
    ("Contact us", "联系我们"),
    ("Contact Us", "联系我们"),
    ("Contact", "联系"),
    ("HOME", "首页"),
    ("Home", "首页"),
    ("AMENITIES &amp; SERVICES", "设施与服务"),
    ("Amenities &amp; Services", "设施与服务"),
    ("Amenities & Services", "设施与服务"),
    ("EVENTS", "活动"),
    ("Events & News", "活动与新闻"),
    ("Events", "活动"),
    ("CONTACT", "联系"),
    ("FAQ", "常见问题"),
    ("Rooms", "房间"),
    ("ROOMS", "房间"),
    ("Reservations:", "预订："),
    ("Reservations", "预订"),
    ("Reservation", "预订"),
    ("Call:", "电话："),
    ("Call", "电话"),
    ("Our Address", "我们的地址"),
    ("Our Location", "我们的位置"),
    ("How to get there", "如何到达"),
    ("Spend time with us", "与我们共度美好时光"),
    ("Stay in the heart of CDMX", "入住墨西哥城中心"),
    ("Luxury Apartments with Amenities", "配备完善设施的豪华公寓"),
    ("Choose Your Apartment", "选择您的公寓"),
    ("High standards of hospitality", "高标准待客服务"),
    ("Local Tours & Activities", "当地游览与活动"),
    ("Discover the City", "探索这座城市"),
    ("Discover Mexico City", "探索墨西哥城"),
    ("Explore the latest news, activities, entertainment and events in Mexico City.", "探索墨西哥城最新新闻、活动、娱乐与城市动态。"),
    ("Read More", "阅读更多"),
    ("TIME OUT", "TIME OUT"),
    ("TICKET MASTER", "TICKET MASTER"),
    ("MUSEUMS OF MEXICO", "墨西哥博物馆"),
    ("PYRAMIDS TOUR", "金字塔之旅"),
    ("TURIBUS", "TURIBUS"),
    ("Museums", "博物馆"),
    ("Museum", "博物馆"),
    ("Tourism", "旅游"),
    ("Tours", "游览"),
    ("Restaurants", "餐厅"),
    ("Restaurant", "餐厅"),
    ("Concerts", "音乐会"),
    ("Mar", "3月"),
    ("We strive to offer our guests luxury, comfort, and personalized service.", "我们致力于为客人提供奢华、舒适和个性化服务。"),
    ("Leave your details so we can send you more information.", "留下您的信息，我们会向您发送更多资料。"),
    ("Stay connected:", "保持联系："),
    ("Visit Suites Mine, an apartment-style hotel with 39 suites located two blocks from the Angel of Independence in Colonia Cuauhtemoc, Mexico City.", "欢迎来到 Suites Mine，这是一家公寓式酒店，拥有 39 间套房，位于墨西哥城 Cuauhtemoc 区，距离独立天使纪念碑仅两个街区。"),
    ("Visit us at Suites Mine, an apartment-style hotel with 39 suites located two blocks from the Angel of Independence in Colonia Cuauhtemoc, Mexico City.", "欢迎来到 Suites Mine，这是一家公寓式酒店，拥有 39 间套房，位于墨西哥城 Cuauhtemoc 区，距离独立天使纪念碑仅两个街区。"),
    ("Welcome to Suites Mine", "欢迎来到 Suites Mine"),
    ("Bienvenidos a Suites Mine", "欢迎来到 Suites Mine"),
    ("Tenemos 39 suites de tipo apartamento con Servicio de Hotel Ubicadas a 2 Calles del Ángel de la Independencia, en la Colonia Cuauhtémoc, CDMX.", "我们拥有 39 间公寓式套房，提供酒店式服务，位于墨西哥城 Cuauhtemoc 区，距离独立天使纪念碑仅两个街区。"),
    ("At suitesmine.com, PROMOTORA IRMAN SA DE CV explains how personal data is collected, used, protected and managed under applicable privacy law.", "在 suitesmine.com，PROMOTORA IRMAN SA DE CV 说明我们如何依据适用隐私法规收集、使用、保护和管理个人数据。"),
    ("At suitesmine.com (PROMOTORA IRMAN SA DE CV), we understand the importance of keeping our guests' and clients' personal and sensitive information confidential.", "在 suitesmine.com（PROMOTORA IRMAN SA DE CV），我们理解保护客人和客户个人及敏感信息机密性的重要性。"),
    ("This privacy notice explains how we collect and use personal data.", "本隐私声明说明我们如何收集和使用个人数据。"),
    ("Data collection", "数据收集"),
    ("Use of personal and sensitive information", "个人及敏感信息的使用"),
    ("Data transfer", "数据转移"),
    ("Protection of personal data", "个人数据保护"),
    ("Identity and address of the data controller", "数据控制者身份及地址"),
    ("Means to exercise ARCO rights", "行使 ARCO 权利的方式"),
    ("Modifications to this privacy notice", "隐私声明的修改"),
    ("Data Rights", "数据权利"),
    ("Rights under the GDPR", "GDPR 下的权利"),
    ("Data Protection in Mexico", "墨西哥的数据保护"),
    ("Purpose of the Law", "法律目的"),
    ("Main Elements", "主要要素"),
    ("Principles of Data Processing", "数据处理原则"),
    ("ARCO Rights", "ARCO 权利"),
    ("Supervisory Authority", "监管机构"),
    ("April 2025", "2025年4月"),
    ("Mexico City", "墨西哥城"),
    ("Colonia Cuauhtemoc", "Cuauhtemoc 区"),
    ("Rio Ebro 64", "Rio Ebro 64"),
    ("Mexico", "墨西哥"),
    ("Adults", "成人"),
    ("Adult", "成人"),
    ("Guests", "客人"),
    ("Check In", "入住"),
    ("Check Out", "退房"),
    ("Check-in", "入住"),
    ("Check-out", "退房"),
    ("Book Now", "立即预订"),
    ("Book now", "立即预订"),
    ("View Details", "查看详情"),
    ("View details", "查看详情"),
    ("Details", "详情"),
    ("Search", "搜索"),
    ("Email", "电子邮件"),
    ("Tel:", "电话："),
    ("Phone", "电话"),
    ("Address", "地址"),
    ("Location", "位置"),
    ("Everything at Suites Mine, from its snacks, bar and jacuzzi, are designed to make your stay unforgettable.", "Suites Mine 的小食、酒吧和按摩浴缸等每个细节，都旨在让您的入住难忘。"),
]

POST_REPLACEMENTS = [
    ("套房 Mine", "Suites Mine"),
    ("套房 MINE", "SUITES MINE"),
    ("@type\":\"搜索Action", "@type\":\"SearchAction"),
    ("@type\":\"搜索Action", "@type\":\"SearchAction"),
    ("搜索Action", "SearchAction"),
    ("Registrarse", "登记"),
    ("Verificar", "查询"),
    ("Invitadas", "客人"),
    ("Consultar disponibilidad", "查询可订房"),
    ("Restaurantes", "餐厅"),
    ("Restaurantes", "餐厅"),
    ("Turismo", "旅游"),
    ("Conciertos", "音乐会"),
]


def route_for(path: Path, lang: str) -> str:
    rel = path.relative_to(ROOT)
    parts = list(rel.parts)
    if parts and parts[0] in {"en", "zh"}:
        parts = parts[1:]
    base = Path(*parts) if parts else Path("index.html")
    if base.as_posix() == "index.html":
        suffix = "/"
    elif base.name == "index.html":
        suffix = f"/{base.parent.as_posix()}/"
    else:
        suffix = f"/{base.as_posix()}"
    if lang == "es":
        return suffix
    return f"/{lang}{suffix}" if suffix != "/" else f"/{lang}/"


def update_hreflang(html: str, es: str, en: str, zh: str) -> str:
    html = re.sub(r'<link[^>]+hreflang=["\'](?:es|en|zh-CN|zh)["\'][^>]*>\s*', "", html, flags=re.I)
    insert = (
        f'<link rel="alternate" href="{es}" hreflang="es"/>\n'
        f'<link rel="alternate" href="{en}" hreflang="en"/>\n'
        f'<link rel="alternate" href="{zh}" hreflang="zh-CN"/>\n'
    )
    marker = '<meta name="generator"'
    if marker in html:
        return html.replace(marker, insert + marker, 1)
    return html.replace("</head>", insert + "</head>", 1)


def update_switchers(html: str, es: str, en: str, zh: str, active: str) -> str:
    def cls(lang: str) -> str:
        return ' class="is-active"' if lang == active else ' class=""'

    switch = (
        f'<div class="sm-language-switch-right">'
        f'<a{cls("es")} href="{es}">ES</a>'
        f'<a{cls("en")} href="{en}">EN</a>'
        f'<a{cls("zh")} href="{zh}">中文</a>'
        f'</div>'
    )
    html = re.sub(r'<div class="sm-language-switch-right">.*?</div>', switch, html, flags=re.I | re.S)

    inline = f'<p><a href="{en}">EN</a> / <a href="{es}">ES</a> / <a href="{zh}">中文</a></p>'
    html = re.sub(
        r'<p>\s*<a href="[^"]*">EN</a>\s*/(?:&nbsp;| |\s)*<a href="[^"]*">ES</a>\s*</p>',
        inline,
        html,
        flags=re.I,
    )
    html = re.sub(
        r'<p>\s*<a href="[^"]*">ES</a>\s*/(?:&nbsp;| |\s)*<a href="[^"]*">EN</a>\s*</p>',
        inline,
        html,
        flags=re.I,
    )
    return html


def prepare_zh_html(html: str) -> str:
    html = re.sub(r'(<html[^>]*\blang=["\'])[^"\']+(["\'])', r"\1zh-CN\2", html, flags=re.I)
    html = re.sub(r'(<meta[^>]+property=["\']og:locale["\'][^>]+content=["\'])[^"\']+(["\'])', r"\1zh_CN\2", html, flags=re.I)
    html = html.replace("/en/", "/zh/")
    html = html.replace('content="en-US"', 'content="zh-CN"')
    html = html.replace('"inLanguage":"en-US"', '"inLanguage":"zh-CN"')
    for src, dst in sorted(TRANSLATIONS, key=lambda item: len(item[0]), reverse=True):
        html = html.replace(src, dst)
    for src, dst in POST_REPLACEMENTS:
        html = html.replace(src, dst)
    return html


def update_page(path: Path, active: str, translate: bool = False) -> None:
    es = route_for(path, "es")
    en = route_for(path, "en")
    zh = route_for(path, "zh")
    html = path.read_text(encoding="utf-8", errors="ignore")
    if translate:
        html = prepare_zh_html(html)
    html = update_hreflang(html, es, en, zh)
    html = update_switchers(html, es, en, zh, active)
    path.write_text(html, encoding="utf-8")


def main() -> None:
    if not EN_ROOT.is_dir():
        raise SystemExit(f"Missing English site root: {EN_ROOT}")
    if ZH_ROOT.exists():
        shutil.rmtree(ZH_ROOT)
    shutil.copytree(EN_ROOT, ZH_ROOT)

    for path in ROOT.rglob("index.html"):
        rel = path.relative_to(ROOT)
        if rel.parts and rel.parts[0] in {"wp-content", "wp-includes", "wp-json"}:
            continue
        if rel.parts and rel.parts[0] == "zh":
            update_page(path, "zh", translate=True)
        elif rel.parts and rel.parts[0] == "en":
            update_page(path, "en")
        elif not (rel.parts and rel.parts[0] in {"assets", "core"}):
            update_page(path, "es")

    print(f"generated_zh_pages={sum(1 for _ in ZH_ROOT.rglob('index.html'))}")
    print(f"zh_root={ZH_ROOT}")


if __name__ == "__main__":
    main()
