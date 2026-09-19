import { useState, useEffect, useCallback } from "react";
import {
	NavLink,
	Outlet,
	Link,
	useNavigate,
	useLocation,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
	LayoutDashboard,
	CalendarCheck,
	BarChart3,
	Settings,
	LogOut,
	Bell,
	Star,
	Wrench,
	Menu,
	X,
	ArrowUpRight,
	ChevronRight,
	Copy,
	Check,
	ShieldCheck,
	AlertTriangle,
	Clock,
	LifeBuoy,
	IndianRupee,
	CheckCircle2,
	Users,
	Zap,
} from "lucide-react";
import api from "../../api/axiosInstance";
import { useAuth } from "../../contexts/AuthContext";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import ConfirmDialog from "../../ui/ConfirmDialog";
import useModal from "../../hooks/useModal";
import Logo from "../../ui/Logo";
import VerifiedBadge from "../../ui/VerifiedBadge";
import KycVerificationModal from "../../ui/KycVerificationModal";
import SupportTicketModal from "../../ui/SupportTicketModal";
import ScrollToTop from "../../ui/ScrollToTop";

const PLATFORM_FEE = 0.15; // Estimate only; replace with backend value if available

const formatCurrency = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(n || 0);

/* Color language: violet = brand/action, amber = money/rating,
   emerald = done/healthy, sky = in progress, rose = attention */
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

const DEFAULT_STATS = {
	total_earnings: 0,
	active_jobs: 0,
	completed_jobs: 0,
	avg_rating: 0,
	pending_jobs: 0,
	total_customers: 0,
};

/* ───────────────────────── Sidebar ───────────────────────── */

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
							layoutId="provider-nav-indicator"
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

function Sidebar({ user, notifications, onLogout, onLinkClick }) {
	const [copied, setCopied] = useState(false);

	const handleCopyId = useCallback(() => {
		if (!user?.custom_id) return;
		navigator.clipboard.writeText(user.custom_id);
		setCopied(true);
		toast.success("Provider ID copied");
		setTimeout(() => setCopied(false), 2000);
	}, [user?.custom_id]);

	return (
		<aside className="h-full flex flex-col bg-[#0d0b12] border-r border-white/[0.06] relative overflow-hidden">
			{/* soft warm wash behind the top of the sidebar */}
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
									<span>{user?.name?.[0]?.toUpperCase() || "P"}</span>
								)}
							</div>
						</div>
						<span
							aria-hidden
							className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0d0b12]"
						/>
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-1.5">
							<p className="text-sm font-medium text-white truncate">
								{user?.name || "Service professional"}
							</p>
							{user?.is_verified && <VerifiedBadge size="xs" />}
						</div>
						{user?.custom_id ? (
							<button
								type="button"
								onClick={handleCopyId}
								aria-label="Copy provider ID"
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
								{user?.location || "Provider"}
							</p>
						)}
					</div>
				</div>
			</div>

			<nav
				className="relative flex-1 px-3 space-y-0.5 overflow-y-auto"
				aria-label="Provider navigation"
			>
				<NavItem
					to="/provider/dashboard"
					end
					icon={LayoutDashboard}
					label="Overview"
					onClick={onLinkClick}
				/>
				<NavItem
					to="/provider/dashboard/bookings"
					icon={CalendarCheck}
					label="Bookings"
					onClick={onLinkClick}
				/>
				<NavItem
					to="/provider/dashboard/earnings"
					icon={BarChart3}
					label="Earnings"
					onClick={onLinkClick}
				/>
				<NavItem
					to="/provider/dashboard/services"
					icon={Wrench}
					label="Services"
					onClick={onLinkClick}
				/>
				<NavItem
					to="/provider/dashboard/reviews"
					icon={Star}
					label="Reviews"
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
				<NavItem
					to="/provider/dashboard/settings"
					icon={Settings}
					label="Settings"
					onClick={onLinkClick}
				/>
			</nav>

			<div className="relative p-3 border-t border-white/[0.06] space-y-0.5">
				<Link
					to="/help"
					onClick={onLinkClick}
					className="flex items-center gap-3 h-10 px-3 rounded-lg text-sm text-stone-400 hover:text-white hover:bg-white/[0.04] transition-colors"
				>
					<LifeBuoy size={17} className="text-sky-300/70" />
					Help & support
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

/* ───────────────────────── Shell ───────────────────────── */

