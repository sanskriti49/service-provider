export function socketOptions(token) {
	return {
		auth: { token },
		// Establish polling first, then upgrade. A blocked upgrade leaves polling
		// connected; tryAllTransports also covers servers that only allow WebSocket.
		transports: ["polling", "websocket"],
		tryAllTransports: true,
		reconnection: true,
		reconnectionAttempts: Infinity,
		reconnectionDelay: 2000,
		// Firefox reloads should close the old connection quietly.
		closeOnBeforeunload: true,
	};
}
