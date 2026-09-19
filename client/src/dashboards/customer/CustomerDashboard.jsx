import { useState, useEffect, useCallback, useMemo } from "react";
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
	User,
	Settings,
	LogOut,
	Bell,
	Search,
	Menu,
	X,
	ArrowUpRight,
	ChevronRight,
	Copy,
	Check,
	LifeBuoy,
	Wallet,
	Zap,
	CheckCircle2,
	Clock,
	RotateCcw,
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
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import api from "../../api/axiosInstance";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import ConfirmDialog from "../../ui/ConfirmDialog";
import useModal from "../../hooks/useModal";
import Logo from "../../ui/Logo";
import ScrollToTop from "../../ui/ScrollToTop";

const formatCurrency = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(n || 0);

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

function Sidebar({ user, notifications, onLogout, onLinkClick, totalSpent }) {
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

			{/* Logo */}
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
					label="My Bookings"
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

			{/* Spent summary pill */}
			{totalSpent > 0 && (
				<div className="mx-3 mb-3 p-3.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04]">
					<p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
						<Wallet size={13} />
						Total Spent
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
		(async () => {
			try {
				const [bookingsRes, dashboardRes] = await Promise.allSettled([
					api.get("/api/bookings/my-bookings"),
					api.get("/api/dashboard/customer"),
				]);

				if (!alive) return;
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
				if (alive) setIsLoading(false);
			}
		})();
		return () => {
			alive = false;
		};
	}, [user?.id]);

	const totalSpent = useMemo(
		() =>
			bookings
				.filter((b) => b.status === "completed")
				.reduce((sum, b) => sum + (Number(b.price) || 0), 0),
		[bookings],
	);

	const handleLogout = useCallback(() => setShowLogoutConfirm(true), []);
	const executeLogout = useCallback(() => {
		setShowLogoutConfirm(false);
		logout();
		navigate("/login");
	}, [logout, navigate]);
	const closeSidebar = useCallback(() => setSidebarOpen(false), []);

	return (
		<div className="min-h-screen bg-[#0d0b12] text-stone-200 bricolage-grotesque antialiased selection:bg-violet-400/30">
			<ScrollToTop />

			{/* Mobile Drawer */}
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
								totalSpent={totalSpent}
							/>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			<div className="flex min-h-screen">
				{/* Desktop Sticky Sidebar */}
				<div className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
					<Sidebar
						user={user}
						notifications={notifications}
						onLogout={handleLogout}
						onLinkClick={() => {}}
						totalSpent={totalSpent}
					/>
				</div>

				<div className="flex-1 flex flex-col min-w-0 relative">
					{/* Radial backdrop glow */}
					<div
						aria-hidden
						className="absolute inset-x-0 top-0 h-[420px] pointer-events-none bg-[radial-gradient(60%_100%_at_20%_0%,rgba(139,92,246,0.14),transparent_70%),radial-gradient(45%_80%_at_85%_0%,rgba(251,191,36,0.07),transparent_70%)]"
					/>

					{/* Mobile Topbar */}
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

					{/* Main Region */}
					<main className="relative flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-12">
						{isLoading ? (
							<CustomerSkeleton />
						) : isOverviewPage ? (
							<CustomerOverview
								user={user}
								bookings={bookings}
								totalSpent={totalSpent}
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
				description="You'll need to sign in again to access your customer dashboard."
				confirmText="Sign out"
				cancelText="Cancel"
				variant="danger"
				icon={LogOut}
			/>
		</div>
	);
}

function CustomerOverview({ user, bookings, totalSpent }) {
	const navigate = useNavigate();
	const firstName = user?.name?.split(" ")[0];

	const upcomingBookings = useMemo(
		() =>
			bookings.filter((b) =>
				["pending", "booked", "confirmed", "in_progress"].includes(b.status),
			),
		[bookings],
	);
	const nextBooking = upcomingBookings[0] || null;

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, ease: "easeOut" }}
			className="space-y-10"
		>
			{/* Welcome Header */}
			<header className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
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
							"Welcome back"
						)}
					</h1>
					<p className="mt-2 text-sm text-stone-400">
						{upcomingBookings.length > 0 ? (
							<span className="flex items-center gap-2">
								<span className="relative flex w-2 h-2">
									<span className="absolute inline-flex w-full h-full rounded-full bg-violet-400 opacity-60 animate-ping" />
									<span className="relative inline-flex w-2 h-2 rounded-full bg-violet-400" />
								</span>
								You have{" "}
								<span className="text-violet-300 font-medium">
									{upcomingBookings.length}
								</span>{" "}
								active {upcomingBookings.length === 1 ? "booking" : "bookings"}.
							</span>
						) : (
							"Everything is up to date. Ready to schedule a service?"
						)}
					</p>
				</div>
				<Link
					to="/services"
					className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-400 to-fuchsia-400 text-[#0d0b12] text-sm font-semibold hover:brightness-110 transition-all shadow-[0_6px_24px_-8px_rgba(167,139,250,0.7)]"
				>
					<Search size={15} />
					Book a service
				</Link>
			</header>

			{/* Up next Hero card */}
			{nextBooking ? (
				<div className="relative overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-400/[0.12] via-white/[0.02] to-amber-300/[0.06] p-6 sm:p-7">
					<div className="flex items-center justify-between">
						<p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300">
							<Clock size={13} />
							Up next
						</p>
						<span className="text-xs text-stone-400">
							{nextBooking.date || "Scheduled"}
						</span>
					</div>
					<div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div>
							<h3 className="font-mackinac text-2xl font-bold text-white">
								{nextBooking.service_name || "Home Service"}
							</h3>
							<p className="mt-1 text-sm text-stone-400">
								{nextBooking.start_time
									? `Time: ${nextBooking.start_time} · `
									: ""}
								Provider:{" "}
								<span className="text-white font-medium">
									{nextBooking.provider?.name ||
										nextBooking.provider_name ||
										"Assigning expert"}
								</span>
							</p>
						</div>
						{(nextBooking.otp || nextBooking.completion_otp) && (
							<div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
								<KeyRound size={18} className="text-amber-300" />
								<div>
									<p className="text-[10px] uppercase font-bold text-stone-400">
										Completion OTP
									</p>
									<p className="font-mono text-base font-bold text-white">
										{nextBooking.otp || nextBooking.completion_otp}
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
			) : (
				<div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
					<div className="flex items-center gap-3.5">
						<div className="w-10 h-10 rounded-xl bg-violet-400/10 text-violet-300 flex items-center justify-center">
							<Sparkles size={18} />
						</div>
						<div>
							<p className="text-sm font-medium text-white">
								No upcoming tasks
							</p>
							<p className="text-xs text-stone-400">
								Browse verified service professionals for your home.
							</p>
						</div>
					</div>
					<Link
						to="/services"
						className="text-xs text-violet-300 hover:text-white inline-flex items-center gap-1 transition-colors"
					>
						Explore <ChevronRight size={14} />
					</Link>
				</div>
			)}

			{/* Service Grid Quick Explorer */}
			<section>
				<div className="flex items-center justify-between mb-4">
					<h2 className="font-mackinac text-xl font-bold text-white">
						Explore services
					</h2>
					<Link
						to="/services"
						className="text-sm text-violet-300 hover:text-violet-200 inline-flex items-center gap-1 transition-colors"
					>
						View all <ChevronRight size={14} />
					</Link>
				</div>
				<div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5">
					{CATEGORIES.map((c) => {
						const Icon = c.icon;
						return (
							<Link
								key={c.slug}
								to={`/services/${c.slug}`}
								className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-violet-400/30 transition-all text-center"
							>
								<span className="w-8 h-8 rounded-lg bg-violet-400/10 text-violet-300 flex items-center justify-center group-hover:scale-110 transition-transform">
									<Icon size={16} />
								</span>
								<span className="text-xs text-stone-300 group-hover:text-white truncate w-full">
									{c.label}
								</span>
							</Link>
						);
					})}
				</div>
			</section>

			{/* Recent Bookings List */}
			<section>
				<div className="flex items-center justify-between mb-4">
					<h2 className="font-mackinac text-xl font-bold text-white">
						Recent bookings
					</h2>
					<Link
						to="/dashboard/bookings"
						className="text-sm text-violet-300 hover:text-violet-200 inline-flex items-center gap-1 transition-colors"
					>
						History <ChevronRight size={14} />
					</Link>
				</div>

				{bookings.length === 0 ? (
					<div className="py-14 text-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015]">
						<span className="mx-auto w-11 h-11 rounded-full bg-violet-400/10 text-violet-300 flex items-center justify-center">
							<CalendarCheck size={20} />
						</span>
						<p className="mt-4 text-sm font-medium text-white">
							No bookings yet
						</p>
						<p className="mt-1 text-xs text-stone-500">
							Your past and active reservations will appear here.
						</p>
					</div>
				) : (
					<ul className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.06] overflow-hidden">
						{bookings.slice(0, 5).map((b, i) => {
							const status = STATUS_MAP[b.status] || STATUS_MAP.pending;
							const dateObj = b.date ? new Date(b.date) : null;
							const validDate = dateObj && !isNaN(dateObj);
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
												{b.service_name || "Home service"}
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
			</section>
		</motion.div>
	);
}

function CustomerSkeleton() {
	return (
		<div className="space-y-8 animate-pulse">
			<div className="h-10 w-64 bg-white/[0.05] rounded-xl" />
			<div className="h-44 bg-white/[0.03] border border-white/[0.05] rounded-2xl" />
			<div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
				{[...Array(9)].map((_, i) => (
					<div key={i} className="h-20 bg-white/[0.02] rounded-xl" />
				))}
			</div>
			<div className="h-64 bg-white/[0.03] rounded-2xl" />
		</div>
	);
}
