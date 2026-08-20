import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	Bell,
	Calendar,
	Star,
	CheckCheck,
	Trash2,
	Filter,
	ArrowLeft,
	Sparkles,
	Clock,
	CheckCircle2,
	AlertCircle,
	ChevronRight,
} from "lucide-react";
import { FadeLoader } from "react-spinners";
import { toast } from "sonner";
import { getSocket } from "../utils/socket";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function formatDate(dateString) {
	if (!dateString) return "";
	const date = new Date(dateString);
	return date.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

export default function NotificationsPage() {
	const [notifications, setNotifications] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeFilter, setActiveFilter] = useState("all");
	const [unreadCount, setUnreadCount] = useState(0);
	const navigate = useNavigate();

	const fetchNotifications = async () => {
		const token = localStorage.getItem("token");
		if (!token) {
			navigate("/sign-in");
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
			toast.error("Failed to load notifications");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchNotifications();

		// Realtime websocket connection
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

	const filteredNotifications = notifications.filter((notif) => {
		if (activeFilter === "unread") return !notif.is_read;
		if (activeFilter === "bookings") return notif.type?.includes("booking");
		if (activeFilter === "reviews") return notif.type?.includes("review");
		if (activeFilter === "system") return notif.type === "system";
		return true;
	});

	const getIcon = (type) => {
		if (type?.includes("booking")) return <Calendar className="w-5 h-5 text-violet-400" />;
		if (type?.includes("review")) return <Star className="w-5 h-5 text-yellow-400" />;
		return <Sparkles className="w-5 h-5 text-cyan-400" />;
	};

	return (
		<div className="min-h-screen bg-[#191034] text-white selection:bg-violet-500/30 pb-20">
			{/* Ambient lighting */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden">
				<div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-900/20 rounded-full blur-[120px]" />
				<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[100px]" />
			</div>

			{/* Sticky Top Header */}
			<div className="sticky top-0 z-40 bg-[#191034]/90 backdrop-blur-xl border-b border-white/5">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<button
							onClick={() => navigate(-1)}
							className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
						>
							<ArrowLeft size={20} />
						</button>
						<div>
							<h1 className="text-xl font-bold bricolage-grotesque">
								Notifications Center
							</h1>
							<p className="text-xs text-gray-400">
								Live real-time alerts & booking updates
							</p>
						</div>
					</div>

					{unreadCount > 0 && (
						<button
							onClick={handleMarkAllAsRead}
							className="px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
						>
							<CheckCheck size={14} />
							<span>Mark all as read</span>
						</button>
					)}
				</div>
			</div>

			{/* Main Content */}
			<div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
				{/* Filter Tabs & Clean Actions */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#22194A] p-2 sm:p-2.5 rounded-2xl border border-white/5">
					<div className="flex gap-1.5 overflow-x-auto custom-scrollbar-x pb-1 sm:pb-0">
						{[
							{ id: "all", label: "All", count: notifications.length },
							{ id: "unread", label: "Unread", count: unreadCount },
							{
								id: "bookings",
								label: "Bookings",
								count: notifications.filter((n) => n.type?.includes("booking"))
									.length,
							},
							{
								id: "reviews",
								label: "Reviews",
								count: notifications.filter((n) => n.type?.includes("review"))
									.length,
							},
						].map((tab) => (
							<button
								key={tab.id}
								onClick={() => setActiveFilter(tab.id)}
								className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
									activeFilter === tab.id
										? "bg-violet-600 text-white shadow-md shadow-violet-900/40"
										: "text-gray-400 hover:text-white hover:bg-white/5"
								}`}
							>
								<span>{tab.label}</span>
								{tab.count > 0 && (
									<span
										className={`text-[10px] px-1.5 py-0.2 rounded-full ${
											activeFilter === tab.id
												? "bg-white/20 text-white"
												: "bg-white/10 text-gray-400"
										}`}
									>
										{tab.count}
									</span>
								)}
							</button>
						))}
					</div>

					{notifications.some((n) => n.is_read) && (
						<button
							onClick={handleClearRead}
							className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
						>
							<Trash2 size={13} />
							<span>Clear read</span>
						</button>
					)}
				</div>

				{/* Notifications List */}
				{loading ? (
					<div className="py-20 flex flex-col items-center justify-center gap-4">
						<FadeLoader color="#8b5cf6" />
						<p className="text-sm text-violet-300/70">
							Loading notifications...
						</p>
					</div>
				) : filteredNotifications.length === 0 ? (
					<div className="p-12 text-center bg-[#22194A] rounded-3xl border border-dashed border-white/10 space-y-3">
						<div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto text-violet-400">
							<Bell size={28} />
						</div>
						<h3 className="text-lg font-bold text-white">No notifications</h3>
						<p className="text-xs text-gray-400 max-w-sm mx-auto">
							You're all caught up! New updates regarding bookings, reviews, and
							appointments will appear here automatically.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{filteredNotifications.map((notif) => (
							<div
								key={notif.id}
								onClick={() => handleMarkAsRead(notif.id)}
								className={`p-4 sm:p-5 rounded-2xl border transition-all relative overflow-hidden group cursor-pointer ${
									!notif.is_read
										? "bg-[#271d54] border-violet-500/40 shadow-lg shadow-violet-900/20"
										: "bg-[#22194A] border-white/5 hover:border-white/10"
								}`}
							>
								{!notif.is_read && (
									<div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-fuchsia-500" />
								)}

								<div className="flex items-start gap-4">
									<div className="p-3 bg-white/5 border border-white/10 rounded-2xl shrink-0 mt-0.5">
										{getIcon(notif.type)}
									</div>

									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between gap-2 mb-1.5">
											<div className="flex items-center gap-2">
												<h4
													className={`text-sm ${
														!notif.is_read
															? "font-bold text-white"
															: "font-semibold text-gray-200"
													}`}
												>
													{notif.title}
												</h4>
												{!notif.is_read && (
													<span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
												)}
											</div>

											<span className="text-[11px] text-gray-500 shrink-0">
												{formatDate(notif.created_at)}
											</span>
										</div>

										<p className="text-xs text-gray-300 leading-relaxed">
											{notif.message}
										</p>

										{/* Action Link if booking */}
										{notif.data?.booking_id && (
											<div className="mt-3 flex items-center gap-3">
												<button
													onClick={(e) => {
														e.stopPropagation();
														const role = localStorage.getItem("role");
														if (role === "provider") {
															navigate("/provider/dashboard");
														} else {
															navigate("/customer/bookings");
														}
													}}
													className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 px-3 py-1 rounded-lg border border-violet-500/30 transition-all cursor-pointer"
												>
													<span>View Booking</span>
													<ChevronRight size={12} />
												</button>
											</div>
										)}
									</div>

									<button
										onClick={(e) => handleDelete(notif.id, e)}
										className="opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-xl transition-all cursor-pointer shrink-0"
										title="Delete notification"
									>
										<Trash2 size={15} />
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
