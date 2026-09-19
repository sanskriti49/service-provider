import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
	LifeBuoy,
	Send,
	CheckCircle2,
	AlertTriangle,
	X,
	Clock,
	Tag,
	Mail,
	User,
	MessageSquare,
	ShieldCheck,
} from "lucide-react";
import { FadeLoader } from "react-spinners";
import api from "../api/axiosInstance";
import { useAuth } from "../contexts/AuthContext";
import useModal from "../hooks/useModal";

const CATEGORIES_BY_ROLE = {
	provider: [
		{ id: "kyc", label: "KYC & Identity Verification" },
		{ id: "payout", label: "Payouts, Earnings & Bank Accounts" },
		{ id: "booking_dispute", label: "Booking / Customer Dispute" },
		{ id: "service_catalog", label: "Services & Availability Settings" },
		{ id: "technical", label: "Technical App Issue / Bug" },
		{ id: "other", label: "General Provider Support" },
	],
	customer: [
		{ id: "booking", label: "Booking Scheduling & Cancellation" },
		{ id: "refund", label: "Payments, Refunds & GST Invoices" },
		{ id: "provider_dispute", label: "Service Quality / No-Show Dispute" },
		{ id: "account", label: "Account & Login Assistance" },
		{ id: "safety", label: "Safety, Security & Trust Guarantee" },
		{ id: "other", label: "General Customer Inquiry" },
	],
};

