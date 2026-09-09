import { io } from "socket.io-client";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

let socketInstance = null;

export function getSocket() {
	const token = localStorage.getItem("token");
	if (!token) {
		if (socketInstance) {
			socketInstance.disconnect();
			socketInstance = null;
		}
		return null;
	}

	if (!socketInstance) {
		socketInstance = io(API_URL, {
			auth: { token },
			transports: ["websocket", "polling"],
			reconnection: true,
			reconnectionAttempts: 10,
			reconnectionDelay: 2000,
		});

		socketInstance.on("connect", () => {
			console.log("⚡ Real-time WebSocket connected");
		});

		socketInstance.on("notification:new", (notification) => {
			console.log("🔔 Incoming real-time notification:", notification);

			toast(notification.title || "New Notification", {
				description: notification.message,
				duration: 5000,
			});

			window.dispatchEvent(
				new CustomEvent("app:notification", { detail: notification }),
			);
		});

		socketInstance.on("disconnect", () => {
			console.log("⚡ Real-time WebSocket disconnected");
		});
	}

	return socketInstance;
}

export function disconnectSocket() {
	if (socketInstance) {
		socketInstance.disconnect();
		socketInstance = null;
	}
}
