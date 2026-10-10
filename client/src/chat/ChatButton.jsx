import { MessageCircle } from "lucide-react";
import { useChat } from "./ChatContext";

export default function ChatButton({ booking, onOpen, className = "" }) {
	const chat = useChat();
	if (!booking?.booking_id || !chat) return null;
	const count = chat.unread[booking.booking_id] || 0;
	return <button type="button" onClick={(event) => { event.stopPropagation(); chat.openChat(booking); onOpen?.(); }}
		aria-label={`Chat about ${booking.service_name || "this booking"}${count ? `, ${count} unread messages` : ""}`}
		className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-400/25 bg-violet-400/10 px-3 text-xs font-semibold text-violet-200 transition-colors hover:border-violet-300/50 hover:bg-violet-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${className}`}>
		<MessageCircle size={15} aria-hidden="true" /> Chat
		{count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-300 px-1 text-[10px] font-bold text-violet-950">{count > 99 ? "99+" : count}</span>}
	</button>;
}
