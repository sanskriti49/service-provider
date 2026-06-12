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
	const [selectedTime, setSelectedTime] = useState(state?.selectedSlot || null);
	const serviceName = state?.serviceName || "Service";

	const [isEditingAddress, setIsEditingAddress] = useState(false);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [loading, setLoading] = useState(!state?.provider);
	const [alert, setAlert] = useState(null);

	const [paymentMethod, setPaymentMethod] = useState("cod");

	function formatTime(timeString) {
		if (!timeString) return "";
		if (typeof timeString !== "string") {
			timeString = timeString.start_time || "";
		}
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

			const exists = acc[slot.date].some(
				(s) => s.start_time === slot.start_time && s.end_time === slot.end_time,
			);

			if (!exists) acc[slot.date].push(slot);

			acc[slot.date].sort((a, b) => a.start_time.localeCompare(b.start_time));

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

		return groupedSlots[selectedDate].filter((slot) => {
			const isBooked = slot.isBooked;
			const isExpired = isSlotExpired(selectedDate, slot.start_time);
			return !isBooked && !isExpired;
		});
	}, [selectedDate, groupedSlots]);

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
			return setAlert({
				message: "Please select a schedule time slot.",
				type: "error",
			});

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
					start_time: selectedTime.start_time,
					end_time: selectedTime.end_time,
					address,
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
			} catch {
				setAlert({ message: "Could not resolve address", type: "error" });
			}
		});
	};

	const dateDisplay = selectedDate ? formatDateDisplay(selectedDate) : null;

	return (
		<div className="min-h-screen bg-[#191034] text-white selection:bg-violet-500/30 pb-32 lg:pb-12">
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

			<div className="sticky top-0 z-40 bg-[#191034]/90 backdrop-blur-xl border-b border-white/5">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
					<button
						onClick={() => navigate(-1)}
						className="cursor-pointer p-2 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white shrink-0"
					>
						<ArrowLeft size={20} />
					</button>
					<h1 className="text-base sm:text-xl font-bold bricolage-grotesque tracking-tight truncate">
						Complete Booking for {serviceName}
					</h1>
				</div>
			</div>

			<div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-12">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start">
					{/* LEFT COLUMN: Provider Card */}
					<div className="lg:col-span-4 lg:sticky lg:top-28">
						<div className="bg-[#22194A] rounded-2xl p-5 lg:p-6 border border-white/5 shadow-2xl relative overflow-hidden group">
							<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 opacity-80" />

							<div className="flex flex-row lg:flex-col items-center lg:items-start gap-4 lg:gap-5">
								<div className="relative shrink-0">
									<div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-32 lg:h-32 rounded-xl lg:rounded-2xl overflow-hidden border border-white/10 shadow-lg">
										<img
											src={
												provider.photo ||
												`https://ui-avatars.com/api/?name=${provider.name}&background=6d28d9&color=fff`
											}
											alt={provider.name}
											className="w-full h-full object-cover"
										/>
									</div>
									<div className="absolute -bottom-1 -right-1 bg-[#1a103f] border border-violet-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-md">
										<Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
										<span className="text-[10px] font-bold">
											{provider.rating || "5.0"}
										</span>
									</div>
								</div>

								<div className="flex-1 text-left">
									<h2 className="mackinac text-lg sm:text-2xl font-bold leading-tight text-white mb-1">
										{provider.name}
									</h2>
									<div className="inter flex items-center gap-1 text-[11px] text-violet-300/80 mb-2">
										<ShieldCheck size={12} className="text-green-400" />
										<span>Verified Expert</span>
									</div>

									<div className="inter inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-100">
										<span className="text-base font-bold">
											₹{provider.price}
										</span>
										<span className="text-[10px] opacity-60">/ session</span>
									</div>
								</div>
							</div>

							{/* Order Summary Preview (Desktop Only) */}
							<div className="inter mt-6 pt-5 border-t border-white/5 space-y-3 hidden lg:block">
								<div className="flex justify-between text-sm">
									<span className="text-gray-400">Date</span>
									<span className="font-medium text-white">
										{dateDisplay?.full || "--"}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-gray-400">Time</span>
									<span className="font-medium text-white">
										{selectedTime
											? `${formatTime(selectedTime.start_time)} - ${formatTime(selectedTime.end_time)}`
											: "--"}
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
					<div className="inter lg:col-span-8 space-y-6 lg:space-y-8">
						{/*  Date Selection */}
						<div className="space-y-3.5">
							<div className="flex items-center gap-2 px-1">
								<div className="p-1.5 rounded-md bg-violet-500/20">
									<Calendar className="w-4 h-4 text-violet-300" />
								</div>
								<h3 className="text-base sm:text-lg font-semibold text-white">
									Select Date
								</h3>
							</div>

							{Object.keys(groupedSlots).length === 0 ? (
								<div className="p-6 rounded-xl border border-dashed border-white/10 bg-white/5 text-center">
									<p className="text-sm text-gray-400">
										No available dates found.
									</p>
								</div>
							) : (
								<div className="relative overflow-hidden">
									<div className="flex gap-2.5 overflow-x-auto pb-2 snap-x flex-nowrap px-1 custom-scrollbar-x momentum-scroll">
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
														className={`cursor-pointer snap-start flex-shrink-0 min-w-[76px] sm:min-w-[90px] p-2.5 sm:p-3 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-0.5
                                                        ${
																													isSelected
																														? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/40"
																														: "bg-[#22194A] border-white/5 text-gray-400 hover:bg-[#2a1f5a]"
																												}`}
													>
														<span
															className={`text-[12px] uppercase tracking-wider font-semibold ${isSelected ? "text-violet-200" : "text-gray-500"}`}
														>
															{d.weekday}
														</span>
														<span className="text-xl sm:text-2xl font-bold">
															{d.day}
														</span>
														<span className="text-[12px] opacity-60">
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
							<div className="space-y-3.5">
								<div className="flex items-center justify-between px-1">
									<div className="flex items-center gap-2">
										<div className="p-1.5 rounded-md bg-violet-500/20">
											<Clock className="w-4 h-4 text-violet-300" />
										</div>
										<h3 className="text-base sm:text-lg font-semibold text-white">
											Select Time
										</h3>
									</div>
									{visibleSlots.length > 0 && (
										<span className="text-[12px] text-violet-300/80 bg-violet-500/10 px-2 py-0.5 rounded-md">
											{visibleSlots.length} available
										</span>
									)}
								</div>

								{visibleSlots.length > 0 ? (
									<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
										{visibleSlots.map((slot) => {
											const isSelected =
												selectedTime?.start_time === slot.start_time &&
												selectedTime?.end_time === slot.end_time;
											return (
												<button
													key={`${slot.date}-${slot.start_time}-${slot.end_time}`}
													onClick={() => setSelectedTime(slot)}
													className={`cursor-pointer relative py-2.5 px-2 rounded-xl border text-[15px] sm:text-sm font-semibold transition-all duration-200
                                                    ${
																											isSelected
																												? "bg-white text-violet-900 border-white shadow-md shadow-violet-900/20"
																												: "bg-[#22194A] border-white/5 text-gray-300 hover:bg-[#2a1f5a]"
																										}`}
												>
													{formatTime(slot.start_time)} -{" "}
													{formatTime(slot.end_time)}
												</button>
											);
										})}
									</div>
								) : (
									<div className="bg-[#22194A] border border-dashed border-white/10 rounded-xl p-6 text-center">
										<p className="text-xs text-gray-400">
											No slots available for this date.
										</p>
									</div>
								)}
							</div>
						)}

						{/* Address */}
						<div className="space-y-3.5">
							<div className="flex items-center justify-between px-1">
								<div className="flex items-center gap-2">
									<div className="p-1.5 rounded-md bg-violet-500/20">
										<MapPin className="w-4 h-4 text-violet-300" />
									</div>
									<h3 className="text-base sm:text-lg font-semibold text-white">
										Location
									</h3>
								</div>
								{!isEditingAddress && (
									<button
										onClick={() => setIsEditingAddress(true)}
										className="text-xs text-violet-300 hover:text-white flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg hover:bg-white/5"
									>
										<Pencil size={11} /> Edit
									</button>
								)}
							</div>

							<div className="bg-[#22194A] border border-white/5 rounded-xl overflow-hidden">
								{isEditingAddress ? (
									<div className="p-4 space-y-3">
										<div className="flex justify-between items-center">
											<label className="text-xs text-gray-400">
												Service Address
											</label>
											<button
												onClick={detectLocation}
												className="cursor-pointer text-xs text-violet-300 flex items-center gap-1 hover:text-violet-200"
											>
												<Navigation size={11} /> Locate Me
											</button>
										</div>
										<textarea
											value={tempAddress}
											onChange={(e) => setTempAddress(e.target.value)}
											className="w-full bg-[#191034] border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-violet-500 outline-none resize-none h-24"
											placeholder="Flat/House No, Building, Street, Area..."
											autoFocus
										/>
										<div className="flex justify-end gap-2">
											<button
												onClick={() => {
													setTempAddress(address);
													setIsEditingAddress(false);
												}}
												className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
											>
												Cancel
											</button>
											<button
												onClick={handleSaveAddress}
												className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 transition-all"
											>
												Save
											</button>
										</div>
									</div>
								) : address ? (
									<div className="flex items-start gap-3 p-4 relative">
										<div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-600 to-indigo-600 opacity-50" />
										<div className="p-2 bg-[#191034] rounded-lg shrink-0 border border-white/5">
											<Navigation className="w-4 h-4 text-violet-400" />
										</div>
										<div>
											<p className="text-sm text-white font-medium leading-relaxed">
												{address}
											</p>
											<span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full mt-2">
												Serviceable Area
											</span>
										</div>
									</div>
								) : (
									<button
										onClick={() => setIsEditingAddress(true)}
										className="w-full flex items-center justify-center gap-3 p-6 text-gray-400 hover:text-violet-300 hover:bg-white/5 transition-all group"
									>
										<MapPin className="w-5 h-5 text-gray-500 group-hover:text-violet-400" />
										<span className="text-xs font-semibold">
											Add service address to continue
										</span>
									</button>
								)}
							</div>
						</div>

						{/* Payment Method */}
						<div className="space-y-3.5">
							<div className="flex items-center gap-2 px-1">
								<div className="p-1.5 rounded-md bg-violet-500/20">
									<CreditCard className="w-4 h-4 text-violet-300" />
								</div>
								<h3 className="text-base sm:text-lg font-semibold text-white">
									Payment Method
								</h3>
							</div>

							<div className="grid grid-cols-2 gap-3 w-full">
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
									title="Pay Later"
									subtitle="Cash after Service"
									icon={Wallet}
								/>
							</div>
						</div>

						{/* Desktop Confirm Button (Hidden on Mobile) */}
						<div className="hidden lg:block pt-4">
							<button
								onClick={handleConfirm}
								disabled={isSubmitting || !selectedTime || !address.trim()}
								className={`w-full mx-auto py-3.5 rounded-full text-base font-bold shadow-xl transition-all duration-300 flex items-center justify-center gap-2 group
                                ${
																	selectedTime && address.trim()
																		? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white transform hover:-translate-y-0.5 cursor-pointer"
																		: "bg-[#22194A] text-gray-500 cursor-not-allowed border border-white/5"
																}`}
							>
								{isSubmitting ? (
									<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								) : (
									<>
										<span>Confirm Booking</span>
										<Sparkles
											size={16}
											className={selectedTime ? "text-yellow-300" : "opacity-0"}
										/>
									</>
								)}
							</button>
						</div>
					</div>
				</div>
			</div>

			{/*  Mobile Footer */}
			<div className="font-inter lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-[#191034]/95 backdrop-blur-2xl border-t border-white/10 z-50">
				<div className="flex items-center justify-between gap-4 max-w-md mx-auto">
					<div>
						<p className="text-[9px] text-violet-300/60 uppercase tracking-widest font-bold">
							Total Amount
						</p>
						<span className="text-xl font-black text-white">
							₹{provider.price}
						</span>
						<p className="text-[10px] text-gray-400 tracking-tight">
							{paymentMethod === "online"
								? "Online Payment"
								: "Cash on Delivery"}
						</p>
					</div>

					<button
						onClick={handleConfirm}
						disabled={isSubmitting || !selectedTime || !address.trim()}
						className={` flex-1 py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-xl active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5
                        ${
													selectedTime && address.trim()
														? "hover:opacity-75 bg-gradient-to-r from-violet-600 to-indigo-600 text-white cursor-pointer"
														: "bg-[#22194A] text-gray-500 border border-white/5 cursor-not-allowed"
												}`}
					>
						{isSubmitting ? (
							<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
						) : !selectedTime ? (
							"Select Time Slot"
						) : !address.trim() ? (
							"Add Address"
						) : (
							<>
								<span>Book Now</span>
								<Sparkles size={14} className="text-yellow-300" />
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
