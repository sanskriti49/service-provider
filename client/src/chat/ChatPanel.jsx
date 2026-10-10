import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Check, CheckCheck, ChevronLeft, LoaderCircle, LockKeyhole, MessageCircle, RefreshCw, WifiOff, X } from "lucide-react";
import useModal from "../hooks/useModal";
import useConversation from "./useConversation";
import "./chat.css";

const time = (value) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function day(value) {
	const date = new Date(value);
	const today = new Date();
	if (date.toDateString() === today.toDateString()) return "Today";
	today.setDate(today.getDate() - 1);
	if (date.toDateString() === today.toDateString()) return "Yesterday";
	return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export default function ChatPanel({ booking, user, socket, connection, cache, onClose, onRead }) {
	const chat = useConversation({ bookingId: booking.booking_id, userId: user.id, socket, cache, onRead });
	const panel = useRef(null), layer = useRef(null), scroll = useRef(null), input = useRef(null);
	const nearBottom = useRef(true), previousLast = useRef(null), initialScroll = useRef(false), prepend = useRef(null);
	const [newMessages, setNewMessages] = useState(false);
	const [announcement, setAnnouncement] = useState("");
	const [viewport, setViewport] = useState(null);
	const peer = user.role === "provider" ? booking.customer_name || "Your customer" : booking.provider_name || booking.provider?.name || "Your provider";
	const initials = peer.split(/\s+/).slice(0, 2).map((name) => name[0]).join("").toUpperCase();
	useModal({ isOpen: true, onClose, id: "booking-chat" });

	useEffect(() => {
		const previousFocus = document.activeElement;
		const background = [...document.body.children].filter((element) => element !== layer.current);
		const original = background.map((element) => [element, element.inert]);
		background.forEach((element) => { element.inert = true; });
		[...panel.current.querySelectorAll("button")].find((element) => element.getClientRects().length)?.focus();
		const trap = (event) => {
			if (event.key !== "Tab") return;
			const controls = [...panel.current.querySelectorAll('button:not(:disabled), a[href], textarea:not(:disabled), [tabindex="0"]')].filter((element) => element.getClientRects().length);
			const first = controls[0], last = controls.at(-1);
			if (event.shiftKey && (document.activeElement === first || !panel.current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
			else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
		};
		const resize = () => setViewport(window.visualViewport ? { height: window.visualViewport.height, top: window.visualViewport.offsetTop } : null);
		resize();
		window.visualViewport?.addEventListener("resize", resize);
		window.visualViewport?.addEventListener("scroll", resize);
		document.addEventListener("keydown", trap);
		return () => {
			original.forEach(([element, inert]) => { element.inert = inert; });
			document.removeEventListener("keydown", trap);
			window.visualViewport?.removeEventListener("resize", resize);
			window.visualViewport?.removeEventListener("scroll", resize);
			if (previousFocus?.isConnected) previousFocus.focus();
		};
	}, []);

	const bottom = () => {
		if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
		nearBottom.current = true;
		setNewMessages(false);
	};
	useLayoutEffect(() => {
		const element = scroll.current;
		if (!element) return;
		if (prepend.current && !chat.loadingOlder) {
			element.scrollTop = prepend.current.top + element.scrollHeight - prepend.current.height;
			prepend.current = null;
		} else {
			const last = chat.messages.at(-1);
			const key = last?.id || last?.client_message_id;
			if (initialScroll.current && key !== previousLast.current && last?.sender_id !== user.id) {
				setAnnouncement(`New message from ${peer}: ${last?.body?.slice(0, 240) || ""}`);
			}
			if ((!initialScroll.current && chat.ready) || nearBottom.current || (key !== previousLast.current && last?.sender_id === user.id)) {
				bottom();
				if (chat.ready) initialScroll.current = true;
			} else if (key !== previousLast.current) setNewMessages(true);
			previousLast.current = key;
		}
	}, [chat.messages, chat.ready, chat.loadingOlder, user.id, peer]);
	useLayoutEffect(() => {
		if (!input.current) return;
		input.current.style.height = "auto";
		input.current.style.height = `${Math.min(input.current.scrollHeight, 128)}px`;
	}, [chat.draft]);

	const incoming = chat.messages.filter((m) => m.id && m.sender_id !== user.id).at(-1)?.id;
	const { markRead } = chat;
	useEffect(() => {
		const markVisible = () => {
			if (nearBottom.current && document.visibilityState === "visible" && document.hasFocus()) markRead(incoming);
		};
		// Let layout/scroll settle before marking the visible conversation read.
		const timeout = setTimeout(markVisible, 400);
		const interval = setInterval(markVisible, 5000);
		const element = scroll.current;
		element?.addEventListener("scroll", markVisible);
		window.addEventListener("focus", markVisible);
		document.addEventListener("visibilitychange", markVisible);
		return () => {
			clearTimeout(timeout); clearInterval(interval);
			element?.removeEventListener("scroll", markVisible);
			window.removeEventListener("focus", markVisible);
			document.removeEventListener("visibilitychange", markVisible);
		};
	}, [incoming, markRead, chat.ready]);

	const submit = (event) => {
		event.preventDefault();
		if (!chat.ready || chat.denied || !chat.draft.trim()) return;
		nearBottom.current = true;
		chat.send(chat.draft);
		input.current?.focus();
	};
	const older = async () => {
		prepend.current = { height: scroll.current.scrollHeight, top: scroll.current.scrollTop };
		await chat.loadOlder();
	};
	return createPortal(<div ref={layer} className="tg-chat-layer" style={viewport ? { "--chat-height": `${viewport.height}px`, "--chat-top": `${viewport.top}px` } : undefined}>
		<div className="tg-chat-backdrop" onClick={onClose} aria-hidden="true" />
		<section ref={panel} className="tg-chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title" aria-describedby="chat-description">
			<header className="tg-chat-header">
				<button type="button" onClick={onClose} className="tg-chat-icon tg-chat-back" aria-label="Close chat"><ChevronLeft size={22} /></button>
				<div className="tg-chat-avatar" aria-hidden="true">{initials}</div>
				<div className="min-w-0 flex-1">
					<p className="tg-chat-eyebrow">Booking conversation</p>
					<h2 id="chat-title" className="truncate text-lg font-semibold text-white">{peer}</h2>
					<p id="chat-description" className="mt-1 flex items-center gap-1.5 text-xs text-stone-400"><LockKeyhole size={11} aria-hidden="true" /> Just you and your {user.role === "provider" ? "customer" : "provider"}</p>
				</div>
				<button type="button" onClick={onClose} className="tg-chat-icon tg-chat-close" aria-label="Close chat"><X size={20} /></button>
			</header>
			<div className="tg-chat-booking">
				<div className="min-w-0"><p className="truncate text-sm font-medium text-stone-200">{booking.service_name || "Your service booking"}</p>
					<p className="mt-1 text-[11px] text-stone-400">{booking.date ? new Date(booking.date).toLocaleDateString([], { day: "numeric", month: "short" }) : "Scheduled service"}<span className="mx-2 text-stone-600">/</span><span className="font-mono">#{booking.booking_id.slice(0, 8).toUpperCase()}</span></p></div>
				<span className="tg-chat-status">{(booking.status || "booked").replaceAll("_", " ")}</span>
			</div>
			{connection !== "connected" && <div role="status" className="tg-chat-connection"><WifiOff size={13} />{connection === "expired" ? "Session expired. Sign in again to reconnect." : "Reconnecting… Messages also sync when you return."}</div>}
			{chat.error && <div role="alert" className="tg-chat-error"><span>{chat.error}</span>{!chat.denied && <button type="button" onClick={chat.refresh}><RefreshCw size={13} /> Retry</button>}</div>}
			<div className="tg-chat-scroll" ref={scroll} tabIndex={0} aria-label="Conversation messages" onScroll={() => {
				const element = scroll.current;
				nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
				if (nearBottom.current) setNewMessages(false);
			}}>
				{!chat.ready && !chat.error ? <div className="tg-chat-loading" role="status"><LoaderCircle className="animate-spin" size={22} /><span>Loading your conversation…</span></div> : null}
				{chat.older && <button type="button" className="tg-chat-older" onClick={older} disabled={chat.loadingOlder}>{chat.loadingOlder ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />} Earlier messages</button>}
				{chat.ready && !chat.messages.length && <div className="tg-chat-empty">
					<div className="tg-chat-empty-art"><MessageCircle size={32} strokeWidth={1.4} /><span aria-hidden="true">✦</span></div>
					<p className="tg-chat-eyebrow">A little hello goes a long way</p>
					<h3 className="font-mackinac text-2xl text-white">Good service starts<br />with a conversation.</h3>
					<p className="mx-auto mt-3 max-w-64 text-sm leading-relaxed text-stone-400">Share arrival details, ask a question, or simply say hello to {peer.split(" ")[0]}.</p>
					<button type="button" className="tg-chat-starter" onClick={() => { chat.setDraft("Hi! I’d like to check a few details about our booking."); input.current?.focus(); }}>Say hello <ArrowUp size={13} /></button>
				</div>}
				<ol className="tg-chat-messages" aria-label="Message history">
					{chat.messages.map((message, index) => {
						const mine = message.sender_id === user.id;
						const date = day(message.created_at);
						const showDate = !index || day(chat.messages[index - 1].created_at) !== date;
						return <li key={`${message.sender_id}:${message.client_message_id}`}>
							{showDate && <div className="tg-chat-date"><span>{date}</span></div>}
							<div className={`tg-chat-message ${mine ? "is-mine" : "is-theirs"}`}>
								<span className="sr-only">{mine ? "You" : peer}: </span>
								<div className={`tg-chat-bubble ${message.status === "failed" ? "is-failed" : ""}`}>{message.body}</div>
								<div className="tg-chat-meta"><time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>{time(message.created_at)}</time>
									{mine && <span className={message.read_at ? "tg-chat-read" : ""}>{message.status === "sending" ? <><LoaderCircle size={12} className="animate-spin" /> Sending</> : message.status === "failed" ? "Not sent" : message.read_at ? <><CheckCheck size={14} /> Read</> : <><Check size={13} /> Sent</>}</span>}
								</div>
								{message.status === "failed" && <div className="tg-chat-failed" role="status"><p>{message.error || "Delivery unconfirmed."}</p><button type="button" onClick={() => chat.send(message.body, message)}>Retry message <RefreshCw size={12} /></button></div>}
							</div>
						</li>;
					})}
				</ol>
			</div>
			{newMessages && <button type="button" className="tg-chat-jump" onClick={bottom}><ArrowDown size={14} /> New messages</button>}
			<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}{newMessages ? " New messages below. Use the New messages button to view them." : ""}</div>
			<form className="tg-chat-composer" onSubmit={submit}>
				<div className="tg-chat-input-wrap">
					<label htmlFor="booking-chat-message" className="sr-only">Message to {peer}</label>
					<textarea ref={input} id="booking-chat-message" rows={1} maxLength={4000} value={chat.draft} disabled={!chat.ready || chat.denied}
						placeholder="Write a message…" onChange={(event) => chat.setDraft(event.target.value.replaceAll("\0", ""))}
						onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) submit(event); }} />
					<button type="submit" className="tg-chat-send" aria-label="Send message" disabled={!chat.ready || chat.denied || !chat.draft.trim()}><ArrowUp size={20} /></button>
				</div>
				<div className="tg-chat-composer-note"><span>Keep booking details in one place.</span><span>{chat.draft.length > 3500 ? `${chat.draft.length}/4000` : ""}</span></div>
			</form>
		</section>
	</div>, document.body);
}
