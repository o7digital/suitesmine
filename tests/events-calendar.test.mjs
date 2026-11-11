import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mexicoMonth, monthEvents, renderMonth } from '../public/events-calendar/calendar.js';

const data = JSON.parse(readFileSync(new URL('../public/events-calendar/events.json', import.meta.url)));

test('switches months at Mexico City midnight, including the new year', () => {
  assert.equal(mexicoMonth(new Date('2026-12-01T05:59:59Z')), '2026-11');
  assert.equal(mexicoMonth(new Date('2026-12-01T06:00:00Z')), '2026-12');
  assert.equal(mexicoMonth(new Date('2027-01-01T05:59:59Z')), '2026-12');
  assert.equal(mexicoMonth(new Date('2027-01-01T06:00:00Z')), '2027-01');
});

test('shows only November now, including both Estadio GNP events', () => {
  const html = renderMonth(data, '2026-11', 'es');
  assert.equal((html.match(/<article /g) || []).length, 12);
  assert.match(html, /Karol G/);
  assert.match(html, /Los Auténticos Caligaris/);
  assert.doesNotMatch(html, /Bruno Mars|The Warning|Maroon 5|U2/);
});

test('every prepared month is chronological and fully translated', () => {
  for (const [month, events] of Object.entries(data.months)) {
    const dates = monthEvents(data, month).map((event) => `${event.sortDate} ${event.sortTime || ''}`);
    assert.deepEqual(dates, [...dates].sort());
    assert.equal(new Set(events.map((event) => event.id)).size, events.length);
    for (const language of ['es', 'en', 'zh']) {
      assert.equal((renderMonth(data, month, language).match(/<article /g) || []).length, events.length);
      for (const event of events) {
        assert.ok(event.sortDate.startsWith(month));
        for (const field of ['title', 'description', 'date', 'category', 'venue']) {
          assert.ok(event[field][language], `${event.id}: ${language} ${field}`);
        }
      }
    }
  }
});

test('sorts events on the same day by their announced start time', () => {
  const events = monthEvents(data, '2026-11');
  assert.ok(events.findIndex((event) => event.id === 'majo-aguilar-noviembre') <
    events.findIndex((event) => event.id === 'karol-g-noviembre'));
});

test('never falls back to an expired month when no new programme exists', () => {
  assert.deepEqual(monthEvents(data, '2027-03'), []);
  assert.doesNotMatch(renderMonth(data, '2027-03', 'en'), /<article /);
  assert.match(renderMonth(data, '2027-03', 'en'), /preparing this month/);
});

test('escapes editorial HTML and rejects unsafe links', () => {
  const malicious = structuredClone(data);
  const event = malicious.months['2026-11'][0];
  event.title.es = '<script>alert(1)</script>';
  event.url = 'javascript:alert(1)';
  const html = renderMonth(malicious, '2026-11', 'es');
  assert.doesNotMatch(html, /<script>|javascript:/);
  assert.match(html, /&lt;script&gt;/);
});
