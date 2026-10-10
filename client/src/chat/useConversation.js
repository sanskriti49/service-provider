import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { applyPeerReceipt, chatErrorMessage, clientMessageId, compareIds, maxId, mergeMessages } from "./chatState";
import { chatRequest } from "./chatTransport";

export default function useConversation({ bookingId, userId, socket, cache, onRead }) {
	// Keep the same snapshot/subscribers across panel mounts: a delayed send result
	// must reach a reopened panel as well as the panel that initiated it.
	const [session] = useState(() => {
		if (!cache.has(bookingId)) cache.set(bookingId, { listeners: new Set(), state: {
			messages: [], draft: "", cursor: null, older: null, peerRead: null, peerReadAt: null,
			ready: false, error: "", denied: false,
		} });
		return cache.get(bookingId);
	});
	const subscribe = useCallback((listener) => { session.listeners.add(listener); return () => session.listeners.delete(listener); }, [session]);
	const snapshot = useCallback(() => session.state, [session]);
	const state = useSyncExternalStore(subscribe, snapshot);
	const stateRef = useRef(state);
	stateRef.current = state;
	const alive = useRef(false);
	const syncRef = useRef(() => {});
	const readThrough = useRef(null);
	const reading = useRef(false);
	const sending = useRef(new Set());
	const [loadingOlder, setLoadingOlder] = useState(false);
	const update = useCallback((change) => {
		const current = session.state;
		const next = { ...current, ...change(current) };
		stateRef.current = next;
		session.state = next;
		session.listeners.forEach((listener) => listener());
	}, [session]);
	const ingest = useCallback((messages, watermark, readAt) => update((old) => {
		const peerRead = maxId(old.peerRead, watermark);
		return { peerRead, peerReadAt: readAt || old.peerReadAt,
			messages: applyPeerReceipt(mergeMessages(old.messages, messages), userId, peerRead, readAt || old.peerReadAt) };
	}), [update, userId]);

	useEffect(() => {
		alive.current = true;
		let disposed = false, busy = false, again = false;
		const synchronize = async () => {
			if (disposed) return;
			if (busy) { again = true; return; }
			busy = true;
			try {
				let cursor = stateRef.current.cursor;
				let more;
				do {
					const page = await chatRequest(socket, "history", { bookingId, ...(cursor ? { after: cursor } : {}) });
					if (disposed) return;
					ingest(page.messages, page.peer_last_read_message_id, page.peer_last_read_at);
					// Only history advances this cursor. Live pushes can jump over missed messages.
					const last = page.messages.at(-1)?.id;
					more = Boolean(cursor && page.has_more);
					update((old) => ({ cursor: maxId(old.cursor, last), ready: true, error: "", denied: false,
						...(!old.ready ? { older: page.has_more ? page.messages[0]?.id : null } : {}) }));
					cursor = page.next_cursor || last || cursor;
				} while (more);
			} catch (error) {
				if (!disposed) {
					const status = error.status || error.response?.status;
					const denied = [401, 403, 404].includes(status);
					update(() => ({ error: chatErrorMessage(error), denied, ...(denied ? { messages: [], ready: false } : {}) }));
				}
			} finally {
				busy = false;
				if (again && !disposed) { again = false; synchronize(); }
			}
		};
		syncRef.current = synchronize;
		const message = (item) => { if (item.booking_id === bookingId && !stateRef.current.denied) ingest([item]); };
		const receipt = (item) => {
			if (item.booking_id !== bookingId) return;
			if (item.reader_id !== userId) ingest([], item.last_read_message_id, item.last_read_at);
			onRead();
		};
		const focus = () => { if (document.visibilityState === "visible") synchronize(); };
		socket?.on("chat:message", message);
		socket?.on("chat:read", receipt);
		socket?.on("connect", synchronize);
		window.addEventListener("focus", focus);
		window.addEventListener("online", focus);
		document.addEventListener("visibilitychange", focus);
		const timer = setInterval(focus, 60000);
		synchronize();
		return () => {
			disposed = true; alive.current = false;
			clearInterval(timer);
			socket?.off("chat:message", message);
			socket?.off("chat:read", receipt);
			socket?.off("connect", synchronize);
			window.removeEventListener("focus", focus);
			window.removeEventListener("online", focus);
			document.removeEventListener("visibilitychange", focus);
		};
	}, [bookingId, userId, socket, ingest, update, onRead]);

	const send = async (body, retryMessage) => {
		if (!body.trim() || body.length > 4000 || stateRef.current.denied) return;
		const id = retryMessage?.client_message_id || clientMessageId();
		if (sending.current.has(id)) return;
		sending.current.add(id);
		const pending = { ...retryMessage, booking_id: bookingId, sender_id: userId,
			client_message_id: id, body: body.trim(), created_at: retryMessage?.created_at || new Date().toISOString(), status: "sending" };
		update((old) => ({ messages: mergeMessages(old.messages, [pending]), ...(!retryMessage ? { draft: "" } : {}) }));
		try {
			const result = await chatRequest(socket, "send", { bookingId, clientMessageId: id, body: pending.body });
			ingest([result.message]);
		} catch (error) {
			update((old) => ({ messages: old.messages.map((m) => m.client_message_id === id && !m.id
				? { ...m, status: "failed", error: chatErrorMessage(error) } : m) }));
		} finally { sending.current.delete(id); }
	};
	const loadOlder = async () => {
		if (loadingOlder || !stateRef.current.older) return;
		setLoadingOlder(true);
		try {
			const page = await chatRequest(socket, "history", { bookingId, before: stateRef.current.older });
			ingest(page.messages, page.peer_last_read_message_id, page.peer_last_read_at);
			update(() => ({ older: page.has_more ? page.next_cursor : null, error: "" }));
		} catch (error) { update(() => ({ error: chatErrorMessage(error) })); }
		finally { if (alive.current) setLoadingOlder(false); }
	};
	const markRead = useCallback(async (id) => {
		if (!id || reading.current || !stateRef.current.ready || stateRef.current.denied || compareIds(id, readThrough.current) <= 0) return;
		reading.current = true;
		try {
			await chatRequest(socket, "read", { bookingId, throughMessageId: id });
			readThrough.current = maxId(id, readThrough.current);
			onRead();
		} catch { /* Retried while visible and at the newest message. */ }
		finally { reading.current = false; }
	}, [bookingId, socket, onRead]);

	return { ...state, loadingOlder, send, loadOlder, markRead,
		setDraft: (draft) => update(() => ({ draft })), refresh: () => syncRef.current() };
}
