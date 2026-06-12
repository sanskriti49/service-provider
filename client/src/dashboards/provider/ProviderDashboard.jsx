import { useState, useEffect, useCallback } from "react";
import {
	NavLink,
	Outlet,
	Link,
	useNavigate,
	useOutlet,
	useLocation,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
	LayoutDashboard,
	CalendarCheck,
	BarChart2,
	Settings,
	LogOut,
	Bell,
	Star,
	TrendingUp,
	Clock,
	CheckCircle2,
	AlertCircle,
	ChevronRight,
	Wrench,
	Menu,
	X,
	IndianRupee,
	Users,
	Plus,
	ArrowUpRight,
	Copy,
} from "lucide-react";
import api from "../../api/axiosInstance";
import { useAuth } from "../../contexts/AuthContext";

const formatCurrency = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
	}).format(n || 0);

const STATUS_MAP = {
	pending: {
		label: "Pending",
		cls: "bg-amber-500/15 text-amber-300 border-amber-500/25",
	},
	confirmed: {
		label: "Confirmed",
		cls: "bg-blue-500/15 text-blue-300 border-blue-500/25",
	},
	in_progress: {
		label: "In Progress",
		cls: "bg-violet-500/15 text-violet-300 border-violet-500/25",
	},
	completed: {
		label: "Completed",
		cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
	},
	cancelled: {
		label: "Cancelled",
		cls: "bg-red-500/15 text-red-300 border-red-500/25",
	},
};

const ACCENT_MAP = {
	violet: {
		card: "bg-violet-500/10 border-violet-500/20",
		icon: "bg-violet-500/15 text-violet-300 border-violet-500/20",
		val: "text-violet-100",
	},
	emerald: {
		card: "bg-emerald-500/10 border-emerald-500/20",
		icon: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
		val: "text-emerald-100",
	},
	blue: {
		card: "bg-blue-500/10 border-blue-500/20",
		icon: "bg-blue-500/15 text-blue-300 border-blue-500/20",
		val: "text-blue-100",
	},
	amber: {
		card: "bg-amber-500/10 border-amber-500/20",
		icon: "bg-amber-500/15 text-amber-300 border-amber-500/20",
		val: "text-amber-100",
	},
	fuchsia: {
		card: "bg-fuchsia-500/10 border-fuchsia-500/20",
		icon: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/20",
		val: "text-fuchsia-100",
	},
	cyan: {
		card: "bg-cyan-500/10 border-cyan-500/20",
		icon: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
		val: "text-cyan-100",
	},
};

// ── Sidebar NavLink — dark variant of CustomerDashboard's SidebarLink ─────────
function SidebarLink({ to, icon, label, end = false, onClick }) {
	return (
		<NavLink
			to={to}
			end={end}
			onClick={onClick}
			className={({ isActive }) =>
				`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
					isActive
						? "bg-slate-700/70 text-white shadow-lg shadow-slate-900/40 border border-white/8"
						: "text-slate-400 hover:bg-white/5 hover:text-slate-100"
				}`
			}
		>
			{({ isActive }) => (
				<>
					<div
						className={
							isActive
								? "text-white"
								: "opacity-60 group-hover:opacity-100 transition-opacity"
						}
					>
						{icon}
					</div>
					<span className="font-medium">{label}</span>
				</>
			)}
		</NavLink>
	);
}

