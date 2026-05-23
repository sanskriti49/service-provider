/**
 * dashboards/provider/ProviderBookings.jsx
 *
 * Provider's booking management page.
 * Dark theme mirror of customer's AllBookings — same table/tab/filter/pagination
 * pattern but with provider-specific actions (accept, complete, mark no-show)
 * and a dark slide-in details sheet.
 *
 * Route: /provider/bookings  (child of ProviderDashboard Outlet OR standalone)
 */
import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import api from "../../api/axiosInstance";
import ConfirmModal from "../../ui/ConfirmModal";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatCurrency = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
	}).format(n || 0);

const BUFFER_MS = 15 * 60 * 60 * 1000;

function resolveDisplayStatus(status, date, startTime) {
	let s = (status || "").toLowerCase();
	const base = new Date(date.split("T")[0] + "T00:00:00");
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

// ── Status badge — dark variant ───────────────────────────────────────────────
const STATUS_STYLES = {
	completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
	cancelled: "bg-red-500/15 text-red-300 border-red-500/25",
	no_show: "bg-red-500/20 text-red-300 border-red-500/30",
	in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/25",
	"awaiting completion": "bg-amber-500/15 text-amber-300 border-amber-500/25",
	awaiting_completion: "bg-amber-500/15 text-amber-300 border-amber-500/25",
	booked: "bg-violet-500/15 text-violet-300 border-violet-500/25",
	confirmed: "bg-violet-500/15 text-violet-300 border-violet-500/25",
	expired: "bg-orange-500/15 text-orange-300 border-orange-500/25",
	pending: "bg-slate-500/15 text-slate-300 border-slate-500/25",
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

// ── Booking details sheet (dark) ──────────────────────────────────────────────
function BookingDetailsSheet({
	booking,
	onClose,
	onUpdateStatus,
	actionLoading,
}) {
	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "unset";
		};
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
						<p className="text-xs font-mono text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md inline-block mt-1">
							#{booking.booking_id?.slice(0, 8).toUpperCase()}
						</p>
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

					{/* Provider action — mark complete / no-show */}
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
									className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/30 active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
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

					{/* Accept pending booking */}
					{booking.status === "pending" && (
						<div className="space-y-2">
							<button
								onClick={() => onUpdateStatus(booking.booking_id, "confirmed")}
								disabled={actionLoading === booking.booking_id}
								className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-900/30 active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
							>
								{actionLoading === booking.booking_id ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<CheckCircle2 size={16} />
								)}
								Accept Booking
							</button>
							<button
								onClick={() => onUpdateStatus(booking.booking_id, "cancelled")}
								disabled={actionLoading === booking.booking_id}
								className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
							>
								Decline
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
						{isRefunded && (
							<div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
								<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] rotate-[-15deg]">
									<ShieldCheck size={240} strokeWidth={1} />
								</div>
							</div>
						)}
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

// ── Main component ────────────────────────────────────────────────────────────
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

	// Debounce search
	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedSearch(searchTerm);
			setMeta((p) => ({ ...p, current_page: 1 }));
		}, 500);
		return () => clearTimeout(t);
	}, [searchTerm]);

	// Fetch
	useEffect(() => {
		const controller = new AbortController();
		const fetch = async () => {
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
		fetch();
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
				{/* ── Header ─────────────────────────────────────────────────── */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<h2 className="text-xl font-bold text-white">Bookings</h2>
						<p className="text-sm text-slate-400">
							Manage and track your service bookings.
						</p>
					</div>
					<div className="flex items-center gap-2">
						{/* Search */}
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
						{/* Filter toggle */}
						<button
							onClick={() => setShowFilters(!showFilters)}
							className={`p-2 border rounded-xl transition-colors ${
								showFilters
									? "bg-violet-500/15 text-violet-300 border-violet-500/30"
									: "bg-slate-800/60 text-slate-400 border-white/10 hover:bg-slate-700/60"
							}`}
						>
							{showFilters ? <X size={18} /> : <ListFilter size={18} />}
						</button>
					</div>

					{/* Filter dropdown */}
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
											className="mt-1.5 w-full p-2 text-sm bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500/50"
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
											className="mt-1.5 w-full p-2 text-sm bg-slate-800 border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
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
											className="mt-1.5 w-full p-2 text-sm bg-slate-800 border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
										/>
									</div>
									<div className="flex gap-2 pt-1">
										<button
											onClick={handleClearFilters}
											className="flex-1 py-2 text-sm font-medium text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors border border-white/8"
										>
											Clear
										</button>
										<button
											onClick={handleApplyFilters}
											className="flex-1 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-500 transition-colors"
										>
											Apply
										</button>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				{/* ── Tabs — dark mirror of customer tabs ────────────────────── */}
				<div className="border-b border-white/8">
					<div className="flex gap-8">
						{[
							{ key: "upcoming", label: "Upcoming", icon: Clock },
							{ key: "history", label: "History", icon: HistoryIcon },
						].map(({ key, label, icon: Icon }) => (
							<button
								key={key}
								onClick={() => handleTabChange(key)}
								className={`cursor-pointer pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
									activeTab === key
										? "text-violet-400"
										: "text-slate-500 hover:text-slate-300"
								}`}
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

				{/* ── Table ──────────────────────────────────────────────────── */}
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
									<Calendar size={24} className="text-slate-600" />
								</div>
								<p className="font-medium text-slate-300">
									{activeTab === "upcoming"
										? "No upcoming bookings"
										: "No booking history"}
								</p>
								<p className="text-sm text-slate-500 mt-1">
									New bookings will appear here.
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
										const isPast = dateObj < new Date();
										const pName = item.customer_name || "Customer";

										return (
											<tr
												key={item.booking_id}
												className="group hover:bg-white/[0.02] transition-colors"
											>
												{/* Service + customer */}
												<td className="p-5">
													<div className="flex flex-col">
														<span className="font-semibold text-white text-sm">
															{item.service_name || "Service"}
														</span>
														<div className="flex items-center gap-2 mt-1">
															<div className="w-5 h-5 rounded-full bg-violet-500/15 text-violet-300 flex items-center justify-center text-[10px] font-bold">
																{pName[0]}
															</div>
															<span className="text-xs text-slate-400">
																{pName}
															</span>
															<span className="text-[10px] text-slate-600 font-mono">
																#{item.booking_id?.slice(0, 6).toUpperCase()}
															</span>
														</div>
													</div>
												</td>
												{/* Date/time */}
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
												{/* Amount */}
												<td className="p-5">
													<span className="font-mono text-sm font-semibold text-emerald-400 tabular-nums">
														{formatCurrency(item.price)}
													</span>
												</td>
												{/* Status */}
												<td className="p-5">
													<StatusBadge
														status={item.status}
														date={item.date}
														startTime={item.start_time}
													/>
												</td>
												{/* Actions */}
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
																className="text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25 px-3 py-1.5 rounded-lg hover:bg-violet-500/25 transition-colors disabled:opacity-50"
															>
																{actionLoading === item.booking_id
																	? "..."
																	: "Accept"}
															</button>
														)}
														{(item.status === "confirmed" ||
															item.status === "in_progress") &&
															isPast && (
																<button
																	onClick={() =>
																		handleStatusUpdate(
																			item.booking_id,
																			"completed",
																		)
																	}
																	disabled={actionLoading === item.booking_id}
																	className="text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 px-3 py-1.5 rounded-lg hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
																>
																	{actionLoading === item.booking_id
																		? "..."
																		: "Complete"}
																</button>
															)}
														{!isPast &&
															["booked", "confirmed", "pending"].includes(
																item.status,
															) && (
																<button
																	onClick={() =>
																		handleStatusUpdate(
																			item.booking_id,
																			"cancelled",
																		)
																	}
																	disabled={actionLoading === item.booking_id}
																	className="text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
																>
																	Decline
																</button>
															)}
														<button
															onClick={() => setSelectedBooking(item)}
															className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-white/8"
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
					<div className="p-4 border-t border-white/6 bg-slate-950/30 flex justify-between items-center">
						<span className="text-xs text-slate-500 font-medium">
							Page {meta.current_page} of {meta.total_pages}
						</span>
						<div className="flex gap-2">
							<button
								onClick={() =>
									setMeta((p) => ({ ...p, current_page: p.current_page - 1 }))
								}
								disabled={meta.current_page === 1 || loading}
								className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 border border-white/8 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								Previous
							</button>
							<button
								onClick={() =>
									setMeta((p) => ({ ...p, current_page: p.current_page + 1 }))
								}
								disabled={!meta.has_next_page || loading}
								className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 border border-white/8 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								Next
							</button>
						</div>
					</div>
				</div>
			</motion.div>

			{/* Details sheet */}
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

			{/* Confirm modal */}
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
