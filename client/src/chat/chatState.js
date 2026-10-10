export const compareIds = (a, b) => BigInt(a || 0) < BigInt(b || 0) ? -1 : BigInt(a || 0) > BigInt(b || 0) ? 1 : 0;
export const maxId = (a, b) => compareIds(a, b) >= 0 ? a : b;

// A socket push can beat its send acknowledgement. Match both server IDs and
// sender-scoped retry IDs, and never let an older snapshot erase a receipt.
export function mergeMessages(current, incoming) {
	const result = [...current];
	for (const message of incoming) {
		const index = result.findIndex((m) => (m.id && message.id && m.id === message.id) ||
			(m.client_message_id === message.client_message_id && m.sender_id === message.sender_id));
		if (index < 0) result.push(message);
		else {
			const old = result[index];
			result[index] = { ...old, ...message, id: message.id || old.id,
				read_at: old.read_at || message.read_at,
				status: message.id || old.id ? undefined : message.status };
		}
	}
	return result.sort((a, b) => a.id && b.id ? compareIds(a.id, b.id) : a.id ? -1 : b.id ? 1 : a.created_at.localeCompare(b.created_at));
}

export function applyPeerReceipt(messages, userId, watermark, readAt) {
	if (!watermark) return messages;
	return messages.map((m) => m.id && m.sender_id === userId && compareIds(m.id, watermark) <= 0
		? { ...m, read_at: m.read_at || readAt || new Date().toISOString() } : m);
}

export function chatErrorMessage(error) {
	const status = error?.response?.status || error?.status;
	if (status === 401) return "Your session has expired. Please sign in again.";
	if (status === 403 || status === 404) return "This conversation is unavailable. Only the booking’s customer and provider can open it.";
	if (status === 429) return "A little too fast. Please wait a moment and try again.";
	return error?.response?.data?.error?.message || error?.message || "Couldn’t connect. Please try again.";
}

export function clientMessageId() {
	if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
	// getRandomValues also supports local development over a LAN HTTP address.
	const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 15) | 64;
	bytes[8] = (bytes[8] & 63) | 128;
	const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
