import { io } from "socket.io-client";
import { toast } from "sonner";

import { API_URL } from "../config";
import { socketOptions } from "./socketOptions";
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
		socketInstance = io(API_URL || undefined, socketOptions(token));

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
	// A renewed token must never reuse another session's authenticated socket.
	if (socketInstance.auth.token !== token) {
		socketInstance.disconnect();
		socketInstance.auth = { token };
		socketInstance.connect();
	}

	return socketInstance;
}

export function disconnectSocket() {
	if (socketInstance) {
		socketInstance.disconnect();
		socketInstance = null;
	}
}
