import data from '../../public/events-calendar/events.json';
import { labels, mexicoMonth, renderMonth, escapeHtml } from '../../public/events-calendar/calendar.js';
import type { MirrorDocument } from './mirror';

export type BlogLanguage = 'es' | 'en' | 'zh';

function blockEnd(html: string, start: number, tag: string): number {
  const tags = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  tags.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tags.exec(html))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
  throw new Error(`Incomplete blog ${tag} block`);
}

export function withMonthlyAgenda(document: MirrorDocument, language: BlogLanguage, date = new Date()): MirrorDocument {
  const marker = '<section class="elementor-section elementor-top-section elementor-element elementor-element-fe1806c';
  const start = document.bodyInnerHtml.indexOf(marker);
  if (start < 0) throw new Error(`Blog insertion point missing: ${language}`);
  // The original five guides are split across two adjacent layout blocks.
  let end = blockEnd(document.bodyInnerHtml, start, 'section');
  const extra = document.bodyInnerHtml.indexOf('<div class="elementor-element elementor-element-6be5374', end);
  if (extra >= 0 && !document.bodyInnerHtml.slice(end, extra).trim()) {
    end = blockEnd(document.bodyInnerHtml, extra, 'div');
  }
  const month = mexicoMonth(date);
  const copy = labels[language];
  const agenda = `<section id="sm-monthly-agenda" class="sm-month" data-events-calendar data-language="${language}" data-month="${month}" aria-labelledby="sm-month-title">${renderMonth(data, month, language)}</section>`;
  const archive = `<details class="sm-calendar-archive"><summary>${copy.archive}</summary>${document.bodyInnerHtml.slice(start, end)}</details>`;
  const paths = { es: '/our-blog/', en: '/en/our-blog/', zh: '/zh/our-blog/' };
  const head = document.headInnerHtml
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+(?:name="description"|property="og:(?:title|description)")[^>]*>/gi, '')
    .replace(/<link[^>]+rel="alternate"[^>]+hreflang=[^>]*>/gi, '');
  return {
    ...document,
    headInnerHtml: `${head}
      <title>${escapeHtml(copy.metaTitle)}</title>
      <meta name="description" content="${escapeHtml(copy.metaDescription)}" />
      <meta property="og:title" content="${escapeHtml(copy.metaTitle)}" />
      <meta property="og:description" content="${escapeHtml(copy.metaDescription)}" />
      ${Object.entries(paths).map(([lang, path]) => `<link rel="alternate" hreflang="${lang === 'es' ? 'es-MX' : lang === 'zh' ? 'zh-CN' : lang}" href="https://www.suitesmine.com${path}" />`).join('\n')}
      <link rel="alternate" hreflang="x-default" href="https://www.suitesmine.com/our-blog/" />
      <link rel="stylesheet" href="/events-calendar/calendar.css" />
      <script type="module" src="/events-calendar/start.js"></script>`,
    bodyInnerHtml: document.bodyInnerHtml.slice(0, start) + agenda + archive + document.bodyInnerHtml.slice(end),
  };
}
