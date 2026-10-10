import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowLeft,
	Calendar,
	Check,
	ChevronLeft,
	ChevronRight,
	CreditCard,
	MapPin,
	Navigation,
	ShieldCheck,
	Star,
	Wallet,
	Home,
	Briefcase,
} from "lucide-react";
import Alerts from "../../ui/Alerts";
import Logo from "../../ui/Logo";
import BookingHeader from "./BookingHeader";
import { toast } from "sonner";
import api from "../../api/axiosInstance";
import { useAuth } from "../../contexts/AuthContext";

/* -------------------------------------------------------------------------- */
/*  Pure helpers                                                              */
/* -------------------------------------------------------------------------- */

const pad = (n) => String(n).padStart(2, "0");

function shiftDay(n) {
	const d = new Date();
	d.setDate(d.getDate() + n);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const todayStr = () => shiftDay(0);

const formatINR = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(n || 0);

const timeString = (v) =>
	typeof v === "string" ? v : v?.start_time || v?.start || "";

function parseTime(v) {
	const s = timeString(v);
	if (!s) return null;
	const [h, m] = s.split(":");
	const hh = parseInt(h, 10);
	if (Number.isNaN(hh)) return null;
	return [hh, parseInt(m, 10) || 0];
}

// Deterministic 12h formatting (avoids locale-dependent narrow no-break spaces).
function parts12(v) {
	const t = parseTime(v);
	if (!t) return null;
	return {
		time: `${t[0] % 12 || 12}:${pad(t[1])}`,
		suffix: t[0] >= 12 ? "PM" : "AM",
	};
}

function formatRange(start, end) {
	const a = parts12(start);
	const b = parts12(end);
	if (!a && !b) return "";
	if (!a || !b) return `${(a || b).time} ${(a || b).suffix}`;
	return a.suffix === b.suffix
		? `${a.time} – ${b.time} ${b.suffix}`
		: `${a.time} ${a.suffix} – ${b.time} ${b.suffix}`;
}

function formatDateParts(dateString) {
	if (!dateString) return null;
	const [y, m, d] = String(dateString).substring(0, 10).split("-").map(Number);
	const date = new Date(y, m - 1, d);
	return {
		day: date.getDate(),
		weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
		month: date.toLocaleDateString("en-US", { month: "short" }),
		full: date.toLocaleDateString("en-US", {
			weekday: "long",
			month: "long",
			day: "numeric",
		}),
	};
}

const dayTag = (dateStr, weekday) =>
	dateStr === todayStr()
		? "Today"
		: dateStr === shiftDay(1)
			? "Tomorrow"
			: weekday;

function isSlotExpired(date, start) {
	if (!date || !start) return false;
	const today = todayStr();
	if (date < today) return true;
	if (date > today) return false;
	const t = parseTime(start);
	if (!t) return false;
	const at = new Date();
	at.setHours(t[0], t[1], 0, 0);
	return new Date() >= at;
}

/** Accepts either [{date, free_slots:[…]}] or a flat slot list, optionally wrapped in {availability}. */
function groupSlots(availability) {
	let raw = availability;
	if (raw && !Array.isArray(raw) && Array.isArray(raw.availability)) {
		raw = raw.availability;
	}
	if (!Array.isArray(raw)) return {};

	const acc = {};
	const add = (rawDate, s) => {
		const date = rawDate ? String(rawDate).substring(0, 10) : null;
		const start = s.start_time || s.start;
		const end = s.end_time || s.end;
		if (!date || !start || !end) return;
		if (!acc[date]) acc[date] = [];
		if (acc[date].some((x) => x.start === start && x.end === end)) return;
		acc[date].push({
			date,
			start,
			end,
			start_time: start,
			end_time: end,
			isBooked: s.isBooked === true || s.is_booked === true,
		});
	};

	raw.forEach((item) => {
		if (!item?.date) return;
		if (Array.isArray(item.free_slots)) {
			item.free_slots.forEach((s) => add(item.date, s));
		} else {
			add(item.date, item);
		}
	});
	Object.values(acc).forEach((list) =>
		list.sort((a, b) => a.start.localeCompare(b.start)),
	);
	return acc;
}

const PERIODS = [
	{ key: "morning", label: "Morning", test: (h) => h < 12 },
	{ key: "afternoon", label: "Afternoon", test: (h) => h >= 12 && h < 17 },
	{ key: "evening", label: "Evening", test: (h) => h >= 17 },
];

const primaryBtn =
	"bg-gradient-to-r from-violet-400 to-fuchsia-400 text-[#0d0b12] font-semibold hover:brightness-110 shadow-[0_6px_24px_-8px_rgba(167,139,250,0.7)] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300";

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                           */
/* -------------------------------------------------------------------------- */

function ProviderBlock({ provider, serviceName }) {
	const photo =
		provider.photo ||
		`https://ui-avatars.com/api/?name=${encodeURIComponent(provider.name || "P")}&background=2a1f4d&color=fff`;
	return (
		<div className="flex items-center gap-4 min-w-0">
			<div className="p-[2px] rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-amber-300 shrink-0">
				<div className="w-14 h-14 rounded-full overflow-hidden bg-[#1a1428]">
					<img src={photo} alt="" className="w-full h-full object-cover" />
				</div>
			</div>
			<div className="min-w-0">
				<h2 className="font-mackinac text-lg font-bold text-white leading-tight truncate">
					{provider.name}
				</h2>
				<p className="mt-0.5 text-sm text-stone-400 truncate">{serviceName}</p>
				<p className="mt-1 flex items-center gap-3 text-xs text-stone-400">
					<span className="inline-flex items-center gap-1">
						<Star size={12} className="text-amber-300 fill-amber-300" />
						{provider.rating ? Number(provider.rating).toFixed(1) : "New"}
					</span>
					{provider.is_verified && (
						<span className="inline-flex items-center gap-1 text-emerald-300">
							<ShieldCheck size={12} />
							Verified
						</span>
					)}
				</p>
			</div>
		</div>
	);
}

function Step({
	n,
	title,
	hint,
	done,
	nudge,
	nudgeText,
	innerRef,
	last,
	children,
}) {
	return (
		<li
			ref={innerRef}
			className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-4 scroll-mt-28"
		>
			<div className="flex flex-col items-center">
				<span
					className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
						done
							? "bg-gradient-to-br from-violet-300 to-fuchsia-300 text-[#0d0b12]"
							: "border border-white/[0.16] text-stone-400"
					}`}
				>
					{done ? <Check size={14} strokeWidth={3} /> : n}
				</span>
				{!last && (
					<span aria-hidden className="mt-2 flex-1 w-px bg-white/[0.08]" />
				)}
			</div>

			<div className={last ? "pb-2" : "pb-10"}>
				<div className="flex items-baseline justify-between gap-3 min-h-7">
					<h2 className="font-mackinac text-xl font-bold text-white">
						{title}
					</h2>
					{hint && (
						<span className="text-sm text-amber-200 text-right truncate">
							{hint}
						</span>
					)}
				</div>
				<div
					className={`mt-4 -m-1 p-1 rounded-2xl transition-shadow duration-300 ${
						nudge ? "ring-2 ring-rose-400/50" : ""
					}`}
				>
					{children}
				</div>
				{nudge && <p className="mt-2 text-sm text-rose-300">{nudgeText}</p>}
			</div>
		</li>
	);
}

function DayChip({ day, selected, onSelect }) {
	const full = day.count === 0;
	return (
		<button
			type="button"
			aria-pressed={selected}
			aria-disabled={full}
			onClick={() => !full && onSelect(day.date)}
			className={`relative shrink-0 snap-start w-[68px] py-2.5 rounded-xl border flex flex-col items-center gap-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${
				selected
					? "border-transparent"
					: full
						? "border-white/[0.05] opacity-40 cursor-not-allowed"
						: "border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/[0.16]"
			}`}
		>
			{selected && (
				<motion.span
					layoutId="day-pick"
					className="absolute inset-0 rounded-xl bg-gradient-to-b from-violet-300 to-fuchsia-400"
					transition={{ type: "spring", stiffness: 500, damping: 40 }}
				/>
			)}
			<span
				className={`relative text-[11px] ${selected ? "text-[#0d0b12]/70 font-medium" : "text-stone-400"}`}
			>
				{dayTag(day.date, day.weekday)}
			</span>
			<span
				className={`relative font-mackinac text-xl font-bold tabular-nums ${selected ? "text-[#0d0b12]" : "text-white"}`}
			>
				{day.day}
			</span>
			<span
				className={`relative text-[11px] ${selected ? "text-[#0d0b12]/70" : "text-stone-500"}`}
			>
				{full ? "Full" : day.month}
			</span>
		</button>
	);
}

function SlotButton({ slot, selected, onSelect }) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={() => onSelect(slot)}
			className={`relative h-11 rounded-lg border text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${
				selected
					? "border-transparent text-[#0d0b12] font-semibold"
					: "border-white/[0.08] bg-white/[0.025] text-stone-200 hover:bg-white/[0.06] hover:border-white/[0.16]"
			}`}
		>
			{selected && (
				<motion.span
					layoutId="slot-pick"
					className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-300 to-fuchsia-300"
					transition={{ type: "spring", stiffness: 500, damping: 40 }}
				/>
			)}
			<span className="relative tabular-nums">
				{formatRange(slot.start, slot.end)}
			</span>
		</button>
	);
}

function PayOption({ value, current, onSelect, icon: Icon, title, subtitle }) {
	const on = current === value;
	return (
		<button
			type="button"
			role="radio"
			aria-checked={on}
			onClick={() => onSelect(value)}
			className={`text-left p-4 rounded-xl border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${
				on
					? "border-violet-400/50 bg-violet-400/[0.09]"
					: "border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.16]"
			}`}
		>
			<div className="flex items-start justify-between">
				<span
					className={`w-9 h-9 rounded-lg flex items-center justify-center ${
						on
							? "bg-violet-400/20 text-violet-200"
							: "bg-white/[0.05] text-stone-400"
					}`}
				>
					<Icon size={17} />
				</span>
				<span
					className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
						on
							? "border-transparent bg-gradient-to-br from-violet-300 to-fuchsia-300"
							: "border-white/[0.2]"
					}`}
				>
					{on && <Check size={12} strokeWidth={3} className="text-[#0d0b12]" />}
				</span>
			</div>
			<p className="mt-3 text-sm font-medium text-white">{title}</p>
			<p className="mt-0.5 text-xs text-stone-400">{subtitle}</p>
		</button>
	);
}

