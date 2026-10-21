// Production-bundle checks with a controlled public catalogue, no real accounts.
// Usage: node scripts/verifyLoading.mjs <build-directory> [--measure-only]
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const require = createRequire(new URL('../../server/package.json', import.meta.url));
const express = require('express');
const app = express();
const build = path.resolve(process.argv.slice(2).find(argument => !argument.startsWith('--')) || 'dist');
const measureOnly = process.argv.includes('--measure-only');
const checksOnly = process.argv.includes('--checks-only');
const compressed = !process.argv.includes('--uncompressed');
if (compressed) app.use(require('compression')());
const state = { calls: 0, failures: 0, delay: 350 };
app.get('/api/services/v1', async (_request, response) => {
	state.calls++;
	await new Promise(resolve => setTimeout(resolve, state.delay));
	if (state.failures-- > 0) return response.status(503).json({ message: 'Controlled outage' });
	response.json([{ id: 'test-plumbing', name: 'Plumbing', slug: 'plumbing', category: 'Home Services', description: 'Expert home repairs', price: 500 }]);
});
app.use(express.static(build));
app.use((_request, response) => response.sendFile(path.join(build, 'index.html')));
const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
const output = path.join(tmpdir(), 'taskgenie-loading-checks');
await mkdir(output, { recursive: true });
async function context(options = {}) {
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
	// Keep third-party font availability outside this repeatable bundle comparison.
	await ctx.route('https://**/*', route => route.abort());
	ctx.on('page', page => page.on('pageerror', error => errors.push(error.message)));
	return ctx;
}

async function chatPage(failChunk = false) {
	const ctx = await context();
	const user = { id: '11111111-1111-4111-8111-111111111111', name: 'Loading Test', role: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 };
	const booking = { booking_id: '22222222-2222-4222-8222-222222222222', user_id: user.id,
		provider_id: '33333333-3333-4333-8333-333333333333', provider_name: 'Test Professional',
		service_name: 'Plumbing', status: 'confirmed', date: '2026-11-12', start_time: '10:00', end_time: '11:00', price: 500, payment_method: 'cod' };
	const token = `e30.${Buffer.from(JSON.stringify(user)).toString('base64url')}.fixture`;
	await ctx.addInitScript(({ user, token, origin }) => {
		if (location.origin !== origin) return;
		localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('token', token);
	}, { user, token, origin });
	await ctx.route('**/api/**', route => {
		const url = new URL(route.request().url());
		let body = {};
		if (url.pathname === '/api/auth/me') body = { user };
		else if (url.pathname === '/api/bookings/my-bookings') body = [booking];
		else if (url.pathname === '/api/bookings/user/history') body = { data: [booking], meta: { current_page: 1, total_pages: 1, total_items: 1 } };
		else if (url.pathname === '/api/bookings/recovery/items') body = { checkouts: [], refunds: [], summary: {} };
		else if (url.pathname === '/api/dashboard/customer') body = { stats: {} };
		else if (url.pathname === '/api/notifications') body = { notifications: [], unread_count: 0 };
		else if (url.pathname === '/api/chat/unread') body = { conversations: [] };
		else if (url.pathname.endsWith('/messages')) body = { booking_id: booking.booking_id, messages: [], has_more: false, next_cursor: null };
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
	});
	await ctx.route('**/socket.io/**', route => route.abort());
	await ctx.route('**/assets/ChatPanel-*.js', async route => {
		if (failChunk) return route.abort();
		await new Promise(resolve => setTimeout(resolve, 1200));
		await route.continue();
	});
	const page = await ctx.newPage();
	await page.goto(`${origin}/dashboard/bookings`);
	return { ctx, page, trigger: page.getByRole('button', { name: /Chat about Plumbing/ }).filter({ visible: true }).first() };
}