function SidebarCard({ notifications, onLogout, onLinkClick }) {
	const { user, logout } = useAuth();
	console.log("user-------", user);

	const [copied, setCopied] = useState(false);

	const handleCopyId = useCallback(() => {
		if (!user?.custom_id) return;
		navigator.clipboard.writeText(user.custom_id);
		setCopied(true);
		toast.success("Provider ID copied!");
		setTimeout(() => setCopied(false), 2000);
	}, [user?.custom_id]);
	return (
		<div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-xl shadow-slate-950/50 rounded-3xl p-6 flex flex-col gap-6">
			<div className="flex items-center gap-4 pb-6 border-b border-white/8">
				<div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-slate-900/50 overflow-hidden ring-2 ring-white/10">
					{user?.photo ? (
						<img
							src={user.photo}
							alt="Profile"
							className="w-full h-full object-cover"
						/>
					) : (
						<span>{user?.name?.[0]?.toUpperCase() || "P"}</span>
					)}
				</div>
				<div className="overflow-hidden">
					<div className="flex items-center gap-2">
						<h3 className="font-bold text-white truncate">
							{user?.name || "Provider"}
						</h3>
					</div>
					<p className="text-xs text-slate-400 font-medium truncate">
						{user?.custom_id || "Service Provider"}
					</p>
				</div>
				{/* notif dot on avatar  */}
				{notifications === 0 && (
					<div className="ml-auto flex-shrink-0">
						<button className="cursor-pointer relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
							<Bell size={16} />
							<span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full" />
						</button>
					</div>
				)}
			</div>
			{user?.custom_id && (
				<button
					onClick={handleCopyId}
					title="Click to copy Provider ID"
					className="cursor-pointer flex items-center justify-between w-full mt-1 px-3 py-2 bg-slate-950/60 hover:bg-slate-950 border border-white/5 hover:border-violet-500/30 rounded-xl text-left transition-all duration-200 group active:scale-[0.98]"
				>
					<div className="overflow-hidden pr-2">
						<span className="block text-[9px] text-slate-600 font-bold uppercase tracking-wider">
							Provider ID
						</span>
						<span className="block font-mono text-xs text-violet-300 truncate tracking-wide mt-0.5">
							{user.custom_id}
						</span>
					</div>
					<div className="w-7 h-7 rounded-lg bg-slate-900 border border-white/5 text-slate-500 flex items-center justify-center transition-colors group-hover:text-violet-400 group-hover:border-violet-500/20 shrink-0">
						{copied ? (
							<Check size={12} className="text-emerald-400" />
						) : (
							<Copy size={12} />
						)}
					</div>
				</button>
			)}

			<nav className="flex flex-col gap-2">
				<SidebarLink
					to="/provider/dashboard"
					end
					icon={<LayoutDashboard size={20} />}
					label="Overview"
					onClick={onLinkClick}
				/>
				<SidebarLink
					to="/provider/dashboard/bookings"
					icon={<CalendarCheck size={20} />}
					label="Bookings"
					onClick={onLinkClick}
				/>
				<SidebarLink
					to="/provider/dashboard/earnings"
					icon={<BarChart2 size={20} />}
					label="Earnings"
					onClick={onLinkClick}
				/>
				<SidebarLink
					to="/provider/dashboard/services"
					icon={<Wrench size={20} />}
					label="My Services"
					onClick={onLinkClick}
				/>
				<SidebarLink
					to="/provider/dashboard/settings"
					icon={<Settings size={20} />}
					label="Settings"
					onClick={onLinkClick}
				/>
			</nav>

			<div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-5 text-white shadow-lg shadow-slate-950/40 relative overflow-hidden group border border-white/8">
				<div className="absolute top-0 right-0 p-3 opacity-10 transform group-hover:scale-110 transition-transform duration-500">
					<TrendingUp size={60} />
				</div>
				<h4 className="font-bold relative z-10 text-sm">Provider Support</h4>
				<p className="text-slate-300 text-xs mt-1 mb-3 relative z-10 leading-relaxed">
					Questions about bookings or earnings?
				</p>
				<Link
					to="/help"
					className="inline-block text-xs bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/25 transition-colors"
				>
					Get Help
				</Link>
			</div>

			{/* Logout */}
			<button
				onClick={onLogout}
				className="cursor-pointer w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group border border-transparent hover:border-red-500/15"
			>
				<LogOut
					size={18}
					className="group-hover:scale-110 transition-transform"
				/>
				Log Out
			</button>
		</div>
	);
}

