import React from "react";
import {
	X,
	ShieldAlert,
	AlertTriangle,
	Ban,
	RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MODERATION_STATUS_BADGES } from "./ModerationQueue";

export default function ReportDrawer({
	selectedReport,
	onClose,
	reportMessages,
	loadingReportDetails,
	admins,
	currentUserId,
	onAssign,
	actionModal,
	setActionModal,
	actionInProgress,
	onExecuteAction,
}) {
	if (!selectedReport) return null;

	const isReportedProvider =
		selectedReport.reported_role === "provider" ||
		Boolean(selectedReport.reported_custom_id?.startsWith("SRV"));

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
					<div className="p-4 sm:p-5 border-b border-white/[0.08] bg-[#1a0a20] flex items-start justify-between gap-4">
						<div className="space-y-1">
							<div className="flex items-center gap-2">
								<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
									{selectedReport.reason?.replace(/_/g, " ")}
								</span>
								<span
									className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
										MODERATION_STATUS_BADGES[selectedReport.status] ||
										MODERATION_STATUS_BADGES.pending
									}`}
								>
									{selectedReport.status}
								</span>
							</div>
							<h3 className="font-bold text-base text-white">
								Chat Safety Report Investigation
							</h3>
							<div className="text-[11px] text-slate-400">
								Booking:{" "}
								<span className="font-mono text-violet-300">
									#{selectedReport.booking_id}
								</span>{" "}
								• Submitted:{" "}
								{new Date(selectedReport.created_at).toLocaleString()}
							</div>
						</div>

						<button
							onClick={onClose}
							className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
						>
							<X size={18} />
						</button>
					</div>

					{/* Parties Involved Dossier */}
					<div className="p-4 bg-white/[0.02] border-b border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
						{/* Reported User */}
						<div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 space-y-1">
							<span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
								Reported Party (Subject)
							</span>
							<div className="font-bold text-white text-sm">
								{selectedReport.reported_name}
							</div>
							<div className="text-slate-300">
								{selectedReport.reported_email}
							</div>
							<div className="flex items-center gap-2 pt-1">
								<span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 capitalize">
									{selectedReport.reported_role || "User"}
								</span>
								{selectedReport.reported_custom_id && (
									<span className="font-mono text-[10px] text-amber-300">
										{selectedReport.reported_custom_id}
									</span>
								)}
							</div>
						</div>

						{/* Reporter */}
						<div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
							<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
								Filing Party (Reporter)
							</span>
							<div className="font-bold text-white text-sm">
								{selectedReport.reporter_name}
							</div>
							<div className="text-slate-300">
								{selectedReport.reporter_email}
							</div>
							<div className="pt-1">
								<span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-slate-300 capitalize">
									{selectedReport.reporter_role || "customer"}
								</span>
							</div>
						</div>
					</div>

					{/* Details & Chat Transcript */}
					<div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
						{/* Reporter Statement */}
						<div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
							<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
								Reporter Statement / Details
							</span>
							<p className="text-slate-200 text-xs sm:text-sm whitespace-pre-wrap">
								{selectedReport.details || "No additional text provided."}
							</p>
						</div>

						{/* Audit / Action Log if already actioned */}
						{(selectedReport.action_taken ||
							selectedReport.resolution_notes) && (
							<div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
								<span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
									Resolution Audit Trail
								</span>
								{selectedReport.action_taken && (
									<div>
										<span className="text-slate-400 text-[11px]">
											Action Taken:
										</span>{" "}
										<strong className="text-emerald-300">
											{selectedReport.action_taken}
										</strong>
									</div>
								)}
								{selectedReport.resolution_notes && (
									<div className="text-slate-300 text-[11px]">
										Notes: {selectedReport.resolution_notes}
									</div>
								)}
								{selectedReport.resolved_by_name && (
									<div className="text-slate-400 text-[10px]">
										Investigator: {selectedReport.resolved_by_name} •{" "}
										{new Date(selectedReport.resolved_at).toLocaleString()}
									</div>
								)}
							</div>
						)}

						{/* Conversation Chat Inspector */}
						<div className="space-y-2">
							<div className="flex items-center justify-between text-[11px] text-slate-400">
								<span className="font-bold uppercase tracking-wider block">
									Surrounding Booking Conversation Context
								</span>
								{selectedReport.message_id && (
									<span className="text-rose-400 font-mono text-[10px]">
										Centered on Message #{selectedReport.message_id}
									</span>
								)}
							</div>

							{loadingReportDetails ? (
								<div className="p-6 text-center text-slate-400">
									<RefreshCw
										size={18}
										className="animate-spin mx-auto text-rose-400 mb-1"
									/>
									<span>Loading chat messages...</span>
								</div>
							) : reportMessages.length === 0 ? (
								<div className="p-4 rounded-xl bg-black/30 border border-white/5 text-center text-slate-500">
									No chat messages recorded in this conversation.
								</div>
							) : (
								<div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2 max-h-[300px] overflow-y-auto">
									{reportMessages.map((msg) => {
										const isReportedUserMsg =
											msg.sender_id === selectedReport.reported_user_id;
										const isFlaggedMsg =
											selectedReport.message_id &&
											String(msg.id) === String(selectedReport.message_id);

										// Render body or message fallback
										const textContent =
											msg.body || msg.message || msg.content || "";

										return (
											<div
												key={msg.id}
												className={`p-2.5 rounded-lg text-xs space-y-1 transition ${
													isFlaggedMsg
														? "bg-rose-950/70 border-2 border-rose-500 text-rose-100 shadow-md shadow-rose-950/50"
														: isReportedUserMsg
														? "bg-white/[0.04] text-slate-200 border border-transparent"
														: "bg-violet-950/20 text-slate-300 border border-transparent"
												}`}
											>
												<div className="flex items-center justify-between text-[10px] text-slate-400">
													<span
														className={`font-semibold flex items-center gap-1.5 ${
															isReportedUserMsg
																? "text-rose-300"
																: "text-violet-300"
														}`}
													>
														<span>{msg.sender_name}</span>
														<span className="text-slate-500 font-normal">
															({msg.sender_role || "user"})
														</span>
														{isFlaggedMsg && (
															<span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-bold text-[9px] tracking-wide">
																REPORTED MESSAGE
															</span>
														)}
													</span>
													<span>
														{new Date(msg.created_at).toLocaleTimeString([], {
															hour: "2-digit",
															minute: "2-digit",
														})}
													</span>
												</div>
												<p className="whitespace-pre-wrap leading-relaxed">
													{textContent || (
														<span className="italic text-slate-500">
															[Empty message body]
														</span>
													)}
												</p>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>

					{/* Actions Toolbar */}
					<div className="p-4 border-t border-white/[0.08] bg-[#160a1d] flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<span className="text-slate-400">Investigator:</span>
							<select
								value={selectedReport.assigned_to || ""}
								onChange={(e) => onAssign(selectedReport.id, e.target.value)}
								className="px-2.5 py-1 rounded-md bg-black/40 border border-white/10 text-rose-200 focus:outline-none focus:border-rose-500 cursor-pointer"
							>
								<option value="">Unassigned</option>
								{admins.map((adm) => (
									<option key={adm.id} value={adm.id}>
										{adm.name || adm.email}
									</option>
								))}
							</select>
							{selectedReport.assigned_to !== currentUserId && (
								<button
									onClick={() => onAssign(selectedReport.id, "me")}
									className="px-2 py-1 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 font-semibold cursor-pointer transition"
								>
									Assign to Me
								</button>
							)}
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<button
								onClick={() =>
									setActionModal({
										isOpen: true,
										type: "warn",
										warningMessage:
											"A safety report was filed regarding your recent conduct on TaskGenie. Please adhere strictly to community guidelines to prevent account restrictions.",
										notes: "Issued formal warning notice.",
									})
								}
								className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold cursor-pointer transition flex items-center gap-1.5"
							>
								<AlertTriangle size={13} />
								<span>Warn User</span>
							</button>

							{isReportedProvider && (
								<button
									onClick={() =>
										setActionModal({
											isOpen: true,
											type: "suspend",
											warningMessage: "",
											notes:
												"Suspended provider account due to chat safety violation.",
										})
									}
									className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold cursor-pointer transition flex items-center gap-1.5"
								>
									<Ban size={13} />
									<span>Suspend Provider</span>
								</button>
							)}

							<button
								onClick={() =>
									setActionModal({
										isOpen: true,
										type: "dismiss",
										warningMessage: "",
										notes:
											"Dismissed after investigation. No actionable violation found.",
									})
								}
								className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-semibold cursor-pointer transition"
							>
								Dismiss Report
							</button>
						</div>
					</div>
				</motion.div>
			</div>

			{/* Action Confirmation Modal */}
			<AnimatePresence>
				{actionModal.isOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
						<motion.div
							initial={{ opacity: 0, scale: 0.96 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.96 }}
							className="w-full max-w-md p-5 rounded-2xl bg-[#140a1d] border border-white/10 shadow-2xl space-y-4 text-xs"
						>
							<div className="flex items-center gap-2 text-rose-400">
								<ShieldAlert size={20} />
								<h3 className="font-bold text-base text-white capitalize">
									Confirm Action: {actionModal.type}
								</h3>
							</div>

							<p className="text-slate-300 leading-relaxed">
								{actionModal.type === "warn" && (
									<>
										This will issue an official safety warning notification to{" "}
										<strong className="text-white">
											{selectedReport?.reported_name}
										</strong>
										.
									</>
								)}
								{actionModal.type === "suspend" && (
									<>
										This will immediately suspend provider{" "}
										<strong className="text-white">
											{selectedReport?.reported_name}
										</strong>{" "}
										from accepting bookings and invalidate their catalog caches.
									</>
								)}
								{actionModal.type === "dismiss" && (
									<>
										Mark this report as dismissed with no policy violation
										found.
									</>
								)}
							</p>

							{actionModal.type === "warn" && (
								<div className="space-y-1">
									<label className="text-[11px] font-semibold text-slate-400">
										Warning Notice (Sent to User):
									</label>
									<textarea
										rows="3"
										value={actionModal.warningMessage}
										onChange={(e) =>
											setActionModal((prev) => ({
												...prev,
												warningMessage: e.target.value,
											}))
										}
										className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-rose-500"
									/>
								</div>
							)}

							<div className="space-y-1">
								<label className="text-[11px] font-semibold text-slate-400">
									Staff Resolution Notes:
								</label>
								<textarea
									rows="2"
									value={actionModal.notes}
									onChange={(e) =>
										setActionModal((prev) => ({
											...prev,
											notes: e.target.value,
										}))
									}
									className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-rose-500"
								/>
							</div>

							<div className="flex justify-end gap-2 pt-2">
								<button
									onClick={() =>
										setActionModal({
											isOpen: false,
											type: "",
											warningMessage: "",
											notes: "",
										})
									}
									className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
								>
									Cancel
								</button>
								<button
									disabled={actionInProgress}
									onClick={onExecuteAction}
									className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer transition disabled:opacity-50"
								>
									{actionInProgress ? "Applying..." : "Confirm & Execute"}
								</button>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</>
	);
}
