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
	BarChart3,
	Settings,
	LogOut,
	Bell,
	Star,
	TrendingUp,
	Clock,
	CheckCircle2,
	ChevronRight,
	Wrench,
	Menu,
	X,
	IndianRupee,
	Users,
	ArrowUpRight,
	Copy,
	Check,
	Sparkles,
	Calendar,
	ShieldCheck,
	Activity,
	MapPin,
	SlidersHorizontal,
	CircleDot,
} from "lucide-react";
import api from "../../api/axiosInstance";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import ConfirmDialog from "../../ui/ConfirmDialog";
import Logo from "../../ui/Logo";
import VerifiedBadge from "../../ui/VerifiedBadge";

const formatCurrency = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(n || 0);

const STATUS_MAP = {
	pending: {
		label: "Pending",
		badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
		dot: "bg-amber-400",
	},
	booked: {
		label: "Confirmed",
		badge: "bg-violet-500/10 text-violet-300 border-violet-500/20",
		dot: "bg-violet-400",
	},
	confirmed: {
		label: "Confirmed",
		badge: "bg-violet-500/10 text-violet-300 border-violet-500/20",
		dot: "bg-violet-400",
	},
	in_progress: {
		label: "In Progress",
		badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
		dot: "bg-indigo-400 animate-pulse",
	},
	completed: {
		label: "Completed",
		badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
		dot: "bg-emerald-400",
	},
	cancelled: {
		label: "Cancelled",
		badge: "bg-rose-500/10 text-rose-300 border-rose-500/20",
		dot: "bg-rose-400",
	},
};

function NavItem({ to, icon: Icon, label, end = false, onClick, badge }) {
	return (
		<NavLink
			to={to}
			end={end}
			onClick={onClick}
			className={({ isActive }) =>
				`group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 ${
					isActive
						? "bg-violet-600/15 text-white border border-violet-500/30 shadow-xs"
						: "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
				}`
			}
		>
			{({ isActive }) => (
				<>
					<div className="flex items-center gap-3">
						<Icon
							size={16}
							className={`transition-colors ${
								isActive
									? "text-violet-400"
									: "text-slate-500 group-hover:text-slate-300"
							}`}
						/>
						<span>{label}</span>
					</div>
					{badge !== undefined && badge > 0 && (
						<span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
							{badge}
						</span>
					)}
					{isActive && (
						<motion.div
							layoutId="active-nav-indicator"
							className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-violet-500"
							transition={{ type: "spring", stiffness: 400, damping: 30 }}
						/>
					)}
				</>
			)}
		</NavLink>
	);
}

