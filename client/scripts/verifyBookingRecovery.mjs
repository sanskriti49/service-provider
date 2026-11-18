import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.BOOKING_BROWSER_URL || "http://127.0.0.1:5198";
const user = { id: "11111111-1111-4111-8111-111111111111", role: "customer", name: "Booking Fixture" };
const provider = { id: "22222222-2222-4222-8222-222222222222", custom_id: "SRVFIXTURE", name: "Fixture Provider", service_id: "cleaning", price: 1200 };
const booking = { booking_id: "33333333-3333-4333-8333-333333333333", price: 1200, date: "2040-05-20",
	service_name: "House Cleaning", provider_name: provider.name, address: "Fixture service address",
	start_time: "10:00", end_time: "11:00", payment_status: "pending", status: "pending",
	is_hold_active: true, hold_expires_at: new Date(Date.now() + 300000).toISOString(), seconds_remaining: 300 };
const token = `e30.${Buffer.from(JSON.stringify({ ...user, exp: Date.now() / 1000 + 3600 })).toString("base64url")}.fixture`;
const browser = await chromium.launch();
try {
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
	page.setDefaultTimeout(10000);
	page.setDefaultNavigationTimeout(30000);
	const errors = [];
	const diagnostics = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => { if (message.type() === "error") diagnostics.push(message.text()); });
	await page.route("https://**/*", (route) => route.abort());
	await page.addInitScript(({ user, provider, booking, token }) => {
		localStorage.setItem("token", token);
		localStorage.setItem("user", JSON.stringify(user));
		if (location.pathname.startsWith("/book/")) {
			history.replaceState({ key: "fixture", idx: 0, usr: {
				provider, selectedDateStr: booking.date,
				selectedSlot: { date: booking.date, start_time: booking.start_time, end_time: booking.end_time },
				serviceLocation: { address: booking.address, lat: 12, lng: 77 },
			} }, "");
		}
		window.Razorpay = class {
			constructor(options) { window.checkoutRetryEnabled = options.retry?.enabled; }
			on() {}
			open() { window.checkoutOpened = true; }
		};
	}, { user, provider, booking, token });

	const attempts = [];
	const original = { ...booking, cancellation_reason: "Schedule conflict", provider_name: "Original provider",
		price_paise: 120000, payment_method: "cod", replacement_id: null };
	const replacement = { provider_id: provider.id, name: "Replacement provider", price_paise: 130000,
		slots: [{ start: "10:00", end: "11:00", same_time: true }] };
	const replacementAttempts = [];
	let recovered = false, stale = false;
	let checks = 0;
	await page.route("**/api/**", async (route) => {
		const req = route.request();
		const { pathname } = new URL(req.url());
		if (pathname === "/api/auth/me") return route.fulfill({ json: { user } });
		if (pathname.endsWith("/availability")) return route.fulfill({ json: [{ date: booking.date,
			free_slots: [{ start: booking.start_time, end: booking.end_time }] }] });
		if (pathname === "/api/bookings" && req.method() === "POST") {
			attempts.push({ key: req.headers()["idempotency-key"], body: req.postDataJSON() });
			if (attempts.length === 1) return route.abort("connectionreset");
			if (attempts.length === 2) return route.fulfill({ json: { duplicate: true, booking } });
			if (attempts.length === 4) return route.fulfill({ status: 201, json: { booking, razorpay_order: "order_fixture" } });
			return route.fulfill({ status: 201, json: { booking } });
		}
		if (pathname.endsWith("/unpaid")) return route.fulfill({ status: 202, json: {
			success: false, code: "PAYMENT_CHECK_PENDING", message: "Release is pending a payment check.",
		} });
		if (pathname.endsWith("/recovery/items")) return route.fulfill({ json: { success: true, interrupted_checkouts: [booking],
			refunds: [], summary: { active_holds_count: 1, interrupted_count: 1 } } });
		if (pathname.endsWith("/recovery/replacements")) return route.fulfill({ json: { items: [original] } });
		if (pathname.endsWith("/replacement")) {
			const { searchParams } = new URL(req.url());
			const date = searchParams.get("date") || booking.date;
			const resolved = { ...original, replacement_id: provider.id, replacement_status: "pending", replacement_provider_name: replacement.name };
			if (req.method() === "POST") {
				replacementAttempts.push(req.postDataJSON());
				if (!stale) {
					stale = true;
					return route.fulfill({ status: 409, json: { message: "That slot was just taken." } });
				}
				recovered = true;
				return route.fulfill({ status: 201, json: { original: resolved } });
			}
			return route.fulfill({ json: { original: recovered ? resolved : original, date,
				window: { min: booking.date, preferred: booking.date, max: "2040-05-25" },
				options: recovered || (stale && date === booking.date) ? [] : [{ ...replacement,
					slots: replacement.slots.map(slot => ({ ...slot, same_time: date === booking.date })) }] } });
		}
		if (pathname.endsWith("/resume-checkout")) {
			checks++;
			if (checks === 1) return route.fulfill({ status: 202, json: { can_pay: false,
				code: "PAYMENT_CHECK_PENDING", message: "We’re still checking your payment. Please do not pay again." } });
			return route.fulfill({ json: { code: "PAYMENT_CONFIRMED", can_pay: false,
				booking: { ...booking, status: "booked", payment_status: "paid" } } });
		}
		return route.fulfill({ json: [] });
	});

	const bookingUrl = `${base}/book/${provider.custom_id}`;
	await page.goto(bookingUrl);
	await page.getByRole("radio", { name: /Pay now/ }).waitFor().catch(async (error) => {
		throw new Error(`Booking page at ${page.url()} did not render. ${[...errors, ...diagnostics].join("; ")} ${(await page.locator("body").innerText()).slice(0, 500)}`, { cause: error });
	});
	await page.getByRole("radio", { name: /Pay now/ }).click();
	await page.getByRole("button", { name: "Book and pay", exact: true }).filter({ visible: true }).click();
	await page.getByRole("link", { name: "Check an interrupted booking" }).waitFor();
	await page.reload();
	await page.getByRole("radio", { name: /Pay now/ }).click();
	await page.getByRole("button", { name: "Book and pay", exact: true }).filter({ visible: true }).click();
	await page.waitForURL("**/dashboard/bookings?tab=recovery*");
	assert.ok(attempts[0].key);
	assert.deepEqual(attempts[1], attempts[0]);
	assert.equal(attempts[0].body.payment_method, "online");
	assert.equal(Object.hasOwn(attempts[0].body, "idempotency_key"), false);

	await page.getByRole("button", { name: "Release Slot" }).click();
	await page.getByText("Release is pending a payment check.").waitFor();
	assert.equal(await page.getByText("Held slot released successfully.").count(), 0);

	const check = page.getByRole("button", { name: "Check payment & resume" });
	await check.click();
	await page.getByText(/Please do not pay again/).waitFor();
	assert.equal(await page.evaluate(() => !!window.checkoutOpened), false);
	await check.click();
	await page.waitForURL("**/booking-success");

	await page.goto(bookingUrl);
	await page.getByRole("button", { name: "Confirm booking", exact: true }).filter({ visible: true }).click();
	await page.waitForURL("**/booking-success");
	assert.equal(attempts[2].body.payment_method, "cod");
	assert.notEqual(attempts[2].key, attempts[0].key);

	await page.goto(bookingUrl);
	await page.getByRole("radio", { name: /Pay now/ }).click();
	await page.getByRole("button", { name: "Book and pay", exact: true }).filter({ visible: true }).click();
	await page.waitForFunction(() => window.checkoutOpened === true);
	assert.equal(await page.evaluate(() => window.checkoutRetryEnabled), false);
	assert.equal(attempts[3].body.payment_method, "online");
	assert.notEqual(attempts[3].key, attempts[0].key);

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`${base}/dashboard/bookings?tab=recovery&replacement=${booking.booking_id}`);
	await page.getByText("Original provider cancelled. Schedule conflict").waitFor();
	await page.getByText("₹100.00 more than the original").waitFor();
	await page.getByRole("button", { name: /Original time/ }).click();
	await page.getByRole("button", { name: /Confirm replacement for/ }).click();
	await page.getByText(/That slot was just taken/).waitFor();
	await page.getByRole("button", { name: "Refresh options" }).click();
	await page.getByText(/No matching providers showed availability/).waitFor();
	await page.getByLabel("Appointment date").fill("2040-05-21");
	await page.getByRole("button", { name: "10:00–11:00" }).click();
	await page.getByRole("button", { name: /Confirm replacement for/ }).click();
	await page.getByText(/Awaiting provider acceptance/).waitFor();
	assert.deepEqual(replacementAttempts[1], {
		provider_id: provider.id, date: "2040-05-21", start_time: "10:00", approved_price_paise: 130000,
	});
	await page.reload();
	await page.getByText(/Awaiting provider acceptance/).waitFor();
	assert.deepEqual(errors, []);
	console.log("Booking browser flows passed: online and cash checkout, payment recovery, and replacement price, stale slot, alternate date, confirmation and reload.");
} finally {
	await browser.close();
}