function TicketRow({ icon: Icon, label, value, sub, placeholder }) {
	const filled = Boolean(value);
	return (
		<div className="flex gap-3">
			<span
				className={`mt-0.5 w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
					filled
						? "bg-violet-400/15 text-violet-300"
						: "bg-white/[0.05] text-stone-500"
				}`}
			>
				<Icon size={15} />
			</span>
			<div className="min-w-0">
				<p className="text-xs text-stone-500">{label}</p>
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={`${value || "empty"}|${sub || ""}`}
						initial={{ opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.18 }}
					>
						<p
							className={`text-sm leading-snug ${filled ? "text-white font-medium line-clamp-3" : "text-stone-600"}`}
						>
							{value || placeholder}
						</p>
						{sub && <p className="mt-0.5 text-sm text-amber-200">{sub}</p>}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}

function Spinner({ className = "w-5 h-5" }) {
	return (
		<span
			className={`${className} rounded-full border-2 border-[#0d0b12]/30 border-t-[#0d0b12] animate-spin`}
		/>
	);
}

function BookingSkeleton() {
	return (
		<div className="min-h-screen bg-[#0d0b12] px-4 sm:px-6 lg:px-8 py-10">
			<div
				className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-14 animate-pulse"
				aria-busy="true"
				aria-label="Loading booking"
			>
				<div className="lg:col-span-7 space-y-10">
					<div className="h-8 w-64 rounded-lg bg-white/[0.05]" />
					<div className="flex gap-2">
						{[...Array(6)].map((_, i) => (
							<div
								key={i}
								className="w-[68px] h-[84px] rounded-xl bg-white/[0.04]"
							/>
						))}
					</div>
					<div className="grid grid-cols-3 gap-2">
						{[...Array(6)].map((_, i) => (
							<div key={i} className="h-11 rounded-lg bg-white/[0.04]" />
						))}
					</div>
					<div className="h-28 rounded-2xl bg-white/[0.03]" />
				</div>
				<div className="hidden lg:block lg:col-span-5 h-[440px] rounded-2xl bg-white/[0.03] border border-white/[0.05]" />
			</div>
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function BookingPage() {
	const { customId } = useParams();
	const navigate = useNavigate();
	const { state } = useLocation();
	const { user } = useAuth();

	const [provider, setProvider] = useState(state?.provider || null);
	const [availability, setAvailability] = useState(
		state?.preloadedAvailability || state?.provider?.availability || [],
	);

	const [address, setAddress] = useState(state?.address || "");
	const [tempAddress, setTempAddress] = useState(state?.address || "");
	const [coords, setCoords] = useState({
		lat: state?.provider?.latitude || state?.provider?.lat || null,
		lng: state?.provider?.longitude || state?.provider?.lng || null,
	});

	const [selectedDate, setSelectedDate] = useState(
		state?.selectedDateStr || null,
	);
	const [selectedTime, setSelectedTime] = useState(state?.selectedSlot || null);
	const serviceName = state?.serviceName || provider?.service || "Service";

	const [isEditingAddress, setIsEditingAddress] = useState(false);
	const [isLocating, setIsLocating] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [loading, setLoading] = useState(!state?.provider);
	const [alert, setAlert] = useState(null);
	const [paymentMethod, setPaymentMethod] = useState("cash");
	const [nudge, setNudge] = useState(null); // "when" | "address"
	const [savedAddresses, setSavedAddresses] = useState([]);

	useEffect(() => {
		const loadSavedAddresses = async () => {
			try {
				const res = await api.get("/api/account/addresses");
				const list = res.data?.addresses || [];
				setSavedAddresses(list);

				// Auto-populate default address if not provided in navigation state
				if (!state?.address && list.length > 0) {
					const defaultAddr = list.find((a) => a.is_default) || list[0];
					if (defaultAddr) {
						setAddress(defaultAddr.full_address);
						setTempAddress(defaultAddr.full_address);
						if (defaultAddr.lat && defaultAddr.lng) {
							setCoords({ lat: defaultAddr.lat, lng: defaultAddr.lng });
						}
					}
				}
			} catch (err) {
				console.warn(
					"Could not load saved addresses on booking page:",
					err.message,
				);
			}
		};
		loadSavedAddresses();
	}, [state?.address]);

	const whenRef = useRef(null);
	const addressRef = useRef(null);
	const stripRef = useRef(null);
	const payRef = useRef(null);

	const refreshAvailability = async (prov = provider) => {
		try {
			const currentProvider = prov;
			if (currentProvider && (currentProvider.id || currentProvider.user_id)) {
				const provIdentifier = currentProvider.user_id || currentProvider.id;
				const slotsRes = await api.get(
					`/api/providers/v1/${provIdentifier}/availability`,
				);
				if (slotsRes.data) setAvailability(slotsRes.data);
			}
		} catch (err) {
			console.warn("Failed refreshing slots:", err);
		}
	};

	useEffect(() => {
		const fetchData = async () => {
			try {
				let currentProvider = provider;
				if (!currentProvider) {
					setLoading(true);
					const provRes = await api.get(`/api/providers/v1/${customId}`);
					currentProvider = provRes.data?.provider;
					setProvider(currentProvider);
				}
				if (currentProvider) {
					await refreshAvailability(currentProvider);
				}
			} catch (err) {
				console.error("Failed to load data", err);
				setAlert({
					type: "error",
					message: "Failed to load provider details.",
				});
			} finally {
				setLoading(false);
			}
		};
		if (!provider || availability.length === 0) fetchData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [customId]);

	const groupedSlots = useMemo(() => groupSlots(availability), [availability]);

	// Upcoming days only, each with its still-bookable slots.
	const days = useMemo(() => {
		const today = todayStr();
		return Object.keys(groupedSlots)
			.sort()
			.filter((d) => d >= today)
			.map((d) => {
				const open = groupedSlots[d].filter(
					(s) => !s.isBooked && !isSlotExpired(d, s.start),
				);
				return { date: d, open, count: open.length, ...formatDateParts(d) };
			});
	}, [groupedSlots]);

	const currentDay = days.find((d) => d.date === selectedDate) || null;
	const visibleSlots = currentDay?.open || [];

	useEffect(() => {
		if (selectedDate || days.length === 0) return;
		const first = days.find((d) => d.count > 0);
		if (first) setSelectedDate(first.date);
	}, [days, selectedDate]);

	useEffect(() => {
		stripRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({
			inline: "center",
			block: "nearest",
			behavior: "smooth",
		});
	}, [selectedDate]);

	const periodGroups = useMemo(
		() =>
			PERIODS.map((p) => ({
				...p,
				slots: visibleSlots.filter((s) => p.test(parseTime(s.start)?.[0] ?? 0)),
			})).filter((p) => p.slots.length),
		[visibleSlots],
	);

	const dateDisplay = selectedDate ? formatDateParts(selectedDate) : null;
	const hasSchedule = Boolean(selectedDate && selectedTime);
	const hasAddress = Boolean(address.trim());
	const timeRange = selectedTime
		? formatRange(
				selectedTime.start_time || selectedTime.start,
				selectedTime.end_time || selectedTime.end,
			)
		: "";
	const isOnline = paymentMethod === "online";

	const flashNudge = (key, ref) => {
		ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
		setNudge(key);
		setTimeout(() => setNudge(null), 2200);
	};

	const scrollStrip = (dir) =>
		stripRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });

	const pickDay = (date) => {
		setSelectedDate(date);
		setSelectedTime(null);
	};

	const pickSlot = (slot) =>
		setSelectedTime({
			date: slot.date,
			start_time: slot.start,
			end_time: slot.end,
			start: slot.start,
			end: slot.end,
		});

	const saveAddress = () => {
		setAddress(tempAddress.trim());
		setIsEditingAddress(false);
	};

	const detectLocation = () => {
		if (!navigator.geolocation) {
			setAlert({
				message: "Your browser can't share your location.",
				type: "error",
			});
			return;
		}
		setIsLocating(true);
		navigator.geolocation.getCurrentPosition(
			async ({ coords: c }) => {
				setCoords({ lat: c.latitude, lng: c.longitude });
				try {
					const res = await fetch(
						`https://nominatim.openstreetmap.org/reverse?format=json&lat=${c.latitude}&lon=${c.longitude}`,
					);
					const data = await res.json();
					if (data?.display_name) setTempAddress(data.display_name);
				} catch {
					toast.error(
						"Couldn't turn your location into an address. Type it in.",
					);
				} finally {
					setIsLocating(false);
				}
			},
			() => {
				setIsLocating(false);
				toast.error("Location is blocked. Allow access or type your address.");
			},
		);
	};

	/* ---- payment ---- */

	const loadRazorpayScript = () =>
		new Promise((resolve) => {
			if (window.Razorpay) return resolve(true);
			const script = document.createElement("script");
			script.src = "https://checkout.razorpay.com/v1/checkout.js";
			script.onload = () => resolve(true);
			script.onerror = () => resolve(false);
			document.body.appendChild(script);
		});

	const handleRazorpayPayment = async (booking, orderId) => {
		const ok = await loadRazorpayScript();
		if (!ok) {
			setAlert({
				message: "Payment couldn't load. Check your connection.",
				type: "error",
			});
			return;
		}

		let isPaymentHandled = false;

		const cleanupUnpaidBooking = async () => {
			if (isPaymentHandled) return;
			try {
				await api.delete(`/api/bookings/${booking.booking_id}/unpaid`);
			} catch (cleanupErr) {
				console.warn("Failed to release unpaid booking slot:", cleanupErr);
			}
			await refreshAvailability();
		};

		const rzpKey =
			import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_SAa72yHcAfg93t";
		const rzpAmount = Math.round(
			Number(booking.price || provider.price || 499) * 100,
		);

		const rzpOptions = {
			key: rzpKey,
			amount: rzpAmount,
			currency: "INR",
			name: "TaskGenie",
			description: `Booking for ${booking.service_name || serviceName || "Home Service"}`,
			handler: async (response) => {
				isPaymentHandled = true;
				try {
					const verifyRes = await api.post("/api/bookings/verify-payment", {
						...response,
						razorpay_order_id: response.razorpay_order_id || orderId,
						booking_id: booking?.booking_id,
					});
					if (verifyRes.data?.booking) {
						navigate("/booking-success", {
							state: {
								success: true,
								booking: verifyRes.data.booking,
								address,
							},
							replace: true,
						});
					} else {
						toast.error("Payment verification failed. Contact support.");
					}
				} catch (err) {
					console.error("Verification Error:", err);
					toast.error("Payment verification failed. Contact support.");
				}
			},
			modal: {
				ondismiss: async () => {
					await cleanupUnpaidBooking();
					setIsSubmitting(false);
					toast("Payment window closed. The slot was released.");
				},
			},
			prefill: {
				name: user?.name || "Customer",
				email: user?.email || "customer@taskgenie.com",
				contact: user?.phone || "+919876543210",
			},
			theme: { color: "#6d28d9" },
		};

		if (orderId && !orderId.startsWith("test_order_")) {
			rzpOptions.order_id = orderId;
		}

		const rzp = new window.Razorpay(rzpOptions);
		rzp.on("payment.failed", (response) => {
			// Do NOT delete the booking here! Razorpay leaves the modal open for retries via UPI or Netbanking.
			setIsSubmitting(false);
			const desc = response.error?.description || "Transaction declined";
			if (desc.toLowerCase().includes("international")) {
				toast.error(
					"International card rejected by Razorpay. Please retry using UPI (QR Code / GPay) or Netbanking.",
					{ duration: 7000 },
				);
			} else {
				toast.error(`Payment failed: ${desc}. You can retry with UPI or Netbanking in the modal.`);
			}
		});
		rzp.open();
	};

	async function handleConfirm(opts = {}) {
		if (!hasSchedule) return flashNudge("when", whenRef);
		if (!hasAddress) return flashNudge("address", addressRef);

		if (!localStorage.getItem("token")) {
			setAlert({ message: "Sign in to book this service.", type: "error" });
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await api.post("/api/bookings", {
				provider_id: provider.user_id || provider.id || provider.custom_id,
				service_id: provider.service_id,
				price: provider.price,
				date: selectedDate,
				start_time: selectedTime.start_time || selectedTime.start,
				end_time: selectedTime.end_time || selectedTime.end,
				address,
				payment_method: paymentMethod === "cash" ? "cod" : paymentMethod,
				latitude: coords.lat,
				longitude: coords.lng,
			});
			const data = res.data;

			if (opts?.mockPay && isOnline && data.razorpay_order) {
				const verifyRes = await api.post("/api/bookings/verify-payment", {
					razorpay_order_id: data.razorpay_order,
					razorpay_payment_id: `pay_test_${Date.now()}`,
					razorpay_signature: "mock_test_signature",
				});
				toast.success("Test payment authorized successfully!");
				navigate("/booking-success", {
					state: {
						success: true,
						booking: verifyRes.data?.booking || data.booking,
						address,
					},
					replace: true,
				});
				return;
			}

			if (isOnline && data.razorpay_order) {
				handleRazorpayPayment(data.booking, data.razorpay_order);
			} else {
				navigate("/booking-success", {
					state: { success: true, booking: data.booking, address },
					replace: true,
				});
			}
		} catch (err) {
			console.error("Booking error: ", err);
			setAlert({
				message:
					err.response?.data?.message ||
					err.message ||
					"Something went wrong. Try again.",
				type: "error",
			});
		} finally {
			setIsSubmitting(false);
		}
	}

	if (loading || !provider) return <BookingSkeleton />;

	const confirmLabel = isOnline ? "Book and pay" : "Confirm booking";

	const goBack = () =>
		window.history.state?.idx > 0 ? navigate(-1) : navigate("/");
	const steps = [
		{ key: "when", label: "Time", done: hasSchedule, ref: whenRef },
		{ key: "where", label: "Address", done: hasAddress, ref: addressRef },
		{ key: "pay", label: "Payment", done: false, ref: payRef },
	];

	return (
		<div className="min-h-screen bg-[#0d0b12] text-stone-200 bricolage-grotesque antialiased selection:bg-violet-400/30 pb-32 lg:pb-16">
			<div
				aria-hidden
				className="fixed inset-x-0 top-0 h-[460px] pointer-events-none bg-[radial-gradient(60%_100%_at_20%_0%,rgba(139,92,246,0.14),transparent_70%),radial-gradient(45%_80%_at_85%_0%,rgba(251,191,36,0.08),transparent_70%)]"
			/>

			{alert && (
				<Alerts
					message={alert.message}
					type={alert.type}
					onClose={() => setAlert(null)}
				/>
			)}

			<BookingHeader steps={steps} onBack={goBack} />

			<main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
				<div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
					{/* Steps */}
					<div className="lg:col-span-7">
						<div className="lg:hidden mb-8 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.03]">
							<ProviderBlock provider={provider} serviceName={serviceName} />
						</div>

						<h1 className="font-mackinac text-3xl sm:text-4xl font-bold text-white tracking-tight mb-10">
							Book{" "}
							<span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
								{provider.name?.split(" ")[0]}
							</span>
						</h1>

						<ol>
							{/* 1. When */}
							<Step
								n={1}
								title="Pick a day and time"
								hint={hasSchedule ? `${dateDisplay?.full}` : null}
								done={hasSchedule}
								nudge={nudge === "when"}
								nudgeText="Choose a day and a time to continue."
								innerRef={whenRef}
							>
								{days.length === 0 ? (
									<div className="p-6 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.015] text-center">
										<p className="text-sm font-medium text-white">
											No open days right now
										</p>
										<p className="mt-1 text-sm text-stone-500">
											This provider hasn't opened new slots yet.
										</p>
										<button
											type="button"
											onClick={() => navigate(-1)}
											className="mt-3 text-sm text-violet-300 hover:text-white transition-colors"
										>
											See other providers
										</button>
									</div>
								) : (
									<>
										<div className="flex items-center justify-between mb-2">
											<p className="text-sm text-stone-400">Available days</p>
											<div className="hidden md:flex gap-1">
												<button
													type="button"
													onClick={() => scrollStrip(-1)}
													aria-label="Earlier days"
													className="w-8 h-8 rounded-lg border border-white/[0.08] text-stone-400 hover:text-white hover:bg-white/[0.05] flex items-center justify-center transition-colors"
												>
													<ChevronLeft size={16} />
												</button>
												<button
													type="button"
													onClick={() => scrollStrip(1)}
													aria-label="Later days"
													className="w-8 h-8 rounded-lg border border-white/[0.08] text-stone-400 hover:text-white hover:bg-white/[0.05] flex items-center justify-center transition-colors"
												>
													<ChevronRight size={16} />
												</button>
											</div>
										</div>

										<div
											ref={stripRef}
											className="flex gap-2 overflow-x-auto pb-2 pt-1 px-1 -mx-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
										>
											{days.map((d) => (
												<DayChip
													key={d.date}
													day={d}
													selected={selectedDate === d.date}
													onSelect={pickDay}
												/>
											))}
										</div>

										<div className="mt-6">
											<div className="flex items-baseline justify-between mb-3">
												<p className="text-sm text-stone-400">Time</p>
												{visibleSlots.length > 0 && (
													<span className="text-xs text-stone-500">
														{visibleSlots.length} open
													</span>
												)}
											</div>

											{!selectedDate ? (
												<p className="text-sm text-stone-500">
													Choose a day to see open times.
												</p>
											) : periodGroups.length === 0 ? (
												<p className="text-sm text-stone-500">
													No open times on this day. Try another.
												</p>
											) : (
												<div className="space-y-4">
													{periodGroups.map((g) => (
														<div key={g.key}>
															<p className="text-xs text-stone-500 mb-2">
																{g.label}
															</p>
															<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
																{g.slots.map((slot) => (
																	<SlotButton
																		key={`${slot.date}-${slot.start}-${slot.end}`}
																		slot={slot}
																		selected={
																			(selectedTime?.start_time ||
																				selectedTime?.start) === slot.start &&
																			(selectedTime?.end_time ||
																				selectedTime?.end) === slot.end
																		}
																		onSelect={pickSlot}
																	/>
																))}
															</div>
														</div>
													))}
												</div>
											)}
										</div>
									</>
								)}
							</Step>

							{/* 2. Where */}
							<Step
								n={2}
								title="Where should they come?"
								done={hasAddress}
								nudge={nudge === "address"}
								nudgeText="Add the address where the work happens."
								innerRef={addressRef}
							>
								{/* 1-Click Saved Address Picker */}
								{savedAddresses.length > 0 && (
									<div className="mb-3 space-y-2">
										<div className="flex items-center justify-between text-xs text-stone-400">
											<span className="font-medium text-stone-300">
												Choose from saved addresses:
											</span>
											<Link
												to="/account/profile?open=addresses"
												target="_blank"
												rel="noopener noreferrer"
												className="text-[11px] text-violet-300 hover:text-white transition-colors underline decoration-dotted"
											>
												Manage addresses ↗
											</Link>
										</div>
										<div className="flex flex-wrap gap-2">
											{savedAddresses.map((addr) => {
												const isSelected =
													address.trim() === addr.full_address.trim();
												const Icon =
													addr.label === "Work"
														? Briefcase
														: addr.label === "Home"
															? Home
															: MapPin;
												return (
													<button
														key={addr.id}
														type="button"
														onClick={() => {
															setAddress(addr.full_address);
															setTempAddress(addr.full_address);
															if (addr.lat && addr.lng) {
																setCoords({ lat: addr.lat, lng: addr.lng });
															}
															setIsEditingAddress(false);
															toast.success(`Selected "${addr.label}" address`);
														}}
														className={`h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
															isSelected
																? "border-amber-400/60 bg-amber-400/15 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/30"
																: "border-white/[0.08] bg-white/[0.03] text-stone-300 hover:bg-white/[0.06] hover:text-white hover:border-white/[0.15]"
														}`}
													>
														<Icon
															size={13}
															className={
																isSelected ? "text-amber-300" : "text-stone-400"
															}
														/>
														<span>{addr.label || "Address"}</span>
														{addr.is_default && (
															<span className="text-[10px] text-amber-300/80 font-mono">
																(Default)
															</span>
														)}
													</button>
												);
											})}
										</div>
									</div>
								)}

								{isEditingAddress ? (
									<div className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 space-y-3">
										<div className="flex items-center justify-between gap-3">
											<label
												htmlFor="svc-address"
												className="text-sm text-stone-300"
											>
												Service address
											</label>
											<button
												type="button"
												onClick={detectLocation}
												disabled={isLocating}
												className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-white transition-colors disabled:opacity-60"
											>
												<Navigation size={12} />
												{isLocating ? "Locating…" : "Use my location"}
											</button>
										</div>
										<textarea
											id="svc-address"
											value={tempAddress}
											onChange={(e) => setTempAddress(e.target.value)}
											autoFocus
											rows={3}
											placeholder="Flat or house number, building, street, area"
											className="w-full resize-none rounded-lg bg-[#0d0b12] border border-white/[0.1] p-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-violet-400/50 focus:ring-2 focus:ring-violet-400/20"
										/>
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => {
													setTempAddress(address);
													setIsEditingAddress(false);
												}}
												className="h-9 px-3 rounded-lg text-sm text-stone-400 hover:text-white transition-colors"
											>
												Cancel
											</button>
											<button
												type="button"
												onClick={saveAddress}
												className={`h-9 px-4 rounded-lg text-sm ${primaryBtn}`}
											>
												Save address
											</button>
										</div>
									</div>
								) : hasAddress ? (
									<div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
										<span className="mt-0.5 w-9 h-9 shrink-0 rounded-lg bg-violet-400/15 text-violet-300 flex items-center justify-center">
											<MapPin size={17} />
										</span>
										<p className="flex-1 min-w-0 text-sm text-white leading-relaxed">
											{address}
										</p>
										<button
											type="button"
											onClick={() => {
												setTempAddress(address);
												setIsEditingAddress(true);
											}}
											className="shrink-0 text-sm text-violet-300 hover:text-white transition-colors"
										>
											Change
										</button>
									</div>
								) : (
									<button
										type="button"
										onClick={() => setIsEditingAddress(true)}
										className="w-full flex items-center gap-3 rounded-xl border border-dashed border-white/[0.16] bg-white/[0.015] p-4 text-left text-stone-400 hover:text-white hover:border-violet-400/40 hover:bg-violet-400/[0.05] transition-colors"
									>
										<span className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center">
											<MapPin size={17} />
										</span>
										<span className="text-sm">Add your service address</span>
									</button>
								)}
							</Step>

							{/* 3. Payment */}
							<Step n={3} title="How would you like to pay?" done last>
								<div
									role="radiogroup"
									aria-label="Payment method"
									className="grid sm:grid-cols-2 gap-3"
								>
									<PayOption
										value="online"
										current={paymentMethod}
										onSelect={setPaymentMethod}
										icon={CreditCard}
										title="Pay now"
										subtitle="UPI, cards, and wallets"
									/>
									<PayOption
										value="cash"
										current={paymentMethod}
										onSelect={setPaymentMethod}
										icon={Wallet}
										title="Pay after service"
										subtitle="Cash to the provider once it's done"
									/>
								</div>

								{paymentMethod === "online" && (
									<div className="mt-3.5 p-3.5 rounded-xl bg-violet-950/40 border border-violet-500/20 text-xs space-y-2.5">
										<div className="flex items-center justify-between">
											<span className="font-semibold text-violet-300 flex items-center gap-1.5">
												<span>🧪</span> Razorpay Test Credentials (India Domestic)
											</span>
											<span className="text-[10px] text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full font-medium">
												Sandbox Mode
											</span>
										</div>
										<p className="text-stone-300 text-[11px] leading-relaxed">
											Razorpay sandbox blocks foreign test cards (e.g. 4111 11...). Use these <strong>pre-approved Indian domestic cards</strong> or <strong>UPI</strong>:
										</p>
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
											<button
												type="button"
												onClick={() => {
													navigator.clipboard.writeText("5104015555555558");
													toast.success("Copied Mastercard: 5104 0155 5555 5558");
												}}
												className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/10 hover:border-violet-400/50 text-left transition-all cursor-pointer group"
											>
												<div>
													<span className="block font-medium text-stone-200 group-hover:text-violet-300 text-[11px]">
														Mastercard (Domestic)
													</span>
													<span className="font-mono text-[11px] text-stone-400">
														5104 0155 5555 5558
													</span>
												</div>
												<span className="text-[10px] text-violet-400 group-hover:underline">
													Copy
												</span>
											</button>
											<button
												type="button"
												onClick={() => {
													navigator.clipboard.writeText("6527658900001005");
													toast.success("Copied RuPay: 6527 6589 0000 1005");
												}}
												className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/10 hover:border-violet-400/50 text-left transition-all cursor-pointer group"
											>
												<div>
													<span className="block font-medium text-stone-200 group-hover:text-violet-300 text-[11px]">
														RuPay (Domestic)
													</span>
													<span className="font-mono text-[11px] text-stone-400">
														6527 6589 0000 1005
													</span>
												</div>
												<span className="text-[10px] text-violet-400 group-hover:underline">
													Copy
												</span>
											</button>
										</div>
										<div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-stone-400 border-t border-white/5">
											<span>
												<strong>UPI:</strong>{" "}
												<button
													type="button"
													onClick={() => {
														navigator.clipboard.writeText("success@razorpay");
														toast.success("Copied UPI ID: success@razorpay");
													}}
													className="text-violet-300 underline underline-offset-2 hover:text-violet-200 cursor-pointer"
												>
													success@razorpay
												</button>{" "}
												or scan the QR
											</span>
											<span>
												<strong>CVV:</strong> 123 &bull; <strong>Expiry:</strong> 12/28 &bull; <strong>OTP:</strong> 123456
											</span>
										</div>
									</div>
								)}
							</Step>
						</ol>
					</div>

					{/* Ticket (desktop) */}
					<aside className="hidden lg:block lg:col-span-5 lg:sticky lg:top-24">
						<div className="relative rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.06] to-white/[0.02]">
							<div className="p-6">
								<ProviderBlock provider={provider} serviceName={serviceName} />
							</div>

							<div className="relative">
								<div className="mx-6 border-t border-dashed border-white/[0.14]" />
								<span
									aria-hidden
									className="absolute -left-[9px] -top-[9px] w-[18px] h-[18px] rounded-full bg-[#0d0b12] border-r border-white/[0.09]"
								/>
								<span
									aria-hidden
									className="absolute -right-[9px] -top-[9px] w-[18px] h-[18px] rounded-full bg-[#0d0b12] border-l border-white/[0.09]"
								/>
							</div>

							<div className="p-6 space-y-5">
								<TicketRow
									icon={Calendar}
									label="When"
									value={dateDisplay?.full}
									sub={dateDisplay ? timeRange || "Choose a time" : null}
									placeholder="Choose a day and time"
								/>
								<TicketRow
									icon={MapPin}
									label="Where"
									value={hasAddress ? address : null}
									placeholder="Add your address"
								/>
								<TicketRow
									icon={isOnline ? CreditCard : Wallet}
									label="Payment"
									value={isOnline ? "Online" : "Cash"}
									placeholder=""
								/>

								<div className="flex items-end justify-between border-t border-white/[0.08] pt-5">
									<div>
										<p className="text-xs text-stone-500">Total</p>
										<p className="text-xs text-stone-500">
											{isOnline
												? "Paid securely at checkout"
												: "Due after the service"}
										</p>
									</div>
									<p className="font-mackinac text-3xl font-bold text-amber-200 tabular-nums">
										{formatINR(provider.price)}
									</p>
								</div>

								<button
									type="button"
									onClick={handleConfirm}
									disabled={isSubmitting}
									className={`w-full h-12 rounded-xl text-base flex items-center justify-center gap-2 disabled:opacity-70 ${primaryBtn}`}
								>
									{isSubmitting ? <Spinner /> : confirmLabel}
								</button>

								{isOnline && (
									<button
										type="button"
										onClick={() => handleConfirm({ mockPay: true })}
										disabled={isSubmitting}
										className="w-full mt-2.5 py-2.5 px-3 rounded-xl border border-dashed border-violet-400/40 text-xs font-semibold text-violet-300 hover:bg-violet-950/40 hover:border-violet-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
									>
										<span>⚡</span> Instant Test Pay (Bypass Modal)
									</button>
								)}
							</div>
						</div>
					</aside>
				</div>
			</main>

			{/* Bottom bar (mobile) */}
			<div className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/[0.08] bg-[#0d0b12]/95 backdrop-blur-xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
				<div className="max-w-md mx-auto flex items-center gap-4">
					<div className="min-w-0">
						<p className="font-mackinac text-xl font-bold text-amber-200 tabular-nums leading-none">
							{formatINR(provider.price)}
						</p>
						<p className="mt-1 text-xs text-stone-400 truncate">
							{hasSchedule
								? `${dayTag(selectedDate, dateDisplay.weekday)} · ${timeRange}`
								: isOnline
									? "Pay now"
									: "Pay after service"}
						</p>
					</div>
					<div className="flex-1 flex flex-col gap-1.5">
						<button
							type="button"
							onClick={handleConfirm}
							disabled={isSubmitting}
							className={`w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-70 ${primaryBtn}`}
						>
							{isSubmitting ? (
								<Spinner className="w-4 h-4" />
							) : !hasSchedule ? (
								"Choose a time"
							) : !hasAddress ? (
								"Add address"
							) : (
								confirmLabel
							)}
						</button>
						{isOnline && hasSchedule && hasAddress && (
							<button
								type="button"
								onClick={() => handleConfirm({ mockPay: true })}
								disabled={isSubmitting}
								className="text-[11px] font-semibold text-violet-300 hover:underline flex items-center justify-center gap-1 cursor-pointer"
							>
								<span>⚡</span> Instant Test Pay
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
