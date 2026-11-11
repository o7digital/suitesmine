export const timeZone = 'America/Mexico_City';

export const labels = {
  es: {
    locale: 'es-MX', intro: 'Suites Mine · Agenda de Ciudad de México',
    title: 'La ciudad tiene un plan para ti.',
    description: 'Conciertos, espectáculos y exposiciones para disfrutar tu estancia cerca de Reforma. Descubre las citas del mes, ordenadas por fecha.',
    order: 'En orden cronológico', timezone: 'Horarios de Ciudad de México. Confirma fechas y disponibilidad con cada organizador.',
    source: 'Información oficial', book: 'Consultar disponibilidad',
    empty: 'Estamos preparando la agenda de este mes. Mientras tanto, descubre nuestras guías de la ciudad o consulta disponibilidad para tu estancia.',
    archive: 'Guías de la ciudad y publicaciones anteriores',
    metaTitle: 'Agenda de eventos en Ciudad de México | Suites Mine',
    metaDescription: 'Consulta la agenda mensual de conciertos, espectáculos y exposiciones de Ciudad de México, con fechas y fuentes oficiales, desde Suites Mine cerca de Reforma.',
  },
  en: {
    locale: 'en-US', intro: 'Suites Mine · Mexico City events',
    title: 'The city has a plan for you.',
    description: 'Concerts, live shows and exhibitions to enjoy during your stay near Reforma. Explore this month’s events, listed in date order.',
    order: 'In date order', timezone: 'All times are in Mexico City time. Confirm dates and availability with each organiser.',
    source: 'Official information', book: 'Check availability',
    empty: 'We are preparing this month’s programme. In the meantime, explore our city guides or check availability for your stay.',
    archive: 'City guides and earlier articles',
    metaTitle: 'Mexico City Events Calendar | Suites Mine',
    metaDescription: 'Discover Mexico City’s monthly programme of concerts, live shows and exhibitions, with dates and official sources, from Suites Mine near Reforma.',
  },
  zh: {
    locale: 'zh-CN', intro: 'Suites Mine · 墨西哥城活动日历',
    title: '精彩城市，等你探索。',
    description: '入住改革大道附近的 Suites Mine，探索音乐会、现场演出与艺术展览。以下活动按日期排列，方便您安排行程。',
    order: '按日期排列', timezone: '所有时间均为墨西哥城当地时间。请通过主办方官方渠道确认日期及余票情况。',
    source: '查看官方信息', book: '查询客房空房情况',
    empty: '本月活动日程正在筹备中。您可以先浏览城市指南，或查询入住期间的客房空房情况。',
    archive: '城市指南与往期文章',
    metaTitle: '墨西哥城活动日历 | Suites Mine',
    metaDescription: '查看墨西哥城每月音乐会、现场演出与艺术展览日程，获取日期和官方信息，从改革大道附近的 Suites Mine 出发探索城市。',
  },
};

export function mexicoMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit',
  }).formatToParts(date);
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}`;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? escapeHtml(value) : '';
  } catch { return ''; }
}

export function monthEvents(data, month) {
  // Never use the last populated month as a fallback: old events must not recur.
  return [...(data.months[month] || [])].sort((left, right) =>
    left.sortDate.localeCompare(right.sortDate) ||
    (left.sortTime || '').localeCompare(right.sortTime || '') || left.id.localeCompare(right.id));
}

export function renderMonth(data, month, language = 'es') {
  const copy = labels[language] || labels.es;
  const events = monthEvents(data, month);
  const heading = new Intl.DateTimeFormat(copy.locale, { year: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${month}-15T12:00:00Z`));
  const local = (value) => escapeHtml(value[language] || value.es);
  return `<div class="sm-month__inner">
    <header class="sm-month__intro">
      <p class="sm-month__eyebrow">${copy.intro}</p>
      <div class="sm-month__heading-row">
        <div><p class="sm-month__period">${escapeHtml(heading)}</p><h2 id="sm-month-title">${copy.title}</h2></div>
        <div><p class="sm-month__description">${copy.description}</p><a class="sm-month__reserve" href="https://hotels.cloudbeds.com/reservation/" target="_blank" rel="noopener noreferrer">${copy.book} <span aria-hidden="true">↗</span></a></div>
      </div>
      <p class="sm-month__order">${copy.order} <span aria-hidden="true">·</span> ${copy.timezone}</p>
    </header>
    ${events.length ? `<div class="sm-month__grid">${events.map((event, index) => {
      const image = safeUrl(event.imageUrl);
      const url = safeUrl(event.url);
      return `<article class="sm-month__event" data-event-id="${escapeHtml(event.id)}" data-start-date="${escapeHtml(event.sortDate)}">
        ${image ? `<div class="sm-month__media"><img src="${image}" alt="${local(event.title)}" loading="${index === 0 ? 'eager' : 'lazy'}" width="720" height="450" /></div>` : ''}
        <div class="sm-month__body"><p class="sm-month__category">${local(event.category)}</p>
          <h3>${local(event.title)}</h3><p class="sm-month__date">${local(event.date)}</p>
          <p class="sm-month__venue">${local(event.venue)}</p><p class="sm-month__summary">${local(event.description)}</p>
          ${url ? `<a class="sm-month__source" href="${url}" target="_blank" rel="noopener noreferrer">${copy.source} <span aria-hidden="true">↗</span></a>` : ''}
        </div>
      </article>`;
    }).join('')}</div>` : `<p class="sm-month__empty">${copy.empty}</p>`}
    <footer class="sm-month__footer"><p><strong>SUITES MINE</strong><br />Río Ebro 64 · Colonia Cuauhtémoc · CDMX</p><a class="sm-month__reserve" href="https://hotels.cloudbeds.com/reservation/" target="_blank" rel="noopener noreferrer">${copy.book} <span aria-hidden="true">↗</span></a></footer>
  </div>`;
}
