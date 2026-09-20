import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import {
	CalendarCheck,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	KeyRound,
	ListFilter,
	Plus,
	Repeat,
	RotateCw,
	Search,
	Star,
	TriangleAlert,
	Wallet,
	X,
	Zap,
} from "lucide-react";
import BookingDetailsSheet from "./BookingDetailsSheet";
import ConfirmModal from "../../ui/ConfirmModal";
import api from "../../api/axiosInstance";

/* -------------------------------------------------------------------------- */
/*  Constants & helpers                                                       */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 5;

// After a confirmed booking's start time passes, it reads "awaiting completion"
// for this long, then "expired". NOTE: this is 15 hours, as in the original file.
// If you meant 15 minutes, use 15 * 60 * 1000.
const AWAITING_WINDOW_MS = 15 * 60 * 60 * 1000;

const CANCELLABLE = ["booked", "confirmed"];
const OTP_STATUSES = ["booked", "confirmed", "in_progress"];
const ACTIVE_STATUSES = ["pending", "booked", "confirmed", "in_progress"];
const LAPSED = ["cancelled", "no_show", "expired"];

const DATE_RANGES = ["All Time", "This Month", "Last 3 Months"];
const DEFAULT_FILTERS = {
	dateRange: "All Time",
	serviceName: "",
	minPrice: "",
};

const TABS = [
	{ key: "upcoming", label: "Upcoming" },
	{ key: "history", label: "History" },
];

const formatINR = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(n || 0);

/* Same colour language as the dashboards: violet = confirmed, amber = waiting,
   sky = live, emerald = done, rose = problem, stone = lapsed. */
const STATUS = {
	pending: {
		label: "Pending",
		dot: "bg-amber-300",
		text: "text-amber-200",
		rail: "from-amber-300/25 to-amber-300/5 text-amber-200",
		pulse: true,
	},
	booked: {
		label: "Confirmed",
		dot: "bg-violet-300",
		text: "text-violet-200",
		rail: "from-violet-400/25 to-violet-400/5 text-violet-200",
	},
	confirmed: {
		label: "Confirmed",
		dot: "bg-violet-300",
		text: "text-violet-200",
		rail: "from-violet-400/25 to-violet-400/5 text-violet-200",
	},
	in_progress: {
		label: "In progress",
		dot: "bg-sky-300",
		text: "text-sky-200",
		rail: "from-sky-300/25 to-sky-300/5 text-sky-200",
		pulse: true,
	},
	awaiting_completion: {
		label: "Awaiting completion",
		dot: "bg-orange-300",
		text: "text-orange-200",
		rail: "from-orange-300/25 to-orange-300/5 text-orange-200",
		pulse: true,
	},
	completed: {
		label: "Completed",
		dot: "bg-emerald-300",
		text: "text-emerald-200",
		rail: "from-emerald-300/25 to-emerald-300/5 text-emerald-200",
	},
	cancelled: {
		label: "Cancelled",
		dot: "bg-rose-300",
		text: "text-rose-200",
		rail: "from-rose-300/20 to-rose-300/5 text-rose-200",
	},
	no_show: {
		label: "No-show",
		dot: "bg-rose-300",
		text: "text-rose-200",
		rail: "from-rose-300/20 to-rose-300/5 text-rose-200",
	},
	expired: {
		label: "Expired",
		dot: "bg-stone-400",
		text: "text-stone-300",
		rail: "from-stone-400/20 to-stone-400/5 text-stone-300",
	},
};

// Same four steps as the overview tracker: Requested, Confirmed, In progress, Done.
const PROGRESS_STEP = {
	pending: 0,
	booked: 1,
	confirmed: 1,
	in_progress: 2,
	awaiting_completion: 2,
	completed: 3,
};
const PROGRESS_LABEL = ["Requested", "Confirmed", "In progress", "Done"];

/** Local date + start time as one Date. Returns null when the date is invalid. */
function toDateTime(date, startTime) {
	const raw = date ? new Date(date) : null;
	if (!raw || isNaN(raw)) return null;
	const d = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
	if (startTime) {
		const [h, m] = String(startTime).split(":");
		d.setHours(Number(h) || 0, Number(m) || 0);
	}
	return d;
}

