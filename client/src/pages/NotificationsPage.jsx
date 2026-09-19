import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	Bell,
	CalendarCheck,
	Star,
	CheckCheck,
	Trash2,
	ArrowLeft,
	Sparkles,
	Clock,
	ChevronRight,
	Check,
	Inbox,
	Compass,
	ShieldCheck,
	CircleCheck,
} from "lucide-react";
import { FadeLoader } from "react-spinners";
import { toast } from "sonner";
import { getSocket } from "../utils/socket";
import ConfirmDialog from "../ui/ConfirmDialog";
import Logo from "../ui/Logo";
import { useAuth } from "../contexts/AuthContext";
import { API_URL } from "../config";

function formatRelativeTime(dateString) {
	if (!dateString) return "";
	const date = new Date(dateString);
	const now = new Date();
	const diffSec = Math.floor((now - date) / 1000);

	if (diffSec < 60) return "Just now";
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 24) return `${diffHours}h ago`;

	const isYesterday =
		new Date(now.setDate(now.getDate() - 1)).toDateString() ===
		date.toDateString();
	if (isYesterday) {
		return `Yesterday at ${date.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})}`;
	}

	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

function getDateGroup(dateString) {
	if (!dateString) return "Earlier";
	const date = new Date(dateString);
	const today = new Date();
	const isToday = today.toDateString() === date.toDateString();
	if (isToday) return "Today";

	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	if (yesterday.toDateString() === date.toDateString()) return "Yesterday";

	const oneWeekAgo = new Date();
	oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
	if (date > oneWeekAgo) return "This Week";

	return "Earlier";
}

function getNotificationStyle(type) {
	if (type?.includes("booking")) {
		return {
			icon: <CalendarCheck className="w-5 h-5 text-violet-600" />,
			badgeBg: "bg-violet-100/70 border-violet-200/80 text-violet-700",
			cardBorder: "hover:border-violet-300",
			accentColor: "from-violet-600 to-indigo-600",
			label: "Booking Update",
		};
	}
	if (type?.includes("review")) {
		return {
			icon: <Star className="w-5 h-5 text-amber-500" />,
			badgeBg: "bg-amber-100/70 border-amber-200/80 text-amber-700",
			cardBorder: "hover:border-amber-300",
			accentColor: "from-amber-500 to-amber-600",
			label: "Review & Rating",
		};
	}
	return {
		icon: <Sparkles className="w-5 h-5 text-indigo-600" />,
		badgeBg: "bg-indigo-100/70 border-indigo-200/80 text-indigo-700",
		cardBorder: "hover:border-indigo-300",
		accentColor: "from-indigo-600 to-violet-600",
		label: "TaskGenie Notice",
	};
}

