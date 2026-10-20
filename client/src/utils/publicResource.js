// Only public, read-only resources belong here. Never cache account/payment data.
export function createPublicResource({ request, ttlMs = 60000, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
	const entries = new Map();
	const entryFor = url => {
		if (!entries.has(url)) entries.set(url, {
			snapshot: { data: null, loading: true, error: null },
			expires: 0, pending: null, listeners: new Set(),
		});
		return entries.get(url);
	};
	const publish = (entry, snapshot) => {
		entry.snapshot = snapshot;
		for (const listener of entry.listeners) listener();
	};
	const abortError = () => new DOMException('Request canceled', 'AbortError');
	return {
		getSnapshot: url => entryFor(url).snapshot,
		subscribe(url, listener) {
			const entry = entryFor(url);
			entry.listeners.add(listener);
			return () => entry.listeners.delete(listener);
		},
		read(url, { signal, force = false } = {}) {
			if (signal?.aborted) return Promise.reject(abortError());
			const entry = entryFor(url);
			if (!force && entry.expires > now()) return Promise.resolve(entry.snapshot.data);
			if (!entry.pending) {
				publish(entry, { ...entry.snapshot, loading: true, error: null });
				entry.pending = Promise.resolve().then(async () => {
					try {
						let data;
						for (let attempt = 0; ; attempt++) {
							try {
								data = await request(url, { timeout: 5000 });
								break;
							} catch (error) {
								const status = error.response?.status;
								const transient = status ? [502, 503, 504].includes(status)
									: ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNREFUSED'].includes(error.code);
								if (!transient || attempt >= 2) throw error;
								await sleep(attempt === 0 ? 400 : 1000);
							}
						}
						entry.expires = now() + ttlMs;
						publish(entry, { data, loading: false, error: null });
						return data;
					} catch (error) {
						entry.expires = 0;
						publish(entry, { ...entry.snapshot, loading: false, error });
						throw error;
					} finally { entry.pending = null; }
				});
			}
			// Cancel this consumer, without canceling a request another component needs.
			return new Promise((resolve, reject) => {
				const onAbort = () => reject(abortError());
				signal?.addEventListener('abort', onAbort, { once: true });
				entry.pending.then(resolve, reject).finally(() => signal?.removeEventListener('abort', onAbort));
			});
		},
	};
}
