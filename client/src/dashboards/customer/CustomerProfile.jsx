import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import {
	ArrowLeft,
	ArrowUpRight,
	Bell,
	CalendarCheck,
	Check,
	CheckCircle2,
	ChevronRight,
	Clock,
	Copy,
	HelpCircle,
	LogOut,
	Mail,
	MapPin,
	MessageSquare,
	Pencil,
	Phone,
	Plus,
	Settings,
	Share2,
	Sparkles,
	Users,
	Wallet,
	Zap,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../api/axiosInstance";
import { useAuth } from "../../contexts/AuthContext";
import ConfirmDialog from "../../ui/ConfirmDialog";
import Logo from "../../ui/Logo";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const formatINR = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(n || 0);

const ACTIVE_STATUSES = ["pending", "booked", "confirmed", "in_progress"];

const STATUS = {
	pending: { label: "Pending", dot: "bg-amber-300", text: "text-amber-200" },
	booked: { label: "Confirmed", dot: "bg-violet-300", text: "text-violet-200" },
	confirmed: {
		label: "Confirmed",
		dot: "bg-violet-300",
		text: "text-violet-200",
	},
	in_progress: {
		label: "In progress",
		dot: "bg-sky-300",
		text: "text-sky-200",
	},
};

const bookingTime = (b) => {
	const d = b?.date ? new Date(b.date) : null;
	return d && !isNaN(d) ? d.getTime() : Infinity;
};

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

const primaryBtn =
	"bg-gradient-to-r from-violet-400 to-fuchsia-400 text-[#0d0b12] font-semibold hover:brightness-110 shadow-[0_6px_24px_-8px_rgba(167,139,250,0.7)] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300";

const containerVariants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.07, delayChildren: 0.02 } },
};
const itemVariants = {
	hidden: { opacity: 0, y: 12 },
	show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

/* One meaning-colour per icon chip, same tones as the dashboard */
const TONES = {
	sky: "bg-sky-300/12 text-sky-300",
	emerald: "bg-emerald-300/12 text-emerald-300",
	amber: "bg-amber-300/12 text-amber-300",
	violet: "bg-violet-300/12 text-violet-300",
	fuchsia: "bg-fuchsia-300/12 text-fuchsia-300",
};

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                           */
/* -------------------------------------------------------------------------- */

function Avatar({ user }) {
	const [broken, setBroken] = useState(false);
	return (
		<div className="relative shrink-0">
			<div className="p-[3px] rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-amber-300">
				<div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#1a1428] overflow-hidden flex items-center justify-center text-3xl font-semibold text-white">
					{user?.photo && !broken ? (
						<img
							src={user.photo}
							alt=""
							onError={() => setBroken(true)}
							className="w-full h-full object-cover"
						/>
					) : (
						<span>{user?.name?.[0]?.toUpperCase() || "C"}</span>
					)}
				</div>
			</div>
			<span
				aria-hidden
				className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-[3px] ring-[#0d0b12]"
			/>
		</div>
	);
}

function Fact({ label, children }) {
	return (
		<div className="min-w-0">
			<dt className="text-xs text-stone-500">{label}</dt>
			<dd className="mt-1.5 text-sm text-white">{children}</dd>
		</div>
	);
}

/** Customer identity as a ticket, echoing the booking page's summary ticket. */
function IdentityTicket({ user }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		if (!user?.custom_id) return;
		try {
			await navigator.clipboard.writeText(user.custom_id);
			setCopied(true);
			toast.success("Customer ID copied");
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Couldn't copy. Select the ID and copy it by hand.");
		}
	}, [user?.custom_id]);

	const joined = user?.created_at ? new Date(user.created_at) : null;
	const joinedLabel =
		joined && !isNaN(joined)
			? joined.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
			: "–";

	return (
		<div className="relative rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.06] to-white/[0.02] h-full">
			<div className="p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5">
				<Avatar user={user} />

				<div className="min-w-0 flex-1">
					<h2 className="font-mackinac text-2xl sm:text-3xl font-bold text-white tracking-tight truncate">
						{user?.name || "Customer"}
					</h2>
					<div className="mt-2 flex flex-col gap-1 text-sm text-stone-400">
						{user?.email && (
							<p className="flex items-center gap-2 min-w-0">
								<Mail size={14} className="shrink-0 text-stone-500" />
								<span className="truncate">{user.email}</span>
							</p>
						)}
						{user?.phone && (
							<p className="flex items-center gap-2">
								<Phone size={14} className="shrink-0 text-stone-500" />
								{user.phone}
							</p>
						)}
					</div>
				</div>

				<Link
					to="/account/settings"
					className="self-start sm:self-center h-9 px-3.5 inline-flex items-center gap-2 rounded-lg border border-white/[0.12] text-sm text-stone-200 hover:bg-white/[0.06] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
				>
					<Pencil size={14} />
					Edit profile
				</Link>
			</div>

			{/* Perforation */}
			<div className="relative">
				<div className="mx-6 border-t border-dashed border-white/[0.14]" />
				<span
					aria-hidden
					className="absolute -left-[9px] -top-[9px] w-[18px] h-[18px] rounded-full bg-[#0d0b12] border-r border-white/[0.09]"
				/>
				<span
					aria-hidden
					className="absolute -right-[9px] -top-[9px] w-[18px] h-[18px] rounded-full bg-[#0d0b12] border-l border-white/[0.09]"
				/>
			</div>

			<dl className="p-6 sm:p-7 grid grid-cols-1 sm:grid-cols-3 gap-5">
				<Fact label="Customer ID">
					{user?.custom_id ? (
						<button
							type="button"
							onClick={handleCopy}
							aria-label="Copy customer ID"
							className="group inline-flex items-center gap-2 max-w-full text-stone-200 hover:text-violet-200 transition-colors"
						>
							<span className="font-mono truncate">{user.custom_id}</span>
							{copied ? (
								<Check size={13} className="shrink-0 text-emerald-400" />
							) : (
								<Copy
									size={13}
									className="shrink-0 text-stone-500 group-hover:text-violet-300 transition-colors"
								/>
							)}
						</button>
					) : (
						<span className="text-stone-500">Not assigned</span>
					)}
				</Fact>
				<Fact label="Member since">{joinedLabel}</Fact>
				<Fact label="Location">
					{user?.location ? (
						<span className="inline-flex items-center gap-1.5">
							<MapPin size={13} className="text-violet-300 shrink-0" />
							{user.location}
						</span>
					) : (
						<span className="text-stone-500">Not set</span>
					)}
				</Fact>
			</dl>
		</div>
	);
}

