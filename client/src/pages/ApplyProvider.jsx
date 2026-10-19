import React, { useState, useEffect, useRef } from "react";
import {
	Award,
	Check,
	ChevronLeft,
	CircleAlert,
	CreditCard,
	Eye,
	EyeOff,
	FileCheck,
	FileText,
	Fingerprint,
	Loader2,
	ShieldCheck,
	UploadCloud,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import api from "../api/axiosInstance";
import VerifiedBadge from "../ui/VerifiedBadge";
import ServiceBaseLocation from "../ui/ServiceBaseLocation";
import { validCoordinates } from "../utils/serviceLocation";

/*
 * Design: The Live Provider Slip & Master Sheet.
 * Balanced with TaskGenie's design palette:
 *  deep ink / aubergine  #1E1240  pad background, headings, primary ink
 *  brand violet          #7C3AED  selected states, primary actions, highlights
 *  sheet background      #FAF9FD  clean writing paper
 *  sheet rule            #E2E8F0  printed rules and borders
 *  margin red            #F43F5E  sheet margin line, rubber stamp, errors
 *  duplicate sheet       #FEF08A  soft yellow middle sheet
 *  triplicate sheet      #E9D5FF  soft lilac bottom sheet
 *  slate text            #0F172A  printed text
 *  mute                  #64748B  secondary descriptions
 */

const DEFAULT_SERVICES = [
	{
		id: "1",
		name: "Electrical Repair",
		slug: "electrical-repair",
		category: "Repair",
		icon: "⚡",
	},
	{
		id: "2",
		name: "Plumbing Services",
		slug: "plumbing",
		category: "Plumbing",
		icon: "🔧",
	},
	{
		id: "3",
		name: "House Deep Cleaning",
		slug: "house-cleaning",
		category: "Cleaning",
		icon: "🧹",
	},
	{
		id: "4",
		name: "Appliance Repair",
		slug: "appliance-repair",
		category: "Appliance",
		icon: "❄️",
	},
	{
		id: "5",
		name: "Painting & Decorating",
		slug: "painting",
		category: "Home Improvement",
		icon: "🎨",
	},
	{
		id: "6",
		name: "Pest Control",
		slug: "pest-control",
		category: "Home Services",
		icon: "🛡️",
	},
];

const DAYS = [
	{ id: 1, name: "Mon", full: "Monday" },
	{ id: 2, name: "Tue", full: "Tuesday" },
	{ id: 3, name: "Wed", full: "Wednesday" },
	{ id: 4, name: "Thu", full: "Thursday" },
	{ id: 5, name: "Fri", full: "Friday" },
	{ id: 6, name: "Sat", full: "Saturday" },
	{ id: 0, name: "Sun", full: "Sunday" },
];

const STEPS = [
	{
		label: "Details",
		title: "Tell us about yourself",
		description: "We'll use these to create your provider account.",
	},
	{
		label: "Service",
		title: "What service do you offer?",
		description: "Pick your main service and set your starting rate.",
	},
	{
		label: "Schedule",
		title: "When are you available?",
		description: "Choose the days and hours you're open for bookings.",
	},
	{
		label: "Verify",
		title: "Verify your identity",
		description:
			"Add a government-approved ID to earn your Verified Pro badge.",
	},
];

const KYC_DOCS = [
	{
		id: "aadhaar",
		label: "Aadhaar card",
		sub: "12-digit UIDAI ID",
		icon: Fingerprint,
		numberLabel: "Aadhaar number (12 digits)",
		placeholder: "5482 1920 4412",
	},
	{
		id: "driving_license",
		label: "Driving license",
		sub: "State transport dept.",
		icon: CreditCard,
		numberLabel: "Driving license number",
		placeholder: "MH-02-2018-0091242",
	},
	{
		id: "certificate",
		label: "Trade certificate",
		sub: "Certified professional",
		icon: Award,
		numberLabel: "Certificate or registration ID",
		placeholder: "CERT-PLUMB-90211",
	},
];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_HOURS = { start: "09:00", end: "18:00" };

// Hours bar shows 6 am to 10 pm
const WIN_START = 360;
const WIN_END = 1320;
const toMin = (t) => {
	const [h, m] = (t || "0:0").split(":").map(Number);
	return (h || 0) * 60 + (m || 0);
};
const hoursSpan = (a) => {
	const s = Math.max(toMin(a.start), WIN_START);
	const e = Math.min(toMin(a.end), WIN_END);
	return {
		left: `${((s - WIN_START) / (WIN_END - WIN_START)) * 100}%`,
		width: `${Math.max(0, ((e - s) / (WIN_END - WIN_START)) * 100)}%`,
	};
};

/* ---------- shared styles ---------- */

const focusRing =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2";

const inputBase =
	"w-full rounded-none border-0 border-b-2 border-slate-200 bg-transparent px-1 py-2.5 text-lg font-semibold text-[#1E1240] placeholder:font-normal placeholder:text-slate-400 transition-colors hover:border-violet-300 focus:border-violet-600 focus:bg-violet-50/20 focus:outline-none";

const timeInput =
	"rounded-none border-0 border-b-2 border-slate-200 bg-transparent px-1 py-1 text-sm font-semibold text-[#1E1240] transition-colors hover:border-violet-300 focus:border-violet-600 focus:outline-none";

const primaryBtn = `inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-7 py-3 text-base font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

const css = `
.tg-sheet-line {
	background-image: linear-gradient(#FDA4AF, #FDA4AF);
	background-size: 2px 100%;
	background-repeat: no-repeat;
}
`;

/* ---------- building blocks ---------- */

function Group({ title, hint, children }) {
	return (
		<div className="space-y-4 border-t border-slate-200 pt-7 first:border-t-0 first:pt-0">
			{title && (
				<div>
					<h3 className="text-xl font-bold tracking-tight text-[#1E1240]">{title}</h3>
					{hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
				</div>
			)}
			{children}
		</div>
	);
}

function Field({ id, label, optional, hint, children }) {
	return (
		<div>
			<label htmlFor={id} className="block text-sm font-semibold text-slate-800">
				{label}
				{optional && (
					<span className="ml-2 text-xs font-normal text-slate-400">
						(optional)
					</span>
				)}
			</label>
			{children}
			{hint && (
				<p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
					{hint}
				</p>
			)}
		</div>
	);
}

function PasswordInput({ id, value, onChange, describedBy }) {
	const [show, setShow] = useState(false);
	return (
		<div className="relative">
			<input
				id={id}
				type={show ? "text" : "password"}
				required
				autoComplete="new-password"
				placeholder="At least 8 characters"
				aria-describedby={describedBy}
				value={value}
				onChange={onChange}
				className={`${inputBase} pr-11`}
			/>
			<button
				type="button"
				onClick={() => setShow((s) => !s)}
				aria-label={show ? "Hide password" : "Show password"}
				aria-pressed={show}
				className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none"
			>
				{show ? <EyeOff size={18} /> : <Eye size={18} />}
			</button>
		</div>
	);
}

function OptionRow({ selected, onClick, icon, title, sub }) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={onClick}
			className={`relative flex w-full items-center gap-3.5 rounded-xl border-2 p-3.5 text-left transition-all ${focusRing} ${
				selected
					? "border-violet-600 bg-violet-50/70 shadow-xs"
					: "border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50/50"
			}`}
		>
			<span
				aria-hidden="true"
				className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl transition-colors ${
					selected
						? "bg-violet-600 text-white"
						: "bg-violet-50 text-violet-700"
				}`}
			>
				{icon}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-sm font-bold leading-snug text-slate-900">
					{title}
				</span>
				<span className="block text-xs text-slate-500 mt-0.5">
					{sub}
				</span>
			</span>
			{selected && (
				<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
					<Check size={12} strokeWidth={3} aria-hidden="true" />
				</span>
			)}
		</button>
	);
}

