import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
	AlertTriangle,
	Hourglass,
	CheckCircle2,
	RotateCw,
	CreditCard,
	Clock,
	XCircle,
	ArrowRight,
	Copy,
	Check,
	LifeBuoy,
	ShieldCheck,
	Calendar,
	Sparkles,
	ExternalLink,
	RefreshCw,
	HelpCircle,
	Tag,
} from "lucide-react";
import api from "../../api/axiosInstance";
import { useAuth } from "../../contexts/AuthContext";
import SupportTicketModal from "../../ui/SupportTicketModal";
import ServiceIllustration from "../../ui/ServiceIllustration";

const formatINR = (n) => {
	if (n === null || n === undefined || isNaN(n)) return "Amount under review";
	const num = Number(n);
	const hasPaise = num % 1 !== 0;
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: hasPaise ? 2 : 0,
		maximumFractionDigits: 2,
	}).format(num);
};

function formatCountdown(seconds) {
	if (seconds <= 0) return "Expired";
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const loadRazorpayScript = () =>
	new Promise((resolve) => {
		if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
		const script = document.createElement("script");
		script.src = "https://checkout.razorpay.com/v1/checkout.js";
		script.onload = () => resolve(true);
		script.onerror = () => resolve(false);
		document.body.appendChild(script);
	});

export default function BookingPaymentRecovery({
	initialData = null,
	onRecoveryDataChange = null,
	onOpenTicketModal = null,
	onRecoveryCountChange = null,
}) {
	const navigate = useNavigate();
	const { user } = useAuth();

	const [loading, setLoading] = useState(!initialData);
	const [refreshing, setRefreshing] = useState(false);
	const [recoveryData, setRecoveryData] = useState(
		initialData || {
			interrupted_checkouts: [],
			refunds: [],
			summary: {
				interrupted_count: 0,
				active_holds_count: 0,
				pending_refunds_count: 0,
				failed_refunds_count: 0,
				uncertain_refunds_count: 0,
				total_refund_amount_pending: 0,
				has_actionable_items: false,
			},
		},
	);

	// Sub-section filter: 'all' | 'checkouts' | 'refunds'
	const [activeSection, setActiveSection] = useState("all");
	const [refundFilter, setRefundFilter] = useState("all"); // 'all' | 'pending' | 'failed' | 'processed'
	const [refundPage, setRefundPage] = useState(1);
	const REFUNDS_PER_PAGE = 5;

	// Reset page when filter changes
	useEffect(() => {
		setRefundPage(1);
	}, [refundFilter, activeSection]);

	// Local state for actions
	const [resumingBookingId, setResumingBookingId] = useState(null);
	const [reconcilingRefundId, setReconcilingRefundId] = useState(null);
	const [releasingBookingId, setReleasingBookingId] = useState(null);
	const [copiedKey, setCopiedKey] = useState(null);

	// Support Ticket prefill modal state
	const [supportModalOpen, setSupportModalOpen] = useState(false);
	const [supportCategory, setSupportCategory] = useState("refund");
	const [supportSubject, setSupportSubject] = useState("");
	const [supportMessage, setSupportMessage] = useState("");

	// 1. Fetch Recovery Items
	const fetchRecoveryData = useCallback(async (isSilent = false) => {
		if (!isSilent) setLoading(true);
		else setRefreshing(true);

		try {
			const res = await api.get("/api/bookings/recovery/items");
			if (res.data?.success) {
				setRecoveryData(res.data);
				if (onRecoveryDataChange) onRecoveryDataChange(res.data);
				if (onRecoveryCountChange) {
					const count =
						(res.data.summary?.active_holds_count || 0) +
						(res.data.summary?.failed_refunds_count || 0) +
						(res.data.summary?.uncertain_refunds_count || 0);
					onRecoveryCountChange(count);
				}
			}
		} catch (err) {
			console.error("Failed to load recovery items:", err);
			toast.error("Could not load payment recovery data.");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, [onRecoveryDataChange, onRecoveryCountChange]);

	useEffect(() => {
		fetchRecoveryData();
	}, [fetchRecoveryData]);

	// Live Countdown Tick for Active Holds (anchored to hold_expires_at timestamp to avoid drift)
	useEffect(() => {
		const interval = setInterval(() => {
			setRecoveryData((prev) => {
				let changed = false;
				const now = Date.now();
				const updatedCheckouts = prev.interrupted_checkouts.map((item) => {
					if (!item.hold_expires_at) return item;
					const expiryMs = new Date(item.hold_expires_at).getTime();
					if (isNaN(expiryMs)) return item;
					const remaining = Math.max(0, Math.floor((expiryMs - now) / 1000));
					const isActive = remaining > 0 && item.booking_status === "pending";
					if (remaining !== item.seconds_remaining || isActive !== item.is_hold_active) {
						changed = true;
						return {
							...item,
							seconds_remaining: remaining,
							is_hold_active: isActive,
						};
					}
					return item;
				});

				if (!changed) return prev;
				return {
					...prev,
					interrupted_checkouts: updatedCheckouts,
					summary: {
						...prev.summary,
						active_holds_count: updatedCheckouts.filter((c) => c.is_hold_active).length,
					},
				};
			});
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	// Copy to clipboard helper
	const handleCopy = (text, key) => {
		if (!text) return;
		navigator.clipboard.writeText(text);
		setCopiedKey(key);
		setTimeout(() => setCopiedKey(null), 2000);
		toast.success("Copied reference to clipboard");
	};

	// 2. Resume Checkout Handler
	const handleResumeCheckout = async (checkout) => {
		setResumingBookingId(checkout.booking_id);
		try {
			const res = await api.post(`/api/bookings/${checkout.booking_id}/resume-checkout`);
			if (!res.data?.can_pay) {
				toast.error(res.data?.message || "Slot is no longer available. Please choose another time slot.");
				fetchRecoveryData(true);
				return;
			}

			const orderId = res.data.razorpay_order;
			const ok = await loadRazorpayScript();
			if (!ok) {
				toast.error("Could not load payment gateway. Please check your internet connection.");
				return;
			}

			const rzpKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
			const rzpAmount = Math.round(Number(checkout.price) * 100);

			const rzpOptions = {
				key: rzpKey,
				amount: rzpAmount,
				currency: "INR",
				name: "TaskGenie",
				description: `Payment for ${checkout.service_name || "Home Service"}`,
				order_id: orderId,
				handler: async (response) => {
					try {
						toast.loading("Verifying transaction...");
						const verifyRes = await api.post("/api/bookings/verify-payment", {
							...response,
							razorpay_order_id: response.razorpay_order_id || orderId,
							booking_id: checkout.booking_id,
						});

						toast.dismiss();
						if (verifyRes.data?.refund_pending) {
							toast.error("Payment received, but slot hold had expired. Your refund is being processed.");
							fetchRecoveryData(true);
							return;
						}

						if (verifyRes.data?.booking) {
							toast.success("Payment completed successfully!");
							navigate("/booking-success", {
								state: {
									success: true,
									booking: verifyRes.data.booking,
									address: checkout.address,
								},
								replace: true,
							});
						} else {
							toast.error("Payment verification failed. Please contact support.");
							fetchRecoveryData(true);
						}
					} catch (verErr) {
						toast.dismiss();
						console.error("Verification error:", verErr);
						toast.warning("Payment confirmation pending. Please do not re-pay. We are reconciling status with the payment gateway.");
						fetchRecoveryData(true);
					}
				},
				modal: {
					ondismiss: () => {
						toast("Payment paused. You can resume checkout anytime while your hold is active.");
						fetchRecoveryData(true);
					},
				},
				prefill: {
					name: user?.name || "Customer",
					email: user?.email || "customer@taskgenie.com",
					contact: user?.phone || "+919876543210",
				},
				theme: { color: "#7c3aed" },
			};

			const rzp = new window.Razorpay(rzpOptions);
			rzp.on("payment.failed", (failedRes) => {
				const desc = failedRes.error?.description || "Payment declined";
				toast.error(`Payment failed: ${desc}. Try UPI or another card.`);
			});
			rzp.open();
		} catch (err) {
			console.error("Resume checkout error:", err);
			const msg = err.response?.data?.message || "Failed to resume checkout.";
			toast.error(msg);
			fetchRecoveryData(true);
		} finally {
			setResumingBookingId(null);
		}
	};

	// 3. Cancel & Release Unpaid Booking Slot
	const handleReleaseSlot = async (bookingId) => {
		setReleasingBookingId(bookingId);
		try {
			await api.delete(`/api/bookings/${bookingId}/unpaid`);
			toast.success("Held slot released successfully.");
			fetchRecoveryData(true);
		} catch (err) {
			console.error("Failed to release slot:", err);
			toast.error(err.response?.data?.message || "Could not release slot.");
		} finally {
			setReleasingBookingId(null);
		}
	};

	// 4. Reconcile Customer Refund Live
	const handleReconcileRefund = async (refundId, canReconcile = true) => {
		if (canReconcile === false || String(refundId).startsWith("synth-")) {
			toast.error("Direct gateway check is not available for this adjustment. Please contact support.");
			return;
		}
		setReconcilingRefundId(refundId);
		try {
			const res = await api.post(`/api/bookings/recovery/reconcile-refund/${refundId}`);
			if (res.data?.synced) {
				toast.success("Refund status verified with payment gateway.");
			} else {
				toast.warning(res.data?.message || "Gateway unavailable. Showing last recorded status.");
			}
			fetchRecoveryData(true);
		} catch (err) {
			console.error("Reconcile error:", err);
			const msg = err.response?.data?.message || "Could not sync live refund status. Try again shortly.";
			toast.warning(msg);
			fetchRecoveryData(true);
		} finally {
			setReconcilingRefundId(null);
		}
	};

	// 5. Open Prefilled Support Ticket
	const handleOpenTicketForRefund = (refund) => {
		const subject = `Refund inquiry: ${refund.service_name} (Booking #${refund.booking_id.slice(0, 8)})`;
		const message = `Hello Support Team,\n\nI need assistance regarding my refund:\n- Service: ${refund.service_name}\n- Provider: ${refund.provider_name}\n- Amount: ${formatINR(refund.amount_inr)}\n- Current Status: ${refund.status_label}\n- Gateway Refund ID: ${refund.gateway_refund_id || "Pending"}\n- Payment ID: ${refund.payment_id || "N/A"}\n${refund.last_error ? `- Note / Error: ${refund.last_error}\n` : ""}\nPlease review the status. Thank you.`;

		setSupportCategory("refund");
		setSupportSubject(subject);
		setSupportMessage(message);

		if (onOpenTicketModal) {
			onOpenTicketModal({
				category: "refund",
				subject,
				message,
			});
		} else {
			setSupportModalOpen(true);
		}
	};

	// Filtered Refunds & Pagination
	const filteredRefunds = useMemo(() => {
		if (refundFilter === "all") return recoveryData.refunds;
		if (refundFilter === "pending") return recoveryData.refunds.filter((r) => r.is_pending);
		if (refundFilter === "failed") return recoveryData.refunds.filter((r) => r.is_failed || r.is_uncertain);
		if (refundFilter === "processed") return recoveryData.refunds.filter((r) => r.is_processed);
		return recoveryData.refunds;
	}, [recoveryData.refunds, refundFilter]);

	const totalRefundPages = Math.max(1, Math.ceil(filteredRefunds.length / REFUNDS_PER_PAGE));
	const paginatedRefunds = useMemo(() => {
		const start = (refundPage - 1) * REFUNDS_PER_PAGE;
		return filteredRefunds.slice(start, start + REFUNDS_PER_PAGE);
	}, [filteredRefunds, refundPage]);

	if (loading) {
		return (
			<div className="py-20 text-center space-y-3">
				<div className="w-9 h-9 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
				<p className="text-xs text-stone-400">Loading payment recovery items...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Top Summary Bar */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				{/* 1. Interrupted Holds Card */}
				<div className="p-4 rounded-2xl bg-[#120a22]/80 border border-violet-500/20 backdrop-blur-md relative overflow-hidden">
					<div className="flex items-center justify-between text-xs text-stone-400">
						<span className="font-medium uppercase tracking-wider text-[11px] flex items-center gap-1.5">
							<Clock size={14} className="text-amber-400" />
							Interrupted Checkouts
						</span>
						{recoveryData.summary.active_holds_count > 0 && (
							<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20 animate-pulse">
								{recoveryData.summary.active_holds_count} Active Hold
							</span>
						)}
					</div>
					<div className="mt-2 flex items-baseline justify-between">
						<div className="font-mackinac text-2xl font-bold text-white">
							{recoveryData.summary.interrupted_count}
						</div>
						<span className="text-xs text-stone-400">
							{recoveryData.summary.active_holds_count > 0 ? "Holds reserving your slot" : "No active holds"}
						</span>
					</div>
				</div>

				{/* 2. In-Flight Refunds Card */}
				<div className="p-4 rounded-2xl bg-[#120a22]/80 border border-sky-500/20 backdrop-blur-md">
					<div className="flex items-center justify-between text-xs text-stone-400">
						<span className="font-medium uppercase tracking-wider text-[11px] flex items-center gap-1.5">
							<Hourglass size={14} className="text-sky-400" />
							Pending Refunds
						</span>
						<span className="text-[11px] font-medium text-sky-300 font-mono">
							{formatINR(recoveryData.summary.total_refund_amount_pending)}
						</span>
					</div>
					<div className="mt-2 flex items-baseline justify-between">
						<div className="font-mackinac text-2xl font-bold text-white">
							{recoveryData.summary.pending_refunds_count}
						</div>
						<span className="text-xs text-stone-400">Processing in 5–7 days</span>
					</div>
				</div>

				{/* 3. Action Required Card */}
				<div
					className={`p-4 rounded-2xl border backdrop-blur-md transition-all ${
						recoveryData.summary.failed_refunds_count > 0 || recoveryData.summary.uncertain_refunds_count > 0
							? "bg-rose-950/20 border-rose-500/30"
							: "bg-[#120a22]/80 border-emerald-500/20"
					}`}
				>
					<div className="flex items-center justify-between text-xs text-stone-400">
						<span className="font-medium uppercase tracking-wider text-[11px] flex items-center gap-1.5">
							{recoveryData.summary.failed_refunds_count > 0 ? (
								<AlertTriangle size={14} className="text-rose-400" />
							) : (
								<ShieldCheck size={14} className="text-emerald-400" />
							)}
							Action Required
						</span>
						<button
							type="button"
							onClick={() => fetchRecoveryData(true)}
							disabled={refreshing}
							className="text-[11px] text-stone-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
							title="Refresh status"
						>
							<RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
							Sync
						</button>
					</div>
					<div className="mt-2 flex items-baseline justify-between">
						<div
							className={`font-mackinac text-2xl font-bold ${
								recoveryData.summary.failed_refunds_count > 0 ? "text-rose-300" : "text-emerald-300"
							}`}
						>
							{recoveryData.summary.failed_refunds_count + recoveryData.summary.uncertain_refunds_count}
						</div>
						<span className="text-xs text-stone-400">
							{recoveryData.summary.failed_refunds_count > 0
								? "Failed bank returns"
								: "All refunds in good standing"}
						</span>
					</div>
				</div>
			</div>

			{/* Filter Tabs Bar */}
			<div className="flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => setActiveSection("all")}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
							activeSection === "all"
								? "bg-violet-600 text-white font-semibold"
								: "text-stone-400 hover:text-white"
						}`}
					>
						All Recovery Items ({recoveryData.interrupted_checkouts.length + recoveryData.refunds.length})
					</button>
					<button
						type="button"
						onClick={() => setActiveSection("checkouts")}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
							activeSection === "checkouts"
								? "bg-violet-600 text-white font-semibold"
								: "text-stone-400 hover:text-white"
						}`}
					>
						Interrupted Checkouts ({recoveryData.interrupted_checkouts.length})
					</button>
					<button
						type="button"
						onClick={() => setActiveSection("refunds")}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
							activeSection === "refunds"
								? "bg-violet-600 text-white font-semibold"
								: "text-stone-400 hover:text-white"
						}`}
					>
						Refund Status Center ({recoveryData.refunds.length})
					</button>
				</div>

				{activeSection !== "checkouts" && (
					<div className="flex items-center gap-1.5 text-xs">
						<span className="text-stone-500 text-[11px] uppercase tracking-wider mr-1">Status:</span>
						{["all", "pending", "failed", "processed"].map((filterKey) => (
							<button
								key={filterKey}
								type="button"
								onClick={() => setRefundFilter(filterKey)}
								className={`px-2.5 py-1 rounded-md text-[11px] capitalize transition-colors cursor-pointer ${
									refundFilter === filterKey
										? "bg-white/10 text-white font-bold"
										: "text-stone-400 hover:text-stone-200"
								}`}
							>
								{filterKey}
							</button>
						))}
					</div>
				)}
			</div>

			{/* SECTION 1: Interrupted Checkouts */}
			{(activeSection === "all" || activeSection === "checkouts") && (
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-bold text-white flex items-center gap-2">
							<CreditCard size={16} className="text-violet-400" />
							Interrupted Checkouts
						</h3>
						<span className="text-[11px] text-stone-400">
							Resume online booking without losing your reserved slot
						</span>
					</div>

					{recoveryData.interrupted_checkouts.length === 0 ? (
						<div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#120a22]/50 p-5 text-center sm:flex-row sm:gap-6 sm:px-7 sm:text-left">
							<ServiceIllustration scene="checkout" className="w-36 h-auto shrink-0 sm:w-44" />
							<div className="space-y-1.5">
								<p className="text-sm font-bold text-stone-200">No interrupted checkouts</p>
								<p className="text-xs leading-relaxed text-stone-400">
									All online checkout attempts have either been completed or cleanly released.
								</p>
							</div>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{recoveryData.interrupted_checkouts.map((checkout) => (
								<div
									key={checkout.booking_id}
									className={`p-4 rounded-2xl border transition-all ${
										checkout.is_hold_active
											? "bg-gradient-to-br from-violet-950/30 to-[#120a22] border-violet-500/30 shadow-lg shadow-violet-950/20"
											: "bg-[#120a22]/80 border-white/[0.08]"
									}`}
								>
									{/* Top Meta Bar */}
									<div className="flex items-start justify-between gap-2 pb-3 border-b border-white/[0.06]">
										<div>
											<span className="text-[10px] font-mono text-stone-400 block">
												#{checkout.booking_id.slice(0, 8)}
											</span>
											<h4 className="text-sm font-bold text-white mt-0.5">
												{checkout.service_name}
											</h4>
											<p className="text-xs text-stone-400 mt-0.5">
												Provider: <span className="text-stone-200">{checkout.provider_name}</span>
											</p>
										</div>

										<div className="text-right">
											<div className="font-mackinac text-base font-bold text-white">
												{formatINR(checkout.price)}
											</div>
											{checkout.is_hold_active ? (
												<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20 mt-1">
													<span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
													Hold: {formatCountdown(checkout.seconds_remaining)}
												</span>
											) : (
												<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-500/10 text-stone-400 border border-stone-500/20 mt-1">
													Hold expired
												</span>
											)}
										</div>
									</div>

									{/* Schedule & Address Details */}
									<div className="py-3 grid grid-cols-2 gap-2 text-xs text-stone-300">
										<div>
											<span className="text-[10px] uppercase tracking-wider text-stone-500 block">
												Date & Time
											</span>
											<span className="font-medium mt-0.5 block">
												{checkout.date} • {checkout.start_time.slice(0, 5)}
											</span>
										</div>
										<div>
											<span className="text-[10px] uppercase tracking-wider text-stone-500 block">
												Location
											</span>
											<span className="truncate block font-medium mt-0.5 text-stone-300">
												{checkout.address}
											</span>
										</div>
									</div>

									{/* Actions */}
									<div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
										<button
											type="button"
											onClick={() => handleReleaseSlot(checkout.booking_id)}
											disabled={releasingBookingId === checkout.booking_id}
											className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-stone-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
										>
											{releasingBookingId === checkout.booking_id ? "Releasing..." : "Release Slot"}
										</button>

										<button
											type="button"
											onClick={() => handleResumeCheckout(checkout)}
											disabled={resumingBookingId === checkout.booking_id}
											className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold shadow-md shadow-violet-950/50 flex items-center gap-1.5 transition-all cursor-pointer"
										>
											{resumingBookingId === checkout.booking_id ? (
												<>
													<span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
													Resuming...
												</>
											) : (
												<>
													<CreditCard size={13} />
													{checkout.is_hold_active ? "Complete Payment" : "Re-check Slot & Pay"}
												</>
											)}
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* SECTION 2: Refund Status Center */}
			{(activeSection === "all" || activeSection === "refunds") && (
				<div className="space-y-3 pt-2">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-bold text-white flex items-center gap-2">
							<Hourglass size={16} className="text-sky-400" />
							Refund Status Center
						</h3>
						<span className="text-[11px] text-stone-400">
							Real-time status for expired holds, disputes, and cancellations
						</span>
					</div>

					{filteredRefunds.length === 0 ? (
						<div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#120a22]/50 p-5 text-center sm:flex-row sm:gap-6 sm:px-7 sm:text-left">
							<ServiceIllustration scene="paperTrail" className="w-36 h-auto shrink-0 sm:w-44" />
							<div className="space-y-1.5">
								<p className="text-sm font-bold text-stone-200">No refunds matching filter</p>
								<p className="text-xs leading-relaxed text-stone-400">
									{refundFilter === "all"
										? "You currently have no pending or completed refunds."
										: `No refunds with status '${refundFilter}'.`}
								</p>
							</div>
						</div>
					) : (
						<div className="space-y-3">
							{paginatedRefunds.map((refund) => (
								<div
									key={refund.refund_id}
									className={`p-4 rounded-2xl border transition-all ${
										refund.is_failed
											? "bg-rose-950/15 border-rose-500/30"
											: refund.is_uncertain
												? "bg-purple-950/20 border-purple-500/30"
												: refund.is_processed
													? "bg-[#120a22]/70 border-emerald-500/20"
													: "bg-[#120a22]/90 border-sky-500/20"
									}`}
								>
									{/* Top Bar */}
									<div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-white/[0.06]">
										<div>
											<div className="flex items-center gap-2">
												<h4 className="text-sm font-bold text-white">
													{refund.service_name}
												</h4>
												<span className="text-[10px] font-mono text-stone-400">
													Booking #{refund.booking_id.slice(0, 8)}
												</span>
											</div>
											<p className="text-xs text-stone-400 mt-0.5">
												Reason: <span className="text-stone-200">{refund.reason_label}</span>
											</p>
										</div>

										<div className="flex items-center gap-3">
											<div className="text-right">
												<div
													className={`font-mackinac text-base font-bold ${
														refund.is_amount_unknown ? "text-amber-300 text-xs italic font-normal" : "text-white"
													}`}
												>
													{formatINR(refund.amount_inr)}
												</div>
												{refund.is_amount_unknown && (
													<span className="text-[10px] text-amber-300/80 block">
														Balance pending audit
													</span>
												)}
												<span className="text-[10px] text-stone-400 block">
													{new Date(refund.created_at).toLocaleDateString("en-IN", {
														day: "numeric",
														month: "short",
														year: "numeric",
													})}
												</span>
											</div>

											{/* Status Badge */}
											{refund.is_processed && (
												<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
													<CheckCircle2 size={13} />
													Refunded
												</span>
											)}
											{refund.is_pending && (
												<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
													<Hourglass size={13} className="animate-spin text-sky-300" />
													Processing
												</span>
											)}
											{refund.is_failed && (
												<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
													<AlertTriangle size={13} />
													Failed at Bank
												</span>
											)}
											{refund.is_uncertain && (
												<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
													<HelpCircle size={13} />
													Under Review
												</span>
											)}
										</div>
									</div>

									{/* Banking Rail Details */}
									<div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
										<div>
											<span className="text-[10px] uppercase tracking-wider text-stone-500 block">
												Gateway Refund ID
											</span>
											{refund.gateway_refund_id ? (
												<div className="flex items-center gap-1 mt-0.5">
													<span className="font-mono text-stone-200 select-all">
														{refund.gateway_refund_id}
													</span>
													<button
														type="button"
														onClick={() => handleCopy(refund.gateway_refund_id, refund.refund_id)}
														className="text-stone-400 hover:text-white p-0.5 cursor-pointer"
														title="Copy reference"
													>
														{copiedKey === refund.refund_id ? (
															<Check size={11} className="text-emerald-400" />
														) : (
															<Copy size={11} />
														)}
													</button>
												</div>
											) : (
												<span className="text-stone-500 font-mono mt-0.5 block">
													Pending issuance
												</span>
											)}
										</div>

										<div>
											<span className="text-[10px] uppercase tracking-wider text-stone-500 block">
												Original Payment Ref
											</span>
											<span className="font-mono text-stone-200 mt-0.5 block truncate select-all">
												{refund.payment_id || "N/A"}
											</span>
										</div>

										<div>
											<span className="text-[10px] uppercase tracking-wider text-stone-500 block">
												Estimated Timeline
											</span>
											<span className="text-stone-200 mt-0.5 block font-medium">
												{refund.is_processed
													? "Credited to original source account"
													: refund.is_failed
														? "Action required with bank / support"
														: "5 to 7 working days via banking rails"}
											</span>
										</div>
									</div>

									{/* Failure or Review Callout Note */}
									{(refund.last_error || refund.is_uncertain || refund.is_failed) && (
										<div className="mb-3 p-3 rounded-xl bg-black/40 border border-rose-500/20 text-xs flex items-start gap-2.5">
											<AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
											<div className="space-y-0.5">
												<span className="font-bold text-rose-300 block">
													{refund.is_failed ? "Gateway Notice:" : "Status Note:"}
												</span>
												<p className="text-stone-300 leading-relaxed text-[11px]">
													{refund.last_error ||
														"The gateway response is being reconciled. If your balance hasn't updated after 7 days, open a support ticket."}
												</p>
											</div>
										</div>
									)}

									{/* Action Footer */}
									<div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
										<span className="text-[11px] text-stone-500">
											Status: <strong className="text-stone-300">{refund.status_label}</strong>
										</span>

										<div className="flex items-center gap-2">
											{refund.can_reconcile !== false ? (
												<button
													type="button"
													onClick={() => handleReconcileRefund(refund.refund_id, refund.can_reconcile)}
													disabled={reconcilingRefundId === refund.refund_id}
													className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-stone-300 hover:text-white hover:bg-white/[0.04] transition-colors flex items-center gap-1.5 cursor-pointer"
												>
													<RotateCw
														size={12}
														className={reconcilingRefundId === refund.refund_id ? "animate-spin" : ""}
													/>
													Check Live Status
												</button>
											) : (
												<span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] font-medium text-amber-300 flex items-center gap-1.5">
													<AlertTriangle size={12} />
													Review required (no gateway ID)
												</span>
											)}

											{(refund.is_failed || refund.is_uncertain || !refund.is_processed || refund.is_synthetic) && (
												<button
													type="button"
													onClick={() => handleOpenTicketForRefund(refund)}
													className="px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs font-bold text-sky-300 hover:bg-sky-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
												>
													<LifeBuoy size={12} />
													Need Help?
												</button>
											)}
										</div>
									</div>
								</div>
							))}

							{/* Pagination Controls */}
							{totalRefundPages > 1 && (
								<div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-stone-400">
									<span>
										Showing {(refundPage - 1) * REFUNDS_PER_PAGE + 1}–{Math.min(refundPage * REFUNDS_PER_PAGE, filteredRefunds.length)} of {filteredRefunds.length} refunds
									</span>
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => setRefundPage((p) => Math.max(1, p - 1))}
											disabled={refundPage === 1}
											className="px-2.5 py-1 rounded-md border border-white/10 text-stone-300 hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
										>
											Previous
										</button>
										<span className="text-stone-300 font-mono text-[11px]">
											{refundPage} / {totalRefundPages}
										</span>
										<button
											type="button"
											onClick={() => setRefundPage((p) => Math.min(totalRefundPages, p + 1))}
											disabled={refundPage === totalRefundPages}
											className="px-2.5 py-1 rounded-md border border-white/10 text-stone-300 hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
										>
											Next
										</button>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{/* Support Ticket Modal for Customer Inquiries */}
			<SupportTicketModal
				isOpen={supportModalOpen}
				onClose={() => setSupportModalOpen(false)}
				defaultRole="customer"
				defaultCategory={supportCategory}
				defaultSubject={supportSubject}
				defaultMessage={supportMessage}
			/>
		</div>
	);
}
