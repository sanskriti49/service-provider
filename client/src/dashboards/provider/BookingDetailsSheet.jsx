import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
	Calendar,
	Clock,
	Search,
	ListFilter,
	AlertCircle,
	CheckCircle2,
	X,
	ChevronRight,
	MapPin,
	CreditCard,
	Shield,
	ShieldCheck,
	AlertTriangle,
	Users,
	History as HistoryIcon,
	Loader2,
	Copy,
} from "lucide-react";
import api from "../../api/axiosInstance";

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

	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "unset";
		};
	}, []);

	// Encapsulated handleCopyId locally so the template container has absolute access
	const handleCopyId = useCallback((id) => {
		if (!id) return;
		navigator.clipboard.writeText(id);
		setCopied(true);
		toast.success("Booking ID copied to clipboard!", {
			className:
				"bricolage-grotesque font-semibold bg-slate-900 text-white border border-white/10 rounded-2xl",
		});
		setTimeout(() => setCopied(false), 2000);
	}, []);

	if (!booking) return null;

	const datePart = booking.date.split("T")[0];
	const localStr = `${datePart.replace(/-/g, "/")} ${booking.start_time || "00:00:00"}`;
	const bdt = new Date(localStr);
	const now = new Date();
	const GRACE = 20 * 60000;
	const isPastStart = !isNaN(bdt.getTime()) && now > bdt.getTime() + GRACE;

	const displayStatus = (booking.status || "").replace(/_/g, " ");

	const STATUS_SHEET = {
		completed: {
			bar: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
			dot: "bg-emerald-400",
		},
		in_progress: {
			bar: "bg-blue-500/15 text-blue-300 border-blue-500/20",
			dot: "bg-blue-400 animate-pulse",
		},
		no_show: {
			bar: "bg-red-500/15 text-red-300 border-red-500/20",
			dot: "bg-red-400",
		},
		cancelled: {
			bar: "bg-red-500/15 text-red-300 border-red-500/20",
			dot: "bg-red-400",
		},
		booked: {
			bar: "bg-violet-500/15 text-violet-300 border-violet-500/20",
			dot: "bg-violet-400",
		},
		confirmed: {
			bar: "bg-violet-500/15 text-violet-300 border-violet-500/20",
			dot: "bg-violet-400",
		},
	};
	const style = STATUS_SHEET[booking.status] || {
		bar: "bg-slate-800 text-slate-300 border-slate-700",
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
				className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150]"
			/>
			<motion.div
				initial={{ x: "100%" }}
				animate={{ x: 0 }}
				exit={{ x: "100%" }}
				transition={{ type: "spring", damping: 28, stiffness: 220 }}
				className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-white/8 shadow-[-20px_0_60px_rgba(0,0,0,0.4)] z-[201] flex flex-col bricolage-grotesque"
			>
				{/* Header */}
				<div className="p-6 border-b border-white/8 flex justify-between items-start bg-slate-900">
					<div>
						<h2 className="text-xl font-extrabold text-white tracking-tight">
							Booking Details
						</h2>
						{/* Grouped header badge cleanly together into a single action container wrapper */}
						<button
							onClick={() => handleCopyId(booking.booking_id)}
							className="group mt-2 flex items-center gap-2 text-xs font-mono text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 px-2.5 py-1 rounded-lg transition-all active:scale-95 cursor-pointer text-left"
						>
							<span>#{booking.booking_id?.slice(0, 8).toUpperCase()}</span>
							<Copy
								size={12}
								className={`transition-transform duration-200 ${copied ? "text-emerald-400 scale-110" : "text-violet-400/60 group-hover:text-violet-300"}`}
							/>
						</button>
					</div>
					<button
						onClick={onClose}
						className="p-2.5 hover:bg-white/8 rounded-full transition-all active:scale-90 border border-white/10"
					>
						<X size={18} className="text-slate-400" />
					</button>
				</div>

				{/* Scrollable body */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6">
					{/* Status bar */}
					<div
						className={`flex items-center justify-between p-4 rounded-2xl border ${style.bar}`}
					>
						<div className="flex items-center gap-3">
							<div className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
							<span className="text-sm font-bold uppercase tracking-wider">
								{displayStatus}
							</span>
						</div>
						<Shield size={16} className="opacity-30" />
					</div>

					{/* Info rows */}
					<div className="space-y-5">
						{[
							{
								icon: Calendar,
								iconBg: "bg-violet-500/10 text-violet-400",
								iconHover: "group-hover:bg-violet-600 group-hover:text-white",
								label: "Scheduled",
								primary: isNaN(bdt)
									? "—"
									: bdt.toLocaleDateString(undefined, {
											day: "numeric",
											month: "short",
											year: "numeric",
										}),
								secondary: isNaN(bdt)
									? ""
									: bdt.toLocaleTimeString(undefined, {
											hour: "2-digit",
											minute: "2-digit",
											hour12: true,
										}),
							},
							{
								icon: MapPin,
								iconBg: "bg-blue-500/10 text-blue-400",
								iconHover: "group-hover:bg-blue-600 group-hover:text-white",
								label: "Location",
								primary: booking.address || "Location not set",
							},
							{
								icon: Users,
								iconBg: "bg-fuchsia-500/10 text-fuchsia-400",
								iconHover: "group-hover:bg-fuchsia-600 group-hover:text-white",
								label: "Customer",
								primary: booking.customer_name || "—",
								secondary: booking.customer_email || "",
							},
						].map(
							({
								icon: Icon,
								iconBg,
								iconHover,
								label,
								primary,
								secondary,
							}) => (
								<div key={label} className="flex gap-4 items-start group">
									<div
										className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300 ${iconBg} ${iconHover}`}
									>
										<Icon size={20} />
									</div>
									<div>
										<p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
											{label}
										</p>
										<p className="text-white font-semibold text-sm">
											{primary}
										</p>
										{secondary && (
											<p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
												<Clock size={11} />
												{secondary}
											</p>
										)}
									</div>
								</div>
							),
						)}
					</div>

					<div className="border-t border-white/8" />

					{/* Provider Actions */}
					{isPastStart &&
						(booking.status === "booked" ||
							booking.status === "confirmed" ||
							booking.status === "in_progress") && (
							<motion.div
								initial={{ scale: 0.95, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 space-y-3"
							>
								<div className="flex items-center gap-2 text-amber-300">
									<AlertTriangle size={16} />
									<span className="font-bold text-sm">Update Job Status</span>
								</div>
								<button
									onClick={() =>
										onUpdateStatus(booking.booking_id, "completed")
									}
									disabled={actionLoading === booking.booking_id}
									className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/30 active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
								>
									{actionLoading === booking.booking_id ? (
										<Loader2 size={16} className="animate-spin" />
									) : (
										<CheckCircle2 size={16} />
									)}
									Mark as Completed
								</button>
							</motion.div>
						)}

					{booking.status === "pending" && (
						<div className="space-y-2 mt-4">
							<button
								onClick={() => onUpdateStatus(booking.booking_id, "confirmed")}
								disabled={actionLoading === booking.booking_id}
								className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
							>
								{actionLoading === booking.booking_id ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<CheckCircle2 size={16} />
								)}
								Accept & Lock Schedule
							</button>
							<button
								onClick={() => onUpdateStatus(booking.booking_id, "cancelled")}
								disabled={actionLoading === booking.booking_id}
								className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 rounded-xl font-bold text-sm transition-all disabled:opacity-50 cursor-pointer"
							>
								Pass Job to Someone Else
							</button>
						</div>
					)}

					{/* Payment breakdown */}
					<section className="bg-slate-800/60 rounded-3xl p-6 border border-white/8 relative overflow-hidden">
						<div className="flex items-center gap-2 mb-4">
							<CreditCard
								size={16}
								className={isRefunded ? "text-red-400" : "text-slate-400"}
							/>
							<h4 className="font-bold text-white text-sm">
								{isRefunded ? "Refund Details" : "Payment Breakdown"}
							</h4>
						</div>
						<div className="space-y-3">
							<div className="flex justify-between text-sm">
								<span className="text-slate-400">Service Fee</span>
								<span
									className={`font-medium ${isRefunded ? "text-slate-500 line-through" : "text-slate-200"}`}
								>
									{formatCurrency(booking.price)}
								</span>
							</div>
							{isRefunded ? (
								<>
									<div className="flex justify-between text-sm">
										<span className="text-red-400 font-medium">
											Refund Amount
										</span>
										<span className="font-bold text-red-300">
											-{formatCurrency(booking.price)}
										</span>
									</div>
									<div className="pt-3 mt-3 border-t border-white/8 flex justify-between items-center">
										<span className="font-bold text-white">Final Balance</span>
										<div className="text-right">
											<span className="text-xl font-black text-slate-400">
												{formatCurrency(0)}
											</span>
											<p className="text-[10px] text-emerald-400 font-bold uppercase tracking-tight">
												Full Refund Issued
											</p>
										</div>
									</div>
								</>
							) : (
								<>
									<div className="flex justify-between text-sm">
										<span className="text-slate-400">Platform Fee</span>
										<span className="font-medium text-slate-200">
											{formatCurrency(0)}
										</span>
									</div>
									<div className="pt-3 mt-3 border-t border-white/8 flex justify-between items-center">
										<span className="font-bold text-white">Your Earnings</span>
										<span className="text-xl font-black text-emerald-400">
											{formatCurrency(booking.price)}
										</span>
									</div>
								</>
							)}
						</div>
					</section>
				</div>

				{/* Footer */}
				<div className="p-6 bg-slate-950/50 border-t border-white/8">
					<div className="flex items-center gap-3 text-slate-500 text-xs">
						<ShieldCheck size={14} className="text-emerald-500" />
						<span>Protected by Genie Secure Payments</span>
					</div>
				</div>
			</motion.div>
		</>,
		document.body,
	);
}