export default function ProviderDashboard() {
	const navigate = useNavigate();
	const location = useLocation();
	const { user, logout } = useAuth();

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
	const [notifications, setNotifications] = useState(0);
	const [stats, setStats] = useState(DEFAULT_STATS);
	const [recentBookings, setRecentBookings] = useState([]);
	const [showKycModal, setShowKycModal] = useState(false);
	const [showTicketModal, setShowTicketModal] = useState(false);

	const isOverviewPage =
		location.pathname === "/provider/dashboard" ||
		location.pathname === "/provider/dashboard/";

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		if (params.get("openKyc") === "true") setShowKycModal(true);
	}, [location.search]);

	useModal({
		isOpen: sidebarOpen,
		onClose: () => setSidebarOpen(false),
		id: "provider-mobile-sidebar",
		lockScroll: true,
	});

	useEffect(() => {
		let resolvedUserId = user?.id;
		if (!resolvedUserId) {
			const token = localStorage.getItem("token");
			if (token) {
				try {
					const decoded = jwtDecode(token);
					if (decoded.exp * 1000 >= Date.now()) resolvedUserId = decoded.id;
				} catch (err) {
					console.warn("Invalid token stored:", err);
				}
			}
		}

		if (!resolvedUserId) {
			setIsLoading(false);
			return;
		}

		let isMounted = true;
		const safetyTimer = setTimeout(() => {
			if (isMounted) setIsLoading(false);
		}, 4000);

		(async () => {
			try {
				const [statsRes, bookingsRes] = await Promise.allSettled([
					api.get("/api/dashboard/provider"),
					api.get("/api/bookings/provider/history/recent"),
				]);
				if (!isMounted) return;

				if (statsRes.status === "fulfilled") {
					setStats({ ...DEFAULT_STATS, ...(statsRes.value.data?.stats || {}) });
					setNotifications(statsRes.value.data?.pending_notifications || 0);
				} else {
					console.warn("Provider stats notice:", statsRes.reason?.message);
				}

				if (bookingsRes.status === "fulfilled") {
					setRecentBookings(bookingsRes.value.data || []);
				} else {
					console.warn(
						"Provider bookings notice:",
						bookingsRes.reason?.message,
					);
				}
			} catch (err) {
				console.error("Failed to sync provider metrics:", err);
				toast.error("Couldn't refresh your dashboard");
			} finally {
				clearTimeout(safetyTimer);
				if (isMounted) setIsLoading(false);
			}
		})();

		return () => {
			isMounted = false;
			clearTimeout(safetyTimer);
		};
	}, [user?.id]);

	const handleLogout = useCallback(() => setShowLogoutConfirm(true), []);
	const executeLogout = useCallback(() => {
		setShowLogoutConfirm(false);
		logout();
		navigate("/login");
	}, [logout, navigate]);
	const closeSidebar = useCallback(() => setSidebarOpen(false), []);

	const openKyc = () => setShowKycModal(true);
	const openTicket = () => setShowTicketModal(true);

	return (
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
							<Sidebar
								user={user}
								notifications={notifications}
								onLogout={handleLogout}
								onLinkClick={closeSidebar}
							/>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			<div className="flex min-h-screen">
				{/* Desktop sidebar */}
				<div className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
					<Sidebar
						user={user}
						notifications={notifications}
						onLogout={handleLogout}
						onLinkClick={() => {}}
					/>
				</div>

				<div className="flex-1 flex flex-col min-w-0 relative">
					{/* One warm wash anchored to the top of the content area */}
					<div
						aria-hidden
						className="absolute inset-x-0 top-0 h-[420px] pointer-events-none bg-[radial-gradient(60%_100%_at_20%_0%,rgba(139,92,246,0.14),transparent_70%),radial-gradient(45%_80%_at_85%_0%,rgba(251,191,36,0.07),transparent_70%)]"
					/>

					{/* Mobile top bar */}
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
							<ProviderSkeleton />
						) : isOverviewPage ? (
							<ProviderOverview
								user={user}
								stats={stats}
								recentBookings={recentBookings}
								onOpenKyc={openKyc}
							/>
						) : (
							<Outlet
								context={{
									user,
									stats,
									recentBookings,
									onOpenKyc: openKyc,
									onOpenTicket: openTicket,
								}}
							/>
						)}
					</main>
				</div>
			</div>

			<ConfirmDialog
				isOpen={showLogoutConfirm}
				onClose={() => setShowLogoutConfirm(false)}
				onConfirm={executeLogout}
				title="Sign out?"
				description="You'll need to sign in again to access your provider account."
				confirmText="Sign out"
				cancelText="Cancel"
				variant="danger"
				icon={LogOut}
			/>
			<KycVerificationModal
				isOpen={showKycModal}
				onClose={() => setShowKycModal(false)}
			/>
			<SupportTicketModal
				isOpen={showTicketModal}
				onClose={() => setShowTicketModal(false)}
				defaultRole="provider"
				defaultCategory="kyc"
			/>
		</div>
	);
}

