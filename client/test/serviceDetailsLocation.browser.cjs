// Run: LOCATION_LISTING_BROWSER_TEST=1 TASKGENIE_BROWSER_CHANNEL=chrome node --test test/serviceDetailsLocation.browser.cjs
// All API, location and geocoding responses are synthetic; no booking or external request is made.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('service listing waits for a location and keeps results aligned with current filters', {
  skip: process.env.LOCATION_LISTING_BROWSER_TEST !== '1', timeout: 120000,
}, async t => {
  process.env.VITE_API_URL = '';
  const root = path.resolve(__dirname, '..');
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
  const vite = await createServer({ root, server: { host: '127.0.0.1', port: 0 } });
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const { chromium } = require('playwright');
  let browser;
  t.after(async () => { if (browser) await browser.close(); await vite.close(); });
  browser = await chromium.launch({ headless: true, ...(process.env.TASKGENIE_BROWSER_CHANNEL ? { channel: process.env.TASKGENIE_BROWSER_CHANNEL } : {}) });

  async function fixture() {
    const context = await browser.newContext();
    const page = await context.newPage();
    const requests = [];
    let pending;
    let hold = () => false;
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        getCurrentPosition(success, failure) { window.__geoSuccess = success; window.__geoFailure = failure; },
      }});
    });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/services/v1/')) return route.fulfill({ json: { id: 's1', name: 'Cleaning', description: 'Fixture service' } });
      if (url.pathname === '/api/providers/v1') {
        const query = Object.fromEntries(url.searchParams);
        requests.push(query);
        if (hold(query)) await new Promise(resolve => { pending = resolve; });
        const name = !query.lat ? 'Unfiltered Provider' : query.service === 'plumbing' ? 'Plumbing Provider' : query.lat === '2' ? 'Second Location Provider' : `Radius ${query.radius} Provider`;
        try { await route.fulfill({ json: [{ user_id: name, name, service_id: 's1', price: 100 }] }); } catch { /* An obsolete request may have been aborted. */ }
        return;
      }
      if (url.hostname === 'nominatim.openstreetmap.org' && url.pathname === '/search') return route.fulfill({ json: [{ display_name: 'Second address', lat: '2', lon: '2' }] });
      if (url.hostname === 'nominatim.openstreetmap.org') return route.fulfill({ json: { display_name: 'First address' } });
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    await page.goto(`${origin}/services/cleaning`);
    await page.getByText('Meet the professionals').waitFor();
    return { page, context, requests, hold: fn => { hold = fn; },
      waitForHeld: async () => { for (let i = 0; i < 100 && !pending; i++) await new Promise(resolve => setTimeout(resolve, 20)); assert(pending, 'Expected a held request'); },
      release: () => { pending?.(); pending = null; } };
  }
  async function locate(page, lat = 1) {
    await page.evaluate(value => window.__geoSuccess({ coords: { latitude: value, longitude: value } }), lat);
  }
  async function manualLocation(page) {
    if (!(await page.locator('.sd-location-picker details').evaluate(element => element.open))) await page.locator('.sd-location-picker summary').click();
    await page.getByLabel('Search service address').fill('Second address');
    await page.getByRole('button', { name: 'Find service location' }).click();
    await page.getByRole('button', { name: 'Second address' }).click();
  }

  await t.test('delayed location never requests or displays unfiltered results', async () => {
    const f = await fixture();
    await f.page.waitForTimeout(1200);
    assert.equal(f.requests.length, 0);
    assert.equal(await f.page.locator('article.sd-card').count(), 0);
    assert.equal(await f.page.getByText('Finding providers near your location…').count(), 1);
    await locate(f.page);
    await f.page.getByText('Radius 50 Provider').waitFor();
    assert(f.requests.every(q => q.lat && q.lng && q.radius === '50'));
    assert.equal(await f.page.getByText('Unfiltered Provider').count(), 0);
    await f.context.close();
  });

  for (const [code, message] of [[1, 'Location permission is off'], [3, 'Finding your location timed out']]) {
    await t.test(`location failure ${code} offers retry without an unfiltered request`, async () => {
      const f = await fixture();
      await f.page.evaluate(value => window.__geoFailure({ code: value }), code);
      await f.page.getByText(message).waitFor();
      assert.equal(f.requests.length, 0);
      await f.page.locator('.sd-empty').getByRole('button', { name: 'Try again' }).click();
      await locate(f.page);
      await f.page.getByText('Radius 50 Provider').waitFor();
      assert(f.requests.every(q => q.lat && q.lng));
      await f.context.close();
    });
  }

  await t.test('an unanswered location prompt times out and a late callback is ignored', async () => {
    const f = await fixture();
    await f.page.getByText('Finding your location timed out').waitFor({ timeout: 14000 });
    await locate(f.page);
    await f.page.waitForTimeout(100);
    assert.equal(f.requests.length, 0);
    assert.equal(await f.page.locator('article.sd-card').count(), 0);
    await f.context.close();
  });

  await t.test('a manually selected address recovers from denied permission', async () => {
    const f = await fixture();
    await f.page.evaluate(() => window.__geoFailure({ code: 1 }));
    await f.page.getByText('Location permission is off').waitFor();
    await manualLocation(f.page);
    await f.page.getByText('Second Location Provider').waitFor();
    assert(f.requests.every(q => q.lat && q.lng));
    await f.context.close();
  });

  await t.test('changing service hides old results and ignores an older request', async () => {
    const f = await fixture();
    f.hold(q => q.service === 'cleaning');
    const firstRequest = f.page.waitForRequest(request => new URL(request.url()).searchParams.get('service') === 'cleaning');
    await locate(f.page);
    await firstRequest;
    await f.waitForHeld();
    await f.page.evaluate(() => { history.pushState({}, '', '/services/plumbing'); dispatchEvent(new PopStateEvent('popstate')); });
    await f.page.getByText('Plumbing Provider').waitFor();
    f.release();
    await f.page.waitForTimeout(250);
    assert.equal(await f.page.getByText('Radius 50 Provider').count(), 0);
    assert.equal(await f.page.getByText('Plumbing Provider').count(), 1);
    await f.context.close();
  });

  await t.test('an old location response cannot replace a manually selected location', async () => {
    const f = await fixture();
    f.hold(q => q.lat === '1');
    const firstRequest = f.page.waitForRequest(request => new URL(request.url()).pathname === '/api/providers/v1');
    await locate(f.page);
    await firstRequest;
    await f.waitForHeld();
    await manualLocation(f.page);
    await f.page.getByText('Second Location Provider').waitFor();
    f.release();
    await f.page.waitForTimeout(250);
    assert.equal(await f.page.getByText('Radius 50 Provider').count(), 0);
    assert.equal(await f.page.getByText('Second Location Provider').count(), 1);
    assert(f.requests.every(q => q.lat && q.lng));
    await f.context.close();
  });

  await t.test('rapid radius changes hide old results and keep the chosen radius after location changes', async () => {
    const f = await fixture();
    await locate(f.page);
    await f.page.getByText('Radius 50 Provider').waitFor();
    f.hold(q => q.radius === '100');
    const intermediateRequest = f.page.waitForRequest(request => new URL(request.url()).searchParams.get('radius') === '100');
    await f.page.getByLabel('Search radius').selectOption('100');
    assert.equal(await f.page.getByText('Radius 50 Provider').count(), 0);
    await intermediateRequest;
    await f.waitForHeld();
    await f.page.getByLabel('Search radius').selectOption('25');
    await f.page.getByText('Radius 25 Provider').waitFor();
    f.release();
    await f.page.waitForTimeout(250);
    assert.equal(await f.page.getByText('Radius 100 Provider').count(), 0);
    f.hold(q => q.lat === '2');
    const locationRequest = f.page.waitForRequest(request => new URL(request.url()).searchParams.get('lat') === '2');
    await manualLocation(f.page);
    assert.equal(await f.page.getByText('Radius 25 Provider').count(), 0);
    await locationRequest;
    await f.waitForHeld();
    f.release();
    await f.page.getByText('Second Location Provider').waitFor();
    assert.equal(await f.page.getByLabel('Search radius').inputValue(), '25');
    await manualLocation(f.page);
    assert.equal(await f.page.getByText('Second Location Provider').count(), 1);
    assert(f.requests.every(q => q.lat && q.lng));
    await f.context.close();
  });
});
