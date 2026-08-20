const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

function initSocket(httpServer, corsOptions) {
	io = new Server(httpServer, {
		cors: corsOptions,
		pingTimeout: 60000,
		pingInterval: 25000,
	});

	// Socket Authentication Middleware
	io.use((socket, next) => {
		const token =
			socket.handshake.auth?.token ||
			socket.handshake.query?.token ||
			socket.handshake.headers?.authorization?.replace("Bearer ", "");

		if (!token) {
			return next(new Error("Authentication token required for socket connection"));
		}

		try {
			const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_jwt_secret_key");
			socket.userId = decoded.id || decoded.userId;
			socket.userRole = decoded.role;
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

		socket.on("disconnect", () => {
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
