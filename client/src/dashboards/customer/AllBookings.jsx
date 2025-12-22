import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
	Calendar,
	Clock,
	MapPin,
	Search,
	Settings,
	CheckCircle2,
	AlertCircle,
} from "lucide-react";
import BookingDetailsSheet from "./BookingDetailsSheet";

const StatusBadge = ({ status, date, startTime }) => {
	let displayStatus = status.toLowerCase();

	const BUFFER_TIME = 15 * 60 * 60 * 1000;
	const dateObj = new Date(date);

	if (startTime) {
		const [hours, minutes] = startTime.split(":");
		dateObj.setHours(hours, minutes);
	}

	const now = new Date();

	if (displayStatus === "booked") {
		if (now > dateObj) {
			const timeDiff = now - dateObj;
			if (timeDiff < BUFFER_TIME) {
				displayStatus = "awaiting completion";
			} else {
				displayStatus = "expired";
			}
		}
	}
	let styles = "bg-gray-100 text-gray-600 border-gray-200";
	let icon = null;

	switch (displayStatus) {
		case "completed":
			styles = "bg-emerald-50 text-emerald-700 border-emerald-200";
			icon = <CheckCircle2 size={12} />;
			break;
		case "cancelled":
			styles = "bg-red-50 text-red-700 border-red-200";
			icon = <AlertCircle size={12} />;
			break;
		case "no_show":
			styles = "bg-red-100 text-red-800 border-red-200";
			icon = <AlertCircle size={12} />;
			break;
		case "in progress":
			styles = "bg-blue-50 text-blue-700 border-blue-200";
			icon = <Clock size={12} />;
			break;
		case "awaiting completion":
			styles = "bg-yellow-50 text-yellow-700 border-yellow-200";
			icon = <Clock size={12} />;
			break;
		case "booked":
		case "confirmed":
			styles = "bg-violet-50 text-violet-700 border-violet-200";
			icon = <Clock size={12} />;
			break;
		case "expired":
			styles = "bg-orange-50 text-orange-700 border-orange-200";
			icon = <AlertCircle size={12} />;
			break;
	}

	return (
		<span
			className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border flex items-center gap-1.5 w-fit ${styles}`}
		>
			{icon}
			{displayStatus === "awaiting completion"
				? "Awaiting"
				: displayStatus}{" "}
		</span>
	);
};

export default function AllBookings() {
	const [history, setHistory] = useState([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [actionLoading, setActionLoading] = useState(null);
	const [alertMsg, setAlertMsg] = useState("");
	const [selectedBooking, setSelectedBooking] = useState(null);

	const [meta, setMeta] = useState({
		current_page: 1,
		total_pages: 1,
		has_next_page: false,
	});

	const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

	useEffect(() => {
		const fetchHistory = async () => {
			setLoading(true);
			try {
				const token = localStorage.getItem("token");
				const res = await fetch(
					`${API_URL}/api/bookings/user/history?page=${meta.current_page}&limit=5`,
					{ headers: { Authorization: `Bearer ${token}` } }
				);
				if (res.ok) {
					const responseData = await res.json();
					setHistory(responseData.data);
					setMeta(responseData.meta);
				}
			} catch (err) {
				console.error("Error fetching history", err);
			} finally {
				setLoading(false);
			}
		};
		fetchHistory();
	}, [meta.current_page]);

	const handleStatusUpdate = async (bookingId, newStatus) => {
		let confirmMsg = "Are you sure you want to update this booking?";

		if (newStatus === "cancelled") {
			confirmMsg = "Are you sure you want to cancel this booking?";
		} else if (newStatus === "no_show") {
			confirmMsg =
				"⚠️ Confirm reporting Provider No-Show? \n\nThis marks that the provider did not arrive. This action cannot be undone.";
		}

		if (!window.confirm(confirmMsg)) return;

		setActionLoading(bookingId);
		try {
			const token = localStorage.getItem("token");
			const res = await fetch(`${API_URL}/api/bookings/${bookingId}/status`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ status: newStatus }),
			});
			const data = await res.json();

			if (res.ok) {
				setHistory((prev) =>
					prev.map((item) =>
						item.booking_id === bookingId
							? { ...item, status: newStatus }
							: item
					)
				);

				if (selectedBooking && selectedBooking.booking_id === bookingId) {
					setSelectedBooking((prev) => ({ ...prev, status: newStatus }));
				}
			} else {
				alert(data.message || "Failed to update status");
			}
		} catch (err) {
			console.error("Error updating status:", err);
			alert("Network error occurred.");
		} finally {
			setActionLoading(null);
		}
	};

	const handleNext = () => {
		if (meta.has_next_page) {
			setMeta((prev) => ({ ...prev, current_page: prev.current_page + 1 }));
		}
	};

	const handlePrev = () => {
		if (meta.current_page > 1) {
			setMeta((prev) => ({ ...prev, current_page: prev.current_page - 1 }));
		}
	};

	return (
		<div className="relative">
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="space-y-6"
			>
				{/* 1. Header & Toolbar */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<h2 className="text-xl font-bold text-gray-900">Booking History</h2>
						<p className="text-sm text-gray-500">
							Track your past services and payments.
						</p>
					</div>

					<div className="flex items-center gap-2">
						<div className="relative">
							<Search
								className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
								size={16}
							/>
							<input
								type="text"
								placeholder="Search bookings..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all w-full sm:w-64"
							/>
						</div>
						<button className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors">
							<Settings size={18} />
						</button>
					</div>
				</div>

				{/* 2. The Table Card */}
				<div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
					<div className="overflow-x-auto">
						{loading ? (
							<div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
								<div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
								<span className="text-sm font-medium">Syncing history...</span>
							</div>
						) : history.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-64 text-gray-400">
								<div className="p-4 bg-gray-50 rounded-full mb-3">
									<Calendar size={24} className="text-gray-300" />
								</div>
								<p className="font-medium text-gray-900">No bookings yet</p>
								<p className="text-sm">
									Your completed services will appear here.
								</p>
							</div>
						) : (
							<table className="w-full text-left border-collapse">
								<thead>
									<tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
										<th className="p-5">Service Details</th>
										<th className="p-5">Provider</th>
										<th className="p-5">Date & Time</th>
										<th className="p-5">Amount</th>
										<th className="p-5">Status</th>
										<th className="p-5 text-right">Action</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100">
									{history.map((item) => {
										const rawDate = new Date(item.date);
										const year = rawDate.getFullYear();
										const month = String(rawDate.getMonth() + 1).padStart(
											2,
											"0"
										);
										const day = String(rawDate.getDate()).padStart(2, "0");

										const dateObj = new Date(
											`${year}-${month}-${day}T00:00:00`
										);

										if (item.start_time) {
											const [hours, minutes] = item.start_time.split(":");
											dateObj.setHours(hours, minutes);
										}
										const now = new Date();
										const isPast = dateObj < now;

										const dateStr = dateObj.toLocaleDateString("en-IN", {
											month: "short",
											day: "numeric",
											year: "numeric",
										});
										const timeStr = dateObj.toLocaleTimeString("en-IN", {
											hour: "2-digit",
											minute: "2-digit",
											hour12: true,
										});
										const weekday = dateObj.toLocaleDateString("en-IN", {
											weekday: "short",
										});

										const pName = item.provider_name || "Agency";

										return (
											<tr
												key={item.booking_id}
												className="group hover:bg-gray-50/50 transition-colors"
											>
												<td className="p-5">
													<div className="flex flex-col">
														<span className="font-semibold text-gray-900 text-sm">
															{item.service_name || "Service"}
														</span>
														<span className="text-xs text-gray-400 font-mono mt-0.5">
															#{item.booking_id.slice(0, 8).toUpperCase()}
														</span>
													</div>
												</td>

												<td className="p-5">
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold border border-indigo-100">
															{pName[0]}
														</div>
														<span className="text-sm text-gray-600 font-medium">
															{pName}
														</span>
													</div>
												</td>

												<td className="p-5">
													<div className="flex flex-col">
														<span className="text-sm font-medium text-gray-900">
															{dateStr}
														</span>
														<span className="text-xs text-gray-500 mt-0.5">
															{weekday} • {timeStr}
														</span>
													</div>
												</td>

												<td className="p-5">
													<span className="font-mono text-sm font-medium text-gray-700">
														{new Intl.NumberFormat("en-IN", {
															style: "currency",
															currency: "INR",
															minimumFractionDigits: 0,
														}).format(item.price)}
													</span>
												</td>

												<td className="p-5">
													<StatusBadge
														status={item.status}
														date={item.date}
														startTime={item.start_time}
													/>
												</td>

												<td className="p-5 text-right">
													<div className="flex items-center justify-end gap-2">
														{item.status === "completed" ? (
															<button className="text-xs font-medium bg-violet-50 text-violet-600 px-3 py-1.5 rounded-lg border border-violet-100 hover:bg-violet-100 transition-colors">
																Rate Provider
															</button>
														) : item.status === "cancelled" ? (
															<button className="text-xs font-medium bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
																Book Again
															</button>
														) : !isPast ? (
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	handleStatusUpdate(
																		item.booking_id,
																		"cancelled"
																	);
																}}
																disabled={actionLoading === item.booking_id}
																className="text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
															>
																{actionLoading === item.booking_id
																	? "..."
																	: "Cancel"}
															</button>
														) : null}

														<button
															onClick={() => setSelectedBooking(item)}
															className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-900 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
														>
															Details
														</button>
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						)}
					</div>

					{/* Pagination */}
					<div className="p-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center">
						<span className="text-xs text-gray-500 font-medium">
							Showing page {meta.current_page} of {meta.total_pages}
						</span>
						<div className="flex gap-2">
							<button
								onClick={handlePrev}
								disabled={meta.current_page === 1 || loading}
								className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
							>
								Previous
							</button>
							<button
								onClick={handleNext}
								disabled={!meta.has_next_page || loading}
								className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
							>
								Next
							</button>
						</div>
					</div>
				</div>
			</motion.div>

			{/* Sheet for Details */}
			<AnimatePresence>
				{selectedBooking && (
					<BookingDetailsSheet
						booking={selectedBooking}
						onClose={() => setSelectedBooking(null)}
						onUpdateStatus={handleStatusUpdate}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}