function resolveStatus(item, when, now) {
	const status = String(item.status || "pending").toLowerCase();
	if (CANCELLABLE.includes(status) && when && now > when) {
		return now - when < AWAITING_WINDOW_MS ? "awaiting_completion" : "expired";
	}
	return status;
}

const dayStart = (d) =>
	new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function dayLabel(d) {
	const diff = Math.round((dayStart(d) - dayStart(new Date())) / 86400000);
	if (diff === 0) return "Today";
	if (diff === 1) return "Tomorrow";
	if (diff === -1) return "Yesterday";
	return d.toLocaleDateString("en-IN", {
		weekday: "long",
		day: "numeric",
		month: "short",
	});
}

const monthLabel = (d) =>
	d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/** Groups an already-ordered page of bookings under day (upcoming) or month (history) headings. */
function groupBookings(items, tab) {
	const groups = [];
	items.forEach((item) => {
		const when = toDateTime(item.date, item.start_time);
		const label = when
			? tab === "upcoming"
				? dayLabel(when)
				: monthLabel(when)
			: "No date";
		const last = groups[groups.length - 1];
		if (last && last.label === label) last.items.push(item);
		else groups.push({ label, items: [item] });
	});
	return groups;
}

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                              */
/* -------------------------------------------------------------------------- */

const fieldCls =
	"w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white placeholder:text-stone-500 transition-colors hover:border-white/[0.16] focus:outline-none focus:border-violet-400/50 focus:ring-2 focus:ring-violet-400/20";

const primaryBtn =
	"bg-gradient-to-r from-violet-400 to-fuchsia-400 text-[#0d0b12] font-semibold hover:brightness-110 shadow-[0_6px_24px_-8px_rgba(167,139,250,0.7)] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300";

function StatusLabel({ status }) {
	const st = STATUS[status] || STATUS.pending;
	return (
		<span className={`inline-flex items-center gap-1.5 text-xs ${st.text}`}>
			<span className="relative flex w-1.5 h-1.5">
				{st.pulse && (
					<span
						className={`absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping ${st.dot}`}
					/>
				)}
				<span
					className={`relative inline-flex w-1.5 h-1.5 rounded-full ${st.dot}`}
				/>
			</span>
			{st.label}
		</span>
	);
}

/** Four slim segments, the list-sized cousin of the overview's progress tracker. */
function MiniProgress({ status }) {
	const idx = PROGRESS_STEP[status];
	if (idx === undefined) return null;
	const done = status === "completed";
	return (
		<span
			role="img"
			aria-label={`Progress: ${PROGRESS_LABEL[idx]}`}
			className="hidden sm:flex items-center gap-0.5"
		>
			{PROGRESS_LABEL.map((_, i) => (
				<span
					key={i}
					className={`h-[3px] w-4 rounded-full ${
						i > idx
							? "bg-white/[0.1]"
							: done
								? "bg-emerald-300"
								: i === idx
									? "bg-amber-200"
									: "bg-violet-300"
					}`}
				/>
			))}
		</span>
	);
}

/** OTP as a small ticket stub: dashed edge, amber, same as the overview's OtpTicket. */
function OtpStub({ code }) {
	return (
		<span className="inline-flex items-center gap-2 h-6 pl-2 pr-2.5 rounded-md border border-dashed border-amber-300/35 bg-amber-300/[0.07] text-xs text-amber-200">
			<KeyRound size={12} aria-hidden />
			<span className="sr-only">Completion OTP</span>
			<span className="font-mono text-[13px] font-semibold tracking-[0.2em] text-white tabular-nums">
				{code}
			</span>
		</span>
	);
}