export default function NotificationsPage() {
	const [notifications, setNotifications] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeFilter, setActiveFilter] = useState("all");
	const [unreadCount, setUnreadCount] = useState(0);
	const [showClearConfirm, setShowClearConfirm] = useState(false);
	const { user } = useAuth();
	const navigate = useNavigate();

	const backUrl = useMemo(() => {
		if (user?.role === "provider") return "/provider/dashboard";
		if (user?.role === "admin") return "/admin";
		return "/dashboard";
	}, [user?.role]);

	const fetchNotifications = async () => {
		const token = localStorage.getItem("token");
		if (!token) {
			navigate("/login");
			return;
		}

		setLoading(true);
		try {
			const res = await fetch(`${API_URL}/api/notifications?limit=100`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (res.ok) {
				const data = await res.json();
				setNotifications(data.notifications || []);
				setUnreadCount(data.unread_count || 0);
			}
		} catch (err) {
			console.error("Failed to load notifications:", err);
			toast.error(
				"Failed to load notifications. Please ensure backend is running.",
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchNotifications();
		getSocket();

		const handleRealtime = (e) => {
			const newNotif = e.detail;
			setNotifications((prev) => [newNotif, ...prev]);
			setUnreadCount((prev) => prev + 1);
		};

		window.addEventListener("app:notification", handleRealtime);

		return () => {
			window.removeEventListener("app:notification", handleRealtime);
		};
	}, []);

	const handleMarkAsRead = async (id) => {
		const token = localStorage.getItem("token");
		if (!token) return;

		try {
			await fetch(`${API_URL}/api/notifications/${id}/read`, {
				method: "PATCH",
				headers: { Authorization: `Bearer ${token}` },
			});
			setNotifications((prev) =>
				prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
			);
			setUnreadCount((prev) => Math.max(0, prev - 1));
		} catch (err) {
			console.error("Error marking read:", err);
		}
	};

	const handleMarkAllAsRead = async () => {
		const token = localStorage.getItem("token");
		if (!token) return;

		try {
			await fetch(`${API_URL}/api/notifications/read-all`, {
				method: "PATCH",
				headers: { Authorization: `Bearer ${token}` },
			});
			setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
			setUnreadCount(0);
			toast.success("All notifications marked as read");
		} catch (err) {
			toast.error("Failed to mark all as read");
		}
	};

	const handleDelete = async (id, e) => {
		e.stopPropagation();
		const token = localStorage.getItem("token");
		if (!token) return;

		try {
			await fetch(`${API_URL}/api/notifications/${id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			setNotifications((prev) => prev.filter((n) => n.id !== id));
			toast.success("Notification removed");
		} catch (err) {
			toast.error("Failed to delete notification");
		}
	};

	const handleClearRead = async () => {
		const token = localStorage.getItem("token");
		if (!token) return;

		try {
			await fetch(`${API_URL}/api/notifications/clear-read`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			setNotifications((prev) => prev.filter((n) => !n.is_read));
			toast.success("Cleared read notifications");
		} catch (err) {
			toast.error("Failed to clear read notifications");
		}
	};

	const filteredNotifications = useMemo(() => {
		return notifications.filter((notif) => {
			if (activeFilter === "unread") return !notif.is_read;
			if (activeFilter === "bookings") return notif.type?.includes("booking");
			if (activeFilter === "reviews") return notif.type?.includes("review");
			return true;
		});
	}, [notifications, activeFilter]);

	// Group notifications into Today, Yesterday, This Week, Earlier
	const groupedNotifications = useMemo(() => {
		const groups = {};
		for (const notif of filteredNotifications) {
			const group = getDateGroup(notif.created_at);
			if (!groups[group]) groups[group] = [];
			groups[group].push(notif);
		}
		return groups;
	}, [filteredNotifications]);

	return (
		<div className="min-h-screen bg-[#faf8ff] text-slate-900 selection:bg-violet-500/20 pb-24 bricolage-grotesque">
			{/* Ambient Warm Atmosphere Halos */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
				<div className="absolute top-0 right-1/4 w-[600px] h-[350px] bg-violet-400/10 blur-[130px] rounded-full" />
				<div className="absolute top-1/3 left-10 w-[500px] h-[350px] bg-amber-300/10 blur-[140px] rounded-full" />
				<div className="absolute bottom-10 right-1/3 w-[500px] h-[300px] bg-indigo-400/10 blur-[130px] rounded-full" />
			</div>

			{/* Top Brand Navigation Header */}
			<header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
				<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
					{/* Brand Logo & Back Breadcrumb */}
					<div className="flex items-center gap-4">
						<Logo to="/" size="md" theme="primary" />

						<div className="h-5 w-px bg-slate-200 hidden sm:block" />

						<Link
							to={backUrl}
							className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all"
						>
							<ArrowLeft size={14} />
							<span>Dashboard</span>
						</Link>
					</div>

					{/* Header Actions */}
					<div className="flex items-center gap-2.5">
						{unreadCount > 0 && (
							<button
								onClick={handleMarkAllAsRead}
								className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
							>
								<CheckCheck size={14} />
								<span className="hidden sm:inline">Mark all as read</span>
								<span className="sm:hidden">Mark all</span>
							</button>
						)}

						{notifications.some((n) => n.is_read) && (
							<button
								onClick={() => setShowClearConfirm(true)}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-bold transition-all border border-slate-200/80 cursor-pointer"
								title="Clear read notifications"
							>
								<Trash2 size={13} />
								<span className="hidden sm:inline">Clear read</span>
							</button>
						)}
					</div>
				</div>
			</header>

			{/* Main Content Area */}
			<main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
				{/* Hero Title & Live Status */}
				<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
					<div>
						<div className="flex items-center gap-3 flex-wrap">
							<h1 className="text-3xl sm:text-4xl font-extrabold text-[#1E1B4B] tracking-tight">
								Notification Inbox
							</h1>

							{unreadCount > 0 ? (
								<span className="px-3 py-1 text-xs font-extrabold bg-violet-600 text-white rounded-full shadow-sm shadow-violet-500/30">
									{unreadCount} unread
								</span>
							) : (
								<span className="px-3 py-1 text-xs font-bold bg-emerald-100/80 text-emerald-800 rounded-full border border-emerald-200 flex items-center gap-1.5">
									<CircleCheck size={13} className="text-emerald-600" />
									All caught up
								</span>
							)}
						</div>

						<p className="text-sm text-slate-500 mt-1.5 font-medium leading-relaxed max-w-xl">
							Stay up to speed with your live appointments, provider
							confirmations, and customer reviews.
						</p>
					</div>
				</div>

				{/* Filter Segmented Control Tabs */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200/90 shadow-xs">
					<div className="flex gap-1.5 overflow-x-auto custom-scrollbar-x pb-1 sm:pb-0">
						{[
							{
								id: "all",
								label: "All Updates",
								count: notifications.length,
								icon: Bell,
							},
							{
								id: "unread",
								label: "Unread",
								count: unreadCount,
								icon: Inbox,
							},
							{
								id: "bookings",
								label: "Bookings",
								count: notifications.filter((n) => n.type?.includes("booking"))
									.length,
								icon: CalendarCheck,
							},
							{
								id: "reviews",
								label: "Reviews",
								count: notifications.filter((n) => n.type?.includes("review"))
									.length,
								icon: Star,
							},
						].map((tab) => {
							const Icon = tab.icon;
							const isActive = activeFilter === tab.id;
							return (
								<button
									key={tab.id}
									onClick={() => setActiveFilter(tab.id)}
									className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
										isActive
											? "bg-[#1E1B4B] text-white shadow-md shadow-indigo-950/20"
											: "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
									}`}
								>
									<Icon
										size={14}
										className={isActive ? "text-violet-300" : "text-slate-400"}
									/>
									<span>{tab.label}</span>
									{tab.count > 0 && (
										<span
											className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
												isActive
													? "bg-white/20 text-white"
													: "bg-slate-100 text-slate-600"
											}`}
										>
											{tab.count}
										</span>
									)}
								</button>
							);
						})}
					</div>
				</div>

				{/* Content Feed */}
				{loading ? (
					<div className="py-24 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
						<FadeLoader color="#6366F1" />
						<p className="text-sm font-semibold text-slate-500 mt-3">
							Syncing your notifications...
						</p>
					</div>
				) : filteredNotifications.length === 0 ? (
					<div className="py-20 px-6 text-center bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
						<div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-indigo-50 border border-violet-200/80 rounded-3xl flex items-center justify-center mx-auto text-violet-600 shadow-sm">
							<Bell size={28} className="text-violet-600" />
						</div>
						<div className="space-y-1.5 max-w-sm mx-auto">
							<h3 className="text-lg font-bold text-slate-900">
								No notifications right now
							</h3>
							<p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
								{activeFilter === "unread"
									? "You've read all your notifications. Check back later for new booking updates!"
									: "You're all caught up! New updates regarding bookings, reviews, and specialists will appear here live."}
							</p>
						</div>

						<div className="pt-2 flex items-center justify-center gap-3">
							<Link
								to="/services"
								className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md shadow-violet-500/25 transition-all cursor-pointer"
							>
								<Compass size={14} />
								<span>Explore Services</span>
							</Link>
							<Link
								to={backUrl}
								className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
							>
								<span>Go to Dashboard</span>
							</Link>
						</div>
					</div>
				) : (
					<div className="space-y-8">
						{Object.entries(groupedNotifications).map(([groupTitle, items]) => (
							<div key={groupTitle} className="space-y-3">
								{/* Group Date Header */}
								<div className="flex items-center gap-3 px-1">
									<span className="text-xs font-black uppercase tracking-wider text-slate-400">
										{groupTitle}
									</span>
									<div className="flex-1 h-px bg-slate-200/80" />
								</div>

								{/* Notification Cards */}
								<div className="space-y-3">
									{items.map((notif) => {
										const style = getNotificationStyle(notif.type);
										return (
											<div
												key={notif.id}
												onClick={() => handleMarkAsRead(notif.id)}
												className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group cursor-pointer ${
													!notif.is_read
														? "bg-white border-violet-300 shadow-sm ring-1 ring-violet-500/10 hover:border-violet-400"
														: "bg-white/80 hover:bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
												}`}
											>
												{/* Left Accent Strip for Unread */}
												{!notif.is_read && (
													<div
														className={`absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b ${style.accentColor}`}
													/>
												)}

												<div className="flex items-start gap-4">
													{/* Type Icon Badge */}
													<div
														className={`p-3 rounded-2xl border shrink-0 mt-0.5 shadow-xs transition-transform group-hover:scale-105 ${style.badgeBg}`}
													>
														{style.icon}
													</div>

													{/* Details */}
													<div className="flex-1 min-w-0">
														<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 mb-1.5">
															<div className="flex items-center gap-2">
																<h4
																	className={`text-sm sm:text-base leading-snug ${
																		!notif.is_read
																			? "font-bold text-slate-900"
																			: "font-semibold text-slate-700"
																	}`}
																>
																	{notif.title}
																</h4>

																{!notif.is_read && (
																	<span className="w-2 h-2 rounded-full bg-violet-600 inline-block shrink-0" />
																)}
															</div>

															<div className="flex items-center gap-1 text-xs font-medium text-slate-400 shrink-0">
																<Clock size={12} />
																<span>
																	{formatRelativeTime(notif.created_at)}
																</span>
															</div>
														</div>

														<p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
															{notif.message}
														</p>

														{/* Interactive Booking Action CTA */}
														{notif.data?.booking_id && (
															<div className="mt-3.5 flex items-center gap-3">
																<button
																	onClick={(e) => {
																		e.stopPropagation();
																		const role =
																			user?.role ||
																			localStorage.getItem("role");
																		if (role === "provider") {
																			navigate("/provider/dashboard/bookings");
																		} else {
																			navigate("/dashboard/bookings");
																		}
																	}}
																	className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 px-3.5 py-1.5 rounded-xl border border-violet-200 transition-all cursor-pointer shadow-xs"
																>
																	<span>View Booking Details</span>
																	<ChevronRight size={13} />
																</button>
															</div>
														)}
													</div>

													{/* Delete Trigger */}
													<button
														onClick={(e) => handleDelete(notif.id, e)}
														className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
														title="Delete notification"
														aria-label="Delete notification"
													>
														<Trash2 size={16} />
													</button>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						))}
					</div>
				)}
			</main>

			{/* Confirm Clear Read Dialog */}
			<ConfirmDialog
				isOpen={showClearConfirm}
				onClose={() => setShowClearConfirm(false)}
				onConfirm={async () => {
					setShowClearConfirm(false);
					await handleClearRead();
				}}
				title="Clear read notifications?"
				description="This will permanently remove all read notifications from your history."
				confirmText="Clear read"
				cancelText="Cancel"
				variant="danger"
				icon={Trash2}
			/>
		</div>
	);
}
