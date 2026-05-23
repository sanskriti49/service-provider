/**
 * dashboards/provider/ProviderServices.jsx
 *
 * Manage the services you offer to customers.
 * Dark theme matching your main layout.
 */
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
	Wrench,
	Plus,
	Briefcase,
	Sparkles,
	IndianRupee,
	Info,
	Eye,
	EyeOff,
	Loader2,
	SlidersHorizontal,
	Layers,
} from "lucide-react";
import api from "../../api/axiosInstance";
import { useAuth } from "../../hooks/useAuth";

export default function ProviderServices() {
	const { user } = useAuth(); // Read logged-in user profile details
	const [allMarketplaceServices, setAllMarketplaceServices] = useState([]);
	const [myServices, setMyServices] = useState([]);
	const [loading, setLoading] = useState(true);
	const [updatingId, setUpdatingId] = useState(null);
	const [activeTab, setActiveTab] = useState("active"); // "active" | "explore"

	// Edit Modal/Drawer states
	const [selectedService, setSelectedService] = useState(null);
	const [customPrice, setCustomPrice] = useState("");

	useEffect(() => {
		const fetchServices = async () => {
			try {
				setLoading(true);
				// 1. Fetch the master list of all services your app supports
				const res = await api.get("/api/services/v1");
				const servicesList = Array.isArray(res.data)
					? res.data
					: res.data?.data || [];
				setAllMarketplaceServices(servicesList);

				// 2. Set the provider's active services.
				// If your backend tracks setups separately, change this string to your real endpoint.
				setMyServices(user?.services || []);
			} catch (err) {
				console.error("Error fetching services:", err);
				toast.error("Failed to load service list");
			} finally {
				setLoading(false);
			}
		};
		fetchServices();
	}, [user]);

	// Services the provider HAS NOT signed up for yet
	const discoverableServices = useMemo(() => {
		const myServiceSlugs = myServices.map((s) => s.slug || s.id);
		return allMarketplaceServices.filter(
			(s) => !myServiceSlugs.includes(s.slug || s.id),
		);
	}, [myServices, allMarketplaceServices]);

	// Turn on a service or adjust price
	const handleSavePrice = async (e) => {
		e.preventDefault();
		if (!selectedService) return;

		// const serviceSlug = selectedService.slug || selectedService.id;
		const serviceSlug = selectedService.slug;
		const serviceId = selectedService.service_id || selectedService.id;
		const finalPrice = parseFloat(customPrice);

		if (isNaN(finalPrice) || finalPrice <= 0) {
			toast.error("Please enter a valid price");
			return;
		}
		let providerPhone = user?.phone || selectedService?.phone || "";

		// Clean formatting to ensure it matches: +91XXXXXXXXXX
		if (providerPhone) {
			providerPhone = providerPhone.trim();
			if (!providerPhone.startsWith("+91")) {
				providerPhone = `+91${providerPhone.replace(/\s+/g, "")}`;
			}
		} else {
			// Absolute fail-safe: if context has no phone number, alert provider to fill it
			toast.error(
				"Profile phone number not found. Please re-login or update your profile.",
			);
			return;
		}

		setUpdatingId(serviceSlug || serviceId);
		try {
			// await api.post(`/api/services/v1/`, {
			// 	slug: serviceSlug,
			// 	price: finalPrice,
			// });
			await api.put(`/api/providers/v1/${user.id}`, {
				phone: providerPhone,
				service: serviceSlug,
				service_id: serviceId,
				price: finalPrice,
			});

			const index = myServices.findIndex(
				(s) => s.slug === serviceSlug || s.id === serviceId,
			);
			if (index > -1) {
				const updated = [...myServices];
				updated[index].price = finalPrice;
				setMyServices(updated);
				toast.success("Price updated successfully");
			} else {
				setMyServices((prev) => [
					...prev,
					{ ...selectedService, price: finalPrice, is_visible: true },
				]);
				toast.success(`Added ${selectedService.name} to your services!`);
				setActiveTab("active");
			}
			setSelectedService(null);
		} catch (error) {
			console.error("Backend Validation Error Details:", error.response?.data);

			const backendErrorMessage =
				error.response?.data?.error || "Validation rejected input parameters.";
			toast.error(`Failed to save: ${backendErrorMessage}`);
		} finally {
			setUpdatingId(null);
		}
	};

	// Toggle pause/resume on service visibility
	const handleToggleVisibility = async (serviceItem) => {
		const serviceSlug = serviceItem.slug || serviceItem.id;
		const nextVisibility = !serviceItem.is_visible;
		setUpdatingId(serviceSlug);

		try {
			await api.put(`/api/services/provider/visibility`, {
				slug: serviceSlug,
				is_visible: nextVisibility,
			});

			setMyServices((prev) =>
				prev.map((s) =>
					(s.slug || s.id) === serviceSlug
						? { ...s, is_visible: nextVisibility }
						: s,
				),
			);

			toast.success(
				nextVisibility ? "Service is now public" : "Service is now paused",
			);
		} catch (err) {
			console.error("Error toggling visibility:", err);
			toast.error("Failed to update status");
		} finally {
			setUpdatingId(null);
		}
	};

	const openEditDrawer = (service) => {
		setSelectedService(service);
		setCustomPrice(service.price || "500");
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[350px] gap-4 text-slate-400">
				<Loader2 size={32} className="animate-spin text-violet-500" />
				<span className="text-sm font-medium">Loading services...</span>
			</div>
		);
	}

	return (
		<div className="space-y-8 relative bricolage-grotesque">
			{/* Header Area */}
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
				<div>
					<h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
						<Wrench className="text-violet-400" size={26} />
						My Services
					</h1>
					<p className="text-slate-400 text-sm mt-1 inter">
						Set up the jobs you can do, adjust your prices, or pause services
						temporarily.
					</p>
				</div>

				{/* Sub-tabs */}
				<div className="flex bg-slate-900/60 border border-white/5 p-1 rounded-xl shrink-0">
					<button
						onClick={() => setActiveTab("active")}
						className={`cursor-pointer px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 ${
							activeTab === "active"
								? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
								: "text-slate-400 hover:text-slate-200"
						}`}
					>
						<Layers size={13} />
						Active Services ({myServices.length})
					</button>
					<button
						onClick={() => setActiveTab("explore")}
						className={`cursor-pointer px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 ${
							activeTab === "explore"
								? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
								: "text-slate-400 hover:text-slate-200"
						}`}
					>
						<Sparkles size={13} />
						Add New Services ({discoverableServices.length})
					</button>
				</div>
			</div>

			{/* Main Tabs Area */}
			<AnimatePresence mode="wait">
				{activeTab === "active" ? (
					<motion.div
						key="active-list"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						className="space-y-3"
					>
						{myServices.length === 0 ? (
							<div className="flex flex-col items-center justify-center text-center p-12 border border-dashed border-white/10 bg-[#22194A]/10 rounded-2xl">
								<Briefcase size={36} className="text-slate-600 mb-4" />
								<p className="text-white font-bold text-lg">
									No active services setup yet
								</p>
								<p className="text-slate-400 text-xs mt-1 max-w-sm inter leading-relaxed">
									You won't show up in customer searches. Click on{" "}
									<strong>Add New Services</strong> tab above to get started.
								</p>
							</div>
						) : (
							/* Active Services Rows */
							<div className="border border-white/5 bg-[#191034]/40 rounded-2xl divide-y divide-white/5 overflow-hidden shadow-xl">
								{myServices.map((service) => (
									<div
										key={service.slug || service.id}
										className={`flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 bg-slate-900/40 hover:bg-[#22194A]/40 transition-colors group relative ${
											!service.is_visible ? "opacity-50" : ""
										}`}
									>
										<div className="absolute left-0 top-0 bottom-0 w-[3px] bg-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />

										{/* Image & Title Details */}
										<div className="flex gap-4 items-center min-w-0 md:w-1/2">
											<div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-white/10 relative">
												<img
													src={
														service.image_url || "/images/default-service.jpg"
													}
													alt=""
													className="w-full h-full object-cover opacity-60"
												/>
											</div>
											<div className="space-y-1 min-w-0">
												<div className="flex items-center gap-2.5 flex-wrap">
													<h3 className="text-md font-bold text-white tracking-tight truncate">
														{service.name}
													</h3>
													<span
														className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
															service.is_visible
																? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
																: "bg-slate-800 text-slate-400 border-white/5"
														}`}
													>
														{service.is_visible ? "Live" : "Paused"}
													</span>
												</div>
												<p className="text-xs text-slate-400 truncate inter pr-4">
													{service.description}
												</p>
											</div>
										</div>

										{/* Price block */}
										<div className="flex items-center gap-8 shrink-0 md:w-1/4">
											<div className="flex flex-col">
												<span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
													Your Rate
												</span>
												<span className="text-md font-extrabold font-mono text-emerald-400 flex items-center mt-0.5">
													₹{service.price}
												</span>
											</div>
										</div>

										{/* Row Action Buttons */}
										<div className="flex items-center gap-2 justify-end shrink-0 md:w-1/4">
											<button
												onClick={() => handleToggleVisibility(service)}
												disabled={updatingId === (service.slug || service.id)}
												className="p-2.5 cursor-pointer bg-slate-950/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5 rounded-xl transition-all"
												title={
													service.is_visible
														? "Pause service visibility"
														: "Resume service visibility"
												}
											>
												{updatingId === (service.slug || service.id) ? (
													<Loader2
														size={15}
														className="animate-spin text-violet-400"
													/>
												) : service.is_visible ? (
													<Eye size={15} />
												) : (
													<EyeOff size={15} />
												)}
											</button>

											<button
												onClick={() => openEditDrawer(service)}
												className="cursor-pointer px-3 py-2 bg-violet-600/10 hover:bg-violet-600 border border-violet-500/20 hover:border-violet-500 text-violet-300 hover:text-white rounded-xl font-bold text-xs tracking-wide transition-all flex items-center gap-1.5"
											>
												<SlidersHorizontal size={12} />
												Change Price
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</motion.div>
				) : (
					/* Add New Services Panel */
					<motion.div
						key="explore-list"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						className="space-y-4"
					>
						{/* Explanatory banner */}
						<div className="p-4 rounded-xl bg-gradient-to-r from-violet-900/20 to-fuchsia-900/20 border border-violet-500/10 flex items-start gap-3">
							<Sparkles className="text-amber-400 shrink-0 mt-0.5" size={15} />
							<p className="text-xs text-violet-200/80 leading-relaxed inter">
								Want to take on more jobs? Pick a category below, set your
								custom pricing rate, and activate it to allow customers to hire
								you.
							</p>
						</div>

						{/* List format block */}
						<div className="border border-white/5 bg-slate-900/20 rounded-2xl divide-y divide-white/5 overflow-hidden">
							{discoverableServices.length === 0 ? (
								<div className="p-12 text-center text-slate-500 text-sm inter">
									You have already signed up for all available services!
								</div>
							) : (
								discoverableServices.map((service) => (
									<div
										key={service.slug || service.id}
										className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 bg-slate-900/40 hover:bg-[#22194A]/20 transition-all group relative"
									>
										<div className="flex gap-4 items-center min-w-0 md:w-3/4">
											<div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-white/5 relative">
												<img
													src={
														service.image_url || "/images/default-service.jpg"
													}
													alt=""
													className="w-full h-full object-cover opacity-60"
												/>
											</div>
											<div className="space-y-1 min-w-0">
												<h3 className="text-md font-bold text-white tracking-tight truncate group-hover:text-violet-300 transition-colors">
													{service.name}
												</h3>
												<p className="text-xs text-slate-400 line-clamp-1 inter pr-6 leading-relaxed">
													{service.description}
												</p>
											</div>
										</div>

										<div className="flex items-center justify-end shrink-0 md:w-1/4">
											<button
												onClick={() => openEditDrawer(service)}
												className="cursor-pointer px-4 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-xs tracking-wide transition-all shadow-md hover:bg-violet-500 flex items-center gap-1.5"
											>
												<Plus size={14} />
												Start Offering This
											</button>
										</div>
									</div>
								))
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Configuration Side-Drawer */}
			<AnimatePresence>
				{selectedService && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setSelectedService(null)}
							className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150]"
						/>
						<motion.div
							initial={{ x: "100%" }}
							animate={{ x: 0 }}
							exit={{ x: "100%" }}
							transition={{ type: "spring", damping: 28, stiffness: 240 }}
							className="fixed inset-y-0 right-0 w-full max-w-sm bg-slate-900 border-l border-white/5 shadow-[-20px_0_5px_rgba(0,0,0,0.5)] z-[201] flex flex-col p-6 justify-between"
						>
							<div className="space-y-6">
								<div>
									<h2 className="text-xl font-bold text-white tracking-tight">
										Configure Price Rate
									</h2>
									<p className="text-xs text-slate-400 mt-1 inter">
										Set the amount you want to charge your customers per visit.
									</p>
								</div>

								<div className="p-4 bg-[#22194A] border border-white/5 rounded-xl flex gap-3 items-center">
									<div className="w-12 h-12 rounded-xl bg-slate-950 overflow-hidden shrink-0 border border-white/10">
										<img
											src={
												selectedService.image_url ||
												"/images/default-service.jpg"
											}
											alt=""
											className="w-full h-full object-cover opacity-60"
										/>
									</div>
									<div className="min-w-0">
										<h4 className="text-sm font-bold text-white truncate">
											{selectedService.name}
										</h4>
										<p className="text-[9px] text-violet-300 font-mono tracking-wider uppercase mt-0.5">
											Service Listing
										</p>
									</div>
								</div>

								<form onSubmit={handleSavePrice} className="space-y-5">
									<div className="space-y-2">
										<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
											<IndianRupee size={10} /> Base Fee Amount (INR)
										</label>
										<div className="relative">
											<span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm font-bold">
												₹
											</span>
											<input
												type="number"
												required
												min="1"
												value={customPrice}
												onChange={(e) => setCustomPrice(e.target.value)}
												className="w-full pl-8 pr-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50 transition-all font-mono tracking-wide"
												placeholder="500"
											/>
										</div>
									</div>

									{/* Financial Split Breakdown */}
									<div className="p-4 rounded-xl bg-slate-950/50 border border-white/5 space-y-3 inter text-xs">
										<div className="flex justify-between items-center text-slate-400">
											<span>Customer Quote Price</span>
											<span className="font-mono text-slate-200">
												₹{customPrice || 0}
											</span>
										</div>
										<div className="flex justify-between items-center text-slate-400">
											<span className="flex items-center gap-1">
												Platform Commision Fee
												<Info
													size={11}
													className="text-slate-600"
													title="0% provider entry offer active"
												/>
											</span>
											<span className="font-mono text-emerald-400">0%</span>
										</div>
										<div className="pt-2.5 border-t border-white/5 flex justify-between items-center">
											<span className="font-bold text-white">
												Your Take-Home Profit
											</span>
											<span className="font-mono font-bold text-emerald-400 text-sm">
												₹{customPrice || 0}
											</span>
										</div>
									</div>

									<button
										type="submit"
										disabled={
											updatingId ===
											(selectedService.slug || selectedService.id)
										}
										className="w-full py-3 cursor-pointer bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-violet-900/20 flex items-center justify-center gap-2"
									>
										{updatingId ===
											(selectedService.slug || selectedService.id) && (
											<Loader2 size={14} className="animate-spin" />
										)}
										Save & Activate Listing
									</button>
								</form>
							</div>

							<button
								type="button"
								onClick={() => setSelectedService(null)}
								className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors border border-dashed border-white/5 rounded-xl"
							>
								Go Back
							</button>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</div>
	);
}
