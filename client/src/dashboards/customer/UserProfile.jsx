import {
	Heart,
	Star,
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
	Sparkles,
	Sun,
	Moon,
	Zap,
	MessageSquare,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../../api/axiosInstance";

const SERIF_FONT = { fontFamily: "P22Mackinac, Cambria, sans-serif" };
const TEXT_MAIN = "text-[#281950]";
const TEXT_MUTED = "text-[#281950]/70";

const BentoCard = ({ children, className, delay = 0 }) => (
	<motion.div
		initial={{ opacity: 0, y: 20, scale: 0.95 }}
		animate={{ opacity: 1, y: 0, scale: 1 }}
		transition={{ duration: 0.5, delay, type: "spring", stiffness: 100 }}
		className={`bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl shadow-indigo-100/40 rounded-[2rem] overflow-hidden relative group ${className}`}
	>
		<div className="absolute inset-0 bg-gradient-to-br from-violet-50/30 to-transparent pointer-events-none" />
		{children}
	</motion.div>
);

const StatPill = ({ icon: Icon, label, value, color, delay }) => (
	<motion.div
		initial={{ opacity: 0, x: -10 }}
		animate={{ opacity: 1, x: 0 }}
		transition={{ delay }}
		className="flex items-center gap-3 p-3 pr-5 bg-white/40 border border-white/60 rounded-2xl cursor-default transition-all duration-300 hover:bg-white hover:shadow-md hover:border-white"
	>
		<div
			className={`p-3 rounded-2xl ${color
				.replace("500", "100")
				.replace("text-", "bg-")} ${color.replace("bg-", "text-")}`}
		>
			<Icon size={20} strokeWidth={2.5} />
		</div>
		<div>
			<p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
				{label}
			</p>
			<p className={`text-sm font-bold ${TEXT_MAIN}`}>{value}</p>
		</div>
	</motion.div>
);

const MenuItem = ({
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
        ${
					isDanger
						? "hover:bg-red-50 hover:border-red-100"
						: "hover:bg-white hover:shadow-md hover:shadow-violet-100/20 hover:border-white/50"
				}`}
	>
		<div className="flex items-center gap-4">
			<div
				className={`p-3 rounded-2xl transition-transform duration-300 ${
					isDanger ? "bg-red-50 text-red-500" : iconColorClass
				}`}
			>
				<Icon size={20} strokeWidth={2.5} />
			</div>

			<div className="text-left">
				<h4
					className={`font-bold text-[15px] ${
						isDanger ? "text-red-600" : TEXT_MAIN
					}`}
				>
					{title}
				</h4>
				<p
					className={`text-xs font-medium ${
						isDanger ? "text-red-400" : "text-gray-500"
					}`}
				>
					{desc}
				</p>
			</div>
		</div>

		<ChevronRight
			size={18}
			className={`transition-opacity duration-300 ${
				isDanger ? "text-red-400" : "text-violet-300"
			} 
            opacity-0 group-hover:opacity-100`}
		/>
	</motion.button>
);

export default function UserProfile() {
	const navigate = useNavigate();
	const [user, setUser] = useState(
		JSON.parse(localStorage.getItem("user") || "{}"),
	);

	console.log(user);
	const [greeting, setGreeting] = useState("");
	const [imageError, setImageError] = useState(false);

	useEffect(() => {
		const refreshUserData = async () => {
			try {
				const token = localStorage.getItem("token");
				if (!token) return;

				const res = await api.get("/api/auth/me");
				if (res.data.user) {
					console.log(res.data.user);
					setUser(res.data.user);
					localStorage.setItem("user", JSON.stringify(res.data.user));
				}
			} catch (err) {
				console.error("Failed to refresh user data:", err);
			}
		};
		refreshUserData();
	}, []);

	useEffect(() => {
		const hour = new Date().getHours();
		if (hour < 12) setGreeting("Good Morning");
		else if (hour < 18) setGreeting("Good Afternoon");
		else setGreeting("Good Evening");
	}, []);

	const getInitials = (name) => {
		if (!name) return "U";
		const parts = name.split(" ");
		return `${parts[0][0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
	};

	const handleLogout = () => {
		localStorage.removeItem("token");
		localStorage.removeItem("user");
		navigate("/login");
	};

	const formattedDate = user.created_at
		? new Date(user.created_at).getFullYear()
		: "2025";

	return (
		<div className="min-h-screen relative overflow-hidden bricolage-grotesque mt-20 pb-20">
			<div className="fixed inset-0 pointer-events-none overflow-hidden">
				<div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-200/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4"></div>
				<div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-fuchsia-200/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4"></div>
				<div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light" />
			</div>

			<div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 md:pt-12">
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					className="relative-30 flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8"
				>
					<div>
						<div className="flex items-center gap-2 text-violet-700 font-bold text-sm tracking-wide uppercase mb-1">
							{greeting.includes("Morning") ? (
								<Sun size={14} />
							) : (
								<Moon size={14} />
							)}
							<span>{greeting}</span>
						</div>
						<h1
							className={`text-4xl md:text-5xl font-medium ${TEXT_MAIN} tracking-tight`}
							style={SERIF_FONT}
						>
							{user.name?.split(" ")[0] || "Friend"}
							<span className="text-violet-500">.</span>
						</h1>
					</div>

					<div className="cursor-pointer flex gap-3">
						<button
							onClick={() => navigate("/settings")}
							className={`cursor-pointer h-12 px-6 rounded-2xl bg-white/80 backdrop-blur-md border border-gray-200 ${TEXT_MAIN} font-bold hover:bg-white hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/50 transition-all flex items-center gap-2`}
						>
							<Settings size={18} />
							<span>Settings</span>
						</button>
					</div>
				</motion.div>

				<div className="grid grid-cols-1 md:grid-cols-12 gap-6">
					<div className="md:col-span-8 flex flex-col gap-6">
						<BentoCard className="p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
							<div className="relative shrink-0 group">
								<div className="absolute -inset-4 bg-gradient-to-tr from-violet-500 to-fuchsia-500 opacity-20 blur-xl rounded-full group-hover:opacity-30 transition-opacity" />
								<div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden relative z-10 bg-white">
									{user.photo && !imageError ? (
										<img
											src={user.photo}
											alt="Profile"
											className="w-full h-full object-cover"
											onError={() => setImageError(true)}
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white text-4xl font-bold">
											{getInitials(user.name || user.email)}
										</div>
									)}
								</div>
								<button className="cursor-pointer absolute bottom-0 right-0 z-20 bg-[#281950] text-white p-2 rounded-full border-4 border-white shadow-lg hover:scale-110 transition-transform">
									<Camera size={14} />
								</button>
							</div>

							<div className="flex-1 text-center md:text-left space-y-3">
								<div>
									<div className="flex items-center justify-center md:justify-start gap-2 mb-1">
										<h2 className={`text-2xl font-bold ${TEXT_MAIN}`}>
											{user.custom_id || "taskgenie_user"}
										</h2>
										<Shield size={16} className="text-blue-500 fill-blue-500" />
									</div>
									<div className="flex items-center justify-center md:justify-start gap-1.5 text-gray-500 text-sm font-medium">
										<MapPin size={14} />
										{user.location || "India"}
										<span className="w-1 h-1 bg-gray-300 rounded-full mx-1" />
										<span>Joined {formattedDate}</span>
									</div>
								</div>

								<div className="flex flex-wrap justify-center md:justify-start gap-3">
									<div className="px-4 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-wider border border-amber-100 flex items-center gap-1.5">
										<Star size={12} className="fill-current" /> Gold Member
									</div>
									<div className="px-4 py-1.5 rounded-full bg-violet-50 text-violet-800 text-xs font-bold uppercase tracking-wider border border-violet-100">
										Verified
									</div>
								</div>
							</div>
							<button className="cursor-pointer absolute top-6 right-6 text-gray-400 hover:text-[#281950] transition-colors">
								<Edit3 size={18} />
							</button>
						</BentoCard>

						{/* Stats Row */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<StatPill
								icon={Clock}
								label="Bookings"
								value="12"
								color="bg-blue-500 text-blue-600"
								delay={0.1}
							/>
							<StatPill
								icon={Wallet}
								label="Spent"
								value="₹4.2k"
								color="bg-emerald-500 text-emerald-600"
								delay={0.2}
							/>
							<StatPill
								icon={Star}
								label="Rating"
								value="4.8"
								color="bg-amber-500 text-amber-600"
								delay={0.3}
							/>
							<StatPill
								icon={Heart}
								label="Loved"
								value="5"
								color="bg-rose-500 text-rose-600"
								delay={0.4}
							/>
						</div>
					</div>

					{/* Premium Card */}
					<div className="md:col-span-4 h-full">
						<BentoCard
							delay={0.2}
							className="h-full bg-[#281950] text-white border-0 flex flex-col justify-between overflow-hidden relative"
						>
							<div className="absolute top-0 right-0 w-64 h-64 bg-violet-600 rounded-full blur-[80px] opacity-40 translate-x-1/3 -translate-y-1/3" />
							<div className="absolute bottom-0 left-0 w-48 h-48 bg-fuchsia-600 rounded-full blur-[60px] opacity-30 -translate-x-1/3 translate-y-1/3" />
							<div className="p-8 relative z-10 flex flex-col h-full justify-center">
								<div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 mb-6">
									<Zap className="text-yellow-300 fill-yellow-300" size={24} />
								</div>
								<h3
									className="text-violet-900 text-2xl font-bold mb-2"
									style={SERIF_FONT}
								>
									Upgrade to Genie+
								</h3>
								<p className="text-violet-800 text-sm leading-relaxed mb-6">
									Unlock priority support, 0% service fees, and exclusive
									premium themes.
								</p>
								<button className="cursor-pointer w-full py-3 bg-white text-[#281950] rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-white/10 mt-auto">
									Try Free Trial
								</button>
							</div>
						</BentoCard>
					</div>

					{/* Menu Grid */}
					<div className="md:col-span-12 grid md:grid-cols-3 gap-6 mt-2">
						<BentoCard delay={0.3} className="p-5">
							<h3 className="text-xs font-black uppercase tracking-widest mb-4 pl-2 text-gray-400">
								Account
							</h3>
							<div className="space-y-1">
								<MenuItem
									icon={Wallet}
									title="Payments"
									desc="Cards & Wallets"
									iconColorClass="bg-emerald-100 text-emerald-700"
								/>
								<MenuItem
									icon={MapPin}
									title="Locations"
									desc="Manage addresses"
									iconColorClass="bg-blue-100 text-blue-700"
								/>
								<MenuItem
									icon={Bell}
									title="Notifications"
									desc="Preferences"
									iconColorClass="bg-orange-100 text-orange-700"
								/>
							</div>
						</BentoCard>

						<BentoCard delay={0.4} className="p-5">
							<h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 pl-2">
								Community
							</h3>
							<div className="space-y-1">
								<MenuItem
									icon={Share2}
									title="Refer Friends"
									desc="Earn ₹100 rewards"
									iconColorClass="bg-violet-100 text-violet-700"
								/>
								<MenuItem
									icon={HelpCircle}
									title="Support"
									desc="24/7 Live Chat"
									iconColorClass="bg-indigo-100 text-indigo-700"
								/>
								<MenuItem
									icon={MessageSquare}
									title="Feedback"
									desc="Share your thoughts"
									iconColorClass="bg-amber-100 text-amber-700"
								/>
							</div>
						</BentoCard>

						<BentoCard
							delay={0.5}
							className="p-5 flex flex-col justify-between"
						>
							<div>
								<h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 pl-2">
									Session
								</h3>
								<div className="space-y-1">
									<MenuItem
										icon={LogOut}
										title="Log Out"
										desc="Securely end session"
										isDanger={true}
										onClick={handleLogout}
									/>
								</div>
							</div>
							<div className="text-center pt-4">
								<p className="text-[10px] text-gray-300 font-mono">
									v2.4.0 • Build 8821
								</p>
							</div>
						</BentoCard>
					</div>
				</div>
			</div>
		</div>
	);
}