export default function ProviderDashboard() {
	const navigate = useNavigate();
	const location = useLocation();
	const { user, logout } = useAuth();
	const childOutlet = useOutlet();

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [notifications, setNotifications] = useState(0);
	const [stats, setStats] = useState({
		total_earnings: 0,
		active_jobs: 0,
		completed_jobs: 0,
		avg_rating: 0,
		pending_jobs: 0,
		total_customers: 0,
	});
	const [recentBookings, setRecentBookings] = useState([]);
	const isOverviewPage =
		location.pathname === "/provider/dashboard" ||
		location.pathname === "/provider/dashboard/";

	useEffect(() => {
		if (sidebarOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "auto";
		}

		return () => {
			document.body.style.overflow = "auto";
		};
	}, [sidebarOpen]);
	useEffect(() => {
		if (!user?.id) return;
		const load = async () => {
			try {
				const [statsRes, bookingsRes] = await Promise.allSettled([
					api.get(`/api/dashboard/provider`),
					api.get(`/api/bookings/provider/history/recent`),
				]);
				console.log(statsRes);
				if (statsRes.status === "fulfilled") {
					setStats(statsRes.value.data?.stats || {});
					setNotifications(statsRes.value.data?.pending_notifications || 0);
				}
				if (bookingsRes.status === "fulfilled") {
					setRecentBookings(bookingsRes.value.data || []);
				}
			} catch (err) {
				toast.error("Provider dashboard load error:", err);
			} finally {
				setIsLoading(false);
			}
		};
		load();
	}, [user?.id]);

	const handleLogout = useCallback(() => {
		logout();
		navigate("/login");
	}, [logout, navigate]);

	const closeSidebar = useCallback(() => setSidebarOpen(false), []);

	return (
		// Dark slate bg, same font + structure as CustomerDashboard
		<div className="bricolage-grotesque min-h-screen relative bg-slate-950 pb-12 px-4 sm:px-8">
			{/* ── Mobile overlay ────────────────────────────────────────────── */}
			<AnimatePresence>
				{sidebarOpen && (
					<motion.div
						key="overlay"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={closeSidebar}
						className="fixed inset-0 bg-black/70 z-20 lg:hidden backdrop-blur-sm"
					/>
				)}
			</AnimatePresence>

			{/* ── Mobile sidebar drawer ─────────────────────────────────────── */}
			<AnimatePresence>
				{sidebarOpen && (
					<motion.div
						key="drawer"
						initial={{ x: "-100%" }}
						animate={{ x: 0 }}
						exit={{ x: "-100%" }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}
						className="fixed top-0 left-0 h-full w-[300px] bg-slate-950 z-30 flex flex-col p-4 lg:hidden overflow-y-auto"
					>
						<button
							onClick={closeSidebar}
							className="self-end mb-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
						>
							<X size={18} />
						</button>
						<SidebarCard
							//	user={user}
							notifications={notifications}
							onLogout={handleLogout}
							onLinkClick={closeSidebar}
						/>
					</motion.div>
				)}
			</AnimatePresence>

			{/* ── mobile top bar ────────────────────────────────────────────── */}
			<div className="lg:hidden sticky top-0 z-10 bg-slate-950/90 backdrop-blur-md -mx-4 px-4 py-3 border-b border-white/8 mb-6 flex items-center justify-between">
				<button
					onClick={() => setSidebarOpen(true)}
					className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
				>
					<Menu size={20} />
				</button>
				<div className="flex items-center gap-2">
					<div className="w-6 h-6 rounded-md bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
						<Wrench size={12} className="text-slate-200" />
					</div>
					<span className="text-sm font-bold text-slate-200">Genie Pro</span>
				</div>
				<button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
					<Bell size={18} />
					{notifications > 0 && (
						<span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full" />
					)}
				</button>
			</div>

			<div className="max-w-7xl mx-auto relative z-10 pt-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
				{/* ── LEFT SIDEBAR (desktop) ────────────────────────────────── */}
				<motion.aside
					initial={{ x: -20, opacity: 0 }}
					animate={{ x: 0, opacity: 1 }}
					transition={{ duration: 0.4 }}
					className="hidden lg:block lg:h-fit sticky top-8"
				>
					<SidebarCard
						//user={user}
						notifications={notifications}
						onLogout={handleLogout}
						onLinkClick={() => {}}
					/>
				</motion.aside>

				<main className="min-w-0">
					{isLoading ? (
						<ProviderSkeleton />
					) : isOverviewPage ? (
						//  Force overview render if matching the exact root dashboard URL path
						<ProviderOverview
							user={user}
							stats={stats}
							recentBookings={recentBookings}
						/>
					) : (
						// Swap out and render active child modules (bookings, earnings, services) safely
						<Outlet context={{ user, stats, recentBookings }} />
					)}
				</main>
			</div>
		</div>
	);
}

