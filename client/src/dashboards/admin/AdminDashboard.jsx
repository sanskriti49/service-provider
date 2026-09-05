import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
	LayoutDashboard,
	Users,
	AlertTriangle,
	Settings as SettingsIcon,
	ShieldCheck,
	CheckCircle2,
	XCircle,
	Clock,
	TrendingUp,
	IndianRupee,
	Search,
	RefreshCw,
	Sliders,
	MapPin,
	Calendar,
	Briefcase,
	ChevronRight,
	AlertCircle,
	Check,
	Phone,
	Mail,
	Ban,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import api from "../../api/axiosInstance";
import { useAuth } from "../../hooks/useAuth";

const formatCurrency = (val) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(val || 0);

export default function AdminDashboard() {
	const { user } = useAuth();
	const [activeTab, setActiveTab] = useState("overview");

	// Overview state
	const [overviewData, setOverviewData] = useState(null);
	const [loadingOverview, setLoadingOverview] = useState(true);

	// Providers state
	const [providers, setProviders] = useState([]);
	const [providersMeta, setProvidersMeta] = useState({ page: 1, total_pages: 1, total: 0 });
	const [providerStatusFilter, setProviderStatusFilter] = useState("all");
	const [providerSearch, setProviderSearch] = useState("");
	const [loadingProviders, setLoadingProviders] = useState(false);
	const [selectedProviderForReject, setSelectedProviderForReject] = useState(null);
	const [rejectionReason, setRejectionReason] = useState("");
	const [actionInProgress, setActionInProgress] = useState(null);

	// Disputes state
	const [disputes, setDisputes] = useState([]);
	const [disputesMeta, setDisputesMeta] = useState({ page: 1, total_pages: 1, total: 0 });
	const [disputeStatusFilter, setDisputeStatusFilter] = useState("all");
	const [loadingDisputes, setLoadingDisputes] = useState(false);
	const [selectedDisputeForResolve, setSelectedDisputeForResolve] = useState(null);
	const [resolveForm, setResolveForm] = useState({
		status: "resolved",
		refund_amount: 0,
		resolution_notes: "",
	});

	// Settings state
	const [settings, setSettings] = useState({
		commission_rate: { percentage: 15, min_fee: 50 },
		cancellation_fee: { customer_fee: 100, provider_penalty: 150 },
	});
	const [loadingSettings, setLoadingSettings] = useState(false);
	const [savingSettings, setSavingSettings] = useState(false);

	// --- 1. Fetch Overview ---
	const fetchOverview = useCallback(async () => {
		setLoadingOverview(true);
		try {
			const res = await api.get("/admin/overview");
			if (res.data?.success) {
				setOverviewData(res.data);
			}
		} catch (err) {
			console.error("Failed to load admin overview:", err);
			toast.error("Failed to load overview analytics");
		} finally {
			setLoadingOverview(false);
		}
	}, []);

	// --- 2. Fetch Providers ---
	const fetchProviders = useCallback(async (page = 1) => {
		setLoadingProviders(true);
		try {
			const params = {
				status: providerStatusFilter,
				search: providerSearch,
				page,
				limit: 10,
			};
			const res = await api.get("/admin/providers", { params });
			if (res.data?.success) {
				setProviders(res.data.data || []);
				setProvidersMeta(res.data.meta || { page: 1, total_pages: 1, total: 0 });
			}
		} catch (err) {
			console.error("Failed to load providers:", err);
			toast.error("Failed to load provider list");
		} finally {
			setLoadingProviders(false);
		}
	}, [providerStatusFilter, providerSearch]);

	// --- 3. Fetch Disputes ---
	const fetchDisputes = useCallback(async (page = 1) => {
		setLoadingDisputes(true);
		try {
			const params = {
				status: disputeStatusFilter,
				page,
				limit: 10,
			};
			const res = await api.get("/admin/disputes", { params });
			if (res.data?.success) {
				setDisputes(res.data.data || []);
				setDisputesMeta(res.data.meta || { page: 1, total_pages: 1, total: 0 });
			}
		} catch (err) {
			console.error("Failed to load disputes:", err);
			toast.error("Failed to load disputes list");
		} finally {
			setLoadingDisputes(false);
		}
	}, [disputeStatusFilter]);

	// --- 4. Fetch Settings ---
	const fetchSettings = useCallback(async () => {
		setLoadingSettings(true);
		try {
			const res = await api.get("/admin/settings");
			if (res.data?.success && res.data.settings) {
				setSettings(res.data.settings);
			}
		} catch (err) {
			console.error("Failed to load settings:", err);
		} finally {
			setLoadingSettings(false);
		}
	}, []);

	// Load initial data based on active tab
	useEffect(() => {
		if (activeTab === "overview") fetchOverview();
		else if (activeTab === "providers") fetchProviders(1);
		else if (activeTab === "disputes") fetchDisputes(1);
		else if (activeTab === "settings") fetchSettings();
	}, [activeTab, fetchOverview, fetchProviders, fetchDisputes, fetchSettings]);

	// Update Provider Status Handler
	const handleUpdateProviderStatus = async (providerId, newStatus, reason = null) => {
		setActionInProgress(providerId);
		try {
			const res = await api.put(`/admin/providers/${providerId}/status`, {
				status: newStatus,
				rejection_reason: reason,
			});
			if (res.data?.success) {
				toast.success(`Provider status updated to ${newStatus}`);
				fetchProviders(providersMeta.page);
				if (overviewData) fetchOverview();
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to update provider status");
		} finally {
			setActionInProgress(null);
			setSelectedProviderForReject(null);
			setRejectionReason("");
		}
	};

	// Resolve Dispute Handler
	const handleResolveDispute = async (e) => {
		e.preventDefault();
		if (!selectedDisputeForResolve) return;
		setActionInProgress(selectedDisputeForResolve.dispute_id);

		try {
			const res = await api.put(`/admin/disputes/${selectedDisputeForResolve.dispute_id}/resolve`, {
				status: resolveForm.status,
				refund_amount: Number(resolveForm.refund_amount) || 0,
				resolution_notes: resolveForm.resolution_notes,
			});
			if (res.data?.success) {
				toast.success(`Dispute marked as ${resolveForm.status}`);
				fetchDisputes(disputesMeta.page);
				if (overviewData) fetchOverview();
				setSelectedDisputeForResolve(null);
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to resolve dispute");
		} finally {
			setActionInProgress(null);
		}
	};

	// Save Settings Handler
	const handleSaveSettings = async (e) => {
		e.preventDefault();
		setSavingSettings(true);
		try {
			const res = await api.put("/admin/settings", settings);
			if (res.data?.success) {
				toast.success("Platform settings saved successfully");
				fetchOverview();
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to save settings");
		} finally {
			setSavingSettings(false);
		}
	};

	// Calculate live commission breakdown preview
	const commissionPreview = useMemo(() => {
		const baseAmount = 1000;
		const pct = Number(settings.commission_rate?.percentage) || 15;
		const commission = Math.round(baseAmount * (pct / 100));
		const providerEarnings = baseAmount - commission;
		return { baseAmount, commission, providerEarnings, pct };
	}, [settings.commission_rate]);

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100 bricolage-grotesque selection:bg-violet-600/40">
			{/* Top Bar */}
			<header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-bold shadow-lg shadow-violet-500/20">
							<ShieldCheck size={22} />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-xl font-bold tracking-tight text-white">TaskGenie Ops Hub</h1>
								<span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
									Admin
								</span>
							</div>
							<p className="text-xs text-slate-400">Platform governance, approvals & financial analytics</p>
						</div>
					</div>

					{/* Tab Navigation */}
					<nav className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-x-auto w-full sm:w-auto">
						<button
							onClick={() => setActiveTab("overview")}
							className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
								activeTab === "overview"
									? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
									: "text-slate-400 hover:text-white hover:bg-slate-800/60"
							}`}
						>
							<LayoutDashboard size={14} />
							Overview
						</button>
						<button
							onClick={() => setActiveTab("providers")}
							className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
								activeTab === "providers"
									? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
									: "text-slate-400 hover:text-white hover:bg-slate-800/60"
							}`}
						>
							<Users size={14} />
							Approvals
							{overviewData?.overview?.pending_approvals > 0 && (
								<span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
									{overviewData.overview.pending_approvals}
								</span>
							)}
						</button>
						<button
							onClick={() => setActiveTab("disputes")}
							className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
								activeTab === "disputes"
									? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
									: "text-slate-400 hover:text-white hover:bg-slate-800/60"
							}`}
						>
							<AlertTriangle size={14} />
							Disputes
							{overviewData?.overview?.active_disputes > 0 && (
								<span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
									{overviewData.overview.active_disputes}
								</span>
							)}
						</button>
						<button
							onClick={() => setActiveTab("settings")}
							className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
								activeTab === "settings"
									? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
									: "text-slate-400 hover:text-white hover:bg-slate-800/60"
							}`}
						>
							<SettingsIcon size={14} />
							Settings
						</button>
					</nav>
				</div>
			</header>

			{/* Main Content Area */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
				{/* ----------------- TAB 1: OVERVIEW & ANALYTICS ----------------- */}
				{activeTab === "overview" && (
					<div className="space-y-8">
						{/* Top KPI Cards */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
							<div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-violet-500/30 transition-colors">
								<div className="flex items-center justify-between text-slate-400 mb-2">
									<span className="text-xs font-medium uppercase tracking-wider">Gross Platform GMV</span>
									<span className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
										<IndianRupee size={16} />
									</span>
								</div>
								<div className="text-2xl sm:text-3xl font-bold text-white">
									{loadingOverview ? "..." : formatCurrency(overviewData?.overview?.total_gmv)}
								</div>
								<p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
									<TrendingUp size={12} className="text-emerald-400" />
									Completed booking transaction volume
								</p>
							</div>

							<div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
								<div className="flex items-center justify-between text-slate-400 mb-2">
									<span className="text-xs font-medium uppercase tracking-wider">
										Platform Take ({overviewData?.overview?.commission_percentage || 15}%)
									</span>
									<span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
										<TrendingUp size={16} />
									</span>
								</div>
								<div className="text-2xl sm:text-3xl font-bold text-emerald-400">
									{loadingOverview ? "..." : formatCurrency(overviewData?.overview?.platform_commission)}
								</div>
								<p className="text-xs text-slate-400 mt-2">Net platform commission revenue</p>
							</div>

							<div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-blue-500/30 transition-colors">
								<div className="flex items-center justify-between text-slate-400 mb-2">
									<span className="text-xs font-medium uppercase tracking-wider">Total Bookings</span>
									<span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
										<Calendar size={16} />
									</span>
								</div>
								<div className="text-2xl sm:text-3xl font-bold text-white">
									{loadingOverview ? "..." : overviewData?.overview?.total_bookings || 0}
								</div>
								<p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
									<span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
									{overviewData?.overview?.active_bookings || 0} active / scheduled
								</p>
							</div>

							<div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-amber-500/30 transition-colors">
								<div className="flex items-center justify-between text-slate-400 mb-2">
									<span className="text-xs font-medium uppercase tracking-wider">Provider Force</span>
									<span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
										<Users size={16} />
									</span>
								</div>
								<div className="text-2xl sm:text-3xl font-bold text-white">
									{loadingOverview ? "..." : overviewData?.overview?.approved_providers || 0}
								</div>
								<p className="text-xs text-amber-300/90 mt-2 font-medium">
									{overviewData?.overview?.pending_approvals || 0} awaiting approval
								</p>
							</div>
						</div>

						{/* Charts Row: Peak Booking Hours & Location Demand */}
						<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
							{/* Peak Booking Hours Distribution */}
							<div className="lg:col-span-8 p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-6">
								<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
									<div>
										<h2 className="text-lg font-bold text-white flex items-center gap-2">
											<Clock size={18} className="text-violet-400" />
											Peak Booking Hours
										</h2>
										<p className="text-xs text-slate-400">Distribution of customer requested service time slots</p>
									</div>
									<button
										onClick={fetchOverview}
										className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 cursor-pointer transition-colors w-fit"
										title="Refresh data"
									>
										<RefreshCw size={14} className={loadingOverview ? "animate-spin" : ""} />
									</button>
								</div>

								{/* Peak Hours Bar Chart */}
								<div className="h-64 flex items-end gap-2 pt-6 pb-2 px-2 overflow-x-auto">
									{overviewData?.peak_hours?.map((slot) => {
										const maxCount = Math.max(...(overviewData?.peak_hours?.map((p) => p.bookings) || [1]), 1);
										const heightPct = Math.max(8, Math.round((slot.bookings / maxCount) * 100));
										const isPeak = heightPct > 60;

										return (
											<div key={slot.hour} className="flex-1 min-w-[32px] flex flex-col items-center gap-2 group relative">
												{/* Tooltip */}
												<div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 px-2 py-1 rounded-md bg-slate-800 text-[10px] font-bold text-white shadow-md pointer-events-none whitespace-nowrap z-20">
													{slot.bookings} Bookings
												</div>
												{/* Bar */}
												<div
													style={{ height: `${heightPct}%` }}
													className={`w-full rounded-t-xl transition-all duration-500 ${
														isPeak
															? "bg-gradient-to-t from-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20"
															: "bg-slate-800 hover:bg-slate-700"
													}`}
												/>
												{/* Label */}
												<span className="text-[10px] text-slate-400 truncate rotate-[-45deg] origin-top-left mt-2">
													{slot.label}
												</span>
											</div>
										);
									})}
								</div>
								<div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-800/80">
									<span className="flex items-center gap-1.5">
										<span className="h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-500" />
										High demand slots (Rush hours)
									</span>
									<span>7:00 AM – 10:00 PM Active Window</span>
								</div>
							</div>

							{/* Location Demand Heatmap */}
							<div className="lg:col-span-4 p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-6">
								<div>
									<h2 className="text-lg font-bold text-white flex items-center gap-2">
										<MapPin size={18} className="text-fuchsia-400" />
										Demand Heatmap
									</h2>
									<p className="text-xs text-slate-400">Top geographic zones by customer bookings</p>
								</div>

								<div className="space-y-4">
									{overviewData?.top_locations?.length > 0 ? (
										overviewData.top_locations.map((loc, idx) => {
											const maxLocBookings = Math.max(...overviewData.top_locations.map((l) => l.bookings), 1);
											const pct = Math.round((loc.bookings / maxLocBookings) * 100);

											return (
												<div key={idx} className="space-y-1.5">
													<div className="flex items-center justify-between text-xs">
														<span className="font-semibold text-slate-200 truncate max-w-[180px]">{loc.city}</span>
														<span className="text-slate-400 font-medium">
															{loc.bookings} jobs ({formatCurrency(loc.revenue)})
														</span>
													</div>
													<div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
														<div
															style={{ width: `${pct}%` }}
															className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
														/>
													</div>
												</div>
											);
										})
									) : (
										<p className="text-xs text-slate-500 py-6 text-center">No location booking records yet.</p>
									)}
								</div>
							</div>
						</div>

						{/* Booking Status Distribution */}
						<div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
							<h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
								Lifecycle Status Distribution
							</h3>
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
								<div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
									<span className="text-xs font-semibold text-emerald-400">Completed</span>
									<div className="text-2xl font-bold text-white mt-1">
										{overviewData?.status_distribution?.completed || 0}
									</div>
								</div>
								<div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
									<span className="text-xs font-semibold text-blue-400">Active / Booked</span>
									<div className="text-2xl font-bold text-white mt-1">
										{overviewData?.status_distribution?.active || 0}
									</div>
								</div>
								<div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
									<span className="text-xs font-semibold text-rose-400">Cancelled</span>
									<div className="text-2xl font-bold text-white mt-1">
										{overviewData?.status_distribution?.cancelled || 0}
									</div>
								</div>
								<div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
									<span className="text-xs font-semibold text-amber-400">Reported No-Show</span>
									<div className="text-2xl font-bold text-white mt-1">
										{overviewData?.status_distribution?.no_show || 0}
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* ----------------- TAB 2: PROVIDER APPROVAL PIPELINE ----------------- */}
				{activeTab === "providers" && (
					<div className="space-y-6">
						{/* Header Controls */}
						<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900/60 border border-slate-800/80">
							{/* Status Filter Buttons */}
							<div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 overflow-x-auto w-full sm:w-auto">
								{["all", "pending", "approved", "rejected", "suspended"].map((st) => (
									<button
										key={st}
										onClick={() => setProviderStatusFilter(st)}
										className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize cursor-pointer transition-colors whitespace-nowrap ${
											providerStatusFilter === st
												? "bg-violet-600 text-white"
												: "text-slate-400 hover:text-white"
										}`}
									>
										{st}
									</button>
								))}
							</div>

							{/* Search Input */}
							<div className="relative w-full sm:w-72">
								<Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
								<input
									type="text"
									placeholder="Search pro name, city, email..."
									value={providerSearch}
									onChange={(e) => setProviderSearch(e.target.value)}
									className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
								/>
							</div>
						</div>

						{/* Providers List / Table */}
						{loadingProviders ? (
							<div className="py-20 text-center text-slate-400 flex items-center justify-center gap-2">
								<RefreshCw size={18} className="animate-spin text-violet-400" />
								Loading applications...
							</div>
						) : providers.length === 0 ? (
							<div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800/80 text-center space-y-2">
								<Users size={32} className="mx-auto text-slate-600" />
								<h3 className="text-base font-bold text-slate-300">No Providers Found</h3>
								<p className="text-xs text-slate-500">
									No providers match the status filter <span className="text-violet-400">"{providerStatusFilter}"</span>.
								</p>
							</div>
						) : (
							<div className="grid grid-cols-1 gap-4">
								{providers.map((p) => {
									const statusCls =
										p.status === "approved"
											? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
											: p.status === "pending"
												? "bg-amber-500/15 text-amber-300 border-amber-500/30"
												: p.status === "rejected"
													? "bg-rose-500/15 text-rose-300 border-rose-500/30"
													: "bg-slate-700/30 text-slate-400 border-slate-700";

									return (
										<div
											key={p.user_id}
											className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
										>
											{/* Provider Info */}
											<div className="flex items-start gap-4">
												<div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden">
													{p.photo ? (
														<img src={p.photo} alt={p.name} className="h-full w-full object-cover" />
													) : (
														p.name?.charAt(0) || "P"
													)}
												</div>
												<div className="space-y-1">
													<div className="flex items-center gap-2.5 flex-wrap">
														<h4 className="font-bold text-white text-base">{p.name}</h4>
														<span className="text-xs text-slate-500 font-mono">[{p.custom_id || "N/A"}]</span>
														<span
															className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCls}`}
														>
															{p.status}
														</span>
													</div>
													<div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
														<span className="flex items-center gap-1">
															<Mail size={12} /> {p.email}
														</span>
														<span className="flex items-center gap-1">
															<Phone size={12} /> {p.phone || "No phone"}
														</span>
														<span className="flex items-center gap-1">
															<MapPin size={12} /> {p.location || "City not set"}
														</span>
													</div>
													{p.bio && <p className="text-xs text-slate-400 italic line-clamp-1 mt-1">{p.bio}</p>}
													{p.rejection_reason && (
														<p className="text-xs text-rose-400 font-medium">Reason: {p.rejection_reason}</p>
													)}
												</div>
											</div>

											{/* Services & Actions */}
											<div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
												<div className="text-right sm:pr-4 sm:border-r sm:border-slate-800">
													<span className="text-[10px] uppercase text-slate-500 font-semibold block">Base Pricing</span>
													<span className="text-sm font-bold text-violet-300">
														{p.base_price ? formatCurrency(p.base_price) : "Custom Rate"}
													</span>
												</div>

												{/* Action Buttons */}
												<div className="flex items-center gap-2">
													{p.status !== "approved" && (
														<button
															disabled={actionInProgress === p.user_id}
															onClick={() => handleUpdateProviderStatus(p.user_id, "approved")}
															className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
														>
															<Check size={14} />
															Approve
														</button>
													)}
													{p.status !== "rejected" && (
														<button
															disabled={actionInProgress === p.user_id}
															onClick={() => setSelectedProviderForReject(p)}
															className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
														>
															<XCircle size={14} />
															Reject
														</button>
													)}
													{p.status === "approved" && (
														<button
															disabled={actionInProgress === p.user_id}
															onClick={() => handleUpdateProviderStatus(p.user_id, "suspended")}
															className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
														>
															<Ban size={14} />
															Suspend
														</button>
													)}
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}

				{/* ----------------- TAB 3: DISPUTE & REFUND MANAGEMENT ----------------- */}
				{activeTab === "disputes" && (
					<div className="space-y-6">
						<div className="flex items-center justify-between p-4 rounded-3xl bg-slate-900/60 border border-slate-800/80">
							<div className="flex items-center gap-2">
								<AlertTriangle size={18} className="text-amber-400" />
								<h2 className="text-sm font-bold text-white uppercase tracking-wider">Dispute Resolution Desk</h2>
							</div>

							{/* Status Filter */}
							<div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
								{["all", "opened", "resolved", "rejected"].map((st) => (
									<button
										key={st}
										onClick={() => setDisputeStatusFilter(st)}
										className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize cursor-pointer transition-colors ${
											disputeStatusFilter === st
												? "bg-violet-600 text-white"
												: "text-slate-400 hover:text-white"
										}`}
									>
										{st}
									</button>
								))}
							</div>
						</div>

						{loadingDisputes ? (
							<div className="py-20 text-center text-slate-400 flex items-center justify-center gap-2">
								<RefreshCw size={18} className="animate-spin text-violet-400" />
								Loading disputes...
							</div>
						) : disputes.length === 0 ? (
							<div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800/80 text-center space-y-2">
								<CheckCircle2 size={32} className="mx-auto text-emerald-500" />
								<h3 className="text-base font-bold text-slate-300">Clean Slate! No Open Disputes</h3>
								<p className="text-xs text-slate-500">All customer claims and cancellation disputes have been addressed.</p>
							</div>
						) : (
							<div className="grid grid-cols-1 gap-4">
								{disputes.map((d) => (
									<div
										key={d.dispute_id}
										className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4"
									>
										<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
											<div>
												<div className="flex items-center gap-2">
													<span className="text-xs font-mono text-slate-400">Claim ID: {d.dispute_id.substring(0, 8)}</span>
													<span
														className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
															d.status === "resolved"
																? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
																: d.status === "opened"
																	? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
																	: "bg-slate-800 text-slate-300"
														}`}
													>
														{d.status}
													</span>
												</div>
												<h4 className="text-base font-bold text-white mt-1">{d.reason}</h4>
											</div>
											<div className="text-right">
												<span className="text-[10px] text-slate-500 uppercase block">Booking Price</span>
												<span className="text-sm font-bold text-violet-300">
													{formatCurrency(d.booking_price)}
												</span>
											</div>
										</div>

										{/* Details */}
										<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
											<div>
												<span className="text-[10px] text-slate-500 uppercase font-semibold block">Customer</span>
												<p className="font-medium text-slate-200">{d.customer_name}</p>
												<p>{d.customer_email}</p>
											</div>
											<div>
												<span className="text-[10px] text-slate-500 uppercase font-semibold block">Provider</span>
												<p className="font-medium text-slate-200">{d.provider_name}</p>
												<p>{d.provider_email}</p>
											</div>
											<div>
												<span className="text-[10px] text-slate-500 uppercase font-semibold block">Service & Date</span>
												<p className="font-medium text-slate-200">{d.service_name || "General Service"}</p>
												<p>{d.booking_date} at {d.start_time}</p>
											</div>
										</div>

										{d.details && (
											<div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300">
												<span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Customer Claim Details:</span>
												{d.details}
											</div>
										)}

										{d.status === "resolved" && (
											<div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300">
												<span className="font-bold">Resolution:</span> {d.resolution_notes || "Dispute resolved."}
												{d.refund_amount > 0 && <span className="ml-2 font-bold">Refund Granted: {formatCurrency(d.refund_amount)}</span>}
											</div>
										)}

										{d.status === "opened" && (
											<div className="pt-2 flex justify-end">
												<button
													onClick={() => {
														setSelectedDisputeForResolve(d);
														setResolveForm({
															status: "resolved",
															refund_amount: d.booking_price || 0,
															resolution_notes: "Refund granted following investigation.",
														});
													}}
													className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer transition-colors"
												>
													Take Action / Resolve
												</button>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{/* ----------------- TAB 4: PLATFORM & COMMISSION SETTINGS ----------------- */}
				{activeTab === "settings" && (
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
						{/* Settings Form */}
						<div className="lg:col-span-7 p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-6">
							<div>
								<h2 className="text-lg font-bold text-white flex items-center gap-2">
									<Sliders size={18} className="text-violet-400" />
									Fee & Commission Controls
								</h2>
								<p className="text-xs text-slate-400">Configure marketplace commission rates and cancellation fee policies</p>
							</div>

							<form onSubmit={handleSaveSettings} className="space-y-6">
								{/* Commission Rate */}
								<div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
									<label className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
										Platform Take Rate (% Commission)
									</label>
									<div className="flex items-center gap-4">
										<input
											type="range"
											min="0"
											max="50"
											step="1"
											value={settings.commission_rate?.percentage || 15}
											onChange={(e) =>
												setSettings((prev) => ({
													...prev,
													commission_rate: {
														...prev.commission_rate,
														percentage: e.target.value,
													},
												}))
											}
											className="w-full accent-violet-500 cursor-pointer"
										/>
										<span className="text-base font-bold text-violet-400 w-16 text-right">
											{settings.commission_rate?.percentage || 15}%
										</span>
									</div>
									<p className="text-[11px] text-slate-400">
										Applied to all completed booking transactions prior to provider payout transfer.
									</p>
								</div>

								{/* Minimum Platform Fee */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
										<label className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
											Minimum Platform Fee (₹)
										</label>
										<input
											type="number"
											min="0"
											value={settings.commission_rate?.min_fee || 50}
											onChange={(e) =>
												setSettings((prev) => ({
													...prev,
													commission_rate: {
														...prev.commission_rate,
														min_fee: e.target.value,
													},
												}))
											}
											className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-bold"
										/>
									</div>

									<div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
										<label className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
											Customer Cancellation Fee (₹)
										</label>
										<input
											type="number"
											min="0"
											value={settings.cancellation_fee?.customer_fee || 100}
											onChange={(e) =>
												setSettings((prev) => ({
													...prev,
													cancellation_fee: {
														...prev.cancellation_fee,
														customer_fee: e.target.value,
													},
												}))
											}
											className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-bold"
										/>
									</div>
								</div>

								<div className="pt-2">
									<button
										type="submit"
										disabled={savingSettings}
										className="px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-sm shadow-xl shadow-violet-600/30 cursor-pointer transition-all disabled:opacity-50"
									>
										{savingSettings ? "Saving Settings..." : "Save Platform Settings"}
									</button>
								</div>
							</form>
						</div>

						{/* Live Calculation Preview */}
						<div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-6">
							<div>
								<h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
									Live Payout Preview Simulator
								</h3>
								<p className="text-xs text-slate-400">Hypothetical revenue distribution on a ₹1,000 job</p>
							</div>

							<div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
								<div className="flex justify-between text-sm">
									<span className="text-slate-400">Service Base Total</span>
									<span className="font-bold text-white">{formatCurrency(commissionPreview.baseAmount)}</span>
								</div>
								<div className="flex justify-between text-sm text-emerald-400 font-semibold border-t border-slate-800/80 pt-3">
									<span>TaskGenie Platform Cut ({commissionPreview.pct}%)</span>
									<span>+ {formatCurrency(commissionPreview.commission)}</span>
								</div>
								<div className="flex justify-between text-sm text-violet-300 font-semibold border-t border-slate-800/80 pt-3">
									<span>Provider Net Payout</span>
									<span>{formatCurrency(commissionPreview.providerEarnings)}</span>
								</div>
							</div>

							<div className="p-4 rounded-2xl bg-violet-950/20 border border-violet-800/30 text-xs text-violet-300 flex items-start gap-2">
								<ShieldCheck size={16} className="shrink-0 mt-0.5" />
								<span>
									All platform updates apply in real time to dynamic revenue reporting and upcoming payout schedules.
								</span>
							</div>
						</div>
					</div>
				)}
			</main>

			{/* Rejection Reason Modal */}
			<AnimatePresence>
				{selectedProviderForReject && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4"
						>
							<div className="flex items-center gap-2 text-rose-400">
								<XCircle size={20} />
								<h3 className="font-bold text-base text-white">Reject Provider Application</h3>
							</div>
							<p className="text-xs text-slate-400">
								State the reason for rejecting <span className="text-white font-semibold">{selectedProviderForReject.name}</span>. This feedback will be sent via system notification.
							</p>

							<textarea
								rows="3"
								placeholder="e.g. Incomplete credentials, invalid phone, or unverified trade certificate."
								value={rejectionReason}
								onChange={(e) => setRejectionReason(e.target.value)}
								className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
							/>

							<div className="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onClick={() => {
										setSelectedProviderForReject(null);
										setRejectionReason("");
									}}
									className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
								>
									Cancel
								</button>
								<button
									type="button"
									disabled={actionInProgress === selectedProviderForReject.user_id}
									onClick={() =>
										handleUpdateProviderStatus(
											selectedProviderForReject.user_id,
											"rejected",
											rejectionReason,
										)
									}
									className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
								>
									Confirm Rejection
								</button>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>

			{/* Dispute Resolution Modal */}
			<AnimatePresence>
				{selectedDisputeForResolve && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							className="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4"
						>
							<div className="flex items-center gap-2 text-violet-400">
								<ShieldCheck size={20} />
								<h3 className="font-bold text-base text-white">Resolve Dispute Claim</h3>
							</div>

							<form onSubmit={handleResolveDispute} className="space-y-4">
								<div className="space-y-1 text-xs">
									<span className="text-slate-400">Customer: {selectedDisputeForResolve.customer_name}</span>
									<span className="block text-slate-400">Provider: {selectedDisputeForResolve.provider_name}</span>
									<span className="block text-slate-200 font-semibold">
										Claim: {selectedDisputeForResolve.reason}
									</span>
								</div>

								<div className="space-y-2">
									<label className="text-xs font-bold text-slate-300 block uppercase">Resolution Action</label>
									<select
										value={resolveForm.status}
										onChange={(e) => setResolveForm({ ...resolveForm, status: e.target.value })}
										className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
									>
										<option value="resolved">Resolve & Grant Refund</option>
										<option value="rejected">Dismiss Claim (No Refund)</option>
									</select>
								</div>

								{resolveForm.status === "resolved" && (
									<div className="space-y-2">
										<label className="text-xs font-bold text-slate-300 block uppercase">
											Refund Amount (₹) - Max {formatCurrency(selectedDisputeForResolve.booking_price)}
										</label>
										<input
											type="number"
											min="0"
											max={selectedDisputeForResolve.booking_price || 99999}
											value={resolveForm.refund_amount}
											onChange={(e) =>
												setResolveForm({ ...resolveForm, refund_amount: e.target.value })
											}
											className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-bold"
										/>
									</div>
								)}

								<div className="space-y-2">
									<label className="text-xs font-bold text-slate-300 block uppercase">Resolution Notes</label>
									<textarea
										rows="3"
										required
										placeholder="Provide reasoning for records..."
										value={resolveForm.resolution_notes}
										onChange={(e) =>
											setResolveForm({ ...resolveForm, resolution_notes: e.target.value })
										}
										className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
									/>
								</div>

								<div className="flex justify-end gap-2 pt-2">
									<button
										type="button"
										onClick={() => setSelectedDisputeForResolve(null)}
										className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
									>
										Cancel
									</button>
									<button
										type="submit"
										disabled={actionInProgress === selectedDisputeForResolve.dispute_id}
										className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
									>
										Finalize Resolution
									</button>
								</div>
							</form>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</div>
	);
}