function UploadSlot({
	id,
	label,
	optional,
	url,
	uploading,
	onSelect,
	onRemove,
}) {
	const isPdf = /\.pdf(\?|#|$)/i.test(url || "");
	return (
		<div>
			<div className="mb-1.5 text-xs font-semibold text-slate-700 flex items-center justify-between">
				<span>{label}</span>
				{optional && (
					<span className="text-[11px] font-normal text-slate-400">
						(optional)
					</span>
				)}
			</div>
			{url ? (
				<div className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-xs">
					<div className="flex aspect-[16/10] items-center justify-center bg-violet-50/40 p-2">
						{isPdf ? (
							<div className="flex flex-col items-center gap-2 text-violet-700">
								<FileText size={32} strokeWidth={1.5} />
								<span className="text-xs font-semibold">PDF uploaded</span>
							</div>
						) : (
							<img
								src={url}
								alt={`${label} preview`}
								className="h-full w-full object-contain rounded-lg"
							/>
						)}
					</div>
					<div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-3 py-2">
						<span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
							<FileCheck size={14} aria-hidden="true" /> Uploaded
						</span>
						<button
							type="button"
							onClick={onRemove}
							className="rounded-md px-2 py-0.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
						>
							Remove
						</button>
					</div>
				</div>
			) : (
				<label
					htmlFor={id}
					className={`flex aspect-[16/10] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-3 text-center transition-all ${
						uploading
							? "border-violet-500 bg-violet-50/50"
							: "border-slate-200 bg-white hover:border-violet-400 hover:bg-violet-50/20"
					}`}
				>
					<input
						id={id}
						type="file"
						accept="image/*,.pdf"
						className="sr-only"
						disabled={uploading}
						onChange={(e) => {
							onSelect(e.target.files?.[0]);
							e.target.value = "";
						}}
					/>
					{uploading ? (
						<>
							<Loader2
								size={24}
								className="animate-spin text-violet-600"
								aria-hidden="true"
							/>
							<span className="text-xs font-semibold text-violet-900">Uploading...</span>
						</>
					) : (
						<>
							<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
								<UploadCloud
									size={20}
									strokeWidth={2}
									aria-hidden="true"
								/>
							</div>
							<span className="text-xs font-bold text-slate-800">Choose a file</span>
							<span className="text-[11px] text-slate-400">
								PNG, JPG or PDF up to 10 MB
							</span>
						</>
					)}
				</label>
			)}
		</div>
	);
}

/* ---------- the slip: the live provider pass ---------- */

function Stamp({ tone, children, reduceMotion }) {
	const styles = {
		idle: "border-dashed border-slate-400 text-slate-400",
		ready: "border-rose-600 text-rose-600 bg-rose-50/60 shadow-xs",
	};
	return (
		<motion.span
			key={String(children)}
			initial={
				reduceMotion || tone === "idle"
					? false
					: { scale: 1.5, opacity: 0, rotate: -16 }
			}
			animate={{ scale: 1, opacity: 1, rotate: tone === "idle" ? 0 : -6 }}
			transition={{ type: "spring", stiffness: 380, damping: 18 }}
			className={`inline-block rounded-md border-[2.5px] px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${styles[tone]}`}
		>
			{children}
		</motion.span>
	);
}

function SlipRow({ label, children, big, plain }) {
	return (
		<div className="flex items-baseline gap-3 border-b border-slate-100 py-2.5">
			<dt className="w-18 shrink-0 text-xs font-medium text-slate-400">
				{label}
			</dt>
			<dd
				className={`min-w-0 flex-1 font-semibold text-[#1E1240] ${plain ? "" : "truncate"} ${
					big ? "text-xl font-extrabold leading-tight" : "text-sm"
				}`}
			>
				{children}
			</dd>
		</div>
	);
}

function PassCard({
	compact,
	name,
	service,
	location,
	rate,
	unit,
	days,
	passId,
	stamp,
	reduceMotion,
}) {
	const unset = <span className="font-normal text-slate-400">Not set</span>;

	if (compact) {
		return (
			<div
				className="flex items-center gap-4 rounded-xl bg-white p-4 text-[#1E1240] shadow-sm border border-slate-200"
				aria-label="Your provider slip preview"
			>
				<div className="min-w-0 flex-1">
					<p
						className={`truncate text-base font-extrabold ${name ? "text-[#1E1240]" : "text-slate-400"}`}
					>
						{name || "Your name"}
					</p>
					<p className="truncate text-xs text-slate-500 mt-0.5">
						{service
							? `${service.icon || "🛠️"} ${service.name}`
							: "Your service"}
					</p>
				</div>
				<Stamp tone={stamp.tone} reduceMotion={reduceMotion}>
					{stamp.text}
				</Stamp>
			</div>
		);
	}

	return (
		<div
			className="relative mb-4 mr-4 lg:-rotate-[1.5deg]"
			aria-label="Your provider slip preview"
		>
			{/* Triplicate bottom sheet (soft lilac) */}
			<div
				aria-hidden="true"
				className="absolute inset-0 translate-x-3 translate-y-3 rotate-2 rounded-2xl bg-[#E9D5FF] border border-purple-200/50 opacity-90 shadow-sm"
			/>
			{/* Duplicate middle sheet (soft yellow) */}
			<div
				aria-hidden="true"
				className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-1 rounded-2xl bg-[#FEF08A] border border-amber-200/60 opacity-95 shadow-sm"
			/>
			{/* Original top sheet (clean white card) */}
			<div className="relative rounded-2xl bg-white px-6 pb-6 pt-5 text-[#1E1240] shadow-xl border border-slate-200/80">
				<div className="flex items-baseline justify-between gap-3 border-b-2 border-violet-700 pb-3">
					<div className="flex items-center gap-2">
						<span className="text-base font-extrabold tracking-tight">TaskGenie Pro</span>
						<VerifiedBadge size="xs" showTooltip={false} />
					</div>
					<span className="truncate text-xs font-bold font-mono tabular-nums text-rose-600">
						No. {passId || "pending"}
					</span>
				</div>

				<dl className="divide-y divide-slate-100">
					<SlipRow label="Name" big>
						{name || (
							<span className="font-normal text-slate-400">Your name</span>
						)}
					</SlipRow>
					<SlipRow label="Service">
						{service ? `${service.icon || "🛠️"} ${service.name}` : unset}
					</SlipRow>
					<SlipRow label="Based in">{location || unset}</SlipRow>
					<SlipRow label="Rate">
						{rate > 0
							? `₹${rate.toLocaleString("en-IN")} ${unit === "hourly" ? "per hour" : "per task"}`
							: unset}
					</SlipRow>
					<SlipRow label="Open" plain>
						<span className="flex gap-1">
							{DAYS.map((d) => {
								const on = days.includes(d.id);
								return (
									<span
										key={d.id}
										title={d.full}
										className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all ${
											on
												? "-rotate-6 text-rose-600 ring-2 ring-rose-500 font-extrabold bg-rose-50"
												: "font-medium text-slate-300"
										}`}
									>
										{d.name[0]}
									</span>
								);
							})}
						</span>
					</SlipRow>
				</dl>

				<div className="mt-5 flex justify-end">
					<Stamp tone={stamp.tone} reduceMotion={reduceMotion}>
						{stamp.text}
					</Stamp>
				</div>
			</div>
		</div>
	);
}

/* Four tally strokes for step progress */
function Tally({ current, successData, onGo, reduceMotion }) {
	return (
		<ol
			aria-label="Application progress"
			className="relative mt-8 grid grid-cols-4 gap-2 sm:gap-3"
		>
			{STEPS.map((s, i) => {
				const num = i + 1;
				const done = current > num;
				const active = current === num;
				const body = (
					<>
						<span
							aria-hidden="true"
							style={{ transform: `rotate(${i % 2 ? 2 : -2}deg)` }}
							className={`mx-auto block h-11 w-1.5 rounded-full transition-colors duration-300 ${
								done ? "bg-white" : active ? "bg-amber-300 shadow-xs shadow-amber-300/40" : "bg-white/20"
							}`}
						/>
						<span
							className={`mt-2 flex items-center justify-center gap-1 text-xs font-semibold ${
								active
									? "text-amber-300 font-bold"
									: done
										? "text-white"
										: "text-white/60 font-medium"
							}`}
						>
							{done && <Check size={12} strokeWidth={3} aria-hidden="true" />}
							{s.label}
						</span>
					</>
				);
				return (
					<li key={s.label} aria-current={active ? "step" : undefined}>
						{done && !successData ? (
							<button
								type="button"
								onClick={() => onGo(num)}
								className="block w-full rounded-md underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
							>
								{body}
							</button>
						) : (
							body
						)}
					</li>
				);
			})}
			{successData && (
				<motion.span
					aria-hidden="true"
					initial={reduceMotion ? false : { scaleX: 0 }}
					animate={{ scaleX: 1 }}
					transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
					className="pointer-events-none absolute -left-2 top-5 h-1 w-[104%] origin-left -rotate-[8deg] rounded-full bg-amber-300"
				/>
			)}
		</ol>
	);
}

/* ---------- page ---------- */

export default function ApplyProvider() {
	const [step, setStep] = useState(1);
	const [loading, setLoading] = useState(false);
	const [uploadingDoc, setUploadingDoc] = useState({
		front: false,
		back: false,
	});
	const [successData, setSuccessData] = useState(null);
	const [errorMsg, setErrorMsg] = useState("");
	const [baseLocation, setBaseLocation] = useState({
		lat: null,
		lng: null,
		confirmed: false,
	});
	const [servicesList, setServicesList] = useState(DEFAULT_SERVICES);

	const [formData, setFormData] = useState({
		name: "",
		email: "",
		phone: "",
		password: "",
		location: "Mumbai, Maharashtra",
		bio: "",
		service: "electrical-repair",
		price: 499,
		price_unit: "fixed",
		availability: [1, 2, 3, 4, 5, 6].map((day) => ({ day, ...DEFAULT_HOURS })),
		kyc_doc_type: "aadhaar",
		kyc_doc_number: "",
		kyc_doc_front: "",
		kyc_doc_back: "",
		kyc_declaration: false,
	});

	const reduceMotion = useReducedMotion();
	const headingRef = useRef(null);
	const errorRef = useRef(null);
	const mounted = useRef(false);

	useEffect(() => {
		async function fetchServices() {
			try {
				const res = await api.get("/api/services/v1");
				if (Array.isArray(res.data) && res.data.length > 0) {
					setServicesList(res.data);
					setFormData((prev) => ({ ...prev, service: res.data[0].slug }));
				}
			} catch (err) {
				console.log("Using default services list", err);
			}
		}
		fetchServices();
	}, []);

	// Move focus to the new step heading (keyboard and screen-reader friendly)
	useEffect(() => {
		if (!mounted.current) {
			mounted.current = true;
			return;
		}
		headingRef.current?.focus();
	}, [step, successData]);

	// Bring new errors into view
	useEffect(() => {
		if (errorMsg)
			errorRef.current?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			});
	}, [errorMsg]);

	const handleInputChange = (field, value) => {
		setErrorMsg("");
		setFormData((prev) => ({ ...prev, [field]: value }));
		if (field === "location")
			setBaseLocation({ lat: null, lng: null, confirmed: false });
	};

	const handleFileUpload = async (side, file) => {
		if (!file) return;
		if (file.size > MAX_UPLOAD_BYTES) {
			setErrorMsg(
				"That file is larger than 10 MB. Please choose a smaller one.",
			);
			return;
		}
		setUploadingDoc((prev) => ({ ...prev, [side]: true }));
		setErrorMsg("");
		try {
			const uploadData = new FormData();
			uploadData.append("document", file);
			const res = await api.post("/api/providers/upload-kyc", uploadData, {
				headers: { "Content-Type": "multipart/form-data" },
			});
			if (res.data?.url) {
				handleInputChange(
					side === "front" ? "kyc_doc_front" : "kyc_doc_back",
					res.data.url,
				);
			}
		} catch (err) {
			console.error("KYC upload error:", err);
			setErrorMsg(
				err.response?.data?.error ||
					"Failed to upload verification document. Please try again.",
			);
		} finally {
			setUploadingDoc((prev) => ({ ...prev, [side]: false }));
		}
	};

	const toggleDayAvailability = (dayId) => {
		setErrorMsg("");
		setFormData((prev) => {
			const exists = prev.availability.find((a) => a.day === dayId);
			return {
				...prev,
				availability: exists
					? prev.availability.filter((a) => a.day !== dayId)
					: [...prev.availability, { day: dayId, ...DEFAULT_HOURS }],
			};
		});
	};

	const applyDayPreset = (dayIds) => {
		setErrorMsg("");
		setFormData((prev) => ({
			...prev,
			availability: dayIds.map(
				(day) =>
					prev.availability.find((a) => a.day === day) || {
						day,
						...DEFAULT_HOURS,
					},
			),
		}));
	};

	const handleTimeChange = (dayId, type, val) => {
		setErrorMsg("");
		setFormData((prev) => ({
			...prev,
			availability: prev.availability.map((a) =>
				a.day === dayId ? { ...a, [type]: val } : a,
			),
		}));
	};

	const handleNextStep = () => {
		if (step === 1) {
			if (
				!baseLocation.confirmed ||
				!validCoordinates(baseLocation.lat, baseLocation.lng)
			) {
				setErrorMsg(
					"Confirm your service base so nearby customers can find you",
				);
				return;
			}
			if (!formData.name || formData.name.trim().length < 3) {
				setErrorMsg("Please enter your full name (at least 3 letters)");
				return;
			}
			if (!formData.email || !formData.email.includes("@")) {
				setErrorMsg("Please enter a valid email address");
				return;
			}
			if (!formData.phone || !/^\+91 ?[6-9]\d{9}$/.test(formData.phone)) {
				setErrorMsg(
					"Enter a valid Indian phone number (+91 followed by 10 digits)",
				);
				return;
			}
			if (!formData.password || formData.password.length < 8) {
				setErrorMsg("Password must be at least 8 characters");
				return;
			}
		} else if (step === 2) {
			if (!formData.service) {
				setErrorMsg("Please select a primary service");
				return;
			}
			if (!formData.price || Number(formData.price) <= 0) {
				setErrorMsg("Please enter a valid starting service rate");
				return;
			}
		} else if (step === 3) {
			if (!formData.availability || formData.availability.length === 0) {
				setErrorMsg("Please select at least one working day in your schedule");
				return;
			}
			const badDay = formData.availability.find((a) => a.start >= a.end);
			if (badDay) {
				const day = DAYS.find((d) => d.id === badDay.day);
				setErrorMsg(
					`On ${day?.full}, the end time must be later than the start time`,
				);
				return;
			}
		}
		setErrorMsg("");
		setStep((s) => Math.min(s + 1, 4));
	};

	const goToStep = (target) => {
		setErrorMsg("");
		setStep(target);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		// Pressing Enter on steps 1-3 should move forward, not submit
		if (step < 4) {
			handleNextStep();
			return;
		}

		setErrorMsg("");

		if (!formData.kyc_doc_type) {
			setErrorMsg(
				"Please select a government ID document type for KYC verification.",
			);
			return;
		}
		if (!formData.kyc_doc_number || formData.kyc_doc_number.trim().length < 4) {
			setErrorMsg("Please enter your valid identification document number.");
			return;
		}
		if (!formData.kyc_declaration) {
			setErrorMsg(
				"Please accept the background verification consent declaration.",
			);
			return;
		}

		if (
			!baseLocation.confirmed ||
			!validCoordinates(baseLocation.lat, baseLocation.lng)
		) {
			setStep(1);
			setErrorMsg("Confirm your service base before submitting");
			return;
		}
		setLoading(true);

		try {
			const payload = {
				name: formData.name,
				email: formData.email.toLowerCase(),
				phone: formData.phone.trim(),
				password: formData.password,
				location: formData.location,
				lat: Number(baseLocation.lat),
				lng: Number(baseLocation.lng),
				bio: formData.bio,
				service: formData.service,
				price: Number(formData.price),
				price_unit: formData.price_unit,
				availability: formData.availability,
				kyc_doc_type: formData.kyc_doc_type,
				kyc_doc_number: formData.kyc_doc_number.trim(),
				kyc_doc_front: formData.kyc_doc_front || null,
				kyc_doc_back: formData.kyc_doc_back || null,
			};

			const res = await api.post("/api/providers/v1", payload);
			setSuccessData(res.data);
		} catch (err) {
			const errorText =
				err.response?.data?.error ||
				err.response?.data?.message ||
				err.message ||
				"Failed to submit provider application";
			setErrorMsg(errorText);
		} finally {
			setLoading(false);
		}
	};

	const meta = STEPS[step - 1];
	const current = successData ? STEPS.length + 1 : step;
	const selectedDoc = KYC_DOCS.find((d) => d.id === formData.kyc_doc_type);
	const selectedService = servicesList.find((s) => s.slug === formData.service);
	const isUploading = uploadingDoc.front || uploadingDoc.back;
	const priceNumber = Number(formData.price);
	const activeDays = formData.availability.map((a) => a.day);

	const stamp = successData
		? { tone: "ready", text: "Under review" }
		: step === 4 &&
			  formData.kyc_declaration &&
			  formData.kyc_doc_number.trim().length >= 4
			? { tone: "ready", text: "Ready to submit" }
			: { tone: "idle", text: "Not verified yet" };

	const passProps = {
		name: formData.name,
		service: selectedService,
		location: formData.location,
		rate: priceNumber,
		unit: formData.price_unit,
		days: activeDays,
		passId: successData?.custom_id,
		stamp,
		reduceMotion,
	};

	return (
		<div className="bricolage-grotesque min-h-screen pt-28 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 text-[#1E1240]">
			<style>{css}</style>

			{/* Main Centered Framed Card Container */}
			<div className="max-w-7xl mx-auto rounded-[2rem] overflow-hidden border border-slate-200/90 shadow-2xl shadow-purple-950/10 grid lg:grid-cols-[minmax(360px,440px)_1fr] bg-white">
				{/* ---------- Left: the bill book pad ---------- */}
				<aside className="bg-[#1E1240] px-6 py-8 sm:px-10 sm:py-12 lg:px-10 lg:py-14 text-white flex flex-col justify-between">
					<div className="lg:sticky lg:top-28">
						<span className="inline-block text-xs font-bold uppercase tracking-widest text-violet-300 mb-2">
							TaskGenie Pro Onboarding
						</span>
						<h1 className="text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl lg:text-[42px]">
							Fill in your provider slip
						</h1>
						<p className="mt-3 text-sm leading-relaxed text-white/80">
							Your official partner slip updates live as you type. Free to apply, zero upfront fees.
						</p>

						<div className="mt-7 lg:hidden">
							<PassCard compact {...passProps} />
						</div>
						<div className="mt-8 hidden lg:block">
							<PassCard {...passProps} />
						</div>

						<Tally
							current={current}
							successData={successData}
							onGo={goToStep}
							reduceMotion={reduceMotion}
						/>
					</div>
				</aside>

				{/* ---------- Right: the sheet ---------- */}
				<main className="relative bg-[#FAF9FD] px-6 py-8 sm:pl-16 sm:pr-10 lg:pl-20 lg:pr-14 lg:py-12">
					{/* Red margin guide line */}
					<div
						aria-hidden="true"
						className="tg-sheet-line absolute inset-y-0 left-6 hidden w-0.5 sm:block lg:left-10"
					/>
					<div className="max-w-2xl">
						{successData ? (
							<motion.div
								initial={reduceMotion ? false : { opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.25 }}
								className="py-6"
							>
								<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-3">
									<Check size={14} strokeWidth={3} /> Application Received
								</div>

								<h2
									ref={headingRef}
									tabIndex={-1}
									className="text-3xl font-extrabold tracking-tight text-[#1E1240] focus:outline-none sm:text-4xl"
								>
									Application submitted
								</h2>
								<p className="mt-2 text-base leading-relaxed text-slate-600">
									Welcome to TaskGenie. Keep your provider ID handy, you'll use
									it to sign in.
								</p>

								<div className="relative mt-8 inline-block">
									<div
										aria-hidden="true"
										className="absolute inset-0 translate-x-2 translate-y-2 rotate-1 rounded-xl bg-[#E9D5FF] opacity-90"
									/>
									<div className="relative rounded-xl border border-slate-200 bg-white px-7 py-5 shadow-sm">
										<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
											Your provider ID
										</p>
										<p className="text-3xl font-extrabold tabular-nums tracking-wide text-rose-600 font-mono mt-1">
											{successData.custom_id}
										</p>
									</div>
								</div>

								<h3 className="mt-10 text-xl font-bold tracking-tight text-[#1E1240]">
									What happens next
								</h3>
								<ol className="mt-4 space-y-3">
									{[
										"Our verification team reviews your documents (12–24h)",
										"Log in to your provider dashboard with your ID",
										"Start receiving and accepting local customer bookings",
									].map((text, i) => (
										<li key={text} className="flex items-center gap-3.5">
											<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-violet-600 text-sm font-bold text-violet-600">
												{i + 1}
											</span>
											<span className="text-sm font-medium text-slate-800">{text}</span>
										</li>
									))}
								</ol>

								<button
									type="button"
									onClick={() => (window.location.href = "/provider/dashboard")}
									className={`${primaryBtn} mt-8`}
								>
									Go to dashboard
								</button>
							</motion.div>
						) : (
							<form onSubmit={handleSubmit} noValidate>
								<header className="mb-8">
									<div className="flex items-start justify-between gap-4">
										<div>
											<span className="text-xs font-bold uppercase tracking-wider text-violet-600">
												Step {step} of 4: {meta.label}
											</span>
											<h2
												ref={headingRef}
												tabIndex={-1}
												className="text-2xl font-extrabold leading-tight tracking-tight text-[#1E1240] focus:outline-none sm:text-3xl mt-1"
											>
												{meta.title}
											</h2>
										</div>
										{step === 4 && <VerifiedBadge size="md" />}
									</div>
									<p className="mt-2 text-sm leading-relaxed text-slate-600">
										{meta.description}
									</p>
								</header>

								{errorMsg && (
									<div
										ref={errorRef}
										role="alert"
										className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
									>
										<CircleAlert
											size={18}
											className="mt-0.5 shrink-0 text-rose-600"
											aria-hidden="true"
										/>
										<span>{errorMsg}</span>
									</div>
								)}

								<motion.div
									key={step}
									initial={reduceMotion ? false : { opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ duration: 0.2 }}
									className="space-y-7"
								>
									{/* ---- Step 1 ---- */}
									{step === 1 && (
										<>
											<Group>
												<div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
													<Field id="name" label="Full name">
														<input
															id="name"
															type="text"
															required
															autoComplete="name"
															placeholder="Rahul Sharma"
															value={formData.name}
															onChange={(e) =>
																handleInputChange("name", e.target.value)
															}
															className={inputBase}
														/>
													</Field>
													<Field id="email" label="Email address">
														<input
															id="email"
															type="email"
															required
															autoComplete="email"
															placeholder="rahul@example.com"
															value={formData.email}
															onChange={(e) =>
																handleInputChange("email", e.target.value)
															}
															className={inputBase}
														/>
													</Field>
													<Field
														id="phone"
														label="Mobile number"
														hint="Start with +91, then your 10-digit number"
													>
														<input
															id="phone"
															type="tel"
															inputMode="tel"
															required
															autoComplete="tel"
															placeholder="+91 9876543210"
															aria-describedby="phone-hint"
															value={formData.phone}
															onChange={(e) =>
																handleInputChange("phone", e.target.value)
															}
															className={`${inputBase} font-mono`}
														/>
													</Field>
													<Field
														id="password"
														label="Password"
														hint="Use at least 8 characters"
													>
														<PasswordInput
															id="password"
															describedBy="password-hint"
															value={formData.password}
															onChange={(e) =>
																handleInputChange("password", e.target.value)
															}
														/>
													</Field>
												</div>
											</Group>

											<Group
												title="Where you work"
												hint="Customers near this spot will find you first."
											>
												<Field id="location" label="City or region" optional>
													<input
														id="location"
														type="text"
														autoComplete="address-level2"
														placeholder="Mumbai, Maharashtra"
														value={formData.location}
														onChange={(e) =>
															handleInputChange("location", e.target.value)
														}
														className={inputBase}
													/>
												</Field>
												<div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4">
													<ServiceBaseLocation
														key={formData.location}
														value={baseLocation}
														onChange={setBaseLocation}
													/>
												</div>
											</Group>

											<Group title="About you">
												<Field id="bio" label="Your experience" optional>
													<textarea
														id="bio"
														rows={3}
														maxLength={500}
														placeholder="Licensed electrician with 6+ years of residential repair experience..."
														value={formData.bio}
														onChange={(e) =>
															handleInputChange("bio", e.target.value)
														}
														style={{
															backgroundImage:
																"repeating-linear-gradient(transparent 0 31px, #E2E8F0 31px 32px)",
															backgroundAttachment: "local",
														}}
														className={`${inputBase} resize-none border-b-0 leading-8 focus:bg-transparent`}
													/>
													<p className="mt-1 text-right text-xs text-slate-500">
														{formData.bio.length}/500
													</p>
												</Field>
											</Group>
										</>
									)}

									{/* ---- Step 2 ---- */}
									{step === 2 && (
										<>
											<Group title="Primary service">
												<div
													role="radiogroup"
													aria-label="Primary service"
													className="grid gap-3 sm:grid-cols-2"
												>
													{servicesList.map((s) => (
														<OptionRow
															key={s.slug}
															selected={formData.service === s.slug}
															onClick={() =>
																handleInputChange("service", s.slug)
															}
															icon={s.icon || "🛠️"}
															title={s.name}
															sub={s.category}
														/>
													))}
												</div>
											</Group>

											<Group title="Your rate">
												<div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
													<Field
														id="price"
														label="Starting rate"
														hint={
															priceNumber > 0
																? `Clients will see ₹${priceNumber.toLocaleString("en-IN")} ${formData.price_unit === "hourly" ? "per hour" : "per task"}`
																: undefined
														}
													>
														<div className="relative">
															<span
																aria-hidden="true"
																className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-2xl font-extrabold text-violet-600"
															>
																₹
															</span>
															<input
																id="price"
																type="number"
																inputMode="numeric"
																min="0"
																required
																aria-describedby="price-hint"
																value={formData.price}
																onChange={(e) =>
																	handleInputChange("price", e.target.value)
																}
																className={`${inputBase} pl-7 text-2xl font-extrabold`}
															/>
														</div>
													</Field>

													<div>
														<p
															id="unit-label"
															className="mb-1.5 text-sm font-semibold text-slate-800"
														>
															Charge
														</p>
														<div
															role="radiogroup"
															aria-labelledby="unit-label"
															className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-1"
														>
															{[
																{ id: "fixed", label: "Per task" },
																{ id: "hourly", label: "Per hour" },
															].map((u) => {
																const selected = formData.price_unit === u.id;
																return (
																	<button
																		key={u.id}
																		type="button"
																		role="radio"
																		aria-checked={selected}
																		onClick={() =>
																			handleInputChange("price_unit", u.id)
																		}
																		className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
																			selected
																				? "bg-white text-violet-700 shadow-sm"
																				: "text-slate-600 hover:text-slate-900"
																		}`}
																	>
																		{u.label}
																	</button>
																);
															})}
														</div>
													</div>
												</div>
											</Group>
										</>
									)}

									{/* ---- Step 3 ---- */}
									{step === 3 && (
										<>
											<Group title="Working days">
												<div className="grid grid-cols-7 gap-2">
													{DAYS.map((d) => {
														const on = activeDays.includes(d.id);
														return (
															<button
																key={d.id}
																type="button"
																aria-pressed={on}
																aria-label={d.full}
																onClick={() => toggleDayAvailability(d.id)}
																className={`flex h-13 sm:h-14 flex-col items-center justify-center rounded-xl border text-sm font-bold transition-all ${focusRing} ${
																	on
																		? "border-violet-600 bg-violet-600 text-white shadow-md shadow-violet-500/20"
																		: "border-slate-200 bg-white text-slate-600 hover:border-violet-300"
																}`}
															>
																<span>{d.name}</span>
															</button>
														);
													})}
												</div>
												<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
													<span className="font-semibold text-slate-700">Quick set:</span>
													{[
														{ label: "Mon to Fri", days: [1, 2, 3, 4, 5] },
														{ label: "Mon to Sat", days: [1, 2, 3, 4, 5, 6] },
														{ label: "Every day", days: [1, 2, 3, 4, 5, 6, 0] },
													].map((p) => (
														<button
															key={p.label}
															type="button"
															onClick={() => applyDayPreset(p.days)}
															className="font-semibold text-violet-600 hover:underline"
														>
															{p.label}
														</button>
													))}
												</p>
											</Group>

											<Group
												title="Hours"
												hint="Set the same or different hours for each day. Bars show 6 am to 10 pm."
											>
												{formData.availability.length === 0 ? (
													<p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
														Tap a day above to set your hours.
													</p>
												) : (
													<ul className="divide-y divide-slate-100 border-y border-slate-200">
														{DAYS.filter((d) => activeDays.includes(d.id)).map(
															(d) => {
																const rule = formData.availability.find(
																	(a) => a.day === d.id,
																);
																return (
																	<li
																		key={d.id}
																		className="grid items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[6.5rem_1fr_auto]"
																	>
																		<span className="text-sm font-bold text-slate-800">
																			{d.full}
																		</span>
																		<div
																			aria-hidden="true"
																			className="relative hidden h-2 rounded-full bg-slate-200/80 sm:block"
																		>
																			<span
																				className="absolute inset-y-0 rounded-full bg-violet-600 transition-[left,width] duration-200"
																				style={hoursSpan(rule)}
																			/>
																		</div>
																		<div className="flex items-center gap-2">
																			<input
																				type="time"
																				aria-label={`${d.full} start time`}
																				value={rule.start}
																				onChange={(e) =>
																					handleTimeChange(
																						d.id,
																						"start",
																						e.target.value,
																					)
																				}
																				className={timeInput}
																			/>
																			<span className="text-xs text-slate-400">
																				to
																			</span>
																			<input
																				type="time"
																				aria-label={`${d.full} end time`}
																				value={rule.end}
																				onChange={(e) =>
																					handleTimeChange(
																						d.id,
																						"end",
																						e.target.value,
																					)
																				}
																				className={timeInput}
																			/>
																		</div>
																	</li>
																);
															},
														)}
													</ul>
												)}
											</Group>
										</>
									)}

									{/* ---- Step 4 ---- */}
									{step === 4 && (
										<>
											<div className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
												<span className="text-3xl font-extrabold leading-none tracking-tight text-amber-700">
													3.8x
												</span>
												<p className="flex items-start gap-2 text-xs leading-relaxed text-amber-950">
													<ShieldCheck
														size={16}
														className="mt-0.5 shrink-0 text-amber-700"
														aria-hidden="true"
													/>
													<span>
														more bookings for Verified Pros, plus priority
														dispatch. Our security team checks every provider to
														keep homeowners safe.
													</span>
												</p>
											</div>

											<Group title="Identification document">
												<div
													role="radiogroup"
													aria-label="Identification document"
													className="grid gap-2.5 sm:grid-cols-3"
												>
													{KYC_DOCS.map((doc) => {
														const Icon = doc.icon;
														return (
															<OptionRow
																key={doc.id}
																selected={formData.kyc_doc_type === doc.id}
																onClick={() =>
																	handleInputChange("kyc_doc_type", doc.id)
																}
																icon={<Icon size={18} strokeWidth={2} />}
																title={doc.label}
																sub={doc.sub}
															/>
														);
													})}
												</div>
												<Field
													id="kyc_doc_number"
													label={selectedDoc.numberLabel}
												>
													<input
														id="kyc_doc_number"
														type="text"
														autoComplete="off"
														value={formData.kyc_doc_number}
														onChange={(e) =>
															handleInputChange(
																"kyc_doc_number",
																e.target.value,
															)
														}
														placeholder={selectedDoc.placeholder}
														className={`${inputBase} tracking-wide font-mono`}
													/>
												</Field>
											</Group>

											<Group
												title="Upload your document"
												hint="A clear photo or scan works best."
											>
												<div className="grid gap-4 sm:grid-cols-2">
													<UploadSlot
														id="kyc-front"
														label="Front"
														url={formData.kyc_doc_front}
														uploading={uploadingDoc.front}
														onSelect={(file) => handleFileUpload("front", file)}
														onRemove={() =>
															handleInputChange("kyc_doc_front", "")
														}
													/>
													<UploadSlot
														id="kyc-back"
														label="Back"
														optional
														url={formData.kyc_doc_back}
														uploading={uploadingDoc.back}
														onSelect={(file) => handleFileUpload("back", file)}
														onRemove={() =>
															handleInputChange("kyc_doc_back", "")
														}
													/>
												</div>
											</Group>

											<label
												htmlFor="kyc_declaration"
												className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
													formData.kyc_declaration
														? "border-violet-600 bg-violet-50/50"
														: "border-slate-200 hover:border-slate-300"
												}`}
											>
												<input
													type="checkbox"
													id="kyc_declaration"
													checked={formData.kyc_declaration}
													onChange={(e) =>
														handleInputChange(
															"kyc_declaration",
															e.target.checked,
														)
													}
													className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-violet-600"
												/>
												<span className="text-xs leading-relaxed text-slate-700">
													I confirm these details and documents are mine and
													authentic. I consent to TaskGenie verifying them with
													authorized databases to issue my{" "}
													<strong className="font-bold text-slate-900">Verified Pro</strong>{" "}
													badge.
												</span>
											</label>
										</>
									)}
								</motion.div>

								{/* ---- Form Footer Navigation ---- */}
								<div className="mt-10 flex items-center justify-between gap-4 border-t border-slate-200 pt-6">
									{step > 1 ? (
										<button
											type="button"
											onClick={() => goToStep(step - 1)}
											className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:text-violet-700 transition-colors"
										>
											<ChevronLeft size={18} aria-hidden="true" /> Back
										</button>
									) : (
										<span />
									)}

									{step < STEPS.length ? (
										<button
											type="button"
											onClick={handleNextStep}
											className={primaryBtn}
										>
											Next: {STEPS[step].label}
										</button>
									) : (
										<button
											type="submit"
											disabled={loading || isUploading}
											className={primaryBtn}
										>
											{loading && (
												<Loader2
													size={18}
													className="animate-spin"
													aria-hidden="true"
												/>
											)}
											{loading ? "Submitting..." : "Submit application"}
										</button>
									)}
								</div>
							</form>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
