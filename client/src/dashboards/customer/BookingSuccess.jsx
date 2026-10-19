import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	Check,
	Home,
	X,
	CircleAlert,
	Mail,
	MapPin,
	Copy,
	CalendarPlus,
	Search,
	Pencil,
	Lock,
} from "lucide-react";
import { FadeLoader } from "react-spinners";
import api from "../../api/axiosInstance";
import { addressCandidates, createRequestGuard } from "../../utils/serviceLocation";

const EDIT_WINDOW_MS = 10 * 60 * 1000;
const WARN_MS = 2 * 60 * 1000;
const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R;
const CONFETTI_COLORS = ["#7C5CFF", "#19C37D", "#F5A524", "#F5F2FF"];

export default function BookingSuccess() {
	const navigate = useNavigate();
	const { state } = useLocation();

	const isValid = Boolean(
		state?.success && state?.booking && state?.booking?.booking_id,
	);
	const booking = state?.booking || {};

	const [address, setAddress] = useState(
		state?.address || booking.address || "",
	);
	const [isEditing, setIsEditing] = useState(false);
	const [tempAddress, setTempAddress] = useState(
		state?.address || booking.address || "",
	);
	const [timeLeft, setTimeLeft] = useState(0);
	const [isSaving, setIsSaving] = useState(false);
	const [addressMatches, setAddressMatches] = useState([]);
	const [selectedLocation, setSelectedLocation] = useState(null);
	const addressRequests = useRef(createRequestGuard());
	useEffect(()=>()=>addressRequests.current.cancel(),[]);
	const [errorMsg, setErrorMsg] = useState(null);
	const [copied, setCopied] = useState(false);
	const [showConfetti, setShowConfetti] = useState(true);

	// One-time celebration: pieces are generated once and removed after they land.
	const confetti = useMemo(
		() =>
			Array.from({ length: 26 }, (_, i) => ({
				id: i,
				left: 8 + Math.random() * 84,
				delay: Math.random() * 0.35,
				duration: 1.9 + Math.random() * 1.2,
				drift: (Math.random() - 0.5) * 160,
				rotate: 180 + Math.random() * 540,
				color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
				w: 6 + Math.random() * 5,
				h: 10 + Math.random() * 6,
			})),
		[],
	);

	useEffect(() => {
		const t = setTimeout(() => setShowConfetti(false), 3600);
		return () => clearTimeout(t);
	}, []);

	useEffect(() => {
		if (!isValid || !booking.created_at) return;
		const deadline = new Date(booking.created_at).getTime() + EDIT_WINDOW_MS;

		const tick = () => {
			const difference = deadline - Date.now();
			if (difference <= 0) {
				setTimeLeft(0);
				setIsEditing(false);
				return true;
			}
			setTimeLeft(difference);
			return false;
		};

		// Tick immediately so the stub never flashes "expired" on first paint.
		if (tick()) return;
		const timer = setInterval(() => {
			if (tick()) clearInterval(timer);
		}, 1000);

		return () => clearInterval(timer);
	}, [isValid, booking.created_at]);

	const formatCountDown = (ms) => {
		const minutes = Math.floor(ms / 60000);
		const seconds = Math.floor((ms % 60000) / 1000);
		return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
	};

	const handleUpdateAddress = async () => {
		if (!tempAddress.trim()) return;
		const request = addressRequests.current.begin();
		setIsSaving(true);
		setErrorMsg(null);

		try {
			if (!selectedLocation) {
				const results = await addressCandidates(tempAddress,request.signal);
				if(!request.current()) return;
				const matches = results.map(location=>({...location,lon:location.lng,display_name:location.address}));
				setAddressMatches(matches);
				setErrorMsg(
					matches.length
						? null
						: "We couldn't find that place. Add a street, area or pincode and search again.",
				);
				return;
			}
			await api.patch(`/api/bookings/${booking.booking_id}/address`, {
				latitude: Number(selectedLocation.lat),
				longitude: Number(selectedLocation.lon),
				address: tempAddress,
			},{signal:request.signal});
			if(!request.current()) return;
			setAddress(tempAddress);
			setIsEditing(false);
			setAddressMatches([]);
			setSelectedLocation(null);
		} catch (err) {
			if(!request.current()) return;
			setErrorMsg(
				err.response?.data?.message ||
					"We couldn't update the address. Check your connection and try again.",
			);
		} finally {
			if(request.current()) setIsSaving(false);
		}
	};

	const cancelEdit = () => {
		addressRequests.current.cancel();setIsSaving(false);
		setIsEditing(false);
		setTempAddress(address);
		setSelectedLocation(null);
		setAddressMatches([]);
		setErrorMsg(null);
	};

	const copyRef = async () => {
		try {
			await navigator.clipboard.writeText(String(booking.booking_id));
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch {
			/* clipboard unavailable: fail silently */
		}
	};

	const downloadIcs = () => {
		const day = String(booking.date).slice(0, 10).replaceAll("-", "");
		const hhmmss = (t, addHour = 0) => {
			const [h = "00", m = "00"] = String(t).split(":");
			const hour = Math.min(Number(h) + addHour, 23);
			const minute = hour === 23 && Number(h) + addHour > 23 ? 59 : Number(m);
			return `${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}00`;
		};
		const start = `${day}T${hhmmss(booking.start_time)}`;
		const end = booking.end_time
			? `${day}T${hhmmss(booking.end_time)}`
			: `${day}T${hhmmss(booking.start_time, 1)}`;
		const stamp =
			new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
		const esc = (s) =>
			String(s)
				.replace(/([,;\\])/g, "\\$1")
				.replace(/\n/g, "\\n");

		const ics = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//Booking//EN",
			"BEGIN:VEVENT",
			`UID:booking-${booking.booking_id}@bookings`,
			`DTSTAMP:${stamp}`,
			`DTSTART:${start}`,
			`DTEND:${end}`,
			"SUMMARY:Service booking",
			`LOCATION:${esc(address || "")}`,
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");

		const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
		const a = document.createElement("a");
		a.href = url;
		a.download = `booking-${booking.booking_id}.ics`;
		a.click();
		URL.revokeObjectURL(url);
	};

	if (!isValid) {
		return <Navigate to="/" replace />;
	}

	const weekday = new Date(booking.date).toLocaleDateString("en-IN", {
		weekday: "long",
	});
	const dayMonth = new Date(booking.date).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
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
	const [clock, meridiem] = formatTime(booking.start_time).split(/\s+/);

	const canEdit = timeLeft > 0;
	const ringOffset = RING_C * (1 - Math.min(timeLeft / EDIT_WINDOW_MS, 1));
	const ringColor = timeLeft < WARN_MS ? "#F5A524" : "#5B3DF5";

	return (
		<div className="bricolage-grotesque min-h-screen flex items-center justify-center bg-[#0E0B1E] p-4 py-10 overflow-hidden">
			<style>{`
				@keyframes bs-draw { to { stroke-dashoffset: 0; } }
				@keyframes bs-pop { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
				@keyframes bs-halo { 0% { transform: scale(.8); opacity: .55; } 100% { transform: scale(2.1); opacity: 0; } }
				@keyframes bs-ticket { 0% { transform: translateY(28px) rotate(-1.2deg); opacity: 0; } 100% { transform: none; opacity: 1; } }
				@keyframes bs-fall {
					0% { transform: translate3d(0,-20px,0) rotate(0); opacity: 1; }
					100% { transform: translate3d(var(--drift), 105vh, 0) rotate(var(--rot)); opacity: 0; }
				}
				.bs-check path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: bs-draw .5s .35s ease-out forwards; }
				.bs-badge { animation: bs-pop .5s ease-out both; }
				.bs-halo { animation: bs-halo 1.2s .3s ease-out both; }
				.bs-ticket { animation: bs-ticket .7s .15s cubic-bezier(.2,.8,.2,1) both; }
				.bs-confetti { animation: bs-fall var(--dur) var(--delay) cubic-bezier(.3,.6,.4,1) forwards; }
				@media (prefers-reduced-motion: reduce) {
					.bs-check path { animation: none; stroke-dashoffset: 0; }
					.bs-badge, .bs-halo, .bs-ticket { animation: none; }
					.bs-confetti { display: none; }
				}
			`}</style>

			{showConfetti && (
				<div
					className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
					aria-hidden="true"
				>
					{confetti.map((c) => (
						<span
							key={c.id}
							className="bs-confetti absolute top-0 rounded-[2px]"
							style={{
								left: `${c.left}%`,
								width: c.w,
								height: c.h,
								background: c.color,
								"--drift": `${c.drift}px`,
								"--rot": `${c.rotate}deg`,
								"--dur": `${c.duration}s`,
								"--delay": `${c.delay}s`,
							}}
						/>
					))}
				</div>
			)}

			<main className="relative z-10 w-full max-w-md">
				{/* Confirmation header */}
				<header className="text-center mb-8">
					<div className="relative mx-auto mb-5 w-16 h-16">
						<span className="bs-halo absolute inset-0 rounded-full bg-[#19C37D]" />
						<div className="bs-badge relative w-16 h-16 rounded-full bg-[#19C37D] flex items-center justify-center shadow-[0_8px_30px_rgba(25,195,125,.35)]">
							<svg
								className="bs-check"
								width="30"
								height="30"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#0E0B1E"
								strokeWidth="3.2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />
							</svg>
						</div>
					</div>
					<h1 className="text-4xl font-extrabold tracking-tight text-white">
						You're booked
					</h1>
					<p className="mt-2 text-sm text-violet-200/70 inline-flex items-center gap-1.5">
						<Mail className="w-4 h-4 text-[#19C37D]" />
						We've emailed your confirmation
					</p>
				</header>

				{/* Ticket */}
				<section
					className="bs-ticket relative rounded-[28px] bg-[#F5F2FF] text-[#1A1636] shadow-[0_30px_80px_-20px_rgba(91,61,245,.55)]"
					aria-label="Booking details"
				>
					{/* When */}
					<div className="grid grid-cols-[1.25fr_1fr] px-7 pt-7 pb-8">
						<div className="pr-5 border-r-2 border-dashed border-[#1A1636]/15">
							<p className="text-sm text-[#6B6590]">{weekday}</p>
							<p className="mt-1 text-4xl font-extrabold leading-none tracking-tight">
								{dayMonth}
							</p>
						</div>
						<div className="pl-5">
							<p className="text-sm text-[#6B6590]">Arrival</p>
							<p className="mt-1 text-4xl font-extrabold leading-none tracking-tight tabular-nums">
								{clock}
								<span className="ml-1 text-base font-bold text-[#6B6590]">
									{meridiem}
								</span>
							</p>
						</div>
					</div>

					{/* Perforation */}
					<div className="relative h-0" aria-hidden="true">
						<div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#0E0B1E]" />
						<div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#0E0B1E]" />
						<div className="absolute left-5 right-5 top-0 border-t-2 border-dashed border-[#1A1636]/15" />
					</div>

					{/* Where */}
					<div className="px-7 pt-8 pb-6">
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0 flex-1">
								<p className="flex items-center gap-1.5 text-sm text-[#6B6590]">
									<MapPin className="w-4 h-4 text-[#5B3DF5]" />
									Service address
								</p>

								{!isEditing && (
									<p className="mt-2 text-base font-semibold leading-snug break-words">
										{address || "No address added yet."}
									</p>
								)}
							</div>

							{/* Countdown ring */}
							<div
								className="relative shrink-0 w-12 h-12"
								role="timer"
								aria-label={
									canEdit
										? `Address can be changed for ${formatCountDown(timeLeft)}`
										: "Address changes closed"
								}
							>
								<svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
									<circle
										cx="22"
										cy="22"
										r={RING_R}
										fill="none"
										stroke="#E0D9FA"
										strokeWidth="4"
									/>
									<circle
										cx="22"
										cy="22"
										r={RING_R}
										fill="none"
										stroke={canEdit ? ringColor : "transparent"}
										strokeWidth="4"
										strokeLinecap="round"
										strokeDasharray={RING_C}
										strokeDashoffset={ringOffset}
										style={{
											transition: "stroke-dashoffset 1s linear, stroke .3s",
										}}
									/>
								</svg>
								<span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">
									{canEdit ? (
										formatCountDown(timeLeft)
									) : (
										<Lock className="w-4 h-4 text-[#6B6590]" />
									)}
								</span>
							</div>
						</div>

						{!isEditing && (
							<div className="mt-4 flex items-center justify-between gap-3">
								<p
									className={`text-xs ${
										canEdit && timeLeft < WARN_MS
											? "text-[#B7791F] font-semibold"
											: "text-[#6B6590]"
									}`}
								>
									{canEdit
										? timeLeft < WARN_MS
											? "Last chance to change the address"
											: "You can still change the address"
										: "Address is locked for this booking"}
								</p>
								{canEdit && (
									<button
										onClick={() => setIsEditing(true)}
										className="cursor-pointer inline-flex items-center gap-1.5 rounded-full bg-[#1A1636] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#2B2552] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3DF5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F2FF]"
									>
										<Pencil className="w-3.5 h-3.5" />
										Change
									</button>
								)}
							</div>
						)}

						{/* Edit mode */}
						{isEditing && (
							<div className="mt-3">
								<textarea
									value={tempAddress}
									onChange={(e) => {
										addressRequests.current.cancel();setIsSaving(false);setTempAddress(e.target.value);
										setSelectedLocation(null);
										setAddressMatches([]);
										setErrorMsg(null);
									}}
									aria-label="New service address"
									className="w-full h-20 resize-none rounded-xl border border-[#1A1636]/15 bg-white p-3 text-sm text-[#1A1636] placeholder:text-[#6B6590]/70 outline-none focus:border-[#5B3DF5] focus:ring-2 focus:ring-[#5B3DF5]/25"
									placeholder="House no., street, area, city"
								/>

								{addressMatches.length > 0 && (
									<div className="mt-3">
										<p className="text-xs font-semibold mb-2">
											Pick the matching location
										</p>
										<ul
											role="radiogroup"
											aria-label="Matching locations"
											className="space-y-2 max-h-44 overflow-y-auto pr-1"
										>
											{addressMatches.map((match) => {
												const active = selectedLocation?.lat === match.lat && selectedLocation?.lon === match.lon && selectedLocation?.display_name === match.display_name;
												return (
													<li key={`${match.lat}:${match.lon}:${match.display_name}`}>
														<button
															type="button"
															role="radio"
															aria-checked={active}
															onClick={() => {setSelectedLocation(match);setTempAddress(match.display_name);}}
															className={`cursor-pointer w-full text-left flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3DF5] ${
																active
																	? "border-[#5B3DF5] bg-[#5B3DF5]/10"
																	: "border-[#1A1636]/10 bg-white hover:border-[#5B3DF5]/50"
															}`}
														>
															<span
																className={`mt-0.5 flex w-4 h-4 shrink-0 items-center justify-center rounded-full border ${
																	active
																		? "bg-[#5B3DF5] border-[#5B3DF5]"
																		: "border-[#1A1636]/25"
																}`}
															>
																{active && (
																	<Check
																		className="w-3 h-3 text-white"
																		strokeWidth={4}
																	/>
																)}
															</span>
															<span className="line-clamp-2">
																{match.display_name}
															</span>
														</button>
													</li>
												);
											})}
										</ul>
									</div>
								)}

								{errorMsg && (
									<p
										role="alert"
										className="mt-3 flex items-start gap-1.5 text-xs text-[#C0392B]"
									>
										<CircleAlert className="w-4 h-4 shrink-0" />
										{errorMsg}
									</p>
								)}

								<div className="mt-4 flex items-center justify-end gap-2">
									<button
										onClick={cancelEdit}
										aria-label="Cancel editing"
										className="cursor-pointer rounded-xl p-2.5 text-[#6B6590] hover:bg-[#1A1636]/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3DF5]"
									>
										<X size={18} />
									</button>
									<button
										onClick={handleUpdateAddress}
										disabled={isSaving || !tempAddress.trim()}
										className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2 rounded-xl bg-[#5B3DF5] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#4B2FE0] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3DF5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F2FF]"
									>
										{isSaving ? (
											<span className="inline-flex items-center justify-center w-4 h-4 scale-[0.35] origin-center -mx-1">
												<FadeLoader color="#ffffff" />
											</span>
										) : selectedLocation ? (
											<Check size={16} strokeWidth={3} />
										) : (
											<Search size={16} />
										)}
										{selectedLocation ? "Save address" : "Find location"}
									</button>
								</div>
							</div>
						)}
					</div>

					{/* Reference stub */}
					<div className="flex items-center justify-between gap-3 rounded-b-[28px] bg-[#E9E3FF] px-7 py-4">
						<div>
							<p className="text-xs text-[#6B6590]">Booking reference</p>
							<p className="mt-0.5 font-mono text-sm font-bold tracking-wide">
								#{booking.booking_id}
							</p>
						</div>
						<button
							onClick={copyRef}
							className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-[#1A1636]/15 px-3 py-1.5 text-xs font-bold hover:bg-white/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3DF5]"
							aria-live="polite"
						>
							{copied ? (
								<>
									<Check
										className="w-3.5 h-3.5 text-[#0F8F58]"
										strokeWidth={3}
									/>
									Copied
								</>
							) : (
								<>
									<Copy className="w-3.5 h-3.5" />
									Copy
								</>
							)}
						</button>
					</div>
				</section>

				{/* Actions */}
				<div className="mt-6 grid grid-cols-2 gap-3">
					<button
						onClick={downloadIcs}
						className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3.5 text-sm font-bold text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
					>
						<CalendarPlus className="w-4 h-4" />
						Add to calendar
					</button>
					<button
						onClick={() => navigate("/", { replace: true })}
						className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-bold text-[#1A1636] hover:bg-violet-100 active:scale-[0.98] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
					>
						<Home className="w-4 h-4" />
						Back to home
					</button>
				</div>
			</main>
		</div>
	);
}
