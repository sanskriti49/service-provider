import axios from "axios";
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	User,
	Briefcase,
	ArrowRight,
	Sparkles,
	ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ChooseRole = () => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (!token) return navigate("/login");

		try {
			const decoded = jwtDecode(token);
			if (decoded.role) {
				navigate(
					decoded.role === "customer" ? "/dashboard" : "/provider/dashboard",
				);
			}
		} catch {
			localStorage.removeItem("token");
			navigate("/login");
		}
	}, [navigate]);

	const setRole = async (role) => {
		try {
			setLoading(true);
			const token = localStorage.getItem("token");

			const res = await axios.post(
				"/api/auth/set-role",
				{ role },
				{ headers: { Authorization: `Bearer ${token}` } },
			);

			if (res.data.token) {
				localStorage.setItem("token", res.data.token);
			}

			navigate(role === "customer" ? "/dashboard" : "/provider/dashboard");
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="bricolage-grotesque min-h-screen bg-[#0f0c29]/5 text-white flex items-center justify-center px-4 relative overflow-hidden">
			<motion.div
				initial={{ opacity: 0, y: 30 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.6, ease: "easeOut" }}
				className="relative z-10 w-full max-w-xl text-center"
			>
				{/* Header Section */}
				<div className="mb-12">
					<motion.div
						initial={{ scale: 0.8, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ delay: 0.2 }}
						className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/20 text-violet-600 text-xs font-bold uppercase tracking-widest mb-6"
					>
						<ShieldCheck size={14} /> Account Setup
					</motion.div>

					<h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-b from-purple-600 to-pink-700/70 bg-clip-text text-transparent">
						Choose Your Path
					</h1>
					<p className="text-purple-800/60 text-lg">
						Select how you would like to interact with our ecosystem.
					</p>
				</div>

				{/* Role Cards */}
				<div className="grid grid-cols-1 gap-5">
					{/* Customer Option */}
					<motion.button
						whileHover={{ scale: 1.02, y: -4 }}
						whileTap={{ scale: 0.98 }}
						onClick={() => !loading && setRole("customer")}
						className="group cursor-pointer relative w-full flex items-center justify-between p-6 rounded-3xl bg-white border border-violet-100 shadow-sm hover:shadow-xl hover:shadow-violet-200/50 hover:border-sky-500/40 transition-all duration-300"
					>
						<div className="flex items-center gap-5">
							<div className="p-4 bg-sky-500/10 text-sky-500 rounded-2xl group-hover:bg-sky-500 group-hover:text-white transition-colors duration-300">
								<User className="w-7 h-7" />
							</div>
							<div className="text-left">
								<h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
									Customer
									<Sparkles
										size={16}
										className="text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity"
									/>
								</h3>
								<p className="text-sm text-gray-500 group-hover:text-gray-600 transition-colors">
									Discover and book verified local services
								</p>
							</div>
						</div>
						<ArrowRight className="text-gray-300 group-hover:text-sky-500 group-hover:translate-x-1 transition-all" />
					</motion.button>

					{/* Provider Option */}
					<motion.button
						whileHover={{ scale: 1.02, y: -4 }}
						whileTap={{ scale: 0.98 }}
						onClick={() => !loading && setRole("provider")}
						className="group cursor-pointer relative w-full flex items-center justify-between p-6 rounded-3xl bg-white border border-violet-100 shadow-sm hover:shadow-xl hover:shadow-violet-200/50 hover:border-emerald-500/40 transition-all duration-300"
					>
						<div className="flex items-center gap-5">
							<div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
								<Briefcase className="w-7 h-7" />
							</div>
							<div className="text-left">
								<h3 className="text-xl font-bold text-gray-900 mb-1">
									Service Provider
								</h3>
								<p className="text-sm text-gray-500 group-hover:text-gray-600 transition-colors">
									Manage bookings and grow your business
								</p>
							</div>
						</div>
						<ArrowRight className="text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
					</motion.button>
				</div>

				{/* Loading State Overlay */}
				<AnimatePresence>
					{loading && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="mt-10 flex flex-col items-center gap-4"
						>
							<div className="relative">
								<div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-600 rounded-full animate-spin"></div>
								<div className="absolute inset-0 blur-lg bg-violet-500/10 animate-pulse"></div>
							</div>
							<p className="text-violet-600/80 text-sm font-medium tracking-wide">
								Personalizing your dashboard...
							</p>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Footer Note */}
				<p className="mt-12 text-gray-400 text-xs">
					You can switch your primary role later in settings.
				</p>
			</motion.div>
		</div>
	);
};

export default ChooseRole;
