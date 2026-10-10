import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
	CreditCard,
	Plus,
	Trash2,
	Check,
	X,
	Star,
	ShieldCheck,
	Loader2,
	Smartphone,
	Building2,
	Lock,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../api/axiosInstance";
import { useModal } from "../../hooks/useModal";

const PAYMENT_TABS = [
	{ id: "card", label: "Credit / Debit Card", icon: CreditCard },
	{ id: "upi", label: "UPI ID / VPA", icon: Smartphone },
	{ id: "bank_account", label: "Bank Account", icon: Building2 },
];

export default function SavedPaymentsModal({ isOpen, onClose, onUpdate }) {
	const [paymentMethods, setPaymentMethods] = useState([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [activeTab, setActiveTab] = useState("card");
	const [submitting, setSubmitting] = useState(false);

	const [formData, setFormData] = useState({
		type: "card",
		cardholder_name: "",
		card_number: "",
		card_expiry: "",
		card_brand: "",
		nickname: "",
		upi_id: "",
		bank_name: "",
		account_number: "",
		is_default: false,
	});

	useModal({
		isOpen,
		onClose,
		id: "saved-payments-modal",
		lockScroll: true,
	});

	const fetchPaymentMethods = async () => {
		try {
			setLoading(true);
			const res = await api.get("/api/account/payment-methods");
			const list = res.data?.payment_methods || [];
			setPaymentMethods(list);
			if (onUpdate) onUpdate(list);
		} catch (err) {
			console.error("Failed to load payment methods:", err);
			toast.error("Could not load your saved payment methods.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (isOpen) {
			fetchPaymentMethods();
			setShowForm(false);
		}
	}, [isOpen]);

	const resetForm = () => {
		setFormData({
			type: activeTab,
			cardholder_name: "",
			card_number: "",
			card_expiry: "",
			card_brand: "",
			nickname: "",
			upi_id: "",
			bank_name: "",
			account_number: "",
			is_default: paymentMethods.length === 0,
		});
		setShowForm(false);
	};

	const formatCardNumber = (value) => {
		const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
		const matches = v.match(/\d{4,16}/g);
		const match = (matches && matches[0]) || "";
		const parts = [];
		for (let i = 0, len = match.length; i < len; i += 4) {
			parts.push(match.substring(i, i + 4));
		}
		if (parts.length) {
			return parts.join(" ");
		}
		return v;
	};

	const formatExpiry = (value) => {
		const clean = value.replace(/\D/g, "");
		if (clean.length >= 2) {
			return `${clean.slice(0, 2)}/${clean.slice(2, 4)}`;
		}
		return clean;
	};

	const handleCardNumberChange = (e) => {
		const formatted = formatCardNumber(e.target.value);
		const digits = formatted.replace(/\D/g, "");
		let brand = "";
		if (/^4/.test(digits)) brand = "visa";
		else if (/^5[1-5]/.test(digits)) brand = "mastercard";
		else if (/^(60|65|81|82)/.test(digits)) brand = "rupay";
		else if (/^3[47]/.test(digits)) brand = "amex";

		setFormData((prev) => ({
			...prev,
			card_number: formatted,
			card_brand: brand,
		}));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSubmitting(true);
		try {
			const payload = {
				...formData,
				type: activeTab,
			};

			if (activeTab === "card") {
				if (!payload.card_number || payload.card_number.replace(/\s/g, "").length < 12) {
					toast.error("Please enter a valid card number.");
					setSubmitting(false);
					return;
				}
				if (!payload.cardholder_name.trim()) {
					toast.error("Cardholder name is required.");
					setSubmitting(false);
					return;
				}
			} else if (activeTab === "upi") {
				if (!payload.upi_id || !payload.upi_id.includes("@")) {
					toast.error("Please provide a valid UPI ID (e.g., name@okhdfcbank).");
					setSubmitting(false);
					return;
				}
			} else if (activeTab === "bank_account") {
				if (!payload.account_number || payload.account_number.length < 6) {
					toast.error("Please enter a valid account number.");
					setSubmitting(false);
					return;
				}
			}

			await api.post("/api/account/payment-methods", payload);
			toast.success("Payment account saved securely!");
			resetForm();
			fetchPaymentMethods();
		} catch (err) {
			console.error("Save payment method error:", err);
			toast.error(err.response?.data?.error || "Failed to save payment method.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleSetDefault = async (id) => {
		try {
			await api.patch(`/api/account/payment-methods/${id}/default`);
			toast.success("Default payment method updated!");
			fetchPaymentMethods();
		} catch (err) {
			console.error("Set default payment error:", err);
			toast.error("Failed to update default payment method.");
		}
	};

	const handleDelete = async (id) => {
		try {
			await api.delete(`/api/account/payment-methods/${id}`);
			toast.success("Payment method removed.");
			fetchPaymentMethods();
		} catch (err) {
			console.error("Delete payment error:", err);
			toast.error("Failed to delete payment method.");
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
							className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 bg-gradient-to-b from-emerald-400/20 to-transparent blur-3xl pointer-events-none"
						/>

						{/* Header */}
						<div className="relative px-6 py-5 border-b border-white/[0.08] flex items-center justify-between">
							<div className="flex items-center gap-3">
								<span className="w-10 h-10 rounded-xl bg-emerald-400/10 text-emerald-300 flex items-center justify-center border border-emerald-400/20">
									<CreditCard size={18} />
								</span>
								<div>
									<h2 className="font-mackinac text-xl font-bold text-white tracking-tight">
										Payment Accounts
									</h2>
									<p className="text-xs text-stone-400 flex items-center gap-1.5">
										<ShieldCheck size={12} className="text-emerald-400" />
										Bank-grade 256-bit encrypted storage
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
									className="w-full py-3.5 px-4 rounded-xl border border-dashed border-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-400/50 text-stone-200 text-sm font-medium flex items-center justify-center gap-2 transition-all group"
								>
									<Plus
										size={16}
										className="text-emerald-400 group-hover:scale-110 transition-transform"
									/>
									<span>Add Payment Method</span>
								</button>
							)}

							{/* Add Payment Form */}
							<AnimatePresence>
								{showForm && (
									<motion.form
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: "auto" }}
										exit={{ opacity: 0, height: 0 }}
										onSubmit={handleSubmit}
										className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.04] p-5 space-y-4"
									>
										<div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
											<span className="text-sm font-semibold text-white">
												Add New Payment Account
											</span>
											<button
												type="button"
												onClick={() => setShowForm(false)}
												className="text-xs text-stone-400 hover:text-white"
											>
												Cancel
											</button>
										</div>

										{/* Payment Category Tabs */}
										<div className="grid grid-cols-3 gap-2">
											{PAYMENT_TABS.map(({ id, label, icon: Icon }) => {
												const active = activeTab === id;
												return (
													<button
														key={id}
														type="button"
														onClick={() => {
															setActiveTab(id);
															setFormData((prev) => ({ ...prev, type: id }));
														}}
														className={`h-9 px-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
															active
																? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200 shadow-[0_0_15px_rgba(52,211,153,0.15)]"
																: "border-white/[0.08] bg-white/[0.03] text-stone-400 hover:bg-white/[0.06] hover:text-stone-200"
														}`}
													>
														<Icon size={14} />
														<span className="truncate">{label.split(" ")[0]}</span>
													</button>
												);
											})}
										</div>

										{/* CARD FIELDS */}
										{activeTab === "card" && (
											<div className="space-y-3">
												<div>
													<label className="block text-xs font-medium text-stone-400 mb-1">
														Cardholder Name *
													</label>
													<input
														type="text"
														required
														placeholder="Full name as printed on card"
														value={formData.cardholder_name}
														onChange={(e) =>
															setFormData((prev) => ({
																...prev,
																cardholder_name: e.target.value,
															}))
														}
														className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-emerald-400"
													/>
												</div>

												<div>
													<div className="flex justify-between items-center mb-1">
														<label className="text-xs font-medium text-stone-400">
															Card Number *
														</label>
														{formData.card_brand && (
															<span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-emerald-400">
																{formData.card_brand}
															</span>
														)}
													</div>
													<input
														type="text"
														required
														maxLength={19}
														placeholder="1234 5678 9012 3456"
														value={formData.card_number}
														onChange={handleCardNumberChange}
														className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm font-mono placeholder:text-stone-600 focus:outline-none focus:border-emerald-400 tracking-wider"
													/>
												</div>

												<div className="grid grid-cols-2 gap-3">
													<div>
														<label className="block text-xs font-medium text-stone-400 mb-1">
															Valid Thru (MM/YY) *
														</label>
														<input
															type="text"
															required
															maxLength={5}
															placeholder="12/28"
															value={formData.card_expiry}
															onChange={(e) =>
																setFormData((prev) => ({
																	...prev,
																	card_expiry: formatExpiry(e.target.value),
																}))
															}
															className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm font-mono placeholder:text-stone-600 focus:outline-none focus:border-emerald-400 text-center"
														/>
													</div>
													<div>
														<label className="block text-xs font-medium text-stone-400 mb-1">
															Nickname (Optional)
														</label>
														<input
															type="text"
															placeholder="e.g. Salary Card"
															value={formData.nickname}
															onChange={(e) =>
																setFormData((prev) => ({
																	...prev,
																	nickname: e.target.value,
																}))
															}
															className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-emerald-400"
														/>
													</div>
												</div>
											</div>
										)}

										{/* UPI FIELDS */}
										{activeTab === "upi" && (
											<div className="space-y-3">
												<div>
													<label className="block text-xs font-medium text-stone-400 mb-1">
														UPI ID / Virtual Payment Address *
													</label>
													<input
														type="text"
														required
														placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
														value={formData.upi_id}
														onChange={(e) =>
															setFormData((prev) => ({
																...prev,
																upi_id: e.target.value,
															}))
														}
														className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-emerald-400 font-mono"
													/>
												</div>
												<div>
													<label className="block text-xs font-medium text-stone-400 mb-1">
														App Nickname (Optional)
													</label>
													<input
														type="text"
														placeholder="e.g. Google Pay / PhonePe"
														value={formData.nickname}
														onChange={(e) =>
															setFormData((prev) => ({
																...prev,
																nickname: e.target.value,
															}))
														}
														className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-emerald-400"
													/>
												</div>
											</div>
										)}

										{/* BANK ACCOUNT FIELDS */}
										{activeTab === "bank_account" && (
											<div className="space-y-3">
												<div>
													<label className="block text-xs font-medium text-stone-400 mb-1">
														Bank Name *
													</label>
													<input
														type="text"
														required
														placeholder="e.g. HDFC Bank, SBI, ICICI"
														value={formData.bank_name}
														onChange={(e) =>
															setFormData((prev) => ({
																...prev,
																bank_name: e.target.value,
															}))
														}
														className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-emerald-400"
													/>
												</div>
												<div>
													<label className="block text-xs font-medium text-stone-400 mb-1">
														Account Number *
													</label>
													<input
														type="text"
														required
														placeholder="Bank Account Number"
														value={formData.account_number}
														onChange={(e) =>
															setFormData((prev) => ({
																...prev,
																account_number: e.target.value,
															}))
														}
														className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm font-mono placeholder:text-stone-600 focus:outline-none focus:border-emerald-400"
													/>
												</div>
											</div>
										)}

										{/* Default Checkbox */}
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
												className="rounded bg-black/40 border-white/[0.2] text-emerald-500 focus:ring-0"
											/>
											<span className="text-xs text-stone-300 select-none">
												Set as preferred default payment method
											</span>
										</label>

										{/* Submit & Cancel */}
										<div className="flex gap-2 pt-2">
											<button
												type="submit"
												disabled={submitting}
												className="flex-1 h-10 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-[#0d0b12] text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
											>
												{submitting ? (
													<Loader2 size={15} className="animate-spin" />
												) : (
													<Lock size={14} />
												)}
												<span>Save Account Securely</span>
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
											className="h-20 rounded-2xl bg-white/[0.04] border border-white/[0.06] animate-pulse"
										/>
									))}
								</div>
							)}

							{/* Empty state */}
							{!loading && paymentMethods.length === 0 && !showForm && (
								<div className="py-10 text-center space-y-3">
									<div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-stone-500 flex items-center justify-center mx-auto border border-white/[0.06]">
										<CreditCard size={22} />
									</div>
									<p className="text-sm font-medium text-white">
										No saved payment methods
									</p>
									<p className="text-xs text-stone-500 max-w-xs mx-auto">
										Save your credit/debit card, UPI ID, or bank account for
										seamless instant checkout.
									</p>
								</div>
							)}

							{/* Payment Accounts List */}
							{!loading && paymentMethods.length > 0 && (
								<div className="space-y-3">
									{paymentMethods.map((pm) => {
										const isCard = pm.type === "card";
										const isUpi = pm.type === "upi";

										return (
											<div
												key={pm.id}
												className={`p-4 rounded-2xl border transition-all relative ${
													pm.is_default
														? "border-emerald-400/40 bg-gradient-to-r from-emerald-400/[0.08] to-transparent shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
														: "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
												}`}
											>
												<div className="flex items-center justify-between gap-3">
													<div className="flex items-center gap-3.5 min-w-0">
														<span
															className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
																pm.is_default
																	? "bg-emerald-400/20 text-emerald-300"
																	: "bg-white/[0.06] text-stone-400"
															}`}
														>
															{isCard ? (
																<CreditCard size={18} />
															) : isUpi ? (
																<Smartphone size={18} />
															) : (
																<Building2 size={18} />
															)}
														</span>
														<div className="min-w-0">
															<div className="flex items-center gap-2">
																<span className="font-semibold text-sm text-white truncate">
																	{pm.nickname ||
																		pm.bank_or_provider ||
																		(isCard
																			? "Debit/Credit Card"
																			: isUpi
																				? "UPI Handle"
																				: "Bank Account")}
																</span>
																{pm.is_default && (
																	<span className="h-5 px-2 rounded-full bg-emerald-400/20 border border-emerald-400/30 text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
																		<Star size={9} className="fill-emerald-300" />
																		Default
																	</span>
																)}
															</div>
															<p className="mt-0.5 text-xs text-stone-300 font-mono tracking-wide">
																{pm.account_number_masked || pm.upi_id}
															</p>
															{isCard && pm.card_expiry && (
																<p className="text-[10px] text-stone-500">
																	Expires: {pm.card_expiry}
																</p>
															)}
														</div>
													</div>

													{/* Actions */}
													<div className="flex items-center gap-1 shrink-0">
														{!pm.is_default && (
															<button
																type="button"
																onClick={() => handleSetDefault(pm.id)}
																title="Set as Default"
																className="p-1.5 rounded-lg text-stone-400 hover:text-emerald-300 hover:bg-white/[0.06] transition-colors"
															>
																<Star size={14} />
															</button>
														)}
														<button
															type="button"
															onClick={() => handleDelete(pm.id)}
															title="Remove payment method"
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
							<span className="text-xs text-stone-500 flex items-center gap-1.5">
								<Lock size={12} className="text-stone-400" />
								PCI DSS compliant & secure
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
