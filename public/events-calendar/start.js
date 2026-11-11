import { mexicoMonth, renderMonth } from './calendar.js';

const root = document.querySelector('[data-events-calendar]');
if (root) {
  let updating = false;
  let approvedMonth = '';
  const show = (month, events) => {
    root.innerHTML = renderMonth({ months: { [month]: events } }, month, root.dataset.language);
    root.dataset.month = month;
  };
  async function refreshMonth() {
    if (updating) return;
    updating = true;
    // A static build may be old. Never leave its expired events visible during a refresh.
    if (!approvedMonth && root.dataset.month !== mexicoMonth()) show(mexicoMonth(), []);
    try {
      const response = await fetch('/api/events-calendar', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Calendar unavailable');
      const feed = await response.json();
      if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(feed.monthKey) || !Array.isArray(feed.events) || typeof feed.available !== 'boolean') throw new Error('Invalid calendar');
      show(feed.monthKey, feed.available ? feed.events : []);
      approvedMonth = feed.monthKey;
    } catch {
      // Keep a current approved version during a temporary outage; expire it at month change.
      if (root.dataset.month !== mexicoMonth()) show(mexicoMonth(), []);
    } finally { updating = false; }
  }
  root.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement) event.target.closest('.sm-month__media')?.setAttribute('hidden', '');
  }, true);
  refreshMonth();
  window.setInterval(refreshMonth, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshMonth(); });
  window.addEventListener('pageshow', refreshMonth);
}
