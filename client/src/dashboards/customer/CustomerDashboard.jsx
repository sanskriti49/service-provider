import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
	Calendar,
	Clock,
	MapPin,
	Plus,
	Search,
	Settings,
	Star,
	User,
	Zap,
	CheckCircle2,
	AlertCircle,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const MOCK_ACTIVE_BOOKING = {
	id: "BK-7829",
	service: "Deep House Cleaning",
	provider: "Sarah Jenkins",
	date: "Today, 2:00 PM",
	status: "In Progress",
	price: "$120",
	image:
		"https://images.unsplash.com/photo-1581578731117-104f2a863cc5?q=80&w=1000&auto=format&fit=crop",
};

const MOCK_HISTORY = [
	{
		id: 1,
		service: "AC Repair",
		date: "Oct 24, 2023",
		status: "Completed",
		price: "$85",
	},
	{
		id: 2,
		service: "Plumbing Fix",
		date: "Sep 12, 2023",
		status: "Completed",
		price: "$60",
	},
	{
		id: 3,
		service: "Sofa Cleaning",
		date: "Aug 05, 2023",
		status: "Cancelled",
		price: "$0",
	},
];

const QUICK_SERVICES = [
	{
		name: "House Cleaning",
		slug: "house-cleaning",
		icon: "✨",
		color: "bg-blue-100 text-blue-600",
	},
	{
		name: "Plumbing",
		slug: "plumbing",
		icon: "🔧",
		color: "bg-orange-100 text-orange-600",
	},
	{
		name: "Electrical",
		slug: "electrical-repair",
		icon: "⚡",
		color: "bg-yellow-100 text-yellow-600",
	},
	{
		name: "Moving",
		slug: "moving-help",
		icon: "📦",
		color: "bg-purple-100 text-purple-600",
	},
];

const formatTimeForCard = (timeStr) => {
	if (!timeStr) return "";
	const [h, m] = timeStr.split(":");
	return new Date(0, 0, 0, h, m).toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
};

