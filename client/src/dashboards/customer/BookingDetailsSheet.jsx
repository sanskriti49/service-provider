import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
	Calendar,
	Clock,
	X,
	MapPin,
	CreditCard,
	Shield,
	ShieldCheck,
	AlertCircle,
	CheckCircle2,
	Copy,
	KeyRound,
} from "lucide-react";

const formatCurrency = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
	}).format(n || 0);

export default function BookingDetailsSheet({
	booking,
	onClose,
	onCancelBooking,
	actionLoading,
}) {
	const [copied, setCopied] = useState(false);

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
		toast.success("Booking ID copied!");
		setTimeout(() => setCopied(false), 2000);
	}, []);

	if (!booking) return null;

	const datePart = booking.date.split("T")[0];
	const localStr = `${datePart.replace(/-/g, "/")} ${booking.start_time || "00:00:00"}`;
	const bdt = new Date(localStr);

	const displayStatus = (booking.status || "").replace(/_/g, " ");
	const isCancelable = ["pending", "booked", "confirmed"].includes(
		booking.status,
	);

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
							Booking Overview
						</h2>
						<button
							onClick={() => handleCopyId(booking.booking_id)}
							className="group mt-2 flex items-center gap-2 text-xs font-mono text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-lg transition-all"
						>
							<span>#{booking.booking_id?.slice(0, 8).toUpperCase()}</span>
							<Copy
								size={12}
								className={copied ? "text-emerald-400" : "text-violet-400/60"}
							/>
						</button>
					</div>
					<button
						onClick={onClose}
						className="p-2.5 hover:bg-white/8 rounded-full border border-white/10"
					>
						<X size={18} className="text-slate-400" />
					</button>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6">
					{/* Secure OTP Handshake Hub — ONLY visible to Customer for active tasks */}
					{["booked", "confirmed"].includes(booking.status) && booking.otp && (
						<div className="bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 p-5 rounded-2xl border border-violet-500/30 space-y-2">
							<div className="flex items-center gap-2 text-violet-300 font-bold text-sm">
								<KeyRound size={16} />
								<span>Secure Start OTP</span>
							</div>
							<p className="text-3xl font-mono font-black tracking-widest text-white text-center py-2 bg-slate-950/40 rounded-xl border border-white/5">
								{booking.otp}
							</p>
							<p className="text-xs text-slate-400 text-center leading-normal">
								Share this 4-digit code with the provider <b>only after</b> they
								arrive at your location to safely log the job start.
							</p>
						</div>
					)}

					<div className="space-y-5">
						{[
							{
								icon: Calendar,
								iconBg: "bg-violet-500/10 text-violet-400",
								label: "Appointment Date",
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
								label: "Service Address",
								primary: booking.address || "No address provided",
							},
							{
								icon: Shield,
								iconBg: "bg-fuchsia-500/10 text-fuchsia-400",
								label: "Assigned Provider",
								primary: booking.provider_name || "Assigning Provider...",
								secondary: booking.provider_phone || "",
							},
						].map(({ icon: Icon, iconBg, label, primary, secondary }) => (
							<div key={label} className="flex gap-4 items-start">
								<div
									className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}
								>
									<Icon size={20} />
								</div>
								<div>
									<p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
										{label}
									</p>
									<p className="text-white font-semibold text-sm">{primary}</p>
									{secondary && (
										<p className="text-slate-400 text-xs mt-0.5">{secondary}</p>
									)}
								</div>
							</div>
						))}
					</div>

					<div className="border-t border-white/8" />

					<section className="bg-slate-800/60 rounded-3xl p-6 border border-white/8">
						<div className="flex items-center gap-2 mb-4">
							<CreditCard size={16} className="text-slate-400" />
							<h4 className="font-bold text-white text-sm">Payment Details</h4>
						</div>
						<div className="space-y-3 text-sm">
							<div className="flex justify-between">
								<span className="text-slate-400">Amount Paid</span>
								<span className="font-bold text-white">
									{formatCurrency(booking.price)}
								</span>
							</div>
							<div className="flex justify-between text-xs text-slate-500">
								<span>Method</span>
								<span className="uppercase font-mono">
									{booking.payment_method || "online"}
								</span>
							</div>
						</div>
					</section>

					{/* Customer Cancellation Option */}
					{isCancelable && (
						<div className="pt-2">
							<button
								onClick={() => onCancelBooking(booking.booking_id, "cancelled")}
								disabled={actionLoading === booking.booking_id}
								className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-bold text-sm transition-all disabled:opacity-50 cursor-pointer text-center"
							>
								Cancel Booking
							</button>
							<p className="text-[10px] text-center text-slate-500 mt-2 leading-relaxed">
								Note: Bookings cancelled less than 2 hours before the scheduled
								slot are subject to a 20% cancellation fee.
							</p>
						</div>
					)}
				</div>
			</motion.div>
		</>,
		document.body,
	);
}