export default function SupportTicketModal({
	isOpen,
	onClose,
	defaultRole = "customer",
	defaultCategory = null,
}) {
	const { user } = useAuth();

	const activeRole = user?.role || defaultRole;

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [category, setCategory] = useState(defaultCategory || (activeRole === "provider" ? "kyc" : "booking"));
	const [priority, setPriority] = useState("normal");
	const [subject, setSubject] = useState("");
	const [message, setMessage] = useState("");

	const [loading, setLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");
	const [ticketResult, setTicketResult] = useState(null);

	const submitButtonRef = useRef(null);

	// Centralized modal stack & Escape handling
	useModal({
		isOpen,
		onClose,
		id: "support-ticket-modal",
		lockScroll: true,
		submitOnCtrlEnter: !ticketResult,
		onSubmit: () => {
			if (submitButtonRef.current) {
				submitButtonRef.current.click();
			}
		},
	});

	useEffect(() => {
		if (isOpen) {
			setErrorMsg("");
			setTicketResult(null);
			if (user) {
				setName(user.name || "");
				setEmail(user.email || "");
			}
			if (defaultCategory) {
				setCategory(defaultCategory);
			} else {
				setCategory(activeRole === "provider" ? "kyc" : "booking");
			}
		}
	}, [isOpen, user, activeRole, defaultCategory]);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setErrorMsg("");

		if (!name.trim()) {
			setErrorMsg("Please enter your name.");
			return;
		}
		if (!email.trim() || !email.includes("@")) {
			setErrorMsg("Please provide a valid contact email.");
			return;
		}
		if (!subject.trim()) {
			setErrorMsg("Please enter a short subject describing the issue.");
			return;
		}
		if (!message.trim() || message.trim().length < 10) {
			setErrorMsg("Please provide more details in your message (at least 10 characters).");
			return;
		}

		setLoading(true);
		try {
			const res = await api.post("/api/support/tickets", {
				user_id: user?.id || null,
				name: name.trim(),
				email: email.trim(),
				role: activeRole,
				category,
				priority,
				subject: subject.trim(),
				message: message.trim(),
			});

			setTicketResult(res.data);
		} catch (err) {
			console.error("Support ticket submission failed:", err);
			setErrorMsg(err.response?.data?.error || "Failed to submit ticket. Please try again or reach out on WhatsApp.");
		} finally {
			setLoading(false);
		}
	};

	if (!isOpen) return null;

	const categories = CATEGORIES_BY_ROLE[activeRole] || CATEGORIES_BY_ROLE.customer;

	const modalContent = (
		<AnimatePresence>
			<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
				{/* Backdrop */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
					className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
				/>

				{/* Modal Container */}
				<motion.div
					initial={{ opacity: 0, scale: 0.95, y: 15 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: 15 }}
					transition={{ duration: 0.2, ease: "easeOut" }}
					className="relative w-full max-w-xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto z-10"
				>
					{/* Modal Header */}
					<div className="relative px-6 sm:px-8 pt-7 pb-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-b from-slate-50/80 to-white">
						<div className="space-y-1">
							<div className="flex items-center gap-2.5">
								<div className="p-2 rounded-xl bg-violet-100 text-violet-700">
									<LifeBuoy className="w-5 h-5" />
								</div>
								<h2 className="font-mackinac text-2xl font-black text-slate-900 tracking-tight">
									{ticketResult ? "Ticket Submitted" : "Open Support Ticket"}
								</h2>
							</div>
							<p className="bricolage-grotesque text-xs sm:text-sm text-slate-500">
								{activeRole === "provider"
									? "Dedicated partner assistance for verification, payouts, and customer disputes."
									: "Direct support assistance for bookings, cancellations, and quality guarantees."}
							</p>
						</div>

						<button
							onClick={onClose}
							className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
							title="Close (Esc)"
						>
							<X className="w-5 h-5" />
						</button>
					</div>

					{/* Modal Body */}
					<div className="px-6 sm:px-8 py-6 max-h-[70vh] overflow-y-auto">
						{ticketResult ? (
							/* SUCCESS CONFIRMATION VIEW */
							<div className="space-y-6 py-3 text-center">
								<div className="inline-flex p-4 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs">
									<CheckCircle2 className="w-12 h-12" />
								</div>

								<div className="space-y-2">
									<h3 className="font-mackinac text-2xl font-bold text-slate-900">
										Support Ticket Generated
									</h3>
									<div className="inline-block px-4 py-1.5 rounded-full bg-violet-100 text-violet-800 font-mono text-sm font-black tracking-wider">
										#{ticketResult.ticket_number}
									</div>
									<p className="bricolage-grotesque text-sm text-slate-600 max-w-md mx-auto pt-1">
										Your request has been routed to our priority operations queue. You will receive an email update at <strong>{email}</strong>.
									</p>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left">
									<div>
										<span className="text-[10px] font-bold uppercase text-slate-400 block">
											Response SLA
										</span>
										<span className="text-xs font-bold text-slate-800 flex items-center gap-1 mt-0.5">
											<Clock className="w-3.5 h-3.5 text-violet-600" /> Under 2 to 4 Hours
										</span>
									</div>
									<div>
										<span className="text-[10px] font-bold uppercase text-slate-400 block">
											Notification
										</span>
										<span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
											<ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> In-App Alert Dispatched
										</span>
									</div>
								</div>

								<button
									type="button"
									onClick={onClose}
									className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
								>
									Done
								</button>
							</div>
						) : (
							/* TICKET SUBMISSION FORM */
							<form onSubmit={handleSubmit} className="space-y-5">
								{errorMsg && (
									<div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
										<AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
										<span>{errorMsg}</span>
									</div>
								)}

								{/* Name & Email inputs */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div>
										<label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
											Full Name *
										</label>
										<div className="relative">
											<User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
											<input
												type="text"
												value={name}
												onChange={(e) => setName(e.target.value)}
												placeholder="Your Name"
												className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
												required
											/>
										</div>
									</div>

									<div>
										<label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
											Contact Email *
										</label>
										<div className="relative">
											<Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
											<input
												type="email"
												value={email}
												onChange={(e) => setEmail(e.target.value)}
												placeholder="you@domain.com"
												className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
												required
											/>
										</div>
									</div>
								</div>

								{/* Category Selection */}
								<div>
									<label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
										Issue Category *
									</label>
									<div className="relative">
										<Tag className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
										<select
											value={category}
											onChange={(e) => setCategory(e.target.value)}
											className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 cursor-pointer"
										>
											{categories.map((c) => (
												<option key={c.id} value={c.id}>
													{c.label}
												</option>
											))}
										</select>
									</div>
								</div>

								{/* Priority Selector */}
								<div>
									<label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
										Priority Level
									</label>
									<div className="grid grid-cols-2 gap-3">
										<button
											type="button"
											onClick={() => setPriority("normal")}
											className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
												priority === "normal"
													? "bg-slate-100 border-slate-400 text-slate-900 shadow-xs"
													: "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
											}`}
										>
											Standard Priority
										</button>
										<button
											type="button"
											onClick={() => setPriority("urgent")}
											className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
												priority === "urgent"
													? "bg-rose-50 border-rose-500 text-rose-700 shadow-xs"
													: "bg-white border-slate-200 text-slate-500 hover:border-rose-300"
											}`}
										>
											🚨 Urgent (Ongoing Booking)
										</button>
									</div>
								</div>

								{/* Subject */}
								<div>
									<label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
										Subject *
									</label>
									<input
										type="text"
										value={subject}
										onChange={(e) => setSubject(e.target.value)}
										placeholder="e.g. Need verification review for Aadhaar document"
										className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
										required
									/>
								</div>

								{/* Message */}
								<div>
									<label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
										Detailed Description *
									</label>
									<div className="relative">
										<textarea
											rows={4}
											value={message}
											onChange={(e) => setMessage(e.target.value)}
											placeholder="Please provide any relevant details (booking IDs, date, explanation of what happened)..."
											className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
											required
										/>
									</div>
								</div>

								{/* Actions */}
								<div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
									<div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
										<span>Press</span>
										<kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600 font-semibold">
											Esc
										</kbd>
										<span>to close •</span>
										<kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600 font-semibold">
											Ctrl+Enter
										</kbd>
										<span>to submit</span>
									</div>

									<div className="flex items-center gap-2 ml-auto">
										<button
											type="button"
											onClick={onClose}
											className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
										>
											Cancel
										</button>
										<button
											type="submit"
											ref={submitButtonRef}
											disabled={loading}
											className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-violet-900/20 transition-all flex items-center gap-2 cursor-pointer"
										>
											{loading ? (
												<>
													<span className="inline-flex items-center justify-center w-4 h-4 scale-[0.35] origin-center -mx-1">
														<FadeLoader color="#ffffff" />
													</span>
													Submitting...
												</>
											) : (
												<>
													<Send className="w-4 h-4" />
													Submit Ticket
												</>
											)}
										</button>
									</div>
								</div>
							</form>
						)}
					</div>
				</motion.div>
			</div>
		</AnimatePresence>
	);

	return createPortal(modalContent, document.body);
}
