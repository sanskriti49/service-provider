import React, { useState, useEffect, useRef } from "react";
import {
	Award,
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
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

/*
 * Design tokens (Tailwind arbitrary values, no config changes needed)
 *  ink     #1E1240  headings, dark sidebar
 *  brand   #5B2EE0  primary actions, selected states
 *  lilac   #CDBBFF  progress and completed steps on dark
 *  mist    #EFEAFB  selected-option background
 *  page    #F6F4FB  page background
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
		label: "Your details",
		title: "Tell us about yourself",
		description: "We'll use these details to create your provider account.",
	},
	{
		label: "Your service",
		title: "What service do you offer?",
		description: "Pick your main service and set your starting rate.",
	},
	{
		label: "Your schedule",
		title: "When are you available?",
		description: "Choose the days and hours you're open for bookings.",
	},
	{
		label: "Verification",
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

/* ---------- shared styles ---------- */

const inputBase =
	"w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-[#1E1240] placeholder:text-slate-400 transition-colors focus:border-[#5B2EE0] focus:outline-none focus:ring-2 focus:ring-[#5B2EE0]/20";

const focusRing =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B2EE0] focus-visible:ring-offset-2";

const primaryBtn = `inline-flex items-center justify-center gap-2 rounded-full bg-[#5B2EE0] px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-[#4A22C4] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

/* ---------- small building blocks ---------- */

function Field({ id, label, optional, hint, children }) {
	return (
		<div>
			<label
				htmlFor={id}
				className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-[#1E1240]"
			>
				<span>{label}</span>
				{optional && (
					<span className="text-xs font-normal text-slate-500">Optional</span>
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
				placeholder="At least 6 characters"
				aria-describedby={describedBy}
				value={value}
				onChange={onChange}
				className={`${inputBase} pr-12`}
			/>
			<button
				type="button"
				onClick={() => setShow((s) => !s)}
				aria-label={show ? "Hide password" : "Show password"}
				aria-pressed={show}
				className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition-colors hover:text-[#1E1240] ${focusRing}`}
			>
				{show ? <EyeOff size={18} /> : <Eye size={18} />}
			</button>
		</div>
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
			<div className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-[#1E1240]">
				<span>{label}</span>
				{optional && (
					<span className="text-xs font-normal text-slate-500">Optional</span>
				)}
			</div>

			{url ? (
				<div className="overflow-hidden rounded-2xl border border-slate-300">
					<div className="flex aspect-[16/10] items-center justify-center bg-slate-100">
						{isPdf ? (
							<div className="flex flex-col items-center gap-2 text-slate-600">
								<FileText size={32} strokeWidth={1.5} />
								<span className="text-sm">PDF uploaded</span>
							</div>
						) : (
							<img
								src={url}
								alt={`${label} preview`}
								className="h-full w-full object-cover"
							/>
						)}
					</div>
					<div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2">
						<span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
							<FileCheck size={16} aria-hidden="true" /> Uploaded
						</span>
						<button
							type="button"
							onClick={onRemove}
							className={`rounded-md px-2.5 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 ${focusRing}`}
						>
							Remove
						</button>
					</div>
				</div>
			) : (
				<label
					htmlFor={id}
					className={`flex aspect-[16/10] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-center transition-colors focus-within:ring-2 focus-within:ring-[#5B2EE0]/30 ${
						uploading
							? "border-[#5B2EE0] bg-[#EFEAFB]"
							: "border-slate-300 hover:border-[#5B2EE0] hover:bg-[#F6F4FB]"
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
								className="animate-spin text-[#5B2EE0]"
								aria-hidden="true"
							/>
							<span className="text-sm font-medium text-[#1E1240]">
								Uploading…
							</span>
						</>
					) : (
						<>
							<UploadCloud
								size={26}
								strokeWidth={1.5}
								className="text-[#5B2EE0]"
								aria-hidden="true"
							/>
							<span className="text-sm font-medium text-[#1E1240]">
								Choose a file to upload
							</span>
							<span className="text-xs text-slate-500">
								PNG, JPG or PDF, up to 10 MB
							</span>
						</>
					)}
				</label>
			)}
		</div>
	);
}

function OptionCard({ selected, onClick, children }) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={onClick}
			className={`relative rounded-2xl border p-4 text-left transition-colors ${focusRing} ${
				selected
					? "border-[#5B2EE0] bg-[#EFEAFB] ring-1 ring-[#5B2EE0]"
					: "border-slate-300 bg-white hover:border-[#5B2EE0]/60"
			}`}
		>
			{selected && (
				<span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#5B2EE0] text-white">
					<Check size={12} strokeWidth={3} aria-hidden="true" />
				</span>
			)}
			{children}
		</button>
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
		availability: [1, 2, 3, 4, 5, 6].map((day) => ({
			day,
			...DEFAULT_HOURS,
		})),
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
		if (errorMsg) {
			errorRef.current?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			});
		}
	}, [errorMsg]);

	const handleInputChange = (field, value) => {
		setErrorMsg("");
		setFormData((prev) => ({ ...prev, [field]: value }));
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
			if (!formData.name || formData.name.length < 3) {
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
			if (!formData.password || formData.password.length < 6) {
				setErrorMsg("Password must be at least 6 characters");
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

		setLoading(true);

		try {
			const payload = {
				name: formData.name,
				email: formData.email.toLowerCase(),
				phone: formData.phone.trim(),
				password: formData.password,
				location: formData.location,
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
	const isUploading = uploadingDoc.front || uploadingDoc.back;
	const priceNumber = Number(formData.price);

	return (
		<div className="mt-18 bricolage-grotesque min-h-screen bg-[#F6F4FB] px-4 py-8 text-[#1E1240] sm:px-6 sm:py-12">
			<div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-[#E4DEF5] bg-white lg:grid lg:grid-cols-[340px_1fr]">
				{/* ---------- Sidebar ---------- */}
				<aside className="bg-[#1E1240] px-6 py-8 text-white sm:px-10 sm:py-10 lg:py-12">
					<h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
						Apply as a verified service expert
					</h1>
					<p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/70">
						Set your own rates and hours, and connect with clients near you.
					</p>

					{/* Mobile progress */}
					<div className="mt-6 lg:hidden">
						<div className="flex items-center justify-between text-sm">
							<span className="font-medium">
								{successData ? "All done" : `Step ${step} of ${STEPS.length}`}
							</span>
							{!successData && (
								<span className="text-white/70">{STEPS[step - 1].label}</span>
							)}
						</div>
						<div
							role="progressbar"
							aria-valuemin={0}
							aria-valuemax={STEPS.length}
							aria-valuenow={Math.min(current - 1, STEPS.length)}
							aria-label="Application progress"
							className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"
						>
							<div
								className="h-full rounded-full bg-[#CDBBFF] transition-[width] duration-300"
								style={{
									width: `${(Math.min(current - 1, STEPS.length) / STEPS.length) * 100}%`,
								}}
							/>
						</div>
					</div>

					{/* Desktop stepper */}
					<ol className="mt-12 hidden lg:block">
						{STEPS.map((s, idx) => {
							const num = idx + 1;
							const done = current > num;
							const active = current === num;
							const canGo = done && !successData;

							const circle = (
								<span
									className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
										done
											? "bg-[#CDBBFF] text-[#1E1240]"
											: active
												? "bg-white text-[#1E1240]"
												: "border border-white/30 text-white/60"
									}`}
								>
									{done ? <Check size={16} strokeWidth={3} /> : num}
								</span>
							);

							const text = (
								<span className="block pt-1 text-left">
									<span
										className={`block text-base font-semibold ${
											active || done ? "text-white" : "text-white/60"
										}`}
									>
										{s.label}
									</span>
								</span>
							);

							return (
								<li
									key={s.label}
									aria-current={active ? "step" : undefined}
									className="relative pb-9 last:pb-0"
								>
									{idx < STEPS.length - 1 && (
										<span
											aria-hidden="true"
											className={`absolute left-4 top-9 bottom-1 w-px -translate-x-1/2 ${
												done ? "bg-[#CDBBFF]" : "bg-white/20"
											}`}
										/>
									)}
									{canGo ? (
										<button
											type="button"
											onClick={() => goToStep(num)}
											className="flex w-full items-start gap-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CDBBFF] focus-visible:ring-offset-4 focus-visible:ring-offset-[#1E1240]"
										>
											{circle}
											{text}
										</button>
									) : (
										<div className="flex items-start gap-4">
											{circle}
											{text}
										</div>
									)}
								</li>
							);
						})}
					</ol>

					<p className="mt-12 hidden text-sm text-white/60 lg:block">
						Free to apply. No upfront fees.
					</p>
				</aside>

				{/* ---------- Main panel ---------- */}
				<main className="px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
					{successData ? (
						<motion.div
							initial={reduceMotion ? false : { opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.25 }}
							className="py-4 sm:py-8"
						>
							<div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
								<CheckCircle2 size={30} aria-hidden="true" />
							</div>

							<h2
								ref={headingRef}
								tabIndex={-1}
								className="mt-6 text-2xl font-semibold tracking-tight focus:outline-none sm:text-3xl"
							>
								Application submitted
							</h2>
							<p className="mt-2 max-w-md text-base leading-relaxed text-slate-600">
								Welcome to TaskGenie. Keep your provider ID handy:
							</p>
							<p className="mt-3 inline-block rounded-lg bg-[#EFEAFB] px-4 py-2 font-mono text-lg font-semibold text-[#1E1240]">
								{successData.custom_id}
							</p>

							<div className="mt-10">
								<h3 className="text-base font-semibold">What happens next</h3>
								<ol className="mt-4 space-y-4">
									{[
										"Log in to your provider dashboard",
										"Complete phone and location verification",
										"Start receiving booking requests",
									].map((text, i) => (
										<li key={text} className="flex items-center gap-4">
											<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFEAFB] text-sm font-semibold text-[#5B2EE0]">
												{i + 1}
											</span>
											<span className="text-base text-slate-700">{text}</span>
										</li>
									))}
								</ol>
							</div>

							<button
								type="button"
								onClick={() => (window.location.href = "/provider/dashboard")}
								className={`${primaryBtn} mt-10`}
							>
								Go to dashboard
							</button>
						</motion.div>
					) : (
						<form onSubmit={handleSubmit} noValidate>
							<header className="mb-8">
								<p className="text-sm text-slate-500">
									Step {step} of {STEPS.length}
								</p>
								<div className="mt-1 flex items-start justify-between gap-4">
									<h2
										ref={headingRef}
										tabIndex={-1}
										className="text-2xl font-semibold tracking-tight focus:outline-none sm:text-3xl"
									>
										{meta.title}
									</h2>
									{step === 4 && <VerifiedBadge size="md" />}
								</div>
								<p className="mt-2 max-w-lg text-base leading-relaxed text-slate-600">
									{meta.description}
								</p>
							</header>

							{errorMsg && (
								<div
									ref={errorRef}
									role="alert"
									className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
								>
									<CircleAlert
										size={18}
										className="mt-0.5 shrink-0 text-red-600"
										aria-hidden="true"
									/>
									<span>{errorMsg}</span>
								</div>
							)}

							<motion.div
								key={step}
								initial={reduceMotion ? false : { opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.25 }}
								className="space-y-6"
							>
								{/* ---- Step 1 ---- */}
								{step === 1 && (
									<>
										<div className="grid gap-5 sm:grid-cols-2">
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
										</div>

										<div className="grid gap-5 sm:grid-cols-2">
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
													className={inputBase}
												/>
											</Field>
											<Field
												id="password"
												label="Password"
												hint="Use at least 6 characters"
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

										<Field
											id="bio"
											label="About you and your experience"
											optional
										>
											<textarea
												id="bio"
												rows={4}
												maxLength={500}
												placeholder="Licensed electrician with 6+ years of residential repair experience…"
												value={formData.bio}
												onChange={(e) =>
													handleInputChange("bio", e.target.value)
												}
												className={`${inputBase} resize-none`}
											/>
											<p className="mt-1.5 text-right text-xs text-slate-500">
												{formData.bio.length}/500
											</p>
										</Field>
									</>
								)}

								{/* ---- Step 2 ---- */}
								{step === 2 && (
									<>
										<div>
											<p
												id="service-label"
												className="mb-2 text-sm font-medium"
											>
												Primary service
											</p>
											<div
												role="radiogroup"
												aria-labelledby="service-label"
												className="grid grid-cols-2 gap-3 sm:grid-cols-3"
											>
												{servicesList.map((s) => (
													<OptionCard
														key={s.slug}
														selected={formData.service === s.slug}
														onClick={() => handleInputChange("service", s.slug)}
													>
														<span className="block text-2xl" aria-hidden="true">
															{s.icon || "🛠️"}
														</span>
														<span className="mt-3 block text-sm font-semibold leading-snug">
															{s.name}
														</span>
														<span className="mt-0.5 block text-xs text-slate-500">
															{s.category}
														</span>
													</OptionCard>
												))}
											</div>
										</div>

										<div className="grid gap-5 sm:grid-cols-2">
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
														className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
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
														className={`${inputBase} pl-9`}
													/>
												</div>
											</Field>

											<div>
												<p
													id="unit-label"
													className="mb-1.5 text-sm font-medium"
												>
													Charge
												</p>
												<div
													role="radiogroup"
													aria-labelledby="unit-label"
													className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"
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
																className={`rounded-lg px-3 py-2.5 text-base font-medium transition-colors ${focusRing} ${
																	selected
																		? "bg-white text-[#1E1240] shadow-sm"
																		: "text-slate-600 hover:text-[#1E1240]"
																}`}
															>
																{u.label}
															</button>
														);
													})}
												</div>
											</div>
										</div>
									</>
								)}

								{/* ---- Step 3 ---- */}
								{step === 3 && (
									<>
										<div className="flex flex-wrap items-center gap-2">
											<span className="mr-1 text-sm text-slate-600">
												Quick set:
											</span>
											{[
												{ label: "Mon to Fri", days: [1, 2, 3, 4, 5] },
												{ label: "Mon to Sat", days: [1, 2, 3, 4, 5, 6] },
												{ label: "Every day", days: [1, 2, 3, 4, 5, 6, 0] },
											].map((p) => (
												<button
													key={p.label}
													type="button"
													onClick={() => applyDayPreset(p.days)}
													className={`rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-[#5B2EE0] hover:text-[#5B2EE0] ${focusRing}`}
												>
													{p.label}
												</button>
											))}
										</div>

										<ul className="divide-y divide-slate-200 rounded-2xl border border-slate-300">
											{DAYS.map((d) => {
												const rule = formData.availability.find(
													(a) => a.day === d.id,
												);
												const isOn = Boolean(rule);
												return (
													<li
														key={d.id}
														className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3.5"
													>
														<label className="flex cursor-pointer items-center gap-3">
															<span className="relative inline-flex">
																<input
																	type="checkbox"
																	role="switch"
																	checked={isOn}
																	onChange={() => toggleDayAvailability(d.id)}
																	className="peer sr-only"
																/>
																<span className="h-6 w-11 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[#5B2EE0] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[#5B2EE0] peer-focus-visible:ring-offset-2" />
															</span>
															<span
																className={`text-base font-medium ${isOn ? "" : "text-slate-500"}`}
															>
																{d.full}
															</span>
														</label>

														{isOn ? (
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
																	className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-[#5B2EE0] focus:outline-none focus:ring-2 focus:ring-[#5B2EE0]/20"
																/>
																<span className="text-sm text-slate-500">
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
																	className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-[#5B2EE0] focus:outline-none focus:ring-2 focus:ring-[#5B2EE0]/20"
																/>
															</div>
														) : (
															<span className="text-sm text-slate-500">
																Day off
															</span>
														)}
													</li>
												);
											})}
										</ul>
									</>
								)}

								{/* ---- Step 4 ---- */}
								{step === 4 && (
									<>
										<div className="flex items-start gap-3 rounded-2xl bg-[#F6F4FB] p-4">
											<ShieldCheck
												size={22}
												strokeWidth={1.75}
												className="mt-0.5 shrink-0 text-[#5B2EE0]"
												aria-hidden="true"
											/>
											<p className="text-sm leading-relaxed text-slate-700">
												Our security team checks every provider to keep
												homeowners safe. Verified pros enjoy{" "}
												<strong className="font-semibold">
													3.8x higher booking conversion
												</strong>{" "}
												and priority dispatch.
											</p>
										</div>

										<div>
											<p id="doc-label" className="mb-2 text-sm font-medium">
												Identification document
											</p>
											<div
												role="radiogroup"
												aria-labelledby="doc-label"
												className="grid gap-3 sm:grid-cols-3"
											>
												{KYC_DOCS.map((doc) => {
													const Icon = doc.icon;
													return (
														<OptionCard
															key={doc.id}
															selected={formData.kyc_doc_type === doc.id}
															onClick={() =>
																handleInputChange("kyc_doc_type", doc.id)
															}
														>
															<Icon
																size={24}
																strokeWidth={1.5}
																className="text-[#5B2EE0]"
																aria-hidden="true"
															/>
															<span className="mt-3 block text-sm font-semibold">
																{doc.label}
															</span>
															<span className="mt-0.5 block text-xs text-slate-500">
																{doc.sub}
															</span>
														</OptionCard>
													);
												})}
											</div>
										</div>

										<Field id="kyc_doc_number" label={selectedDoc.numberLabel}>
											<input
												id="kyc_doc_number"
												type="text"
												autoComplete="off"
												value={formData.kyc_doc_number}
												onChange={(e) =>
													handleInputChange("kyc_doc_number", e.target.value)
												}
												placeholder={selectedDoc.placeholder}
												className={`${inputBase} font-mono tracking-wide`}
											/>
										</Field>

										<div className="grid gap-5 sm:grid-cols-2">
											<UploadSlot
												id="kyc-front"
												label="Front of document"
												url={formData.kyc_doc_front}
												uploading={uploadingDoc.front}
												onSelect={(file) => handleFileUpload("front", file)}
												onRemove={() => handleInputChange("kyc_doc_front", "")}
											/>
											<UploadSlot
												id="kyc-back"
												label="Back of document"
												optional
												url={formData.kyc_doc_back}
												uploading={uploadingDoc.back}
												onSelect={(file) => handleFileUpload("back", file)}
												onRemove={() => handleInputChange("kyc_doc_back", "")}
											/>
										</div>

										<div className="flex items-start gap-3 rounded-2xl border border-slate-300 p-4">
											<input
												type="checkbox"
												id="kyc_declaration"
												checked={formData.kyc_declaration}
												onChange={(e) =>
													handleInputChange("kyc_declaration", e.target.checked)
												}
												className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[#5B2EE0]"
											/>
											<label
												htmlFor="kyc_declaration"
												className="cursor-pointer text-sm leading-relaxed text-slate-700"
											>
												I confirm that these details and documents are mine and
												authentic. I consent to TaskGenie verifying them with
												authorized databases to issue my{" "}
												<strong className="font-semibold">Verified Pro</strong>{" "}
												badge.
											</label>
										</div>
									</>
								)}
							</motion.div>

							{/* ---- Navigation ---- */}
							<div className="mt-10 flex items-center justify-between gap-4 border-t border-slate-200 pt-6">
								{step > 1 ? (
									<button
										type="button"
										onClick={() => goToStep(step - 1)}
										className={`inline-flex items-center gap-1 rounded-full px-4 py-3 text-base font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#1E1240] ${focusRing}`}
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
										Continue <ChevronRight size={18} aria-hidden="true" />
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
										{loading ? "Submitting…" : "Submit application"}
									</button>
								)}
							</div>
						</form>
					)}
				</main>
			</div>
		</div>
	);
}
