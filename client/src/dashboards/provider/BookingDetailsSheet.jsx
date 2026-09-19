import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
	Calendar,
	Clock,
	CheckCircle2,
	X,
	MapPin,
	CreditCard,
	ShieldCheck,
	AlertTriangle,
	Users,
	Copy,
	Check,
	Wrench,
	ArrowUpRight,
} from "lucide-react";
import { FadeLoader } from "react-spinners";
import CompletionOtpModal from "./CompletionOtpModal";

const formatCurrency = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
	}).format(n || 0);

const BUFFER_MS = 15 * 60 * 60 * 1000;

export default function BookingDetailsSheet({
	booking,
	onClose,
	onUpdateStatus,
	actionLoading,
}) {
	const [copied, setCopied] = useState(false);
	const [showOtpModal, setShowOtpModal] = useState(false);

	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "unset";
		};
	}, []);

	const handleCopyId = useCallback((id) => {
		if (!id) return;
		navigator.clipboard.writeText(id);
		setCopied(true);
		toast.success("Booking reference copied");
		setTimeout(() => setCopied(false), 2000);
	}, []);

	if (!booking) return null;

	const datePart = booking.date ? booking.date.split("T")[0] : "";
	const localStr = `${datePart.replace(/-/g, "/")} ${booking.start_time || "00:00:00"}`;
	const bdt = new Date(localStr);
	const now = new Date();
	const GRACE = 20 * 60000;
	const isPastStart = !isNaN(bdt.getTime()) && now > bdt.getTime() + GRACE;

	const displayStatus = (booking.status || "").replace(/_/g, " ");

	const STATUS_SHEET = {
		completed: {
			bar: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
			dot: "bg-emerald-400",
		},
		in_progress: {
			bar: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
			dot: "bg-indigo-400",
		},
		no_show: {
			bar: "bg-rose-500/10 text-rose-300 border-rose-500/20",
			dot: "bg-rose-400",
		},
		cancelled: {
			bar: "bg-rose-500/10 text-rose-300 border-rose-500/20",
			dot: "bg-rose-400",
		},
		booked: {
			bar: "bg-violet-500/10 text-violet-300 border-violet-500/20",
			dot: "bg-violet-400",
		},
		confirmed: {
			bar: "bg-violet-500/10 text-violet-300 border-violet-500/20",
			dot: "bg-violet-400",
		},
	};
	const style = STATUS_SHEET[booking.status] || {
		bar: "bg-white/[0.04] text-slate-300 border-white/[0.08]",
		dot: "bg-slate-400",
	};

	const isRefunded = ["cancelled", "no_show"].includes(booking.status);

	return createPortal(
		<>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
				className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[150]"
			/>
			<motion.div
				initial={{ x: "100%" }}
				animate={{ x: 0 }}
				exit={{ x: "100%" }}
				transition={{ type: "spring", damping: 30, stiffness: 280 }}
				className="fixed inset-y-0 right-0 w-full max-w-md bg-[#100924] border-l border-white/[0.08] shadow-2xl shadow-black z-[201] flex flex-col bricolage-grotesque"
			>
				{/* Top Header */}
				<div className="p-6 border-b border-white/[0.07] flex justify-between items-start">
					<div className="space-y-1">
						<span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-400 block">
							Booking Details
						</span>
						<h2 className="text-xl font-black text-white tracking-tight">
							{booking.service_name || "Service Appointment"}
						</h2>
						<button
							onClick={() => handleCopyId(booking.booking_id)}
							className="group mt-1 flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-violet-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-2.5 py-1 rounded-lg transition-all cursor-pointer"
						>
							<span>#{booking.booking_id?.slice(0, 8).toUpperCase()}</span>
							{copied ? (
								<Check size={12} className="text-emerald-400" />
							) : (
								<Copy size={12} className="text-slate-500 group-hover:text-violet-300" />
							)}
						</button>
					</div>

					<button
						onClick={onClose}
						className="p-2 hover:bg-white/[0.08] rounded-xl text-slate-400 hover:text-white border border-white/[0.06] cursor-pointer transition-colors"
					>
						<X size={16} />
					</button>
				</div>

				{/* Scrollable Content */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6">
					{/* Status Bar */}
					<div className={`flex items-center justify-between p-3.5 rounded-2xl border ${style.bar}`}>
						<div className="flex items-center gap-2.5">
							<span className={`h-2 w-2 rounded-full ${style.dot}`} />
							<span className="text-xs font-bold uppercase tracking-wider">
								{displayStatus}
							</span>
						</div>
						<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
							SLA Verified
						</span>
					</div>

					{/* Detail Rows */}
					<div className="space-y-4">
						<div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
							<div className="p-2 rounded-xl bg-violet-500/10 text-violet-300 border border-violet-500/20 shrink-0">
								<Calendar size={16} />
							</div>
							<div className="min-w-0">
								<span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
									Schedule Window
								</span>
								<p className="text-sm font-bold text-white mt-0.5">
									{isNaN(bdt)
										? "—"
										: bdt.toLocaleDateString("en-IN", {
												weekday: "short",
												day: "numeric",
												month: "short",
												year: "numeric",
											})}
								</p>
								<p className="text-xs text-violet-300 flex items-center gap-1 mt-0.5 font-medium">
									<Clock size={12} />
									{isNaN(bdt)
										? ""
										: bdt.toLocaleTimeString("en-IN", {
												hour: "2-digit",
												minute: "2-digit",
												hour12: true,
											})}
								</p>
							</div>
						</div>

						<div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
							<div className="p-2 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/20 shrink-0">
								<MapPin size={16} />
							</div>
							<div className="min-w-0">
								<span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
									Destination Address
								</span>
								<p className="text-xs sm:text-sm font-semibold text-white mt-0.5 break-words">
									{booking.address || "Location address not specified"}
								</p>
							</div>
						</div>

						<div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
							<div className="p-2 rounded-xl bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20 shrink-0">
								<Users size={16} />
							</div>
							<div className="min-w-0">
								<span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
									Client Details
								</span>
								<p className="text-sm font-bold text-white mt-0.5">
									{booking.customer_name || "Customer Patron"}
								</p>
								{booking.customer_email && (
									<p className="text-xs text-slate-400 truncate">{booking.customer_email}</p>
								)}
							</div>
						</div>
					</div>

					{/* Action Triggers */}
					{["booked", "confirmed", "in_progress"].includes(booking.status) && (
						<div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 space-y-2.5">
							<div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
								<ShieldCheck size={15} />
								<span>Secure Job Completion</span>
							</div>
							<p className="text-[11px] text-slate-300 leading-normal">
								Completed this service? Ask the customer for their 4-digit Completion OTP to verify delivery and release payout.
							</p>
							<button
								onClick={() => setShowOtpModal(true)}
								disabled={actionLoading === booking.booking_id}
								className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-950 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
							>
								{actionLoading === booking.booking_id ? (
									<span className="inline-flex items-center justify-center w-4 h-4 scale-[0.35] origin-center -mx-1">
										<FadeLoader color="#ffffff" />
									</span>
								) : (
									<CheckCircle2 size={14} />
								)}
								Complete Job (Enter Customer OTP)
							</button>
						</div>
					)}

					{booking.status === "pending" && (
						<div className="space-y-2 pt-2">
							<button
								onClick={() => onUpdateStatus(booking.booking_id, "confirmed")}
								disabled={actionLoading === booking.booking_id}
								className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-violet-950"
							>
								{actionLoading === booking.booking_id ? (
									<span className="inline-flex items-center justify-center w-4 h-4 scale-[0.35] origin-center -mx-1">
										<FadeLoader color="#ffffff" />
									</span>
								) : (
									<CheckCircle2 size={14} />
								)}
								Accept Booking
							</button>
							<button
								onClick={() => onUpdateStatus(booking.booking_id, "cancelled")}
								disabled={actionLoading === booking.booking_id}
								className="w-full py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.06] rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
							>
								Decline Request
							</button>
						</div>
					)}

					{/* Financial Settlement Card */}
					<div className="bg-white/[0.02] rounded-2xl p-5 border border-white/[0.06] space-y-3">
						<div className="flex items-center gap-2 text-slate-300 text-xs font-bold">
							<CreditCard size={14} className="text-violet-400" />
							<span>{isRefunded ? "Refund Details" : "Payment Breakdown"}</span>
						</div>

						<div className="space-y-2 text-xs">
							<div className="flex justify-between">
								<span className="text-slate-400">Service Total</span>
								<span className={isRefunded ? "text-slate-500 line-through" : "text-white font-bold"}>
									{formatCurrency(booking.price)}
								</span>
							</div>

							{isRefunded ? (
								<div className="flex justify-between text-rose-400 font-bold border-t border-white/[0.06] pt-2">
									<span>Customer Refund Issued</span>
									<span>-{formatCurrency(booking.price)}</span>
								</div>
							) : (
								<>
									<div className="flex justify-between text-slate-400">
										<span>Platform Fee (15%)</span>
										<span className="font-medium text-slate-300">
											-{formatCurrency(Math.round((booking.price || 0) * 0.15))}
										</span>
									</div>
									<div className="flex justify-between text-emerald-400 font-extrabold text-sm border-t border-white/[0.06] pt-2">
										<span>Your Payout</span>
										<span>{formatCurrency(Math.round((booking.price || 0) * 0.85))}</span>
									</div>
								</>
							)}
						</div>
					</div>
				</div>

				{/* Footer Bar */}
				<div className="p-4 bg-black/30 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
					<span className="flex items-center gap-1.5">
						<ShieldCheck size={13} className="text-emerald-400" />
						TaskGenie Protected Payment
					</span>
					<span className="font-mono">Secure</span>
				</div>
			</motion.div>

			<CompletionOtpModal
				isOpen={showOtpModal}
				onClose={() => setShowOtpModal(false)}
				booking={booking}
				loading={actionLoading === booking.booking_id}
				onConfirm={async (otp, setError) => {
					const success = await onUpdateStatus(
						booking.booking_id,
						"completed",
						otp,
						setError,
					);
					if (success !== false) {
						setShowOtpModal(false);
					}
				}}
			/>
		</>,
		document.body,
	);
}
