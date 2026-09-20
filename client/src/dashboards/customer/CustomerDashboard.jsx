import { useState, useEffect, useCallback, useMemo } from "react";
import {
	NavLink,
	Outlet,
	Link,
	useNavigate,
	useLocation,
} from "react-router-dom";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
	LayoutDashboard,
	CalendarCheck,
	User,
	Settings,
	LogOut,
	Bell,
	BellRing,
	Search,
	Menu,
	X,
	ChevronRight,
	Copy,
	Check,
	LifeBuoy,
	Wallet,
	Clock,
	Repeat,
	Star,
	SprayCan,
	Wrench,
	PlugZap,
	Shirt,
	ChefHat,
	Bug,
	Flower2,
	Laptop,
	Truck,
	KeyRound,
	Sparkles,
	Hourglass,
	ArrowUpRight,
	CheckCircle2,
	Zap,
	Users,
	IndianRupee,
} from "lucide-react";
import api from "../../api/axiosInstance";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import ConfirmDialog from "../../ui/ConfirmDialog";
import useModal from "../../hooks/useModal";
import Logo from "../../ui/Logo";
import ScrollToTop from "../../ui/ScrollToTop";

/* -------------------------------------------------------------------------- */
/*  Constants & helpers                                                       */
/* -------------------------------------------------------------------------- */

const formatCurrency = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(n || 0);

const ACTIVE_STATUSES = ["pending", "booked", "confirmed", "in_progress"];

const STATUS_MAP = {
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
};

const CATEGORIES = [
	{ slug: "house-cleaning", label: "Cleaning", icon: SprayCan },
	{ slug: "plumbing", label: "Plumbing", icon: Wrench },
	{ slug: "electrical-repair", label: "Electrical", icon: PlugZap },
	{ slug: "laundry", label: "Laundry", icon: Shirt },
	{ slug: "cooking-help", label: "Cooking", icon: ChefHat },
	{ slug: "pest-control", label: "Pest control", icon: Bug },
	{ slug: "gardening", label: "Gardening", icon: Flower2 },
	{ slug: "computer-tech-repair", label: "Tech repair", icon: Laptop },
	{ slug: "moving-help", label: "Moving", icon: Truck },
];

// Requested -> Confirmed -> In progress -> Done
const TRACKER_STEPS = ["Requested", "Confirmed", "In progress", "Done"];

const stepIndex = (status) => {
	if (status === "completed") return 3;
	if (status === "in_progress") return 2;
	if (status === "booked" || status === "confirmed") return 1;
	return 0;
};

const bookingTime = (b) => {
	const d = b?.date ? new Date(b.date) : null;
	return d && !isNaN(d) ? d.getTime() : Infinity;
};

// Soonest first. Bookings without a valid date sink to the bottom.
const sortSoonest = (a, b) =>
	bookingTime(a) - bookingTime(b) ||
	String(a.start_time || "").localeCompare(String(b.start_time || ""));

const startOfDay = (d) => {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x.getTime();
};