/* ───────────────────────── Overview ───────────────────────── */

const KYC_COPY = {
	rejected: {
		icon: AlertTriangle,
		tone: "border-rose-400/25 bg-gradient-to-r from-rose-400/[0.10] to-rose-400/[0.02]",
		iconTone: "bg-rose-400/15 text-rose-300",
		title: "Verification needs your attention",
		body: (u) =>
			u?.rejection_reason ||
			"We couldn't verify your document. Please upload a clear, well-lit photo.",
		cta: "Resubmit",
	},
	pending: {
		icon: Clock,
		tone: "border-amber-300/25 bg-gradient-to-r from-amber-300/[0.10] to-amber-300/[0.02]",
		iconTone: "bg-amber-300/15 text-amber-200",
		title: "Documents under review",
		body: () =>
			"This usually takes 24–48 hours. We'll notify you as soon as it's done.",
		cta: "View status",
	},
	none: {
		icon: ShieldCheck,
		tone: "border-violet-400/25 bg-gradient-to-r from-violet-400/[0.12] to-fuchsia-400/[0.03]",
		iconTone: "bg-violet-400/15 text-violet-300",
		title: "Get your Verified badge",
		body: () =>
			"Add a government ID to earn customer trust and rank higher in search results.",
		cta: "Verify identity",
	},
};

function KycBanner({ user, onOpenKyc }) {
	if (user?.is_verified) return null;
	const key =
		user?.kyc_status === "rejected"
			? "rejected"
			: user?.kyc_status === "pending"
				? "pending"
				: "none";
	const c = KYC_COPY[key];
	const Icon = c.icon;

	return (
		<div
			className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border ${c.tone}`}
		>
			<div className="flex items-start gap-3 flex-1 min-w-0">
				<span
					className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${c.iconTone}`}
				>
					<Icon size={16} />
				</span>
				<div className="min-w-0">
					<p className="text-sm font-medium text-white">{c.title}</p>
					<p className="mt-0.5 text-sm text-stone-400 leading-relaxed">
						{c.body(user)}
					</p>
				</div>
			</div>
			<button
				type="button"
				onClick={onOpenKyc}
				className="shrink-0 h-9 px-4 rounded-lg bg-white text-[#0d0b12] text-sm font-semibold hover:bg-stone-200 transition-colors"
			>
				{c.cta}
			</button>
		</div>
	);
}

