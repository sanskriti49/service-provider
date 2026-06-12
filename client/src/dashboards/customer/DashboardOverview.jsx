import { useState, useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
	Calendar,
	Clock,
	Plus,
	Zap,
	MapPin,
	User,
	ArrowRight,
	Phone,
} from "lucide-react";
import api from "../../api/axiosInstance";

const QUICK_SERVICES = [
	{
		name: "House Cleaning",
		slug: "house-cleaning",
		icon: "✨",
		color: "bg-blue-50 text-blue-600 border-blue-100",
	},
	{
		name: "Plumbing",
		slug: "plumbing",
		icon: "🔧",
		color: "bg-orange-50 text-orange-600 border-orange-100",
	},
	{
		name: "Electrical",
		slug: "electrical-repair",
		icon: "⚡",
		color: "bg-yellow-50 text-yellow-600 border-yellow-100",
	},
	{
		name: "Moving",
		slug: "moving-help",
		icon: "📦",
		color: "bg-purple-50 text-purple-600 border-purple-100",
	},
];

const formatCurrency = (amount) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
	}).format(amount || 0);

const formatTimeForCard = (timeStr) => {
	if (!timeStr) return "";
	const [h, m] = timeStr.split(":");
	return new Date(0, 0, 0, h, m).toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
};

const formatDateForCard = (dateStr) => {
	if (!dateStr) return "";
	return new Date(dateStr).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
};