function relativeDay(dateStr) {
	const d = dateStr ? new Date(dateStr) : null;
	if (!d || isNaN(d)) return "Scheduled";
	const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
	if (diff === 0) return "Today";
	if (diff === 1) return "Tomorrow";
	if (diff > 1 && diff < 7) return `In ${diff} days`;
	return d.toLocaleDateString("en-IN", {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
}

function greeting() {
	const h = new Date().getHours();
	if (h < 5) return "Up late";
	if (h < 12) return "Good morning";
	if (h < 17) return "Good afternoon";
	return "Good evening";
}

// Best-effort link back to the service page for "Book again".
function slugFor(booking) {
	if (booking?.service_slug) return booking.service_slug;
	if (booking?.category_slug) return booking.category_slug;
	const name = (booking?.service_name || "").toLowerCase();
	const hit = CATEGORIES.find(
		(c) =>
			name.includes(c.label.toLowerCase()) ||
			name.includes(c.slug.replace(/-/g, " ")),
	);
	return hit?.slug || null;
}

function monthlySpend(bookings, months = 6) {
	const now = new Date();
	const buckets = [];
	for (let i = months - 1; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		buckets.push({
			key: `${d.getFullYear()}-${d.getMonth()}`,
			label: d.toLocaleDateString("en-IN", { month: "short" }),
			total: 0,
		});
	}
	bookings
		.filter((b) => b.status === "completed")
		.forEach((b) => {
			const d = b.date ? new Date(b.date) : null;
			if (!d || isNaN(d)) return;
			const bucket = buckets.find(
				(x) => x.key === `${d.getFullYear()}-${d.getMonth()}`,
			);
			if (bucket) bucket.total += Number(b.price) || 0;
		});
	return buckets;
}

const hasReview = (b) =>
	Boolean(b.reviewed || b.has_review || b.review_id || b.rating);

/* -------------------------------------------------------------------------- */
/*  Motion: one orchestrated entrance for the overview                        */
/* -------------------------------------------------------------------------- */

const containerVariants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.07, delayChildren: 0.02 } },
};
const itemVariants = {
	hidden: { opacity: 0, y: 12 },
	show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

/* -------------------------------------------------------------------------- */
/*  Sidebar                                                                   */
/* -------------------------------------------------------------------------- */

function NavItem({ to, icon: Icon, label, end = false, onClick, badge }) {
	return (
		<NavLink
			to={to}
			end={end}
			onClick={onClick}
			className={({ isActive }) =>
				`group relative flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-colors ${
					isActive
						? "bg-gradient-to-r from-violet-400/[0.16] to-violet-400/[0.03] text-white font-medium"
						: "text-stone-400 hover:text-white hover:bg-white/[0.04]"
				}`
			}
		>
			{({ isActive }) => (
				<>
					{isActive && (
						<motion.span
							layoutId="customer-nav-indicator"
							className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-gradient-to-b from-violet-300 to-fuchsia-400"
							transition={{ type: "spring", stiffness: 500, damping: 40 }}
						/>
					)}
					<Icon
						size={17}
						className={
							isActive
								? "text-violet-300"
								: "text-stone-500 group-hover:text-stone-300"
						}
					/>
					<span className="flex-1">{label}</span>
					{badge > 0 && (
						<span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-br from-violet-300 to-fuchsia-300 text-[11px] font-bold text-[#0d0b12] flex items-center justify-center tabular-nums">
							{badge > 99 ? "99+" : badge}
						</span>
					)}
				</>
			)}
		</NavLink>
	);
}

function Sidebar({
	user,
	notifications,
	activeCount,
	onLogout,
	onLinkClick,
	totalSpent,
}) {
	const [copied, setCopied] = useState(false);

	const handleCopyId = useCallback(() => {
		if (!user?.custom_id) return;
		navigator.clipboard.writeText(user.custom_id);
		setCopied(true);
		toast.success("Customer ID copied");
		setTimeout(() => setCopied(false), 2000);
	}, [user?.custom_id]);

	return (
		<aside className="h-full flex flex-col bg-[#0d0b12] border-r border-white/[0.06] relative overflow-hidden">
			<div
				aria-hidden
				className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-violet-500/[0.10] via-fuchsia-500/[0.03] to-transparent pointer-events-none"
			/>

			<div className="relative h-16 px-5 flex items-center shrink-0">
				<Logo to="/" size="md" theme="dark" />
			</div>

			{/* Identity */}
			<div className="relative px-3 pb-4">
				<div className="flex items-center gap-3 px-2 py-2">
					<div className="relative shrink-0">
						<div className="p-[2px] rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-amber-300">
							<div className="w-9 h-9 rounded-full bg-[#1a1428] flex items-center justify-center text-sm font-semibold text-white overflow-hidden">
								{user?.photo ? (
									<img
										src={user.photo}
										alt=""
										className="w-full h-full object-cover"
									/>
								) : (
									<span>{user?.name?.[0]?.toUpperCase() || "C"}</span>
								)}
							</div>
						</div>
						<span
							aria-hidden
							className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0d0b12]"
						/>
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium text-white truncate">
							{user?.name || "Customer"}
						</p>
						{user?.custom_id ? (
							<button
								type="button"
								onClick={handleCopyId}
								aria-label="Copy customer ID"
								className="group flex items-center gap-1.5 text-xs text-stone-500 hover:text-violet-300 transition-colors"
							>
								<span className="font-mono truncate">{user.custom_id}</span>
								{copied ? (
									<Check size={11} className="text-emerald-400 shrink-0" />
								) : (
									<Copy
										size={11}
										className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
									/>
								)}
							</button>
						) : (
							<p className="text-xs text-stone-500 truncate">
								Customer account
							</p>
						)}
					</div>
				</div>
			</div>

			<nav
				className="relative flex-1 px-3 space-y-0.5 overflow-y-auto"
				aria-label="Customer navigation"
			>
				<NavItem
					to="/dashboard"
					end
					icon={LayoutDashboard}
					label="Overview"
					onClick={onLinkClick}
				/>
				<NavItem
					to="/dashboard/bookings"
					icon={CalendarCheck}
					label="My bookings"
					badge={activeCount}
					onClick={onLinkClick}
				/>
				<NavItem
					to="/account/profile"
					icon={User}
					label="Profile"
					onClick={onLinkClick}
				/>
				<NavItem
					to="/account/settings"
					icon={Settings}
					label="Settings"
					onClick={onLinkClick}
				/>

				<div className="my-3 mx-3 h-px bg-white/[0.06]" />

				<NavItem
					to="/notifications"
					icon={Bell}
					label="Notifications"
					badge={notifications}
					onClick={onLinkClick}
				/>
			</nav>

			{/* Spent summary, amber = money across the customer theme */}
			{totalSpent > 0 && (
				<div className="relative mx-3 mb-3 p-3.5 rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.08] to-transparent">
					<p className="flex items-center gap-2 text-xs font-medium text-amber-200">
						<Wallet size={13} />
						Spent with TaskGenie
					</p>
					<p className="mt-1.5 font-mackinac text-xl font-bold text-white tabular-nums">
						{formatCurrency(totalSpent)}
					</p>
				</div>
			)}

			<div className="relative p-3 border-t border-white/[0.06] space-y-0.5">
				<Link
					to="/help"
					onClick={onLinkClick}
					className="flex items-center gap-3 h-10 px-3 rounded-lg text-sm text-stone-400 hover:text-white hover:bg-white/[0.04] transition-colors"
				>
					<LifeBuoy size={17} className="text-sky-300/70" />
					Help and support
				</Link>
				<button
					type="button"
					onClick={onLogout}
					className="w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm text-stone-400 hover:text-rose-300 hover:bg-rose-400/[0.08] transition-colors"
				>
					<LogOut size={17} />
					Sign out
				</button>
			</div>
		</aside>
	);
}

/* -------------------------------------------------------------------------- */
/*  Shell                                                                     */
/* -------------------------------------------------------------------------- */

export default function CustomerDashboard() {
	const navigate = useNavigate();
	const location = useLocation();
	const { user, logout } = useAuth();

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
	const [notifications, setNotifications] = useState(0);
	const [bookings, setBookings] = useState([]);

	const isOverviewPage =
		location.pathname === "/dashboard" || location.pathname === "/dashboard/";

	useModal({
		isOpen: sidebarOpen,
		onClose: () => setSidebarOpen(false),
		id: "customer-mobile-sidebar",
		lockScroll: true,
	});

	useEffect(() => {
		let alive = true;
		const safetyTimer = setTimeout(() => {
			if (alive) setIsLoading(false);
		}, 4000);
		(async () => {
			try {
				const [bookingsRes, dashboardRes] = await Promise.allSettled([
					api.get("/api/bookings/my-bookings"),
					api.get("/api/dashboard/customer"),
				]);

				if (!alive) return;
				if (bookingsRes.status === "rejected") {
					toast.error("Couldn't load your bookings");
				}
				if (bookingsRes.status === "fulfilled") {
					setBookings(
						bookingsRes.value.data?.bookings || bookingsRes.value.data || [],
					);
				}
				if (dashboardRes.status === "fulfilled") {
					setNotifications(dashboardRes.value.data?.pending_notifications || 0);
				}
			} catch (err) {
				console.warn("Customer dashboard metrics notice:", err?.message);
			} finally {
				clearTimeout(safetyTimer);
				if (alive) setIsLoading(false);
			}
		})();
		return () => {
			alive = false;
			clearTimeout(safetyTimer);
		};
	}, [user?.id]);

	const totalSpent = useMemo(
		() =>
			bookings
				.filter((b) => b.status === "completed")
				.reduce((sum, b) => sum + (Number(b.price) || 0), 0),
		[bookings],
	);

	const activeCount = useMemo(
		() => bookings.filter((b) => ACTIVE_STATUSES.includes(b.status)).length,
		[bookings],
	);

	const handleLogout = useCallback(() => setShowLogoutConfirm(true), []);
	const executeLogout = useCallback(() => {
		setShowLogoutConfirm(false);
		logout();
		navigate("/login");
	}, [logout, navigate]);
	const closeSidebar = useCallback(() => setSidebarOpen(false), []);

	const sidebarProps = {
		user,
		notifications,
		activeCount,
		onLogout: handleLogout,
		totalSpent,
	};

	return (
		<MotionConfig reducedMotion="user">
			<div className="min-h-screen bg-[#0d0b12] text-stone-200 bricolage-grotesque antialiased selection:bg-violet-400/30">
				<ScrollToTop />

				{/* Mobile drawer */}
				<AnimatePresence>
					{sidebarOpen && (
						<>
							<motion.div
								key="overlay"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								onClick={closeSidebar}
								className="fixed inset-0 bg-black/70 z-40 lg:hidden"
							/>
							<motion.div
								key="drawer"
								initial={{ x: "-100%" }}
								animate={{ x: 0 }}
								exit={{ x: "-100%" }}
								transition={{ type: "spring", stiffness: 380, damping: 38 }}
								className="fixed top-0 left-0 bottom-0 w-[280px] z-50 lg:hidden"
							>
								<button
									type="button"
									onClick={closeSidebar}
									aria-label="Close menu"
									className="absolute top-4 right-3 z-10 p-1.5 rounded-md text-stone-400 hover:text-white"
								>
									<X size={18} />
								</button>
								<Sidebar {...sidebarProps} onLinkClick={closeSidebar} />
							</motion.div>
						</>
					)}
				</AnimatePresence>

				<div className="flex min-h-screen">
					{/* Desktop sticky sidebar */}
					<div className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
						<Sidebar {...sidebarProps} onLinkClick={() => {}} />
					</div>

					<div className="flex-1 flex flex-col min-w-0 relative">
						{/* Backdrop glow: violet on the left, warm amber on the right */}
						<div
							aria-hidden
							className="absolute inset-x-0 top-0 h-[460px] pointer-events-none bg-[radial-gradient(60%_100%_at_20%_0%,rgba(139,92,246,0.14),transparent_70%),radial-gradient(45%_80%_at_85%_0%,rgba(251,191,36,0.08),transparent_70%)]"
						/>

						{/* Mobile topbar */}
						<header className="lg:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between bg-[#0d0b12]/90 backdrop-blur-md border-b border-white/[0.06]">
							<button
								type="button"
								onClick={() => setSidebarOpen(true)}
								aria-label="Open menu"
								className="p-2 -ml-2 rounded-md text-stone-300 hover:text-white"
							>
								<Menu size={20} />
							</button>
							<Logo to="/" size="md" theme="dark" />
							<Link
								to="/notifications"
								aria-label="Notifications"
								className="relative p-2 -mr-2 rounded-md text-stone-300 hover:text-white"
							>
								<Bell size={19} />
								{notifications > 0 && (
									<span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-fuchsia-400" />
								)}
							</Link>
						</header>

						<main className="relative flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-12">
							{isLoading ? (
								<CustomerSkeleton />
							) : isOverviewPage ? (
								<CustomerOverview
									user={user}
									bookings={bookings}
									totalSpent={totalSpent}
									notifications={notifications}
								/>
							) : (
								<Outlet context={{ user, bookings, totalSpent }} />
							)}
						</main>
					</div>
				</div>

				<ConfirmDialog
					isOpen={showLogoutConfirm}
					onClose={() => setShowLogoutConfirm(false)}
					onConfirm={executeLogout}
					title="Sign out?"
					description="You will need to sign in again to access your customer dashboard."
					confirmText="Sign out"
					cancelText="Cancel"
					variant="danger"
					icon={LogOut}
				/>
			</div>
		</MotionConfig>
	);
}

/* -------------------------------------------------------------------------- */
/*  Overview building blocks                                                  */
/* -------------------------------------------------------------------------- */

/** Four-step progress tracker for a live booking. */
function ProgressTracker({ status }) {
	const current = stepIndex(status);
	const fill = current / (TRACKER_STEPS.length - 1);

	return (
		<div
			className="relative"
			role="img"
			aria-label={`Booking progress: ${TRACKER_STEPS[current]}`}
		>
			{/* Track runs between the first and last dot centres (cells are 25% wide) */}
			<div className="absolute left-[12.5%] right-[12.5%] top-[11px] h-px bg-white/[0.1]" />
			<motion.div
				className="absolute left-[12.5%] right-[12.5%] top-[11px] h-px origin-left bg-gradient-to-r from-violet-300 to-amber-200"
				initial={{ scaleX: 0 }}
				animate={{ scaleX: fill }}
				transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
			/>

			<ol className="relative grid grid-cols-4">
				{TRACKER_STEPS.map((label, i) => {
					const done = i < current;
					const isCurrent = i === current;
					return (
						<li key={label} className="flex flex-col items-center gap-2">
							<span
								className={`relative w-[22px] h-[22px] rounded-full flex items-center justify-center transition-colors ${
									done
										? "bg-gradient-to-br from-violet-300 to-fuchsia-300 text-[#0d0b12]"
										: isCurrent
											? "bg-[#0d0b12] border-2 border-amber-200 text-amber-200"
											: "bg-[#0d0b12] border border-white/[0.14] text-transparent"
								}`}
							>
								{done && <Check size={12} strokeWidth={3} />}
								{isCurrent && (
									<>
										<span className="absolute inset-0 rounded-full border-2 border-amber-200/60 animate-ping" />
										<span className="w-1.5 h-1.5 rounded-full bg-amber-200" />
									</>
								)}
							</span>
							<span
								className={`text-[11px] sm:text-xs text-center leading-tight ${
									isCurrent
										? "text-white font-medium"
										: done
											? "text-stone-300"
											: "text-stone-600"
								}`}
							>
								{label}
							</span>
						</li>
					);
				})}
			</ol>
		</div>
	);
}

/** Ticket-style OTP stub with perforation notches. */
function OtpTicket({ code }) {
	return (
		<div className="relative shrink-0 sm:w-44 rounded-xl border border-amber-300/25 bg-gradient-to-br from-amber-300/[0.10] to-amber-300/[0.02] px-4 py-3.5">
			<span
				aria-hidden
				className="hidden sm:block absolute -left-[7px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#0d0b12] border-r border-amber-300/25"
			/>
			<div className="flex items-center gap-2 text-xs text-amber-200">
				<KeyRound size={14} />
				Completion OTP
			</div>
			<p className="mt-1.5 font-mono text-2xl font-bold text-white tracking-[0.28em] tabular-nums">
				{code}
			</p>
			<p className="mt-1 text-[11px] leading-snug text-stone-400">
				Share it only when the work is done.
			</p>
		</div>
	);
}

/** Monthly spend bars. Current month is highlighted, like the provider's PriceSpark. */
function MonthBars({ months }) {
	const max = Math.max(...months.map((m) => m.total), 0);
	if (max === 0) return null;
	return (
		<div
			className="flex items-end gap-1.5 h-12"
			role="img"
			aria-label="Spending over the last six months"
		>
			{months.map((m, i) => (
				<motion.span
					key={m.key}
					title={`${m.label}: ${formatCurrency(m.total)}`}
					initial={{ height: 0 }}
					animate={{ height: `${Math.max(12, (m.total / max) * 100)}%` }}
					transition={{
						delay: 0.15 + i * 0.05,
						duration: 0.5,
						ease: "easeOut",
					}}
					className={`w-2.5 rounded-sm ${
						i === months.length - 1
							? "bg-gradient-to-t from-amber-300 to-amber-200"
							: "bg-white/[0.14]"
					}`}
				/>
			))}
		</div>
	);
}

/* Stat tile: tinted icon chip + value, one meaning-colour each */
const STAT_TONES = {
	sky: {
		chip: "bg-sky-300/12 text-sky-300",
		glow: "group-hover:border-sky-300/25",
	},
	emerald: {
		chip: "bg-emerald-300/12 text-emerald-300",
		glow: "group-hover:border-emerald-300/25",
	},
	violet: {
		chip: "bg-violet-300/12 text-violet-300",
		glow: "group-hover:border-violet-300/25",
	},
	fuchsia: {
		chip: "bg-fuchsia-300/12 text-fuchsia-300",
		glow: "group-hover:border-fuchsia-300/25",
	},
};

function Stat({ label, value, hint, icon: Icon, tone = "sky", to }) {
	const t = STAT_TONES[tone];
	const inner = (
		<div
			className={`h-full p-4 rounded-xl border border-white/[0.07] bg-white/[0.025] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:bg-white/[0.045] ${t.glow}`}
		>
			<div className="flex items-center justify-between">
				<span
					className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.chip}`}
				>
					<Icon size={15} />
				</span>
				{to && (
					<ArrowUpRight
						size={14}
						className="text-stone-600 group-hover:text-stone-300 transition-colors"
					/>
				)}
			</div>
			<p className="mt-4 font-mackinac text-3xl font-bold tabular-nums text-white">
				{value}
			</p>
			<p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
				{label}
			</p>
			{hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
		</div>
	);
	return to ? (
		<Link to={to} className="group block h-full">
			{inner}
		</Link>
	) : (
		<div className="group h-full">{inner}</div>
	);
}

function SectionHeader({ title, to, linkLabel }) {
	return (
		<div className="flex items-center justify-between mb-4">
			<h2 className="font-mackinac text-xl font-bold text-white">{title}</h2>
			{to && (
				<Link
					to={to}
					className="text-sm text-violet-300 hover:text-violet-200 inline-flex items-center gap-1 transition-colors"
				>
					{linkLabel} <ChevronRight size={14} />
				</Link>
			)}
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*  Overview                                                                  */
/* -------------------------------------------------------------------------- */

function CustomerOverview({ user, bookings, totalSpent, notifications }) {
	const navigate = useNavigate();
	const firstName = user?.name?.split(" ")[0];

	const upcoming = useMemo(
		() =>
			bookings
				.filter((b) => ACTIVE_STATUSES.includes(b.status))
				.sort(sortSoonest),
		[bookings],
	);
	const nextBooking = upcoming[0] || null;
	const pendingCount = upcoming.filter((b) => b.status === "pending").length;

	const completed = useMemo(
		() =>
			bookings
				.filter((b) => b.status === "completed")
				.sort((a, b) => bookingTime(b) - bookingTime(a)),
		[bookings],
	);
	const needsReview = completed.find((b) => !hasReview(b));

	const months = useMemo(() => monthlySpend(bookings), [bookings]);
	const thisMonth = months[months.length - 1]?.total || 0;
	const lastMonth = months[months.length - 2]?.total || 0;
	const delta =
		lastMonth > 0
			? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
			: null;

	const topServices = useMemo(() => {
		const map = new Map();
		completed.forEach((b) => {
			const key = b.service_name || "Home service";
			map.set(key, (map.get(key) || 0) + (Number(b.price) || 0));
		});
		return [...map.entries()]
			.map(([name, total]) => ({ name, total }))
			.sort((a, b) => b.total - a.total)
			.slice(0, 3);
	}, [completed]);

	// One card per distinct service, most recent first.
	const rebook = useMemo(() => {
		const seen = new Set();
		return completed
			.filter((b) => {
				const key = b.service_name || b.booking_id;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.slice(0, 3);
	}, [completed]);

	const providersCount = useMemo(
		() =>
			new Set(
				bookings
					.map(
						(b) =>
							b.provider?.id ||
							b.provider_id ||
							b.provider?.name ||
							b.provider_name,
					)
					.filter(Boolean),
			).size,
		[bookings],
	);
	const servicesTried = useMemo(
		() => new Set(bookings.map((b) => b.service_name).filter(Boolean)).size,
		[bookings],
	);
	const avgPerBooking =
		completed.length > 0
			? formatCurrency(Math.round(totalSpent / completed.length))
			: "–";

	const attention = [];
	if (pendingCount > 0) {
		attention.push({
			key: "pending",
			icon: Hourglass,
			tone: "amber",
			title: `${pendingCount} ${pendingCount === 1 ? "request is" : "requests are"} waiting for a provider`,
			hint: "View status",
			to: "/dashboard/bookings",
		});
	}
	if (needsReview) {
		attention.push({
			key: "review",
			icon: Star,
			tone: "violet",
			title: `How was your ${needsReview.service_name || "service"}?`,
			hint: "Leave a rating",
			to: "/dashboard/bookings",
		});
	}
	if (notifications > 0) {
		attention.push({
			key: "notifications",
			icon: BellRing,
			tone: "fuchsia",
			title: `${notifications} unread ${notifications === 1 ? "notification" : "notifications"}`,
			hint: "Open inbox",
			to: "/notifications",
		});
	}

	const toneClasses = {
		amber: "text-amber-200 bg-amber-300/10 border-amber-300/20",
		violet: "text-violet-200 bg-violet-400/10 border-violet-400/20",
		fuchsia: "text-fuchsia-200 bg-fuchsia-400/10 border-fuchsia-400/20",
	};

	const otp = nextBooking?.otp || nextBooking?.completion_otp;
	const providerName =
		nextBooking?.provider?.name || nextBooking?.provider_name || null;

	return (
		<motion.div
			variants={containerVariants}
			initial="hidden"
			animate="show"
			className="space-y-10"
		>
			{/* Header */}
			<motion.header
				variants={itemVariants}
				className="flex flex-col sm:flex-row sm:items-end justify-between gap-5"
			>
				<div>
					<h1 className="font-mackinac text-3xl sm:text-4xl font-bold text-white tracking-tight">
						{greeting()}
						{firstName && (
							<>
								{", "}
								<span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
									{firstName}
								</span>
							</>
						)}
					</h1>
					<p className="mt-2 text-sm text-stone-400">
						{upcoming.length > 0 ? (
							<span className="flex items-center gap-2">
								<span className="relative flex w-2 h-2">
									<span className="absolute inline-flex w-full h-full rounded-full bg-violet-400 opacity-60 animate-ping" />
									<span className="relative inline-flex w-2 h-2 rounded-full bg-violet-400" />
								</span>
								<span>
									<span className="text-violet-300 font-medium">
										{upcoming.length}
									</span>{" "}
									active {upcoming.length === 1 ? "booking" : "bookings"} at
									home right now.
								</span>
							</span>
						) : (
							"Nothing on the calendar. What needs doing around the house?"
						)}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Link
						to="/dashboard/bookings"
						className="h-10 px-4 inline-flex items-center rounded-lg border border-white/15 text-sm font-medium text-stone-200 hover:bg-white/[0.06] hover:border-white/25 transition-colors"
					>
						My bookings
					</Link>
					<Link
						to="/services"
						className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-400 to-fuchsia-400 text-[#0d0b12] text-sm font-semibold hover:brightness-110 transition-all shadow-[0_6px_24px_-8px_rgba(167,139,250,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
					>
						<Search size={15} />
						Book a service
					</Link>
				</div>
			</motion.header>

			{/* Needs your attention */}
			{attention.length > 0 && (
				<motion.section
					variants={itemVariants}
					aria-label="Needs your attention"
					className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
				>
					{attention.map((a) => {
						const Icon = a.icon;
						return (
							<Link
								key={a.key}
								to={a.to}
								className="group flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] transition-colors"
							>
								<span
									className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center ${toneClasses[a.tone]}`}
								>
									<Icon size={16} />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block text-sm text-white leading-snug">
										{a.title}
									</span>
									<span className="block text-xs text-stone-500 group-hover:text-violet-300 transition-colors">
										{a.hint}
									</span>
								</span>
								<ChevronRight
									size={15}
									className="text-stone-600 group-hover:text-violet-300 group-hover:translate-x-0.5 transition-all"
								/>
							</Link>
						);
					})}
				</motion.section>
			)}

			{/* Up next */}
			<motion.section variants={itemVariants} aria-label="Up next">
				{nextBooking ? (
					<div className="relative overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-400/[0.12] via-white/[0.02] to-amber-300/[0.07] p-6 sm:p-7">
						<div
							aria-hidden
							className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-amber-300/[0.07] blur-3xl pointer-events-none"
						/>

						<div className="relative flex items-center justify-between gap-3">
							<p className="inline-flex items-center gap-2 text-sm font-medium text-violet-300">
								<Clock size={14} />
								Up next
							</p>
							<span className="text-sm font-medium text-amber-200">
								{relativeDay(nextBooking.date)}
								{nextBooking.start_time ? ` at ${nextBooking.start_time}` : ""}
							</span>
						</div>

						<div className="relative mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
							<div className="min-w-0">
								<h3 className="font-mackinac text-2xl sm:text-3xl font-bold text-white">
									{nextBooking.service_name || "Home service"}
								</h3>
								<div className="mt-3 flex items-center gap-2.5">
									<span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400/40 to-fuchsia-400/30 border border-white/[0.1] flex items-center justify-center text-xs font-semibold text-white">
										{providerName ? providerName[0].toUpperCase() : "?"}
									</span>
									<p className="text-sm text-stone-400">
										{providerName ? (
											<>
												<span className="text-white font-medium">
													{providerName}
												</span>{" "}
												is your provider
											</>
										) : (
											"Finding the right provider for you"
										)}
									</p>
								</div>
							</div>
							{otp && <OtpTicket code={otp} />}
						</div>

						<div className="relative mt-7 pt-6 border-t border-white/[0.07]">
							<ProgressTracker status={nextBooking.status} />
						</div>
					</div>
				) : (
					<div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div className="flex items-center gap-3.5">
							<div className="w-10 h-10 rounded-xl bg-violet-400/10 text-violet-300 flex items-center justify-center">
								<Sparkles size={18} />
							</div>
							<div>
								<p className="text-sm font-medium text-white">
									Book your first service
								</p>
								<p className="text-xs text-stone-400">
									Verified professionals, priced upfront, at your door.
								</p>
							</div>
						</div>
						<Link
							to="/services"
							className="text-sm text-violet-300 hover:text-white inline-flex items-center gap-1 transition-colors"
						>
							Browse services <ChevronRight size={14} />
						</Link>
					</div>
				)}
			</motion.section>

			{/* Spending hero + stat tiles (same rhythm as the provider earnings row) */}
			<motion.section
				variants={itemVariants}
				className="grid lg:grid-cols-12 gap-6 lg:gap-8"
			>
				<div className="lg:col-span-6 relative overflow-hidden rounded-2xl border border-amber-300/15 bg-gradient-to-br from-amber-300/[0.09] via-white/[0.02] to-violet-400/[0.08] p-6 sm:p-7">
					<div className="flex items-center justify-between">
						<p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">
							<span className="w-6 h-6 rounded-md bg-amber-300/15 text-amber-300 flex items-center justify-center">
								<IndianRupee size={13} />
							</span>
							Total spent
						</p>
						<Link
							to="/dashboard/bookings"
							className="text-xs text-stone-300 hover:text-white inline-flex items-center gap-1 transition-colors"
						>
							History <ArrowUpRight size={12} />
						</Link>
					</div>

					<div className="mt-5 flex items-end justify-between gap-4">
						<p className="font-mackinac text-5xl sm:text-6xl font-bold text-white tabular-nums leading-none">
							{formatCurrency(totalSpent)}
						</p>
						<MonthBars months={months} />
					</div>

					<div className="mt-7 grid grid-cols-2 gap-4 pt-5 border-t border-white/[0.08]">
						<div>
							<p className="text-[11px] uppercase tracking-[0.12em] text-stone-500">
								This month
							</p>
							<p className="mt-1 text-lg font-semibold text-white tabular-nums">
								{formatCurrency(thisMonth)}
							</p>
							{delta !== null && delta !== 0 && (
								<p
									className={`mt-0.5 text-xs ${
										delta > 0 ? "text-amber-200" : "text-emerald-300"
									}`}
								>
									{Math.abs(delta)}% {delta > 0 ? "more" : "less"} than last
									month
								</p>
							)}
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.12em] text-stone-500">
								Per booking
							</p>
							<p className="mt-1 text-lg font-semibold text-emerald-300 tabular-nums">
								{avgPerBooking}
							</p>
						</div>
					</div>
					<p className="mt-4 text-xs text-stone-500">
						{topServices[0]
							? `Most spent on ${topServices[0].name}`
							: "Spending shows up here after your first completed service."}
					</p>
				</div>

				<div className="lg:col-span-6 grid grid-cols-2 gap-3 sm:gap-4">
					<Stat
						label="Active"
						value={upcoming.length}
						hint="Scheduled or live"
						icon={Zap}
						tone="sky"
						to="/dashboard/bookings"
					/>
					<Stat
						label="Completed"
						value={completed.length}
						hint="Jobs done at home"
						icon={CheckCircle2}
						tone="emerald"
					/>
					<Stat
						label="Providers"
						value={providersCount}
						hint="Hired so far"
						icon={Users}
						tone="fuchsia"
					/>
					<Stat
						label="Services"
						value={servicesTried}
						hint="Different kinds tried"
						icon={Sparkles}
						tone="violet"
					/>
				</div>
			</motion.section>

			{/* Book again */}
			{rebook.length > 0 && (
				<motion.section variants={itemVariants}>
					<SectionHeader
						title="Book again"
						to="/services"
						linkLabel="All services"
					/>
					<div className="grid gap-3 sm:grid-cols-3">
						{rebook.map((b) => {
							const slug = slugFor(b);
							const who = b.provider?.name || b.provider_name;
							return (
								<Link
									key={b.booking_id || b.service_name}
									to={slug ? `/services/${slug}` : "/services"}
									className="group p-4 rounded-xl border border-white/[0.07] bg-white/[0.025] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.045] hover:border-violet-400/25"
								>
									<span className="w-8 h-8 rounded-lg bg-violet-400/10 text-violet-300 flex items-center justify-center">
										<Repeat size={15} />
									</span>
									<p className="mt-4 text-sm font-medium text-white truncate group-hover:text-violet-200 transition-colors">
										{b.service_name || "Home service"}
									</p>
									<p className="mt-0.5 text-xs text-stone-500 truncate">
										{who ? `Last with ${who}` : "Rebook in one tap"}
										{b.price ? ` · ${formatCurrency(b.price)}` : ""}
									</p>
								</Link>
							);
						})}
					</div>
				</motion.section>
			)}

			{/* Explore services */}
			<motion.section variants={itemVariants}>
				<SectionHeader
					title="Explore services"
					to="/services"
					linkLabel="View all"
				/>
				<div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5">
					{CATEGORIES.map((c) => {
						const Icon = c.icon;
						return (
							<Link
								key={c.slug}
								to={`/services/${c.slug}`}
								className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-violet-400/30 transition-colors text-center"
							>
								<span className="w-8 h-8 rounded-lg bg-violet-400/10 text-violet-300 flex items-center justify-center group-hover:bg-amber-300/15 group-hover:text-amber-200 transition-colors">
									<Icon size={16} />
								</span>
								<span className="text-xs text-stone-300 group-hover:text-white truncate w-full">
									{c.label}
								</span>
							</Link>
						);
					})}
				</div>
			</motion.section>

			{/* Recent bookings */}
			<motion.section variants={itemVariants}>
				<SectionHeader
					title="Recent bookings"
					to="/dashboard/bookings"
					linkLabel="See history"
				/>

				{bookings.length === 0 ? (
					<div className="py-14 text-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015]">
						<span className="mx-auto w-11 h-11 rounded-full bg-violet-400/10 text-violet-300 flex items-center justify-center">
							<CalendarCheck size={20} />
						</span>
						<p className="mt-4 text-sm font-medium text-white">
							Start your first booking
						</p>
						<p className="mt-1 text-xs text-stone-500">
							Past and active reservations will show up here.
						</p>
						<Link
							to="/services"
							className="mt-4 inline-flex text-sm text-violet-300 hover:text-white transition-colors"
						>
							Book a service
						</Link>
					</div>
				) : (
					<ul className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.06] overflow-hidden">
						{bookings.slice(0, 5).map((b, i) => {
							const status = STATUS_MAP[b.status] || STATUS_MAP.pending;
							const dateObj = b.date ? new Date(b.date) : null;
							const validDate = dateObj && !isNaN(dateObj);
							const shortId = String(b.booking_id || "")
								.slice(0, 8)
								.toUpperCase();
							return (
								<li key={b.booking_id || i}>
									<button
										type="button"
										onClick={() => navigate("/dashboard/bookings")}
										className="w-full flex items-center gap-4 px-4 sm:px-5 py-4 text-left hover:bg-white/[0.03] transition-colors group"
									>
										<div
											className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-b flex flex-col items-center justify-center ${status.rail}`}
										>
											{validDate ? (
												<>
													<span className="text-[10px] font-semibold opacity-80 leading-none">
														{dateObj.toLocaleDateString("en-IN", {
															month: "short",
														})}
													</span>
													<span className="font-mackinac text-lg font-bold text-white leading-none mt-1 tabular-nums">
														{dateObj.getDate()}
													</span>
												</>
											) : (
												<Clock size={16} />
											)}
										</div>

										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-white truncate group-hover:text-violet-200 transition-colors">
												{b.service_name || "Home service"}
											</p>
											<p className="mt-0.5 text-xs text-stone-500 truncate">
												{b.start_time ? `${b.start_time} · ` : ""}
												{shortId && (
													<span className="font-mono">#{shortId}</span>
												)}
											</p>
										</div>

										<div className="flex items-center gap-4 shrink-0">
											<span
												className={`hidden sm:inline-flex items-center gap-1.5 text-xs ${status.text}`}
											>
												<span className="relative flex w-1.5 h-1.5">
													{status.pulse && (
														<span
															className={`absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping ${status.dot}`}
														/>
													)}
													<span
														className={`relative inline-flex w-1.5 h-1.5 rounded-full ${status.dot}`}
													/>
												</span>
												{status.label}
											</span>
											<span className="text-sm font-semibold text-white tabular-nums w-16 text-right">
												{formatCurrency(b.price)}
											</span>
											<ChevronRight
												size={15}
												className="text-stone-600 group-hover:text-violet-300 group-hover:translate-x-0.5 transition-all"
											/>
										</div>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</motion.section>
		</motion.div>
	);
}

function CustomerSkeleton() {
	return (
		<div className="space-y-8 animate-pulse" aria-busy="true">
			<div className="h-10 w-64 bg-white/[0.05] rounded-xl" />
			<div className="h-56 bg-white/[0.03] border border-white/[0.05] rounded-2xl" />
			<div className="grid lg:grid-cols-12 gap-8">
				<div className="lg:col-span-6 h-64 bg-white/[0.04] border border-white/[0.05] rounded-2xl" />
				<div className="lg:col-span-6 grid grid-cols-2 gap-4">
					{[...Array(4)].map((_, i) => (
						<div
							key={i}
							className="h-[136px] bg-white/[0.03] border border-white/[0.05] rounded-xl"
						/>
					))}
				</div>
			</div>
			<div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
				{[...Array(9)].map((_, i) => (
					<div key={i} className="h-20 bg-white/[0.02] rounded-xl" />
				))}
			</div>
			<div className="h-64 bg-white/[0.03] rounded-2xl" />
		</div>
	);
}
