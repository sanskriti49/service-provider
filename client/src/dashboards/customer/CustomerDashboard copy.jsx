import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, Outlet, NavLink, useNavigate } from "react-router-dom";
import {
	Zap,
	LayoutDashboard,
	History,
	Settings as SettingsIcon,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";

export default function CustomerDashboard() {
	const navigate = useNavigate();
	const [user, setUser] = useState({ name: "Guest" });

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (token) {
			try {
				const decoded = jwtDecode(token);
				setUser(decoded);
			} catch (e) {
				navigate("/login");
			}
		} else {
			navigate("/login");
		}
	}, [navigate]);

	return (
		<div className="pt-32 bricolage-grotesque min-h-screen relative bg-gray-50/50 pb-12 px-4 sm:px-8">
			<div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
				{/* --- LEFT SIDEBAR --- */}
				<motion.aside
					initial={{ x: -20, opacity: 0 }}
					animate={{ x: 0, opacity: 1 }}
					transition={{ duration: 0.4 }}
					className="lg:h-fit sticky top-24"
				>
					<div className="bg-white/80 backdrop-blur-xl border border-white/60 shadow-xl shadow-gray-200/50 rounded-3xl p-6 flex flex-col gap-6">
						{/* User Profile Snippet */}
						<div className="flex items-center gap-4 pb-6 border-b border-gray-100">
							<div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-violet-500/30 overflow-hidden ring-2 ring-white">
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
							<div className="overflow-hidden">
								<h3 className="font-bold text-gray-800 truncate">
									{user.name}
								</h3>
								<p className="text-xs text-gray-500 font-medium truncate">
									{user.custom_id || "Standard Plan"}
								</p>
							</div>
						</div>

						<nav className="flex flex-col gap-2">
							<SidebarLink
								to="/dashboard"
								end
								icon={<LayoutDashboard size={20} />}
								label="Overview"
							/>
							<SidebarLink
								to="/dashboard/bookings"
								icon={<History size={20} />}
								label="My Bookings"
							/>
							<SidebarLink
								to="/settings"
								icon={<SettingsIcon size={20} />}
								label="Settings"
							/>
						</nav>

						{/* Support Widget */}
						<div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-5 text-white mt-4 shadow-lg shadow-indigo-500/20 relative overflow-hidden group">
							<div className="absolute top-0 right-0 p-3 opacity-20 transform group-hover:scale-110 transition-transform duration-500">
								<Zap size={60} />
							</div>
							<h4 className="font-bold relative z-10">Need Help?</h4>
							<p className="text-violet-100 text-sm mt-1 mb-3 relative z-10">
								Contact our 24/7 support team.
							</p>
							<Link
								to="/#contact"
								className="inline-block text-xs bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/30 hover:bg-white/30 transition-colors"
							>
								Contact Support
							</Link>
						</div>
					</div>
				</motion.aside>

				{/* --- MAIN CONTENT AREA --- */}
				<main className="min-w-0">
					{/* This Outlet is where the Router injects:
                1. DashboardOverview (at /dashboard)
                2. AllBookings (at /dashboard/bookings)
                3. SettingsPage (at /dashboard/settings)
                
                We pass the 'user' object down so children don't have to decode it again.
             */}
					<Outlet context={{ user }} />
				</main>
			</div>
		</div>
	);
}

function SidebarLink({ to, icon, label, end = false }) {
	return (
		<NavLink
			to={to}
			end={end}
			className={({ isActive }) =>
				`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
					isActive
						? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
						: "text-gray-600 hover:bg-violet-50 hover:text-violet-700"
				}`
			}
		>
			{({ isActive }) => (
				<>
					<div className={isActive ? "" : "opacity-70 group-hover:opacity-100"}>
						{icon}
					</div>
					<span className="font-medium">{label}</span>
				</>
			)}
		</NavLink>
	);
}
