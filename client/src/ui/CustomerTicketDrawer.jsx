import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
	X,
	LifeBuoy,
	MessageSquare,
	Send,
	Clock,
	CheckCircle2,
	RefreshCw,
	ChevronRight,
	AlertCircle,
	Search,
	Key,
	Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import api from "../api/axiosInstance";
import { useAuth } from "../contexts/AuthContext";

const STATUS_PILLS = {
	open: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
	in_progress: "bg-amber-500/10 text-amber-700 border-amber-200",
	resolved: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
	closed: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function CustomerTicketDrawer({
	isOpen,
	onClose,
	initialTicketNumber = null,
	initialToken = null,
}) {
	const { user } = useAuth();
	const [activeView, setActiveView] = useState("list"); // "list" | "thread" | "lookup"

	// Tickets list state (for authenticated users)
	const [myTickets, setMyTickets] = useState([]);
	const [loadingList, setLoadingList] = useState(false);

	// Thread view state
	const [currentTicketNumber, setCurrentTicketNumber] = useState(initialTicketNumber);
	const [currentToken, setCurrentToken] = useState(initialToken);
	const [ticketDetail, setTicketDetail] = useState(null);
	const [replies, setReplies] = useState([]);
	const [loadingThread, setLoadingThread] = useState(false);
	const [replyText, setReplyText] = useState("");
	const [sendingReply, setSendingReply] = useState(false);

	// Guest Lookup Form state
	const [lookupNumber, setLookupNumber] = useState("");
	const [lookupToken, setLookupToken] = useState("");
	const [lookupError, setLookupError] = useState("");

	// 1. Fetch user's tickets if authenticated
	const fetchMyTickets = useCallback(async () => {
		if (!user) return;
		setLoadingList(true);
		try {
			const res = await api.get("/api/support/my-tickets");
			if (res.data?.success) {
				setMyTickets(res.data.tickets || []);
			}
		} catch (err) {
			console.warn("Could not load customer tickets:", err);
		} finally {
			setLoadingList(false);
		}
	}, [user]);

	// 2. Fetch specific ticket thread
	const loadTicketThread = useCallback(
		async (ticketNum, token = null) => {
			if (!ticketNum) return;
			setLoadingThread(true);
			setReplyText("");
			try {
				const config = {};
				if (token) {
					config.headers = { "x-ticket-token": token };
				}
				const res = await api.get(`/api/support/tickets/${ticketNum}`, config);
				if (res.data?.success) {
					setTicketDetail(res.data.ticket);
					setReplies(res.data.replies || []);
					setCurrentTicketNumber(ticketNum);
					if (token) setCurrentToken(token);
					setActiveView("thread");
				}
			} catch (err) {
				console.error("Failed to load ticket thread:", err);
				toast.error(
					err.response?.data?.error ||
						"Unable to access ticket. Please check credentials or sign in."
				);
			} finally {
				setLoadingThread(false);
			}
		},
		[]
	);

	// Initial load behavior
	useEffect(() => {
		if (isOpen) {
			if (initialTicketNumber) {
				loadTicketThread(initialTicketNumber, initialToken);
			} else if (user) {
				setActiveView("list");
				fetchMyTickets();
			} else {
				setActiveView("lookup");
			}
		}
	}, [isOpen, initialTicketNumber, initialToken, user, fetchMyTickets, loadTicketThread]);

	// Listen for global custom events to open specific ticket
	useEffect(() => {
		const handleOpenTicketEvent = (e) => {
			if (e.detail?.ticketNumber) {
				loadTicketThread(e.detail.ticketNumber, e.detail.token || null);
			}
		};
		window.addEventListener("open:support-ticket", handleOpenTicketEvent);
		return () => {
			window.removeEventListener("open:support-ticket", handleOpenTicketEvent);
		};
	}, [loadTicketThread]);

	// Submit customer reply
	const handleSendReply = async (e) => {
		e.preventDefault();
		if (!replyText.trim() || sendingReply || !currentTicketNumber) return;
		setSendingReply(true);
		try {
			const config = {};
			if (currentToken) {
				config.headers = { "x-ticket-token": currentToken };
			}
			const res = await api.post(
				`/api/support/tickets/${currentTicketNumber}/reply`,
				{ message: replyText.trim(), token: currentToken },
				config
			);
			if (res.data?.success) {
				toast.success("Reply sent to support team");
				setReplyText("");
				loadTicketThread(currentTicketNumber, currentToken);
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to submit reply");
		} finally {
			setSendingReply(false);
		}
	};

	// Guest ticket lookup
	const handleLookupSubmit = (e) => {
		e.preventDefault();
		setLookupError("");
		if (!lookupNumber.trim()) {
			setLookupError("Please enter your Ticket Number (e.g. TKT-123456)");
			return;
		}
		loadTicketThread(lookupNumber.trim(), lookupToken.trim() || null);
	};

	if (!isOpen) return null;

	const content = (
		<AnimatePresence>
			<div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
				{/* Backdrop */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
					className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
				/>

				{/* Modal / Drawer Box */}
				<motion.div
					initial={{ opacity: 0, scale: 0.96, y: 15 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.96, y: 15 }}
					className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto z-10 text-xs sm:text-sm"
				>
					{/* Header */}
					<div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
						<div className="flex items-center gap-2.5">
							<div className="p-2 rounded-xl bg-violet-100 text-violet-700">
								<LifeBuoy size={20} />
							</div>
							<div>
								<h2 className="font-mackinac text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
									{activeView === "thread" && ticketDetail
										? `Ticket #${ticketDetail.ticket_number}`
										: "My Support Tickets"}
								</h2>
								<p className="bricolage-grotesque text-xs text-slate-500">
									{activeView === "thread"
										? ticketDetail?.subject
										: "View responses from TaskGenie operations desk and reply"}
								</p>
							</div>
						</div>

						<div className="flex items-center gap-2">
							{activeView === "thread" && user && (
								<button
									onClick={() => {
										setActiveView("list");
										fetchMyTickets();
									}}
									className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-700 transition cursor-pointer"
								>
									Back to Tickets
								</button>
							)}
							<button
								onClick={onClose}
								className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
							>
								<X size={18} />
							</button>
						</div>
					</div>

					{/* View 1: Authenticated Customer Tickets List */}
					{activeView === "list" && (
						<div className="flex-1 overflow-y-auto p-5 space-y-4">
							<div className="flex items-center justify-between">
								<span className="font-bold text-slate-700 uppercase tracking-wider text-xs">
									Your Ticket History
								</span>
								<button
									onClick={fetchMyTickets}
									className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-semibold cursor-pointer"
								>
									<RefreshCw
										size={12}
										className={loadingList ? "animate-spin" : ""}
									/>
									<span>Refresh</span>
								</button>
							</div>

							{loadingList ? (
								<div className="py-12 text-center text-slate-400">
									<RefreshCw
										size={20}
										className="animate-spin mx-auto text-violet-600 mb-2"
									/>
									<span>Loading your tickets...</span>
								</div>
							) : myTickets.length === 0 ? (
								<div className="py-12 text-center text-slate-500 space-y-2 border border-dashed border-slate-200 rounded-2xl">
									<MessageSquare size={32} className="mx-auto text-slate-300" />
									<p className="font-semibold text-slate-700">
										No support tickets on record yet.
									</p>
									<p className="text-xs text-slate-500">
										When you open an inquiry or dispute, staff replies will
										appear here.
									</p>
								</div>
							) : (
								<div className="space-y-2.5">
									{myTickets.map((t) => (
										<div
											key={t.id}
											onClick={() => loadTicketThread(t.ticket_number)}
											className="p-4 rounded-2xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50/20 transition cursor-pointer flex items-center justify-between gap-3 shadow-xs"
										>
											<div className="space-y-1 min-w-0">
												<div className="flex items-center gap-2">
													<span className="font-mono font-bold text-violet-700 text-xs">
														#{t.ticket_number}
													</span>
													<span
														className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
															STATUS_PILLS[t.status] || STATUS_PILLS.open
														}`}
													>
														{t.status}
													</span>
													<span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] capitalize">
														{t.category ? t.category.replace("_", " ") : "general"}
													</span>
												</div>
												<h4 className="font-bold text-slate-900 truncate text-sm">
													{t.subject}
												</h4>
												<div className="text-[11px] text-slate-400 flex items-center gap-3">
													<span>
														Created: {new Date(t.created_at).toLocaleDateString()}
													</span>
													<span>•</span>
													<span className="text-violet-600 font-semibold flex items-center gap-1">
														<MessageSquare size={11} />
														{t.reply_count || 0} replies
													</span>
												</div>
											</div>

											<ChevronRight size={18} className="text-slate-400 shrink-0" />
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* View 2: Guest Ticket Lookup */}
					{activeView === "lookup" && (
						<div className="flex-1 overflow-y-auto p-6 space-y-5">
							<div className="p-4 rounded-2xl bg-violet-50 border border-violet-100 space-y-1">
								<h3 className="font-bold text-violet-950 text-sm flex items-center gap-2">
									<Key size={16} className="text-violet-600" />
									Guest Ticket Tracker
								</h3>
								<p className="text-xs text-violet-800 leading-relaxed">
									If you submitted a ticket without signing into an account, enter
									your Ticket Number and Access Token to read staff replies and
									respond.
								</p>
							</div>

							<form onSubmit={handleLookupSubmit} className="space-y-4">
								{lookupError && (
									<div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
										<AlertCircle size={14} className="shrink-0" />
										<span>{lookupError}</span>
									</div>
								)}

								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
										Ticket Number *
									</label>
									<input
										type="text"
										placeholder="e.g. TKT-98F1B2"
										value={lookupNumber}
										onChange={(e) => setLookupNumber(e.target.value)}
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-500 font-mono"
										required
									/>
								</div>

								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
										Access Token
									</label>
									<input
										type="text"
										placeholder="Paste access token from ticket creation screen"
										value={lookupToken}
										onChange={(e) => setLookupToken(e.target.value)}
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-500 font-mono text-xs"
									/>
									<span className="text-[11px] text-slate-400 block">
										Token was generated when you opened your inquiry.
									</span>
								</div>

								<button
									type="submit"
									disabled={loadingThread}
									className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
								>
									{loadingThread ? (
										<RefreshCw size={14} className="animate-spin" />
									) : (
										<Search size={14} />
									)}
									<span>Find Ticket</span>
								</button>
							</form>
						</div>
					)}

					{/* View 3: Ticket Thread View (Messages + Customer Reply) */}
					{activeView === "thread" && (
						<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
							{loadingThread ? (
								<div className="py-16 text-center text-slate-400">
									<RefreshCw
										size={24}
										className="animate-spin mx-auto text-violet-600 mb-2"
									/>
									<span>Loading ticket conversation...</span>
								</div>
							) : ticketDetail ? (
								<>
									{/* Ticket Status Bar */}
									<div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
										<div className="flex items-center gap-2">
											<span
												className={`px-2 py-0.5 rounded-full font-semibold border capitalize text-[10px] ${
													STATUS_PILLS[ticketDetail.status] ||
													STATUS_PILLS.open
												}`}
											>
												{ticketDetail.status}
											</span>
											<span className="text-slate-400">
												Assigned:{" "}
												<strong>
													{ticketDetail.assignee_name || "TaskGenie Desk"}
												</strong>
											</span>
										</div>
										<span className="text-slate-400 text-[11px]">
											Response SLA: Under 2 to 4 Hours
										</span>
									</div>

									{/* Messages Scroll Area */}
									<div className="flex-1 overflow-y-auto p-5 space-y-4">
										{/* Customer's Original Issue */}
										<div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
											<div className="flex items-center justify-between text-[11px] text-slate-400">
												<span className="font-bold text-slate-700">
													You (Initial Inquiry)
												</span>
												<span>
													{new Date(ticketDetail.created_at).toLocaleString()}
												</span>
											</div>
											<p className="text-slate-800 whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
												{ticketDetail.message}
											</p>
										</div>

										{/* Replies List */}
										{replies.length === 0 ? (
											<div className="text-center py-6 text-slate-400 space-y-1">
												<Clock size={24} className="mx-auto text-violet-400 mb-1" />
												<p className="font-semibold text-slate-700 text-xs">
													Awaiting staff review
												</p>
												<p className="text-[11px] text-slate-500">
													Our customer operations desk is reviewing your ticket.
													Replies will appear here shortly.
												</p>
											</div>
										) : (
											replies.map((rep) => {
												const isStaff = rep.sender_role === "admin";
												return (
													<div
														key={rep.id}
														className={`p-4 rounded-2xl space-y-1.5 ${
															isStaff
																? "bg-violet-50/80 border border-violet-200 ml-4 sm:ml-8"
																: "bg-slate-50 border border-slate-200 mr-4 sm:mr-8"
														}`}
													>
														<div className="flex items-center justify-between text-[11px]">
															<span
																className={`font-bold ${
																	isStaff ? "text-violet-900" : "text-slate-700"
																}`}
															>
																{rep.sender_name}{" "}
																{isStaff && (
																	<span className="ml-1 px-1.5 py-0.2 rounded text-[9px] bg-violet-600 text-white font-bold uppercase">
																		Support Specialist
																	</span>
																)}
															</span>
															<span className="text-slate-400">
																{new Date(rep.created_at).toLocaleString()}
															</span>
														</div>
														<p className="text-slate-800 whitespace-pre-wrap text-xs sm:text-sm leading-relaxed">
															{rep.message}
														</p>
													</div>
												);
											})
										)}
									</div>

									{/* Reply Composer */}
									<form
										onSubmit={handleSendReply}
										className="p-4 border-t border-slate-100 bg-slate-50 space-y-2.5"
									>
										<textarea
											rows="2"
											placeholder="Type your response to support staff..."
											value={replyText}
											onChange={(e) => setReplyText(e.target.value)}
											className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-violet-500 resize-none shadow-xs"
											required
										/>
										<div className="flex justify-end">
											<button
												type="submit"
												disabled={!replyText.trim() || sendingReply}
												className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
											>
												<Send size={13} />
												<span>{sendingReply ? "Sending..." : "Send Reply"}</span>
											</button>
										</div>
									</form>
								</>
							) : null}
						</div>
					)}
				</motion.div>
			</div>
		</AnimatePresence>
	);

	return createPortal(content, document.body);
}
