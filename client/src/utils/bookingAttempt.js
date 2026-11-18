const MAX_AGE = 24 * 60 * 60 * 1000;

export async function getBookingAttempt(customerId, payload, storage = globalThis.localStorage) {
	const { price: _price, end_time: _end, ...details } = payload;
	const bytes = new TextEncoder().encode(JSON.stringify(details));
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
	const storageKey = `taskgenie:booking-attempt:${customerId}`;
	const now = Date.now();
	let previous;
	try { previous = JSON.parse(storage.getItem(storageKey)); } catch { /* Storage can be unavailable. */ }
	if (previous?.fingerprint === fingerprint && previous.key && previous.expiresAt > now) return previous.key;
	const key = crypto.randomUUID();
	try { storage.setItem(storageKey, JSON.stringify({ fingerprint, key, expiresAt: now + MAX_AGE })); }
	catch { /* The server still enforces the key for this request. */ }
	return key;
}

export function clearBookingAttempt(customerId, key) {
	try {
		const storageKey = `taskgenie:booking-attempt:${customerId}`;
		if (JSON.parse(localStorage.getItem(storageKey))?.key === key) localStorage.removeItem(storageKey);
	} catch { /* Storage can be unavailable. */ }
}