try {
	browser = await chromium.launch({ headless: true });
	if (!measureOnly) {
		state.delay = 1500; state.calls = 0; state.failures = 0;
		const ctx = await context();
		const page = await ctx.newPage();
		await page.goto(origin);
		const input = page.getByRole('textbox', { name: 'Search services' });
		await input.fill('Plumb');
		assert.equal(await input.isEnabled(), true);
		await page.getByText('Plumbing', { exact: true }).last().waitFor();
		await page.waitForFunction(() => document.querySelector('#service-search-status')?.textContent.trim() === '');
		assert.equal(await input.inputValue(), 'Plumb');
		assert.equal(state.calls, 1, 'hero and rail must share one request');
		const homePreloads = 'link[rel="preload"][href="/images/background.webp"], link[rel="preload"][href="/fonts/P22-Mackinac/P22MackinacPro-Medium.woff2"]';
		assert.equal(await page.locator(homePreloads).count(), 2);
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
		await page.screenshot({ path: path.join(output, 'mobile-home.png') });
		await page.setViewportSize({ width: 1440, height: 1000 });
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
		await page.screenshot({ path: path.join(output, 'desktop-home.png') });
		await ctx.close();
		console.log('PASS delayed catalogue: editable search, retained text, one request, mobile/desktop layout');

		state.delay = 20; state.calls = 0; state.failures = 100;
		const failedContext = await context();
		const failedPage = await failedContext.newPage();
		let documents = 0;
		failedPage.on('request', request => { if (request.isNavigationRequest()) documents++; });
		await failedPage.goto(origin);
		const failedInput = failedPage.getByRole('textbox', { name: 'Search services' });
		await failedInput.fill('Plumbing');
		await failedPage.getByRole('button', { name: 'Retry', exact: true }).waitFor();
		assert.equal(state.calls, 3, 'retry budget must be bounded');
		assert.equal(await failedInput.isEnabled(), true);
		assert.equal(await failedPage.getByRole('button', { name: 'Search', exact: true }).isDisabled(), true);
		state.failures = 0;
		await failedPage.getByRole('button', { name: 'Retry', exact: true }).click();
		await failedPage.waitForFunction(() => document.querySelector('#service-search-status')?.textContent.trim() === '');
		assert.equal(await failedInput.inputValue(), 'Plumbing');
		assert.equal(await failedPage.getByText("We couldn't load services").count(), 0, 'retry must recover the rail too');
		assert.equal(documents, 1, 'retry must not reload the page');
		assert.equal(state.calls, 4);
		await failedInput.press('Enter');
		await failedPage.waitForURL('**/services/plumbing');
		await failedContext.close();
		console.log('PASS outage: bounded retry, retained input, shared recovery, no reload, search navigation');

		const hashContext = await context();
		const hashPage = await hashContext.newPage();
		await hashPage.goto(`${origin}/#work-with-us`);
		await hashPage.waitForFunction(() => {
			const section = document.getElementById('work-with-us');
			return section && Math.abs(section.getBoundingClientRect().top - 90) < 10;
		});
		await hashContext.close();
		assert.deepEqual(errors, []);
		console.log('PASS direct section link and no browser exceptions');

		// Navbar clicks must update the router before their lazy section exists.
		state.delay = 1500;
		const navContext = await context({ viewport: { width: 1440, height: 900 } });
		await navContext.route('**/assets/HomeDetails-*.js', async route => {
			await new Promise(resolve => setTimeout(resolve, 750));
			await route.continue();
		});
		const navPage = await navContext.newPage();
		async function atSection(page, id) {
			await page.waitForFunction(id => {
				const section = document.getElementById(id);
				return section && Math.abs(section.getBoundingClientRect().top - 90) < 10;
			}, id).catch(async error => {
				console.error('Section position:', await page.evaluate(id => ({ id, hash: location.hash, y: scrollY, top: document.getElementById(id)?.getBoundingClientRect().top }), id));
				throw error;
			});
		}
		await navPage.goto(origin);
		assert.equal(await navPage.locator('#contact').count(), 0, 'details should still be deferred');
		await navPage.getByRole('link', { name: 'Contact', exact: true }).first().click();
		await navPage.waitForURL('**/#contact');
		await atSection(navPage, 'contact');
		await navPage.getByRole('link', { name: 'How It Works', exact: true }).first().click();
		await atSection(navPage, 'how-it-works');
		await navPage.getByRole('link', { name: 'How It Works', exact: true }).first().click();
		await atSection(navPage, 'how-it-works');
		await navPage.getByRole('link', { name: 'Provider', exact: true }).click();
		await atSection(navPage, 'work-with-us');
		await navPage.goBack();
		await atSection(navPage, 'how-it-works');
		await navPage.goForward();
		await atSection(navPage, 'work-with-us');
		await navPage.getByRole('link', { name: 'Home', exact: true }).click();
		await navPage.waitForFunction(() => scrollY < 5);
		await navPage.getByRole('link', { name: 'Browse all services', exact: true }).click();
		await navPage.waitForURL('**/services');
		await navPage.getByRole('link', { name: 'Contact', exact: true }).first().click();
		await atSection(navPage, 'contact');
		await navContext.close();
		console.log('PASS desktop navbar: delayed lazy section, every section, repeated click, history and cross-page return');

		state.delay = 20;
		const mobileNavContext = await context({ reducedMotion: 'reduce' });
		const mobileNavPage = await mobileNavContext.newPage();
		await mobileNavPage.goto(origin);
		for (const [label, id] of [['Contact', 'contact'], ['Become a Provider', 'work-with-us'], ['How It Works', 'how-it-works'], ['Featured on Home', 'services']]) {
			await mobileNavPage.getByRole('button', { name: 'Toggle Navigation Menu' }).click();
			await mobileNavPage.getByRole('link', { name: label, exact: true }).filter({ visible: true }).first().click();
			await atSection(mobileNavPage, id);
			await mobileNavPage.getByRole('link', { name: 'Become a Provider', exact: true }).waitFor({ state: 'hidden' });
		}
		await mobileNavContext.close();
		assert.deepEqual(errors, []);
		console.log('PASS mobile navbar: all section links, drawer closes and reduced-motion scrolling');

		for (const reducedMotion of ['no-preference', 'reduce']) {
			const loaderContext = await context({ reducedMotion });
			let releaseChunk;
			const chunkGate = new Promise(resolve => { releaseChunk = resolve; });
			await loaderContext.route('**/assets/SignIn-*.js', async route => {
				await chunkGate;
				await route.continue();
			});
			const loaderPage = await loaderContext.newPage();
			try {
				await loaderPage.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
				const loader = loaderPage.getByRole('status', { name: 'Loading TaskGenie', exact: true });
				await loader.waitFor();
				await loaderPage.waitForFunction(() => {
					const image = document.querySelector('[role="status"] img');
					return image?.complete && image.naturalWidth > 0;
				});
				assert.equal(await loader.locator('svg').count(), 0, 'the artwork already contains painted smoke');
				assert.equal(await loader.locator('.taskgenie-wordmark-accent').count(), 1);
				assert.equal(await loaderPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
				const lamp = loader.locator('img');
				const before = await lamp.evaluate(image => getComputedStyle(image).transform);
				if (reducedMotion === 'reduce') {
					await loaderPage.waitForTimeout(500);
					assert.equal(await lamp.evaluate(image => getComputedStyle(image).transform), before);
				} else {
					await loaderPage.waitForFunction(before => getComputedStyle(document.querySelector('[role="status"] img')).transform !== before, before);
				}
				await loaderPage.screenshot({ path: path.join(output, `loader-${reducedMotion}.png`) });
			} finally {
				releaseChunk();
			}
			await loaderPage.getByRole('status', { name: 'Loading TaskGenie', exact: true }).waitFor({ state: 'hidden' });
			await loaderContext.close();
		}
		assert.deepEqual(errors, []);
		console.log('PASS branded loader: real chunk wait, painted artwork, shared lettering, motion and reduced motion');

		const chat = await chatPage();
		await chat.trigger.waitFor();
		assert.equal(await chat.page.locator(homePreloads).count(), 0, 'dashboard must not preload homepage-only assets');
		assert.equal(await chat.page.evaluate(() => performance.getEntriesByType('resource').some(entry => /ChatPanel-.*\.js/.test(entry.name))), false);
		await chat.trigger.click();
		await chat.page.getByRole('status').getByRole('button', { name: 'Cancel', exact: true }).waitFor();
		await chat.page.getByRole('textbox', { name: 'Message to Test Professional' }).waitFor();
		await chat.page.getByText('Good service starts', { exact: false }).waitFor();
		await chat.page.keyboard.press('Escape');
		assert.equal(await chat.page.getByRole('dialog').count(), 0);
		await chat.ctx.close();
		assert.deepEqual(errors, []);
		console.log('PASS deferred chat: loaded only on demand, loading state, fixture conversation, keyboard close');

		const brokenChat = await chatPage(true);
		await brokenChat.trigger.click();
		await brokenChat.page.getByRole('alert').filter({ hasText: "Chat couldn't load" }).waitFor();
		await brokenChat.page.getByRole('button', { name: 'Close', exact: true }).click();
		await brokenChat.trigger.waitFor();
		await brokenChat.ctx.close();
		console.log('PASS failed chat download: contained error and usable bookings page');
	}

	state.delay = 350; state.failures = 0;
	for (let sample = 1; !checksOnly && sample <= 3; sample++) {
		state.calls = 0;
		const ctx = await context();
		const page = await ctx.newPage();
		const cdp = await ctx.newCDPSession(page);
		await cdp.send('Network.enable');
		await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
		await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
		await page.addInitScript(() => {
			window.loadingMetrics = { lcp: 0, cls: 0, longTasks: 0 };
			new PerformanceObserver(list => { for (const entry of list.getEntries()) {
				loadingMetrics.lcp = entry.startTime;
				loadingMetrics.lcpElement = `${entry.element?.tagName}:${entry.element?.className}`;
			} }).observe({ type: 'largest-contentful-paint', buffered: true });
			new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) loadingMetrics.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
			new PerformanceObserver(list => { for (const entry of list.getEntries()) loadingMetrics.longTasks += entry.duration; }).observe({ type: 'longtask', buffered: true });
		});
		await page.goto(origin, { waitUntil: 'load', timeout: 60000 });
		await page.locator('.hero-title').waitFor();
		await page.waitForTimeout(2500);
		const metrics = await page.evaluate(() => ({ ...loadingMetrics,
			fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
			jsBytes: performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.endsWith('.js')).reduce((total, entry) => total + entry.transferSize, 0),
		}));
		console.log(JSON.stringify({ sample, compressed, ...metrics, catalogueRequests: state.calls }));
		await ctx.close();
	}
} finally {
	await browser?.close();
	await new Promise(resolve => server.close(resolve));
}
