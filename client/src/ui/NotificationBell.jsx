import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	Bell,
	Calendar,
	Star,
	CheckCircle2,
	Clock,
	X,
	CheckCheck,
	ChevronRight,
	Sparkles,
} from "lucide-react";
import { getSocket } from "../utils/socket";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function timeAgo(dateString) {
	if (!dateString) return "";
	const date = new Date(dateString);
	const seconds = Math.floor((new Date() - date) / 1000);
	if (seconds < 60) return "Just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

function getNotificationIcon(type) {
	if (type?.includes("booking")) {
		return <Calendar size={14} className="text-violet-400" />;
	}
	if (type?.includes("review")) {
		return <Star size={14} className="text-yellow-400" />;
	}
	return <Sparkles size={14} className="text-cyan-400" />;
}

export default function NotificationBell() {
	const [isOpen, setIsOpen] = useState(false);
	const [notifications, setNotifications] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(false);
	const dropdownRef = useRef(null);
	const navigate = useNavigate();

	const fetchNotifications = async () => {
		const token = localStorage.getItem("token");
		if (!token) return;

		try {
			const res = await fetch(`${API_URL}/api/notifications?limit=10`, {
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
			console.warn("Failed to fetch notifications:", err.message);
		}
	};

	useEffect(() => {
		fetchNotifications();

		getSocket();

		const handleRealtimeNotification = (e) => {
			const newNotif = e.detail;
			setNotifications((prev) => [newNotif, ...prev.slice(0, 9)]);
			setUnreadCount((prev) => prev + 1);
		};

		window.addEventListener("app:notification", handleRealtimeNotification);

		const handleClickOutside = (e) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);

		return () => {
			window.removeEventListener("app:notification", handleRealtimeNotification);
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	const handleMarkAllRead = async () => {
		const token = localStorage.getItem("token");
		if (!token) return;

		try {
			await fetch(`${API_URL}/api/notifications/read-all`, {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			setUnreadCount(0);
			setNotifications((prev) =>
				prev.map((n) => ({ ...n, is_read: true })),
			);
		} catch (err) {
			console.error("Mark all read error:", err);
		}
	};

	const handleNotificationClick = async (notif) => {
		const token = localStorage.getItem("token");
		if (token && !notif.is_read) {
			fetch(`${API_URL}/api/notifications/${notif.id}/read`, {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			setNotifications((prev) =>
				prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
			);
			setUnreadCount((prev) => Math.max(0, prev - 1));
		}
		setIsOpen(false);

		if (notif.data?.booking_id) {
			const role = localStorage.getItem("role");
			if (role === "provider") {
				navigate("/provider/dashboard");
			} else {
				navigate("/customer/bookings");
			}
		} else {
			navigate("/notifications");
		}
	};

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="relative p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all border border-white/10 cursor-pointer"
				title="Notifications"
			>
				<Bell size={18} />
				{unreadCount > 0 && (
					<span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-lg shadow-violet-900/50 animate-pulse">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</button>

			{isOpen && (
				<div className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#1b1238] border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden animate-fade-in text-white backdrop-blur-xl">
					<div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#150d2f]">
						<div className="flex items-center gap-2">
							<span className="font-bold text-sm">Notifications</span>
							{unreadCount > 0 && (
								<span className="px-2 py-0.5 text-[10px] font-bold bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-full">
									{unreadCount} new
								</span>
							)}
						</div>

						{unreadCount > 0 && (
							<button
								onClick={handleMarkAllRead}
								className="text-[11px] text-violet-300 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
							>
								<CheckCheck size={12} />
								<span>Mark all read</span>
							</button>
						)}
					</div>

					<div className="max-h-80 overflow-y-auto divide-y divide-white/5 custom-scrollbar-y">
						{notifications.length === 0 ? (
							<div className="p-8 text-center text-gray-400 space-y-2">
								<Bell size={28} className="mx-auto text-gray-600 mb-2" />
								<p className="text-xs font-semibold">No notifications yet</p>
								<p className="text-[11px] text-gray-500">
									We'll notify you here about booking updates and reviews.
								</p>
							</div>
						) : (
							notifications.map((notif) => (
								<div
									key={notif.id}
									onClick={() => handleNotificationClick(notif)}
									className={`p-3.5 flex gap-3 items-start transition-all cursor-pointer hover:bg-white/5 ${
										!notif.is_read ? "bg-violet-600/10" : ""
									}`}
								>
									<div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0 mt-0.5">
										{getNotificationIcon(notif.type)}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between gap-1 mb-1">
											<p
												className={`text-xs truncate ${
													!notif.is_read
														? "font-bold text-white"
														: "font-medium text-gray-300"
												}`}
											>
												{notif.title}
											</p>
											<span className="text-[10px] text-gray-500 shrink-0">
												{timeAgo(notif.created_at)}
											</span>
										</div>
										<p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
											{notif.message}
										</p>
									</div>
								</div>
							))
						)}
					</div>

					<div className="p-3 border-t border-white/10 bg-[#150d2f] text-center">
						<Link
							to="/notifications"
							onClick={() => setIsOpen(false)}
							className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300 hover:text-white transition-colors"
						>
							<span>View all notifications</span>
							<ChevronRight size={12} />
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}
