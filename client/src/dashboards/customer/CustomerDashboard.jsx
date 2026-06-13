import { motion } from "framer-motion";
import { Link, Outlet, NavLink } from "react-router-dom";
import {
	Zap,
	LayoutDashboard,
	History,
	Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export default function CustomerDashboard() {
	const { user } = useAuth();

	return (
		<div className="pt-28 sm:pt-32 bricolage-grotesque min-h-screen bg-slate-50/50 pb-12 px-4 sm:px-8 font-sans">
			<div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 items-start">
				<motion.aside
					initial={{ y: 10, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ duration: 0.3 }}
					className="lg:sticky lg:top-28 w-full"
				>
					<div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col gap-5">
						<div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
							<div className="flex items-center gap-4 pb-6 border-b border-gray-100">
								<div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-violet-500/30 overflow-hidden ring-2 ring-white">
									{user?.photo ? (
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
										{user?.name || "Guest"}
									</h3>
									<p className="text-xs text-gray-500 font-medium truncate">
										{user?.custom_id || "Standard Plan"}
									</p>
								</div>
							</div>
						</div>

						<nav className="flex flex-col gap-1">
							<SidebarLink
								to="/dashboard"
								end
								icon={<LayoutDashboard size={18} />}
								label="Overview"
							/>
							<SidebarLink
								to="/account/profile"
								icon={<History size={18} />}
								label="Profile"
							/>
							<SidebarLink
								to="/dashboard/bookings"
								icon={<History size={18} />}
								label="My Bookings"
							/>
							<SidebarLink
								to="/account/settings"
								icon={<SettingsIcon size={18} />}
								label="Settings"
							/>
						</nav>

						<div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-5 text-white mt-4 shadow-lg shadow-indigo-500/20 relative overflow-hidden group">
							<div className="absolute top-0 right-0 p-3 opacity-20 transform group-hover:scale-110 transition-transform duration-500">
								<Zap size={60} />
							</div>
							<h4 className="font-bold relative z-10">Need Help?</h4>
							<p className="text-violet-100 text-sm mt-1 mb-3 relative z-10">
								Contact our 24/7 support team.
							</p>
							<Link
								to="/help"
								className="inline-block text-xs bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/30 hover:bg-white/30 transition-colors"
							>
								Contact Support
							</Link>
						</div>
					</div>
				</motion.aside>

				<main className="min-w-0 w-full">
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
				`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-md font-semibold group ${
					isActive
						? "bg-violet-600 text-white shadow-sm shadow-violet-600/10"
						: "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
				}`
			}
		>
			{({ isActive }) => (
				<>
					<div
						className={
							isActive
								? "text-white"
								: "text-slate-400 group-hover:text-slate-600 transition-colors"
						}
					>
						{icon}
					</div>
					<span className="tracking-tight">{label}</span>
				</>
			)}
		</NavLink>
	);
}
