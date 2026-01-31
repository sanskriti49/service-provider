import {
	Clock,
	MapPin,
	Wallet,
	ChevronRight,
	Share2,
	Settings,
	Shield,
	Bell,
	LogOut,
	HelpCircle,
	Edit3,
	Camera,
	Sun,
	Moon,
	Zap,
	MessageSquare,
	Star,
	ZapIcon,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../../api/axiosInstance";

const SERIF_FONT = { fontFamily: "P22Mackinac, Cambria, sans-serif" };
const TEXT_MAIN = "text-[#281950]";

const BentoCard = ({ children, className, delay = 0 }) => (
	<motion.div
		initial={{ opacity: 0, y: 20, scale: 0.98 }}
		animate={{ opacity: 1, y: 0, scale: 1 }}
		transition={{ duration: 0.5, delay, type: "spring", stiffness: 80 }}
		className={`bg-violet-100/60 backdrop-blur-xl border border-white/60 shadow-2xl shadow-indigo-300/30 rounded-[2.5rem] overflow-hidden relative group ${className}`}
		style={{ transformZ: 0, backfaceVisibility: "hidden" }}
	>
		<div className="absolute inset-0 bg-gradient-to-br from-violet-100/50 via-transparent to-violet-100/20 pointer-events-none" />
		{children}
	</motion.div>
);

const StatPill = ({ icon: Icon, label, value, color, delay }) => {
	const colorMap = {
		blue: "bg-blue-50 text-blue-600 border-blue-100",
		emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
		amber: "bg-amber-50 text-amber-600 border-amber-100",
		rose: "bg-rose-50 text-rose-600 border-rose-100",
	};
	const activeColor = colorMap[color] || colorMap.blue;

	return (
		<motion.div
			initial={{ opacity: 0, x: -10 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ delay }}
			className="flex items-center gap-3 p-3 pr-5 bg-white/50 border border-white rounded-2xl cursor-default transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-lg"
		>
			<div className={`p-3 rounded-2xl ${activeColor}`}>
				<Icon size={20} strokeWidth={2.5} />
			</div>
			<div>
				<p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
					{label}
				</p>
				<p className={`text-sm font-bold ${TEXT_MAIN}`}>{value}</p>
			</div>
		</motion.div>
	);
};

const CustomMenuItem = ({
	icon: Icon,
	title,
	desc,
	onClick,
	iconColorClass,
	isDanger = false,
	delay,
}) => (
	<motion.button
		initial={{ opacity: 0, x: -10 }}
		animate={{ opacity: 1, x: 0 }}
		transition={{ delay }}
		onClick={onClick}
		className={`cursor-pointer w-full group flex items-center justify-between p-3 rounded-2xl transition-all duration-200 border border-transparent
        ${isDanger ? "hover:bg-red-50 hover:border-red-100" : "hover:bg-white hover:shadow-md hover:shadow-violet-100/20 hover:border-white/50"}`}
	>
		<div className="flex items-center gap-4">
			<div
				className={`p-3 rounded-2xl transition-transform duration-300 ${isDanger ? "bg-red-50 text-red-500" : iconColorClass}`}
			>
				<Icon size={20} strokeWidth={2.5} />
			</div>
			<div className="text-left">
				<h4
					className={`font-bold text-[15px] ${isDanger ? "text-red-600" : TEXT_MAIN}`}
				>
					{title}
				</h4>
				<p
					className={`text-xs font-medium ${isDanger ? "text-red-400" : "text-gray-500"}`}
				>
					{desc}
				</p>
			</div>
		</div>
		<ChevronRight
			size={18}
			className={`transition-opacity duration-300 ${isDanger ? "text-red-400" : "text-violet-300"} opacity-0 group-hover:opacity-100`}
		/>
	</motion.button>
);

// --- Main Component ---

export default function UserProfile() {
	const navigate = useNavigate();
	const [user, setUser] = useState(() =>
		JSON.parse(localStorage.getItem("user") || "{}"),
	);
	const [stats, setStats] = useState({
		bookings: 0,
		spent: 0,
		rating: 0,
		recents: 0,
	});
	const [imageError, setImageError] = useState(false);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const [userRes, statsRes] = await Promise.all([
					api.get("/api/auth/me"),
					api.get("/api/user/stats"),
				]);
				if (userRes.data.user) {
					setUser(userRes.data.user);
					localStorage.setItem("user", JSON.stringify(userRes.data.user));
				}
				if (statsRes.data) setStats(statsRes.data);
			} catch (err) {
				console.error("Fetch error:", err);
			}
		};
		fetchData();
	}, []);

	const greeting = useMemo(() => {
		const hour = new Date().getHours();
		if (hour < 12) return "Good Morning";
		if (hour < 18) return "Good Afternoon";
		return "Good Evening";
	}, []);

	const handleLogout = useCallback(() => {
		localStorage.clear();
		navigate("/login");
	}, [navigate]);

	return (
		<div className="min-h-screen relative overflow-hidden bricolage-grotesque mt-20 pb-20">
			{/* Optimized Background */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
				<div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-300/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
				<div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-fuchsia-300/20 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/4" />
				<div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay" />
			</div>

			<div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 md:pt-12">
				<header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
					<motion.div
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
					>
						<div className="flex items-center gap-2 text-violet-600 font-bold text-xs tracking-widest uppercase mb-2">
							{greeting.includes("Morning") ? (
								<Sun size={14} className="text-orange-400" />
							) : (
								<Moon size={14} className="text-indigo-400" />
							)}
							<span>{greeting}</span>
						</div>
						<h1
							className={`text-5xl md:text-6xl font-medium ${TEXT_MAIN} tracking-tight`}
							style={SERIF_FONT}
						>
							{user.name?.split(" ")[0] || "Friend"}
							<span className="text-violet-500">.</span>
						</h1>
					</motion.div>

					<button
						onClick={() => navigate("/settings")}
						className="group h-12 px-6 rounded-2xl bg-violet-100/20 border border-white hover:bg-white/20 hover:shadow-xl hover:shadow-violet-200/50 transition-all flex items-center gap-2 font-bold text-[#281950]"
					>
						<Settings
							size={18}
							className="group-hover:rotate-90 transition-transform duration-500"
						/>
						Settings
					</button>
				</header>

				<div className="grid grid-cols-1 md:grid-cols-12 gap-8">
					<div className="md:col-span-8 flex flex-col gap-8">
						<BentoCard className="p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-10">
							<div className="relative shrink-0">
								<div className="absolute -inset-6 bg-gradient-to-tr from-violet-400 to-fuchsia-400 opacity-20 blur-2xl rounded-full" />
								<div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-[6px] border-white shadow-2xl overflow-hidden relative z-10 bg-white">
									{user.photo && !imageError ? (
										<img
											src={user.photo}
											className="w-full h-full object-cover"
											onError={() => setImageError(true)}
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white text-5xl font-bold">
											{user.name?.[0] || "U"}
										</div>
									)}
								</div>
								<button className="cursor-pointer absolute bottom-2 right-2 z-20 bg-[#281950] text-white p-2.5 rounded-full border-4 border-white shadow-xl hover:scale-110 transition-transform">
									<Camera size={16} />
								</button>
							</div>

							<div className="flex-1 space-y-6 text-center md:text-left">
								<div>
									<div className="flex items-center justify-center md:justify-start gap-3 mb-2">
										<h2 className={`text-3xl font-bold ${TEXT_MAIN}`}>
											{user.custom_id || "Genie_User"}
										</h2>
										<Shield
											size={20}
											className="text-blue-500 fill-blue-500/20"
										/>
									</div>
									<div className="flex items-center justify-center md:justify-start gap-3 text-gray-500 font-medium text-sm">
										<MapPin size={16} className="text-violet-400" />{" "}
										{user.location || "India"}
										<span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
										<span>
											Joined{" "}
											{user.created_at
												? new Date(user.created_at).getFullYear()
												: "2025"}
										</span>
									</div>
								</div>
								<div className="flex flex-wrap justify-center md:justify-start gap-3">
									<div className="px-4 py-2 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest border border-amber-200/50 flex items-center gap-2">
										<Star size={12} className="fill-amber-400 text-amber-400" />{" "}
										Gold Member
									</div>
									<div className="px-4 py-2 rounded-full bg-violet-50 text-violet-700 text-[10px] font-black uppercase tracking-widest border border-violet-200/50">
										Verified Pro
									</div>
								</div>
							</div>
						</BentoCard>

						{/* Stats */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<StatPill
								icon={Clock}
								label="Bookings"
								value={stats.bookings}
								color="blue"
								delay={0.1}
							/>
							<StatPill
								icon={Wallet}
								label="Spent"
								value={`₹${stats.spent}`}
								color="emerald"
								delay={0.2}
							/>
							<StatPill
								icon={Star}
								label="Rating"
								value={stats.rating || "N/A"}
								color="amber"
								delay={0.3}
							/>
							<StatPill
								icon={ZapIcon}
								label="Recents"
								value={stats.recents}
								color="rose"
								delay={0.4}
							/>
						</div>
					</div>

					<div className="md:col-span-4 h-full">
						<BentoCard className="h-full bg-[#281950] border-0 text-[#281950] p-10 flex flex-col justify-center gap-6">
							<div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/40 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
							<Zap
								size={40}
								className="text-yellow-400 fill-yellow-400 relative z-10"
							/>
							<div className="relative z-10">
								<h3 className="text-3xl font-bold mb-3" style={SERIF_FONT}>
									Upgrade to Genie+
								</h3>
								<p className="text-[#281950] text-sm leading-relaxed mb-8">
									Priority support and 0% service fees for your projects.
								</p>
								<button className="cursor-pointer w-full py-4 bg-violet-100/90 text-[#281950] rounded-2xl font-black hover:scale-[1.03] active:scale-95 transition-all shadow-2xl shadow-white/10">
									Try Free Trial
								</button>
							</div>
						</BentoCard>
					</div>

					<div className="md:col-span-12 grid md:grid-cols-3 gap-6 mt-2">
						<BentoCard delay={0.3} className="p-5">
							<h3 className="text-xs font-black uppercase tracking-widest mb-4 pl-2 text-gray-400">
								Account
							</h3>
							<div className="space-y-1">
								<CustomMenuItem
									icon={Wallet}
									title="Payments"
									desc="Cards & Wallets"
									iconColorClass="bg-emerald-100 text-emerald-700"
									delay={0.35}
								/>
								<CustomMenuItem
									icon={MapPin}
									title="Locations"
									desc="Manage addresses"
									iconColorClass="bg-blue-100 text-blue-700"
									delay={0.4}
								/>
								<CustomMenuItem
									icon={Bell}
									title="Notifications"
									desc="Preferences"
									iconColorClass="bg-orange-100 text-orange-700"
									delay={0.45}
								/>
							</div>
						</BentoCard>

						<BentoCard delay={0.4} className="p-5">
							<h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 pl-2">
								Community
							</h3>
							<div className="space-y-1">
								<CustomMenuItem
									icon={Share2}
									title="Refer Friends"
									desc="Earn ₹100 rewards"
									iconColorClass="bg-violet-100 text-violet-700"
									delay={0.45}
								/>
								<CustomMenuItem
									icon={HelpCircle}
									title="Support"
									desc="24/7 Live Chat"
									iconColorClass="bg-indigo-100 text-indigo-700"
									delay={0.5}
								/>
								<CustomMenuItem
									icon={MessageSquare}
									title="Feedback"
									desc="Share your thoughts"
									iconColorClass="bg-amber-100 text-amber-700"
									delay={0.55}
								/>
							</div>
						</BentoCard>

						<BentoCard
							delay={0.5}
							className="p-5 flex flex-col justify-between"
						>
							<div>
								<h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 pl-2 duration-200">
									Session
								</h3>
								<div className="space-y-1">
									<CustomMenuItem
										icon={LogOut}
										title="Log Out"
										desc="Securely end session"
										isDanger={true}
										onClick={handleLogout}
										delay={0.6}
									/>
								</div>
							</div>
							<div className="text-center pt-4">
								<p className="text-[10px] text-gray-400 font-mono">
									v1.0.0 • 2026
								</p>
							</div>
						</BentoCard>
					</div>
				</div>
			</div>
		</div>
	);
}
