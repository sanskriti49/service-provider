import { createPortal } from "react-dom";
import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
	X,
	MapPin,
	Calendar,
	AlertTriangle,
	ShieldCheck,
	Clock,
	CreditCard,
	ChevronRight,
	Shield,
} from "lucide-react";

export default function BookingDetailsSheet({
	booking,
	onClose,
	onUpdateStatus,
}) {
	// Prevent background scroll
	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "unset";
		};
	}, []);

	if (!booking) return null;

	const { bookingDateTime, isPastStart, displayStatus, statusStyles } =
		useMemo(() => {
			// const bdt = new Date(
			// 	`${booking.date}T${booking.start_time || "00:00"}:00`,
			// );
			console.log(booking);
			const datePart = booking.date.split("T")[0];

			const timePart = booking.start_time || "00:00:00";
			const localString = `${datePart.replace(/-/g, "/")} ${timePart}`;

			let bdt = new Date(localString);
			const now = new Date();
			const GRACE_PERIOD = 20 * 60000;

			const isValidDate = !isNaN(bdt.getTime());
			let status = booking.status;
			let styles = {
				container: "bg-gray-50 text-gray-700 border-gray-200",
				dot: "bg-gray-400",
			};

			switch (booking.status) {
				case "completed":
					styles = {
						container: "bg-emerald-50 text-emerald-700 border-emerald-100",
						dot: "bg-emerald-500",
					};
					break;
				case "in_progress":
					styles = {
						container: "bg-blue-50 text-blue-700 border-blue-100",
						dot: "bg-blue-500 animate-pulse",
					};
					break;
				case "no_show":
				case "cancelled":
					styles = {
						container: "bg-red-50 text-red-700 border-red-100",
						dot: "bg-red-500",
					};
					break;
				case "booked":
					styles = {
						container: "bg-violet-50 text-violet-700 border-violet-100",
						dot: "bg-violet-500",
					};
					break;
			}

			return {
				bookingDateTime: isValidDate ? bdt : new Date(),
				//isPastStart:
				//	!isNaN(bdt.getTime()) && now > bdt.getTime() + GRACE_PERIOD,
				isPastStart: isValidDate && now > bdt.getTime() + GRACE_PERIOD,
				displayStatus: status.replace(/_/g, " "),
				statusStyles: styles,
			};
		}, [booking]);

	const formatCurrency = (val) =>
		new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
		}).format(val);

	return createPortal(
		<>
			{/* Backdrop */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
				className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[150]"
			/>

			{/* Sidebar */}
			<motion.div
				initial={{ x: "100%" }}
				animate={{ x: 0 }}
				exit={{ x: "100%" }}
				transition={{ type: "spring", damping: 28, stiffness: 220 }}
				className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[201] flex flex-col bricolage-grotesque"
			>
				{/* Fixed Header */}
				<div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
					<div>
						<h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
							Booking Details
						</h2>
						<p className="text-xs font-mono text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md inline-block mt-1">
							ID: {booking.booking_id.slice(0, 8).toUpperCase()}
						</p>
					</div>
					<button
						onClick={onClose}
						className="p-2.5 hover:bg-gray-100 rounded-full transition-all active:scale-90 shadow-sm border border-gray-50"
					>
						<X size={20} className="text-gray-500" />
					</button>
				</div>

				{/* Scrollable Content */}
				<div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
					{/* Status Section */}
					<section>
						<div
							className={`flex items-center justify-between p-4 rounded-2xl border ${statusStyles.container}`}
						>
							<div className="flex items-center gap-3">
								<div
									className={`h-2.5 w-2.5 rounded-full ${statusStyles.dot}`}
								/>
								<span className="text-sm font-bold uppercase tracking-wider">
									{displayStatus}
								</span>
							</div>
							<Shield size={18} className="opacity-40" />
						</div>
					</section>

					{/* Info Grid */}
					<section className="grid gap-6">
						<div className="flex gap-4 items-start group">
							<div className="w-11 h-11 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0 group-hover:bg-violet-600 transition-colors duration-300">
								<Calendar
									size={22}
									className="text-violet-600 group-hover:text-white transition-colors"
								/>
							</div>
							<div>
								<p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
									Schedule
								</p>
								<p className="text-gray-900 font-semibold">
									{/* 'undefined' automatically detects the user's country format */}
									{bookingDateTime.toLocaleDateString(undefined, {
										day: "numeric",
										month: "short",
										year: "numeric",
									})}
								</p>
								<p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
									<Clock size={12} />
									{bookingDateTime.toLocaleTimeString(undefined, {
										hour: "2-digit",
										minute: "2-digit",
										hour12: true,
									})}
								</p>
							</div>
						</div>

						<div className="flex gap-4 items-start group">
							<div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-600 transition-colors duration-300">
								<MapPin
									size={22}
									className="text-blue-600 group-hover:text-white transition-colors"
								/>
							</div>
							<div>
								<p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
									Service Location
								</p>
								<p className="text-gray-900 font-semibold leading-snug">
									{booking.address || "Location not set"}
								</p>
							</div>
						</div>
					</section>

					<hr className="border-gray-100" />

					{/* Actions / No-Show Logic */}
					{isPastStart && booking.status === "booked" && (
						<motion.div
							initial={{ scale: 0.95, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							className="bg-red-50/50 p-4 rounded-2xl border border-red-100"
						>
							<div className="flex items-center gap-2 text-red-700 mb-3">
								<AlertTriangle size={18} />
								<span className="font-bold text-sm">Action Required</span>
							</div>
							<button
								onClick={() => onUpdateStatus(booking.booking_id, "no_show")}
								className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-200 active:translate-y-0.5"
							>
								Report Provider No-Show
							</button>
						</motion.div>
					)}

					{/* Payment Breakdown Card */}
					{/* Payment Breakdown Card */}
					<section className="bg-slate-50 rounded-3xl p-6 border border-slate-100 relative overflow-hidden">
						<div className="flex items-center gap-2 mb-4">
							<CreditCard
								size={18}
								className={`${booking.status === "cancelled" || booking.status === "no_show" ? "text-red-400" : "text-slate-400"}`}
							/>
							<h4 className="font-bold text-slate-800">
								{booking.status === "cancelled" || booking.status === "no_show"
									? "Refund Details"
									: "Payment Breakdown"}
							</h4>
						</div>

						<div className="space-y-3 relative z-10">
							<div className="flex justify-between text-sm">
								<span className="text-slate-500">Service Fee</span>
								<span
									className={`font-medium ${booking.status === "cancelled" || booking.status === "no_show" ? "text-slate-400 line-through" : "text-slate-700"}`}
								>
									{formatCurrency(booking.price)}
								</span>
							</div>

							{/* Conditional Rendering for Refunded States */}
							{booking.status === "cancelled" ||
							booking.status === "no_show" ? (
								<>
									<div className="flex justify-between text-sm">
										<span className="text-red-500 font-medium">
											Refund Amount
										</span>
										<span className="font-bold text-red-600">
											-{formatCurrency(booking.price)}
										</span>
									</div>
									<div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
										<span className="font-bold text-slate-900">
											Final Balance
										</span>
										<div className="text-right">
											<span className="text-xl font-black text-slate-400">
												{formatCurrency(0)}
											</span>
											<p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">
												Full Refund Issued
											</p>
										</div>
									</div>
								</>
							) : (
								<>
									<div className="flex justify-between text-sm">
										<span className="text-slate-500">Platform Charge</span>
										<span className="font-medium text-slate-700">
											{formatCurrency(0)}
										</span>
									</div>
									<div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
										<span className="font-bold text-slate-900">Total Paid</span>
										<span className="text-xl font-black text-violet-600">
											{formatCurrency(booking.price)}
										</span>
									</div>
								</>
							)}
						</div>

						{/* Subtle Watermark for Refunded Status */}
						{/* Refined Watermark Logic */}
						{(booking.status === "cancelled" ||
							booking.status === "no_show") && (
							<div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
								{/* Large Centered Security Icon */}
								<div
									className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                       text-red-900 opacity-[0.04] rotate-[-15deg]"
								>
									<ShieldCheck size={280} strokeWidth={1} />
								</div>

								{/* Decorative "VOID" or "REFUNDED" text watermark */}
								<div className="absolute bottom-2 right-4 text-red-900 opacity-[0.05] font-black text-4xl italic tracking-tighter uppercase">
									Voided
								</div>
							</div>
						)}
					</section>
				</div>

				{/* Fixed Footer */}
				<div className="p-6 bg-gray-50/50 border-t border-gray-100">
					<div className="flex items-center gap-3 text-gray-400 text-xs italic">
						<ShieldCheck size={14} className="text-emerald-500" />
						<span>Protected by TaskGenie Secure Payments</span>
					</div>
				</div>
			</motion.div>
		</>,
		document.body,
	);
}
