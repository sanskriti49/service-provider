import axios from "axios";
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Briefcase } from "lucide-react";
import { motion } from "framer-motion";

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
					decoded.role === "customer" ? "/dashboard" : "/provider/dashboard"
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
				{ headers: { Authorization: `Bearer ${token}` } }
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
		<div className="-mt-50 bricolage-grotesque min-h-screen flex items-center justify-center px-4">
			<motion.div
				initial={{ opacity: 0, scale: 0.9, y: 20 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				transition={{ duration: 0.4 }}
				className="backdrop-blur-xl border border-white/30 p-10 rounded-3xl shadow-2xl w-full max-w-lg text-center"
			>
				<h1 className="text-4xl font-extrabold mb-3 bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent">
					Choose Your Role
				</h1>
				<p className="text-gray-600 mb-10">
					How would you like to use our platform?
				</p>

				<div className="grid grid-cols-1 gap-6">
					<motion.button
						whileHover={{ scale: 1.03 }}
						whileTap={{ scale: 0.97 }}
						onClick={() => setRole("customer")}
						className="cursor-pointer w-full flex items-center justify-between px-6 py-5 
						rounded-2xl shadow-md hover:shadow-xl transition-all border border-gray-200"
					>
						<div className="flex items-center gap-4">
							<div className="p-3 bg-blue-600 text-white rounded-xl shadow">
								<User className="w-6 h-6" />
							</div>
							<div className="text-left">
								<p className="text-lg font-semibold">Customer</p>
								<p className="text-sm text-gray-500">Find and book services</p>
							</div>
						</div>
						<span className="text-blue-600 text-xl">→</span>
					</motion.button>

					<motion.button
						whileHover={{ scale: 1.03 }}
						whileTap={{ scale: 0.97 }}
						onClick={() => setRole("provider")}
						className="cursor-pointer w-full flex items-center justify-between px-6 py-5 
						rounded-2xl shadow-md hover:shadow-xl transition-all border border-gray-200"
					>
						<div className="flex items-center gap-4">
							<div className="p-3 bg-purple-600 text-white rounded-xl shadow">
								<Briefcase className="w-6 h-6" />
							</div>
							<div className="text-left">
								<p className="text-lg font-semibold">Service Provider</p>
								<p className="text-sm text-gray-500">Offer your services</p>
							</div>
						</div>
						<span className="text-purple-600 text-xl">→</span>
					</motion.button>
				</div>

				{loading && (
					<div className="mt-8 flex items-center justify-center gap-2 text-gray-700">
						<div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
						Updating your profile...
					</div>
				)}
			</motion.div>
		</div>
	);
};

export default ChooseRole;
