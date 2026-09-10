import React, { useState, useEffect } from "react";
import {
	User,
	Mail,
	Phone,
	Lock,
	MapPin,
	FileText,
	Briefcase,
	Clock,
	CheckCircle2,
	ChevronRight,
	ChevronLeft,
	Sparkles,
	ShieldCheck,
	Award,
	Loader2,
	DollarSign,
	CircleAlert,
	UploadCloud,
	FileCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import api from "../api/axiosInstance";
import VerifiedBadge from "../ui/VerifiedBadge";

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
	{ id: 1, name: "Mon" },
	{ id: 2, name: "Tue" },
	{ id: 3, name: "Wed" },
	{ id: 4, name: "Thu" },
	{ id: 5, name: "Fri" },
	{ id: 6, name: "Sat" },
	{ id: 0, name: "Sun" },
];

export default function ApplyProvider() {
	const [step, setStep] = useState(1);
	const [loading, setLoading] = useState(false);
	const [uploadingDoc, setUploadingDoc] = useState({ front: false, back: false });
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
		availability: [
			{ day: 1, start: "09:00", end: "18:00" },
			{ day: 2, start: "09:00", end: "18:00" },
			{ day: 3, start: "09:00", end: "18:00" },
			{ day: 4, start: "09:00", end: "18:00" },
			{ day: 5, start: "09:00", end: "18:00" },
			{ day: 6, start: "09:00", end: "18:00" },
		],
		kyc_doc_type: "aadhaar",
		kyc_doc_number: "",
		kyc_doc_front: "",
		kyc_doc_back: "",
		kyc_declaration: true,
	});

	useEffect(() => {
		async function fetchServices() {
			try {
				const res = await api.get("/services/v1");
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

	const handleInputChange = (field, value) => {
		setErrorMsg("");
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleFileUpload = async (side, file) => {
		if (!file) return;
		setUploadingDoc((prev) => ({ ...prev, [side]: true }));
		setErrorMsg("");
		try {
			const uploadData = new FormData();
			uploadData.append("document", file);
			const res = await api.post("/providers/upload-kyc", uploadData, {
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
			if (exists) {
				return {
					...prev,
					availability: prev.availability.filter((a) => a.day !== dayId),
				};
			} else {
				return {
					...prev,
					availability: [
						...prev.availability,
						{ day: dayId, start: "09:00", end: "18:00" },
					],
				};
			}
		});
	};

	const handleTimeChange = (dayId, type, val) => {
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
		}
		setErrorMsg("");
		setStep((s) => Math.min(s + 1, 4));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setErrorMsg("");

		if (!formData.kyc_doc_type) {
			setErrorMsg("Please select a government ID document type for KYC verification.");
			return;
		}
		if (!formData.kyc_doc_number || formData.kyc_doc_number.trim().length < 4) {
			setErrorMsg("Please enter your valid identification document number.");
			return;
		}
		if (!formData.kyc_declaration) {
			setErrorMsg("Please accept the background verification consent declaration.");
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

			const res = await api.post("/providers/v1", payload);
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

	return (
		<div className="min-h-screen bg-slate-50 text-slate-800 bricolage-grotesque relative overflow-hidden py-12 px-4 sm:px-6">
			<div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[750px] h-[380px] bg-gradient-to-r from-violet-200/50 via-purple-200/40 to-pink-200/50 blur-3xl pointer-events-none rounded-full" />

			<div className="max-w-3xl mx-auto relative z-10 space-y-8">
				<div className="text-center space-y-3">
					<div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-100/90 border border-violet-200 text-violet-700 text-xs font-bold uppercase tracking-wider">
						<Sparkles size={13} className="text-pink-600" /> Join TaskGenie
						Partner Network
					</div>

					<h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#281950] tracking-tight">
						Apply as a{" "}
						<span className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
							Verified Service Expert
						</span>
					</h1>
					<p className="inter text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
						Set your own rates, choose your working hours, and connect with
						thousands of local clients.
					</p>
				</div>

				{!successData && (
					<div className="bg-white/90 backdrop-blur-md rounded-2xl border border-violet-100 p-4 shadow-sm flex items-center justify-between">
						{[
							{ num: 1, label: "Personal" },
							{ num: 2, label: "Services" },
							{ num: 3, label: "Schedule" },
							{ num: 4, label: "Identity & KYC" },
						].map((s, idx) => (
							<React.Fragment key={s.num}>
								<div className="flex items-center gap-2">
									<div
										className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
											step >= s.num
												? "bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/20"
												: "bg-slate-100 text-slate-400 border border-slate-200"
										}`}
									>
										{step > s.num ? <CheckCircle2 size={16} /> : s.num}
									</div>
									<span
										className={`text-xs font-bold hidden sm:inline ${
											step >= s.num ? "text-[#281950]" : "text-slate-400"
										}`}
									>
										{s.label}
									</span>
								</div>
								{idx < 3 && (
									<div
										className={`h-0.5 flex-1 mx-2 sm:mx-3 rounded-full transition-all ${
											step > s.num
												? "bg-gradient-to-r from-violet-500 to-pink-500"
												: "bg-slate-200"
										}`}
									/>
								)}
							</React.Fragment>
						))}
					</div>
				)}

				<div className="bg-white/95 backdrop-blur-xl border border-violet-200/70 rounded-3xl p-6 sm:p-10 shadow-xl shadow-purple-900/5 relative">
					{errorMsg && (
						<div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5">
							<CircleAlert size={16} className="text-red-500 shrink-0" />
							<span>{errorMsg}</span>
						</div>
					)}

					{successData ? (
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							className="text-center py-8 space-y-5"
						>
							<div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-200">
								<CheckCircle2 size={36} />
							</div>

							<div className="space-y-2">
								<h2 className="text-2xl font-bold text-[#281950]">
									Application Submitted Successfully!
								</h2>
								<p className="text-sm text-slate-600 max-w-md mx-auto">
									Welcome to the TaskGenie family! Your provider ID is{" "}
									<strong className="text-violet-700 font-mono text-base">
										{successData.custom_id}
									</strong>
									.
								</p>
							</div>

							<div className="p-5 rounded-2xl bg-violet-50 border border-violet-100 max-w-sm mx-auto text-left space-y-2 text-xs text-slate-700">
								<div className="font-bold text-violet-900 flex items-center gap-1.5">
									<ShieldCheck size={16} className="text-violet-600" /> Next
									Steps:
								</div>
								<div>1. Log into your Provider Dashboard</div>
								<div>2. Complete phone and location verification</div>
								<div>3. Start receiving instant customer booking requests</div>
							</div>

							<button
								onClick={() => (window.location.href = "/provider/dashboard")}
								className="cursor-pointer px-8 py-3 rounded-full text-sm font-bold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 shadow-lg shadow-purple-500/25 transition-all"
							>
								Go to Dashboard
							</button>
						</motion.div>
					) : (
						<form onSubmit={handleSubmit} className="space-y-6">
							{step === 1 && (
								<motion.div
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									className="space-y-5"
								>
									<div className="border-b border-slate-100 pb-3">
										<h3 className="text-lg font-bold text-[#281950]">
											Step 1: Personal & Contact Details
										</h3>
										<p className="text-xs text-slate-500">
											Provide basic details to create your provider account.
										</p>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<div>
											<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
												Full Name *
											</label>
											<div className="relative">
												<User
													size={16}
													className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
												/>
												<input
													type="text"
													required
													placeholder="e.g. Rahul Sharma"
													value={formData.name}
													onChange={(e) =>
														handleInputChange("name", e.target.value)
													}
													className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
												/>
											</div>
										</div>

										<div>
											<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
												Email Address *
											</label>
											<div className="relative">
												<Mail
													size={16}
													className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
												/>
												<input
													type="email"
													required
													placeholder="rahul@example.com"
													value={formData.email}
													onChange={(e) =>
														handleInputChange("email", e.target.value)
													}
													className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
												/>
											</div>
										</div>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<div>
											<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
												Indian Mobile Phone *
											</label>
											<div className="relative">
												<Phone
													size={16}
													className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
												/>
												<input
													type="tel"
													required
													placeholder="+91 9876543210"
													value={formData.phone}
													onChange={(e) =>
														handleInputChange("phone", e.target.value)
													}
													className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
												/>
											</div>
											<span className="text-[10px] text-slate-500 mt-1 block">
												+91 followed by 10 digits
											</span>
										</div>

										<div>
											<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
												Account Password *
											</label>
											<div className="relative">
												<Lock
													size={16}
													className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
												/>
												<input
													type="password"
													required
													placeholder="At least 6 characters"
													value={formData.password}
													onChange={(e) =>
														handleInputChange("password", e.target.value)
													}
													className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
												/>
											</div>
										</div>
									</div>

									<div>
										<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
											Service City / Region
										</label>
										<div className="relative">
											<MapPin
												size={16}
												className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
											/>
											<input
												type="text"
												placeholder="e.g. Mumbai, Maharashtra"
												value={formData.location}
												onChange={(e) =>
													handleInputChange("location", e.target.value)
												}
												className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
											/>
										</div>
									</div>

									<div>
										<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
											Short Bio & Experience
										</label>
										<textarea
											rows={3}
											maxLength={500}
											placeholder="Licensed electrician with 6+ years of residential repair experience..."
											value={formData.bio}
											onChange={(e) => handleInputChange("bio", e.target.value)}
											className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
										/>
									</div>
								</motion.div>
							)}

							{step === 2 && (
								<motion.div
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									className="space-y-5"
								>
									<div className="border-b border-slate-100 pb-3">
										<h3 className="text-lg font-bold text-[#281950]">
											Step 2: Primary Service & Base Rate
										</h3>
										<p className="text-xs text-slate-500">
											Select your main field of expertise and set your starting
											rate.
										</p>
									</div>

									<div>
										<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
											Select Primary Service *
										</label>
										<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
											{servicesList.map((s) => (
												<button
													key={s.slug}
													type="button"
													onClick={() => handleInputChange("service", s.slug)}
													className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
														formData.service === s.slug
															? "bg-violet-50 border-violet-500 text-violet-950 font-bold shadow-sm ring-1 ring-violet-500"
															: "bg-white border-slate-200 text-slate-700 hover:border-violet-300"
													}`}
												>
													<span className="text-2xl">{s.icon || "🛠️"}</span>
													<span className="text-xs font-bold">{s.name}</span>
													<span className="text-[10px] text-slate-500">
														{s.category}
													</span>
												</button>
											))}
										</div>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
										<div>
											<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
												Base Service Price (₹) *
											</label>
											<div className="relative">
												<DollarSign
													size={16}
													className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
												/>
												<input
													type="number"
													min="0"
													required
													value={formData.price}
													onChange={(e) =>
														handleInputChange("price", e.target.value)
													}
													className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500"
												/>
											</div>
										</div>

										<div>
											<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
												Pricing Unit
											</label>
											<select
												value={formData.price_unit}
												onChange={(e) =>
													handleInputChange("price_unit", e.target.value)
												}
												className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500"
											>
												<option value="fixed">Fixed Price per Task</option>
												<option value="hourly">Hourly Rate (₹ / hr)</option>
											</select>
										</div>
									</div>
								</motion.div>
							)}

							{step === 3 && (
								<motion.div
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									className="space-y-5"
								>
									<div className="border-b border-slate-100 pb-3">
										<h3 className="text-lg font-bold text-[#281950]">
											Step 3: Weekly Availability Schedule
										</h3>
										<p className="text-xs text-slate-500">
											Configure your standard working days and active time
											slots.
										</p>
									</div>

									<div className="space-y-3">
										{DAYS.map((d) => {
											const activeRule = formData.availability.find(
												(a) => a.day === d.id,
											);
											const isSelected = Boolean(activeRule);

											return (
												<div
													key={d.id}
													className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
														isSelected
															? "bg-violet-50/70 border-violet-200"
															: "bg-slate-50 border-slate-200 opacity-60"
													}`}
												>
													<div className="flex items-center gap-3">
														<input
															type="checkbox"
															checked={isSelected}
															onChange={() => toggleDayAvailability(d.id)}
															className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
														/>
														<span className="text-sm font-bold text-[#281950] w-12">
															{d.name}
														</span>
													</div>

													{isSelected ? (
														<div className="flex items-center gap-2 text-xs">
															<input
																type="time"
																value={activeRule.start}
																onChange={(e) =>
																	handleTimeChange(
																		d.id,
																		"start",
																		e.target.value,
																	)
																}
																className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:border-violet-500"
															/>
															<span className="text-slate-400">to</span>
															<input
																type="time"
																value={activeRule.end}
																onChange={(e) =>
																	handleTimeChange(d.id, "end", e.target.value)
																}
																className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:border-violet-500"
															/>
														</div>
													) : (
														<span className="text-xs text-slate-400 italic">
															Off Day
														</span>
													)}
												</div>
											);
										})}
									</div>
								</motion.div>
							)}

							{step === 4 && (
								<motion.div
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									className="space-y-6"
								>
									<div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
										<div>
											<h3 className="text-lg font-bold text-[#281950] flex items-center gap-2">
												<span>Step 4: Identity &amp; Background Verification</span>
											</h3>
											<p className="text-xs text-slate-500 mt-0.5">
												Upload government-approved documentation to earn your gold Verified Pro trust badge.
											</p>
										</div>
										<VerifiedBadge size="md" />
									</div>

									{/* Trust & Safety Banner */}
									<div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-yellow-500/10 border border-amber-400/30 flex items-start gap-3.5 text-slate-700">
										<div className="p-2.5 bg-amber-500/15 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
											<ShieldCheck size={22} className="stroke-[2.2]" />
										</div>
										<div className="space-y-1">
											<div className="text-xs font-bold text-[#281950] flex items-center gap-2">
												<span>TaskGenie Trust &amp; Safety Standard</span>
												<span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-200/80 text-amber-950 font-bold">
													Fraud Prevention
												</span>
											</div>
											<p className="text-xs text-slate-600 leading-relaxed">
												To protect homeowners from unauthorized personnel, every provider is checked by our administrative security team. Verified pros enjoy <strong>3.8x higher booking conversion</strong> and priority dispatch.
											</p>
										</div>
									</div>

									{/* Document Type Selector */}
									<div className="space-y-2">
										<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
											Select Identification Document *
										</label>
										<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
											{[
												{
													id: "aadhaar",
													label: "Aadhaar Card",
													sub: "UIDAI 12-Digit ID",
													icon: "🇮🇳",
												},
												{
													id: "driving_license",
													label: "Driving License",
													sub: "State Transport Dept",
													icon: "🪪",
												},
												{
													id: "certificate",
													label: "Trade Certificate",
													sub: "Certified Professional",
													icon: "📜",
												},
											].map((doc) => (
												<button
													key={doc.id}
													type="button"
													onClick={() => handleInputChange("kyc_doc_type", doc.id)}
													className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
														formData.kyc_doc_type === doc.id
															? "bg-violet-50/80 border-violet-500 shadow-sm ring-1 ring-violet-400/50"
															: "bg-slate-50/50 border-slate-200 hover:bg-slate-100/70"
													}`}
												>
													<div className="text-xl mb-1.5">{doc.icon}</div>
													<div className="text-xs font-bold text-[#281950]">
														{doc.label}
													</div>
													<div className="text-[10px] text-slate-500">
														{doc.sub}
													</div>
												</button>
											))}
										</div>
									</div>

									{/* Document Number Input */}
									<div>
										<label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
											{formData.kyc_doc_type === "aadhaar"
												? "Aadhaar Number (12 Digits) *"
												: formData.kyc_doc_type === "driving_license"
													? "Driving License Number *"
													: "Trade Certificate / Registration ID *"}
										</label>
										<input
											type="text"
											value={formData.kyc_doc_number}
											onChange={(e) =>
												handleInputChange("kyc_doc_number", e.target.value)
											}
											placeholder={
												formData.kyc_doc_type === "aadhaar"
													? "e.g. 5482 1920 4412"
													: formData.kyc_doc_type === "driving_license"
														? "e.g. MH-02-2018-0091242"
														: "e.g. CERT-PLUMB-90211"
											}
											className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 font-mono tracking-wide"
										/>
									</div>

									{/* Document Image Uploads: Front & Back */}
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										{/* Front Document */}
										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<label className="text-xs font-bold text-slate-700">
													Document Front Photo *
												</label>
												{formData.kyc_doc_front && (
													<span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
														<FileCheck size={13} /> Attached
													</span>
												)}
											</div>
											{formData.kyc_doc_front ? (
												<div className="relative rounded-2xl border border-violet-200 overflow-hidden bg-slate-100 group aspect-[4/3] flex items-center justify-center shadow-inner">
													<img
														src={formData.kyc_doc_front}
														alt="Document Front Preview"
														className="w-full h-full object-cover"
													/>
													<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
														<button
															type="button"
															onClick={() => handleInputChange("kyc_doc_front", "")}
															className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition cursor-pointer shadow-md"
														>
															Remove Photo
														</button>
													</div>
												</div>
											) : (
												<label
													className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition aspect-[4/3] ${
														uploadingDoc.front
															? "border-violet-400 bg-violet-50/50"
															: "border-slate-200 hover:border-violet-400 hover:bg-slate-50"
													}`}
												>
													<input
														type="file"
														accept="image/*,.pdf"
														className="hidden"
														disabled={uploadingDoc.front}
														onChange={(e) =>
															handleFileUpload("front", e.target.files[0])
														}
													/>
													{uploadingDoc.front ? (
														<div className="flex flex-col items-center gap-2 text-violet-600">
															<Loader2 size={24} className="animate-spin" />
															<span className="text-xs font-semibold">
																Uploading Document...
															</span>
														</div>
													) : (
														<div className="flex flex-col items-center gap-2 text-slate-500">
															<div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
																<UploadCloud size={20} />
															</div>
															<div className="text-xs font-bold text-slate-700">
																Upload Front Side
															</div>
															<div className="text-[10px] text-slate-400">
																PNG, JPG, or PDF (Max 10MB)
															</div>
														</div>
													)}
												</label>
											)}
										</div>

										{/* Back Document */}
										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<label className="text-xs font-bold text-slate-700">
													Document Back Photo (Optional)
												</label>
												{formData.kyc_doc_back && (
													<span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
														<FileCheck size={13} /> Attached
													</span>
												)}
											</div>
											{formData.kyc_doc_back ? (
												<div className="relative rounded-2xl border border-violet-200 overflow-hidden bg-slate-100 group aspect-[4/3] flex items-center justify-center shadow-inner">
													<img
														src={formData.kyc_doc_back}
														alt="Document Back Preview"
														className="w-full h-full object-cover"
													/>
													<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
														<button
															type="button"
															onClick={() => handleInputChange("kyc_doc_back", "")}
															className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition cursor-pointer shadow-md"
														>
															Remove Photo
														</button>
													</div>
												</div>
											) : (
												<label
													className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition aspect-[4/3] ${
														uploadingDoc.back
															? "border-violet-400 bg-violet-50/50"
															: "border-slate-200 hover:border-violet-400 hover:bg-slate-50"
													}`}
												>
													<input
														type="file"
														accept="image/*,.pdf"
														className="hidden"
														disabled={uploadingDoc.back}
														onChange={(e) =>
															handleFileUpload("back", e.target.files[0])
														}
													/>
													{uploadingDoc.back ? (
														<div className="flex flex-col items-center gap-2 text-violet-600">
															<Loader2 size={24} className="animate-spin" />
															<span className="text-xs font-semibold">
																Uploading Document...
															</span>
														</div>
													) : (
														<div className="flex flex-col items-center gap-2 text-slate-500">
															<div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
																<UploadCloud size={20} />
															</div>
															<div className="text-xs font-bold text-slate-700">
																Upload Back Side
															</div>
															<div className="text-[10px] text-slate-400">
																PNG, JPG, or PDF (Max 10MB)
															</div>
														</div>
													)}
												</label>
											)}
										</div>
									</div>

									{/* Consent Checkbox */}
									<div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
										<input
											type="checkbox"
											id="kyc_declaration"
											checked={formData.kyc_declaration}
											onChange={(e) =>
												handleInputChange("kyc_declaration", e.target.checked)
											}
											className="w-4 h-4 accent-violet-600 rounded cursor-pointer mt-0.5"
										/>
										<label
											htmlFor="kyc_declaration"
											className="text-xs text-slate-600 cursor-pointer select-none leading-relaxed"
										>
											I declare that the identification details and documents provided belong to me and are authentic. I give consent to TaskGenie to verify these documents with authorized databases to issue my <strong>Verified Pro</strong> badge.
										</label>
									</div>
								</motion.div>
							)}

							<div className="pt-6 border-t border-slate-100 flex items-center justify-between">
								{step > 1 ? (
									<button
										type="button"
										onClick={() => setStep((s) => s - 1)}
										className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
									>
										<ChevronLeft size={16} /> Previous
									</button>
								) : (
									<div />
								)}

								{step < 4 ? (
									<button
										type="button"
										onClick={handleNextStep}
										className="flex items-center gap-1.5 px-7 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 shadow-md shadow-purple-500/20 transition-all cursor-pointer"
									>
										Next Step <ChevronRight size={16} />
									</button>
								) : (
									<button
										type="submit"
										disabled={loading || uploadingDoc.front || uploadingDoc.back}
										className="flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 shadow-lg shadow-purple-500/25 disabled:opacity-50 transition-all cursor-pointer"
									>
										{loading ? (
											<Loader2 size={16} className="animate-spin" />
										) : (
											<Sparkles size={16} />
										)}
										<span>Submit Application &amp; KYC</span>
									</button>
								)}
							</div>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}
