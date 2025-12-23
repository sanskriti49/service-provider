import { useEffect } from "react";
import { motion } from "framer-motion";
import {
	X,
	MapPin,
	Calendar,
	AlertTriangle,
	ShieldCheck,
	Wallet,
	Shield,
} from "lucide-react";

export default function BookingDetailsSheet({
	booking,
	onClose,
	onUpdateStatus,
}) {
	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "unset";
		};
	}, []);

	if (!booking) return null;

	const rawDate = new Date(booking.date);
	const year = rawDate.getFullYear();
	const month = String(rawDate.getMonth() + 1).padStart(2, "0");
	const day = String(rawDate.getDate()).padStart(2, "0");
	const dateStr = `${year}-${month}-${day}`;

	const rawTime = booking.start_time || "00:00";
	const timeStr = rawTime.slice(0, 5);
	const bookingDateTime = new Date(`${dateStr}T${timeStr}:00`);

	const now = new Date();
	const GRACE_PERIOD_MINS = 20;
	const canReportNoShowTime = new Date(
		bookingDateTime.getTime() + GRACE_PERIOD_MINS * 60000
	);

	const isPastStart =
		!isNaN(bookingDateTime.getTime()) && now > canReportNoShowTime;
	const BUFFER_TIME = 15 * 60 * 60 * 1000;

	let displayStatus = booking.status;
	let statusColor = "bg-gray-100 text-gray-700";
	let statusHelperText = null;

	switch (booking.status) {
		case "completed":
			statusColor = "bg-emerald-50 text-emerald-700";
			break;
		case "cancelled":
			statusColor = "bg-red-50 text-red-700";
			break;
		case "no_show":
			statusColor = "bg-red-100 text-red-800 border border-red-200";
			statusHelperText = "You reported that the provider did not arrive.";
			break;
		case "in_progress":
			statusColor = "bg-blue-50 text-blue-700";
			statusHelperText = "Provider is currently working on this task.";
			break;
		case "expired":
			displayStatus = "Booking Lapsed";
			statusColor = "bg-orange-50 text-orange-700";
			statusHelperText = "This booking ended without a confirmation.";
			break;
		case "booked":
			if (now > bookingDateTime) {
				const timeDiff = now - bookingDateTime;
				if (timeDiff < BUFFER_TIME) {
					displayStatus = "awaiting_completion";
					statusColor = "bg-yellow-50 text-yellow-700";
					statusHelperText = "Service time has passed. Waiting for provider.";
				} else {
					displayStatus = "Booking Lapsed";
					statusColor = "bg-orange-50 text-orange-700";
					statusHelperText = "This booking ended without a confirmation.";
				}
			} else {
				statusColor = "bg-violet-50 text-violet-700";
			}
			break;
		default:
			statusColor = "bg-gray-100 text-gray-600";
			break;
	}

	const formatTo12Hour = (timeStr) => {
		if (!timeStr) return "";
		const [hours, minutes] = timeStr.split(":").map(Number);
		const date = new Date();
		date.setHours(hours, minutes);
		return date.toLocaleTimeString("en-IN", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	};

	return (
		<>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
				className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
			/>

			<motion.div
				initial={{ x: "100%" }}
				animate={{ x: 0 }}
				exit={{ x: "100%" }}
				transition={{ type: "spring", damping: 25, stiffness: 200 }}
				className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-100"
				style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
			>
				<style>{`.fixed.inset-y-0::-webkit-scrollbar { display: none; }`}</style>

				<div className="p-6">
					{/* Header */}
					<div className="flex justify-between items-start mb-6">
						<div>
							<h2 className="text-xl font-bold text-gray-900">
								Booking Details
							</h2>
							<p className="text-sm font-mono text-gray-500">
								#{booking.booking_id.slice(0, 8).toUpperCase()}
							</p>
						</div>
						<button
							onClick={onClose}
							className="p-2 hover:bg-gray-100 rounded-full transition-colors"
						>
							<X size={20} className="text-gray-500" />
						</button>
					</div>

					{/* Status Badge */}
					<div className={`p-4 rounded-xl mb-6 ${statusColor}`}>
						<span className="font-bold uppercase text-xs tracking-wide opacity-80">
							Current Status
						</span>
						<div className="text-lg font-semibold mt-1 capitalize">
							{displayStatus.replace(/_/g, " ")}
						</div>
						{statusHelperText && (
							<p
								className={`text-xs mt-2 opacity-90 leading-relaxed border-t pt-2 ${
									booking.status === "booked"
										? "border-yellow-200/50"
										: "border-current/20"
								}`}
							>
								{statusHelperText}
							</p>
						)}
					</div>

					{/* Report Button (Hidden unless time passed + not completed) */}
					{(booking.status === "booked" ||
						booking.status === "expired" ||
						displayStatus === "awaiting_completion") &&
						isPastStart && (
							<div className="mb-6">
								<button
									onClick={() => onUpdateStatus(booking.booking_id, "no_show")}
									className="cursor-pointer w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl font-medium text-sm hover:bg-red-100 transition-colors"
								>
									<AlertTriangle size={16} />
									Report Provider No-Show
								</button>
								<p className="text-xs text-center text-gray-400 mt-2">
									Only click this if the provider failed to arrive.
								</p>
							</div>
						)}

					<div className="space-y-6">
						{/* Date & Time */}
						<div className="flex items-start gap-4">
							<div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
								<Calendar size={20} className="text-gray-600" />
							</div>
							<div>
								<h4 className="font-medium text-gray-900">Date & Time</h4>
								<p className="text-gray-500 text-sm">
									{new Date(booking.date).toDateString()} at{" "}
									{formatTo12Hour(booking.start_time)}
								</p>
							</div>
						</div>

						{/* Address */}
						<div className="flex items-start gap-4">
							<div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
								<MapPin size={20} className="text-gray-600" />
							</div>
							<div>
								<h4 className="font-medium text-gray-900">Address</h4>
								<p className="text-gray-500 text-sm">
									{booking.address || "No address provided"}
								</p>
							</div>
						</div>

						<hr className="border-gray-100" />

						{booking.status === "no_show" ? (
							// logic for NO SHOW
							<div className="cursor-default hover:shadow-red-400 transition-shadow bg-white border border-red-100 rounded-xl p-4 shadow-[0_2px_8px_-3px_rgba(239,68,68,0.15)]">
								<div className="flex gap-4">
									<div className="shrink-0">
										<div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
											<ShieldCheck size={20} className="text-red-600" />
										</div>
									</div>

									<div className="flex-1">
										<h4 className="font-bold text-gray-900 text-base">
											Payment Voided
										</h4>
										<p className="text-sm text-gray-500 mt-1 leading-relaxed">
											We've verified that the service was not delivered.
										</p>

										<div className="mt-3 flex items-center gap-2 text-base">
											<span className="text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded text-sm border border-red-100">
												No Charge Applied
											</span>
											<span className="text-gray-400 text-sm">
												Transaction cancelled
											</span>
										</div>
									</div>
								</div>
							</div>
						) : booking.status === "cancelled" ? (
							// logic for CANCELLED
							<div className="bg-gray-50 p-4 rounded-xl text-center border border-gray-100">
								<p className="font-medium text-gray-900 mb-1">
									Booking Cancelled
								</p>
								<p className="text-xs text-gray-500">
									No charges were applied for this booking.
								</p>
							</div>
						) : (
							// logic for Booked, Completed, In Progress
							<div>
								<h4 className="font-bold text-gray-900 mb-4">
									Payment Breakdown
								</h4>
								<div className="flex justify-between items-center text-sm mb-2">
									<span className="text-gray-500">Service Total</span>
									<span className="font-medium">
										{new Intl.NumberFormat("en-IN", {
											style: "currency",
											currency: "INR",
										}).format(booking.price)}
									</span>
								</div>
								<div className="flex justify-between items-center text-lg font-bold mt-4 pt-4 border-t border-gray-100">
									<span>Total Amount</span>
									<span>
										{new Intl.NumberFormat("en-IN", {
											style: "currency",
											currency: "INR",
										}).format(booking.price)}
									</span>
								</div>
							</div>
						)}
					</div>
				</div>
			</motion.div>
		</>
	);
}
