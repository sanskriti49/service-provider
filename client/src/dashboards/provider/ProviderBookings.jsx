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
	completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
	cancelled: "bg-red-500/15 text-red-300 border-red-500/25",
	no_show: "bg-red-500/20 text-red-300 border-red-500/30",
	in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/25",
	"awaiting completion": "bg-amber-500/15 text-amber-300 border-amber-500/25",
	awaiting_completion: "bg-amber-500/15 text-amber-300 border-amber-500/25",
	booked: "bg-violet-500/15 text-violet-300 border-violet-500/25",
	confirmed: "bg-violet-500/15 text-violet-300 border-violet-500/25",
	expired: "bg-red-500/15 text-orange-300 border-orange-500/25",
	pending: "bg-orange-400/25 text-slate-300 border-orange-400/25",
};

const StatusBadge = ({ status, date, startTime }) => {
	const display = resolveDisplayStatus(status, date, startTime);
	const cls = STATUS_STYLES[display] || STATUS_STYLES.pending;
	const IconComp = ["completed"].includes(display)
		? CheckCircle2
		: ["cancelled", "no_show", "expired"].includes(display)
			? AlertCircle
			: Clock;
	return (
		<span
			className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1.5 w-fit ${cls}`}
		>
			<IconComp size={11} />
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
		}, 500);
		return () => clearTimeout(t);
	}, [searchTerm]);

	useEffect(() => {
		const controller = new AbortController();
		const fetchBookingsList = async () => {
			setLoading(true);
			try {
				const params = new URLSearchParams({
					page: meta.current_page,
					limit: 8,
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

	const handleStatusUpdate = (bookingId, newStatus) => {
		if (newStatus === "cancelled") {
			setConfirmConfig({
				isOpen: true,
				bookingId,
				newStatus,
				title: "Decline Booking?",
				message:
					"Are you sure you want to decline this booking? The customer will be notified.",
			});
			return;
		}
		executeUpdate(bookingId, newStatus);
	};

	const executeUpdate = useCallback(
		async (bookingId, newStatus) => {
			setActionLoading(bookingId);
			try {
				await api.put(`/api/bookings/${bookingId}/status`, {
					status: newStatus,
				});
				setBookings((prev) =>
					prev.map((b) =>
						b.booking_id === bookingId ? { ...b, status: newStatus } : b,
					),
				);
				if (selectedBooking?.booking_id === bookingId) {
					setSelectedBooking((prev) => ({ ...prev, status: newStatus }));
				}
				setConfirmConfig((c) => ({ ...c, isOpen: false }));
				toast.success(`Booking ${newStatus.replace(/_/g, " ")} successfully`, {
					className:
						"bricolage-grotesque font-semibold border border-emerald-500/20 bg-slate-900 text-emerald-400 rounded-2xl shadow-xl",
				});
			} catch (err) {
				toast.error("Failed to update booking status", {
					className:
						"bricolage-grotesque font-semibold border border-red-500/20 bg-slate-900 text-red-400 rounded-2xl",
				});
			} finally {
				setActionLoading(null);
			}
		},
		[selectedBooking],
	);

	return (
		<div className="relative">
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="space-y-6"
			>
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<h2 className="text-xl font-bold text-white">Bookings</h2>
						<p className="text-sm text-slate-400">
							Manage and track your service bookings.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search
								className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
								size={15}
							/>
							<input
								type="text"
								placeholder="Search bookings..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-9 pr-4 py-2 bg-slate-800/60 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all w-full sm:w-56"
							/>
						</div>
						<button
							onClick={() => setShowFilters(!showFilters)}
							className={`p-2 border rounded-xl transition-colors cursor-pointer ${showFilters ? "bg-violet-500/15 text-violet-300 border-violet-500/30" : "bg-slate-800/60 text-slate-400 border-white/10 hover:bg-slate-700/60"}`}
						>
							{showFilters ? <X size={18} /> : <ListFilter size={18} />}
						</button>
					</div>

					<AnimatePresence>
						{showFilters && (
							<motion.div
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								className="absolute right-0 top-16 z-10 w-72 bg-slate-900 border border-white/10 shadow-2xl shadow-black/40 rounded-2xl p-4"
							>
								<div className="space-y-4">
									<div>
										<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
											Date Range
										</label>
										<select
											className="mt-1.5 w-full p-2 text-sm bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none"
											value={tempFilters.dateRange}
											onChange={(e) =>
												setTempFilters({
													...tempFilters,
													dateRange: e.target.value,
												})
											}
										>
											<option value="All Time">All Time</option>
											<option value="This Month">This Month</option>
											<option value="Last 3 Months">Last 3 Months</option>
										</select>
									</div>
									<div>
										<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
											Customer Name
										</label>
										<input
											type="text"
											value={tempFilters.customerName}
											placeholder="e.g. Rahul"
											onChange={(e) =>
												setTempFilters({
													...tempFilters,
													customerName: e.target.value,
												})
											}
											className="mt-1.5 w-full p-2 text-sm bg-slate-800 border border-white/10 rounded-lg text-white"
										/>
									</div>
									<div>
										<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
											Min Price
										</label>
										<input
											type="number"
											placeholder="₹ 500"
											value={tempFilters.minPrice}
											onChange={(e) =>
												setTempFilters({
													...tempFilters,
													minPrice: e.target.value,
												})
											}
											className="mt-1.5 w-full p-2 text-sm bg-slate-800 border border-white/10 rounded-lg text-white"
										/>
									</div>
									<div className="flex gap-2 pt-1">
										<button
											onClick={handleClearFilters}
											className="flex-1 py-2 text-sm font-medium text-slate-400 bg-slate-800 rounded-lg border border-white/8 cursor-pointer"
										>
											Clear
										</button>
										<button
											onClick={handleApplyFilters}
											className="flex-1 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg cursor-pointer"
										>
											Apply
										</button>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				<div className="border-b border-white/8">
					<div className="flex gap-8">
						{[
							{ key: "upcoming", label: "Upcoming", icon: Clock },
							{ key: "history", label: "History", icon: HistoryIcon },
						].map(({ key, label, icon: Icon }) => (
							<button
								key={key}
								onClick={() => handleTabChange(key)}
								className={`cursor-pointer pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === key ? "text-violet-400" : "text-slate-500 hover:text-slate-300"}`}
							>
								<Icon size={15} />
								{label}
								{activeTab === key && (
									<motion.div
										layoutId="providerActiveTab"
										className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-t-full"
									/>
								)}
							</button>
						))}
					</div>
				</div>

				{/* Table implementation */}
				<div className="bg-slate-900/60 border border-white/8 rounded-2xl shadow-sm overflow-hidden min-h-[300px]">
					<div className="overflow-x-auto">
						{loading ? (
							<div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
								<div className="w-8 h-8 border-2 border-slate-700 border-t-violet-500 rounded-full animate-spin" />
								<span className="text-sm font-medium">Loading bookings...</span>
							</div>
						) : bookings.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-64 text-slate-600">
								<div className="p-4 bg-slate-800/60 rounded-full mb-3">
									<Calendar size={24} />
								</div>
								<p className="font-medium text-slate-300">
									{activeTab === "upcoming"
										? "No upcoming bookings"
										: "No booking history"}
								</p>
							</div>
						) : (
							<table className="w-full text-left border-collapse">
								<thead>
									<tr className="border-b border-white/6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
										<th className="p-5">Service · Customer</th>
										<th className="p-5">Date & Time</th>
										<th className="p-5">Amount</th>
										<th className="p-5">Status</th>
										<th className="p-5 text-right">Action</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/5">
									{Array.isArray(bookings) &&
										bookings.map((item) => {
											const rawDate = new Date(item.date);
											const y = rawDate.getFullYear();
											const mo = String(rawDate.getMonth() + 1).padStart(
												2,
												"0",
											);
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
													<td className="p-5">
														<div className="flex flex-col">
															<span className="font-semibold text-white text-sm">
																{item.service_name}
															</span>
															<div className="flex items-center gap-2 mt-1">
																<div className="w-5 h-5 rounded-full bg-violet-500/15 text-violet-300 flex items-center justify-center text-[10px] font-bold">
																	{(item.customer_name || "C")[0]}
																</div>
																<span className="text-xs text-slate-400">
																	{item.customer_name || "Customer"}
																</span>
																<span className="text-[10px] text-slate-600 font-mono">
																	#{item.booking_id?.slice(0, 6).toUpperCase()}
																</span>
															</div>
														</div>
													</td>
													<td className="p-5">
														<div className="flex flex-col">
															<span className="text-sm font-medium text-white">
																{dateObj.toLocaleDateString("en-IN", {
																	month: "short",
																	day: "numeric",
																	year: "numeric",
																})}
															</span>
															<span className="text-xs text-slate-500 mt-0.5">
																{dateObj.toLocaleDateString("en-IN", {
																	weekday: "short",
																})}{" "}
																·{" "}
																{dateObj.toLocaleTimeString("en-IN", {
																	hour: "2-digit",
																	minute: "2-digit",
																	hour12: true,
																})}
															</span>
														</div>
													</td>
													<td className="p-5">
														<span className="font-mono text-sm font-semibold text-emerald-400">
															{formatCurrency(item.price)}
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
															{item.status === "pending" && (
																<button
																	onClick={() =>
																		handleStatusUpdate(
																			item.booking_id,
																			"confirmed",
																		)
																	}
																	disabled={actionLoading === item.booking_id}
																	className="cursor-pointer text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25 px-3 py-1.5 rounded-lg"
																>
																	Accept
																</button>
															)}
															<button
																onClick={() => setSelectedBooking(item)}
																className="cursor-pointer text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 hover:bg-slate-800 rounded-lg"
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
				</div>
			</motion.div>

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

			<ConfirmModal
				isOpen={confirmConfig.isOpen}
				onClose={() => setConfirmConfig((c) => ({ ...c, isOpen: false }))}
				onConfirm={() =>
					executeUpdate(confirmConfig.bookingId, confirmConfig.newStatus)
				}
				title={confirmConfig.title}
				message={confirmConfig.message}
				loading={actionLoading === confirmConfig.bookingId}
			/>
		</div>
	);
}