export default function DashboardOverview() {
	const { user } = useOutletContext();
	const [isLoading, setIsLoading] = useState(true);
	const [services, setServices] = useState([]);
	const [upcoming, setUpcoming] = useState([]);
	const [dashboardStats, setDashboardStats] = useState({
		total_spent: 0,
		total_completed: 0,
		active_tasks: 0,
	});
	const [showMoreUpcoming, setShowMoreUpcoming] = useState(false);

	useEffect(() => {
		const loadData = async () => {
			try {
				const [servicesRes, upcomingRes, dashboardRes] =
					await Promise.allSettled([
						api.get("/api/services/v1"),
						api.get("/api/bookings/user/upcoming"),
						api.get("/api/dashboard/customer"),
					]);

				if (servicesRes.status === "fulfilled") {
					setServices(servicesRes.value.data);
				}

				if (upcomingRes.status === "fulfilled") {
					const valid = upcomingRes.value.data.filter((b) =>
						["booked", "confirmed", "in_progress"].includes(b.status),
					);
					setUpcoming(valid);
				}

				if (dashboardRes.status === "fulfilled") {
					setDashboardStats(
						dashboardRes.value.data.stats || dashboardRes.value.data,
					);
				}
			} catch (error) {
				console.error("Failed to load overview data", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadData();
	}, []);

	if (isLoading) return <DashboardSkeleton />;

	const mainBooking = upcoming[0] || null;
	const remainingBookings = upcoming.slice(1);

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-5 py-2"
		>
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 tracking-tight">
						Welcome back,{" "}
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">
							{user?.name?.split(" ")[0]}
						</span>
						! 👋
					</h1>
					<p className="text-gray-500 mt-1 text-sm sm:text-base">
						Here's what's happening with your home services today.
					</p>
				</div>
				<Link
					to="/services"
					className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-3 rounded-xl font-medium shadow-md shadow-gray-950/10 hover:shadow-lg transition-all active:scale-98 group w-full sm:w-auto justify-center"
				>
					<Plus
						size={18}
						className="group-hover:rotate-90 transition-transform duration-200"
					/>
					Book Service
				</Link>
			</div>

			{/* ── Stats Grid ──────────────────────────────────────────────────── */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard
					label="Available Services"
					value={services.length}
					color="text-blue-600 bg-blue-50/50 border-blue-100"
				/>
				<StatCard
					label="Active Tasks"
					value={dashboardStats.active_tasks}
					color="text-orange-600 bg-orange-50/50 border-orange-100"
				/>
				<StatCard
					label="Total Spent"
					value={formatCurrency(dashboardStats.total_spent)}
					color="text-emerald-600 bg-emerald-50/50 border-emerald-100"
				/>
				<StatCard
					label="Completed Tasks"
					value={dashboardStats.total_completed}
					color="text-purple-600 bg-purple-50/50 border-purple-100"
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
				{/* Upcoming bookings */}
				<div className="lg:col-span-7 bg-white border border-gray-100 p-6 rounded-3xl shadow-sm flex flex-col h-full min-h-[420px]">
					<div className="flex justify-between items-center mb-6">
						<h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
							<div className="p-2 bg-violet-50 rounded-xl text-violet-600 border border-violet-100">
								<Clock size={18} />
							</div>
							Up Next
						</h3>
						{remainingBookings.length > 0 && (
							<button
								onClick={() => setShowMoreUpcoming(!showMoreUpcoming)}
								className="text-xs font-semibold text-violet-600 hover:bg-violet-50 border border-transparent hover:border-violet-100 px-3 py-1.5 rounded-xl transition-all"
							>
								{showMoreUpcoming
									? "Show Less"
									: `+${remainingBookings.length} more`}
							</button>
						)}
					</div>

					<div className="flex-1 flex flex-col gap-4">
						{!mainBooking ? (
							<EmptyState />
						) : (
							<>
								<UpcomingCard
									booking={mainBooking}
									isHero
									formatTime={formatTimeForCard}
									formatDate={formatDateForCard}
									formatCurrency={formatCurrency}
								/>
								<AnimatePresence>
									{showMoreUpcoming && (
										<motion.div
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: "auto", opacity: 1 }}
											exit={{ height: 0, opacity: 0 }}
											className="overflow-hidden space-y-3"
										>
											{remainingBookings.map((b, idx) => (
												<motion.div
													initial={{ opacity: 0, y: 10 }}
													animate={{ opacity: 1, y: 0 }}
													transition={{ delay: idx * 0.05 }}
													key={b.booking_id || b.id}
												>
													<UpcomingCard
														booking={b}
														formatTime={formatTimeForCard}
														formatDate={formatDateForCard}
														formatCurrency={formatCurrency}
													/>
												</motion.div>
											))}
										</motion.div>
									)}
								</AnimatePresence>
							</>
						)}
					</div>
				</div>

				{/* Quick Book */}
				<div className="lg:col-span-5 bg-white border border-gray-100 p-6 rounded-3xl shadow-sm h-full">
					<h3 className="font-bold text-lg text-gray-900 mb-6 flex items-center gap-2">
						<div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
							<Zap size={18} />
						</div>
						Quick Book
					</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{QUICK_SERVICES.map((service) => (
							<Link
								key={service.slug}
								to={`/services/${service.slug}`}
								className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-violet-200 hover:shadow-md hover:shadow-violet-500/5 transition-all group"
							>
								<div className="flex items-center gap-3">
									<div
										className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border ${service.color}`}
									>
										{service.icon}
									</div>
									<span className="font-semibold text-gray-700 text-sm">
										{service.name}
									</span>
								</div>
								<ArrowRight
									size={16}
									className="text-gray-300 group-hover:text-violet-500 transition-colors group-hover:translate-x-0.5 transform transition-transform"
								/>
							</Link>
						))}
					</div>
				</div>
			</div>
		</motion.div>
	);
}

const StatCard = ({ label, value, color }) => (
	<div
		className={`p-5 rounded-2xl border flex flex-col justify-between h-28 backdrop-blur-sm transition-all hover:shadow-sm ${color}`}
	>
		<span className="text-xs font-semibold uppercase tracking-wider opacity-80">
			{label}
		</span>
		<span className="text-2xl font-black tracking-tight">{value}</span>
	</div>
);

const EmptyState = () => (
	<div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
		<div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mb-3 text-gray-400">
			<Calendar size={22} />
		</div>
		<p className="text-gray-900 font-bold">All caught up!</p>
		<p className="text-gray-400 text-xs mt-0.5">
			No upcoming bookings scheduled right now.
		</p>
	</div>
);

const UpcomingCard = ({
	booking,
	isHero,
	formatTime,
	formatDate,
	formatCurrency,
}) => (
	<div
		className={`p-5 rounded-2xl transition-all ${
			isHero
				? "border border-violet-100 bg-gradient-to-br from-white to-violet-50/10 shadow-md shadow-violet-900/5 relative overflow-hidden"
				: "border-l-4 border-y border-r border-y-gray-100 border-r-gray-100 bg-white hover:bg-gray-50/50"
		} ${!isHero ? (booking.status === "in_progress" ? "border-l-orange-500" : booking.status === "confirmed" ? "border-l-green-500" : "border-l-blue-500") : ""}`}
	>
		<div className="flex justify-between items-start gap-4">
			<div className="space-y-1.5 flex-1">
				<span className="text-[10px] uppercase font-bold tracking-wider text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
					{booking.service_category || "Home Service"}
				</span>
				<h4 className="font-bold text-gray-900 text-[17px] leading-tight">
					{booking.service_name}
				</h4>

				<div className="font-inter flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
					<div className="flex items-center gap-1.5 text-gray-600">
						<Calendar size={14} className="text-gray-500" />
						<span className="text-xs font-semibold">
							{formatDate(booking.booking_date || new Date())}
						</span>
					</div>
					<div className="flex items-center gap-1.5 text-gray-600">
						<Clock size={14} className="text-gray-500" />
						<span className="text-xs font-semibold">
							{formatTime(booking.start_time)}
						</span>
					</div>
				</div>
			</div>

			<StatusBadge status={booking.status} dynamic={!isHero} />
		</div>

		<div className="mt-4 pt-3 border-t border-gray-100/80 flex items-center justify-between gap-4">
			<div className="flex font-inter items-center text-gray-500 font-medium min-w-0">
				<div className="flex items-center gap-1.5 truncate">
					<User size={14} className="text-gray-400 shrink-0" />
					<span className="text-[13px] truncate">
						{booking.provider_name || "Assigning Pro..."}
					</span>
				</div>
			</div>

			<div className="flex items-center gap-3 shrink-0">
				{booking.provider_phone && (
					<a
						href={`tel:${booking.provider_phone.replace(/\s+/g, "")}`}
						className="flex items-center gap-1.5 text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100/80 px-2.5 py-1 rounded-lg font-semibold transition-colors text-xs"
						title={`Call ${booking.provider_name}`}
					>
						<Phone size={13} />
						<span className="text-[13px]">Call Pro</span>
					</a>
				)}
				<div className="text-base font-inter font-black text-gray-950">
					{formatCurrency(booking.price)}
				</div>
			</div>
		</div>
	</div>
);

const STATUS_STYLES = {
	booked: {
		text: "text-blue-600",
		bg: "bg-blue-50",
		border: "border-blue-100",
		dot: "bg-blue-500",
	},
	confirmed: {
		text: "text-emerald-600",
		bg: "bg-emerald-50",
		border: "border-emerald-100",
		dot: "bg-emerald-500",
	},
	in_progress: {
		text: "text-orange-600",
		bg: "bg-orange-50",
		border: "border-orange-100",
		dot: "bg-orange-500",
	},
};

const StatusBadge = ({ status, dynamic }) => {
	const style = STATUS_STYLES[status] || {
		text: "text-gray-500",
		bg: "bg-gray-50",
		border: "border-gray-100",
		dot: "bg-gray-400",
	};

	if (dynamic) {
		return (
			<div className="flex items-center gap-1.5 px-1 py-0.5">
				<span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
				<span className="text-[11px] font-bold text-gray-500 capitalize">
					{status?.replace("_", " ")}
				</span>
			</div>
		);
	}

	return (
		<span
			className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border tracking-wider ${style.bg} ${style.text} ${style.border}`}
		>
			<span className={`w-1 h-1 rounded-full ${style.dot}`} />
			{status?.replace("_", " ")}
		</span>
	);
};

const DashboardSkeleton = () => (
	<div className="space-y-6 max-w-7xl mx-auto px-4 py-6 animate-pulse">
		<div className="h-10 bg-gray-100 rounded-xl w-1/3" />
		<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
			{[...Array(4)].map((_, i) => (
				<div key={i} className="h-28 bg-gray-100 rounded-2xl" />
			))}
		</div>
		<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
			<div className="lg:col-span-7 h-96 bg-gray-100 rounded-3xl" />
			<div className="lg:col-span-5 h-96 bg-gray-100 rounded-3xl" />
		</div>
	</div>
);
