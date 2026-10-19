import { createRequestGuard } from "../../utils/serviceLocation";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
	MapPin,
	Home,
	Briefcase,
	Plus,
	Trash2,
	Check,
	X,
	Compass,
	Loader2,
	Star,
	Edit2,
	Navigation,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../api/axiosInstance";
import { useModal } from "../../hooks/useModal";

const LABELS = [
	{ id: "Home", label: "Home", icon: Home },
	{ id: "Work", label: "Work", icon: Briefcase },
	{ id: "Other", label: "Other", icon: MapPin },
];

export default function SavedAddressesModal({
	isOpen,
	onClose,
	onUpdate,
	onSelect,
	selectedId,
	startWithAdd = false,
}) {
	const [addresses, setAddresses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState(null);
	const [submitting, setSubmitting] = useState(false);
	const [locating, setLocating] = useState(false);

	const locationRequests=useRef(createRequestGuard());
	useEffect(()=>()=>locationRequests.current.cancel(),[]);
	const changeAddressField=(field,value)=>{locationRequests.current.cancel();setLocating(false);setFormData(prev=>({...prev,[field]:value,lat:null,lng:null}));};
	const [formData, setFormData] = useState({
		label: "Home",
		full_address: "",
		street: "",
		landmark: "",
		city: "Bengaluru",
		state: "Karnataka",
		postal_code: "",
		lat: null,
		lng: null,
		is_default: false,
	});

	useModal({
		isOpen,
		onClose,
		id: "saved-addresses-modal",
		lockScroll: true,
	});

	const fetchAddresses = async () => {
		try {
			setLoading(true);
			const res = await api.get("/api/account/addresses");
			const list = res.data?.addresses || [];
			setAddresses(list);
			if (onUpdate) onUpdate(list);
		} catch (err) {
			console.error("Failed to load addresses:", err);
			toast.error("Could not load your saved addresses.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!isOpen) {locationRequests.current.cancel();setLocating(false);}
		if (isOpen) {
			fetchAddresses();
			if (startWithAdd) {
				resetForm();
				setShowForm(true);
			} else {
				setShowForm(false);
			}
			setEditingId(null);
		}
	}, [isOpen, startWithAdd]);

	const resetForm = () => {
		locationRequests.current.cancel();setLocating(false);
		setFormData({
			label: "Home",
			full_address: "",
			street: "",
			landmark: "",
			city: "Bengaluru",
			state: "Karnataka",
			postal_code: "",
			lat: null,
			lng: null,
			is_default: addresses.length === 0,
		});
		setEditingId(null);
		setShowForm(false);
	};

	const handleEdit = (addr) => {
		locationRequests.current.cancel();setLocating(false);
		setFormData({
			label: addr.label || "Home",
			full_address: addr.full_address || "",
			street: addr.street || "",
			landmark: addr.landmark || "",
			city: addr.city || "Bengaluru",
			state: addr.state || "Karnataka",
			postal_code: addr.postal_code || "",
			lat: addr.lat ?? null,
			lng: addr.lng ?? null,
			is_default: addr.is_default || false,
		});
		setEditingId(addr.id);
		setShowForm(true);
	};

	const handleUseCurrentLocation = () => {
		if (!navigator.geolocation) {
			toast.error("Geolocation is not supported by your browser.");
			return;
		}

		const request=locationRequests.current.begin();
		setLocating(true);
		setFormData(prev=>({...prev,lat:null,lng:null}));
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				const { latitude, longitude } = position.coords;
				if(!request.current())return;

				try {
					// Reverse geocode via free OpenStreetMap Nominatim
					const geoRes = await fetch(
						`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
						{ signal:request.signal },
					);
					if(!geoRes.ok)throw new Error("Address not verified");
					if (request.current()) {
						const data = await geoRes.json();
						const addr = data.address || {};
						const formatted = data.display_name || "";
						if(!formatted)throw new Error("Address not verified");
						setFormData((prev) => ({
							...prev,
							full_address: formatted,
							street: addr.road || addr.suburb || "",
							city: addr.city || addr.town || addr.state_district || "Bengaluru",
							state: addr.state || "Karnataka",
							postal_code: addr.postcode || "",
							lat: latitude,
							lng: longitude,
						}));
						toast.success("Current location captured!");
					}
				} catch {
					if(request.current())toast.error("Couldn't verify this location. Please search your address during booking.");
				} finally {
					if(request.current())setLocating(false);
				}
			},
			(err) => {
				if(!request.current())return;
				console.warn("Location access denied:", err.message);
				toast.error("Location permission denied. Please type your address.");
				setLocating(false);
			},
			{ timeout: 10000, enableHighAccuracy: true },
		);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.full_address.trim()) {
			toast.error("Please enter your complete address.");
			return;
		}

		setSubmitting(true);
		try {
			let savedItem = null;
			if (editingId) {
				const res = await api.put(`/api/account/addresses/${editingId}`, formData);
				toast.success("Address updated successfully!");
				savedItem = res.data?.address;
			} else {
				const res = await api.post("/api/account/addresses", formData);
				toast.success("New address saved!");
				savedItem = res.data?.address;
			}
			resetForm();
			await fetchAddresses();
			if (onSelect && savedItem) {
				onSelect(savedItem);
				onClose();
			}
		} catch (err) {
			console.error("Save address error:", err);
			toast.error(err.response?.data?.error || "Failed to save address.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleSetDefault = async (id) => {
		try {
			await api.patch(`/api/account/addresses/${id}/default`);
			toast.success("Default address updated!");
			fetchAddresses();
		} catch (err) {
			console.error("Set default error:", err);
			toast.error("Failed to update default address.");
		}
	};

	const handleDelete = async (id) => {
		try {
			await api.delete(`/api/account/addresses/${id}`);
			toast.success("Address removed.");
			fetchAddresses();
		} catch (err) {
			console.error("Delete address error:", err);
			toast.error("Failed to delete address.");
		}
	};

	if (typeof document === "undefined") return null;

	return createPortal(
		<AnimatePresence>
			{isOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bricolage-grotesque">
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-[#07050a]/80 backdrop-blur-md"
					/>

					{/* Modal Dialog */}
					<motion.div
						initial={{ opacity: 0, scale: 0.96, y: 14 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 14 }}
						transition={{ duration: 0.25, ease: "easeOut" }}
						className="relative w-full max-w-xl bg-[#130f1c] border border-white/[0.12] rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] text-stone-200 overflow-hidden z-10 my-8"
					>
						{/* Ambient Glow */}
						<div
							aria-hidden
							className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 bg-gradient-to-b from-amber-400/20 to-transparent blur-3xl pointer-events-none"
						/>

						{/* Header */}
						<div className="relative px-6 py-5 border-b border-white/[0.08] flex items-center justify-between">
							<div className="flex items-center gap-3">
								<span className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-300 flex items-center justify-center border border-amber-400/20">
									<MapPin size={18} />
								</span>
								<div>
									<h2 className="font-mackinac text-xl font-bold text-white tracking-tight">
										Saved Addresses
									</h2>
									<p className="text-xs text-stone-400">
										Manage delivery and service locations
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={onClose}
								className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/[0.06] transition-colors"
							>
								<X size={18} />
							</button>
						</div>

						{/* Content */}
						<div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
							{/* Toggle Add Form Button */}
							{!showForm && (
								<button
									type="button"
									onClick={() => {
										resetForm();
										setShowForm(true);
									}}
									className="w-full py-3.5 px-4 rounded-xl border border-dashed border-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-400/50 text-stone-200 text-sm font-medium flex items-center justify-center gap-2 transition-all group"
								>
									<Plus
										size={16}
										className="text-violet-400 group-hover:scale-110 transition-transform"
									/>
									<span>Add New Address</span>
								</button>
							)}

							{/* Add / Edit Form */}
							<AnimatePresence>
								{showForm && (
									<motion.form
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: "auto" }}
										exit={{ opacity: 0, height: 0 }}
										onSubmit={handleSubmit}
										className="rounded-2xl border border-violet-400/30 bg-violet-500/[0.04] p-5 space-y-4"
									>
										<div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
											<span className="text-sm font-semibold text-white">
												{editingId ? "Edit Address" : "New Address Details"}
											</span>
											<button
												type="button"
												onClick={() => setShowForm(false)}
												className="text-xs text-stone-400 hover:text-white"
											>
												Cancel
											</button>
										</div>

										{/* Label selector */}
										<div>
											<label className="block text-xs font-medium text-stone-400 mb-1.5">
												Address Tag
											</label>
											<div className="grid grid-cols-3 gap-2">
												{LABELS.map(({ id, label, icon: Icon }) => {
													const active = formData.label === id;
													return (
														<button
															key={id}
															type="button"
															onClick={() =>
																setFormData((prev) => ({ ...prev, label: id }))
															}
															className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
																active
																	? "border-amber-400/60 bg-amber-400/15 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.15)]"
																	: "border-white/[0.08] bg-white/[0.03] text-stone-400 hover:bg-white/[0.06] hover:text-stone-200"
															}`}
														>
															<Icon size={14} />
															{label}
														</button>
													);
												})}
											</div>
										</div>

										{/* Quick GPS Location Button */}
										<div>
											<button
												type="button"
												onClick={handleUseCurrentLocation}
												disabled={locating}
												className="w-full h-9 rounded-lg border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.06] text-xs font-medium text-stone-300 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
											>
												{locating ? (
													<Loader2 size={13} className="animate-spin text-amber-300" />
												) : (
													<Navigation size={13} className="text-amber-300" />
												)}
												<span>
													{locating
														? "Detecting GPS location..."
														: "Autofill from current location"}
												</span>
											</button>
										</div>

										{/* Full Address */}
										<div>
											<label className="block text-xs font-medium text-stone-400 mb-1">
												Complete Address (House/Flat No, Building, Street) *
											</label>
											<textarea
												rows={2}
												required
												value={formData.full_address}
												onChange={(e)=>changeAddressField("full_address",e.target.value)}
												placeholder="e.g. Flat 301, Silver Oak Apartments, 12th Main Road, Indiranagar"
												className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-violet-400 transition-colors"
											/>
										</div>

										{/* Landmark & Pincode Grid */}
										<div className="grid grid-cols-2 gap-3">
											<div>
												<label className="block text-xs font-medium text-stone-400 mb-1">
													Landmark (Optional)
												</label>
												<input
													type="text"
													value={formData.landmark}
													onChange={(e) =>
														setFormData((prev) => ({
															...prev,
															landmark: e.target.value,
														}))
													}
													placeholder="e.g. Near Metro Station"
													className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-violet-400"
												/>
											</div>
											<div>
												<label className="block text-xs font-medium text-stone-400 mb-1">
													PIN Code
												</label>
												<input
													type="text"
													maxLength={6}
													value={formData.postal_code}
													onChange={(e)=>changeAddressField("postal_code",e.target.value)}
													placeholder="e.g. 560038"
													className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-violet-400"
												/>
											</div>
										</div>

										{/* City & State */}
										<div className="grid grid-cols-2 gap-3">
											<div>
												<label className="block text-xs font-medium text-stone-400 mb-1">
													City
												</label>
												<input
													type="text"
													value={formData.city}
													onChange={(e)=>changeAddressField("city",e.target.value)}
													className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm focus:outline-none focus:border-violet-400"
												/>
											</div>
											<div>
												<label className="block text-xs font-medium text-stone-400 mb-1">
													State
												</label>
												<input
													type="text"
													value={formData.state}
													onChange={(e)=>changeAddressField("state",e.target.value)}
													className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm focus:outline-none focus:border-violet-400"
												/>
											</div>
										</div>

										{/* Set as default checkbox */}
										<label className="flex items-center gap-2 cursor-pointer pt-1">
											<input
												type="checkbox"
												checked={formData.is_default}
												onChange={(e) =>
													setFormData((prev) => ({
														...prev,
														is_default: e.target.checked,
													}))
												}
												className="rounded bg-black/40 border-white/[0.2] text-violet-500 focus:ring-0"
											/>
											<span className="text-xs text-stone-300 select-none">
												Set as primary default address
											</span>
										</label>

										{/* Submit buttons */}
										<div className="flex gap-2 pt-2">
											<button
												type="submit"
												disabled={submitting}
												className="flex-1 h-10 rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-400 text-[#0d0b12] text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
											>
												{submitting ? (
													<Loader2 size={15} className="animate-spin" />
												) : (
													<Check size={15} />
												)}
												<span>{editingId ? "Update Address" : "Save Address"}</span>
											</button>
											<button
												type="button"
												onClick={resetForm}
												className="h-10 px-4 rounded-xl border border-white/[0.1] text-xs font-medium text-stone-400 hover:text-white"
											>
												Cancel
											</button>
										</div>
									</motion.form>
								)}
							</AnimatePresence>

							{/* Loading skeleton */}
							{loading && (
								<div className="space-y-3">
									{[1, 2].map((i) => (
										<div
											key={i}
											className="h-24 rounded-2xl bg-white/[0.04] border border-white/[0.06] animate-pulse"
										/>
									))}
								</div>
							)}

							{/* Empty state */}
							{!loading && addresses.length === 0 && !showForm && (
								<div className="py-10 text-center space-y-3">
									<div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-stone-500 flex items-center justify-center mx-auto border border-white/[0.06]">
										<Compass size={22} />
									</div>
									<p className="text-sm font-medium text-white">
										No saved addresses yet
									</p>
									<p className="text-xs text-stone-500 max-w-xs mx-auto">
										Save your home, apartment, or office address to book expert
										services in a single click.
									</p>
								</div>
							)}

							{/* Addresses list */}
							{!loading && addresses.length > 0 && (
								<div className="space-y-3">
									{addresses.map((addr) => {
										const Icon =
											addr.label === "Work"
												? Briefcase
												: addr.label === "Home"
													? Home
													: MapPin;

										const isCurrentSelected = selectedId && (selectedId === addr.id || String(selectedId) === String(addr.id));
										return (
											<div
												key={addr.id}
												className={`p-4 rounded-2xl border transition-all relative ${
													isCurrentSelected
														? "border-amber-400/80 bg-amber-400/[0.08] shadow-[0_0_20px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/30"
														: addr.is_default
															? "border-amber-400/40 bg-gradient-to-r from-amber-400/[0.08] to-transparent shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
															: "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
												}`}
											>
												<div className="flex items-start justify-between gap-3">
													<div className="flex items-start gap-3 min-w-0">
														<span
															className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
																isCurrentSelected || addr.is_default
																	? "bg-amber-400/20 text-amber-300"
																	: "bg-white/[0.06] text-stone-400"
															}`}
														>
															<Icon size={16} />
														</span>
														<div className="min-w-0">
															<div className="flex items-center gap-2">
																<span className="font-semibold text-sm text-white">
																	{addr.label || "Address"}
																</span>
																{addr.is_default && (
																	<span className="h-5 px-2 rounded-full bg-amber-400/20 border border-amber-400/30 text-[10px] font-semibold text-amber-300 flex items-center gap-1">
																		<Star size={9} className="fill-amber-300" />
																		Default
																	</span>
																)}
																{isCurrentSelected && (
																	<span className="h-5 px-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
																		<Check size={9} />
																		Selected
																	</span>
																)}
															</div>
															<p className="mt-1 text-xs text-stone-300 leading-relaxed break-words">
																{addr.full_address}
															</p>
															{addr.landmark && (
																<p className="mt-0.5 text-[11px] text-stone-500">
																	Landmark: {addr.landmark}
																</p>
															)}
															<p className="mt-1 text-[11px] text-stone-500 font-mono">
																{addr.city}, {addr.state}{" "}
																{addr.postal_code ? `- ${addr.postal_code}` : ""}
															</p>
														</div>
													</div>

													{/* Actions */}
													<div className="flex items-center gap-1.5 shrink-0">
														{onSelect && (
															<button
																type="button"
																onClick={() => {
																	onSelect(addr);
																	onClose();
																}}
																className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
																	isCurrentSelected
																		? "bg-amber-400 text-stone-900 shadow-md shadow-amber-400/20"
																		: "bg-violet-600 hover:bg-violet-500 text-white shadow-sm"
																}`}
															>
																<Check size={13} />
																<span>{isCurrentSelected ? "Active" : "Use this"}</span>
															</button>
														)}
														{!addr.is_default && (
															<button
																type="button"
																onClick={() => handleSetDefault(addr.id)}
																title="Set as Default"
																className="p-1.5 rounded-lg text-stone-400 hover:text-amber-300 hover:bg-white/[0.06] transition-colors text-xs"
															>
																<Star size={14} />
															</button>
														)}
														<button
															type="button"
															onClick={() => handleEdit(addr)}
															title="Edit address"
															className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/[0.06] transition-colors"
														>
															<Edit2 size={14} />
														</button>
														<button
															type="button"
															onClick={() => handleDelete(addr.id)}
															title="Delete address"
															className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
														>
															<Trash2 size={14} />
														</button>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* Footer */}
						<div className="px-6 py-4 border-t border-white/[0.08] bg-black/20 flex items-center justify-between">
							<span className="text-xs text-stone-500">
								{addresses.length} saved{" "}
								{addresses.length === 1 ? "address" : "addresses"}
							</span>
							<button
								type="button"
								onClick={onClose}
								className="h-8 px-4 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold text-stone-200 transition-colors"
							>
								Done
							</button>
						</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>,
		document.body,
	);
}
