import { motion } from "framer-motion";
import { X, MapPin, Calendar, User, Mail, Phone, Download } from "lucide-react";

export default function BookingDetailsSheet({ booking, onClose }) {
	if (!booking) return null;
	const isCancelled = booking.status;

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
			{/* Backdrop */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
				className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
			/>

			{/* Slide-over Panel */}
			<motion.div
				initial={{ x: "100%" }}
				animate={{ x: 0 }}
				exit={{ x: "100%" }}
				transition={{ type: "spring", damping: 25, stiffness: 200 }}
				className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-100"
			>
				<div className="p-6">
					<div className="flex justify-between items-start mb-6">
						<div>
							<h2 className="text-xl font-bold text-gray-900">
								Booking Details
							</h2>
							<p className="text-sm text-gray-500">#{booking.booking_id}</p>
						</div>
						<button
							onClick={onClose}
							className="p-2 hover:bg-gray-100 rounded-full transition-colors"
						>
							<X size={20} className="text-gray-500" />
						</button>
					</div>

					{/* Status Banner */}
					<div
						className={`p-4 rounded-xl mb-6 ${
							booking.status === "completed"
								? "bg-emerald-50 text-emerald-700"
								: booking.status === "cancelled"
								? "bg-red-50 text-red-700"
								: "bg-violet-50 text-violet-700"
						}`}
					>
						<span className="font-bold uppercase text-xs tracking-wide">
							Current Status
						</span>
						<div className="text-lg font-semibold mt-1 capitalize">
							{booking.status.replace("_", " ")}
						</div>
					</div>

					{/* Service Info */}
					<div className="space-y-6">
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

						<div>
							<h4 className="font-bold text-gray-900 mb-4">Provider Details</h4>
							<div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
								<div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg">
									{booking.provider_name?.[0] || "P"}
								</div>
								<div>
									<div className="font-bold text-gray-900">
										{booking.provider_name}
									</div>
									<div className="text-xs text-gray-500">Verified Pro</div>
								</div>
								<div className="ml-auto flex gap-2">
									{booking.provider_email && (
										<a
											href={`mailto:${booking.provider_email}`}
											className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors flex items-center justify-center"
											title="Send Email"
										>
											<Mail size={16} />
										</a>
									)}
									{booking.provider_phone && (
										<a
											href={`tel:${booking.provider_phone}`}
											className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors flex items-center justify-center"
											title="Call Provider"
										>
											<Phone size={16} />
										</a>
									)}
								</div>
							</div>
						</div>

						<hr className="border-gray-100" />

						{/* Payment Breakdown */}
						{booking.status !== "cancelled" && (
							<div>
								<h4 className="font-bold text-gray-900 mb-4">Payment</h4>
								<div className="flex justify-between items-center text-sm mb-2">
									<span className="text-gray-500">Service Total</span>
									<span className="font-medium">
										{new Intl.NumberFormat("en-IN", {
											style: "currency",
											currency: "INR",
										}).format(booking.price)}
									</span>
								</div>
								<div className="flex justify-between items-center text-sm mb-2">
									<span className="text-gray-500">Taxes & Fees</span>
									<span className="font-medium">₹0.00</span>
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

								{booking.status === "completed" && (
									<button className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
										<Download size={16} /> Download Invoice
									</button>
								)}
							</div>
						)}

						{/* OPTIONAL: Show a "No Payment" message for Cancelled items instead */}
						{booking.status === "cancelled" && (
							<div className="bg-gray-50 p-4 rounded-xl text-center">
								<p className="text-sm text-gray-500">
									This booking was cancelled. No payment was processed.
								</p>
							</div>
						)}
					</div>
				</div>
			</motion.div>
		</>
	);
}
