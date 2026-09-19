import { useEffect, useState, useMemo, useCallback } from "react";
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
	SlidersHorizontal,
	Layers,
	X,
	Clock,
	Check,
	ShieldCheck,
	ArrowUpRight,
} from "lucide-react";
import { FadeLoader } from "react-spinners";
import api from "../../api/axiosInstance";
import { useAuth } from "../../hooks/useAuth";
import { UNIT_LABELS, getAllowedUnits } from "../../utils/pricingHelper";
import ConfirmDialog from "../../ui/ConfirmDialog";

const DAYS_OF_WEEK = [
	{ label: "Sun", value: 0 },
	{ label: "Mon", value: 1 },
	{ label: "Tue", value: 2 },
	{ label: "Wed", value: 3 },
	{ label: "Thu", value: 4 },
	{ label: "Fri", value: 5 },
	{ label: "Sat", value: 6 },
];

const formatCurrency = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(n || 0);

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

	const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
	const [startTime, setStartTime] = useState("09:00");
	const [endTime, setEndTime] = useState("18:00");
	const [pendingPauseService, setPendingPauseService] = useState(null);

	useEffect(() => {
		if (!user?.id) {
			setLoading(false);
			return;
		}
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

	const toggleDaySelection = (dayVal) => {
		setSelectedDays((prev) =>
			prev.includes(dayVal)
				? prev.filter((d) => d !== dayVal)
				: [...prev, dayVal].sort(),
		);
	};

	const handleSavePrice = async (e) => {
		e.preventDefault();
		if (!selectedService) return;

		const finalPrice = parseFloat(customPrice);
		if (isNaN(finalPrice) || finalPrice <= 0) {
			toast.error("Please enter a valid price");
			return;
		}
		if (selectedDays.length === 0) {
			toast.error("Please choose at least one operating day");
			return;
		}
		const isExisting = myServices.some((s) => s.id === selectedService.id);
		const loadingKey = selectedService.slug ?? selectedService.id;
		setUpdatingId(loadingKey);

		try {
			const payload = {
				slug: selectedService.slug,
				price: finalPrice,
				price_unit: priceUnit,
				availability: {
					days: selectedDays,
					startTime,
					endTime,
				},
			};
			await api.post(`/api/providers/v1/${user.id}/services`, payload);
			if (isExisting) {
				setMyServices((prev) =>
					prev.map((s) =>
						s.id === selectedService.id
							? { ...s, price: finalPrice, price_unit: priceUnit }
							: s,
					),
				);
				toast.success("Service parameters updated");
			} else {
				setMyServices((prev) => [
					...prev,
					{
						...selectedService,
						price: finalPrice,
						price_unit: priceUnit,
						is_visible: true,
					},
				]);
				toast.success(`Published ${selectedService.name} to live catalog`);
				setActiveTab("active");
			}

			setSelectedService(null);
		} catch (err) {
			const msg =
				err.response?.data?.error || "Failed to save service settings";
			toast.error(msg);
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
			toast.success(
				nextVis
					? "Service is live on marketplace"
					: "Service visibility paused",
			);
		} catch (err) {
			toast.error("Failed to update visibility");
		} finally {
			setUpdatingId(null);
		}
	};

	const handleToggleClick = (serviceItem) => {
		if (serviceItem.is_visible) {
			setPendingPauseService(serviceItem);
		} else {
			handleToggleVisibility(serviceItem);
		}
	};

	const openEditDrawer = (service) => {
		setSelectedService(service);
		setCustomPrice(service.price ? String(service.price) : "499");

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
				<FadeLoader
					color="#8b5cf6"
					height={10}
					width={3}
					radius={2}
					margin={2}
				/>
				<span className="text-xs font-bold mt-2">Loading your services...</span>
			</div>
		);
	}

	return (
		<div className="space-y-8 relative bricolage-grotesque">
			{/* Header Strip */}
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-white/[0.06]">
				<div>
					<div className="flex items-center gap-2.5">
						<h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
							My Services & Pricing
						</h1>
					</div>
					<p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
						Manage your services, pricing, and availability.
					</p>
				</div>

				<div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.07] rounded-2xl">
					<button
						onClick={() => setActiveTab("active")}
						className={`cursor-pointer px-4 py-1.5 text-[13.5px] font-bold rounded-xl transition-all flex items-center gap-2 ${
							activeTab === "active"
								? "bg-violet-600 text-white shadow-md shadow-violet-950"
								: "text-slate-400 hover:text-white"
						}`}
					>
						<Layers size={13} />
						Active Services ({myServices.length})
					</button>
					<button
						onClick={() => setActiveTab("explore")}
						className={`cursor-pointer px-4 py-1.5 text-[13.5px] font-bold rounded-xl transition-all flex items-center gap-2 ${
							activeTab === "explore"
								? "bg-violet-600 text-white shadow-md shadow-violet-950"
								: "text-slate-400 hover:text-white"
						}`}
					>
						<Plus size={13} />
						Available Services ({discoverableServices.length})
					</button>
				</div>
			</div>

			<AnimatePresence mode="wait">
				{activeTab === "active" ? (
					<motion.div
						key="active"
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						className="space-y-4"
					>
						{myServices.length === 0 ? (
							<div className="flex flex-col items-center justify-center text-center p-14 border border-dashed border-white/[0.08] bg-white/[0.01] rounded-3xl space-y-3">
								<Briefcase size={36} className="text-slate-600" />
								<p className="text-white font-bold text-[17.5px]">
									No active services added yet
								</p>
								<p className="text-slate-400 text-sm max-w-sm leading-relaxed">
									Customers cannot find or book you until you enable at least
									one service.
								</p>
								<button
									onClick={() => setActiveTab("explore")}
									className="mt-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl shadow-md shadow-violet-950 cursor-pointer transition-all"
								>
									Browse Marketplace Services
								</button>
							</div>
						) : (
							<div className="bg-[#120a22] border border-white/[0.07] rounded-3xl divide-y divide-white/[0.04] overflow-hidden shadow-xl">
								{myServices.map((service) => (
									<div
										key={service.id}
										className={`flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 hover:bg-white/[0.02] transition-colors group relative ${
											!service.is_visible ? "opacity-60" : ""
										}`}
									>
										<div className="flex gap-4 items-center min-w-0 md:w-1/2">
											<div className="w-13 h-13 rounded-2xl overflow-hidden bg-black/40 shrink-0 border border-white/[0.08]">
												<img
													src={
														service.image_url || "/images/default-service.jpg"
													}
													alt={service.name}
													className="w-full h-full object-cover"
												/>
											</div>
											<div className="space-y-1 min-w-0">
												<div className="flex items-center gap-2.5 flex-wrap">
													<h3 className="text-[16px] font-bold text-white truncate">
														{service.name}
													</h3>
													<span
														className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
															service.is_visible
																? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
																: "bg-white/[0.04] text-slate-400 border-white/[0.06]"
														}`}
													>
														{service.is_visible ? "Live on App" : "Paused"}
													</span>
												</div>
												<p className="text-sm text-slate-400 truncate pr-4">
													{service.description}
												</p>
											</div>
										</div>

										<div className="flex items-center gap-6 shrink-0 md:w-1/4">
											<div>
												<span className="text-[10.5px] font-bold text-slate-400/80 uppercase tracking-wider block">
													You Get
												</span>
												<span className="text-[15px] font-black text-emerald-400 mt-0.5 block font-mono">
													₹{service.price}
													<span className="text-sm text-slate-400 font-normal font-sans ml-1">
														/
														{UNIT_LABELS[service.price_unit] ||
															service.price_unit}
													</span>
												</span>
											</div>
										</div>

										<div className="flex items-center gap-2 justify-end shrink-0 md:w-1/4">
											<button
												onClick={() => handleToggleClick(service)}
												disabled={updatingId === service.id}
												className="p-2.5 cursor-pointer bg-white/[0.03] hover:bg-white/[0.07] text-slate-400 hover:text-white border border-white/[0.06] rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
												title={
													service.is_visible
														? "Pause Service"
														: "Activate Service"
												}
											>
												{updatingId === service.id ? (
													<span className="inline-flex items-center justify-center w-4 h-4 scale-[0.35] origin-center">
														<FadeLoader color="#a78bfa" />
													</span>
												) : service.is_visible ? (
													<Eye size={18} />
												) : (
													<EyeOff size={18} />
												)}
											</button>
											<button
												onClick={() => openEditDrawer(service)}
												className="cursor-pointer px-3 py-2 bg-violet-600/15 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 hover:border-violet-500 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all"
											>
												<SlidersHorizontal size={12} />
												Configure
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
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						className="space-y-4"
					>
						<div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-start gap-3">
							<Sparkles className="text-violet-400 shrink-0 mt-0.5" size={16} />
							<p className="text-xs text-violet-200/90 leading-relaxed font-medium">
								Add more services to your profile. Select a category, set your
								rates, and start taking bookings.
							</p>
						</div>

						<div className="bg-[#120a22] border border-white/[0.07] rounded-3xl divide-y divide-white/[0.04] overflow-hidden shadow-xl">
							{discoverableServices.length === 0 ? (
								<div className="p-12 text-center text-slate-400 text-sm font-semibold">
									You have unlocked all currently supported platform services!
								</div>
							) : (
								discoverableServices.map((service) => (
									<div
										key={service.id}
										className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 hover:bg-white/[0.02] transition-all group"
									>
										<div className="flex gap-4 items-center min-w-0 md:w-3/4">
											<div className="w-13 h-13 rounded-2xl overflow-hidden bg-black/40 shrink-0 border border-white/[0.08]">
												<img
													src={
														service.image_url || "/images/default-service.jpg"
													}
													alt={service.name}
													className="w-full h-full object-cover"
												/>
											</div>
											<div className="space-y-1 min-w-0">
												<h3 className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">
													{service.name}
												</h3>
												<p className="text-sm text-slate-400 line-clamp-1 pr-6 leading-relaxed">
													{service.description}
												</p>
											</div>
										</div>

										<div className="flex items-center justify-end shrink-0 md:w-1/4">
											<button
												onClick={() => openEditDrawer(service)}
												className="cursor-pointer px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-xs tracking-wide transition-all flex items-center gap-1.5 shadow-md shadow-violet-950"
											>
												<Plus size={14} />
												Add to Offerings
											</button>
										</div>
									</div>
								))
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Edit Configurations Drawer */}
			<AnimatePresence>
				{selectedService && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setSelectedService(null)}
							className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[150]"
						/>
						<motion.div
							initial={{ x: "100%" }}
							animate={{ x: 0 }}
							exit={{ x: "100%" }}
							transition={{ type: "spring", damping: 30, stiffness: 280 }}
							className="fixed inset-y-0 right-0 w-full max-w-md bg-[#100924] border-l border-white/[0.08] shadow-2xl z-[201] flex flex-col p-6 overflow-y-auto"
						>
							<div className="space-y-6 flex-1">
								<div className="flex items-start justify-between border-b border-white/[0.06] pb-4">
									<div>
										<h2 className="text-lg font-black text-white tracking-tight">
											Service Setup
										</h2>
										<p className="text-xs text-slate-400 mt-0.5 font-medium">
											Set your rates, billing type, and working hours.
										</p>
									</div>
									<button
										onClick={() => setSelectedService(null)}
										className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-white/[0.03] border border-white/[0.06] cursor-pointer transition-colors"
									>
										<X size={16} />
									</button>
								</div>

								{/* Service Badge Header */}
								<div className="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex gap-3.5 items-center">
									<div className="w-12 h-12 rounded-xl bg-black/40 overflow-hidden shrink-0 border border-white/[0.08]">
										<img
											src={
												selectedService.image_url ||
												"/images/default-service.jpg"
											}
											alt={selectedService.name}
											className="w-full h-full object-cover"
										/>
									</div>
									<div className="min-w-0">
										<h4 className="text-[17px] font-bold text-white truncate">
											{selectedService.name}
										</h4>
										<span className="text-[10px] text-violet-300 font-bold uppercase tracking-wider block mt-0.5">
											{myServices.some((s) => s.id === selectedService.id)
												? "Active in Your Services"
												: "New Service Setup"}
										</span>
									</div>
								</div>

								<form onSubmit={handleSavePrice} className="space-y-5 text-xs">
									<div className="space-y-3.5">
										<div className="space-y-1.5">
											<label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest block">
												Charge By
											</label>
											<select
												value={priceUnit}
												onChange={(e) => setPriceUnit(e.target.value)}
												className="w-full px-3 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs font-semibold text-white capitalize focus:outline-none focus:border-violet-500"
											>
												{currentAllowedUnits.map((unit) => (
													<option
														key={unit}
														value={unit}
														className="bg-[#120a22]"
													>
														{UNIT_LABELS[unit] || unit}
													</option>
												))}
											</select>
										</div>

										<div className="space-y-1.5">
											<label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest block">
												Service Rate (INR)
											</label>
											<div className="relative">
												<span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">
													₹
												</span>
												<input
													type="number"
													required
													min="1"
													value={customPrice}
													onChange={(e) => setCustomPrice(e.target.value)}
													className="w-full pl-8 pr-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm font-extrabold text-white font-mono focus:outline-none focus:border-violet-500"
												/>
											</div>
										</div>
									</div>

									{/* Operating Days */}
									<div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
										<label className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400 block">
											Available Days
										</label>

										<div className="flex gap-1.5 overflow-x-auto pb-1">
											{DAYS_OF_WEEK.map((day) => {
												const isSelected = selectedDays.includes(day.value);
												return (
													<button
														type="button"
														key={day.value}
														onClick={() => toggleDaySelection(day.value)}
														className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 uppercase tracking-wider ${
															isSelected
																? "bg-violet-600 text-white border-violet-500 shadow-xs"
																: "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:text-white"
														}`}
													>
														{day.label}
													</button>
												);
											})}
										</div>

										<div className="grid grid-cols-2 gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/[0.06]">
											<div>
												<span className="text-[10.5px] text-slate-300/80 font-bold block mb-1">
													START TIME
												</span>
												<input
													type="time"
													value={startTime}
													onChange={(e) => setStartTime(e.target.value)}
													className="w-full bg-black/40 text-white font-mono text-xs p-2 rounded-lg border border-white/[0.08] focus:outline-none"
												/>
											</div>
											<div>
												<span className="text-[10.5px] text-slate-300/80 font-bold block mb-1">
													END TIME
												</span>
												<input
													type="time"
													value={endTime}
													onChange={(e) => setEndTime(e.target.value)}
													className="w-full bg-black/40 text-white font-mono text-xs p-2 rounded-lg border border-white/[0.08] focus:outline-none"
												/>
											</div>
										</div>
									</div>

									{/* Take Home Preview */}
									<div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1.5 text-sm">
										<div className="flex justify-between text-slate-300/80">
											<span>Platform Fee (15%)</span>
											<span className="font-mono text-slate-300">
												-₹{Math.round((Number(customPrice) || 0) * 0.15)}
											</span>
										</div>
										<div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
											<span className="font-bold text-white">You Earn</span>
											<span className="font-mono font-extrabold text-emerald-400 text-sm">
												₹{Math.round((Number(customPrice) || 0) * 0.85)}
											</span>
										</div>
									</div>

									<button
										type="submit"
										disabled={
											updatingId ===
											(selectedService.slug ?? selectedService.id)
										}
										className="w-full py-2.5 cursor-pointer bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-[15.5px] rounded-xl transition-all shadow-md shadow-violet-950 flex items-center justify-center gap-2"
									>
										{updatingId ===
											(selectedService.slug ?? selectedService.id) && (
											<span className="inline-flex items-center justify-center w-4 h-4 scale-[0.35] origin-center -mx-1">
												<FadeLoader color="#ffffff" />
											</span>
										)}
										{myServices.some((s) => s.id === selectedService.id)
											? "Save Changes"
											: "Add Service to Profile"}
									</button>
								</form>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			{/* Consequential Action Confirmation */}
			<ConfirmDialog
				isOpen={!!pendingPauseService}
				onClose={() => setPendingPauseService(null)}
				onConfirm={async () => {
					const target = pendingPauseService;
					setPendingPauseService(null);
					await handleToggleVisibility(target);
				}}
				title="Pause service visibility?"
				description={`"${pendingPauseService?.name}" will be hidden from customer marketplace searches until you activate it again.`}
				confirmText="Pause service"
				cancelText="Keep live"
				variant="warning"
			/>
		</div>
	);
}
