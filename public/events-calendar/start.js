import { mexicoMonth, renderMonth } from './calendar.js';

const root = document.querySelector('[data-events-calendar]');
if (root) {
  let data;
  let updating = false;
  async function refreshMonth() {
    const month = mexicoMonth();
    if (month === root.dataset.month || updating) return;
    updating = true;
    try {
      if (!data) {
        const response = await fetch('/events-calendar/events.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error('Calendar unavailable');
        data = await response.json();
      }
      root.innerHTML = renderMonth(data, month, root.dataset.language);
      root.dataset.month = month;
    } catch {
      // Hide a stale calendar rather than presenting last month's dates as current.
      const { labels } = await import('./calendar.js');
      root.textContent = labels[root.dataset.language]?.empty || labels.es.empty;
    } finally { updating = false; }
  }
  refreshMonth();
  // Also handle a tab left open across midnight at the end of a month.
  window.setInterval(refreshMonth, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshMonth();
  });
  window.addEventListener('pageshow', refreshMonth);
}