function RowButton({
	onClick,
	tone = "neutral",
	disabled,
	icon: Icon,
	children,
}) {
	const tones = {
		neutral:
			"border-white/[0.12] text-stone-300 hover:bg-white/[0.06] hover:text-white",
		violet: "border-violet-400/25 text-violet-200 hover:bg-violet-400/10",
		rose: "border-rose-400/25 text-rose-300 hover:bg-rose-400/10",
	};
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${tones[tone]}`}
		>
			{Icon && <Icon size={13} aria-hidden />}
			{children}
		</button>
	);
}

function BookingRow({ item, busy, onOpen, onCancel, onRebook }) {
	const now = new Date();
	const when = toDateTime(item.date, item.start_time);
	const status = resolveStatus(item, when, now);
	const st = STATUS[status] || STATUS.pending;
	const isPast = when ? when < now : false;
	const muted = LAPSED.includes(status);

	const otp = item.completion_otp || item.otp;
	const showOtp = OTP_STATUSES.includes(item.status) && otp;
	const canCancel = !isPast && CANCELLABLE.includes(item.status);
	const canRebook =
		item.custom_id && ["completed", "cancelled", "expired"].includes(status);
	const canRate = item.status === "completed";

	// Only show a time when the booking actually has one (a date alone parses to 12:00 AM).
	const timeStr =
		when && item.start_time
			? when.toLocaleTimeString("en-IN", {
					hour: "numeric",
					minute: "2-digit",
					hour12: true,
				})
			: null;
	const provider = item.provider_name || "Agency";
	const shortId = String(item.booking_id || "")
		.slice(0, 8)
		.toUpperCase();

	return (
		<li className="flex flex-col sm:flex-row sm:items-center hover:bg-white/[0.025] transition-colors">
			<button
				type="button"
				onClick={() => onOpen(item)}
				aria-label={`Open details for ${item.service_name || "booking"}`}
				className="group flex-1 min-w-0 flex items-center gap-4 px-4 sm:px-5 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-300"
			>
				<div
					className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-b flex flex-col items-center justify-center ${st.rail}`}
				>
					{when ? (
						<>
							<span className="text-[10px] font-semibold opacity-80 leading-none">
								{when.toLocaleDateString("en-IN", { month: "short" })}
							</span>
							<span className="font-mackinac text-lg font-bold text-white leading-none mt-1 tabular-nums">
								{when.getDate()}
							</span>
						</>
					) : (
						<span className="text-xs">--</span>
					)}
				</div>

				<div className="min-w-0 flex-1">
					<p
						className={`text-sm font-medium truncate transition-colors group-hover:text-violet-200 ${
							muted ? "text-stone-300" : "text-white"
						}`}
					>
						{item.service_name || "Service"}
					</p>

					<p className="mt-1 flex items-center gap-2 text-xs text-stone-500 min-w-0">
						<span
							aria-hidden
							className="w-4 h-4 shrink-0 rounded-full bg-gradient-to-br from-violet-400/40 to-fuchsia-400/30 border border-white/[0.1] flex items-center justify-center text-[9px] font-semibold text-white"
						>
							{provider[0]?.toUpperCase()}
						</span>
						<span className="truncate">
							{timeStr ? `${timeStr} · ` : ""}
							{provider}
							{shortId && <span className="font-mono"> · #{shortId}</span>}
						</span>
					</p>

					<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
						<StatusLabel status={status} />
						<MiniProgress status={status} />
						{showOtp && <OtpStub code={otp} />}
					</div>
				</div>

				<div className="shrink-0 flex items-center gap-2">
					<span
						className={`text-sm font-semibold tabular-nums ${
							muted ? "text-stone-400" : "text-white"
						}`}
					>
						{formatINR(item.price)}
					</span>
					<ChevronRight
						size={15}
						aria-hidden
						className="hidden sm:block text-stone-600 group-hover:text-violet-300 group-hover:translate-x-0.5 transition-all"
					/>
				</div>
			</button>

			{(canCancel || canRebook || canRate) && (
				<div className="flex items-center gap-2 px-4 pb-4 sm:p-0 sm:pr-5 shrink-0">
					{canRate && (
						<RowButton tone="violet" icon={Star} onClick={() => onOpen(item)}>
							Rate
						</RowButton>
					)}
					{canRebook && (
						<RowButton icon={Repeat} onClick={() => onRebook(item)}>
							Book again
						</RowButton>
					)}
					{canCancel && (
						<RowButton
							tone="rose"
							disabled={busy}
							onClick={() => onCancel(item.booking_id)}
						>
							{busy ? "Cancelling…" : "Cancel"}
						</RowButton>
					)}
				</div>
			)}
		</li>
	);
}

