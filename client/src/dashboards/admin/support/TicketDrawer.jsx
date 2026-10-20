import React from "react";
import {
	X,
	Lock,
	Send,
	RefreshCw,
	CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
	TICKET_STATUS_BADGES,
	TICKET_PRIORITY_BADGES,
} from "./TicketQueue";

export default function TicketDrawer({
	selectedTicket,
	onClose,
	ticketReplies,
	loadingTicketThread,
	admins,
	currentUserId,
	onAssign,
	onSendReply,
	replyMessage,
	setReplyMessage,
	isInternalNote,
	setIsInternalNote,
	replyStatusTransition,
	setReplyStatusTransition,
	submittingReply,
	onResolve,
	showResolveModal,
	setShowResolveModal,
	resolutionNotes,
	setResolutionNotes,
}) {
	if (!selectedTicket) return null;

	return (
		<>
			<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
				<motion.div
					initial={{ opacity: 0, scale: 0.96 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.96 }}
					className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#110a22] border border-white/10 shadow-2xl overflow-hidden text-xs"
				>
					{/* Drawer Header */}
					<div className="p-4 sm:p-5 border-b border-white/[0.08] bg-[#160d2e] flex items-start justify-between gap-4">
						<div className="space-y-1">
							<div className="flex items-center gap-2">
								<span className="font-mono font-bold text-violet-300 text-sm">
									#{selectedTicket.ticket_number}
								</span>
								<span
									className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
										TICKET_STATUS_BADGES[selectedTicket.status] ||
										TICKET_STATUS_BADGES.open
									}`}
								>
									{selectedTicket.status}
								</span>
								<span
									className={`px-2 py-0.5 rounded-full text-[10px] border capitalize ${
										TICKET_PRIORITY_BADGES[selectedTicket.priority] ||
										TICKET_PRIORITY_BADGES.normal
									}`}
								>
									{selectedTicket.priority}
								</span>
							</div>
							<h3 className="font-bold text-base text-white">
								{selectedTicket.subject}
							</h3>
							<div className="flex items-center gap-3 text-slate-400 text-[11px]">
								<span>
									From: <strong>{selectedTicket.name}</strong> (
									{selectedTicket.email})
								</span>
								<span>•</span>
								<span className="capitalize">
									Role: {selectedTicket.role || "customer"}
								</span>
							</div>
						</div>

						<button
							onClick={onClose}
							className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
						>
							<X size={18} />
						</button>
					</div>

					{/* Ownership & Status Bar */}
					<div className="p-3 bg-white/[0.02] border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
						<div className="flex items-center gap-2">
							<span className="text-slate-400 font-medium">Assigned:</span>
							<select
								value={selectedTicket.assigned_to || ""}
								onChange={(e) => onAssign(selectedTicket.id, e.target.value)}
								className="px-2.5 py-1 rounded-md bg-black/40 border border-white/10 text-violet-200 focus:outline-none focus:border-violet-500 cursor-pointer"
							>
								<option value="">Unassigned</option>
								{admins.map((adm) => (
									<option key={adm.id} value={adm.id}>
										{adm.name || adm.email}
									</option>
								))}
							</select>
							{selectedTicket.assigned_to !== currentUserId && (
								<button
									onClick={() => onAssign(selectedTicket.id, "me")}
									className="px-2 py-1 rounded bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 font-semibold cursor-pointer transition"
								>
									Assign to Me
								</button>
							)}
						</div>

						<div className="flex items-center gap-2">
							<span className="text-slate-400 font-medium">Status:</span>
							{selectedTicket.status !== "resolved" && (
								<button
									onClick={() => setShowResolveModal(true)}
									className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer transition"
								>
									Resolve Ticket
								</button>
							)}
							{selectedTicket.status === "resolved" && (
								<button
									onClick={() => onResolve("open", "Reopened by staff")}
									className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-semibold cursor-pointer transition"
								>
									Reopen Ticket
								</button>
							)}
						</div>
					</div>

					{/* Conversation Thread */}
					<div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
						{/* Initial Description */}
						<div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
							<div className="flex items-center justify-between text-[11px] text-slate-400">
								<span className="font-semibold text-violet-300">
									Initial Ingestion • {selectedTicket.name}
								</span>
								<span>
									{new Date(selectedTicket.created_at).toLocaleString()}
								</span>
							</div>
							<p className="text-slate-200 whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
								{selectedTicket.message}
							</p>
						</div>

						{/* Replies */}
						{loadingTicketThread ? (
							<div className="p-6 text-center text-slate-400">
								<RefreshCw
									size={18}
									className="animate-spin mx-auto text-violet-400 mb-1"
								/>
								<span>Loading conversation thread...</span>
							</div>
						) : ticketReplies.length === 0 ? (
							<div className="text-center py-4 text-slate-500">
								No replies yet on this ticket.
							</div>
						) : (
							ticketReplies.map((reply) => {
								const isStaff = reply.sender_role === "admin";
								const isInternal = reply.is_internal;

								if (isInternal) {
									return (
										<div
											key={reply.id}
											className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1.5"
										>
											<div className="flex items-center justify-between text-[11px]">
												<span className="flex items-center gap-1.5 font-bold text-amber-300">
													<Lock size={12} />
													Internal Staff Note • {reply.sender_name}
												</span>
												<span className="text-amber-400/70">
													{new Date(reply.created_at).toLocaleString()}
												</span>
											</div>
											<p className="whitespace-pre-wrap text-xs text-amber-100/90">
												{reply.message}
											</p>
										</div>
									);
								}

								return (
									<div
										key={reply.id}
										className={`p-4 rounded-xl space-y-1.5 ${
											isStaff
												? "bg-violet-900/20 border border-violet-500/20 ml-6"
												: "bg-white/[0.03] border border-white/[0.06] mr-6"
										}`}
									>
										<div className="flex items-center justify-between text-[11px]">
											<span
												className={`font-semibold ${
													isStaff ? "text-violet-300" : "text-slate-300"
												}`}
											>
												{reply.sender_name}{" "}
												{isStaff && (
													<span className="ml-1 px-1.5 py-0.2 rounded text-[9px] bg-violet-600 text-white uppercase">
														Support Staff
													</span>
												)}
											</span>
											<span className="text-slate-500">
												{new Date(reply.created_at).toLocaleString()}
											</span>
										</div>
										<p className="text-slate-200 whitespace-pre-wrap text-xs sm:text-sm">
											{reply.message}
										</p>
									</div>
								);
							})
						)}
					</div>

					{/* Reply Composer */}
					<form
						onSubmit={onSendReply}
						className="p-4 border-t border-white/[0.08] bg-[#140c2b] space-y-3"
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setIsInternalNote(false)}
									className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition ${
										!isInternalNote
											? "bg-violet-600 text-white"
											: "text-slate-400 hover:text-white"
									}`}
								>
									Public Reply (To Customer)
								</button>
								<button
									type="button"
									onClick={() => setIsInternalNote(true)}
									className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition flex items-center gap-1 ${
										isInternalNote
											? "bg-amber-600 text-white"
											: "text-slate-400 hover:text-white"
									}`}
								>
									<Lock size={12} />
									Internal Note Only
								</button>
							</div>

							{!isInternalNote && (
								<select
									value={replyStatusTransition}
									onChange={(e) => setReplyStatusTransition(e.target.value)}
									className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-300 text-[11px]"
								>
									<option value="">Keep current status</option>
									<option value="in_progress">Set In Progress</option>
									<option value="resolved">Mark Resolved</option>
									<option value="closed">Close Ticket</option>
								</select>
							)}
						</div>

						<textarea
							rows="3"
							placeholder={
								isInternalNote
									? "Write a private internal note for staff audit..."
									: "Type response to customer (they will receive in-app notification)..."
							}
							value={replyMessage}
							onChange={(e) => setReplyMessage(e.target.value)}
							className={`w-full p-3 rounded-xl bg-black/40 border text-white placeholder-slate-500 focus:outline-none text-xs ${
								isInternalNote
									? "border-amber-500/40 focus:border-amber-500"
									: "border-white/10 focus:border-violet-500"
							}`}
						/>

						<div className="flex justify-end gap-2">
							<button
								type="submit"
								disabled={!replyMessage.trim() || submittingReply}
								className={`px-4 py-2 rounded-xl text-white font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 ${
									isInternalNote
										? "bg-amber-600 hover:bg-amber-500"
										: "bg-violet-600 hover:bg-violet-500"
								}`}
							>
								<Send size={13} />
								<span>
									{submittingReply
										? "Sending..."
										: isInternalNote
										? "Save Internal Note"
										: "Send Reply"}
								</span>
							</button>
						</div>
					</form>
				</motion.div>
			</div>

			{/* Resolve Modal */}
			<AnimatePresence>
				{showResolveModal && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
						<motion.div
							initial={{ opacity: 0, scale: 0.96 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.96 }}
							className="w-full max-w-md p-5 rounded-2xl bg-[#130b28] border border-white/10 shadow-2xl space-y-4 text-xs"
						>
							<div className="flex items-center gap-2 text-emerald-400">
								<CheckCircle2 size={18} />
								<h3 className="font-bold text-base text-white">
									Resolve Ticket #{selectedTicket.ticket_number}
								</h3>
							</div>
							<p className="text-slate-300">
								Add closing resolution notes explaining how this issue was
								addressed:
							</p>
							<textarea
								rows="3"
								placeholder="e.g. Refund issued, customer confirmed resolution..."
								value={resolutionNotes}
								onChange={(e) => setResolutionNotes(e.target.value)}
								className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
							/>
							<div className="flex justify-end gap-2">
								<button
									onClick={() => setShowResolveModal(false)}
									className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
								>
									Cancel
								</button>
								<button
									onClick={() => onResolve("resolved", resolutionNotes)}
									className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer transition"
								>
									Confirm Resolution
								</button>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</>
	);
}
