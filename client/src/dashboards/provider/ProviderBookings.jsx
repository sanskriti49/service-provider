import React, { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
	Calendar,
	Clock,
	Search,
	ListFilter,
	CircleAlert,
	CheckCircle2,
	X,
	ChevronRight,
	MapPin,
	CreditCard,
	ShieldCheck,
	Users,
	History as HistoryIcon,
	Loader2,
	ArrowUpRight,
	CalendarCheck,
	SlidersHorizontal,
	Check,
} from "lucide-react";
import api from "../../api/axiosInstance";
import ConfirmModal from "../../ui/ConfirmModal";
import BookingDetailsSheet from "../provider/BookingDetailsSheet";

const formatCurrency = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
	}).format(n || 0);

const BUFFER_MS = 15 * 60 * 60 * 1000;

function resolveDisplayStatus(status, date, startTime) {
	let s = (status || "").toLowerCase();
	const dateString =
		typeof date === "string"
			? date.split("T")[0]
			: new Date(date).toISOString().split("T")[0];
	const base = new Date(`${dateString}T00:00:00`);

	if (startTime) {
		const [h, m] = startTime.split(":");
		base.setHours(+h, +m);
	}
	const now = new Date();
	if (s === "booked" || s === "confirmed") {
		if (now > base) {
			s = now - base < BUFFER_MS ? "awaiting completion" : "expired";
		}
	}
	return s;
}

const STATUS_STYLES = {
	completed: {
		badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
		dot: "bg-emerald-400",
		icon: CheckCircle2,
	},
	cancelled: {
		badge: "bg-rose-500/10 text-rose-300 border-rose-500/20",
		dot: "bg-rose-400",
		icon: CircleAlert,
	},
	no_show: {
		badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
		dot: "bg-rose-400",
		icon: CircleAlert,
	},
	in_progress: {
		badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
		dot: "bg-indigo-400",
		icon: Clock,
	},
	"awaiting completion": {
		badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
		dot: "bg-amber-400",
		icon: Clock,
	},
	awaiting_completion: {
		badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
		dot: "bg-amber-400",
		icon: Clock,
	},
	booked: {
		badge: "bg-violet-500/10 text-violet-300 border-violet-500/20",
		dot: "bg-violet-400",
		icon: Clock,
	},
	confirmed: {
		badge: "bg-violet-500/10 text-violet-300 border-violet-500/20",
		dot: "bg-violet-400",
		icon: Clock,
	},
	expired: {
		badge: "bg-rose-500/10 text-amber-300 border-amber-500/20",
		dot: "bg-amber-400",
		icon: CircleAlert,
	},
	pending: {
		badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
		dot: "bg-amber-400",
		icon: Clock,
	},
};

