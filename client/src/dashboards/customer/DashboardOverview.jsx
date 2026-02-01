import { useState, useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Plus, Zap, ChevronRight } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const QUICK_SERVICES = [
	{
		name: "House Cleaning",
		slug: "house-cleaning",
		icon: "✨",
		color: "bg-blue-100 text-blue-600 border-blue-200",
	},
	{
		name: "Plumbing",
		slug: "plumbing",
		icon: "🔧",
		color: "bg-orange-100 text-orange-600 border-orange-200",
	},
	{
		name: "Electrical",
		slug: "electrical-repair",
		icon: "⚡",
		color: "bg-yellow-100 text-yellow-600 border-yellow-200",
	},
	{
		name: "Moving",
		slug: "moving-help",
		icon: "📦",
		color: "bg-purple-100 text-purple-600 border-purple-200",
	},
];

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

	useEffect(() => {
		const loadData = async () => {
			const token = localStorage.getItem("token");
			if (!token) return;

			try {
				const headers = { Authorization: `Bearer ${token}` };
				const [servicesRes, upcomingRes, dashboardRes] = await Promise.all([
					fetch(`${API_URL}/api/services/v1`),
					fetch(`${API_URL}/api/bookings/user/upcoming`, { headers }),
					fetch(`${API_URL}/api/dashboard/customer`, { headers }),
				]);

				if (servicesRes.ok) setServices(await servicesRes.json());

				if (upcomingRes.ok) {
					const data = await upcomingRes.json();
					const valid = data.filter((b) =>
						["booked", "confirmed", "in_progress"].includes(b.status),
					);
					setUpcoming(valid);
				}

				if (dashboardRes.ok) {
					const data = await dashboardRes.json();
					setDashboardStats(data.stats);
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
			className="space-y-8"
		>
			{/* Header */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 tracking-tight">
						Welcome back,{" "}
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">
							{user.name?.split(" ")[0]}
						</span>
						! 👋
					</h1>
					<p className="text-gray-500 mt-1">
						Here's what's happening with your home services today.
					</p>
				</div>
				<Link
					to="/services"
					className="hidden sm:flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-gray-900/20 transition-all active:scale-95 group"
				>
					<Plus
						size={18}
						className="group-hover:rotate-90 transition-transform"
					/>
					Book Service
				</Link>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard
					label="Total Services"
					value={services.length}
					color="text-blue-600 bg-blue-50 border-blue-100"
				/>
				<StatCard
					label="Active Tasks"
					value={dashboardStats.active_tasks}
					color="text-orange-600 bg-orange-50 border-orange-100"
				/>
				<StatCard
					label="Total Spent"
					value={`₹${dashboardStats.total_spent}`}
					color="text-green-600 bg-green-50 border-green-100"
				/>
				<StatCard
					label="Reviews Given"
					value="0"
					color="text-purple-600 bg-purple-50 border-purple-100"
				/>
			</div>

			{/* Content Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* Upcoming Card Logic */}
				<div className="bg-white/80 backdrop-blur-md border border-white/60 p-6 rounded-3xl shadow-sm flex flex-col h-full min-h-[400px]">
					<div className="flex justify-between items-center mb-6">
						<h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
							<div className="p-2 bg-violet-100 rounded-lg text-violet-600">
								<Clock size={18} />
							</div>
							Up Next
						</h3>
						{remainingBookings.length > 0 && (
							<button
								onClick={() => setShowMoreUpcoming(!showMoreUpcoming)}
								className="text-xs font-semibold text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
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
									isHero={true}
									formatTime={formatTimeForCard}
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
											{remainingBookings.map((b) => (
												<UpcomingCard
													key={b.booking_id || b.id}
													booking={b}
													formatTime={formatTimeForCard}
													formatCurrency={formatCurrency}
												/>
											))}
										</motion.div>
									)}
								</AnimatePresence>
							</>
						)}
					</div>
				</div>

				{/* Quick Actions */}
				<div className="bg-white/80 backdrop-blur-md border border-white/60 p-6 rounded-3xl shadow-sm h-full">
					<h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
						<div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
							<Zap size={18} />
						</div>
						Quick Book
					</h3>
					<div className="grid grid-cols-2 gap-3">
						{QUICK_SERVICES.map((service) => (
							<Link
								key={service.slug}
								to={`/services/${service.slug}`}
								className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:border-violet-200 hover:shadow-md transition-all group relative overflow-hidden"
							>
								<div
									className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${service.color}`}
								>
									{service.icon}
								</div>
								<span className="font-medium text-gray-700 text-sm">
									{service.name}
								</span>
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
		className={`p-5 rounded-2xl ${color} bg-opacity-20 border border-opacity-30 flex flex-col justify-between h-28`}
	>
		<span className="text-xs font-bold uppercase tracking-wider opacity-80">
			{label}
		</span>
		<span className="text-3xl font-extrabold tracking-tight">{value}</span>
	</div>
);

const EmptyState = () => (
	<div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-100 rounded-2xl">
		<div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
			<Calendar size={28} />
		</div>
		<p className="text-gray-900 font-bold text-lg">All caught up!</p>
	</div>
);

const UpcomingCard = ({ booking, isHero, formatTime, formatCurrency }) => {
	return (
		<div
			className={`p-4 rounded-2xl border ${
				isHero
					? "border-violet-100 bg-white shadow-md"
					: "border-gray-100 bg-white"
			}`}
		>
			<div className="flex justify-between items-start">
				<div>
					<h4 className="font-bold text-gray-900">{booking.service_name}</h4>
					<div className="flex items-center gap-2 mt-1">
						<Clock size={14} className="text-gray-400" />
						<span className="text-sm font-medium text-gray-600">
							{formatTime(booking.start_time)}
						</span>
					</div>
				</div>
				{isHero && (
					<span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-green-50 text-green-600 border border-green-100">
						Confirmed
					</span>
				)}
			</div>
			<div className="mt-4 flex items-center justify-between">
				<div className="text-sm text-gray-500">
					{booking.provider_name || "Provider Assigned"}
				</div>
				<div className="font-bold text-gray-900">
					{formatCurrency(booking.price)}
				</div>
			</div>
		</div>
	);
};

const DashboardSkeleton = () => (
	<div className="animate-pulse h-96 bg-gray-100 rounded-3xl"></div>
);
