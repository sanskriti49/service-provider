import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	Bell,
	CalendarCheck,
	Star,
	CheckCheck,
	ChevronRight,
	Sparkles,
	Clock,
	Check,
} from "lucide-react";
import { getSocket } from "../utils/socket";
import { API_URL } from "../config";

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
	if (days === 1) return "Yesterday";
	return `${days}d ago`;
}

function getNotificationBadge(type) {
	if (type?.includes("booking")) {
		return {
			icon: <CalendarCheck size={16} className="text-violet-600" />,
			bg: "bg-violet-50 border-violet-100",
		};
	}
	if (type?.includes("review")) {
		return {
			icon: <Star size={16} className="text-amber-500" />,
			bg: "bg-amber-50 border-amber-100",
		};
	}
	return {
		icon: <Sparkles size={16} className="text-indigo-600" />,
		bg: "bg-indigo-50 border-indigo-100",
	};
}

export default function NotificationBell() {
	const [isOpen, setIsOpen] = useState(false);
	const [notifications, setNotifications] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);
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
				navigate("/provider/dashboard/bookings");
			} else {
				navigate("/dashboard/bookings");
			}
		} else {
			navigate("/notifications");
		}
	};

	return (
		<div className="relative bricolage-grotesque" ref={dropdownRef}>
			{/* Bell Trigger Button */}
			<button
				onClick={() => {
					if (!isOpen) fetchNotifications();
					setIsOpen(!isOpen);
				}}
				className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 cursor-pointer ${
					isOpen
						? "bg-violet-100/80 text-violet-900 ring-2 ring-violet-500/20 shadow-sm"
						: "bg-white/90 hover:bg-white text-slate-700 hover:text-slate-950 border border-slate-200/80 shadow-xs hover:shadow-md hover:scale-105 active:scale-95 ring-1 ring-black/5"
				}`}
				title="Notifications"
				aria-label="Open notifications"
			>
				<Bell size={18} />
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-[11px] rounded-full flex items-center justify-center shadow-md shadow-violet-500/30 ring-2 ring-white animate-fade-in">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</button>

			{/* Dropdown Modal Popover */}
			{isOpen && (
				<div className="absolute right-0 mt-3 w-[340px] sm:w-[400px] bg-white/98 backdrop-blur-2xl border border-slate-200/90 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15),0_0_1px_1px_rgba(0,0,0,0.06)] z-50 overflow-hidden text-slate-900 animate-fade-in">
					{/* Header */}
					<div className="p-4 sm:px-5 sm:py-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white/70 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<h4 className="font-bold text-sm sm:text-base text-slate-900">
								Notifications
							</h4>
							{unreadCount > 0 && (
								<span className="px-2 py-0.5 text-xs font-bold bg-violet-100 text-violet-700 rounded-full">
									{unreadCount} new
								</span>
							)}
						</div>

						{unreadCount > 0 && (
							<button
								onClick={handleMarkAllRead}
								className="text-xs font-semibold text-violet-700 hover:text-violet-950 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
							>
								<CheckCheck size={14} />
								<span>Mark all read</span>
							</button>
						)}
					</div>

					{/* Notification List Feed */}
					<div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100/80 custom-scrollbar-y">
						{notifications.length === 0 ? (
							<div className="py-12 px-6 text-center space-y-2.5">
								<div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center mx-auto shadow-xs">
									<Bell size={22} className="text-violet-500" />
								</div>
								<p className="text-sm font-bold text-slate-800">
									All caught up!
								</p>
								<p className="text-xs text-slate-500 max-w-[240px] mx-auto leading-relaxed">
									No new alerts right now. We'll notify you whenever there is an update on your booking.
								</p>
							</div>
						) : (
							notifications.map((notif) => {
								const badge = getNotificationBadge(notif.type);
								return (
									<div
										key={notif.id}
										onClick={() => handleNotificationClick(notif)}
										className={`p-4 flex gap-3.5 items-start transition-all cursor-pointer group ${
											!notif.is_read
												? "bg-violet-50/40 hover:bg-violet-50/80"
												: "bg-transparent hover:bg-slate-50/90"
										}`}
									>
										{/* Icon Badge */}
										<div
											className={`p-2.5 rounded-2xl border shrink-0 mt-0.5 shadow-xs transition-transform group-hover:scale-105 ${badge.bg}`}
										>
											{badge.icon}
										</div>

										{/* Content */}
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between gap-2 mb-1">
												<p
													className={`text-sm leading-snug truncate ${
														!notif.is_read
															? "font-bold text-slate-900"
															: "font-semibold text-slate-700"
													}`}
												>
													{notif.title}
												</p>
												<span className="text-[11px] font-medium text-slate-400 shrink-0">
													{timeAgo(notif.created_at)}
												</span>
											</div>

											<p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-normal">
												{notif.message}
											</p>
										</div>

										{/* Unread Accent Indicator */}
										{!notif.is_read && (
											<div className="w-2 h-2 rounded-full bg-violet-600 mt-2 shrink-0 ring-2 ring-violet-200" />
										)}
									</div>
								);
							})
						)}
					</div>

					{/* Footer */}
					<div className="p-3 border-t border-slate-100 bg-slate-50/60 text-center">
						<Link
							to="/notifications"
							onClick={() => setIsOpen(false)}
							className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-950 transition-colors py-1 px-3 rounded-lg hover:bg-violet-50"
						>
							<span>View all notifications</span>
							<ChevronRight size={13} />
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}
