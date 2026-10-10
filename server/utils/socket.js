const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const chat = require("./chatService");

let io = null;

function initSocket(httpServer, corsOptions) {
	io = new Server(httpServer, {
		cors: corsOptions,
		pingTimeout: 60000,
		pingInterval: 25000,
	});

	io.use(async (socket, next) => {
		const token =
			socket.handshake.auth?.token ||
			socket.handshake.query?.token ||
			socket.handshake.headers?.authorization?.replace("Bearer ", "");

		if (!token) {
			return next(new Error("Authentication token required for socket connection"));
		}

		try {
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			const userId = chat.uuid(decoded.id || decoded.userId, "userId");
			const { rows } = await db.query("SELECT id, role FROM users WHERE id = $1", [userId]);
			if (!rows.length) return next(new Error("Invalid token"));
			socket.userId = rows[0].id;
			socket.userRole = rows[0].role;
			socket.tokenExpiresAt = decoded.exp ? decoded.exp * 1000 : null;
			next();
		} catch (err) {
			console.warn("Socket auth error:", err.message);
			next(new Error("Invalid token"));
		}
	});

	io.on("connection", (socket) => {
		const userRoom = `user_${socket.userId}`;
		socket.join(userRoom);
		console.log(`🔌 Socket connected: ${socket.id} (User: ${socket.userId}, Role: ${socket.userRole})`);

		// Expired sessions must also stop receiving private pushes, not just sending.
		let expiryTimer;
		function enforceExpiry() {
			if (!socket.tokenExpiresAt) return;
			const remaining = socket.tokenExpiresAt - Date.now();
			if (remaining <= 0) {
				socket.emit("chat:error", { code: "UNAUTHORIZED", message: "Token expired", status: 401 });
				socket.disconnect(true);
				return;
			}
			expiryTimer = setTimeout(enforceExpiry, Math.min(remaining, 2147483647));
			expiryTimer.unref();
		}
		enforceExpiry();

		let windowStart = Date.now();
		let requests = 0;
		let inFlight = 0;
		const handle = (event, operation) => socket.on(event, async (input, ack) => {
			let acquired = false;
			try {
				if (socket.tokenExpiresAt && Date.now() >= socket.tokenExpiresAt) {
					throw new chat.ChatError(401, "UNAUTHORIZED", "Token expired");
				}
				if (Date.now() - windowStart >= 60000) { windowStart = Date.now(); requests = 0; }
				if (++requests > 120 || inFlight >= 5) throw new chat.ChatError(429, "RATE_LIMITED", "Too many chat requests. Please retry later.");
				if (!input || typeof input !== "object" || Array.isArray(input)) throw new chat.ChatError(400, "INVALID_INPUT", "Expected an object payload");
				inFlight++;
				acquired = true;
				const data = await operation(input);
				if (typeof ack === "function") ack({ ok: true, data });
			} catch (err) {
				const error = chat.errorPayload(err);
				if (typeof ack === "function") ack({ ok: false, error });
				else socket.emit("chat:error", error);
			} finally {
				if (acquired) inFlight--;
			}
		});
		handle("chat:history", (input) => chat.history(socket.userId, input.bookingId, input));
		handle("chat:send", (input) => chat.send(socket.userId, input.bookingId, input));
		handle("chat:read", (input) => chat.markRead(socket.userId, input.bookingId, input));
		handle("chat:unread", () => chat.unread(socket.userId));

		socket.on("disconnect", () => {
			clearTimeout(expiryTimer);
			console.log(`🔌 Socket disconnected: ${socket.id}`);
		});
	});

	return io;
}

function getIO() {
	return io;
}

function emitToUser(userId, event, payload) {
	if (!io || !userId) return false;
	const userRoom = `user_${userId}`;
	io.to(userRoom).emit(event, payload);
	return true;
}

module.exports = {
	initSocket,
	getIO,
	emitToUser,
};
