import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Clock, CheckCircle2 } from "lucide-react";
import Alerts from "../ui/Alerts";

export default function BookingPage() {
	const { customId } = useParams();
	const navigate = useNavigate();
	const { state } = useLocation();

	const [provider, setProvider] = useState(state?.provider || null);

	const [availability, setAvailability] = useState(
		state?.preloadedAvailability || state?.provider?.availability || []
	);

	const [selectedDate, setSelectedDate] = useState(null);
	const [selectedTime, setSelectedTime] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [loading, setLoading] = useState(!state?.provider);
	const [alert, setAlert] = useState(null);

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

	useEffect(() => {
		const fetchData = async () => {
			try {
				let currentProvider = provider;
				if (!currentProvider) {
					setLoading(true);
					const provRes = await fetch(
						`http://localhost:3000/api/providers/v1/${customId}`
					);
					if (!provRes.ok) throw new Error("Provider not found");
					const provData = await provRes.json();
					currentProvider = provData.provider;
					setProvider(currentProvider);
				}

				if (currentProvider && currentProvider.user_id) {
					if (availability.length === 0) setLoading(true);
					const slotsRes = await fetch(
						`http://localhost:3000/api/providers/v1/${currentProvider.user_id}/availability`
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

	const groupedSlots = availability.reduce((acc, slot) => {
		if (!acc[slot.date]) acc[slot.date] = [];
		if (!acc[slot.date].includes(slot.start_time)) {
			acc[slot.date].push(slot.start_time);
		}
		acc[slot.date].sort();
		return acc;
	}, {});

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
			const res = await fetch("http://localhost:3000/api/bookings", {
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
				}),
			});
			const data = await res.json();

			if (res.ok) {
				navigate("/booking-success", {
					state: { success: true, booking: data.booking },
					replace: true,
				});
			} else if (res.status === 409) {
				setAlert({
					message: "Slot already booked! Please choose another time.",
					type: "error",
				});
				setAvailability((prev) =>
					prev.map((slot) =>
						slot.date === selectedDate && slot.start_time === selectedTime
							? { ...slot, isBooked: true }
							: slot
					)
				);
				setSelectedTime(null);
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

	const visibleSlots =
		selectedDate && groupedSlots[selectedDate]
			? groupedSlots[selectedDate].filter((t) => {
					const slotObj = availability.find(
						(s) =>
							s.date === selectedDate &&
							s.start_time.startsWith(t.substring(0, 5))
					);
					const isBooked = slotObj ? slotObj.isBooked : false;
					const isExpired = isSlotExpired(selectedDate, t);
					return !isBooked && !isExpired;
			  })
			: [];

	if (loading || !provider) {
		return (
			<div className="min-h-screen bg-[#0f0c29] text-white flex items-center justify-center">
				<div className="flex flex-col items-center gap-4">
					<div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
					<p className="text-violet-200 animate-pulse">
						Finding availability...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#0f0c29] text-white font-sans selection:bg-violet-500/30">
			{alert && (
				<Alerts
					message={alert.message}
					type={alert.type}
					onClose={() => setAlert(null)}
				/>
			)}

			{/* Background Gradients */}
			<div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
				<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-900/20 rounded-full blur-[100px]" />
				<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[100px]" />
			</div>

			<div className="relative z-10 max-w-6xl mx-auto pb-32 lg:pb-12 px-4 sm:px-6">
				<div className="sticky top-0 bg-[#0f0c29]/80 backdrop-blur-md py-6 z-20 flex items-center gap-4 border-b border-white/5 mb-8">
					<button
						onClick={() => navigate(-1)}
						className="cursor-pointer p-2 rounded-full hover:bg-white/10 transition text-violet-200"
					>
						<ArrowLeft size={20} />
					</button>
					<span className="font-semibold text-lg tracking-wide">
						New Booking
					</span>
				</div>

				{/* RESPONSIVE GRID LAYOUT */}
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
					{/* LEFT COLUMN: Provider Details (Sticky on Desktop) */}
					<div className="lg:col-span-4">
						<div className="lg:sticky lg:top-32 space-y-6">
							<div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl flex lg:flex-col items-center lg:items-start gap-6 group hover:border-violet-500/30 transition-all duration-300">
								<div className="relative shrink-0">
									<div className="w-20 h-20 lg:w-32 lg:h-32 rounded-2xl overflow-hidden border-2 border-white/10 shadow-lg group-hover:scale-105 transition-transform duration-300">
										{provider.photo ? (
											<img
												src={provider.photo}
												alt={provider.name}
												className="w-full h-full object-cover"
											/>
										) : (
											<div className="w-full h-full bg-violet-600 flex items-center justify-center text-3xl font-bold">
												{provider.name?.charAt(0)}
											</div>
										)}
									</div>
									<div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 lg:w-8 lg:h-8 rounded-full border-4 border-[#0f0c29]" />
								</div>

								<div>
									<h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
										{provider.name}
									</h1>
									<div className="flex items-center gap-2 mt-2">
										<span className="text-2xl lg:text-3xl font-semibold text-violet-300">
											₹{provider.price}
										</span>
										<span className="text-sm text-gray-400 font-medium bg-white/5 px-2 py-0.5 rounded-md">
											per session
										</span>
									</div>
									<div className="mt-4 text-sm text-gray-400 hidden lg:block">
										Select a date and time to secure your slot with{" "}
										{provider.name.split(" ")[0]}.
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* RIGHT COLUMN: Date & Time Selectors */}
					<div className="lg:col-span-8 space-y-10">
						{/* Section 1: Date */}
						<div className="bg-white/5 lg:bg-transparent rounded-3xl p-6 lg:p-0 border border-white/5 lg:border-none">
							<div className="flex items-center gap-2 mb-6">
								<Calendar className="w-5 h-5 text-violet-400" />
								<h2 className="text-lg font-semibold text-violet-100">
									Select Date
								</h2>
							</div>

							{Object.keys(groupedSlots).length === 0 ? (
								<div className="p-8 rounded-2xl border border-dashed border-white/10 bg-white/5 text-center">
									<p className="text-gray-400">No available dates found.</p>
								</div>
							) : (
								<div
									className="flex gap-4 overflow-x-auto pb-4 snap-x flex-nowrap"
									style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
								>
									<style>{` ::-webkit-scrollbar { display: none; } `}</style>

									{Object.keys(groupedSlots).map((date) => (
										<button
											key={date}
											onClick={() => {
												setSelectedDate(date);
												setSelectedTime(null);
											}}
											className={`min-w-[100px] lg:min-w-[120px] flex-shrink-0 snap-start p-4 cursor-pointer rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border
                                                ${
																									selectedDate === date
																										? "bg-violet-600 border-violet-500 shadow-[0_0_20px_rgba(124,58,237,0.3)] scale-105"
																										: "bg-white/5 border-white/10 hover:bg-white/10 hover:border-violet-500/30"
																								}`}
										>
											<span className="text-sm uppercase tracking-wider text-violet-200/70 font-medium">
												{new Date(date).toLocaleDateString("en-US", {
													weekday: "short",
												})}
											</span>
											<span
												className={`text-2xl font-bold mt-1 ${
													selectedDate === date ? "text-white" : "text-gray-200"
												}`}
											>
												{new Date(date).toLocaleDateString("en-US", {
													day: "numeric",
												})}
											</span>
										</button>
									))}
								</div>
							)}
						</div>

						{/* Section 2: Time */}
						{selectedDate && (
							<div className="animate-fade-in-up bg-white/5 lg:bg-transparent rounded-3xl p-6 lg:p-0 border border-white/5 lg:border-none">
								<div className="flex items-center gap-2 mb-6">
									<Clock className="w-5 h-5 text-violet-400" />
									<h2 className="text-lg font-semibold text-violet-100">
										Select Start Time
									</h2>
								</div>

								{visibleSlots.length > 0 ? (
									<div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
										{visibleSlots.map((t) => (
											<button
												key={t}
												onClick={() => setSelectedTime(t)}
												className={`relative p-3 lg:p-4 rounded-xl border text-sm font-semibold transition-all duration-200
                                                    ${
																											selectedTime === t
																												? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/50 scale-[1.03]"
																												: "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-violet-500/30 hover:text-white"
																										}`}
											>
												{formatTime(t)}
												{selectedTime === t && (
													<div className="absolute -top-1 -right-1">
														<CheckCircle2 className="w-4 h-4 text-white fill-green-500 bg-black rounded-full" />
													</div>
												)}
											</button>
										))}
									</div>
								) : (
									<div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
										<p className="text-gray-400">
											No available slots remaining for this date.
										</p>
									</div>
								)}
							</div>
						)}

						{/* Desktop-only Confirm Button (Inline) */}
						<div className="hidden lg:block pt-6">
							<button
								onClick={handleConfirm}
								disabled={isSubmitting || !selectedTime}
								className={`cursor-pointer disabled:cursor-default w-full py-5 rounded-2xl text-xl font-bold shadow-xl 
                                transition-all duration-300 border border-white/10 flex items-center justify-center gap-3
                                ${
																	selectedTime
																		? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-900/40 hover:scale-[1.01]"
																		: "bg-gray-800/50 text-gray-500 cursor-not-allowed border-none"
																}`}
							>
								{isSubmitting ? (
									<>
										<span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
										Confirming...
									</>
								) : (
									<>
										<span>Confirm Booking</span>
										{selectedTime && (
											<span className="bg-white/20 px-3 py-1 rounded-lg text-sm font-medium">
												{formatTime(selectedTime)}
											</span>
										)}
									</>
								)}
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Mobile-only Confirm Button Footer (Fixed Bottom) */}
			<div
				className={`lg:hidden fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0f0c29] via-[#0f0c29] to-transparent z-30 transition-transform duration-300 ${
					selectedTime ? "translate-y-0" : "translate-y-full"
				}`}
			>
				<div className="max-w-2xl mx-auto">
					<button
						onClick={handleConfirm}
						disabled={isSubmitting}
						className="cursor-pointer w-full py-4 rounded-2xl text-lg font-bold shadow-xl shadow-violet-900/40
                        bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 
                        active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 border border-white/10"
					>
						{isSubmitting ? (
							<>
								<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								Confirming...
							</>
						) : (
							<>
								<span>Confirm Booking</span>
								<span className="bg-white/20 px-2 py-0.5 rounded text-sm font-medium">
									{selectedTime ? formatTime(selectedTime) : ""}
								</span>
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
