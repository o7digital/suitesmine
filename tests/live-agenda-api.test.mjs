import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler from '../api/events-calendar.mjs';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
function response() { return { headers: {}, statusCode: 0, setHeader(k,v) { this.headers[k] = v; return this; }, status(s) { this.statusCode = s; return this; }, json(body) { this.body = body; return this; } }; }
const site = 'suitesmine';
test('fixed hotel feed ignores user URL/month and sends no credentials', async () => {
  let request;
  globalThis.fetch = async (url, options) => { request = { url, options }; return Response.json({ siteKey: site, monthKey: '2027-03', available: true, events: [{ id: 'new-month' }] }); };
  const res = response();
  await handler({ method: 'GET', query: { month: '2099-12', url: 'https://evil.test' } }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.match(request.url, /^https:\/\/api-suitesmine-production.up.railway.app\/api\/public\/website-agendas\/[a-f0-9-]+\/current$/);
  assert.equal(request.options.headers.Authorization, undefined);
  assert.deepEqual(res.body, { monthKey: '2027-03', available: true, events: [{ id: 'new-month' }] });
});
test('unapproved month exposes no events', async () => {
  globalThis.fetch = async () => Response.json({ siteKey: site, monthKey: '2027-04', available: false, events: [{ id: 'private' }] });
  const res = response(); await handler({ method: 'GET' }, res);
  assert.deepEqual(res.body.events, []);
});
test('fails closed for another hotel or a failed upstream and rejects writes', async () => {
  for (const upstream of [Response.json({ siteKey: 'other', monthKey: '2027-03', available: true, events: [] }), new Response('Failed', { status: 503 })]) {
    globalThis.fetch = async () => upstream; const res = response(); await handler({ method: 'GET' }, res); assert.equal(res.statusCode, 503);
  }
  const res = response(); await handler({ method: 'POST' }, res); assert.equal(res.statusCode, 405);
});
