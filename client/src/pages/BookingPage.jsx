import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import {
	ArrowLeft,
	Calendar,
	Clock,
	CheckCircle2,
	MapPin,
	Pencil,
	Navigation,
	Star,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import Alerts from "../ui/Alerts"; // Assuming this path exists based on your code
import { FadeLoader } from "react-spinners";

export default function BookingPage() {
	const { customId } = useParams();
	const navigate = useNavigate();
	const { state } = useLocation();

	console.log(state);

	const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

	const [provider, setProvider] = useState(state?.provider || null);
	const [availability, setAvailability] = useState(
		state?.preloadedAvailability || state?.provider?.availability || [],
	);

	const [address, setAddress] = useState(
		state?.address || "Home • 12/B, Green Heights, Civil Lines, Kanpur",
	);

	const [selectedDate, setSelectedDate] = useState(
		state?.selectedDateStr || null,
	);
	const [selectedTime, setSelectedTime] = useState(state?.selectedTime || null);

	const [isEditingAddress, setIsEditingAddress] = useState(false);
	const [tempAddress, setTempAddress] = useState(address);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [loading, setLoading] = useState(!state?.provider);
	const [alert, setAlert] = useState(null);

	// --- Helpers ---

	function formatTime(timeString) {
		if (!timeString) return "";
		const [hours, minutes] = timeString.split(":");
		const date = new Date();
		date.setHours(hours);
		date.setMinutes(minutes);
		return date.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	}

	function formatDateDisplay(dateString) {
		const date = new Date(dateString);
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

	// --- Effects ---

	useEffect(() => {
		const fetchData = async () => {
			try {
				let currentProvider = provider;
				if (!currentProvider) {
					setLoading(true);
					const provRes = await fetch(
						`${API_URL}/api/providers/v1/${customId}`,
					);
					if (!provRes.ok) throw new Error("Provider not found");
					const provData = await provRes.json();
					currentProvider = provData.provider;
					setProvider(currentProvider);
				}

				if (currentProvider && currentProvider.id) {
					if (availability.length === 0) setLoading(true);
					const slotsRes = await fetch(
						`${API_URL}/api/providers/v1/${currentProvider.id}/availability`,
					);
					if (slotsRes.ok) {
						const slotsData = await slotsRes.json();
						setAvailability(slotsData);
					}
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
		fetchData();
	}, [customId]);

	// --- Logic ---

	const groupedSlots = useMemo(() => {
		return availability.reduce((acc, slot) => {
			if (!acc[slot.date]) acc[slot.date] = [];
			if (!acc[slot.date].includes(slot.start_time)) {
				acc[slot.date].push(slot.start_time);
			}
			acc[slot.date].sort();
			return acc;
		}, {});
	}, [availability]);

	// Auto-select first date if not selected
	useEffect(() => {
		if (!selectedDate && Object.keys(groupedSlots).length > 0) {
			const sortedDates = Object.keys(groupedSlots).sort();
			const validDate = sortedDates.find(
				(d) => d >= new Date().toISOString().split("T")[0],
			);
			if (validDate) setSelectedDate(validDate);
		}
	}, [groupedSlots, selectedDate]);

	function isSlotExpired(slotDate, slotTime) {
		const now = new Date();
		const todayStr = now.toISOString().split("T")[0];

		if (slotDate < todayStr) return true;
		if (slotDate > todayStr) return false;

		const [hours, minutes] = slotTime.split(":").map(Number);
		const slotDateTime = new Date();
		slotDateTime.setHours(hours, minutes, 0, 0);
		return now >= slotDateTime;
	}

	const visibleSlots = useMemo(() => {
		if (!selectedDate || !groupedSlots[selectedDate]) return [];

		return groupedSlots[selectedDate].filter((t) => {
			const slotObj = availability.find(
				(s) =>
					s.date === selectedDate && s.start_time.startsWith(t.substring(0, 5)),
			);
			const isBooked = slotObj ? slotObj.isBooked : false;
			const isExpired = isSlotExpired(selectedDate, t);
			return !isBooked && !isExpired;
		});
	}, [selectedDate, groupedSlots, availability]);

	const handleSaveAddress = () => {
		setAddress(tempAddress);
		setIsEditingAddress(false);
	};

	async function handleConfirm() {
		if (!selectedDate || !selectedTime)
			return setAlert({ message: "Please select a slot.", type: "error" });

		const token = localStorage.getItem("token");
		if (!token) {
			setAlert({ message: "You must be logged in to book.", type: "error" });
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await fetch(`${API_URL}/api/bookings`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					provider_id: provider.user_id,
					service_id: provider.service_id,
					date: selectedDate,
					start_time: selectedTime,
					end_time: selectedTime, // Backend likely calculates end time based on service duration
					address: address,
				}),
			});
			const data = await res.json();

			if (res.ok) {
				navigate("/booking-success", {
					state: { success: true, booking: data.booking, address: address },
					replace: true,
				});
			} else if (res.status === 409) {
				setAlert({
					message: "Slot already booked! Please choose another time.",
					type: "error",
				});
				// Optionally refresh availability here
			} else {
				setAlert({ message: data.message || "Booking failed.", type: "error" });
			}
		} catch (err) {
			console.error("Booking error: ", err);
			setAlert({ message: "Something went wrong. Try again.", type: "error" });
		} finally {
			setIsSubmitting(false);
		}
	}

	// --- Render ---

	if (loading || !provider) {
		return (
			<div className="min-h-screen bg-[#191034] text-white flex items-center justify-center">
				<div className="flex flex-col items-center gap-6">
					<FadeLoader color="#8b5cf6" />
					<p className="text-violet-200/70 animate-pulse font-medium tracking-wide">
						Preparing your experience...
					</p>
				</div>
			</div>
		);
	}

	const dateDisplay = selectedDate ? formatDateDisplay(selectedDate) : null;

	return (
		<div className="min-h-screen bg-[#191034] text-white selection:bg-violet-500/30 pb-24 lg:pb-0">
			{/* Background Ambience */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden">
				<div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-900/20 rounded-full blur-[120px]" />
				<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[100px]" />
			</div>

			{alert && (
				<Alerts
					message={alert.message}
					type={alert.type}
					onClose={() => setAlert(null)}
				/>
			)}

			{/* Header */}
			<div className="sticky top-0 z-40 bg-[#191034]/80 backdrop-blur-xl border-b border-white/5">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
					<button
						onClick={() => navigate(-1)}
						className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
					>
						<ArrowLeft size={22} />
					</button>
					<h1 className="text-xl font-bold bricolage-grotesque tracking-tight">
						Complete Booking
					</h1>
				</div>
			</div>

			<div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
					{/* LEFT COLUMN: Provider Card (Sticky) */}
					<div className="lg:col-span-4 lg:sticky lg:top-28">
						<div className="bg-[#22194A] rounded-3xl p-6 border border-white/5 shadow-2xl shadow-black/20 overflow-hidden relative group">
							{/* Card Decoration */}
							<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 opacity-80" />

							<div className="flex flex-row lg:flex-col items-center lg:items-start gap-5">
								<div className="relative shrink-0">
									<div className="w-20 h-20 lg:w-32 lg:h-32 rounded-2xl overflow-hidden border-2 border-white/10 shadow-lg group-hover:border-violet-500/50 transition-all duration-500">
										<img
											src={
												provider.photo ||
												`https://ui-avatars.com/api/?name=${provider.name}&background=6d28d9&color=fff`
											}
											alt={provider.name}
											className="w-full h-full object-cover"
										/>
									</div>
									<div className="absolute -bottom-2 -right-2 bg-[#1a103f] border border-violet-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-md">
										<Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
										<span className="text-xs font-bold">
											{provider.rating || "5.0"}
										</span>
									</div>
								</div>

								<div className="flex-1 text-left">
									<h2 className="mackinac text-[24px] font-bold leading-tight text-white mb-1">
										{provider.name}
									</h2>
									<div className="inter flex items-center gap-1.5 text-xs text-violet-300/80 mb-3">
										<ShieldCheck size={14} className="text-green-400" />
										<span>Verified Expert</span>
									</div>

									<div className="inter inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-100">
										<span className="text-lg font-bold">₹{provider.price}</span>
										<span className="text-xs opacity-60">/ session</span>
									</div>
								</div>
							</div>

							{/* Order Summary Preview */}
							<div className="inter mt-8 pt-6 border-t border-white/5 space-y-3 hidden lg:block">
								<div className="flex justify-between text-sm">
									<span className="text-gray-400">Date</span>
									<span className="font-medium text-white">
										{dateDisplay?.full || "--"}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-gray-400">Time</span>
									<span className="font-medium text-white">
										{selectedTime ? formatTime(selectedTime) : "--"}
									</span>
								</div>
								<div className="flex justify-between text-sm pt-2">
									<span className="text-gray-400">Total</span>
									<span className="font-bold text-violet-300 text-lg">
										₹{provider.price}
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* RIGHT COLUMN: Booking Form */}
					<div className="inter lg:col-span-8 space-y-8">
						{/* Step 1: Date Selection */}
						<div className="space-y-4">
							<div className="flex items-center gap-2 px-1">
								<div className="p-1.5 rounded-lg bg-violet-500/20">
									<Calendar className="w-5 h-5 text-violet-300" />
								</div>
								<h3 className="text-lg font-semibold text-white">
									Select Date
								</h3>
							</div>

							{Object.keys(groupedSlots).length === 0 ? (
								<div className="p-8 rounded-2xl border border-dashed border-white/10 bg-white/5 text-center">
									<p className="text-gray-400">No available dates found.</p>
								</div>
							) : (
								<div className="relative group/scroll">
									<div className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x flex-nowrap px-1 custom-scrollbar-x momentum-scroll">
										{Object.keys(groupedSlots)
											.sort()
											.filter(
												(date) =>
													date >= new Date().toISOString().split("T")[0],
											)
											.map((date) => {
												const isSelected = selectedDate === date;
												const d = formatDateDisplay(date);
												return (
													<button
														key={date}
														onClick={() => {
															setSelectedDate(date);
															setSelectedTime(null);
														}}
														className={`snap-start flex-shrink-0 min-w-[90px] p-3 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1 group
                                    ${
																			isSelected
																				? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/50 scale-[1.02]"
																				: "bg-[#22194A] border-white/5 text-gray-400 hover:bg-[#2a1f5a] hover:border-violet-500/30 hover:text-white"
																		}`}
													>
														<span
															className={`text-xs uppercase tracking-wider font-medium ${isSelected ? "text-violet-200" : "text-gray-500 group-hover:text-gray-300"}`}
														>
															{d.weekday}
														</span>
														<span className="text-2xl font-bold">{d.day}</span>
														<span className="text-[10px] opacity-60">
															{d.month}
														</span>
													</button>
												);
											})}
									</div>
								</div>
							)}
						</div>

						{/* Time Selection */}
						{selectedDate && (
							<div className="space-y-4 animate-fade-in-up">
								<div className="flex items-center justify-between px-1">
									<div className="flex items-center gap-2">
										<div className="p-1.5 rounded-lg bg-violet-500/20">
											<Clock className="w-5 h-5 text-violet-300" />
										</div>
										<h3 className="text-lg font-semibold text-white">
											Select Time
										</h3>
									</div>
									{visibleSlots.length > 0 && (
										<span className="text-xs text-violet-300/70 bg-violet-500/10 px-2 py-1 rounded-md">
											{visibleSlots.length} slots available
										</span>
									)}
								</div>

								{visibleSlots.length > 0 ? (
									<div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
										{visibleSlots.map((t) => {
											const isSelected = selectedTime === t;
											return (
												<button
													key={t}
													onClick={() => setSelectedTime(t)}
													className={`relative py-3 px-2 rounded-xl border text-sm font-semibold transition-all duration-200
                                        ${
																					isSelected
																						? "bg-white text-violet-900 border-white shadow-md shadow-violet-900/20 scale-[1.02]"
																						: "bg-[#22194A] border-white/5 text-gray-300 hover:bg-[#2a1f5a] hover:border-violet-500/30 hover:text-white"
																				}`}
												>
													{formatTime(t)}
													{isSelected && (
														<div className="absolute -top-1.5 -right-1.5 bg-green-500 text-white rounded-full p-0.5 shadow-sm">
															<CheckCircle2
																size={12}
																fill="currentColor"
																className="text-white"
															/>
														</div>
													)}
												</button>
											);
										})}
									</div>
								) : (
									<div className="bg-[#22194A] border border-dashed border-white/10 rounded-2xl p-8 text-center">
										<div className="inline-flex p-3 rounded-full bg-orange-500/10 mb-3">
											<Clock className="w-6 h-6 text-orange-400" />
										</div>
										<h4 className="text-white font-medium mb-1">
											No slots available
										</h4>
										<p className="text-sm text-gray-400">
											Please select a different date.
										</p>
									</div>
								)}
							</div>
						)}

						{/* Step 3: Address */}
						<div className="space-y-4">
							<div className="flex items-center justify-between px-1">
								<div className="flex items-center gap-2">
									<div className="p-1.5 rounded-lg bg-violet-500/20">
										<MapPin className="w-5 h-5 text-violet-300" />
									</div>
									<h3 className="text-lg font-semibold text-white">Location</h3>
								</div>
								{!isEditingAddress && (
									<button
										onClick={() => setIsEditingAddress(true)}
										className="text-xs text-violet-300 hover:text-white flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
									>
										<Pencil size={12} /> Edit
									</button>
								)}
							</div>

							<div className="bg-[#22194A] border border-white/5 rounded-2xl p-1 overflow-hidden">
								{isEditingAddress ? (
									<div className="p-4 space-y-3">
										<textarea
											value={tempAddress}
											onChange={(e) => setTempAddress(e.target.value)}
											className="w-full bg-[#191034] border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all resize-none h-28"
											placeholder="Enter your full address here..."
											autoFocus
										/>
										<div className="flex justify-end gap-2">
											<button
												onClick={() => {
													setTempAddress(address);
													setIsEditingAddress(false);
												}}
												className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
											>
												Cancel
											</button>
											<button
												onClick={handleSaveAddress}
												className="px-6 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-900/20 transition-all"
											>
												Save Address
											</button>
										</div>
									</div>
								) : (
									<div className="flex items-start gap-4 p-5 relative">
										<div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-600 to-indigo-600 opacity-50" />
										<div className="p-2.5 bg-[#191034] rounded-xl shrink-0 border border-white/5">
											<Navigation className="w-5 h-5 text-violet-400" />
										</div>
										<div>
											<p className="text-white font-medium leading-relaxed">
												{address}
											</p>
											<div className="flex items-center gap-2 mt-2">
												<span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
													<CheckCircle2 size={10} /> Serviceable Area
												</span>
											</div>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Desktop Confirm Button */}
						<div className="hidden lg:block pt-6">
							<button
								onClick={handleConfirm}
								disabled={isSubmitting || !selectedTime}
								className={`w-full py-4 rounded-xl text-lg font-bold shadow-xl transition-all duration-300 flex items-center justify-center gap-3 group
                    ${
											selectedTime
												? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-900/40 transform hover:-translate-y-1"
												: "bg-[#22194A] text-gray-500 cursor-not-allowed border border-white/5"
										}`}
							>
								{isSubmitting ? (
									<div className="flex items-center gap-2">
										<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
										<span>Processing...</span>
									</div>
								) : (
									<>
										<span>Confirm Booking</span>
										<Sparkles
											size={18}
											className={`transition-transform duration-300 ${selectedTime ? "group-hover:rotate-12 text-yellow-300" : "opacity-0"}`}
										/>
									</>
								)}
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Mobile Sticky Footer */}
			<div
				className={`lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-[#191034]/90 backdrop-blur-xl border-t border-white/10 z-50 transition-transform duration-500 ease-out ${selectedTime ? "translate-y-0" : "translate-y-full"}`}
			>
				<div className="flex items-center gap-4">
					<div className="flex-1">
						<p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
							Total
						</p>
						<div className="flex items-baseline gap-1">
							<span className="text-xl font-bold text-white">
								₹{provider.price}
							</span>
							<span className="text-xs text-violet-300">/ session</span>
						</div>
					</div>
					<button
						onClick={handleConfirm}
						disabled={isSubmitting}
						className="flex-[2] py-3.5 rounded-xl bg-violet-600 text-white font-bold text-lg shadow-lg shadow-violet-900/40 active:scale-95 transition-all flex items-center justify-center gap-2"
					>
						{isSubmitting ? "Book..." : "Confirm"}
					</button>
				</div>
			</div>
		</div>
	);
}
