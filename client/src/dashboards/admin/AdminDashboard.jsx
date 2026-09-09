import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	LayoutDashboard,
	Users,
	AlertTriangle,
	Sliders,
	CheckCircle2,
	XCircle,
	Clock,
	TrendingUp,
	IndianRupee,
	Search,
	RefreshCw,
	MapPin,
	Calendar,
	Check,
	Phone,
	Mail,
	Ban,
	Download,
	Eye,
	X,
	LogOut,
	ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import api from "../../api/axiosInstance";
import { useAuth } from "../../contexts/AuthContext";
import ConfirmDialog from "../../ui/ConfirmDialog";
import Logo from "../../ui/Logo";

const formatCurrency = (val) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(val || 0);

export default function AdminDashboard() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState("overview");

	// Overview state
	const [overviewData, setOverviewData] = useState(null);
	const [loadingOverview, setLoadingOverview] = useState(true);

	// Providers state
	const [providers, setProviders] = useState([]);
	const [providersMeta, setProvidersMeta] = useState({
		page: 1,
		total_pages: 1,
		total: 0,
	});
	const [providerStatusFilter, setProviderStatusFilter] = useState("all");
	const [providerSearch, setProviderSearch] = useState("");
	const [loadingProviders, setLoadingProviders] = useState(false);
	const [inspectingProvider, setInspectingProvider] = useState(null);
	const [selectedProviderForReject, setSelectedProviderForReject] =
		useState(null);
	const [rejectionReason, setRejectionReason] = useState("");
	const [actionInProgress, setActionInProgress] = useState(null);

	// Disputes state
	const [disputes, setDisputes] = useState([]);
	const [disputesMeta, setDisputesMeta] = useState({
		page: 1,
		total_pages: 1,
		total: 0,
	});
	const [disputeStatusFilter, setDisputeStatusFilter] = useState("all");
	const [loadingDisputes, setLoadingDisputes] = useState(false);
	const [selectedDisputeForResolve, setSelectedDisputeForResolve] =
		useState(null);
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

	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

	const handleLogoutClick = () => {
		setShowLogoutConfirm(true);
	};

	const executeLogout = () => {
		setShowLogoutConfirm(false);
		logout();
		navigate("/login");
	};

	// 1. Fetch Overview
	const fetchOverview = useCallback(async () => {
		setLoadingOverview(true);
		try {
			const res = await api.get("/api/admin/overview");
			if (res.data?.success) {
				setOverviewData(res.data);
			}
		} catch (err) {
			console.error("Failed to load overview:", err);
			toast.error("Could not load overview data");
		} finally {
			setLoadingOverview(false);
		}
	}, []);

	// 2. Fetch Providers
	const fetchProviders = useCallback(
		async (page = 1) => {
			setLoadingProviders(true);
			try {
				const params = {
					status: providerStatusFilter,
					search: providerSearch,
					page,
					limit: 15,
				};
				const res = await api.get("/api/admin/providers", { params });
				if (res.data?.success) {
					setProviders(res.data.data || []);
					setProvidersMeta(
						res.data.meta || { page: 1, total_pages: 1, total: 0 },
					);
				}
			} catch (err) {
				console.error("Failed to load providers:", err);
				toast.error("Could not load providers list");
			} finally {
				setLoadingProviders(false);
			}
		},
		[providerStatusFilter, providerSearch],
	);

	// 3. Fetch Disputes
	const fetchDisputes = useCallback(
		async (page = 1) => {
			setLoadingDisputes(true);
			try {
				const params = {
					status: disputeStatusFilter,
					page,
					limit: 10,
				};
				const res = await api.get("/api/admin/disputes", { params });
				if (res.data?.success) {
					setDisputes(res.data.data || []);
					setDisputesMeta(
						res.data.meta || { page: 1, total_pages: 1, total: 0 },
					);
				}
			} catch (err) {
				console.error("Failed to load disputes:", err);
				toast.error("Could not load disputes list");
			} finally {
				setLoadingDisputes(false);
			}
		},
		[disputeStatusFilter],
	);

	// 4. Fetch Settings
	const fetchSettings = useCallback(async () => {
		setLoadingSettings(true);
		try {
			const res = await api.get("/api/admin/settings");
			if (res.data?.success && res.data.settings) {
				setSettings(res.data.settings);
			}
		} catch (err) {
			console.error("Failed to load settings:", err);
		} finally {
			setLoadingSettings(false);
		}
	}, []);

	useEffect(() => {
		if (activeTab === "overview") fetchOverview();
		else if (activeTab === "providers") fetchProviders(1);
		else if (activeTab === "disputes") fetchDisputes(1);
		else if (activeTab === "settings") fetchSettings();
	}, [activeTab, fetchOverview, fetchProviders, fetchDisputes, fetchSettings]);

	const handleUpdateProviderStatus = async (
		providerId,
		newStatus,
		reason = null,
	) => {
		setActionInProgress(providerId);
		try {
			const res = await api.put(`/api/admin/providers/${providerId}/status`, {
				status: newStatus,
				rejection_reason: reason,
			});
			if (res.data?.success) {
				toast.success(`Provider status updated to ${newStatus}`);
				fetchProviders(providersMeta.page);
				if (overviewData) fetchOverview();
				if (inspectingProvider?.user_id === providerId) {
					setInspectingProvider((prev) =>
						prev
							? { ...prev, status: newStatus, rejection_reason: reason }
							: null,
					);
				}
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to update status");
		} finally {
			setActionInProgress(null);
			setSelectedProviderForReject(null);
			setRejectionReason("");
		}
	};

	const handleResolveDispute = async (e) => {
		e.preventDefault();
		if (!selectedDisputeForResolve) return;
		setActionInProgress(selectedDisputeForResolve.dispute_id);

		try {
			const res = await api.put(
				`/api/admin/disputes/${selectedDisputeForResolve.dispute_id}/resolve`,
				{
					status: resolveForm.status,
					refund_amount: Number(resolveForm.refund_amount) || 0,
					resolution_notes: resolveForm.resolution_notes,
				},
			);
			if (res.data?.success) {
				toast.success("Dispute resolved successfully");
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

	const handleSaveSettings = async (e) => {
		e.preventDefault();
		setSavingSettings(true);
		try {
			const res = await api.put("/api/admin/settings", settings);
			if (res.data?.success) {
				toast.success("Settings saved successfully");
				fetchOverview();
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to save settings");
		} finally {
			setSavingSettings(false);
		}
	};

	const commissionRate = Number(settings.commission_rate?.percentage) || 15;
	const sampleAmount = 1000;
	const sampleCommission = Math.round(sampleAmount * (commissionRate / 100));
	const samplePayout = sampleAmount - sampleCommission;

	return (
		<div className="min-h-screen bg-[#090514] text-slate-100 antialiased">
			{/* Top Navbar */}
			<header className="sticky top-0 z-40 bg-[#0e0822] border-b border-white/[0.08]">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						{/* Brand / Logo */}
						<div className="flex items-center gap-4">
							<Logo to="/" size="md" theme="dark" />

							<div className="hidden sm:block h-4 w-px bg-white/10" />
							<span className="font-mackinac hidden sm:inline-block text-xs font-semibold text-slate-400">
								Admin Console
							</span>
						</div>

						{/* Clean Tab Navigation */}
						<nav className="font-bricolage flex items-center gap-1 sm:gap-2">
							<button
								onClick={() => setActiveTab("overview")}
								className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
									activeTab === "overview"
										? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
										: "text-slate-400 hover:text-white hover:bg-white/[0.04]"
								}`}
							>
								Overview
							</button>
							<button
								onClick={() => setActiveTab("providers")}
								className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
									activeTab === "providers"
										? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
										: "text-slate-400 hover:text-white hover:bg-white/[0.04]"
								}`}
							>
								<span>Providers</span>
								{overviewData?.overview?.pending_approvals > 0 && (
									<span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
										{overviewData.overview.pending_approvals}
									</span>
								)}
							</button>
							<button
								onClick={() => setActiveTab("disputes")}
								className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
									activeTab === "disputes"
										? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
										: "text-slate-400 hover:text-white hover:bg-white/[0.04]"
								}`}
							>
								<span>Disputes</span>
								{overviewData?.overview?.active_disputes > 0 && (
									<span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
										{overviewData.overview.active_disputes}
									</span>
								)}
							</button>
							<button
								onClick={() => setActiveTab("settings")}
								className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
									activeTab === "settings"
										? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
										: "text-slate-400 hover:text-white hover:bg-white/[0.04]"
								}`}
							>
								Settings
							</button>
						</nav>

						{/* User & Log Out */}
						<div className="flex items-center gap-3">
							<span className="hidden md:inline text-xs text-slate-400 font-medium truncate max-w-[160px]">
								{user?.email || "admin@taskgenie.com"}
							</span>
							<button
								onClick={handleLogoutClick}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
								title="Log out of admin session"
							>
								<LogOut size={13} />
								<span>Log Out</span>
							</button>
						</div>
					</div>
				</div>
			</header>

			{/* Main Workspace */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
				{/* -------------------- 1. OVERVIEW -------------------- */}
				{activeTab === "overview" && (
					<div className="space-y-6">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
							<div>
								<h2 className="font-mackinac text-xl sm:text-2xl font-bold text-white">
									Platform Overview
								</h2>
								<p className="font-bricolage text-xs sm:text-sm text-slate-400">
									Key transaction activity, revenue, and active operations.
								</p>
							</div>
							<button
								onClick={fetchOverview}
								className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer"
							>
								<RefreshCw
									size={13}
									className={
										loadingOverview ? "animate-spin text-violet-400" : ""
									}
								/>
								<span>Refresh Data</span>
							</button>
						</div>

						{/* 4 Stats Cards */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<div className="p-5 rounded-2xl bg-[#110a22] border border-white/[0.07] space-y-2">
								<span className="font-bricolage text-sm font-semibold text-slate-400">
									Total Booking Volume (GMV)
								</span>
								<div className="font-mackinac text-2xl sm:text-3xl font-bold text-white">
									{loadingOverview
										? "..."
										: formatCurrency(overviewData?.overview?.total_gmv)}
								</div>
								<p className="inter text-sm text-slate-400">
									Gross completed transactions
								</p>
							</div>

							<div className="p-5 rounded-2xl bg-[#110a22] border border-white/[0.07] space-y-2">
								<span className="text-sm font-semibold text-slate-400">
									Platform Commission (
									{overviewData?.overview?.commission_percentage || 15}%)
								</span>
								<div className="font-mackinac text-2xl sm:text-3xl font-bold text-emerald-400">
									{loadingOverview
										? "..."
										: formatCurrency(
												overviewData?.overview?.platform_commission,
											)}
								</div>
								<p className="text-sm text-slate-400">Retained revenue</p>
							</div>

							<div className="p-5 rounded-2xl bg-[#110a22] border border-white/[0.07] space-y-2">
								<span className="font-bricolage text-sm font-semibold text-slate-400">
									Total Bookings
								</span>
								<div className="font-mackinac text-2xl sm:text-3xl font-bold text-white">
									{loadingOverview
										? "..."
										: overviewData?.overview?.total_bookings || 0}
								</div>
								<p className="inter text-sm text-blue-400">
									{overviewData?.overview?.active_bookings || 0} active right
									now
								</p>
							</div>

							<div className="p-5 rounded-2xl bg-[#110a22] border border-white/[0.07] space-y-2">
								<span className="font-bricolage text-sm font-semibold text-slate-400">
									Active Providers
								</span>
								<div className="font-mackinac text-2xl sm:text-3xl font-bold text-white">
									{loadingOverview
										? "..."
										: overviewData?.overview?.approved_providers || 0}
								</div>
								<p className="text-sm text-amber-400">
									{overviewData?.overview?.pending_approvals || 0} awaiting
									approval
								</p>
							</div>
						</div>

						{/* Charts & Breakdown */}
						<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
							{/* Hourly Activity */}
							<div className="lg:col-span-8 p-6 rounded-2xl bg-[#110a22] border border-white/[0.07] space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="font-mackinac text-lg font-bold text-white">
											Booking Activity by Hour
										</h3>
										<p className="inter text-sm text-slate-400">
											Customer requested slots{" "}
											<span className="font-editorial">(7 AM – 10 PM)</span>
										</p>
									</div>
								</div>

								<div className="h-56 flex items-end gap-2 pt-6 pb-2 px-1 overflow-x-auto">
									{overviewData?.peak_hours?.map((slot) => {
										const maxCount = Math.max(
											...(overviewData?.peak_hours?.map((p) => p.bookings) || [
												1,
											]),
											1,
										);
										const heightPct = Math.max(
											8,
											Math.round((slot.bookings / maxCount) * 100),
										);
										const hasBookings = slot.bookings > 0;

										return (
											<div
												key={slot.hour}
												className="flex-1 min-w-[28px] flex flex-col items-center gap-2 group relative"
											>
												<div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 px-2 py-1 rounded bg-[#1f1338] text-[10px] font-bold text-white pointer-events-none whitespace-nowrap z-20 border border-white/10">
													{slot.bookings} Bookings
												</div>
												<div className="font-editorial w-full h-36 bg-white/[0.03] rounded-lg flex items-end p-0.5 overflow-hidden">
													<div
														style={{ height: `${heightPct}%` }}
														className={`w-full rounded-md transition-all ${
															hasBookings
																? "bg-violet-500 shadow-sm"
																: "bg-white/[0.08]"
														}`}
													/>
												</div>
												<span className="font-editorial text-[11px] text-slate-400 truncate">
													{slot.label}
												</span>
											</div>
										);
									})}
								</div>
							</div>

							{/* Top Locations */}
							<div className="lg:col-span-4 p-6 rounded-2xl bg-[#110a22] border border-white/[0.07] space-y-4">
								<div>
									<h3 className="font-mackinac text-lg font-bold text-white">
										Top Locations
									</h3>
									<p className="inter text-sm text-slate-400">
										City booking distribution
									</p>
								</div>

								<div className="space-y-3 font-raleway">
									{overviewData?.top_locations?.length > 0 ? (
										overviewData.top_locations.map((loc, idx) => {
											const maxB = Math.max(
												...overviewData.top_locations.map((l) => l.bookings),
												1,
											);
											const pct = Math.round((loc.bookings / maxB) * 100);

											return (
												<div
													key={idx}
													className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1.5"
												>
													<div className="flex justify-between text-sm">
														<span className="font-semibold text-slate-200 truncate">
															{loc.city}
														</span>
														<span className="font-editorial text-slate-400">
															{loc.bookings} jobs ({formatCurrency(loc.revenue)}
															)
														</span>
													</div>
													<div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
														<div
															style={{ width: `${pct}%` }}
															className="h-full rounded-full bg-violet-500"
														/>
													</div>
												</div>
											);
										})
									) : (
										<p className="text-xs text-slate-500 py-6 text-center">
											No location booking records yet.
										</p>
									)}
								</div>
							</div>
						</div>

						{/* Booking Status Summary */}
						<div className="p-5 rounded-2xl bg-[#110a22] border border-white/[0.07] space-y-3">
							<h3 className="font-bricolage text-xs font-bold text-slate-400 uppercase tracking-wider">
								Booking Status Summary
							</h3>
							<div className="font-mackinac grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
								<div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
									<span className="text-slate-400 block">Completed</span>
									<span className="text-xl font-bold text-emerald-400 mt-1 block">
										{overviewData?.status_distribution?.completed || 0}
									</span>
								</div>
								<div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
									<span className="text-slate-400 block">
										Active / Scheduled
									</span>
									<span className="text-xl font-bold text-blue-400 mt-1 block">
										{overviewData?.status_distribution?.active || 0}
									</span>
								</div>
								<div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
									<span className="text-slate-400 block">Cancelled</span>
									<span className="text-xl font-bold text-rose-400 mt-1 block">
										{overviewData?.status_distribution?.cancelled || 0}
									</span>
								</div>
								<div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
									<span className="text-slate-400 block">No-Show</span>
									<span className="text-xl font-bold text-amber-400 mt-1 block">
										{overviewData?.status_distribution?.no_show || 0}
									</span>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* -------------------- 2. PROVIDERS -------------------- */}
				{activeTab === "providers" && (
					<div className="space-y-6">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div>
								<h2 className="font-mackinac text-xl sm:text-2xl font-bold text-white">
									Service Providers
								</h2>
								<p className="font-bricolage text-xs sm:text-sm text-slate-400">
									Manage provider applications, verify documents, and review
									active listings.
								</p>
							</div>

							{/* Search Box */}
							<div className="relative w-full sm:w-72">
								<Search
									size={14}
									className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
								/>
								<input
									type="text"
									placeholder="Search name, city, email..."
									value={providerSearch}
									onChange={(e) => setProviderSearch(e.target.value)}
									className="font-bricolage w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
								/>
							</div>
						</div>

						{/* Filter Pills */}
						<div className=" font-mackinac  flex items-center gap-1.5 overflow-x-auto pb-1">
							{["all", "pending", "approved", "rejected", "suspended"].map(
								(st) => (
									<button
										key={st}
										onClick={() => setProviderStatusFilter(st)}
										className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-colors ${
											providerStatusFilter === st
												? "bg-violet-600 text-white"
												: "bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.06]"
										}`}
									>
										{st}
									</button>
								),
							)}
						</div>

						{/* Providers List */}
						{loadingProviders ? (
							<div className="font-bricolage py-20 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
								<RefreshCw size={15} className="animate-spin text-violet-400" />
								<span>Loading providers...</span>
							</div>
						) : providers.length === 0 ? (
							<div className="font-bricolage p-12 rounded-2xl bg-[#110a22] border border-white/[0.07] text-center space-y-2">
								<p className="text-[17px] font-semibold text-slate-300">
									No providers found
								</p>
								<p className="text-sm text-slate-500">
									No results matching your search or filter.
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{providers.map((p) => {
									const statusCls =
										p.status === "approved"
											? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
											: p.status === "pending"
												? "text-amber-300 bg-amber-500/10 border-amber-500/20"
												: p.status === "rejected"
													? "text-rose-400 bg-rose-500/10 border-rose-500/20"
													: "text-slate-400 bg-white/5 border-white/10";

									return (
										<div
											key={p.user_id}
											className="p-4 sm:p-5 rounded-2xl bg-[#110a22] border border-white/[0.07] flex flex-col md:flex-row md:items-center justify-between gap-4"
										>
											<div className="flex items-start gap-3.5">
												<div className="font-mackinac w-11 h-11 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
													{p.photo ? (
														<img
															src={p.photo}
															alt={p.name}
															className="h-full w-full object-cover"
														/>
													) : (
														p.name?.charAt(0) || "P"
													)}
												</div>

												<div className="space-y-1">
													<div className="flex items-center gap-2.5 flex-wrap">
														<span className="font-mackinac font-bold text-white text-[17px]">
															{p.name}
														</span>
														<span className="text-[11px] font-mono text-slate-400">
															{p.custom_id || ""}
														</span>
														<span
															className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${statusCls}`}
														>
															{p.status}
														</span>
													</div>

													<div className="flex items-center gap-5 text-xs text-slate-400 flex-wrap">
														<span>{p.email}</span>
														{p.phone && <span> • {p.phone}</span>}
														{p.location && <span> • {p.location}</span>}
													</div>

													{p.bio && (
														<p className="font-bricolage text-[13.5px] text-slate-400 line-clamp-1 pt-2">
															{p.bio}
														</p>
													)}
													{p.rejection_reason && (
														<p className="text-xs text-rose-400 font-medium">
															Reason: {p.rejection_reason}
														</p>
													)}
												</div>
											</div>

											{/* Actions */}
											<div className="font-bricolage flex items-center justify-between md:justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
												<button
													onClick={() => setInspectingProvider(p)}
													className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 text-sm font-semibold transition-colors cursor-pointer"
												>
													Details
												</button>

												{p.status !== "approved" && (
													<button
														disabled={actionInProgress === p.user_id}
														onClick={() =>
															handleUpdateProviderStatus(p.user_id, "approved")
														}
														className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50"
													>
														Approve
													</button>
												)}

												{p.status !== "rejected" && (
													<button
														disabled={actionInProgress === p.user_id}
														onClick={() => setSelectedProviderForReject(p)}
														className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50"
													>
														Reject
													</button>
												)}

												{p.status === "approved" && (
													<button
														disabled={actionInProgress === p.user_id}
														onClick={() =>
															handleUpdateProviderStatus(p.user_id, "suspended")
														}
														className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 border border-white/10 text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50"
													>
														Suspend
													</button>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}

				{/* -------------------- 3. DISPUTES -------------------- */}
				{activeTab === "disputes" && (
					<div className="space-y-6">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div>
								<h2 className="font-mackinac text-xl sm:text-2xl font-bold text-white">
									Disputes & Refunds
								</h2>
								<p className="font-bricolage text-xs sm:text-sm text-slate-400">
									Review customer complaints and process refund resolutions.
								</p>
							</div>

							<div className="font-mackinac flex items-center gap-1.5">
								{["all", "opened", "resolved", "rejected"].map((st) => (
									<button
										key={st}
										onClick={() => setDisputeStatusFilter(st)}
										className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize cursor-pointer transition-colors ${
											disputeStatusFilter === st
												? "bg-violet-600 text-white"
												: "bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.06]"
										}`}
									>
										{st}
									</button>
								))}
							</div>
						</div>

						{loadingDisputes ? (
							<div className="font-bricolage py-20 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
								<RefreshCw size={15} className="animate-spin text-violet-400" />
								<span>Loading disputes...</span>
							</div>
						) : disputes.length === 0 ? (
							<div className="font-bricolage p-12 rounded-2xl bg-[#110a22] border border-white/[0.07] text-center space-y-2">
								<CheckCircle2 size={32} className="mx-auto text-emerald-400" />
								<p className="text-[17px] font-semibold text-white">
									No active disputes
								</p>
								<p className="text-sm text-slate-400">
									All customer claims have been addressed.
								</p>
							</div>
						) : (
							<div className="space-y-4">
								{disputes.map((d) => (
									<div
										key={d.dispute_id}
										className="p-5 rounded-2xl bg-[#110a22] border border-white/[0.07] space-y-3"
									>
										<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
											<div>
												<div className="flex items-center gap-2">
													<span className="text-xs font-mono text-slate-400">
														Case #{d.dispute_id.slice(0, 8)}
													</span>
													<span
														className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
															d.status === "resolved"
																? "text-emerald-400 bg-emerald-500/10"
																: d.status === "opened"
																	? "text-rose-400 bg-rose-500/10"
																	: "text-slate-400 bg-white/5"
														}`}
													>
														{d.status}
													</span>
												</div>
												<h4 className="text-base font-bold text-white mt-1">
													{d.reason}
												</h4>
											</div>
											<div className="text-right">
												<span className="text-[10px] text-slate-400 uppercase block">
													Booking Amount
												</span>
												<span className="text-sm font-bold text-white">
													{formatCurrency(d.booking_price)}
												</span>
											</div>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
											<div>
												<span className="text-[10px] text-slate-500 uppercase font-bold block">
													Customer
												</span>
												<p className="text-slate-200 font-medium">
													{d.customer_name}
												</p>
												<p>{d.customer_email}</p>
											</div>
											<div>
												<span className="text-[10px] text-slate-500 uppercase font-bold block">
													Provider
												</span>
												<p className="text-slate-200 font-medium">
													{d.provider_name}
												</p>
												<p>{d.provider_email}</p>
											</div>
											<div>
												<span className="text-[10px] text-slate-500 uppercase font-bold block">
													Service & Date
												</span>
												<p className="text-slate-200 font-medium">
													{d.service_name || "General Service"}
												</p>
												<p>
													{d.booking_date} at {d.start_time}
												</p>
											</div>
										</div>

										{d.details && (
											<div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs text-slate-300">
												<span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
													Customer Claim:
												</span>
												{d.details}
											</div>
										)}

										{d.status === "resolved" && (
											<div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
												<span>
													Resolution: {d.resolution_notes || "Resolved."}
												</span>
												{d.refund_amount > 0 && (
													<span className="font-bold">
														Refund: {formatCurrency(d.refund_amount)}
													</span>
												)}
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
															resolution_notes:
																"Refund approved per customer satisfaction guarantee.",
														});
													}}
													className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer transition-colors"
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

				{/* -------------------- 4. SETTINGS -------------------- */}
				{activeTab === "settings" && (
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
						<div className="lg:col-span-7 p-6 rounded-2xl bg-[#110a22] border border-white/[0.07] space-y-6">
							<div>
								<h2 className="font-mackinac text-xl font-bold text-white">
									Platform Settings
								</h2>
								<p className="font-bricolage text-sm text-slate-400 mt-1">
									Set marketplace commission rates and cancellation fee
									policies.
								</p>
							</div>

							<form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
								{/* Commission */}
								<div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-2.5">
									<div className="flex justify-between items-center">
										<label className="font-bricolage text-[15.5px] font-bold text-white">
											Platform Commission (% Take Rate)
										</label>
										<span className="text-sm font-bold text-violet-400">
											{settings.commission_rate?.percentage || 15}%
										</span>
									</div>
									<input
										type="range"
										min="0"
										max="40"
										step="1"
										value={settings.commission_rate?.percentage || 15}
										onChange={(e) =>
											setSettings((prev) => ({
												...prev,
												commission_rate: {
													...prev.commission_rate,
													percentage: Number(e.target.value),
												},
											}))
										}
										className="w-full accent-violet-500 cursor-pointer"
									/>
									<p className="font-bricolage text-[13.5px] text-slate-400">
										Deducted from completed jobs before provider payout.
									</p>
								</div>

								{/* Fees */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<label className="font-bricolage text-[14px] font-semibold text-slate-300 block">
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
														min_fee: Number(e.target.value),
													},
												}))
											}
											className="inter w-full p-2.5 rounded-lg bg-black/40 border border-white/10 text-white font-bold"
										/>
									</div>

									<div className="space-y-1.5">
										<label className="font-bricolage text-[14px] font-semibold text-slate-300 block">
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
														customer_fee: Number(e.target.value),
													},
												}))
											}
											className="inter w-full p-2.5 rounded-lg bg-black/40 border border-white/10 text-white font-bold"
										/>
									</div>
								</div>

								<div className="pt-2">
									<button
										type="submit"
										disabled={savingSettings}
										className="font-bricolage text-sm px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold cursor-pointer transition-colors disabled:opacity-50"
									>
										{savingSettings ? "Saving..." : "Save Settings"}
									</button>
								</div>
							</form>
						</div>

						{/* Simple Example Preview */}
						<div className="lg:col-span-5 p-6 rounded-2xl bg-[#110a22] border border-white/[0.07] space-y-4 text-xs">
							<div>
								<h3 className="font-mackinac text-lg font-bold text-white">
									Live Calculation Example
								</h3>
								<p className="font-bricolage text-slate-400 text-sm">
									Example split on a standard ₹1,000 job
								</p>
							</div>

							<div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-2.5">
								<div className="flex justify-between">
									<span className="font-bricolage text-slate-400">
										Job Total
									</span>
									<span className="inter font-bold text-white">
										{formatCurrency(sampleAmount)}
									</span>
								</div>
								<div className="font-bricolage flex justify-between text-violet-400 border-t border-white/5 pt-2">
									<span>TaskGenie Fee ({commissionRate}%)</span>
									<span className="inter">
										{formatCurrency(sampleCommission)}
									</span>
								</div>
								<div className="font-bricolage flex justify-between text-emerald-400 font-bold border-t border-white/5 pt-2">
									<span>Provider Payout</span>
									<span className="inter">{formatCurrency(samplePayout)}</span>
								</div>
							</div>

							<p className="font-bricolage text-slate-400 leading-relaxed text-[11px]">
								Rate changes take effect immediately on newly completed
								transactions and payout calculations.
							</p>
						</div>
					</div>
				)}
			</main>

			{/* ================= MODALS ================= */}

			{/* 1. Inspect Provider Modal */}
			<AnimatePresence>
				{inspectingProvider && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
						<motion.div
							initial={{ opacity: 0, scale: 0.96 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.96 }}
							className="w-full max-w-lg p-6 rounded-2xl bg-[#130b28] border border-white/10 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto text-xs"
						>
							<div className="flex items-start justify-between border-b border-white/10 pb-3">
								<div className="flex items-center gap-3">
									<div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-base shrink-0 overflow-hidden">
										{inspectingProvider.photo ? (
											<img
												src={inspectingProvider.photo}
												alt={inspectingProvider.name}
												className="h-full w-full object-cover"
											/>
										) : (
											inspectingProvider.name?.charAt(0) || "P"
										)}
									</div>
									<div>
										<h3 className="text-base font-bold text-white">
											{inspectingProvider.name}
										</h3>
										<p className="text-[11px] font-mono text-slate-400">
											{inspectingProvider.custom_id || ""}
										</p>
									</div>
								</div>
								<button
									onClick={() => setInspectingProvider(null)}
									className="p-1 rounded-lg text-slate-400 hover:text-white"
								>
									<X size={16} />
								</button>
							</div>

							<div className="grid grid-cols-2 gap-3 text-slate-300">
								<div>
									<span className="text-[10px] uppercase text-slate-500 font-bold block">
										Status
									</span>
									<span className="font-semibold text-white capitalize">
										{inspectingProvider.status}
									</span>
								</div>
								<div>
									<span className="text-[10px] uppercase text-slate-500 font-bold block">
										Base Rate
									</span>
									<span className="font-semibold text-emerald-400">
										{inspectingProvider.base_price
											? formatCurrency(inspectingProvider.base_price)
											: "Standard"}
									</span>
								</div>
								<div>
									<span className="text-[10px] uppercase text-slate-500 font-bold block">
										Phone
									</span>
									<span>{inspectingProvider.phone || "Not set"}</span>
								</div>
								<div>
									<span className="text-[10px] uppercase text-slate-500 font-bold block">
										Location
									</span>
									<span>{inspectingProvider.location || "Not set"}</span>
								</div>
							</div>

							{inspectingProvider.bio && (
								<div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
									<span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
										Bio
									</span>
									<p className="text-slate-300 leading-relaxed">
										{inspectingProvider.bio}
									</p>
								</div>
							)}

							{inspectingProvider.services?.length > 0 && (
								<div className="space-y-2">
									<span className="text-[10px] text-slate-500 uppercase font-bold block">
										Services Offered
									</span>
									<div className="flex flex-wrap gap-2">
										{inspectingProvider.services.map((s, idx) => (
											<div
												key={idx}
												className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs flex items-center gap-1.5"
											>
												<span className="font-medium text-white">{s.name}</span>
												<span className="text-emerald-400 font-bold">
													{formatCurrency(s.price)}
												</span>
												<span className="text-slate-500 text-[10px]">
													/{s.price_unit || "unit"}
												</span>
											</div>
										))}
									</div>
								</div>
							)}

							<div className="flex justify-end gap-2 pt-3 border-t border-white/10">
								{inspectingProvider.status !== "approved" && (
									<button
										onClick={() =>
											handleUpdateProviderStatus(
												inspectingProvider.user_id,
												"approved",
											)
										}
										className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer transition-colors"
									>
										Approve Provider
									</button>
								)}
								{inspectingProvider.status !== "rejected" && (
									<button
										onClick={() =>
											setSelectedProviderForReject(inspectingProvider)
										}
										className="px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 font-semibold cursor-pointer transition-colors"
									>
										Reject Provider
									</button>
								)}
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>

			{/* 2. Rejection Reason Modal */}
			<AnimatePresence>
				{selectedProviderForReject && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
						<motion.div
							initial={{ opacity: 0, scale: 0.96 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.96 }}
							className="w-full max-w-md p-6 rounded-2xl bg-[#130b28] border border-white/10 shadow-2xl space-y-4 text-xs"
						>
							<div className="flex items-center gap-2 text-rose-400">
								<XCircle size={18} />
								<h3 className="font-bold text-base text-white">
									Reject Provider Application
								</h3>
							</div>
							<p className="text-slate-300">
								Please provide a reason for rejecting{" "}
								<span className="font-bold text-white">
									{selectedProviderForReject.name}
								</span>
								.
							</p>

							<textarea
								rows="3"
								placeholder="e.g. Incomplete credentials, invalid contact info..."
								value={rejectionReason}
								onChange={(e) => setRejectionReason(e.target.value)}
								className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
							/>

							<div className="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onClick={() => {
										setSelectedProviderForReject(null);
										setRejectionReason("");
									}}
									className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
								>
									Cancel
								</button>
								<button
									type="button"
									disabled={
										actionInProgress === selectedProviderForReject.user_id
									}
									onClick={() =>
										handleUpdateProviderStatus(
											selectedProviderForReject.user_id,
											"rejected",
											rejectionReason,
										)
									}
									className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer disabled:opacity-50"
								>
									Confirm Rejection
								</button>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>

			{/* 3. Dispute Resolve Modal */}
			<AnimatePresence>
				{selectedDisputeForResolve && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
						<motion.div
							initial={{ opacity: 0, scale: 0.96 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.96 }}
							className="w-full max-w-lg p-6 rounded-2xl bg-[#130b28] border border-white/10 shadow-2xl space-y-4 text-xs"
						>
							<div className="flex items-center justify-between border-b border-white/10 pb-3">
								<h3 className="font-bold text-base text-white">
									Resolve Dispute
								</h3>
								<button
									onClick={() => setSelectedDisputeForResolve(null)}
									className="p-1 rounded-lg text-slate-400 hover:text-white"
								>
									<X size={16} />
								</button>
							</div>

							<form onSubmit={handleResolveDispute} className="space-y-4">
								<div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
									<p>
										<span className="text-slate-500">Customer:</span>{" "}
										<span className="font-medium text-white">
											{selectedDisputeForResolve.customer_name}
										</span>
									</p>
									<p>
										<span className="text-slate-500">Provider:</span>{" "}
										<span className="font-medium text-white">
											{selectedDisputeForResolve.provider_name}
										</span>
									</p>
									<p>
										<span className="text-slate-500">Amount:</span>{" "}
										<span className="font-bold text-white">
											{formatCurrency(selectedDisputeForResolve.booking_price)}
										</span>
									</p>
								</div>

								<div className="space-y-1.5">
									<label className="font-semibold text-slate-300 block">
										Resolution Action
									</label>
									<select
										value={resolveForm.status}
										onChange={(e) =>
											setResolveForm({ ...resolveForm, status: e.target.value })
										}
										className="w-full p-2.5 rounded-lg bg-black/40 border border-white/10 text-white"
									>
										<option value="resolved" className="bg-[#130b28]">
											Approve & Issue Refund
										</option>
										<option value="rejected" className="bg-[#130b28]">
											Dismiss Dispute (No Refund)
										</option>
									</select>
								</div>

								{resolveForm.status === "resolved" && (
									<div className="space-y-1.5">
										<label className="font-semibold text-slate-300 block">
											Refund Amount (₹)
										</label>
										<input
											type="number"
											min="0"
											max={selectedDisputeForResolve.booking_price || 99999}
											value={resolveForm.refund_amount}
											onChange={(e) =>
												setResolveForm({
													...resolveForm,
													refund_amount: e.target.value,
												})
											}
											className="w-full p-2.5 rounded-lg bg-black/40 border border-white/10 text-white font-bold"
										/>
									</div>
								)}

								<div className="space-y-1.5">
									<label className="font-semibold text-slate-300 block">
										Resolution Notes
									</label>
									<textarea
										rows="3"
										required
										placeholder="State reason for resolution..."
										value={resolveForm.resolution_notes}
										onChange={(e) =>
											setResolveForm({
												...resolveForm,
												resolution_notes: e.target.value,
											})
										}
										className="w-full p-3 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none"
									/>
								</div>

								<div className="flex justify-end gap-2 pt-2 border-t border-white/10">
									<button
										type="button"
										onClick={() => setSelectedDisputeForResolve(null)}
										className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
									>
										Cancel
									</button>
									<button
										type="submit"
										disabled={
											actionInProgress === selectedDisputeForResolve.dispute_id
										}
										className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold cursor-pointer disabled:opacity-50"
									>
										Finalize Resolution
									</button>
								</div>
							</form>
						</motion.div>
					</div>
				)}
			</AnimatePresence>

			{/* Logout Confirmation Modal */}
			<ConfirmDialog
				isOpen={showLogoutConfirm}
				onClose={() => setShowLogoutConfirm(false)}
				onConfirm={executeLogout}
				title="Log out?"
				description="You'll need to sign in again to access the admin console."
				confirmText="Log out"
				cancelText="Cancel"
				variant="danger"
				icon={LogOut}
			/>
		</div>
	);
}