function ProviderOverview({ user, stats, recentBookings }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="space-y-8"
		>
			{/* Header — mirrors DashboardOverview header */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div>
					<h1 className="text-3xl font-bold text-white tracking-tight">
						Welcome back,{" "}
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-300 to-slate-500">
							{user?.name?.split(" ")[0] || "Provider"}
						</span>
						! 👋
					</h1>
					<p className="text-slate-400 mt-1 text-sm">
						Here's your business overview for today.
					</p>
				</div>
				<Link
					to="/provider/dashboard/bookings"
					className="hidden sm:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-medium border border-white/10 shadow-lg transition-all active:scale-95 group text-sm"
				>
					<CalendarCheck
						size={16}
						className="group-hover:scale-110 transition-transform"
					/>
					View All Bookings
				</Link>
			</div>

			{/* Stats grid — mirrors DashboardOverview 4-col grid */}
			<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
				{[
					{
						label: "Total Earnings",
						value: formatCurrency(stats.total_earnings),
						icon: IndianRupee,
						accent: "violet",
					},
					{
						label: "Completed Jobs",
						value: stats.completed_jobs ?? 0,
						icon: CheckCircle2,
						accent: "emerald",
					},
					{
						label: "Active Jobs",
						value: stats.active_jobs ?? 0,
						icon: Clock,
						accent: "blue",
					},
					{
						label: "Pending",
						value: stats.pending_jobs ?? 0,
						icon: AlertCircle,
						accent: "amber",
					},
					{
						label: "Avg Rating",
						value: stats.avg_rating ? `${stats.avg_rating}/5` : "N/A",
						icon: Star,
						accent: "fuchsia",
					},
					{
						label: "Customers Served",
						value: stats.total_customers ?? 0,
						icon: Users,
						accent: "cyan",
					},
				].map((s, i) => (
					<StatCard key={s.label} {...s} delay={i * 0.05} />
				))}
			</div>

			{/* Content grid — mirrors DashboardOverview 2-col layout */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* Recent bookings — mirrors "Up Next" card */}
				<div className="bg-slate-900/60 backdrop-blur-md border border-white/8 p-6 rounded-3xl shadow-sm flex flex-col min-h-[400px]">
					<div className="flex justify-between items-center mb-6">
						<h3 className="font-bold text-lg text-white flex items-center gap-2">
							<div className="p-2 bg-slate-800 rounded-lg text-slate-400">
								<CalendarCheck size={18} />
							</div>
							Recent Bookings
						</h3>
						<Link
							to="/provider/dashboard/bookings"
							className="text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
						>
							View all <ChevronRight size={13} />
						</Link>
					</div>
					<div className="flex-1 flex flex-col">
						{recentBookings.length === 0 ? (
							<EmptyBookings />
						) : (
							<div className="divide-y divide-white/5 -mx-6">
								{recentBookings.slice(0, 5).map((b, i) => (
									<BookingRow key={b.booking_id || i} booking={b} />
								))}
							</div>
						)}
					</div>
				</div>

				{/* Quick actions — mirrors "Quick Book" card */}
				<div className="bg-slate-900/60 backdrop-blur-md border border-white/8 p-6 rounded-3xl shadow-sm">
					<h3 className="font-bold text-lg text-white mb-6 flex items-center gap-2">
						<div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
							<TrendingUp size={18} />
						</div>
						Quick Actions
					</h3>
					<div className="flex flex-col gap-3">
						{[
							{
								icon: <BarChart2 size={18} />,
								title: "Earnings Report",
								desc: "Detailed income breakdown",
								to: "/provider/dashboard/earnings",
								accent: "bg-violet-500/10 text-violet-300 border-violet-500/20",
							},
							{
								icon: <Wrench size={18} />,
								title: "Manage Services",
								desc: "Update listings & pricing",
								to: "/provider/dashboard/services",
								accent:
									"bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
							},
							{
								icon: <CalendarCheck size={18} />,
								title: "All Bookings",
								desc: "View and manage requests",
								to: "/provider/dashboard/bookings",
								accent: "bg-blue-500/10 text-blue-300 border-blue-500/20",
							},
							{
								icon: <Users size={18} />,
								title: "My Customers",
								desc: "Customer history & reviews",
								to: "/provider/customers",
								accent:
									"bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
							},
						].map((a) => (
							<Link
								key={a.to}
								to={a.to}
								className="flex items-center gap-4 p-4 rounded-2xl border border-white/6 bg-slate-800/30 hover:bg-slate-800/70 hover:border-white/12 transition-all group"
							>
								<div
									className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${a.accent}`}
								>
									{a.icon}
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-semibold text-white">{a.title}</p>
									<p className="text-xs text-slate-500 mt-0.5">{a.desc}</p>
								</div>
								<ArrowUpRight
									size={16}
									className="text-slate-600 group-hover:text-slate-400 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all flex-shrink-0"
								/>
							</Link>
						))}
					</div>
				</div>
			</div>
		</motion.div>
	);
}

// ── Sub-components ────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, accent, delay }) => {
	const a = ACCENT_MAP[accent] || ACCENT_MAP.violet;
	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay }}
			className={`p-5 rounded-2xl border flex flex-col justify-between h-28 ${a.card}`}
		>
			<div className="flex items-center justify-between">
				<span className="text-xs font-bold uppercase tracking-wider text-slate-500">
					{label}
				</span>
				<div
					className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${a.icon}`}
				>
					<Icon size={15} />
				</div>
			</div>
			<span className={`text-2xl font-extrabold tracking-tight ${a.val}`}>
				{value}
			</span>
		</motion.div>
	);
};

const BookingRow = ({ booking }) => {
	const status = STATUS_MAP[booking.status] || STATUS_MAP.pending;
	return (
		<div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
			<div className="flex-1 min-w-0">
				<p className="text-sm font-semibold text-white truncate">
					{booking.service_name || "Service"}
				</p>
				<p className="text-xs text-slate-500 mt-0.5 truncate">
					{booking.customer_name || "Customer"}
					{booking.date ? ` · ${booking.date}` : ""}
				</p>
			</div>
			<div className="flex items-center gap-3 flex-shrink-0 ml-4">
				<span
					className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${status.cls}`}
				>
					{status.label}
				</span>
				<span className="text-sm font-bold text-slate-300 tabular-nums">
					{booking.price ? formatCurrency(booking.price) : "—"}
				</span>
			</div>
		</div>
	);
};

const EmptyBookings = () => (
	<div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/8 rounded-2xl">
		<div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-600">
			<CalendarCheck size={24} />
		</div>
		<p className="text-white font-bold">No bookings yet</p>
		<p className="text-slate-500 text-sm mt-1">
			New bookings will appear here.
		</p>
	</div>
);

const ProviderSkeleton = () => (
	<div className="space-y-8 animate-pulse">
		<div className="flex justify-between items-center">
			<div className="space-y-2">
				<div className="h-9 bg-slate-800 rounded-2xl w-72" />
				<div className="h-4 bg-slate-800/60 rounded-xl w-56" />
			</div>
			<div className="hidden sm:block h-11 w-40 bg-slate-800 rounded-xl" />
		</div>
		<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
			{[...Array(6)].map((_, i) => (
				<div key={i} className="h-28 bg-slate-800/60 rounded-2xl" />
			))}
		</div>
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
			<div className="h-96 bg-slate-800/60 rounded-3xl" />
			<div className="h-96 bg-slate-800/60 rounded-3xl" />
		</div>
	</div>
);
