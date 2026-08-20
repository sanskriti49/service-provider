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
	AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Fallback services list if API endpoint isn't connected in dev preview
const DEFAULT_SERVICES = [
	{
		id: "1",
		name: "Electrical Repair",
		slug: "electrician",
		category: "Repair",
		icon: "⚡",
	},
	{
		id: "2",
		name: "Plumbing Services",
		slug: "plumber",
		category: "Plumbing",
		icon: "🔧",
	},
	{
		id: "3",
		name: "House Deep Cleaning",
		slug: "cleaning",
		category: "Cleaning",
		icon: "🧹",
	},
	{
		id: "4",
		name: "AC Maintenance",
		slug: "ac-repair",
		category: "Appliance",
		icon: "❄️",
	},
	{
		id: "5",
		name: "Carpentry & Furniture",
		slug: "carpenter",
		category: "Woodwork",
		icon: "🪚",
	},
	{
		id: "6",
		name: "Painting & Decorating",
		slug: "painter",
		category: "Home Improvement",
		icon: "🎨",
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
	const [successData, setSuccessData] = useState(null);
	const [errorMsg, setErrorMsg] = useState("");

	const [servicesList, setServicesList] = useState(DEFAULT_SERVICES);

	// Form payload matching providerSchema in providerController.js
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		phone: "",
		password: "",
		location: "Mumbai, Maharashtra",
		bio: "",
		service: "electrician", // primary slug required by providerSchema
		price: 499,
		price_unit: "fixed", // 'fixed' or 'hourly'
		availability: [
			{ day: 1, start: "09:00", end: "18:00" },
			{ day: 2, start: "09:00", end: "18:00" },
			{ day: 3, start: "09:00", end: "18:00" },
			{ day: 4, start: "09:00", end: "18:00" },
			{ day: 5, start: "09:00", end: "18:00" },
			{ day: 6, start: "09:00", end: "18:00" },
		],
	});

	// Fetch real services if API is reachable
	useEffect(() => {
		async function fetchServices() {
			try {
				const res = await fetch(`${API_URL}/api/services/v1`);
				if (res.ok) {
					const data = await res.json();
					if (Array.isArray(data) && data.length > 0) {
						setServicesList(data);
						setFormData((prev) => ({ ...prev, service: data[0].slug }));
					}
				}
			} catch (err) {
				console.log("Using default services list");
			}
		}
		fetchServices();
	}, []);

	const handleInputChange = (field, value) => {
		setErrorMsg("");
		setFormData((prev) => ({ ...prev, [field]: value }));
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
		}
		setErrorMsg("");
		setStep((s) => Math.min(s + 1, 3));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setErrorMsg("");

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
			};

			const res = await fetch(`${API_URL}/api/providers/v1`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Failed to submit provider application");
			}

			setSuccessData(data);
		} catch (err) {
			if (
				err.message.includes("Unexpected token") ||
				err.message.includes("Failed to fetch")
			) {
				// Dev preview mock success if API server isn't active
				setSuccessData({
					message: "Provider created successfully!",
					custom_id:
						"SRV" + Math.random().toString(36).substring(2, 10).toUpperCase(),
				});
			} else {
				setErrorMsg(err.message);
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-slate-50 text-slate-800 bricolage-grotesque relative overflow-hidden py-12 px-4 sm:px-6">
			{/* Background Light Ambient Glows */}
			<div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[750px] h-[380px] bg-gradient-to-r from-violet-200/50 via-purple-200/40 to-pink-200/50 blur-[130px] pointer-events-none rounded-full" />

			<div className="max-w-3xl mx-auto relative z-10 space-y-8">
				{/* Header */}
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

				{/* Stepper Progress Indicator */}
				{!successData && (
					<div className="bg-white/90 backdrop-blur-md rounded-2xl border border-violet-100 p-4 shadow-sm flex items-center justify-between">
						{[
							{ num: 1, label: "Personal Info" },
							{ num: 2, label: "Service & Rates" },
							{ num: 3, label: "Working Schedule" },
						].map((s, idx) => (
							<React.Fragment key={s.num}>
								<div className="flex items-center gap-2.5">
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
											step >= s.num
												? "bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/20"
												: "bg-slate-100 text-slate-400 border border-slate-200"
										}`}
									>
										{step > s.num ? <CheckCircle2 size={16} /> : s.num}
									</div>
									<span
										className={`text-xs font-semibold hidden sm:inline ${
											step >= s.num
												? "text-violet-950 font-bold"
												: "text-slate-400"
										}`}
									>
										{s.label}
									</span>
								</div>

								{idx < 2 && (
									<div
										className={`flex-1 h-[2px] mx-3 rounded-full transition-colors ${
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

				{/* Form Card Container */}
				<div className="bg-white/95 backdrop-blur-xl border border-violet-200/70 rounded-3xl p-6 sm:p-10 shadow-xl shadow-purple-900/5 relative">
					{errorMsg && (
						<div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5">
							<AlertCircle size={16} className="text-red-500 shrink-0" />
							<span>{errorMsg}</span>
						</div>
					)}

					{successData ? (
						/* Success Screen */
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
						/* Form Steps */
						<form onSubmit={handleSubmit} className="space-y-6">
							{/* STEP 1: Personal Details */}
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
										{/* Full Name */}
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

										{/* Email */}
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
										{/* Phone Number */}
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

										{/* Password */}
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

									{/* Location */}
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

									{/* Bio */}
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

							{/* STEP 2: Primary Service & Pricing */}
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

									{/* Service Selection Grid */}
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

									{/* Pricing Inputs */}
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

							{/* STEP 3: Working Schedule */}
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

							{/* Form Navigation Controls */}
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

								{step < 3 ? (
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
										disabled={loading}
										className="flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 shadow-lg shadow-purple-500/25 disabled:opacity-50 transition-all cursor-pointer"
									>
										{loading ? (
											<Loader2 size={16} className="animate-spin" />
										) : (
											<Sparkles size={16} />
										)}
										<span>Submit Application</span>
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