/* Stat: tinted icon + value, each with its own meaning-color */
const STAT_TONES = {
	sky: {
		chip: "bg-sky-300/12 text-sky-300",
		value: "text-white",
		glow: "group-hover:border-sky-300/25",
	},
	emerald: {
		chip: "bg-emerald-300/12 text-emerald-300",
		value: "text-white",
		glow: "group-hover:border-emerald-300/25",
	},
	amber: {
		chip: "bg-amber-300/12 text-amber-300",
		value: "text-white",
		glow: "group-hover:border-amber-300/25",
	},
	fuchsia: {
		chip: "bg-fuchsia-300/12 text-fuchsia-300",
		value: "text-white",
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
			<p
				className={`mt-4 font-mackinac text-3xl font-bold tabular-nums ${t.value}`}
			>
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

/* Tiny decorative-but-honest bar strip: relative height of last bookings' prices */
function PriceSpark({ bookings }) {
	const prices = bookings
		.slice(0, 8)
		.map((b) => Number(b.price) || 0)
		.reverse();
	if (prices.length < 2 || Math.max(...prices) === 0) return null;
	const max = Math.max(...prices);
	return (
		<div className="flex items-end gap-1.5 h-12" aria-hidden>
			{prices.map((p, i) => (
				<motion.span
					key={i}
					initial={{ height: 0 }}
					animate={{ height: `${Math.max(12, (p / max) * 100)}%` }}
					transition={{
						delay: 0.15 + i * 0.05,
						duration: 0.5,
						ease: "easeOut",
					}}
					className={`w-2.5 rounded-sm ${
						i === prices.length - 1
							? "bg-gradient-to-t from-amber-300 to-amber-200"
							: "bg-white/[0.14]"
					}`}
				/>
			))}
		</div>
	);
}

const stagger = {
	hidden: {},
	show: { transition: { staggerChildren: 0.07 } },
};
const rise = {
	hidden: { opacity: 0, y: 10 },
	show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

function ProviderOverview({ user, stats, recentBookings, onOpenKyc }) {
	const navigate = useNavigate();

	const gross = stats.total_earnings || 0;
	const estimatedNet = Math.round(gross * (1 - PLATFORM_FEE));
	const avgPerBooking =
		stats.completed_jobs > 0
			? formatCurrency(Math.round(gross / stats.completed_jobs))
			: "–";
	const firstName = user?.name?.split(" ")[0];
	const pending = stats.pending_jobs || 0;

	return (
		<motion.div
			variants={stagger}
			initial="hidden"
			animate="show"
			className="space-y-10"
		>
			{/* Header */}
			<motion.header
				variants={rise}
				className="flex flex-col sm:flex-row sm:items-end justify-between gap-5"
			>
				<div>
					<h1 className="font-mackinac text-3xl sm:text-4xl font-bold text-white tracking-tight">
						{firstName ? (
							<>
								Welcome back,{" "}
								<span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
									{firstName}
								</span>
							</>
						) : (
							"Overview"
						)}
					</h1>
					<p className="mt-2 text-sm text-stone-400 flex items-center gap-2">
						{pending > 0 ? (
							<>
								<span className="relative flex w-2 h-2">
									<span className="absolute inline-flex w-full h-full rounded-full bg-amber-300 opacity-60 animate-ping" />
									<span className="relative inline-flex w-2 h-2 rounded-full bg-amber-300" />
								</span>
								<span>
									<span className="text-amber-200 font-medium">{pending}</span>{" "}
									{pending === 1 ? "booking is" : "bookings are"} waiting for
									your response.
								</span>
							</>
						) : (
							"You're all caught up. Here's how things look."
						)}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Link
						to="/provider/dashboard/services"
						className="h-10 px-4 inline-flex items-center rounded-lg border border-white/15 text-sm font-medium text-stone-200 hover:bg-white/[0.06] hover:border-white/25 transition-colors"
					>
						Manage services
					</Link>
					<Link
						to="/provider/dashboard/bookings"
						className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-400 to-fuchsia-400 text-[#0d0b12] text-sm font-semibold hover:brightness-110 transition-all shadow-[0_6px_24px_-8px_rgba(167,139,250,0.7)]"
					>
						{pending > 0 ? "Review bookings" : "All bookings"}
						<ArrowUpRight size={15} />
					</Link>
				</div>
			</motion.header>

			<motion.div variants={rise}>
				<KycBanner user={user} onOpenKyc={onOpenKyc} />
			</motion.div>

			{/* Earnings hero + stats */}
			<motion.section
				variants={rise}
				className="grid lg:grid-cols-12 gap-6 lg:gap-8"
			>
				{/* Hero: the one panel that earns a card */}
				<div className="lg:col-span-6 relative overflow-hidden rounded-2xl border border-amber-300/15 bg-gradient-to-br from-amber-300/[0.09] via-white/[0.02] to-violet-400/[0.08] p-6 sm:p-7">
					<div className="flex items-center justify-between">
						<p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">
							<span className="w-6 h-6 rounded-md bg-amber-300/15 text-amber-300 flex items-center justify-center">
								<IndianRupee size={13} />
							</span>
							Total earnings
						</p>
						<Link
							to="/provider/dashboard/earnings"
							className="text-xs text-stone-300 hover:text-white inline-flex items-center gap-1 transition-colors"
						>
							Payouts <ArrowUpRight size={12} />
						</Link>
					</div>

					<div className="mt-5 flex items-end justify-between gap-4">
						<p className="font-mackinac text-5xl sm:text-6xl font-bold text-white tabular-nums leading-none">
							{formatCurrency(gross)}
						</p>
						<PriceSpark bookings={recentBookings} />
					</div>

					<div className="mt-7 grid grid-cols-2 gap-4 pt-5 border-t border-white/[0.08]">
						<div>
							<p className="text-[11px] uppercase tracking-[0.12em] text-stone-500">
								Est. after fees
							</p>
							<p className="mt-1 text-lg font-semibold text-emerald-300 tabular-nums">
								{formatCurrency(estimatedNet)}
							</p>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.12em] text-stone-500">
								Per booking
							</p>
							<p className="mt-1 text-lg font-semibold text-white tabular-nums">
								{avgPerBooking}
							</p>
						</div>
					</div>
					<p className="mt-4 text-xs text-stone-500">
						Estimated at a {Math.round(PLATFORM_FEE * 100)}% platform fee · paid
						out weekly
					</p>
				</div>

				<div className="lg:col-span-6 grid grid-cols-2 gap-3 sm:gap-4">
					<Stat
						label="Active"
						value={stats.active_jobs ?? 0}
						hint="Scheduled or live"
						icon={Zap}
						tone="sky"
					/>
					<Stat
						label="Completed"
						value={stats.completed_jobs ?? 0}
						hint="Jobs fulfilled"
						icon={CheckCircle2}
						tone="emerald"
					/>
					<Stat
						label="Rating"
						value={stats.avg_rating ? Number(stats.avg_rating).toFixed(1) : "–"}
						hint="See reviews"
						icon={Star}
						tone="amber"
						to="/provider/dashboard/reviews"
					/>
					<Stat
						label="Customers"
						value={stats.total_customers ?? 0}
						hint="Served so far"
						icon={Users}
						tone="fuchsia"
					/>
				</div>
			</motion.section>

			{/* Bookings */}
			<motion.section variants={rise}>
				<div className="flex items-center justify-between mb-4">
					<h2 className="font-mackinac text-xl font-bold text-white">
						Recent bookings
					</h2>
					<Link
						to="/provider/dashboard/bookings"
						className="text-sm text-violet-300 hover:text-violet-200 inline-flex items-center gap-1 transition-colors"
					>
						View all <ChevronRight size={14} />
					</Link>
				</div>

				{recentBookings.length === 0 ? (
					<div className="py-16 text-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015]">
						<span className="mx-auto w-11 h-11 rounded-full bg-violet-400/10 text-violet-300 flex items-center justify-center">
							<CalendarCheck size={20} />
						</span>
						<p className="mt-4 text-sm font-medium text-stone-100">
							No bookings yet
						</p>
						<p className="mt-1 text-sm text-stone-500 max-w-xs mx-auto">
							New requests from customers will appear here as soon as they come
							in.
						</p>
					</div>
				) : (
					<ul className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.06] overflow-hidden">
						{recentBookings.slice(0, 5).map((b, i) => {
							const status = STATUS_MAP[b.status] || STATUS_MAP.pending;
							const dateObj = b.date ? new Date(b.date) : null;
							const validDate = dateObj && !isNaN(dateObj);
							return (
								<li key={b.booking_id || i}>
									<button
										type="button"
										onClick={() => navigate("/provider/dashboard/bookings")}
										className="w-full flex items-center gap-4 px-4 sm:px-5 py-4 text-left hover:bg-white/[0.03] transition-colors group"
									>
										{/* Date tile: color reflects status */}
										<div
											className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-b flex flex-col items-center justify-center ${status.rail}`}
										>
											{validDate ? (
												<>
													<span className="text-[9px] font-bold uppercase tracking-wider opacity-80 leading-none">
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
												{b.service_name || "On-site service"}
											</p>
											<p className="mt-0.5 text-xs text-stone-500 truncate">
												{b.start_time ? `${b.start_time} · ` : ""}
												<span className="font-mono">
													#{b.booking_id?.slice(0, 8).toUpperCase()}
												</span>
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

/* ───────────────────────── Skeleton ───────────────────────── */

const ProviderSkeleton = () => (
	<div
		className="space-y-10 animate-pulse"
		aria-busy="true"
		aria-label="Loading dashboard"
	>
		<div className="space-y-3">
			<div className="h-10 w-72 rounded-lg bg-white/[0.05]" />
			<div className="h-4 w-56 rounded bg-white/[0.03]" />
		</div>
		<div className="grid lg:grid-cols-12 gap-8">
			<div className="lg:col-span-6 h-64 rounded-2xl bg-white/[0.04] border border-white/[0.05]" />
			<div className="lg:col-span-6 grid grid-cols-2 gap-4">
				{[...Array(4)].map((_, i) => (
					<div
						key={i}
						className="h-[136px] rounded-xl bg-white/[0.03] border border-white/[0.05]"
					/>
				))}
			</div>
		</div>
		<div className="h-64 rounded-2xl bg-white/[0.03] border border-white/[0.05]" />
	</div>
);