export default function CustomerDashboard() {
	const navigate = useNavigate();

	const [user, setUser] = useState({ name: "User" });
	const [activeTab, setActiveTab] = useState("overview");
	const [services, setServices] = useState([]);

	const [upcoming, setUpcoming] = useState([]);
	const [showMoreUpcoming, setShowMoreUpcoming] = useState(false);

	const [dashboardStats, setDashboardStats] = useState({
		total_spent: 0,
		total_completed: 0,
		active_tasks: 0,
	});
	const [nextBooking, setNextBooking] = useState(null);

	const [loading, setLoading] = useState(true);
	const totalServices = services.length;

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (token) {
			try {
				const decoded = jwtDecode(token);
				console.log("DECODED", decoded);
				setUser(decoded);
			} catch (error) {
				console.error("Invalid token");
			}
		}

		const fetchData = async () => {
			try {
				const servicesRes = await fetch(`${API_URL}/api/services/v1`);
				if (servicesRes.ok) {
					const servicesData = await servicesRes.json();
					setServices(servicesData);
				}
			} catch (error) {
				console.error("Error fetching data", error);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, []);

	useEffect(() => {
		const fetchBookings = async () => {
			try {
				const token = localStorage.getItem("token");
				const headers = { Authorization: `Bearer ${token}` };

				const upcomingRes = await fetch(
					`${API_URL}/api/bookings/user/upcoming`,
					{ headers }
				);

				if (upcomingRes.ok) {
					const upcomingData = await upcomingRes.json();

					console.log("Raw API Data:", upcomingData); // Check your console for this!

					const sortedData = upcomingData.sort((a, b) => {
						// 1. Create Date objects from the date string only
						const dateA = new Date(a.date);
						const dateB = new Date(b.date);

						// 2. Compare the Dates first (Milliseconds)
						const timeA = dateA.getTime();
						const timeB = dateB.getTime();

						if (timeA !== timeB) {
							return timeA - timeB; // Sort by date
						}

						// 3. If Dates are equal (Same Day), compare start_time strings
						// This works because "09:00" comes before "14:00" alphabetically
						const startTimeA = a.start_time || "";
						const startTimeB = b.start_time || "";

						return startTimeA.localeCompare(startTimeB);
					});

					console.log("Sorted Upcoming:", sortedData);
					setUpcoming(sortedData);
				}
			} catch (err) {
				console.error(err);
			}
		};

		fetchBookings();
	}, []);

	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				const token = localStorage.getItem("token");
				const res = await fetch(`${API_URL}/api/dashboard/customer`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				if (res.ok) {
					const data = await res.json();
					setDashboardStats(data.stats);
					setNextBooking(data.next_booking);
				}
			} catch (err) {
				console.error("Error loading dashboard", err);
			} finally {
				setLoading(false);
			}
		};
		if (user.id) fetchDashboardData();
	}, [user.id]); // runs when user is decoded

	return (
		<div className="lg:-mt-50 -mt-70 bricolage-grotesque min-h-screen bg-gray-50/50 relative overflow-hidden pt-24 pb-12 px-4 sm:px-8">
			<div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1  lg:grid-cols-[280px_1fr] gap-8">
				<motion.aside
					initial={{ x: -50, opacity: 0 }}
					animate={{ x: 0, opacity: 1 }}
					className="lg:h-fit sticky top-4"
				>
					<div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-6 flex flex-col gap-6">
						{/* Profile Brief */}
						<div className="flex items-center gap-4 pb-6 border-b border-gray-100">
							<div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-violet-500/30 overflow-hidden">
								{/* 1. Show Photo if available, otherwise show Initial */}
								{user.photo ? (
									<img
										src={user.photo}
										alt="Profile"
										className="w-full h-full object-cover"
									/>
								) : (
									<span>{user?.name?.[0]?.toUpperCase() || "U"}</span>
								)}
							</div>
							<div>
								<h3 className="font-bold text-gray-800">
									{user.name || "Guest"}
								</h3>
								<p className="text-sm text-gray-500">
									{user.custom_id || "Customer Account"}
								</p>
							</div>
						</div>

						<nav className="flex flex-col gap-2">
							<SidebarItem
								icon={<DashboardIcon />}
								label="Overview"
								active={activeTab === "overview"}
								onClick={() => setActiveTab("overview")}
							/>
							<SidebarItem
								icon={<HistoryIcon />}
								label="My Bookings"
								active={activeTab === "bookings"}
								onClick={() => setActiveTab("bookings")}
							/>
							<SidebarItem
								icon={<SettingsIcon />}
								label="Settings"
								active={activeTab === "settings"}
								onClick={() => navigate("/settings")}
							/>
						</nav>

						<div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-5 text-white mt-4 shadow-lg shadow-indigo-500/20 relative overflow-hidden group cursor-pointer">
							<div className="absolute top-0 right-0 p-3 opacity-20 transform group-hover:scale-110 transition-transform">
								<Zap size={60} />
							</div>
							<h4 className="font-bold relative z-10">Need Help?</h4>
							<p className="text-violet-100 text-sm mt-1 mb-3 relative z-10">
								Contact our support team anytime.
							</p>
							<Link
								to="/#contact"
								className="text-xs bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/30 hover:bg-white/30 transition-colors"
							>
								Mail us!
							</Link>
						</div>
					</div>
				</motion.aside>

				<main className="space-y-8">
					<motion.div
						initial={{ y: -20, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						className="flex justify-between items-center"
					>
						<div>
							<h1 className="text-3xl font-bold text-gray-900">
								Welcome back,{" "}
								<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">
									{user.name?.split(" ")[0]}
								</span>
								! 👋
							</h1>
							<p className="text-gray-500 mt-1">
								Here's what's happening with your home services.
							</p>
						</div>

						{/* Global Book Button */}
						<Link
							to="/#services"
							className="cursor-pointer hidden sm:flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-gray-900/20 transition-all active:scale-95"
						>
							<Plus size={18} /> Book New Service
						</Link>
					</motion.div>

					{/* Conditional Content based on Tab */}
					{activeTab === "overview" && (
						<OverviewTab
							stats={dashboardStats}
							nextBooking={nextBooking}
							totalServices={totalServices}
							upcoming={upcoming}
							showMoreUpcoming={showMoreUpcoming}
							setShowMoreUpcoming={setShowMoreUpcoming}
						/>
					)}
					{activeTab === "bookings" && <BookingsTab />}
					{activeTab === "settings" && <SettingsTab />}
				</main>
			</div>
		</div>
	);
}

// function OverviewTab({
// 	stats,
// 	nextBooking,
// 	totalServices,
// 	upcoming,
// 	showMoreUpcoming,
// 	setShowMoreUpcoming,
// }) {
// 	return (
// 		<motion.div
// 			initial={{ opacity: 0 }}
// 			animate={{ opacity: 1 }}
// 			className="space-y-8"
// 		>
// 			{/* 1. Quick Stats */}
// 			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
// 				<StatCard
// 					label="Total Services"
// 					value={totalServices}
// 					color="bg-blue-50 text-blue-600"
// 				/>
// 				<StatCard
// 					label="Active Tasks"
// 					value={stats.active_tasks}
// 					color="bg-orange-50 text-orange-600"
// 				/>
// 				<StatCard
// 					label="Total Spent"
// 					value={`₹${stats.total_spent}`}
// 					color="bg-green-50 text-green-600"
// 				/>
// 				{/* <StatCard
// 					label="Jobs Done"
// 					value={stats.total_completed} // Real Value
// 					color="bg-orange-50 text-orange-600"
// 				/> */}
// 				<StatCard
// 					label="Reviews Given"
// 					value="-"
// 					color="bg-purple-50 text-purple-600"
// 				/>
// 			</div>

// 			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
// 				<div className="bg-white/80 backdrop-blur-md border border-white/60 p-6 rounded-3xl shadow-sm flex flex-col h-full">
// 					<div className="flex justify-between items-center mb-6">
// 						<h3 className="font-bold text-lg flex items-center gap-2 text-gray-800">
// 							<div className="p-2 bg-violet-100 rounded-lg text-violet-600">
// 								<Clock size={18} />
// 							</div>
// 							Up Next
// 						</h3>
// 						{upcoming.length > 1 && (
// 							<button
// 								onClick={() => setShowMoreUpcoming(!showMoreUpcoming)}
// 								className="cursor-pointer text-xs font-medium text-violet-600 hover:text-violet-800 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
// 							>
// 								{showMoreUpcoming
// 									? "Show Less"
// 									: `View All (${upcoming.length})`}
// 							</button>
// 						)}
// 						{!nextBooking ? (
// 							<div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-100 rounded-2xl">
// 								<div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
// 									<Calendar className="text-gray-300" size={24} />
// 								</div>
// 								<p className="text-gray-900 font-medium">
// 									No upcoming bookings
// 								</p>
// 							</div>
// 						) : (
// 							<div className="space-y-4">
// 								{/* Pass the real DB object */}
// 								<UpcomingCard booking={nextBooking} />
// 							</div>
// 						)}
// 					</div>

// 					{upcoming.length === 0 ? (
// 						<div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-100 rounded-2xl">
// 							<div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
// 								<Calendar className="text-gray-300" size={24} />
// 							</div>
// 							<p className="text-gray-900 font-medium">No upcoming bookings</p>
// 							<p className="text-gray-400 text-sm mt-1">
// 								Your scheduled services will appear here.
// 							</p>
// 						</div>
// 					) : (
// 						<div className="space-y-4">
// 							{/* Always show the first one */}
// 							<UpcomingCard booking={upcoming[0]} />

// 							{/* Show others if toggled */}
// 							{showMoreUpcoming && (
// 								<motion.div
// 									initial={{ opacity: 0, height: 0 }}
// 									animate={{ opacity: 1, height: "auto" }}
// 									className="space-y-4 pt-2"
// 								>
// 									{upcoming.slice(1).map((b) => (
// 										<UpcomingCard key={b.booking_id || b.id} booking={b} />
// 									))}
// 								</motion.div>
// 							)}
// 						</div>
// 					)}
// 				</div>

// 				{/* 3. Quick Book Actions */}
// 				<div className="bg-white/80 backdrop-blur-md border border-white/60 p-6 rounded-3xl shadow-sm h-full">
// 					<h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800">
// 						<div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
// 							<Zap size={18} />
// 						</div>
// 						Quick Book
// 					</h3>
// 					<p className="text-sm text-gray-500 mb-6">
// 						Select a category to find a pro instantly.
// 					</p>

// 					<div className="grid grid-cols-2 gap-3">
// 						{QUICK_SERVICES.map((service) => (
// 							<Link
// 								key={service.slug}
// 								to={`/services/${service.slug}`}
// 								className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-white hover:border-violet-200 hover:shadow-md hover:shadow-violet-100 transition-all group"
// 							>
// 								<div
// 									className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${service.color} group-hover:scale-110 transition-transform`}
// 								>
// 									{service.icon}
// 								</div>
// 								<span className="font-medium text-gray-700 text-sm">
// 									{service.name}
// 								</span>
// 							</Link>
// 						))}
// 					</div>
// 				</div>
// 			</div>
// 		</motion.div>
// 	);
// }

// --- UPDATED UPCOMING CARD ---
// function UpcomingCard({ booking }) {
// 	const navigate = useNavigate();

// 	const providerName = booking.provider_name || "Unknown Provider";
// 	const providerImage = booking.provider?.photo;

// 	return (
// 		<div className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-violet-100 transition-all duration-300 relative overflow-hidden">
// 			{/* Left accent bar */}
// 			<div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-l-2xl"></div>

// 			<div className="flex justify-between items-start mb-4 pl-2">
// 				<div>
// 					<h4 className="font-bold text-gray-800 text-lg leading-tight">
// 						{booking.service_name}
// 					</h4>
// 					<p className="text-xs text-gray-400 font-mono mt-1">
// 						ID: #{booking.booking_id?.slice(0, 8).toUpperCase() || "..."}
// 					</p>
// 				</div>
// 				<span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-600 border border-green-100 flex items-center gap-1">
// 					<div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
// 					Confirmed
// 				</span>
// 			</div>

// 			{/* Provider Info Pill */}
// 			<div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl ml-2 group-hover:bg-violet-50/50 transition-colors">
// 				<div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 overflow-hidden border border-white shadow-sm">
// 					{providerImage ? (
// 						<img
// 							src={providerImage}
// 							alt={providerName}
// 							className="w-full h-full object-cover"
// 						/>
// 					) : (
// 						providerName.charAt(0)
// 					)}
// 				</div>
// 				<div className="flex-1">
// 					<p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">
// 						Provider
// 					</p>
// 					<p className="text-sm font-semibold text-gray-700">{providerName}</p>
// 				</div>
// 			</div>

// 			{/* Date & Time Footer */}
// 			<div className="flex items-center justify-between pt-3 border-t border-gray-100 ml-2">
// 				<div className="flex items-center gap-4">
// 					<div className="flex items-center gap-1.5 text-sm text-gray-600">
// 						<Calendar size={14} className="text-violet-500" />
// 						<span className="font-medium">
// 							{new Date(booking.date).toLocaleDateString("en-US", {
// 								month: "short",
// 								day: "numeric",
// 							})}
// 						</span>
// 					</div>
// 					<div className="w-px h-3 bg-gray-300"></div>
// 					<div className="flex items-center gap-1.5 text-sm text-gray-600">
// 						<Clock size={14} className="text-violet-500" />
// 						<span className="font-medium">
// 							{formatTimeForCard(booking.start_time)}
// 						</span>
// 					</div>
// 				</div>

// 				{/* Optional: Action Button if you have a details page */}
// 				{/* <button className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors">
//                     View Details
//                 </button> */}
// 			</div>
// 		</div>
// 	);
// }

// --- UPDATED OVERVIEW TAB ---
function OverviewTab({
	stats,
	totalServices,
	upcoming,
	showMoreUpcoming,
	setShowMoreUpcoming,
}) {
	// Logic: The first item is the "Hero", the rest are the list.
	const mainBooking = upcoming.length > 0 ? upcoming[0] : null;
	const remainingBookings = upcoming.slice(1);

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="space-y-8"
		>
			{/* 1. Quick Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard
					label="Total Services"
					value={totalServices}
					color="bg-blue-50 text-blue-600"
				/>
				<StatCard
					label="Active Tasks"
					value={stats.active_tasks}
					color="bg-orange-50 text-orange-600"
				/>
				<StatCard
					label="Total Spent"
					value={`₹${stats.total_spent}`}
					color="bg-green-50 text-green-600"
				/>
				<StatCard
					label="Reviews Given"
					value="-"
					color="bg-purple-50 text-purple-600"
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* 2. UP NEXT SECTION */}
				<div className="bg-white/80 backdrop-blur-md border border-white/60 p-6 rounded-3xl shadow-sm flex flex-col h-full min-h-[400px]">
					<div className="flex justify-between items-center mb-6">
						<h3 className="font-bold text-lg flex items-center gap-2 text-gray-800">
							<div className="p-2 bg-violet-100 rounded-lg text-violet-600">
								<Clock size={18} />
							</div>
							Up Next
						</h3>
						{remainingBookings.length > 0 && (
							<button
								onClick={() => setShowMoreUpcoming(!showMoreUpcoming)}
								className="cursor-pointer text-xs font-medium text-violet-600 hover:text-violet-800 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
							>
								{showMoreUpcoming
									? "Show Less"
									: `+${remainingBookings.length} more`}
							</button>
						)}
					</div>

					<div className="flex-1 flex flex-col gap-4">
						{!mainBooking ? (
							// EMPTY STATE
							<div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-100 rounded-2xl">
								<div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-4">
									<Calendar className="text-gray-300" size={28} />
								</div>
								<p className="text-gray-900 font-bold text-lg">
									All caught up!
								</p>
								<p className="text-gray-500 text-sm mt-1 max-w-[200px]">
									You have no upcoming scheduled services at the moment.
								</p>
							</div>
						) : (
							// LIST STATE
							<>
								{/* Main Hero Card */}
								<div className="relative z-10">
									<p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
										Happening Soon
									</p>
									<UpcomingCard booking={mainBooking} isHero={true} />
								</div>

								{/* Collapsible List for Remaining items */}
								<motion.div
									initial={false}
									animate={{
										height: showMoreUpcoming ? "auto" : 0,
										opacity: showMoreUpcoming ? 1 : 0,
									}}
									className="overflow-hidden space-y-3"
								>
									{remainingBookings.map((b) => (
										<UpcomingCard
											key={b.booking_id || b.id}
											booking={b}
											isHero={false}
										/>
									))}
								</motion.div>
							</>
						)}
					</div>
				</div>

				{/* 3. Quick Book Actions */}
				<div className="bg-white/80 backdrop-blur-md border border-white/60 p-6 rounded-3xl shadow-sm h-full">
					<h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800">
						<div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
							<Zap size={18} />
						</div>
						Quick Book
					</h3>
					<p className="text-sm text-gray-500 mb-6">
						Select a category to find a pro instantly.
					</p>

					<div className="grid grid-cols-2 gap-3">
						{QUICK_SERVICES.map((service) => (
							<Link
								key={service.slug}
								to={`/services/${service.slug}`}
								className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:border-violet-200 hover:shadow-md hover:shadow-violet-100 transition-all group"
							>
								<div
									className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${service.color} group-hover:scale-110 transition-transform`}
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

// --- UPDATED UPCOMING CARD ---
function UpcomingCard({ booking, isHero = false }) {
	const providerName = booking.provider_name || "Unknown Provider";
	const providerImage = booking.provider?.photo;
	const dateObj = new Date(booking.date);
	const day = dateObj.getDate();
	const month = dateObj.toLocaleDateString("en-US", { month: "short" });

	return (
		<div
			className={`group bg-white rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col sm:flex-row gap-4
            ${
							isHero
								? "p-5 border-violet-100 shadow-md shadow-violet-100/50 hover:shadow-lg hover:border-violet-300"
								: "p-4 border-gray-100 hover:border-gray-300 hover:shadow-sm"
						}`}
		>
			{/* Left: Date Box */}
			<div
				className={`flex-shrink-0 flex flex-col items-center justify-center rounded-xl border w-16 h-16 sm:w-20 sm:h-auto
                ${
									isHero
										? "bg-violet-50 border-violet-100 text-violet-700"
										: "bg-gray-50 border-gray-100 text-gray-600"
								}`}
			>
				<span className="text-xs font-bold uppercase">{month}</span>
				<span className="text-2xl sm:text-3xl font-bold leading-none">
					{day}
				</span>
			</div>

			{/* Middle: Info */}
			<div className="flex-1 min-w-0">
				<div className="flex justify-between items-start">
					<div>
						<h4
							className={`font-bold text-gray-900 truncate pr-2 ${
								isHero ? "text-lg" : "text-base"
							}`}
						>
							{booking.service_name}
						</h4>
						<div className="flex items-center gap-2 mt-1">
							<Clock size={14} className="text-gray-400" />
							<span className="text-sm font-medium text-gray-600">
								{formatTimeForCard(booking.start_time)}
							</span>
						</div>
					</div>
					{isHero && (
						<span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-600 border border-green-100 items-center gap-1">
							<div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
							Confirmed
						</span>
					)}
				</div>

				<div className="mt-4 flex items-center justify-between">
					{/* Provider Info */}
					<div className="flex items-center gap-2">
						<div className="w-6 h-6 rounded-full bg-gray-200 border border-white shadow-sm overflow-hidden">
							{providerImage ? (
								<img
									src={providerImage}
									alt={providerName}
									className="w-full h-full object-cover"
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 font-bold">
									{providerName.charAt(0)}
								</div>
							)}
						</div>
						<p className="text-sm text-gray-500 truncate max-w-[120px]">
							<span className="font-medium text-gray-700">{providerName}</span>
						</p>
					</div>

					{/* Price Tag */}
					<div className="font-bold text-gray-900 bg-gray-50 px-2 py-1 rounded-lg text-sm border border-gray-100">
						Rs. {booking.price ? booking.price : "$--"}
					</div>
				</div>
			</div>
		</div>
	);
}
function BookingsTab() {
	const [history, setHistory] = useState([]);
	const [loading, setLoading] = useState(true);
	const [meta, setMeta] = useState({
		current_page: 1,
		total_pages: 1,
		has_next_page: false,
	});

	useEffect(() => {
		const fetchHistory = async () => {
			setLoading(true);
			try {
				const token = localStorage.getItem("token");
				const res = await fetch(
					`${API_URL}/api/bookings/user/history?page=${meta.current_page}&limit=5`,
					{ headers: { Authorization: `Bearer ${token}` } }
				);
				if (res.ok) {
					const responseData = await res.json();
					setHistory(responseData.data);
					setMeta(responseData.meta);
				}
			} catch (err) {
				console.error("Error fetching history", err);
			} finally {
				setLoading(false);
			}
		};
		fetchHistory();
	}, [meta.current_page]);

	const handleNext = () => {
		if (meta.has_next_page) {
			setMeta((prev) => ({ ...prev, current_page: prev.current_page + 1 }));
		}
	};

	const handlePrev = () => {
		if (meta.current_page > 1) {
			setMeta((prev) => ({ ...prev, current_page: prev.current_page - 1 }));
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="bg-white/80 backdrop-blur-md border border-white/60 rounded-3xl shadow-sm overflow-hidden"
		>
			<div className="p-6 border-b border-gray-100 flex justify-between items-center">
				<h3 className="font-bold text-lg">Booking History</h3>
				<span className="text-xs text-gray-500 font-mono">
					Page {meta.current_page} of {meta.total_pages}
				</span>
			</div>

			<div className="overflow-x-auto min-h-[300px]">
				{loading ? (
					<div className="flex items-center justify-center h-48 text-gray-400">
						Loading history...
					</div>
				) : history.length === 0 ? (
					<div className="flex items-center justify-center h-48 text-gray-400">
						No past bookings found.
					</div>
				) : (
					<table className="w-full text-left">
						<thead className="bg-gray-50/50 text-gray-500 text-sm">
							<tr>
								<th className="p-4 font-medium">Service</th>
								<th className="p-4 font-medium">Date</th>
								<th className="p-4 font-medium">Price</th>
								<th className="p-4 font-medium">Status</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{history.map((item) => (
								<tr
									key={item.booking_id}
									className="hover:bg-gray-50/50 transition-colors"
								>
									<td className="p-4 font-medium text-gray-800">
										{item.service_name || "Service"}
									</td>
									<td className="p-4 text-gray-500 text-sm">
										{new Date(item.date).toLocaleDateString()}
									</td>
									<td className="p-4 text-gray-700 font-medium">
										${item.price}
									</td>
									<td className="p-4">
										<span
											className={`px-2 py-1 rounded-md text-xs font-bold border ${
												item.status === "completed"
													? "bg-green-50 text-green-700 border-green-200"
													: item.status === "cancelled"
													? "bg-red-50 text-red-700 border-red-200"
													: "bg-gray-50 text-gray-700"
											}`}
										>
											{item.status}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			{/* Pagination Footer */}
			<div className="p-4 border-t border-gray-100 flex justify-end gap-2">
				<button
					onClick={handlePrev}
					disabled={meta.current_page === 1 || loading}
					className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Previous
				</button>
				<button
					onClick={handleNext}
					disabled={!meta.has_next_page || loading}
					className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Next
				</button>
			</div>
		</motion.div>
	);
}

function SettingsTab() {
	return (
		<div className="flex flex-col items-center justify-center h-64 bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 text-gray-400">
			<Settings size={48} className="mb-4 opacity-20" />
			<p>Profile settings coming soon...</p>
		</div>
	);
}

// --- Helper Components ---

const SidebarItem = ({ icon, label, active, onClick }) => (
	<button
		onClick={onClick}
		className={`cursor-pointer w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
			active
				? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
				: "text-gray-600 hover:bg-violet-50 hover:text-violet-700"
		}`}
	>
		<div className={`${active ? "" : "opacity-70 group-hover:opacity-100"}`}>
			{icon}
		</div>
		<span className="font-medium">{label}</span>
		{active && (
			<div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
		)}
	</button>
);

const StatCard = ({ label, value, color }) => (
	<div
		className={`p-4 rounded-2xl ${color} bg-opacity-20 border border-opacity-10 flex flex-col gap-1`}
	>
		<span className="text-xs opacity-80 font-medium uppercase tracking-wider">
			{label}
		</span>
		<span className="text-2xl font-bold">{value}</span>
	</div>
);

const DashboardIcon = () => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<rect width="7" height="9" x="3" y="3" rx="1" />
		<rect width="7" height="5" x="14" y="3" rx="1" />
		<rect width="7" height="9" x="14" y="12" rx="1" />
		<rect width="7" height="5" x="3" y="16" rx="1" />
	</svg>
);
const HistoryIcon = () => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M3 3v5h5" />
		<path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
		<path d="M12 7v5l4 2" />
	</svg>
);
const SettingsIcon = () => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
		<circle cx="12" cy="12" r="3" />
	</svg>
);