function SidebarProfile({ user, notifications, onLogout, onLinkClick }) {
	const [copied, setCopied] = useState(false);

	const handleCopyId = useCallback(() => {
		if (!user?.custom_id) return;
		navigator.clipboard.writeText(user.custom_id);
		setCopied(true);
		toast.success("Provider ID copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	}, [user?.custom_id]);

	return (
		<aside className="w-full h-full flex flex-col justify-between py-6 px-4 bg-[#0d081d] border-r border-white/[0.07]">
			<div className="space-y-6">
				{/* Brand Logo & Tag */}
				<div className="flex items-center justify-between px-2">
					<Logo to="/" size="md" theme="dark" />
				</div>

				{/* Provider Identity Badge */}
				<div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
					<div className="flex items-center gap-3">
						<div className="relative">
							<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-700 flex items-center justify-center text-white font-bold text-base overflow-hidden border border-white/10 shadow-sm">
								{user?.photo ? (
									<img
										src={user.photo}
										alt={user?.name || "Provider"}
										className="w-full h-full object-cover"
									/>
								) : (
									<span>{user?.name?.[0]?.toUpperCase() || "P"}</span>
								)}
							</div>
							<span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#0d081d]" />
						</div>

						<div className="min-w-0 flex-1">
							<p className="text-sm font-bold text-slate-100 truncate">
								{user?.name || "Service Professional"}
							</p>
							<div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium truncate mt-0.5">
								{user?.is_verified ? (
									<VerifiedBadge size="xs" />
								) : (
									<>
										<span className="text-emerald-400 font-semibold">Online</span>
										<span>•</span>
										<span className="truncate">
											{user?.location || "Provider"}
										</span>
									</>
								)}
							</div>
						</div>
					</div>

					{user?.custom_id && (
						<button
							onClick={handleCopyId}
							title="Click to copy Custom ID"
							className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/[0.05] hover:border-violet-500/30 text-left transition-all group cursor-pointer"
						>
							<div className="overflow-hidden pr-2">
								<span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
									Merchant ID
								</span>
								<span className="block font-mono text-[11px] text-violet-300 truncate mt-0.5">
									{user.custom_id}
								</span>
							</div>
							<div className="p-1 rounded-md text-slate-400 group-hover:text-white transition-colors">
								{copied ? (
									<Check size={12} className="text-emerald-400" />
								) : (
									<Copy size={12} />
								)}
							</div>
						</button>
					)}
				</div>

				{/* Primary Navigation */}
				<nav className="space-y-1">
					<div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
						Operations
					</div>
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

					<div className="pt-4 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
						Preferences
					</div>
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
						label="Account & Hours"
						onClick={onLinkClick}
					/>
				</nav>
			</div>

			{/* Footer Actions */}
			<div className="space-y-3 pt-6 border-t border-white/[0.06]">
				<Link
					to="/help"
					onClick={onLinkClick}
					className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] text-xs text-slate-400 hover:text-slate-200 transition-colors"
				>
					<span className="flex items-center gap-2 font-medium">
						<ShieldCheck size={14} className="text-violet-400" />
						Provider Help & SLA
					</span>
					<ArrowUpRight size={13} className="text-slate-500" />
				</Link>

				<button
					onClick={onLogout}
					className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
				>
					<LogOut size={14} />
					<span>Sign Out</span>
				</button>
			</div>
		</aside>
	);
}

export default function ProviderDashboard() {
	const navigate = useNavigate();
	const location = useLocation();
	const { user, logout } = useAuth();
	const childOutlet = useOutlet();

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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
				if (statsRes.status === "fulfilled") {
					setStats(statsRes.value.data?.stats || {});
					setNotifications(statsRes.value.data?.pending_notifications || 0);
				}
				if (bookingsRes.status === "fulfilled") {
					setRecentBookings(bookingsRes.value.data || []);
				}
			} catch (err) {
				toast.error("Failed to sync provider metrics");
			} finally {
				setIsLoading(false);
			}
		};
		load();
	}, [user?.id]);

	const handleLogout = useCallback(() => {
		setShowLogoutConfirm(true);
	}, []);

	const executeLogout = useCallback(() => {
		setShowLogoutConfirm(false);
		logout();
		navigate("/login");
	}, [logout, navigate]);

	const closeSidebar = useCallback(() => setSidebarOpen(false), []);

	return (
		<div className="min-h-screen bg-[#090514] text-slate-100 bricolage-grotesque antialiased selection:bg-violet-600/30">
			{/* Ambient Gradient Mesh Lighting */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
				<div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-violet-600/10 blur-[130px] rounded-full" />
				<div className="absolute top-1/3 right-10 w-[500px] h-[350px] bg-indigo-600/10 blur-[140px] rounded-full" />
				<div className="absolute bottom-10 left-1/3 w-[500px] h-[300px] bg-fuchsia-600/8 blur-[130px] rounded-full" />
			</div>

			{/* Mobile Drawer Navigation */}
			<AnimatePresence>
				{sidebarOpen && (
					<>
						<motion.div
							key="overlay"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={closeSidebar}
							className="fixed inset-0 bg-black/75 z-40 lg:hidden backdrop-blur-xs"
						/>
						<motion.div
							key="drawer"
							initial={{ x: "-100%" }}
							animate={{ x: 0 }}
							exit={{ x: "-100%" }}
							transition={{ type: "spring", stiffness: 350, damping: 35 }}
							className="fixed top-0 left-0 bottom-0 w-[290px] z-50 lg:hidden"
						>
							<div className="relative h-full">
								<button
									onClick={closeSidebar}
									className="absolute top-4 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/5 cursor-pointer z-10"
								>
									<X size={16} />
								</button>
								<SidebarProfile
									user={user}
									notifications={notifications}
									onLogout={handleLogout}
									onLinkClick={closeSidebar}
								/>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			{/* Main Layout Shell */}
			<div className="flex min-h-screen">
				{/* Desktop Sidebar Rail */}
				<div className="hidden lg:block w-72 shrink-0 sticky top-0 h-screen">
					<SidebarProfile
						user={user}
						notifications={notifications}
						onLogout={handleLogout}
						onLinkClick={() => {}}
					/>
				</div>

				{/* Primary Content Viewport */}
				<div className="flex-1 flex flex-col min-w-0">
					{/* Top Mobile Bar */}
					<header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0d081d]/90 backdrop-blur-md border-b border-white/[0.07]">
						<Logo to="/" size="md" theme="dark" />

						<div className="flex items-center gap-2">
							<Link
								to="/notifications"
								className="relative p-2 rounded-xl text-slate-300 hover:text-white bg-white/[0.04] border border-white/[0.06]"
							>
								<Bell size={16} />
								{notifications > 0 && (
									<span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-400" />
								)}
							</Link>
						</div>
					</header>

					{/* Workspace Main View */}
					<main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 lg:px-10 py-8 lg:py-10">
						{isLoading ? (
							<ProviderSkeleton />
						) : isOverviewPage ? (
							<ProviderOverview
								user={user}
								stats={stats}
								recentBookings={recentBookings}
							/>
						) : (
							<Outlet context={{ user, stats, recentBookings }} />
						)}
					</main>
				</div>
			</div>

			<ConfirmDialog
				isOpen={showLogoutConfirm}
				onClose={() => setShowLogoutConfirm(false)}
				onConfirm={executeLogout}
				title="Log out?"
				description="You'll need to sign in again to access your provider account."
				confirmText="Log out"
				cancelText="Cancel"
				variant="danger"
				icon={LogOut}
			/>
		</div>
	);
}

function ProviderOverview({ user, stats, recentBookings }) {
	const navigate = useNavigate();

	// Calculate net payout estimation (assuming 15% platform take)
	const grossTotal = stats.total_earnings || 0;
	const estimatedNet = Math.round(grossTotal * 0.85);

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.25 }}
			className="space-y-8"
		>
			{/* Operational Header Hero Strip */}
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
				<div>
					<div className="flex items-center gap-3 flex-wrap">
						<h1 className="font-mackinac text-2xl sm:text-3xl font-black text-white tracking-tight">
							Dashboard
						</h1>
						{user?.is_verified ? (
							<VerifiedBadge size="md" />
						) : (
							<span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1.5">
								<ShieldCheck size={13} /> KYC In Verification
							</span>
						)}
					</div>
					<p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
						Overview of your earnings, upcoming bookings, and customer requests.
					</p>
				</div>

				<div className="flex items-center gap-2.5 w-full sm:w-auto">
					<Link
						to="/provider/dashboard/services"
						className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-slate-200 border border-white/[0.08] text-xs font-bold transition-all active:scale-95"
					>
						<Wrench size={14} className="text-violet-400" />
						My Services
					</Link>
					<Link
						to="/provider/dashboard/bookings"
						className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-md shadow-violet-950 transition-all active:scale-95"
					>
						<CalendarCheck size={14} />
						All Bookings
					</Link>
				</div>
			</div>

			{/* Asymmetric Financial & Workload Core */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
				{/* Primary Revenue Anchor (7 Cols) */}
				<div className="lg:col-span-7 p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#150d2e] to-[#0e0820] border border-violet-500/20 shadow-xl shadow-black/40 relative overflow-hidden flex flex-col justify-between space-y-6">
					<div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
								<Activity size={12} className="text-violet-400" />
								Cumulative Platform Earnings
							</span>
							<div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
								{formatCurrency(grossTotal)}
							</div>
						</div>

						<Link
							to="/provider/dashboard/earnings"
							className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-violet-300 hover:text-white transition-colors"
							title="View Payout Breakdown"
						>
							<ArrowUpRight size={16} />
						</Link>
					</div>

					{/* Breakdown telemetry pills */}
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-white/[0.06]">
						<div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
							<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
								Estimated Net
							</span>
							<span className="text-base font-extrabold text-emerald-400 mt-0.5 block">
								{formatCurrency(estimatedNet)}
							</span>
							<span className="text-[11px] text-slate-500 font-medium">
								Post 15% platform cut
							</span>
						</div>

						<div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
							<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
								Avg Job Ticket
							</span>
							<span className="text-base font-extrabold text-white mt-0.5 block">
								{formatCurrency(
									stats.completed_jobs > 0
										? Math.round(grossTotal / stats.completed_jobs)
										: 499,
								)}
							</span>
							<span className="text-[11px] text-slate-500 font-medium">
								Per completed visit
							</span>
						</div>

						<div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
							<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
								Settlement Status
							</span>
							<span className="text-base font-extrabold text-violet-300 mt-0.5 flex items-center gap-1.5">
								<span className="h-2 w-2 rounded-full bg-emerald-400" />
								Automated
							</span>
							<span className="text-[11px] text-slate-500 font-medium">
								Direct bank transfer
							</span>
						</div>
					</div>
				</div>

				{/* Workload Telemetry Strip (5 Cols) */}
				<div className="lg:col-span-5 grid grid-cols-2 gap-4">
					{/* Card 1: Active Jobs */}
					<div className="p-5 rounded-3xl bg-[#120a22] border border-white/[0.07] shadow-lg flex flex-col justify-between">
						<div className="flex items-center justify-between">
							<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
								Active Bookings
							</span>
							<span className="p-2 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/20">
								<Clock size={15} />
							</span>
						</div>
						<div className="mt-4">
							<div className="text-2xl sm:text-3xl font-black text-white">
								{stats.active_jobs ?? 0}
							</div>
							<p className="text-[11.5px] text-slate-400 mt-1">
								In transit or scheduled
							</p>
						</div>
					</div>

					{/* Card 2: Completed Jobs */}
					<div className="p-5 rounded-3xl bg-[#120a22] border border-white/[0.07] shadow-lg flex flex-col justify-between">
						<div className="flex items-center justify-between">
							<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
								Completed
							</span>
							<span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
								<CheckCircle2 size={15} />
							</span>
						</div>
						<div className="mt-4">
							<div className="text-2xl sm:text-3xl font-black text-white">
								{stats.completed_jobs ?? 0}
							</div>
							<p className="text-[11.5px] text-slate-400 mt-1">
								Successfully fulfilled
							</p>
						</div>
					</div>

					{/* Card 3: Quality Rating */}
					<div className="p-5 rounded-3xl bg-[#120a22] border border-white/[0.07] shadow-lg flex flex-col justify-between">
						<div className="flex items-center justify-between">
							<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
								Quality Score
							</span>
							<span className="p-2 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20">
								<Star size={15} />
							</span>
						</div>
						<div className="mt-4">
							<div className="text-2xl sm:text-3xl font-black text-white flex items-center gap-1.5">
								<span>{stats.avg_rating ? `${stats.avg_rating}` : "5.0"}</span>
								<span className="text-xs font-semibold text-slate-500">
									/ 5.0
								</span>
							</div>
							<p className="text-[11px] text-amber-300/90 mt-1 flex items-center gap-1">
								<span>Verified feedback</span>
							</p>
						</div>
					</div>

					{/* Card 4: Clients Served */}
					<div className="p-5 rounded-3xl bg-[#120a22] border border-white/[0.07] shadow-lg flex flex-col justify-between">
						<div className="flex items-center justify-between">
							<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
								Clients
							</span>
							<span className="p-2 rounded-xl bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">
								<Users size={15} />
							</span>
						</div>
						<div className="mt-4">
							<div className="text-2xl sm:text-3xl font-black text-white">
								{stats.total_customers ?? 0}
							</div>
							<p className="text-[11.5px] text-slate-400 mt-1">
								Direct patron base
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Operational Sections: Live Schedule Ledger & Fast Action Deck */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
				{/* Recent Appointments & Dispatch Ledger (7 Cols) */}
				<div className="lg:col-span-7 p-6 rounded-3xl bg-[#120a22] border border-white/[0.07] shadow-xl flex flex-col justify-between space-y-6">
					<div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
						<div className="flex items-center gap-2.5">
							<span className="p-2 rounded-xl bg-violet-500/10 text-violet-300 border border-violet-500/20">
								<CalendarCheck size={16} />
							</span>
							<div>
								<h3 className="text-base font-extrabold text-white">
									Upcoming Bookings
								</h3>
								<p className="text-xs text-slate-400">
									Chronological list of customer scheduled jobs
								</p>
							</div>
						</div>

						<Link
							to="/provider/dashboard/bookings"
							className="text-xs font-bold text-violet-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors flex items-center gap-1"
						>
							View All <ChevronRight size={13} />
						</Link>
					</div>

					<div className="flex-1">
						{recentBookings.length === 0 ? (
							<div className="py-12 text-center text-slate-500 space-y-2">
								<CalendarCheck size={32} className="mx-auto text-slate-600" />
								<p className="text-sm font-bold text-slate-300">
									No active bookings right now
								</p>
								<p className="text-xs text-slate-500">
									When customers schedule service in your area, they will
									populate here instantly.
								</p>
							</div>
						) : (
							<div className="divide-y divide-white/[0.05]">
								{recentBookings.slice(0, 5).map((b, i) => {
									const status = STATUS_MAP[b.status] || STATUS_MAP.pending;
									const dateString = b.date
										? b.date.split("T")[0]
										: "Scheduled";

									return (
										<div
											key={b.booking_id || i}
											onClick={() => navigate("/provider/dashboard/bookings")}
											className="py-3.5 flex items-center justify-between gap-4 group cursor-pointer hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
										>
											<div className="flex items-center gap-3.5 min-w-0">
												<div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-300 shrink-0 group-hover:border-violet-500/30 transition-colors">
													<Wrench size={15} />
												</div>
												<div className="min-w-0">
													<p className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">
														{b.service_name || "Custom On-Site Service"}
													</p>
													<div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
														<span className="font-mono text-slate-500">
															#{b.booking_id?.slice(0, 8).toUpperCase()}
														</span>
														<span>•</span>
														<span className="flex items-center gap-1 text-slate-300">
															<Clock size={11} className="text-violet-400" />
															{dateString}{" "}
															{b.start_time ? `at ${b.start_time}` : ""}
														</span>
													</div>
												</div>
											</div>

											<div className="flex items-center gap-3 shrink-0">
												<span
													className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${status.badge}`}
												>
													<span
														className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
													/>
													{status.label}
												</span>
												<span className="text-sm font-extrabold text-white">
													₹{b.price ?? "0"}
												</span>
												<ChevronRight
													size={14}
													className="text-slate-600 group-hover:text-slate-400 transition-colors"
												/>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>

				{/* Quick Controls & Operations Toolkit (5 Cols) */}
				<div className="lg:col-span-5 space-y-6">
					<div className="p-6 rounded-3xl bg-[#120a22] border border-white/[0.07] shadow-xl space-y-4">
						<div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
							<SlidersHorizontal size={16} className="text-violet-400" />
							<h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
								Merchant Workflows
							</h3>
						</div>

						<div className="space-y-2.5">
							<Link
								to="/provider/dashboard/services"
								className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-violet-500/20 transition-all group"
							>
								<div className="flex items-center gap-3">
									<div className="p-2 rounded-xl bg-violet-500/10 text-violet-300 border border-violet-500/20">
										<Wrench size={15} />
									</div>
									<div>
										<p className="text-xs font-bold text-white">
											Service Catalog & Rates
										</p>
										<p className="text-[11px] text-slate-400">
											Update pricing per visiting hour or task
										</p>
									</div>
								</div>
								<ArrowUpRight
									size={14}
									className="text-slate-500 group-hover:text-slate-300 transition-colors"
								/>
							</Link>

							<Link
								to="/provider/dashboard/earnings"
								className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-violet-500/20 transition-all group"
							>
								<div className="flex items-center gap-3">
									<div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
										<BarChart3 size={15} />
									</div>
									<div>
										<p className="text-xs font-bold text-white">
											Payout History
										</p>
										<p className="text-[11px] text-slate-400">
											Download earnings & fee invoices
										</p>
									</div>
								</div>
								<ArrowUpRight
									size={14}
									className="text-slate-500 group-hover:text-slate-300 transition-colors"
								/>
							</Link>

							<Link
								to="/provider/dashboard/settings"
								className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-violet-500/20 transition-all group"
							>
								<div className="flex items-center gap-3">
									<div className="p-2 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/20">
										<Calendar size={15} />
									</div>
									<div>
										<p className="text-xs font-bold text-white">
											Weekly Working Hours
										</p>
										<p className="text-[11px] text-slate-400">
											Set daily working hours and days off
										</p>
									</div>
								</div>
								<ArrowUpRight
									size={14}
									className="text-slate-500 group-hover:text-slate-300 transition-colors"
								/>
							</Link>
						</div>
					</div>

					{/* Service Provider Protection Guarantee Box */}
					<div className="p-5 rounded-3xl bg-gradient-to-tr from-violet-950/40 via-[#140b28] to-[#1a0f35] border border-violet-500/20 text-xs space-y-2">
						<div className="flex items-center gap-2 text-violet-300 font-extrabold">
							<ShieldCheck size={16} />
							<span>Merchant Protection Guarantee</span>
						</div>
						<p className="text-slate-300 text-[13px] leading-relaxed">
							Customer cancellations within 2 hours of arrival automatically
							qualify for compensation payouts under TaskGenie Provider
							Protection.
						</p>
					</div>
				</div>
			</div>
		</motion.div>
	);
}

const ProviderSkeleton = () => (
	<div className="space-y-8 animate-pulse">
		<div className="flex justify-between items-center pb-6 border-b border-white/[0.06]">
			<div className="space-y-2">
				<div className="h-8 bg-white/[0.05] rounded-xl w-64" />
				<div className="h-4 bg-white/[0.03] rounded-lg w-48" />
			</div>
			<div className="h-10 w-36 bg-white/[0.05] rounded-xl" />
		</div>
		<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
			<div className="lg:col-span-7 h-64 bg-white/[0.03] rounded-3xl border border-white/[0.05]" />
			<div className="lg:col-span-5 grid grid-cols-2 gap-4">
				{[...Array(4)].map((_, i) => (
					<div
						key={i}
						className="h-28 bg-white/[0.03] rounded-3xl border border-white/[0.05]"
					/>
				))}
			</div>
		</div>
	</div>
);
