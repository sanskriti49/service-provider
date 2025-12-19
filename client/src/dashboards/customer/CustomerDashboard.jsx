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

export default function CustomerDashboard() {
	const navigate = useNavigate();
	const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

	const [user, setUser] = useState({ name: "User" });
	const [activeTab, setActiveTab] = useState("overview");
	const [services, setServices] = useState([]);
	const [bookings, setBookings] = useState([]);
	const [upcoming, setUpcoming] = useState([]);
	const [showMoreUpcoming, setShowMoreUpcoming] = useState(false);

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
				const upcomingData = await upcomingRes.json();
				console.log(upcomingData);

				setUpcoming(upcomingData);
			} catch (err) {
				console.error(err);
			}
		};

		fetchBookings();
	}, []);

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
									// 2. Safe check: Use Optional Chaining (?.) to prevent crash
									<span>{user?.name?.[0]?.toUpperCase() || "U"}</span>
								)}
							</div>
							<div>
								{/* 3. Fallback to "Guest" if name is missing */}
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

						{/* Support Banner */}
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

				{/* --- RIGHT CONTENT AREA --- */}
				<main className="space-y-8">
					{/* Header */}
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

// --- SUB-COMPONENTS ---

function OverviewTab({
	totalServices,
	upcoming,
	showMoreUpcoming,
	setShowMoreUpcoming,
}) {
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
					value="1"
					color="bg-orange-50 text-orange-600"
				/>
				<StatCard
					label="Total Spent"
					value="$450"
					color="bg-green-50 text-green-600"
				/>
				<StatCard
					label="Reviews Given"
					value="5"
					color="bg-purple-50 text-purple-600"
				/>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
				{/* 2. Active Booking Card */}

				{/* UPCOMING SECTION */}
				<div className="bg-white/80 backdrop-blur-md border border-white/60 p-6 rounded-3xl shadow-sm">
					<div className="flex justify-between items-center mb-6">
						<h3 className="font-bold text-lg flex items-center gap-2">
							<Clock className="text-violet-500" size={20} /> Upcoming
						</h3>
					</div>

					{upcoming.length === 0 && (
						<p className="text-gray-500 text-sm">No upcoming bookings.</p>
					)}

					{upcoming.length > 0 && (
						<>
							{/* FIRST UPCOMING BOOKING */}
							<UpcomingCard booking={upcoming[0]} />

							{/* VIEW MORE BUTTON */}
							{upcoming.length > 1 && (
								<button
									onClick={() => setShowMoreUpcoming(!showMoreUpcoming)}
									className="cursor-pointer px-2 py-1 rounded-xl m-2 text-violet-600 hover:bg-violet-700 hover:text-white float-right transition duration-200"
								>
									{showMoreUpcoming ? "Hide" : "View more"}
								</button>
							)}

							{/* EXTRA UPCOMING LIST */}
							{showMoreUpcoming && (
								<div className="mt-4 space-y-3">
									{upcoming.slice(1).map((b) => (
										<UpcomingCard key={b.id} booking={b} />
									))}
								</div>
							)}
						</>
					)}
				</div>

				{/* 3. Quick Book Actions */}
				<div className="bg-white/80 backdrop-blur-md border border-white/60 p-6 rounded-3xl shadow-sm">
					<h3 className="font-bold text-lg mb-4 flex items-center gap-2">
						<Zap className="text-yellow-500" size={20} /> Quick Book
					</h3>
					<p className="text-sm text-gray-500 mb-6">
						Select a category to find a pro instantly.
					</p>

					<div className="grid grid-cols-2 gap-3">
						{QUICK_SERVICES.map((service) => (
							<Link
								key={service.slug}
								to={`/services/${service.slug}`} // Assuming your app routes handle category searches or details
								className="flex items-center gap-3 p-3 rounded-2xl border border-transparent hover:border-gray-200 hover:bg-white transition-all group"
							>
								<div
									className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${service.color} group-hover:scale-110 transition-transform`}
								>
									{service.icon}
								</div>
								<span className="font-medium text-gray-700">
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
function UpcomingCard({ booking }) {
	return (
		<div className="flex gap-4 bg-gray-50 p-4 rounded-2xl">
			<div className="flex-1">
				<h4 className="font-bold text-lg text-gray-800">
					{booking.service_name}
				</h4>
				<p className="text-gray-500 text-sm mb-3">
					Provider: {booking.provider?.name}
				</p>
				<div className="flex flex-wrap gap-3">
					<div className="flex items-center gap-1 text-xs text-gray-600 bg-white px-2 py-1 rounded-lg">
						<Calendar size={12} /> {new Date(booking.date).toLocaleString()}
					</div>
				</div>
			</div>
		</div>
	);
}

function BookingsTab() {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="bg-white/80 backdrop-blur-md border border-white/60 rounded-3xl shadow-sm overflow-hidden"
		>
			<div className="p-6 border-b border-gray-100 flex justify-between items-center">
				<h3 className="font-bold text-lg">Booking History</h3>
				<button className="cursor-pointer text-sm text-violet-600 font-medium hover:underline">
					Download Report
				</button>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-left">
					<thead className="bg-gray-50/50 text-gray-500 text-sm">
						<tr>
							<th className="p-4 font-medium">Service</th>
							<th className="p-4 font-medium">Date</th>
							<th className="p-4 font-medium">Price</th>
							<th className="p-4 font-medium">Status</th>
							<th className="p-4 font-medium">Action</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100">
						{MOCK_HISTORY.map((item) => (
							<tr
								key={item.id}
								className="hover:bg-gray-50/50 transition-colors"
							>
								<td className="p-4 font-medium text-gray-800">
									{item.service}
								</td>
								<td className="p-4 text-gray-500 text-sm">{item.date}</td>
								<td className="p-4 text-gray-700 font-medium">{item.price}</td>
								<td className="p-4">
									<span
										className={`px-2 py-1 rounded-md text-xs font-bold border ${
											item.status === "Completed"
												? "bg-green-50 text-green-700 border-green-200"
												: item.status === "Cancelled"
												? "bg-red-50 text-red-700 border-red-200"
												: "bg-gray-50 text-gray-700"
										}`}
									>
										{item.status}
									</span>
								</td>
								<td className="p-4">
									<button className="cursor-pointer text-sm text-gray-500 hover:text-violet-600 transition-colors">
										View
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
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

// --- Icons (Simple Wrappers) ---
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
