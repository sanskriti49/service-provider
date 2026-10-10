import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { disconnectSocket, getSocket } from "../utils/socket";
import { chatRequest } from "./chatTransport";
import ChatPanel from "./ChatPanel";
import { ChatContext } from "./ChatContext";

export default function ChatProvider({ children }) {
	const { user } = useAuth();
	const token = localStorage.getItem("token");
	return <ChatSession key={`${user?.id || "guest"}:${token || ""}`} user={user}>{children}</ChatSession>;
}

function ChatSession({ children, user }) {
	const [booking, setBooking] = useState(null);
	const [socket, setSocket] = useState(null);
	const [connection, setConnection] = useState("connecting");
	const [unread, setUnread] = useState({});
	const cache = useRef(new Map()); // Memory only; cleared on account/token change.
	const refreshRef = useRef(() => {});
	const refreshUnread = useCallback(() => refreshRef.current(), []);
	const closeChat = useCallback(() => setBooking(null), []);
	const openChat = useCallback((item) => {
		if (!user?.id || !item?.booking_id) return;
		// Booking-list responses supply identity when available. The API remains
		// authoritative for older responses that omit these fields.
		if (item.user_id && item.provider_id && item.user_id !== user.id && item.provider_id !== user.id) return;
		setBooking(item);
	}, [user?.id]);

	useEffect(() => {
		if (!user?.id || !["customer", "provider"].includes(user.role)) return;
		const current = getSocket();
		setSocket(current);
		let alive = true, running = false, dirty = false, timer;
		const refresh = async () => {
			if (!alive) return;
			if (running) { dirty = true; return; }
			running = true;
			try {
				const data = await chatRequest(current, "unread");
				if (alive) setUnread(Object.fromEntries(data.conversations.map((c) => [c.booking_id, c.unread_count])));
			} catch { /* Keep the last known count; reconnect/focus will reconcile. */ }
			finally {
				running = false;
				if (dirty && alive) { dirty = false; timer = setTimeout(refresh, 250); }
			}
		};
		refreshRef.current = refresh;
		const connected = () => { setConnection("connected"); refresh(); };
		const disconnected = () => setConnection((previous) => previous === "expired" ? previous : "offline");
		const failed = (error) => setConnection(/token/i.test(error?.message || "") ? "expired" : "offline");
		const expired = (error) => { if (error?.status === 401) setConnection("expired"); };
		const activity = () => { clearTimeout(timer); timer = setTimeout(refresh, 250); };
		const focus = () => {
			if (document.visibilityState !== "visible") return;
			if (current && !current.connected) current.connect();
			refresh();
		};
		current?.on("connect", connected);
		current?.on("disconnect", disconnected);
		current?.on("connect_error", failed);
		current?.on("chat:error", expired);
		current?.on("chat:message", activity);
		current?.on("chat:read", activity);
		setConnection(current?.connected ? "connected" : "connecting");
		refresh();
		const interval = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 60000);
		window.addEventListener("focus", focus);
		window.addEventListener("online", focus);
		document.addEventListener("visibilitychange", focus);
		return () => {
			alive = false;
			refreshRef.current = () => {};
			clearTimeout(timer); clearInterval(interval);
			current?.off("connect", connected);
			current?.off("disconnect", disconnected);
			current?.off("connect_error", failed);
			current?.off("chat:error", expired);
			current?.off("chat:message", activity);
			current?.off("chat:read", activity);
			window.removeEventListener("focus", focus);
			window.removeEventListener("online", focus);
			document.removeEventListener("visibilitychange", focus);
			disconnectSocket();
		};
	}, [user?.id, user?.role]);

	const value = useMemo(() => ({ openChat, unread }), [openChat, unread]);
	return <ChatContext.Provider value={value}>
		{children}
		{booking && user?.id && <ChatPanel key={booking.booking_id} booking={booking} user={user}
			socket={socket} connection={connection} cache={cache.current} onClose={closeChat} onRead={refreshUnread} />}
	</ChatContext.Provider>;
}
