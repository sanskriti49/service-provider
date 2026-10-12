import { useState } from "react";
import {
	AlertCircle,
	CheckCircle2,
	ChevronLeft,
	LoaderCircle,
	ShieldAlert,
	X,
} from "lucide-react";
import { chatRequest } from "./chatTransport";

const REPORT_REASONS = [
	{
		id: "harassment",
		label: "Harassment or Abuse",
		description: "Insults, threats, or inappropriate behavior.",
	},
	{
		id: "off_platform_payment",
		label: "Payment or Scam",
		description: "Asking for payment outside TaskGenie or extra fees.",
	},
	{
		id: "safety_threat",
		label: "Safety Concern",
		description: "Feeling unsafe, threatened, or in danger.",
	},
	{
		id: "no_show_extortion",
		label: "Service Issues",
		description: "Not showing up, refusing service, or pressuring you.",
	},
	{
		id: "other",
		label: "Something Else",
		description: "Any other issue you'd like to report.",
	},
];

export default function ChatReportModal({
	booking,
	peer,
	user,
	socket,
	isOpen,
	onClose,
}) {
	const [selectedReason, setSelectedReason] = useState("");
	const [details, setDetails] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState("");

	if (!isOpen) return null;

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!selectedReason || submitting) return;

		setSubmitting(true);
		setError("");

		try {
			await chatRequest(socket, "report", {
				bookingId: booking.booking_id,
				reason: selectedReason,
				details: details.trim() || undefined,
			});
			setSubmitted(true);
		} catch (err) {
			console.error("Failed to submit chat report:", err);
			setError(
				err?.message ||
					"Failed to submit report. Please check your connection and try again.",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const roleLabel = user.role === "provider" ? "Customer" : "Provider";
	const peerRoleLabel = user.role === "provider" ? "customer" : "provider";

	return (
		<div
			className="tg-report-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="report-title"
		>
			<header className="tg-report-header">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onClose}
						className="tg-chat-icon"
						style={{ width: "32px", height: "32px" }}
						aria-label="Back to chat"
					>
						<ChevronLeft size={20} />
					</button>
					<div>
						<h3 id="report-title" className="text-sm font-semibold text-white">
							Report Conversation
						</h3>
						<p className="text-[11px] text-stone-400">
							Confidential Trust & Safety review
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="tg-chat-icon"
					style={{ width: "32px", height: "32px" }}
					aria-label="Close"
				>
					<X size={18} />
				</button>
			</header>

			{submitted ? (
				<div className="tg-report-success">
					<div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center mb-4 shadow-lg shadow-green-950/40">
						<CheckCircle2 size={30} />
					</div>
					<h4 className="text-lg font-bold text-white mb-2">
						Report Submitted
					</h4>
					<p className="text-xs text-stone-300 leading-relaxed max-w-xs mb-6">
						We've received your report and will review the conversation. Thanks
						for helping keep TaskGenie safe.
					</p>
					<button
						type="button"
						onClick={onClose}
						className="tg-report-cancel"
						style={{
							background: "#a78bfa1e",
							borderColor: "#a78bfa40",
							color: "#e9d5ff",
						}}
					>
						Return to Chat
					</button>
				</div>
			) : (
				<form
					onSubmit={handleSubmit}
					className="flex flex-col flex-1 overflow-hidden"
				>
					<div className="tg-report-body">
						{/* Context banner */}
						<div className="tg-report-card">
							<div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
								<ShieldAlert size={16} />
							</div>
							<div className="min-w-0 flex-1 text-sm">
								<p className="font-medium text-stone-200">
									Reporting {peer} ({peerRoleLabel})
								</p>
								<p className="text-[11.5px] text-stone-400 mt-0.5 truncate">
									Booking #{booking.booking_id.slice(0, 8).toUpperCase()} •{" "}
									{booking.service_name || "Scheduled service"}
								</p>
							</div>
						</div>

						{error && (
							<div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
								<AlertCircle size={15} className="flex-shrink-0" />
								<span>{error}</span>
							</div>
						)}

						<div>
							<label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2.5">
								Select Reason
							</label>
							<div className="space-y-2">
								{REPORT_REASONS.map((reason) => {
									const isSelected = selectedReason === reason.id;
									return (
										<button
											key={reason.id}
											type="button"
											onClick={() => setSelectedReason(reason.id)}
											className={`tg-report-option w-full ${isSelected ? "is-selected" : ""}`}
										>
											<div className="tg-report-radio">
												{isSelected && <div className="tg-report-radio-dot" />}
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-semibold text-white">
													{reason.label}
												</p>
												<p className="text-[12px] text-stone-300 mt-0.5 leading-snug">
													{reason.description}
												</p>
											</div>
										</button>
									);
								})}
							</div>
						</div>

						<div>
							<div className="flex items-center justify-between mb-1.5">
								<label
									htmlFor="report-details"
									className="text-xs font-semibold text-stone-300 uppercase tracking-wider"
								>
									Additional details{" "}
									<span className="text-stone-500 font-normal lowercase">
										(optional)
									</span>
								</label>
								<span className="text-[10px] text-stone-500">
									{details.length}/1000
								</span>
							</div>
							<textarea
								id="report-details"
								className="tg-report-textarea"
								maxLength={1000}
								value={details}
								onChange={(e) => setDetails(e.target.value)}
								placeholder="Tell us what happened (e.g. specific threats, demands for offline cash, harassment)..."
							/>
						</div>

						<p className="text-[11.5px] text-stone-400 leading-relaxed flex items-start gap-1.5 pt-1">
							<ShieldAlert
								size={13}
								className="text-violet-400 flex-shrink-0 mt-0.5"
							/>
							<span>
								Your report is private. Our team can review this chat to
								understand what happened.
							</span>
						</p>
					</div>

					<footer className="tg-report-footer">
						<button
							type="button"
							onClick={onClose}
							disabled={submitting}
							className="tg-report-cancel"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!selectedReason || submitting}
							className="tg-report-submit"
						>
							{submitting ? (
								<>
									<LoaderCircle size={14} className="animate-spin" />
									<span>Submitting…</span>
								</>
							) : (
								<>
									<ShieldAlert size={14} />
									<span>Submit Report</span>
								</>
							)}
						</button>
					</footer>
				</form>
			)}
		</div>
	);
}