const StatusBadge = ({ status, date, startTime }) => {
	const display = resolveDisplayStatus(status, date, startTime);
	const conf = STATUS_STYLES[display] || STATUS_STYLES.pending;
	const IconComp = conf.icon;

	return (
		<span
			className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 ${conf.badge}`}
		>
			<span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
			{display.replace(/_/g, " ")}
		</span>
	);
};

export default function ProviderBookings() {
	const [activeTab, setActiveTab] = useState("upcoming");
	const [bookings, setBookings] = useState([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [actionLoading, setActionLoading] = useState(null);
	const [selectedBooking, setSelectedBooking] = useState(null);
	const [showFilters, setShowFilters] = useState(false);
	const [meta, setMeta] = useState({
		current_page: 1,
		total_pages: 1,
		has_next_page: false,
	});
	const [confirmConfig, setConfirmConfig] = useState({
		isOpen: false,
		bookingId: null,
		newStatus: null,
		title: "",
		message: "",
	});

	const [tempFilters, setTempFilters] = useState({
		dateRange: "All Time",
		customerName: "",
		minPrice: "",
	});
	const [activeFilters, setActiveFilters] = useState({
		dateRange: "All Time",
		customerName: "",
		minPrice: "",
	});

	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedSearch(searchTerm);
			setMeta((p) => ({ ...p, current_page: 1 }));
		}, 400);
		return () => clearTimeout(t);
	}, [searchTerm]);

	useEffect(() => {
		const controller = new AbortController();
		const fetchBookingsList = async () => {
			setLoading(true);
			try {
				const params = new URLSearchParams({
					page: meta.current_page,
					limit: 10,
					type: activeTab,
					search: debouncedSearch,
					date_filter: activeFilters.dateRange,
					min_price: activeFilters.minPrice,
					customer_filter: activeFilters.customerName,
				});
				const res = await api.get(`/api/bookings/provider/list?${params}`, {
					signal: controller.signal,
				});
				setBookings(res.data?.data || []);
				setMeta(
					res.data?.meta || {
						current_page: 1,
						total_pages: 1,
						has_next_page: false,
					},
				);
			} catch (err) {
				if (err.name !== "AbortError" && err.name !== "CanceledError") {
					console.error("Provider bookings fetch error:", err);
				}
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		};
		fetchBookingsList();
		return () => controller.abort();
	}, [meta.current_page, activeTab, debouncedSearch, activeFilters]);

	const handleTabChange = (tab) => {
		setActiveTab(tab);
		setMeta((p) => ({ ...p, current_page: 1 }));
	};

	const handleApplyFilters = () => {
		setActiveFilters(tempFilters);
		setMeta((p) => ({ ...p, current_page: 1 }));
		setShowFilters(false);
	};

	const handleClearFilters = () => {
		const def = { dateRange: "All Time", customerName: "", minPrice: "" };
		setTempFilters(def);
		setActiveFilters(def);
		setMeta((p) => ({ ...p, current_page: 1 }));
		setShowFilters(false);
	};

	const handleStatusUpdate = (bookingId, newStatus, otpProvided, setError) => {
		if (newStatus === "cancelled") {
			setConfirmConfig({
				isOpen: true,
				bookingId,
				newStatus,
				title: "Decline Booking Request?",
				message:
					"Are you sure you want to decline this booking? The customer will receive an immediate notification and full payment refund.",
			});
			return;
		}
		return executeUpdate(bookingId, newStatus, otpProvided, setError);
	};

	const executeUpdate = useCallback(
		async (bookingId, newStatus, otpProvided, setError) => {
			setActionLoading(bookingId);
			try {
				const payload = { status: newStatus };
				if (otpProvided) {
					payload.otp_provided = otpProvided;
				}
				await api.put(`/api/bookings/${bookingId}/status`, payload);
				setBookings((prev) =>
					prev.map((b) =>
						b.booking_id === bookingId ? { ...b, status: newStatus } : b,
					),
				);
				if (selectedBooking?.booking_id === bookingId) {
					setSelectedBooking((prev) => ({ ...prev, status: newStatus }));
				}
				setConfirmConfig((c) => ({ ...c, isOpen: false }));
				toast.success(`Booking ${newStatus.replace(/_/g, " ")} successfully`);
				return true;
			} catch (err) {
				const errMsg =
					err.response?.data?.message || "Failed to update booking status";
				if (setError) {
					setError(errMsg);
				}
				toast.error(errMsg);
				return false;
			} finally {
				setActionLoading(null);
			}
		},
		[selectedBooking],
	);

	const isFilterActive =
		activeFilters.dateRange !== "All Time" ||
		Boolean(activeFilters.customerName) ||
		Boolean(activeFilters.minPrice);

	return (
		<div className="relative space-y-6">
			{/* Top Control Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
				<div>
					<div className="flex items-center gap-2.5">
						<h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
							Bookings
						</h1>
					</div>
					<p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
						Manage your service appointments, customer requests, and job schedules.
					</p>
				</div>

				{/* Search & Filter Trigger */}
				<div className="flex items-center gap-2.5">
					<div className="relative w-full sm:w-64">
						<Search
							className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
							size={14}
						/>
						<input
							type="text"
							placeholder="Search by service or client..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full pl-9 pr-4 py-2 bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] focus:border-violet-500/50 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
						/>
					</div>

					<div className="relative">
						<button
							onClick={() => setShowFilters(!showFilters)}
							className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
								showFilters || isFilterActive
									? "bg-violet-600/20 text-violet-300 border-violet-500/40 shadow-xs"
									: "bg-white/[0.03] text-slate-400 border-white/[0.08] hover:text-slate-200 hover:bg-white/[0.06]"
							}`}
						>
							<ListFilter size={14} />
							<span>Filters</span>
							{isFilterActive && (
								<span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
							)}
						</button>

						{/* Filter Popover Dropdown */}
						<AnimatePresence>
							{showFilters && (
								<motion.div
									initial={{ opacity: 0, y: 6, scale: 0.98 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									exit={{ opacity: 0, y: 6, scale: 0.98 }}
									transition={{ duration: 0.15 }}
									className="absolute right-0 top-12 z-30 w-80 bg-[#140b28] border border-white/[0.1] shadow-2xl shadow-black/80 rounded-2xl p-5 space-y-4"
								>
									<div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
										<span className="text-xs font-extrabold text-white uppercase tracking-wider">
											Filter Bookings
										</span>
										<button
											onClick={() => setShowFilters(false)}
											className="p-1 rounded-md text-slate-500 hover:text-slate-300"
										>
											<X size={14} />
										</button>
									</div>

									<div className="space-y-3.5 text-xs">
										<div>
											<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
												Date Window
											</label>
											<select
												className="w-full p-2.5 text-xs bg-black/40 border border-white/[0.08] rounded-xl text-slate-200 focus:outline-none focus:border-violet-500"
												value={tempFilters.dateRange}
												onChange={(e) =>
													setTempFilters({
														...tempFilters,
														dateRange: e.target.value,
													})
												}
											>
												<option value="All Time">All Time</option>
												<option value="This Month">Current Month</option>
												<option value="Last 3 Months">Past 90 Days</option>
											</select>
										</div>

										<div>
											<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
												Customer Name
											</label>
											<input
												type="text"
												value={tempFilters.customerName}
												placeholder="Search client name..."
												onChange={(e) =>
													setTempFilters({
														...tempFilters,
														customerName: e.target.value,
													})
												}
												className="w-full p-2.5 text-xs bg-black/40 border border-white/[0.08] rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500"
											/>
										</div>

										<div>
											<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
												Minimum Ticket Value (₹)
											</label>
											<input
												type="number"
												placeholder="e.g. 500"
												value={tempFilters.minPrice}
												onChange={(e) =>
													setTempFilters({
														...tempFilters,
														minPrice: e.target.value,
													})
												}
												className="w-full p-2.5 text-xs bg-black/40 border border-white/[0.08] rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500"
											/>
										</div>

										<div className="flex gap-2 pt-2 border-t border-white/[0.06]">
											<button
												onClick={handleClearFilters}
												className="flex-1 py-2 text-xs font-bold text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-xl border border-white/[0.06] cursor-pointer transition-colors"
											>
												Reset
											</button>
											<button
												onClick={handleApplyFilters}
												className="flex-1 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-xl cursor-pointer shadow-md shadow-violet-950 transition-colors"
											>
												Apply Filters
											</button>
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</div>

			{/* Status Tabs Switcher */}
			<div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
				{[
					{ key: "upcoming", label: "Active & Upcoming Queue", icon: Clock },
					{ key: "history", label: "Completed & Archived", icon: HistoryIcon },
				].map(({ key, label, icon: Icon }) => (
					<button
						key={key}
						onClick={() => handleTabChange(key)}
						className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition-all relative flex items-center gap-2 ${
							activeTab === key
								? "bg-violet-600/15 text-white border border-violet-500/30 shadow-xs"
								: "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
						}`}
					>
						<Icon size={14} className={activeTab === key ? "text-violet-400" : "text-slate-500"} />
						<span>{label}</span>
					</button>
				))}
			</div>

			{/* Bookings Table */}
			<div className="bg-[#120a22] border border-white/[0.07] rounded-3xl shadow-xl overflow-hidden min-h-[350px]">
				<div className="overflow-x-auto">
					{loading ? (
						<div className="flex flex-col items-center justify-center h-72 gap-3 text-slate-500">
							<Loader2 size={24} className="animate-spin text-violet-500" />
							<span className="text-xs font-bold">Loading bookings...</span>
						</div>
					) : bookings.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-72 text-center p-8 space-y-3">
							<div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-500">
								<CalendarCheck size={22} />
							</div>
							<div>
								<p className="font-bold text-sm text-slate-200">
									{activeTab === "upcoming"
										? "No upcoming bookings"
										: "No bookings match criteria"}
								</p>
								<p className="text-xs text-slate-500 mt-1">
									{activeTab === "upcoming"
										? "When customers book your services, they will appear here."
										: "Completed jobs and cancelled bookings will appear here."}
								</p>
							</div>
						</div>
					) : (
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="border-b border-white/[0.06] text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white/[0.01]">
									<th className="py-4 px-6">Service & Client</th>
									<th className="py-4 px-6">Scheduled Time</th>
									<th className="py-4 px-6">Amount</th>
									<th className="py-4 px-6">Status</th>
									<th className="py-4 px-6 text-right">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/[0.04] text-xs">
								{bookings.map((item) => {
									const rawDate = new Date(item.date);
									const y = rawDate.getFullYear();
									const mo = String(rawDate.getMonth() + 1).padStart(2, "0");
									const d = String(rawDate.getDate()).padStart(2, "0");
									const dateObj = new Date(`${y}-${mo}-${d}T00:00:00`);
									if (item.start_time) {
										const [h, m] = item.start_time.split(":");
										dateObj.setHours(+h, +m);
									}

									return (
										<tr
											key={item.booking_id}
											className="group hover:bg-white/[0.02] transition-colors"
										>
											{/* Service & Client */}
											<td className="py-4 px-6">
												<div className="space-y-1">
													<span className="font-bold text-white text-sm block group-hover:text-violet-300 transition-colors">
														{item.service_name || "On-Demand Service"}
													</span>
													<div className="flex items-center gap-2 text-slate-400">
														<div className="w-5 h-5 rounded-md bg-violet-500/20 text-violet-300 flex items-center justify-center text-[10px] font-bold">
															{(item.customer_name || "C")[0]?.toUpperCase()}
														</div>
														<span className="font-medium text-slate-300">
															{item.customer_name || "Customer"}
														</span>
														<span className="text-[10px] text-slate-600 font-mono">
															#{item.booking_id?.slice(0, 6).toUpperCase()}
														</span>
													</div>
												</div>
											</td>

											{/* Scheduled Window */}
											<td className="py-4 px-6">
												<div className="space-y-0.5">
													<span className="font-semibold text-white block">
														{dateObj.toLocaleDateString("en-IN", {
															month: "short",
															day: "numeric",
															year: "numeric",
														})}
													</span>
													<span className="text-[11px] text-slate-400 flex items-center gap-1">
														<Clock size={11} className="text-violet-400" />
														{dateObj.toLocaleTimeString("en-IN", {
															hour: "2-digit",
															minute: "2-digit",
															hour12: true,
														})}
													</span>
												</div>
											</td>

											{/* Settlement Amount */}
											<td className="py-4 px-6">
												<span className="font-mono text-sm font-extrabold text-emerald-400">
													{formatCurrency(item.price)}
												</span>
											</td>

											{/* Status */}
											<td className="py-4 px-6">
												<StatusBadge
													status={item.status}
													date={item.date}
													startTime={item.start_time}
												/>
											</td>

											{/* Actions */}
											<td className="py-4 px-6 text-right">
												<div className="flex items-center justify-end gap-2">
													{item.status === "pending" && (
														<button
															onClick={() =>
																handleStatusUpdate(item.booking_id, "confirmed")
															}
															disabled={actionLoading === item.booking_id}
															className="cursor-pointer px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
														>
															Accept Job
														</button>
													)}

													<button
														onClick={() => setSelectedBooking(item)}
														className="cursor-pointer px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06] font-semibold text-xs transition-colors"
													>
														View Details
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
			</div>

			{/* Slide-in Booking Inspection Details Sheet */}
			<AnimatePresence>
				{selectedBooking && (
					<BookingDetailsSheet
						booking={selectedBooking}
						onClose={() => setSelectedBooking(null)}
						onUpdateStatus={handleStatusUpdate}
						actionLoading={actionLoading}
					/>
				)}
			</AnimatePresence>

			{/* Confirmation Dialog */}
			<ConfirmModal
				isOpen={confirmConfig.isOpen}
				onClose={() => setConfirmConfig((c) => ({ ...c, isOpen: false }))}
				onConfirm={() =>
					executeUpdate(confirmConfig.bookingId, confirmConfig.newStatus)
				}
				title={confirmConfig.title || "Decline Booking Request?"}
				message={
					confirmConfig.message ||
					"The customer will receive an immediate notification and full payment refund."
				}
				confirmText="Decline booking"
				cancelText="Keep booking"
				variant="danger"
				loading={actionLoading === confirmConfig.bookingId}
			/>
		</div>
	);
}