/** Compact totals across all of the customer's bookings, taken from the dashboard shell. */
function SummaryStrip({ bookings }) {
	const stats = useMemo(() => {
		const completed = bookings.filter((b) => b.status === "completed");
		return {
			active: bookings.filter((b) => ACTIVE_STATUSES.includes(b.status)).length,
			completed: completed.length,
			spent: completed.reduce((s, b) => s + (Number(b.price) || 0), 0),
		};
	}, [bookings]);

	const cells = [
		{
			label: "Active",
			value: stats.active,
			icon: Zap,
			chip: "bg-sky-300/12 text-sky-300",
		},
		{
			label: "Completed",
			value: stats.completed,
			icon: CheckCircle2,
			chip: "bg-emerald-300/12 text-emerald-300",
		},
		{
			label: "Spent",
			value: formatINR(stats.spent),
			icon: Wallet,
			chip: "bg-amber-300/12 text-amber-300",
		},
	];

	return (
		<div className="grid grid-cols-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-x divide-white/[0.06]">
			{cells.map((c) => {
				const Icon = c.icon;
				return (
					<div
						key={c.label}
						className="flex items-center gap-3 px-3 sm:px-5 py-3.5 min-w-0"
					>
						<span
							className={`hidden sm:flex w-9 h-9 shrink-0 rounded-lg items-center justify-center ${c.chip}`}
						>
							<Icon size={16} />
						</span>
						<div className="min-w-0">
							<p className="font-mackinac text-lg sm:text-xl font-bold text-white tabular-nums leading-none truncate">
								{c.value}
							</p>
							<p className="mt-1.5 text-xs text-stone-500">{c.label}</p>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function ListSkeleton() {
	return (
		<div
			className="space-y-7 animate-pulse"
			aria-busy="true"
			aria-label="Loading bookings"
		>
			{[3, 2].map((rows, g) => (
				<div key={g}>
					<div className="mb-3 h-3 w-24 rounded bg-white/[0.05]" />
					<div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.06]">
						{[...Array(rows)].map((_, i) => (
							<div key={i} className="flex items-center gap-4 px-5 py-4">
								<div className="w-12 h-12 rounded-xl bg-white/[0.05]" />
								<div className="flex-1 space-y-2.5">
									<div className="h-3.5 w-40 rounded bg-white/[0.06]" />
									<div className="h-3 w-56 max-w-full rounded bg-white/[0.04]" />
									<div className="h-3 w-24 rounded bg-white/[0.04]" />
								</div>
								<div className="h-4 w-14 rounded bg-white/[0.05]" />
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function Notice({ icon: Icon, tone = "violet", title, body, children }) {
	const tones = {
		violet: "bg-violet-400/10 text-violet-300",
		rose: "bg-rose-400/10 text-rose-300",
	};
	return (
		<div className="py-16 px-6 text-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015]">
			<span
				className={`mx-auto w-11 h-11 rounded-full flex items-center justify-center ${tones[tone]}`}
			>
				<Icon size={20} />
			</span>
			<p className="mt-4 text-sm font-medium text-white">{title}</p>
			<p className="mt-1 text-sm text-stone-500 max-w-xs mx-auto">{body}</p>
			{children}
		</div>
	);
}

function EmptyState({ tab, filtered, onClear }) {
	if (filtered) {
		return (
			<Notice
				icon={Search}
				title="No bookings match"
				body="Try a different search or loosen your filters."
			>
				<button
					type="button"
					onClick={onClear}
					className="mt-4 text-sm text-violet-300 hover:text-white transition-colors"
				>
					Clear search and filters
				</button>
			</Notice>
		);
	}
	const upcoming = tab === "upcoming";
	return (
		<Notice
			icon={CalendarCheck}
			title={upcoming ? "Nothing scheduled" : "No past bookings yet"}
			body={
				upcoming
					? "When you book a service, it shows up here with its OTP and status."
					: "Completed and cancelled services will collect here."
			}
		>
			{upcoming && (
				<Link
					to="/services"
					className={`mt-5 inline-flex h-10 px-4 items-center gap-2 rounded-lg text-sm ${primaryBtn}`}
				>
					<Plus size={15} />
					Book a service
				</Link>
			)}
		</Notice>
	);
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function AllBookings() {
	const navigate = useNavigate();
	const filterRef = useRef(null);
	const listTopRef = useRef(null);
	const firstLoad = useRef(true);

	// Dashboard shell shares every booking through <Outlet context>. Used only for the summary strip.
	const outlet = useOutletContext() || {};
	const shellBookings = Array.isArray(outlet.bookings) ? outlet.bookings : [];

	const [confirmConfig, setConfirmConfig] = useState({
		isOpen: false,
		bookingId: null,
		newStatus: null,
	});

	const [activeTab, setActiveTab] = useState("upcoming");
	const [history, setHistory] = useState([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState(false);
	const [reloadKey, setReloadKey] = useState(0);
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [actionLoading, setActionLoading] = useState(null);
	const [selectedBooking, setSelectedBooking] = useState(null);
	const [showFilters, setShowFilters] = useState(false);
	// Status changes made on this page, so the summary strip stays in step with the list.
	const [overrides, setOverrides] = useState({});

	const [meta, setMeta] = useState({
		current_page: 1,
		total_pages: 1,
		has_next_page: false,
	});
	const [tempFilters, setTempFilters] = useState(DEFAULT_FILTERS);
	const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchTerm);
			setMeta((prev) => ({ ...prev, current_page: 1 }));
		}, 500);
		return () => clearTimeout(timer);
	}, [searchTerm]);

	useEffect(() => {
		const controller = new AbortController();
		const fetchHistory = async () => {
			setLoading(true);
			setLoadError(false);
			try {
				const res = await api.get("/api/bookings/user/history", {
					params: {
						page: meta.current_page,
						limit: PAGE_SIZE,
						type: activeTab,
						search: debouncedSearch,
						date_filter: activeFilters.dateRange,
						min_price: activeFilters.minPrice,
						service_filter: activeFilters.serviceName,
					},
					signal: controller.signal,
				});
				if (res.data) {
					setHistory(res.data.data || []);
					setMeta(
						res.data.meta || {
							current_page: 1,
							total_pages: 1,
							has_next_page: false,
						},
					);
				}
			} catch (err) {
				if (err.name !== "CanceledError" && err.name !== "AbortError") {
					console.error("Error fetching history", err);
					setLoadError(true);
					toast.error("Couldn't load your bookings");
				}
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		};
		fetchHistory();
		return () => controller.abort();
	}, [meta.current_page, activeTab, debouncedSearch, activeFilters, reloadKey]);

	// Bring the top of the list back into view when the page changes (not on first load).
	useEffect(() => {
		if (firstLoad.current) {
			firstLoad.current = false;
			return;
		}
		listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [meta.current_page]);

	// Close the filter popover on outside click or Escape.
	useEffect(() => {
		if (!showFilters) return;
		const onDown = (e) => {
			if (filterRef.current && !filterRef.current.contains(e.target)) {
				setShowFilters(false);
			}
		};
		const onKey = (e) => e.key === "Escape" && setShowFilters(false);
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [showFilters]);

	const goToFirstPage = () => setMeta((p) => ({ ...p, current_page: 1 }));

	const toggleFilters = () => {
		if (!showFilters) setTempFilters(activeFilters);
		setShowFilters((v) => !v);
	};

	const applyFilters = () => {
		setActiveFilters(tempFilters);
		goToFirstPage();
		setShowFilters(false);
	};

	const clearFilters = () => {
		setTempFilters(DEFAULT_FILTERS);
		setActiveFilters(DEFAULT_FILTERS);
		goToFirstPage();
		setShowFilters(false);
	};

	const clearEverything = () => {
		setSearchTerm("");
		setDebouncedSearch("");
		clearFilters();
	};

	const removeFilter = (key) => {
		setActiveFilters((p) => ({ ...p, [key]: DEFAULT_FILTERS[key] }));
		setTempFilters((p) => ({ ...p, [key]: DEFAULT_FILTERS[key] }));
		goToFirstPage();
	};

	const changeTab = (tab) => {
		if (tab === activeTab) return;
		setHistory([]); // don't show the other tab's rows while the new ones load
		setActiveTab(tab);
		goToFirstPage();
	};

	const filterChips = useMemo(() => {
		const chips = [];
		if (activeFilters.dateRange !== DEFAULT_FILTERS.dateRange)
			chips.push({ key: "dateRange", label: activeFilters.dateRange });
		if (activeFilters.serviceName)
			chips.push({ key: "serviceName", label: activeFilters.serviceName });
		if (activeFilters.minPrice)
			chips.push({
				key: "minPrice",
				label: `From ${formatINR(activeFilters.minPrice)}`,
			});
		return chips;
	}, [activeFilters]);

	const isFiltered = filterChips.length > 0 || Boolean(debouncedSearch);
	const groups = useMemo(
		() => groupBookings(history, activeTab),
		[history, activeTab],
	);
	const summaryBookings = useMemo(
		() =>
			shellBookings.map((b) =>
				overrides[b.booking_id] ? { ...b, status: overrides[b.booking_id] } : b,
			),
		[shellBookings, overrides],
	);

	/* ---- status updates ---- */

	const executeApiUpdate = async (bookingId, newStatus) => {
		setActionLoading(bookingId);
		try {
			await api.put(`/api/bookings/${bookingId}/status`, { status: newStatus });
			setHistory((prev) =>
				prev.map((item) =>
					item.booking_id === bookingId ? { ...item, status: newStatus } : item,
				),
			);
			setOverrides((o) => ({ ...o, [bookingId]: newStatus }));
			setSelectedBooking((prev) =>
				prev && prev.booking_id === bookingId
					? { ...prev, status: newStatus }
					: prev,
			);
			setConfirmConfig((c) => ({ ...c, isOpen: false }));
			toast.success(`Booking ${newStatus.replace(/_/g, " ")}`);
		} catch (err) {
			toast.error(
				err.response?.data?.message ||
					err.message ||
					"Couldn't update the booking",
			);
			console.error("Error updating status:", err);
		} finally {
			setActionLoading(null);
		}
	};

	const handleStatusUpdate = (bookingId, newStatus) => {
		if (newStatus === "cancelled") {
			setConfirmConfig({ isOpen: true, bookingId, newStatus });
			return;
		}
		executeApiUpdate(bookingId, newStatus);
	};

	const handleRebook = (item) =>
		navigate(`/book/${item.custom_id}`, {
			state: { serviceName: item.service_name },
		});

	const showSkeleton = loading && history.length === 0;

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, ease: "easeOut" }}
			className="space-y-7"
		>
			{/* Header */}
			<header className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
				<div>
					<h1 className="font-mackinac text-3xl sm:text-4xl font-bold text-white tracking-tight">
						My bookings
					</h1>
					<p className="mt-2 text-sm text-stone-400">
						What's coming up, and everything you've booked before.
					</p>
				</div>
				<Link
					to="/services"
					className={`h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg text-sm ${primaryBtn}`}
				>
					<Plus size={15} />
					Book a service
				</Link>
			</header>

			{summaryBookings.length > 0 && (
				<SummaryStrip bookings={summaryBookings} />
			)}

			{/* Toolbar: tabs on the left, search and filters on the right */}
			<div className="space-y-3">
				<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
					<div
						role="tablist"
						aria-label="Booking type"
						className="inline-flex self-start p-1 rounded-xl border border-white/[0.08] bg-white/[0.03]"
					>
						{TABS.map((t) => {
							const on = activeTab === t.key;
							return (
								<button
									key={t.key}
									type="button"
									role="tab"
									aria-selected={on}
									onClick={() => changeTab(t.key)}
									className={`relative h-8 px-5 rounded-lg text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${
										on
											? "text-[#0d0b12] font-semibold"
											: "text-stone-400 hover:text-white"
									}`}
								>
									{on && (
										<motion.span
											layoutId="bookings-tab-pill"
											className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-300 to-fuchsia-300"
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 40,
											}}
										/>
									)}
									<span className="relative">{t.label}</span>
								</button>
							);
						})}
					</div>

					<div ref={filterRef} className="relative flex items-center gap-2">
						<div className="relative flex-1 lg:flex-none">
							<Search
								size={15}
								aria-hidden
								className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none"
							/>
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="Search by service or provider"
								aria-label="Search bookings"
								className={`${fieldCls} pl-9 pr-8 lg:w-72`}
							/>
							{searchTerm && (
								<button
									type="button"
									onClick={() => setSearchTerm("")}
									aria-label="Clear search"
									className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-500 hover:text-white"
								>
									<X size={14} />
								</button>
							)}
						</div>

						<button
							type="button"
							onClick={toggleFilters}
							aria-expanded={showFilters}
							aria-label="Filters"
							className={`relative h-10 w-10 shrink-0 rounded-lg border flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${
								showFilters || filterChips.length
									? "border-violet-400/40 bg-violet-400/10 text-violet-200"
									: "border-white/[0.08] bg-white/[0.04] text-stone-400 hover:text-white hover:border-white/[0.16]"
							}`}
						>
							<ListFilter size={17} />
							{filterChips.length > 0 && (
								<span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-br from-violet-300 to-fuchsia-300 text-[10px] font-bold text-[#0d0b12] flex items-center justify-center tabular-nums">
									{filterChips.length}
								</span>
							)}
						</button>

						<AnimatePresence>
							{showFilters && (
								<motion.div
									initial={{ opacity: 0, y: -6 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -6 }}
									transition={{ duration: 0.15 }}
									className="absolute right-0 top-full mt-2 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-white/[0.1] bg-[#15121d] p-4 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)]"
								>
									<div className="space-y-4">
										<div>
											<p className="text-xs text-stone-400">Date</p>
											<div className="mt-2 flex flex-wrap gap-1.5">
												{DATE_RANGES.map((range) => {
													const on = tempFilters.dateRange === range;
													return (
														<button
															key={range}
															type="button"
															aria-pressed={on}
															onClick={() =>
																setTempFilters((p) => ({
																	...p,
																	dateRange: range,
																}))
															}
															className={`h-8 px-3 rounded-lg border text-xs transition-colors ${
																on
																	? "border-violet-400/50 bg-violet-400/15 text-white"
																	: "border-white/[0.08] text-stone-400 hover:text-white hover:border-white/[0.18]"
															}`}
														>
															{range}
														</button>
													);
												})}
											</div>
										</div>

										<div>
											<label
												htmlFor="bk-service"
												className="text-xs text-stone-400"
											>
												Service
											</label>
											<input
												id="bk-service"
												type="text"
												value={tempFilters.serviceName}
												placeholder="Cleaning"
												onChange={(e) =>
													setTempFilters((p) => ({
														...p,
														serviceName: e.target.value,
													}))
												}
												className={`${fieldCls} mt-1.5`}
											/>
										</div>

										<div>
											<label
												htmlFor="bk-price"
												className="text-xs text-stone-400"
											>
												Minimum price
											</label>
											<div className="relative mt-1.5">
												<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">
													₹
												</span>
												<input
													id="bk-price"
													type="number"
													min="0"
													inputMode="numeric"
													value={tempFilters.minPrice}
													placeholder="500"
													onChange={(e) =>
														setTempFilters((p) => ({
															...p,
															minPrice: e.target.value,
														}))
													}
													className={`${fieldCls} pl-7`}
												/>
											</div>
										</div>

										<div className="flex gap-2 pt-1">
											<button
												type="button"
												onClick={clearFilters}
												className="flex-1 h-9 rounded-lg border border-white/[0.12] text-sm text-stone-300 hover:bg-white/[0.06] transition-colors"
											>
												Clear
											</button>
											<button
												type="button"
												onClick={applyFilters}
												className={`flex-1 h-9 rounded-lg text-sm ${primaryBtn}`}
											>
												Apply
											</button>
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>

				{filterChips.length > 0 && (
					<div className="flex flex-wrap items-center gap-2">
						{filterChips.map((c) => (
							<span
								key={c.key}
								className="inline-flex items-center gap-1 h-7 pl-3 pr-1.5 rounded-full border border-violet-400/25 bg-violet-400/10 text-xs text-violet-100"
							>
								{c.label}
								<button
									type="button"
									onClick={() => removeFilter(c.key)}
									aria-label={`Remove filter ${c.label}`}
									className="w-4 h-4 rounded-full flex items-center justify-center text-violet-300 hover:text-white hover:bg-white/10"
								>
									<X size={11} />
								</button>
							</span>
						))}
						<button
							type="button"
							onClick={clearFilters}
							className="text-xs text-stone-500 hover:text-white transition-colors"
						>
							Clear all
						</button>
					</div>
				)}
			</div>

			{/* List */}
			<section
				ref={listTopRef}
				aria-live="polite"
				role="tabpanel"
				className="min-h-[280px] scroll-mt-24"
			>
				{showSkeleton ? (
					<ListSkeleton />
				) : loadError && history.length === 0 ? (
					<Notice
						icon={TriangleAlert}
						tone="rose"
						title="Couldn't load your bookings"
						body="Check your connection and try again."
					>
						<button
							type="button"
							onClick={() => setReloadKey((k) => k + 1)}
							className="mt-5 h-9 px-4 inline-flex items-center gap-2 rounded-lg border border-white/[0.12] text-sm text-stone-200 hover:bg-white/[0.06] transition-colors"
						>
							<RotateCw size={14} />
							Try again
						</button>
					</Notice>
				) : history.length === 0 ? (
					<EmptyState
						tab={activeTab}
						filtered={isFiltered}
						onClear={clearEverything}
					/>
				) : (
					<div
						className={`space-y-7 transition-opacity duration-200 ${
							loading ? "opacity-50 pointer-events-none" : ""
						}`}
					>
						{groups.map((g) => (
							<div key={g.label}>
								<h2 className="mb-3 flex items-center gap-3 text-sm font-medium text-stone-400">
									{g.label}
									<span className="min-w-5 h-5 px-1.5 rounded-full bg-white/[0.06] text-[11px] text-stone-400 flex items-center justify-center tabular-nums">
										{g.items.length}
									</span>
									<span aria-hidden className="h-px flex-1 bg-white/[0.06]" />
								</h2>
								<ul className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.06] overflow-hidden">
									{g.items.map((item) => (
										<BookingRow
											key={item.booking_id}
											item={item}
											busy={actionLoading === item.booking_id}
											onOpen={setSelectedBooking}
											onCancel={(id) => handleStatusUpdate(id, "cancelled")}
											onRebook={handleRebook}
										/>
									))}
								</ul>
							</div>
						))}
					</div>
				)}

				{!showSkeleton && meta.total_pages > 1 && (
					<nav
						aria-label="Pagination"
						className="mt-6 flex items-center justify-between"
					>
						<p className="text-xs text-stone-500 tabular-nums">
							Page {meta.current_page} of {meta.total_pages}
						</p>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() =>
									setMeta((p) => ({ ...p, current_page: p.current_page - 1 }))
								}
								disabled={meta.current_page === 1 || loading}
								className="h-9 pl-2.5 pr-3.5 inline-flex items-center gap-1 rounded-lg border border-white/[0.1] text-sm text-stone-300 hover:bg-white/[0.06] hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
							>
								<ChevronLeft size={15} />
								Previous
							</button>
							<button
								type="button"
								onClick={() =>
									setMeta((p) => ({ ...p, current_page: p.current_page + 1 }))
								}
								disabled={!meta.has_next_page || loading}
								className="h-9 pl-3.5 pr-2.5 inline-flex items-center gap-1 rounded-lg border border-white/[0.1] text-sm text-stone-300 hover:bg-white/[0.06] hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
							>
								Next
								<ChevronRight size={15} />
							</button>
						</div>
					</nav>
				)}
			</section>

			<AnimatePresence>
				{selectedBooking && (
					<BookingDetailsSheet
						booking={selectedBooking}
						onClose={() => setSelectedBooking(null)}
						onUpdateStatus={handleStatusUpdate}
					/>
				)}
			</AnimatePresence>

			<ConfirmModal
				isOpen={confirmConfig.isOpen}
				onClose={() => setConfirmConfig((c) => ({ ...c, isOpen: false }))}
				onConfirm={() =>
					executeApiUpdate(confirmConfig.bookingId, confirmConfig.newStatus)
				}
				title="Cancel this booking?"
				message="The service comes off your schedule and the provider is notified."
				confirmText="Cancel booking"
				cancelText="Keep booking"
				variant="danger"
				loading={actionLoading === confirmConfig.bookingId}
			/>
		</motion.div>
	);
}
