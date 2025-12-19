import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
	Check,
	Home,
	Calendar,
	Clock,
	Navigation,
	Pencil,
	X,
	Loader2,
	AlertCircle,
} from "lucide-react";
import confetti from "canvas-confetti";

export default function BookingSuccess() {
	const navigate = useNavigate();
	const { state } = useLocation();

	const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

	if (!state?.success || !state?.booking || !state?.booking?.booking_id) {
		return <Navigate to="/" replace />;
	}

	const { booking } = state;

	const [address, setAddress] = useState(
		state.address || booking.address || ""
	);
	const [isEditing, setIsEditing] = useState(false);
	const [tempAddress, setTempAddress] = useState(address);
	const [timeLeft, setTimeLeft] = useState(0);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMsg, setErrorMsg] = useState(null);

	useEffect(() => {
		const createdAt = new Date(booking.created_at || Date.now());
		const deadline = new Date(createdAt.getTime() + 10 * 60000);

		const timer = setInterval(() => {
			const now = new Date();
			const difference = deadline - now;
			if (difference <= 0) {
				setTimeLeft(0);
				setIsEditing(false);
				clearInterval(timer);
			} else {
				setTimeLeft(difference);
			}
		}, 1000);

		return () => clearInterval(timer);
	}, [booking.created_at]);

	const formatCountDown = (ms) => {
		const minutes = Math.floor(ms / 60000);
		const seconds = Math.floor((ms % 60000) / 1000);
		return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
	};

	const handleUpdateAddress = async () => {
		if (!tempAddress.trim()) return;
		setIsSaving(true);
		setErrorMsg(null);

		try {
			const token = localStorage.getItem("token");
			console.log("Updating address for ID:", booking.booking_id);

			const res = await fetch(
				`${API_URL}/api/bookings/${booking.booking_id}/address`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ address: tempAddress }),
				}
			);

			const data = await res.json();

			if (res.ok) {
				setAddress(tempAddress);
				setIsEditing(false);
			} else {
				setErrorMsg(data.message || "Failed to update");
			}
		} catch (err) {
			console.error(err);
			setErrorMsg("Network error. Try again.");
		} finally {
			setIsSaving(false);
		}
	};

	useEffect(() => {
		const duration = 3 * 1000;
		const animationEnd = Date.now() + duration;
		const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
		const randomInRange = (min, max) => Math.random() * (max - min) + min;

		const interval = setInterval(function () {
			const timeLeft = animationEnd - Date.now();
			if (timeLeft <= 0) return clearInterval(interval);
			const particleCount = 50 * (timeLeft / duration);
			confetti({
				...defaults,
				particleCount,
				origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
			});
			confetti({
				...defaults,
				particleCount,
				origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
			});
		}, 250);
		return () => clearInterval(interval);
	}, []);

	const formatDate = (dateStr) =>
		new Date(dateStr).toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		});

	const formatTime = (timeStr) => {
		if (!timeStr) return "";
		const [h, m] = timeStr.split(":");
		return new Date(0, 0, 0, h, m).toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	};

	return (
		<div className="bricolage-grotesque min-h-screen flex items-center justify-center bg-[#0d0b21] relative overflow-hidden font-sans p-4">
			<div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />
			<div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

			<div className="relative z-10 w-full max-w-md animate-fade-in-up">
				{/* Header */}
				<div className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-t-3xl p-8 text-center relative overflow-hidden">
					<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />
					<div className="w-20 h-20 mx-auto bg-gradient-to-tr from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 mb-6 animate-bounce-slow">
						<Check className="w-10 h-10 text-white" strokeWidth={4} />
					</div>
					<h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
						Booking Confirmed!
					</h1>
					<p className="text-violet-200/70 text-sm">
						Your appointment is scheduled successfully.
					</p>
				</div>

				{/* Ticket Body */}
				<div className="relative bg-[#13112b]/80 backdrop-blur-xl border-x border-white/10 p-6">
					<div className="absolute top-0 left-0 w-full flex justify-between transform -translate-y-1/2">
						<div className="w-6 h-6 bg-[#0d0b21] rounded-full -ml-3" />
						<div className="flex-1 border-t-2 border-dashed border-white/10 mx-2" />
						<div className="w-6 h-6 bg-[#0d0b21] rounded-full -mr-3" />
					</div>

					<div className="space-y-6 pt-2">
						{/* Time & Date */}
						<div className="grid grid-cols-2 gap-4">
							<div className="bg-white/5 rounded-2xl p-4 border border-white/5">
								<div className="flex items-center gap-2 text-violet-300 mb-1">
									<Calendar className="w-4 h-4" />
									<span className="text-xs uppercase tracking-wider font-semibold">
										Date
									</span>
								</div>
								<p className="text-white font-semibold text-lg">
									{formatDate(booking.date)}
								</p>
							</div>
							<div className="bg-white/5 rounded-2xl p-4 border border-white/5">
								<div className="flex items-center gap-2 text-violet-300 mb-1">
									<Clock className="w-4 h-4" />
									<span className="text-xs uppercase tracking-wider font-semibold">
										Time
									</span>
								</div>
								<p className="text-white font-semibold text-lg">
									{formatTime(booking.start_time)}
								</p>
							</div>
						</div>

						{/* --- DYNAMIC ADDRESS SECTION --- */}
						<div
							className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
								isEditing
									? "bg-white/10 border-violet-500/50"
									: "bg-gradient-to-r from-violet-500/10 to-transparent border-violet-500/20"
							}`}
						>
							<div className="p-4">
								<div className="flex justify-between items-start mb-2">
									<div className="flex items-center gap-2">
										<Navigation className="w-4 h-4 text-violet-400" />
										<span className="text-xs text-violet-300 uppercase tracking-wider font-semibold">
											Provider Location
										</span>
									</div>
									{timeLeft > 0 && !isEditing && (
										<button
											onClick={() => setIsEditing(true)}
											className="cursor-pointer flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 px-2 py-1 rounded-full text-white transition-colors border border-white/5"
										>
											<span className="text-green-400 animate-pulse">●</span>
											Change
										</button>
									)}
								</div>

								{isEditing ? (
									<div className="mt-2 animate-fade-in">
										<textarea
											value={tempAddress}
											onChange={(e) => setTempAddress(e.target.value)}
											className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-violet-500 outline-none mb-3 resize-none h-20"
											placeholder="Enter new address..."
										/>
										{errorMsg && (
											<div className="flex items-center gap-1 text-red-400 text-xs mb-2">
												<AlertCircle size={12} /> {errorMsg}
											</div>
										)}
										<div className="flex gap-2 justify-end">
											<button
												onClick={() => {
													setIsEditing(false);
													setTempAddress(address);
													setErrorMsg(null);
												}}
												className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition"
											>
												<X size={16} />
											</button>
											<button
												onClick={handleUpdateAddress}
												disabled={isSaving}
												className="flex cursor-pointer disabled:cursor-not-allowed items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition disabled:opacity-50"
											>
												{isSaving ? (
													<Loader2 size={14} className="animate-spin" />
												) : (
													<Check size={14} />
												)}
												Save
											</button>
										</div>
									</div>
								) : (
									<div className="mt-1">
										<p className="text-white text-sm leading-relaxed break-words">
											{address || "No address provided."}
										</p>
										<p className="text-[12px] text-gray-400 mt-2 italic">
											{timeLeft > 0
												? `Editable for ${formatCountDown(timeLeft)} mins`
												: "Edit window expired"}
										</p>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				<div className="bg-white/5 backdrop-blur-2xl border border-t-0 border-white/10 rounded-b-3xl p-6">
					<button
						onClick={() => navigate("/", { replace: true })}
						className="cursor-pointer w-full py-4 bg-white text-violet-950 rounded-xl font-bold text-lg hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-xl flex items-center justify-center gap-2"
					>
						<Home className="w-5 h-5" />
						Back to Home
					</button>
				</div>
			</div>
		</div>
	);
}
