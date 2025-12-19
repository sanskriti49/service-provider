import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
	ArrowLeft,
	Calendar,
	Clock,
	CheckCircle2,
	MapPin,
	Pencil,
	Navigation,
} from "lucide-react";
import Alerts from "../ui/Alerts";

export default function BookingPage() {
	const { customId } = useParams();
	const navigate = useNavigate();
	const { state } = useLocation();

	const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

	const [provider, setProvider] = useState(state?.provider || null);
	const [availability, setAvailability] = useState(
		state?.preloadedAvailability || state?.provider?.availability || []
	);

	const [address, setAddress] = useState(
		"Home • 12/B, Green Heights, Civil Lines, Kanpur"
	);
	const [isEditingAddress, setIsEditingAddress] = useState(false);
	const [tempAddress, setTempAddress] = useState(address);

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

	const handleSaveAddress = () => {
		setAddress(tempAddress);
		setIsEditingAddress(false);
	};

	useEffect(() => {
		const fetchData = async () => {
			try {
				let currentProvider = provider;
				if (!currentProvider) {
					setLoading(true);
					const provRes = await fetch(
						`${API_URL}/api/providers/v1/${customId}`
					);
					if (!provRes.ok) throw new Error("Provider not found");
					const provData = await provRes.json();
					currentProvider = provData.provider;
					setProvider(currentProvider);
				}

				if (currentProvider && currentProvider.user_id) {
					if (availability.length === 0) setLoading(true);
					const slotsRes = await fetch(
						`${API_URL}/api/providers/v1/${currentProvider.user_id}/availability`
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
		<div className="bricolage-grotesque min-h-screen bg-[#0f0c29] text-white font-sans selection:bg-violet-500/30">
			{alert && (
				<Alerts
					message={alert.message}
					type={alert.type}
					onClose={() => setAlert(null)}
				/>
			)}

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

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
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
									<div className="mt-4 text-sm text-gray-400 hidden lg:block leading-relaxed">
										Select a date and time to secure your slot with{" "}
										{provider.name.split(" ")[0]}.
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* RIGHT COLUMN: Selection & Address */}
					<div className="lg:col-span-8 space-y-8">
						{/* 1. Date Selection */}
						<div className="bg-white/5 lg:bg-transparent rounded-3xl p-6 lg:p-0 border border-white/5 lg:border-none">
							<div className="flex items-center gap-2 mb-4">
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
									className="flex gap-3 overflow-x-auto pb-4 snap-x flex-nowrap max-h-100
                                    [&::-webkit-scrollbar]:h-1.5 
                                    cursor-pointer
                                    [&::-webkit-scrollbar-track]:bg-white/5 
                                    [&::-webkit-scrollbar-thumb]:bg-violet-600/50 
                                    hover:[&::-webkit-scrollbar-thumb]:bg-violet-600 
                                    [&::-webkit-scrollbar-thumb]:rounded-full"
								>
									{Object.keys(groupedSlots).map((date) => (
										<button
											key={date}
											onClick={() => {
												setSelectedDate(date);
												setSelectedTime(null);
											}}
											className={`min-w-[100px] lg:min-w-[120px] flex-shrink-0 snap-start p-4 cursor-pointer rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border focus:outline-none focus:ring-0
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

						{/* 2. Time Selection */}
						{selectedDate && (
							<div className="animate-fade-in-up bg-white/5 lg:bg-transparent rounded-3xl p-6 lg:p-0 border border-white/5 lg:border-none">
								<div className="flex items-center gap-2 mb-4">
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
												className={`relative p-3 lg:p-4 rounded-xl border text-sm font-semibold transition-all duration-200 focus:outline-none
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

						{/* 3. Address / Location Section */}
						<div className="bg-white/5 rounded-3xl p-6 border border-white/10">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-2">
									<MapPin className="w-5 h-5 text-violet-400" />
									<h2 className="text-lg font-semibold text-violet-100">
										Service Location
									</h2>
								</div>
								{!isEditingAddress && (
									<button
										onClick={() => setIsEditingAddress(true)}
										className="text-xs cursor-pointer text-violet-300 hover:text-violet-100 flex items-center gap-1 transition-colors duration-200"
									>
										<Pencil size={12} /> Edit
									</button>
								)}
							</div>

							{isEditingAddress ? (
								<div className="space-y-3">
									<textarea
										value={tempAddress}
										onChange={(e) => setTempAddress(e.target.value)}
										className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all resize-none h-24"
										placeholder="Enter full address..."
									/>
									<div className="flex gap-2 justify-end">
										<button
											onClick={() => {
												setTempAddress(address);
												setIsEditingAddress(false);
											}}
											className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/5 transition"
										>
											Cancel
										</button>
										<button
											onClick={handleSaveAddress}
											className="px-4 py-2 rounded-lg text-sm bg-violet-600 text-white hover:bg-violet-500 font-medium transition"
										>
											Save Address
										</button>
									</div>
								</div>
							) : (
								<div className="flex items-start gap-4 p-4 bg-black/20 rounded-2xl border border-white/5">
									<div className="p-2 bg-violet-500/10 rounded-lg shrink-0">
										<Navigation className="w-5 h-5 text-violet-400" />
									</div>
									<div>
										<p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">
											Provider will arrive at
										</p>
										<p className="text-white font-medium leading-relaxed">
											{address}
										</p>
										<p className="text-xs text-green-400/70 mt-2 flex items-center gap-1">
											<CheckCircle2 size={12} /> Within service area
										</p>
									</div>
								</div>
							)}
						</div>

						{/* Desktop Confirm Button */}
						<div className="hidden lg:block pt-4">
							<button
								onClick={handleConfirm}
								disabled={isSubmitting || !selectedTime}
								className={`cursor-pointer w-full py-5 rounded-2xl text-xl font-bold shadow-xl transition-all duration-300 border border-white/10 flex items-center justify-center gap-3
                                    ${
																			selectedTime
																				? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-900/40 hover:scale-[1.01]"
																				: "bg-gray-800/50 text-gray-500 cursor-not-allowed border-none"
																		}`}
							>
								{isSubmitting ? "Confirming..." : "Confirm Booking"}
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Mobile Footer */}
			<div
				className={`lg:hidden fixed bottom-0 left-0 right-0 p-6 bg-[#0f0c29] border-t border-white/10 z-30 transition-transform duration-300 ${
					selectedTime ? "translate-y-0" : "translate-y-full"
				}`}
			>
				<div className="max-w-2xl mx-auto">
					<button
						onClick={handleConfirm}
						disabled={isSubmitting}
						className="w-full py-4 rounded-2xl text-lg font-bold shadow-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-center gap-2"
					>
						{isSubmitting ? (
							"Confirming..."
						) : (
							<>
								<span>Confirm</span>
								<span className="bg-white/20 px-2 py-0.5 rounded text-sm">
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
