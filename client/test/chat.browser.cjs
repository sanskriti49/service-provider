// Optional end-to-end test: requires Playwright on NODE_PATH and an explicit test DB.
// Runs the real chat backend/SQL and frontend. Only non-chat dashboard data is a fixture.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const { tmpdir } = require('node:os');
const { mkdirSync } = require('node:fs');
const http = require('node:http');
const root = path.resolve(__dirname, '../..');
const serverRequire = createRequire(path.join(root, 'server/package.json'));

test('customer/provider browser chat integration', { skip: !process.env.CHAT_TEST_DATABASE_URL, timeout: 180000 }, async (t) => {
	process.env.DATABASE_URL = process.env.CHAT_TEST_DATABASE_URL;
	process.env.NODE_ENV = 'test';
	process.env.JWT_SECRET = randomUUID();
	const { chromium } = require('playwright');
	const { Pool } = serverRequire('pg');
	const express = serverRequire('express');
	const jwt = serverRequire('jsonwebtoken');
	const db = serverRequire('./config/db');
	const schema = `chat_browser_${randomUUID().replaceAll('-', '')}`;
	const admin = new Pool({ connectionString: process.env.CHAT_TEST_DATABASE_URL });
	await admin.query(`CREATE SCHEMA ${schema}`);
	const pool = new Pool({ connectionString: process.env.CHAT_TEST_DATABASE_URL, options: `-c search_path=${schema}` });
	db.query = (...args) => pool.query(...args);
	db.connect = () => pool.connect();
	let browser, vite, io, server;
	t.after(async () => {
		await browser?.close();
		await vite?.close();
		if (io) await new Promise((resolve) => io.close(resolve));
		if (server?.listening) await new Promise((resolve) => server.close(resolve));
		await pool.end();
		await admin.query(`DROP SCHEMA ${schema} CASCADE`);
		await admin.end();
		await db.end();
	});
	const { queries } = serverRequire('./migrations/create_tables');
	for (const table of ['users', 'bookings']) await pool.query(queries.find((q) => q.startsWith(`CREATE TABLE IF NOT EXISTS public.${table} (`)).replaceAll('public.', `${schema}.`));
	await pool.query(serverRequire('./migrations/migrate_chat').chatSchema.replaceAll('public.', `${schema}.`));
	const users = [
		{ id: randomUUID(), name: 'Aarav Sharma', role: 'customer', custom_id: 'CUSCHATTEST001' },
		{ id: randomUUID(), name: 'Priya Mehta', role: 'provider', custom_id: 'SRVCHATTEST001', is_verified: true },
		{ id: randomUUID(), name: 'Other Customer', role: 'customer', custom_id: 'CUSCHATTEST002' },
	];
	for (const user of users) await pool.query('INSERT INTO users (id, name, role, email, password, custom_id) VALUES ($1,$2,$3,$4,\'unused\',$5)', [user.id, user.name, user.role, `${user.id}@example.invalid`, user.custom_id]);
	const booking = { booking_id: randomUUID(), user_id: users[0].id, provider_id: users[1].id,
		provider_name: users[1].name, customer_name: users[0].name, service_name: 'Home Cleaning',
		date: '2026-11-12', start_time: '10:00', end_time: '11:00', status: 'confirmed', price: 1200,
		otp: '1234', completion_otp: '1234', payment_method: 'cod', payment_status: 'pending', address: 'Test address', custom_id: users[1].custom_id };
	const otherBooking = { ...booking, booking_id: randomUUID(), service_name: 'Kitchen Cleaning' };
	for (const item of [booking, otherBooking]) await pool.query('INSERT INTO bookings (booking_id,user_id,provider_id,date,start_time,end_time,status) VALUES ($1,$2,$3,$4,$5,$6,$7)', [item.booking_id,item.user_id,item.provider_id,item.date,item.start_time,item.end_time,item.status]);
	const chat = serverRequire('./utils/chatService');
	const app = express();
	app.use(serverRequire('cors')({ origin: true, credentials: true }));
	app.use(express.json());
	app.use('/api/chat', serverRequire('./routes/chatRoutes'));
	app.get('/api/auth/me', serverRequire('./middleware/authMiddleware'), (req, res) => res.json({ user: users.find((user) => user.id === req.user.id) }));
	const list = [booking, otherBooking];
	app.get('/api/bookings/my-bookings', (req, res) => res.json(list));
	app.get('/api/bookings/provider/history/recent', (req, res) => res.json(list));
	for (const route of ['/api/bookings/user/history', '/api/bookings/provider/list']) app.get(route, (req, res) => res.json({ data: list, meta: { total_pages: 1, current_page: 1, total_items: 2, has_next_page: false } }));
	app.get('/api/dashboard/:role', (req, res) => res.json({ stats: {}, pending_notifications: 0 }));
	app.get('/api/notifications', (req, res) => res.json({ notifications: [], unread_count: 0 }));
	server = http.createServer(app);
	io = serverRequire('./utils/socket').initSocket(server, { origin: true, credentials: true });
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	process.env.VITE_API_URL = `http://127.0.0.1:${server.address().port}`;
	const { createServer } = await import(pathToFileURL(path.join(root, 'client/node_modules/vite/dist/node/index.js')).href);
	vite = await createServer({ root: path.join(root, 'client'), server: { port: 5188, strictPort: true, host: '127.0.0.1' } });
	await vite.listen();
	browser = await chromium.launch({ channel: 'chrome', headless: true });
	const errors = [];
	const createPage = async (user, viewport = { width: 1440, height: 1000 }) => {
		const context = await browser.newContext({ viewport });
		await context.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
		const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
		await context.addInitScript(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); }, { token, user });
		const page = await context.newPage();
		page.on('pageerror', (err) => errors.push(err.message));
		await page.goto(`http://127.0.0.1:5188/${user.role === 'provider' ? 'provider/' : ''}dashboard/bookings`);
		return { page, context };
	};
	const { page: customer, context: customerContext } = await createPage(users[0]);
	const { page: provider } = await createPage(users[1]);
	const trigger = (page, name = 'Home Cleaning') => page.getByRole('button', { name: new RegExp(`Chat about ${name}`) }).filter({ visible: true }).first();
	const open = async (page, name) => { await trigger(page, name).click(); await page.getByRole('textbox', { name: /Message to/ }).waitFor(); };
	const send = async (page, body) => { await page.getByRole('textbox', { name: /Message to/ }).fill(body); await page.getByRole('button', { name: 'Send message', exact: true }).click(); };
	const waitFor = async (check) => {
		const deadline = Date.now() + 12000;
		while (!(await check())) { if (Date.now() > deadline) throw new Error('Condition timed out'); await new Promise((r) => setTimeout(r, 80)); }
	};
	const output = path.join(tmpdir(), 'taskgenie-chat-ui'); mkdirSync(output, { recursive: true });

	await t.test('empty state, real send, unread badge, receipt and keyboard focus', async () => {
		await open(customer);
		await customer.getByText('Good service starts').waitFor();
		await customer.screenshot({ path: path.join(output, 'desktop-empty.png') });
		await send(customer, 'Hi Priya! Could you arrive at the main entrance?');
		await waitFor(async () => (await chat.history(users[0].id, booking.booking_id)).messages.length === 1);
		await provider.getByRole('button', { name: /Chat about Home Cleaning, 1 unread/ }).filter({ visible: true }).waitFor();
		await open(provider);
		await provider.bringToFront();
		await provider.getByText('Hi Priya! Could you arrive at the main entrance?', { exact: true }).waitFor();
		await customer.getByText('Read', { exact: true }).waitFor();
		await send(provider, 'Absolutely, Aarav. I’ll call you when I arrive. See you at 10!');
		await customer.bringToFront();
		await customer.getByText('Absolutely, Aarav. I’ll call you when I arrive. See you at 10!', { exact: true }).waitFor();
		await customer.screenshot({ path: path.join(output, 'desktop-conversation.png') });
		await customer.getByRole('button', { name: 'Send message', exact: true }).evaluate((element) => element.disabled = false);
		await customer.getByRole('button', { name: 'Send message', exact: true }).focus();
		await customer.keyboard.press('Tab');
		assert.equal(await customer.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close chat');
		await customer.keyboard.press('Escape');
		assert.equal(await customer.getByRole('dialog').count(), 0);
		assert.match(await customer.evaluate(() => document.activeElement.getAttribute('aria-label')), /Chat about/);
	});
	await t.test('history persists across reload and conversations stay isolated', async () => {
		await customer.reload(); await open(customer);
		await customer.getByText('Hi Priya! Could you arrive at the main entrance?', { exact: true }).waitFor();
		await customer.keyboard.press('Escape');
		await open(customer, 'Kitchen Cleaning');
		await customer.getByText('Good service starts').waitFor();
		assert.equal(await customer.getByText('Hi Priya! Could you arrive at the main entrance?', { exact: true }).count(), 0);
		await customer.keyboard.press('Escape');
	});
	await t.test('reconnect replays more than one page and earlier history preserves scroll', async () => {
		await open(customer);
		await customerContext.setOffline(true);
		for (let i = 0; i < 55; i++) await chat.send(users[1].id, booking.booking_id, { clientMessageId: randomUUID(), body: `While you were away ${i + 1}` });
		await customerContext.setOffline(false);
		await customer.getByText('While you were away 55', { exact: true }).waitFor({ timeout: 25000 });
		assert.equal(await customer.locator('.tg-chat-bubble').count(), 57);
		await customer.reload(); await open(customer);
		await customer.getByRole('button', { name: 'Earlier messages' }).click();
		await customer.getByText('Hi Priya! Could you arrive at the main entrance?', { exact: true }).waitFor();
		assert.equal(await customer.locator('.tg-chat-bubble').count(), 57);
	});
	await t.test('failed send retries with the same UUID and renders once', async () => {
		await customerContext.setOffline(true);
		await send(customer, 'Retry this message safely');
		await customer.getByRole('button', { name: 'Retry message' }).waitFor({ timeout: 30000 });
		await customerContext.setOffline(false);
		await customer.getByRole('button', { name: 'Retry message' }).click();
		await waitFor(async () => (await chat.history(users[0].id, booking.booking_id)).messages.some((m) => m.body === 'Retry this message safely'));
		assert.equal(await customer.getByText('Retry this message safely', { exact: true }).count(), 1);
	});
	await t.test('closing a pending send retains its eventual failure and draft on reopen', async () => {
		// Force HTTP so this deliberately delayed failure finishes after panel remount.
		await customer.evaluate(async () => {
			const { getSocket } = await import('/src/utils/socket.js');
			getSocket().disconnect();
		});
		await customer.route('**/api/chat/*/messages', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			await new Promise((resolve) => setTimeout(resolve, 1800));
			await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Test interruption' } }) });
		});
		await send(customer, 'A pending message stays with this booking');
		await customer.getByRole('textbox', { name: /Message to/ }).fill('A draft for later');
		await customer.keyboard.press('Escape');
		await open(customer);
		await customer.getByRole('button', { name: 'Retry message' }).waitFor();
		assert.equal(await customer.getByRole('textbox', { name: /Message to/ }).inputValue(), 'A draft for later');
		await customer.unroute('**/api/chat/*/messages');
		await customer.getByRole('button', { name: 'Retry message' }).click();
		await waitFor(async () => (await chat.history(users[0].id, booking.booking_id)).messages.some((m) => m.body === 'A pending message stays with this booking'));
	});
	await t.test('mobile fit, safe text rendering and booking actions remain available', async () => {
		await customer.setViewportSize({ width: 390, height: 844 });
		await send(customer, '<img src=x onerror=alert(1)>');
		await customer.getByText('<img src=x onerror=alert(1)>', { exact: true }).waitFor();
		assert.equal(await customer.locator('.tg-chat-bubble img').count(), 0);
		const box = await customer.getByRole('dialog').boundingBox();
		assert.ok(box.width <= 390 && box.height <= 844);
		assert.equal(await customer.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
		await customer.screenshot({ path: path.join(output, 'mobile-conversation.png') });
		await customer.getByRole('button', { name: 'Close chat' }).filter({ visible: true }).click();
		await customer.getByRole('button', { name: 'Open details for Home Cleaning' }).click();
		await customer.getByText('Completion OTP', { exact: false }).first().waitFor();
		await customer.getByRole('button', { name: /Chat about Home Cleaning/ }).filter({ visible: true }).last().click();
		await customer.getByRole('dialog', { name: 'Priya Mehta' }).waitFor();
	});
	await t.test('forged booking access is rejected by the real backend', async () => {
		const { page: outsider } = await createPage(users[2]);
		// A malicious caller can bypass a disabled UI; validate the API boundary directly.
		const response = await outsider.evaluate(async ({ url, bookingId }) => {
			const result = await fetch(`${url}/api/chat/${bookingId}/messages`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
			return result.status;
		}, { url: process.env.VITE_API_URL, bookingId: booking.booking_id });
		assert.equal(response, 404);
	});
	assert.deepEqual(errors, []);
	console.log(`Chat screenshots: ${output}`);
});
