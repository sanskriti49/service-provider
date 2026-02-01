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
	CreditCard,
	Wallet,
} from "lucide-react";
import Alerts from "../ui/Alerts";
import { FadeLoader } from "react-spinners";
import PaymentOptions from "./PaymentOptions";

export default function BookingPage() {
	const { customId } = useParams();
	const navigate = useNavigate();
	const { state } = useLocation();

	const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

	const [provider, setProvider] = useState(state?.provider || null);
	const [availability, setAvailability] = useState(
		state?.preloadedAvailability || state?.provider?.availability || [],
	);

	const [address, setAddress] = useState(state?.address || "");
	const [tempAddress, setTempAddress] = useState(state?.address || "");

	const [selectedDate, setSelectedDate] = useState(
		state?.selectedDateStr || null,
	);
	const [selectedTime, setSelectedTime] = useState(state?.selectedTime || null);
	const serviceName = state?.serviceName || "Service";

	const [isEditingAddress, setIsEditingAddress] = useState(false);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [loading, setLoading] = useState(!state?.provider);
	const [alert, setAlert] = useState(null);

	const [paymentMethod, setPaymentMethod] = useState("cod");

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
		if (!address.trim()) {
			return setAlert({
				message:
					"Where should our expert meet you? Please enter a service address.",
				type: "error",
			});
		}
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
					end_time: selectedTime,
					address: address,
					payment_method: paymentMethod,
				}),
			});
			const data = await res.json();

			if (paymentMethod === "online" && data.razorpay_order) {
				handleRazorpayPayment(data.booking, data.razorpay_order);
			} else {
				navigate("/booking-success", {
					state: { success: true, booking: data.booking, address: address },
					replace: true,
				});
			}

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

	const handleRazorpayPayment = (booking, orderId) => {
		const options = {
			key: import.meta.env.VITE_RAZORPAY_KEY_ID,
			amount: booking.price * 100,
			currency: "INR",
			name: "TaskGenie",
			description: `Booking for ${booking.service_name || "Service"}`,
			order_id: orderId,
			handler: async function (response) {
				try {
					const verifyRes = await fetch(
						`${API_URL}/api/bookings/verify-payment`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${localStorage.getItem("token")}`,
							},
							body: JSON.stringify(response),
						},
					);
					const verifyData = await verifyRes.json();
					if (verifyRes.ok) {
						navigate("/booking-success", {
							state: { success: true, booking: verifyData.booking },
						});
					} else {
						alert("Payment verification failed. Please contact support.");
					}
				} catch (err) {
					console.error("Verification Error:", err);
				}
			},
			prefill: {
				name: "Customer Name",
				email: "customer@example.com",
			},
			theme: { color: "#6d28d9" },
		};
		const rzp = new window.Razorpay(options);
		rzp.open();
	};

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

	const detectLocation = () => {
		if (!navigator.geolocation) {
			setAlert({
				message: "Geolocation not supported by your browser",
				type: "error",
			});
			return;
		}

		navigator.geolocation.getCurrentPosition(async (position) => {
			const { latitude, longitude } = position.coords;
			try {
				const res = await fetch(
					`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
				);
				const data = await res.json();
				setTempAddress(data.display_name);
			} catch (err) {
				setAlert({ message: "Could not resolve address", type: "error" });
			}
		});
	};

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
						Complete Booking for {serviceName}
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
										<div className="flex justify-between items-center mb-1">
											<label className="text-[13px] text-gray-400">
												Service Address
											</label>
											<button
												onClick={detectLocation}
												className="cursor-pointer text-[12px] text-violet-300 flex items-center gap-1 hover:text-violet-200/70"
											>
												<Navigation size={12} /> Use Current Location
											</button>
										</div>
										<textarea
											value={tempAddress}
											onChange={(e) => setTempAddress(e.target.value)}
											className="w-full bg-[#191034] border border-white/10 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-violet-500 transition-all resize-none h-28"
											placeholder="Enter your full address..."
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
								) : address ? (
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
								) : (
									<button
										onClick={() => setIsEditingAddress(true)}
										className="w-full flex items-center justify-center gap-3 p-8 text-gray-400 hover:text-violet-300 hover:bg-white/5 transition-all group"
									>
										<div className="p-3 rounded-full bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
											<MapPin className="w-6 h-6" />
										</div>
										<span className="font-semibold">
											Click to add service address
										</span>
									</button>
								)}
							</div>
						</div>
						{/* Step 4: Payment Method */}
						<div className="inter space-y-4">
							<div className="flex items-center gap-2 px-1">
								<div className="p-1.5 rounded-lg bg-violet-500/20">
									<ShieldCheck className="w-5 h-5 text-violet-300" />
								</div>
								<h3 className="text-lg font-semibold text-white">
									Payment Method
								</h3>
							</div>

							<div className="flex w-full gap-4 justify-center items-center">
								<PaymentOptions
									method="online"
									currentMethod={paymentMethod}
									setMethod={setPaymentMethod}
									title="Pay Online"
									subtitle="UPI, Cards, Wallet"
									icon={CreditCard}
								/>
								<PaymentOptions
									method="cash"
									currentMethod={paymentMethod}
									setMethod={setPaymentMethod}
									title="Pay after Service"
									subtitle="Cash on Delivery"
									icon={Wallet}
								/>
							</div>
						</div>
						{/* Desktop Confirm Button */}
						<div className="hidden lg:block pt-6 inter ">
							<button
								onClick={handleConfirm}
								disabled={isSubmitting || !selectedTime || !address.trim()}
								className={`cursor-pointer w-full py-4 rounded-xl text-lg font-bold shadow-xl transition-all duration-300 flex items-center justify-center gap-3 group
                    ${
											selectedTime && address.trim()
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
				className={`inter lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-[#191034]/95 backdrop-blur-2xl border-t border-white/10 z-50 transition-all duration-500 ease-out ${
					selectedTime
						? "translate-y-0 opacity-100"
						: "translate-y-full opacity-0"
				}`}
			>
				<div className="flex items-center gap-4 max-w-md mx-auto">
					<div className="flex-1">
						<p className="text-[10px] text-violet-300/60 uppercase tracking-widest mb-0.5 font-bold">
							Total Amount
						</p>
						<div className="flex items-baseline gap-1">
							<span className="text-2xl font-bold text-white tracking-tight">
								₹{provider.price}
							</span>
						</div>
						{/* Payment Method Indicator */}
						<p className="text-[9px] text-gray-400 flex items-center gap-1 mt-0.5">
							<span
								className={`w-1.5 h-1.5 rounded-full ${paymentMethod === "online" ? "bg-green-400" : "bg-orange-400"}`}
							></span>
							{paymentMethod === "online"
								? "Online Payment"
								: "Cash on Delivery"}
						</p>
					</div>

					<button
						onClick={handleConfirm}
						disabled={isSubmitting || !address.trim()}
						className={`cursor-pointer flex-[1.5] py-4 rounded-2xl font-bold text-lg shadow-2xl active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 ${
							paymentMethod === "online"
								? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-violet-900/40"
								: "bg-white text-[#191034] shadow-white/10"
						} ${!address.trim() ? "opacity-50 grayscale cursor-not-allowed" : ""}`}
					>
						{isSubmitting ? (
							<div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin hover:scale-90" />
						) : (
							<>
								{/* <span>
									{paymentMethod === "online" ? "Pay & Book" : "Confirm"}
								</span> */}
								<div className="grid grid-cols-2 gap-4 w-full">
									<PaymentOptions
										method="online"
										currentMethod={paymentMethod}
										setMethod={setPaymentMethod}
										title="Pay Online"
										subtitle="UPI, Cards, Wallet"
										icon={CreditCard}
									/>
									<PaymentOptions
										method="cash"
										currentMethod={paymentMethod}
										setMethod={setPaymentMethod}
										title="Pay after Service"
										subtitle="Cash on Delivery"
										icon={Wallet}
									/>
								</div>
								<ArrowLeft size={20} className="rotate-180" />
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