/** The one booking that matters right now, or a nudge to make one. */
function UpNextCard({ booking, loading }) {
	if (loading) {
		return (
			<div className="h-full min-h-[220px] rounded-2xl border border-white/[0.06] bg-white/[0.03] animate-pulse" />
		);
	}

	if (!booking) {
		return (
			<div className="h-full flex flex-col justify-between gap-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
				<div>
					<span className="w-10 h-10 rounded-xl bg-violet-400/10 text-violet-300 flex items-center justify-center">
						<Sparkles size={18} />
					</span>
					<p className="mt-4 text-sm font-medium text-white">
						Nothing scheduled
					</p>
					<p className="mt-1 text-sm text-stone-500">
						Verified professionals, priced upfront, at your door.
					</p>
				</div>
				<Link
					to="/services"
					className={`h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg text-sm ${primaryBtn}`}
				>
					<Plus size={15} />
					Book a service
				</Link>
			</div>
		);
	}

	const st = STATUS[booking.status] || STATUS.pending;
	const provider = booking.provider?.name || booking.provider_name;

	return (
		<div className="relative overflow-hidden h-full flex flex-col justify-between gap-6 rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-400/[0.12] via-white/[0.02] to-amber-300/[0.07] p-6">
			<div
				aria-hidden
				className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-amber-300/[0.07] blur-3xl pointer-events-none"
			/>
			<div className="relative">
				<div className="flex items-center justify-between gap-3">
					<p className="inline-flex items-center gap-2 text-sm font-medium text-violet-300">
						<Clock size={14} />
						Up next
					</p>
					<span className="text-sm font-medium text-amber-200">
						{relativeDay(booking.date)}
					</span>
				</div>
				<h3 className="mt-4 font-mackinac text-xl font-bold text-white leading-snug">
					{booking.service_name || "Home service"}
				</h3>
				<p className="mt-1 text-sm text-stone-400 truncate">
					{booking.start_time ? `${booking.start_time} · ` : ""}
					{provider || "Finding your provider"}
				</p>
				<span
					className={`mt-3 inline-flex items-center gap-1.5 text-xs ${st.text}`}
				>
					<span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
					{st.label}
				</span>
			</div>
			<Link
				to="/dashboard/bookings"
				className="relative h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.14] text-sm font-medium text-stone-100 hover:bg-white/[0.07] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
			>
				View booking
				<ChevronRight size={15} />
			</Link>
		</div>
	);
}

