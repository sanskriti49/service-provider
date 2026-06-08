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
	X,
} from "lucide-react";
import api from "../../api/axiosInstance";
import { useAuth } from "../../hooks/useAuth";
import { Link } from "react-router-dom";
import { UNIT_LABELS, getAllowedUnits } from "../../utils/pricingHelper";

export default function ProviderServices() {
	const { user } = useAuth();
	const [allMarketplaceServices, setAllMarketplaceServices] = useState([]);
	const [myServices, setMyServices] = useState([]);
	const [loading, setLoading] = useState(true);
	const [updatingId, setUpdatingId] = useState(null);
	const [activeTab, setActiveTab] = useState("active");
	const [selectedService, setSelectedService] = useState(null);
	const [customPrice, setCustomPrice] = useState("");
	const [priceUnit, setPriceUnit] = useState("fixed");

	useEffect(() => {
		if (!user?.id) return;
		const load = async () => {
			setLoading(true);
			try {
				const [marketRes, myRes] = await Promise.allSettled([
					api.get("/api/services/v1"),
					api.get(`/api/providers/v1/${user.id}/services`),
				]);

				if (marketRes.status === "fulfilled") {
					const list = marketRes.value.data;
					setAllMarketplaceServices(
						Array.isArray(list) ? list : (list?.data ?? []),
					);
				}
				if (myRes.status === "fulfilled") {
					setMyServices(myRes.value.data ?? []);
				}
			} catch (err) {
				console.error("Services load error:", err);
				toast.error("Failed to load service list");
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [user?.id]);

	const discoverableServices = useMemo(() => {
		const myIds = new Set(myServices.map((s) => s.id));
		return allMarketplaceServices.filter((s) => !myIds.has(s.id));
	}, [myServices, allMarketplaceServices]);

	const currentAllowedUnits = useMemo(() => {
		if (!selectedService) return ["fixed"];
		return getAllowedUnits(selectedService.slug, selectedService.price_unit);
	}, [selectedService]);

	const handleSavePrice = async (e) => {
		e.preventDefault();
		if (!selectedService) return;

		const finalPrice = parseFloat(customPrice);
		if (isNaN(finalPrice) || finalPrice <= 0) {
			toast.error("Please enter a valid price");
			return;
		}

		const isExisting = myServices.some((s) => s.id === selectedService.id);
		const loadingKey = selectedService.slug ?? selectedService.id;
		setUpdatingId(loadingKey);

		try {
			if (isExisting) {
				await api.post(`/api/providers/v1/${user.id}/services`, {
					slug: selectedService.slug,
					price: finalPrice,
					price_unit: priceUnit,
				});
				setMyServices((prev) =>
					prev.map((s) =>
						s.id === selectedService.id
							? { ...s, price: finalPrice, price_unit: priceUnit }
							: s,
					),
				);
				toast.success("Price updated successfully", {
					className:
						"bricolage-grotesque font-semibold border border-emerald-500/20 bg-slate-900 text-emerald-400 rounded-2xl shadow-xl",
				});
			} else {
				await api.post(`/api/providers/v1/${user.id}/services`, {
					slug: selectedService.slug,
					price: finalPrice,
					price_unit: priceUnit,
				});
				setMyServices((prev) => [
					...prev,
					{
						...selectedService,
						price: finalPrice,
						price_unit: priceUnit,
						is_visible: true,
					},
				]);
				toast.success(`Added ${selectedService.name} to your services!`, {
					className:
						"bricolage-grotesque font-semibold border border-emerald-500/20 bg-slate-900 text-emerald-400 rounded-2xl shadow-xl",
				});
				setActiveTab("active");
			}
			setSelectedService(null);
		} catch (err) {
			const msg = err.response?.data?.error || "Failed to save service";
			toast.error(msg, {
				className:
					"bricolage-grotesque font-semibold border border-red-500/20 bg-slate-900 text-red-400 rounded-2xl",
			});
			console.error("Save service error:", err.response?.data);
		} finally {
			setUpdatingId(null);
		}
	};

	const handleToggleVisibility = async (serviceItem) => {
		const nextVis = !serviceItem.is_visible;
		setUpdatingId(serviceItem.id);
		try {
			await api.put(
				`/api/providers/v1/${user.id}/services/${serviceItem.id}/visibility`,
				{ is_visible: nextVis },
			);
			setMyServices((prev) =>
				prev.map((s) =>
					s.id === serviceItem.id ? { ...s, is_visible: nextVis } : s,
				),
			);
			toast.success(nextVis ? "Service is now live" : "Service paused");
		} catch (err) {
			toast.error("Failed to update visibility");
		} finally {
			setUpdatingId(null);
		}
	};

	const openEditDrawer = (service) => {
		setSelectedService(service);
		setCustomPrice(service.price ? String(service.price) : "500");

		const allowed = getAllowedUnits(service.slug, service.price_unit);
		const existingUnit = service.price_unit?.toLowerCase().trim();

		if (existingUnit && allowed.includes(existingUnit)) {
			setPriceUnit(existingUnit);
		} else {
			setPriceUnit(allowed[0] || "fixed");
		}
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
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
				<div>
					<h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
						<Wrench className="text-violet-400" size={26} />
						My Services
					</h1>
					<p className="text-slate-400 text-sm mt-1">
						Set up the jobs you offer, adjust prices, or pause services.
					</p>
				</div>
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
						Active ({myServices.length})
					</button>
					<button
						onClick={() => setActiveTab("explore")}
						className={`cursor-pointer px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 duration-200 ${
							activeTab === "explore"
								? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
								: "text-slate-400 hover:text-slate-200"
						}`}
					>
						<Sparkles size={13} />
						Add New ({discoverableServices.length})
					</button>
				</div>
			</div>

			<AnimatePresence mode="wait">
				{activeTab === "active" ? (
					<motion.div
						key="active"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						className="space-y-3"
					>
						{myServices.length === 0 ? (
							<div className="flex flex-col items-center justify-center text-center p-12 border border-dashed border-white/10 bg-violet-900/5 rounded-2xl">
								<Briefcase size={36} className="text-slate-600 mb-4" />
								<p className="text-white font-bold text-lg">
									No active services yet
								</p>
								<p className="text-slate-400 text-xs mt-1 max-w-sm leading-relaxed">
									You won't appear in customer searches. Click{" "}
									<button
										onClick={() => setActiveTab("explore")}
										className="cursor-pointer text-violet-400 hover:text-violet-300 duration-200 underline"
									>
										Add New
									</button>{" "}
									to get started.
								</p>
							</div>
						) : (
							<div className="border border-white/5 bg-slate-900/20 rounded-2xl divide-y divide-white/5 overflow-hidden shadow-xl">
								{myServices.map((service) => (
									<div
										key={service.id}
										className={`flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 bg-slate-900/40 hover:bg-violet-900/10 transition-colors group relative ${
											!service.is_visible ? "opacity-50" : ""
										}`}
									>
										<div className="absolute left-0 top-0 bottom-0 w-[3px] bg-violet-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-r" />

										<div className="flex gap-4 items-center min-w-0 md:w-1/2">
											<div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-white/10">
												<img
													src={
														service.image_url || "/images/default-service.jpg"
													}
													alt={service.name}
													className="w-full h-full object-cover opacity-60"
												/>
											</div>
											<div className="space-y-1 min-w-0">
												<div className="flex items-center gap-2.5 flex-wrap">
													<h3 className="text-sm font-bold text-white truncate">
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
												<p className="text-xs text-slate-400 truncate pr-4">
													{service.description}
												</p>
											</div>
										</div>

										<div className="flex items-center gap-8 shrink-0 md:w-1/4">
											<div>
												<span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
													Your Rate
												</span>
												<span className="text-sm font-extrabold font-mono text-emerald-400 mt-0.5 block capitalize">
													{service.price_unit === "fixed" ||
													service.price_unit === "package" ? (
														<>
															₹{service.price}{" "}
															<span className="text-[11px] text-slate-400 font-normal lowercase ml-0.5">
																(
																{UNIT_LABELS[service.price_unit] ||
																	service.price_unit}
																)
															</span>
														</>
													) : service.price_unit === "starts at" ? (
														<>
															<span className="text-[11px] text-slate-400 font-normal lowercase mr-0.5">
																starts at
															</span>{" "}
															₹{service.price}
														</>
													) : (
														<>
															₹{service.price}{" "}
															<span className="text-[11px] text-slate-400 font-normal lowercase ml-0.5">
																/ {service.price_unit}
															</span>
														</>
													)}
												</span>
											</div>
										</div>

										<div className="flex items-center gap-2 justify-end shrink-0 md:w-1/4">
											<button
												onClick={() => handleToggleVisibility(service)}
												disabled={updatingId === service.id}
												className="p-2.5 cursor-pointer bg-slate-950/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5 rounded-xl transition-all"
												title={
													service.is_visible
														? "Pause service"
														: "Resume service"
												}
											>
												{updatingId === service.id ? (
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
					<motion.div
						key="explore"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						className="space-y-4"
					>
						<div className="p-4 rounded-xl bg-gradient-to-r from-violet-900/20 to-fuchsia-900/20 border border-violet-500/10 flex items-start gap-3">
							<Sparkles className="text-amber-400 shrink-0 mt-0.5" size={15} />
							<p className="text-xs text-violet-200/80 leading-relaxed">
								Pick a service, set your rate, and go live. Customers will be
								able to book you immediately.
							</p>
						</div>
						<div className="border border-white/5 bg-slate-900/20 rounded-2xl divide-y divide-white/5 overflow-hidden">
							{discoverableServices.length === 0 ? (
								<div className="p-12 text-center text-slate-500 text-sm">
									You've signed up for all available services! 🎉
								</div>
							) : (
								discoverableServices.map((service) => (
									<div
										key={service.id}
										className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 bg-slate-900/40 hover:bg-violet-900/10 transition-all group"
									>
										<div className="flex gap-4 items-center min-w-0 md:w-3/4">
											<div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-white/5">
												<img
													src={
														service.image_url || "/images/default-service.jpg"
													}
													alt={service.name}
													className="w-full h-full object-cover opacity-60"
												/>
											</div>
											<div className="space-y-1 min-w-0">
												<h3 className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">
													{service.name}
												</h3>
												<p className="text-xs text-slate-400 line-clamp-1 pr-6 leading-relaxed">
													{service.description}
												</p>
											</div>
										</div>
										<div className="flex items-center justify-end shrink-0 md:w-1/4">
											<button
												onClick={() => openEditDrawer(service)}
												className="cursor-pointer px-4 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-xs tracking-wide transition-all hover:bg-violet-500 flex items-center gap-1.5 shadow-lg shadow-violet-900/20"
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

			{/* Price config drawer */}
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
							className="fixed inset-y-0 right-0 w-full max-w-sm bg-slate-900 border-l border-white/8 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-[201] flex flex-col p-6 justify-between"
						>
							<div className="space-y-6">
								<div className="flex items-start justify-between">
									<div>
										<h2 className="text-xl font-bold text-white tracking-tight">
											Set Your Price
										</h2>
										<p className="text-xs text-slate-400 mt-1">
											Amount charged to customers per visit.
										</p>
									</div>
									<button
										onClick={() => setSelectedService(null)}
										className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
									>
										<X size={18} />
									</button>
								</div>

								<div className="p-4 bg-violet-900/20 border border-violet-500/15 rounded-xl flex gap-3 items-center">
									<div className="w-12 h-12 rounded-xl bg-slate-950 overflow-hidden shrink-0 border border-white/10">
										<img
											src={
												selectedService.image_url ||
												"/images/default-service.jpg"
											}
											alt={selectedService.name}
											className="w-full h-full object-cover opacity-60"
										/>
									</div>
									<div className="min-w-0">
										<h4 className="text-sm font-bold text-white truncate">
											{selectedService.name}
										</h4>
										<p className="text-[9px] text-violet-300 font-mono tracking-wider uppercase mt-0.5">
											{myServices.some((s) => s.id === selectedService.id)
												? "Update Price"
												: "New Service"}
										</p>
									</div>
								</div>

								<form onSubmit={handleSavePrice} className="space-y-5">
									<div className="space-y-2">
										<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
											Rate Structure
										</label>
										<select
											value={priceUnit}
											onChange={(e) => setPriceUnit(e.target.value)}
											className="w-full px-3 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer capitalize"
										>
											{currentAllowedUnits.map((unit) => (
												<option
													key={unit}
													value={unit}
													className="bg-slate-900"
												>
													{UNIT_LABELS[unit] || unit}
												</option>
											))}
										</select>
									</div>

									<div className="space-y-2">
										<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
											<IndianRupee size={10} /> Base Fee (INR)
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
												className="w-full pl-8 pr-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50 transition-all font-mono"
												placeholder="500"
											/>
										</div>
									</div>

									{/* Professional Breakdown Layout */}
									<div className="p-4 rounded-xl bg-slate-950/50 border border-white/5 space-y-3 text-sm">
										<div className="flex justify-between text-slate-400">
											<span>Customer pays</span>
											<span className="font-mono text-slate-200">
												{priceUnit === "starts at" ? (
													<>
														<span className="text-[11px] text-slate-500 mr-1">
															Starts at
														</span>{" "}
														₹{customPrice || 0}
													</>
												) : priceUnit === "fixed" || priceUnit === "package" ? (
													<>
														₹{customPrice || 0}{" "}
														<span className="text-[11px] text-slate-500 ml-1">
															({UNIT_LABELS[priceUnit]})
														</span>
													</>
												) : (
													<>
														₹{customPrice || 0}{" "}
														<span className="text-[11px] text-slate-500 ml-1">
															/ {priceUnit}
														</span>
													</>
												)}
											</span>
										</div>

										<div className="flex justify-between items-center bg-violet-500/5 border border-violet-500/10 rounded-lg p-2.5 group/info transition-all relative">
											<span className="flex items-center gap-1.5 text-slate-400 text-[12px]">
												Platform Commission
												<div className="relative cursor-pointer text-violet-400 hover:text-violet-300">
													<Info size={13} />
													<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 text-slate-300 text-[13px] p-2 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover/info:opacity-100 transition-opacity duration-200 border border-white/10 leading-normal z-50 normal-case font-normal">
														TaskGenie charges a 0% introductory commission fee
														during our launch program.
													</div>
												</div>
											</span>
											<div className="flex items-center gap-1.5">
												<span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">
													Free Launch Access
												</span>
												<span className="font-mono text-emerald-400 line-through opacity-40 text-[11px]">
													₹0
												</span>
											</div>
										</div>

										<div className="pt-2.5 border-t border-white/5 flex justify-between items-center">
											<span className="font-bold text-white">
												Net Payout Take-home
											</span>
											<span className="font-mono font-bold text-emerald-400 text-sm">
												{priceUnit === "starts at" ? (
													<>
														<span className="text-[11px] text-emerald-600 font-normal mr-1">
															Starts at
														</span>{" "}
														₹{customPrice || 0}
													</>
												) : priceUnit === "fixed" || priceUnit === "package" ? (
													<>
														₹{customPrice || 0}{" "}
														<span className="text-[11px] text-emerald-600 font-normal ml-1">
															({UNIT_LABELS[priceUnit]})
														</span>
													</>
												) : (
													<>
														₹{customPrice || 0}{" "}
														<span className="text-[11px] text-emerald-600 font-normal ml-1">
															/ {priceUnit}
														</span>
													</>
												)}
											</span>
										</div>
									</div>

									<button
										type="submit"
										disabled={
											updatingId ===
											(selectedService.slug ?? selectedService.id)
										}
										className="w-full py-3 cursor-pointer bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-violet-900/20 flex items-center justify-center gap-2"
									>
										{updatingId ===
											(selectedService.slug ?? selectedService.id) && (
											<Loader2 size={14} className="animate-spin" />
										)}
										{myServices.some((s) => s.id === selectedService.id)
											? "Update Price"
											: "Activate Service"}
									</button>
								</form>
							</div>

							<button
								type="button"
								onClick={() => setSelectedService(null)}
								className="cursor-pointer w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors border border-dashed border-white/5 rounded-xl"
							>
								Cancel
							</button>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</div>
	);
}
