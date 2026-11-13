// Opt-in: SUPPORT_KYC_BROWSER_TEST=1 TASKGENIE_BROWSER_CHANNEL=chrome node --test test/kycSupport.browser.cjs
// Browser requests use fixtures only, never real KYC documents or external services.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('support and KYC browser workflows with isolated fixtures', { skip: process.env.SUPPORT_KYC_BROWSER_TEST !== '1', timeout: 120000 }, async t => {
  process.env.VITE_API_URL = '';
  const root = path.resolve(__dirname, '..');
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
  const vite = await createServer({ root, server: { host: '127.0.0.1', port: 0 } }); await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, ...(process.env.TASKGENIE_BROWSER_CHANNEL ? { channel: process.env.TASKGENIE_BROWSER_CHANNEL } : {}) });
  t.after(async () => { await browser.close(); await vite.close(); });

  await t.test('guest retry reuses the request key and a ticket survives a refresh', async () => {
    const page = await browser.newPage(); const ids = [], replyIds = []; let calls = 0, replyCalls = 0;
    const fakeToken = 'synthetic-ticket-token';
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === '/api/support/tickets' && request.method() === 'POST') {
        ids.push(request.headers()['idempotency-key']); calls++;
        return route.fulfill(calls === 1 ? { status: 503, json: { error: 'Temporary failure' } } : { json: { success: true, ticket_number: 'TKT-FIX123', ticket_token: fakeToken } });
      }
      if (url.pathname === '/api/support/tickets/TKT-FIX123') {
        assert.equal(request.headers()['x-ticket-token'], fakeToken);
        return route.fulfill({ json: { success: true, ticket: { ticket_number: 'TKT-FIX123', subject: 'Fixture', message: 'Synthetic question', status: 'open', created_at: '2026-01-01' }, replies: replyCalls > 1 ? [{ id: 1, sender_name: 'Fixture', sender_role: 'customer', message: 'Synthetic reply', created_at: '2026-01-01' }] : [] } });
      }
      if (url.pathname === '/api/support/tickets/TKT-FIX123/reply') { replyIds.push(request.headers()['idempotency-key']); replyCalls++; return route.fulfill(replyCalls === 1 ? { status: 503, json: { error: 'Reply temporarily unavailable' } } : { json: { success: true } }); }
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) return route.abort();
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    await page.goto(`${origin}/help`);
    await page.getByRole('button', { name: /Open a ticket/i }).first().click();
    await page.getByPlaceholder('Your Name').fill('Fixture Guest');
    await page.getByPlaceholder('you@domain.com').fill('guest@example.com');
    await page.getByPlaceholder('e.g. Need verification review for Aadhaar document').fill('Fixture');
    await page.getByPlaceholder('Please provide any relevant details (booking IDs, date, explanation of what happened)...').fill('Synthetic question for support');
    await page.getByRole('button', { name: 'Submit Ticket' }).click();
    await page.getByText('Temporary failure').waitFor();
    await page.getByRole('button', { name: 'Submit Ticket' }).click();
    await page.getByText('Support Ticket Generated').waitFor();
    assert.equal(ids.length, 2); assert.equal(ids[0], ids[1]); assert(ids[0]);
    await page.goto(`${origin}/help?ticket=TKT-FIX123`);
    await page.getByText('Synthetic question', { exact: true }).waitFor();
    await page.reload(); await page.getByText('Synthetic question', { exact: true }).waitFor();
    await page.getByPlaceholder('Type your response to support staff...').fill('Synthetic reply');
    await page.getByRole('button', { name: 'Send Reply' }).click();
    await page.getByText('Reply temporarily unavailable').waitFor();
    await page.getByRole('button', { name: 'Send Reply' }).click();
    await page.getByText('Synthetic reply', { exact: true }).waitFor();
    assert.equal(replyIds.length, 2); assert.equal(replyIds[0], replyIds[1]); assert(replyIds[0]);
    await page.close();
  });

  await t.test('signed-out applicant resumes their draft and submits only uploaded references', async () => {
    const page = await browser.newPage(); const applications = []; let uploads = 0;
    const id = '11111111-1111-4111-8111-111111111111';
    const user = { id, name: 'Fixture Provider', email: 'provider@example.com', role: 'provider', exp: 4102444800 };
    const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify(user)).toString('base64url')}.fixture`;
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('taskgenie:provider-application')) sessionStorage.setItem('taskgenie:provider-application', JSON.stringify({ form: { name: 'Fixture Provider', email: 'provider@example.com', phone: '+919876543210', service: 'electrical-repair', price: 499, price_unit: 'fixed', availability: [], kyc_doc_type: 'certificate' }, baseLocation: { lat: 1, lng: 1, confirmed: true } }));
    });
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: { user } });
      if (url.pathname === '/api/services/v1') return route.fulfill({ json: [] });
      if (url.pathname === '/api/providers/upload-kyc') {
        uploads++;
        return route.fulfill(uploads === 1
          ? { status: 503, json: { error: 'Identity document uploads are currently unavailable. Please contact support or try again later.' } }
          : { json: { url: `kyc/${id}/22222222-2222-4222-8222-222222222222` } });
      }
      if (url.pathname === '/api/providers/v1' && request.method() === 'POST') { applications.push(request.postDataJSON()); return route.fulfill({ status: 201, json: { custom_id: 'SRVFIXTURE123456' } }); }
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) return route.abort();
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    const file = { name: 'fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nsynthetic') };
    await page.goto(`${origin}/apply-now`);
    await page.locator('#kyc-front').setInputFiles(file);
    await page.waitForURL('**/login?returnTo=application');
    assert.equal(uploads, 0);
    await page.evaluate(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); }, { token, user });
    await page.goto(`${origin}/apply-now`);
    await page.locator('#kyc_doc_number').fill('FIXTURE1234');
    await page.locator('#kyc-front').setInputFiles(file);
    await page.getByText('Identity document uploads are currently unavailable. Please contact support or try again later.').first().waitFor();
    await page.locator('#kyc-front').setInputFiles({ ...file, name: 'retry-fixture.pdf' });
    await page.getByText('Document uploaded privately').waitFor();
    await page.locator('#kyc_declaration').check();
    await page.getByRole('button', { name: 'Submit application' }).click();
    await page.getByText('Application submitted', { exact: true }).waitFor();
    assert.equal(applications.length, 1); assert.equal(uploads, 2);
    assert.equal(applications[0].kyc_declaration, true); assert(applications[0].kyc_doc_front.startsWith('kyc/'));
    await page.close();
  });
});