function Stat({ label, value, hint, icon: Icon, tone, to, loading }) {
	const inner = (
		<div className="h-full p-4 rounded-xl border border-white/[0.07] bg-white/[0.025] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:bg-white/[0.045]">
			<div className="flex items-center justify-between">
				<span
					className={`w-8 h-8 rounded-lg flex items-center justify-center ${TONES[tone]}`}
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
			{loading ? (
				<div className="mt-4 h-8 w-16 rounded bg-white/[0.06] animate-pulse" />
			) : (
				<p className="mt-4 font-mackinac text-3xl font-bold tabular-nums text-white truncate">
					{value}
				</p>
			)}
			<p className="mt-1 text-sm text-stone-300">{label}</p>
			<p className="mt-0.5 text-xs text-stone-500">{hint}</p>
		</div>
	);
	return to ? (
		<Link
			to={to}
			className="group block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 rounded-xl"
		>
			{inner}
		</Link>
	) : (
		<div className="group h-full">{inner}</div>
	);
}

/** A shortcut row. Real links navigate; unbuilt ones show as "Soon" instead of doing nothing. */
function MenuRow({ icon: Icon, title, desc, tone, to, onClick, soon, danger }) {
	const body = (
		<>
			<span
				className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${
					danger ? "bg-rose-400/10 text-rose-300" : TONES[tone]
				}`}
			>
				<Icon size={16} />
			</span>
			<span className="min-w-0 flex-1 text-left">
				<span
					className={`block text-sm font-medium ${danger ? "text-rose-300" : "text-white"}`}
				>
					{title}
				</span>
				<span className="block text-xs text-stone-500 truncate">{desc}</span>
			</span>
			{soon ? (
				<span className="shrink-0 h-5 px-2 rounded-full bg-white/[0.06] text-[11px] text-stone-400 flex items-center">
					Soon
				</span>
			) : (
				<ChevronRight
					size={15}
					className={`shrink-0 transition-all group-hover:translate-x-0.5 ${
						danger
							? "text-rose-400/50 group-hover:text-rose-300"
							: "text-stone-600 group-hover:text-violet-300"
					}`}
				/>
			)}
		</>
	);

	const base =
		"group w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors";
	const focus =
		"focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-300";

	if (soon) {
		return (
			<div aria-disabled="true" className={`${base} opacity-60 cursor-default`}>
				{body}
			</div>
		);
	}
	if (to) {
		return (
			<Link to={to} className={`${base} hover:bg-white/[0.04] ${focus}`}>
				{body}
			</Link>
		);
	}
	return (
		<button
			type="button"
			onClick={onClick}
			className={`${base} ${focus} ${danger ? "hover:bg-rose-400/[0.07]" : "hover:bg-white/[0.04]"}`}
		>
			{body}
		</button>
	);
}

function MenuGroup({ title, children }) {
	return (
		<section>
			<h2 className="mb-4 font-mackinac text-xl font-bold text-white">
				{title}
			</h2>
			<div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.06] overflow-hidden">
				{children}
			</div>
		</section>
	);
}

function ProfileSkeleton() {
	return (
		<div className="space-y-8 animate-pulse" aria-busy="true">
			<div className="h-10 w-48 rounded-xl bg-white/[0.05]" />
			<div className="grid lg:grid-cols-12 gap-6">
				<div className="lg:col-span-8 h-[300px] rounded-2xl bg-white/[0.04] border border-white/[0.05]" />
				<div className="lg:col-span-4 h-[300px] rounded-2xl bg-white/[0.03] border border-white/[0.05]" />
			</div>
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{[...Array(4)].map((_, i) => (
					<div
						key={i}
						className="h-[136px] rounded-xl bg-white/[0.03] border border-white/[0.05]"
					/>
				))}
			</div>
			<div className="grid md:grid-cols-2 gap-6">
				<div className="h-56 rounded-2xl bg-white/[0.03]" />
				<div className="h-56 rounded-2xl bg-white/[0.03]" />
			</div>
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function CustomerProfile() {
	const navigate = useNavigate();
	const { user: authUser, logout } = useAuth();

	// Start from the signed-in user so the page paints immediately, then refresh.
	const [user, setUser] = useState(authUser || null);
	const [bookings, setBookings] = useState([]);
	const [loading, setLoading] = useState(true);
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

	useEffect(() => {
		let alive = true;
		(async () => {
			const [meRes, bookingsRes] = await Promise.allSettled([
				api.get("/api/auth/me"),
				api.get("/api/bookings/my-bookings"),
			]);
			if (!alive) return;

			if (meRes.status === "fulfilled" && meRes.value.data?.user) {
				setUser(meRes.value.data.user);
			}
			if (bookingsRes.status === "fulfilled") {
				const data = bookingsRes.value.data?.bookings ?? bookingsRes.value.data;
				setBookings(Array.isArray(data) ? data : []);
			} else {
				toast.error("Couldn't load your booking stats");
			}
			setLoading(false);
		})();
		return () => {
			alive = false;
		};
	}, []);

	const stats = useMemo(() => {
		const completed = bookings.filter((b) => b.status === "completed");
		const providers = new Set(
			bookings
				.map(
					(b) =>
						b.provider?.id ||
						b.provider_id ||
						b.provider?.name ||
						b.provider_name,
				)
				.filter(Boolean),
		);
		return {
			total: bookings.length,
			completed: completed.length,
			spent: completed.reduce((s, b) => s + (Number(b.price) || 0), 0),
			providers: providers.size,
		};
	}, [bookings]);

	const nextBooking = useMemo(
		() =>
			bookings
				.filter((b) => ACTIVE_STATUSES.includes(b.status))
				.sort(sortSoonest)[0] || null,
		[bookings],
	);

	const handleLogout = useCallback(() => setShowLogoutConfirm(true), []);
	const executeLogout = useCallback(() => {
		setShowLogoutConfirm(false);
		logout();
		navigate("/login");
	}, [logout, navigate]);

	return (
		<MotionConfig reducedMotion="user">
			<div className="min-h-screen bg-[#0d0b12] text-stone-200 bricolage-grotesque antialiased selection:bg-violet-400/30">
				<div
					aria-hidden
					className="fixed inset-x-0 top-0 h-[460px] pointer-events-none bg-[radial-gradient(60%_100%_at_20%_0%,rgba(139,92,246,0.14),transparent_70%),radial-gradient(45%_80%_at_85%_0%,rgba(251,191,36,0.08),transparent_70%)]"
				/>

				<header className="sticky top-0 z-40 bg-[#0d0b12]/90 backdrop-blur-md border-b border-white/[0.06]">
					<div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 h-14 flex items-center gap-3">
						<Link
							to="/dashboard"
							className="-ml-2 h-9 px-2 inline-flex items-center gap-2 rounded-md text-sm text-stone-300 hover:text-white hover:bg-white/[0.06] transition-colors"
						>
							<ArrowLeft size={17} />
							Dashboard
						</Link>
						<span className="flex-1" />
						<Logo to="/" size="md" theme="dark" />
					</div>
				</header>

				<main className="relative max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-12 pb-20">
					{!user && loading ? (
						<ProfileSkeleton />
					) : (
						<motion.div
							variants={containerVariants}
							initial="hidden"
							animate="show"
							className="space-y-10"
						>
							<motion.header variants={itemVariants}>
								<h1 className="font-mackinac text-3xl sm:text-4xl font-bold text-white tracking-tight">
									Profile
								</h1>
								<p className="mt-2 text-sm text-stone-400">
									Your details, your activity, and shortcuts to everything else.
								</p>
							</motion.header>

							<motion.section
								variants={itemVariants}
								className="grid lg:grid-cols-12 gap-6"
							>
								<div className="lg:col-span-8">
									<IdentityTicket user={user} />
								</div>
								<div className="lg:col-span-4">
									<UpNextCard booking={nextBooking} loading={loading} />
								</div>
							</motion.section>

							<motion.section
								variants={itemVariants}
								aria-label="Your activity"
								className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
							>
								<Stat
									label="Bookings"
									value={stats.total}
									hint="All time"
									icon={CalendarCheck}
									tone="sky"
									to="/dashboard/bookings"
									loading={loading}
								/>
								<Stat
									label="Completed"
									value={stats.completed}
									hint="Jobs done at home"
									icon={CheckCircle2}
									tone="emerald"
									loading={loading}
								/>
								<Stat
									label="Spent"
									value={formatINR(stats.spent)}
									hint="On completed work"
									icon={Wallet}
									tone="amber"
									loading={loading}
								/>
								<Stat
									label="Providers"
									value={stats.providers}
									hint="Hired so far"
									icon={Users}
									tone="fuchsia"
									loading={loading}
								/>
							</motion.section>

							<motion.div
								variants={itemVariants}
								className="grid md:grid-cols-2 gap-6 lg:gap-8"
							>
								<MenuGroup title="Account">
									<MenuRow
										icon={Settings}
										title="Settings"
										desc="Name, password and preferences"
										tone="violet"
										to="/account/settings"
									/>
									<MenuRow
										icon={Bell}
										title="Notifications"
										desc="Updates from your providers"
										tone="fuchsia"
										to="/notifications"
									/>
									<MenuRow
										icon={CalendarCheck}
										title="My bookings"
										desc="Upcoming and past services"
										tone="sky"
										to="/dashboard/bookings"
									/>
									<MenuRow
										icon={Wallet}
										title="Payments"
										desc="Cards and wallets"
										tone="emerald"
										soon
									/>
									<MenuRow
										icon={MapPin}
										title="Saved addresses"
										desc="Book faster from home or work"
										tone="amber"
										soon
									/>
								</MenuGroup>

								<MenuGroup title="Help and community">
									<MenuRow
										icon={HelpCircle}
										title="Help and support"
										desc="Get answers or contact us"
										tone="sky"
										to="/help"
									/>
									<MenuRow
										icon={Share2}
										title="Refer friends"
										desc="Share TaskGenie, earn rewards"
										tone="violet"
										soon
									/>
									<MenuRow
										icon={MessageSquare}
										title="Feedback"
										desc="Tell us what to improve"
										tone="amber"
										soon
									/>
									<MenuRow
										icon={LogOut}
										title="Sign out"
										desc="End this session on this device"
										danger
										onClick={handleLogout}
									/>
								</MenuGroup>
							</motion.div>

							<motion.p
								variants={itemVariants}
								className="flex items-center justify-center gap-1.5 text-xs text-stone-600"
							>
								<Zap size={11} />
								TaskGenie v1.0.0
							</motion.p>
						</motion.div>
					)}
				</main>

				<ConfirmDialog
					isOpen={showLogoutConfirm}
					onClose={() => setShowLogoutConfirm(false)}
					onConfirm={executeLogout}
					title="Sign out?"
					description="You'll need to sign in again to access your customer account."
					confirmText="Sign out"
					cancelText="Cancel"
					variant="danger"
					icon={LogOut}
				/>
			</div>
		</MotionConfig>
	);
}
