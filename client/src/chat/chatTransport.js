import api from "../api/axiosInstance";

export async function chatRequest(socket, operation, input = {}) {
	if (socket?.connected) {
		try {
			return await new Promise((resolve, reject) => {
				// Never leave sends in Socket.IO's offline buffer after a timeout.
				socket.timeout(10000).volatile.emit(`chat:${operation}`, input, (err, response) => {
					if (err) return reject(Object.assign(new Error("Connection interrupted"), { transport: true }));
					if (!response?.ok) return reject(Object.assign(new Error(response?.error?.message || "Chat unavailable"), response?.error));
					resolve(response.data);
				});
			});
		} catch (error) {
			if (!error.transport) throw error;
			// The same UUID makes HTTP fallback safe after a lost send acknowledgement.
		}
	}
	const { bookingId, ...data } = input;
	const base = `/api/chat/${encodeURIComponent(bookingId || "")}`;
	const config = { timeout: 12000 };
	if (operation === "unread") return (await api.get("/api/chat/unread", config)).data;
	if (operation === "history") return (await api.get(`${base}/messages`, { ...config, params: data })).data;
	return (await api.post(`${base}/${operation === "send" ? "messages" : "read"}`, data, config)).data;
}
