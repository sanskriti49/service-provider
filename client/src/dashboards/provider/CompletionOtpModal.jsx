import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, KeyRound, AlertCircle, Loader2, X, CheckCircle2 } from "lucide-react";

export default function CompletionOtpModal({
	isOpen,
	onClose,
	onConfirm,
	booking,
	loading = false,
}) {
	const [otpDigits, setOtpDigits] = useState(["", "", "", ""]);
	const [error, setError] = useState("");
	const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

	useEffect(() => {
		if (isOpen) {
			setOtpDigits(["", "", "", ""]);
			setError("");
			setTimeout(() => {
				inputRefs[0].current?.focus();
			}, 100);
		}
	}, [isOpen]);

	if (!isOpen || !booking) return null;

	const handleDigitChange = (index, value) => {
		setError("");
		// Allow paste of full 4-digit code into any box
		const sanitized = value.replace(/\D/g, "");
		if (sanitized.length > 1) {
			const chars = sanitized.slice(0, 4).split("");
			const newDigits = ["", "", "", ""];
			chars.forEach((char, i) => {
				newDigits[i] = char;
			});
			setOtpDigits(newDigits);
			const nextFocus = Math.min(chars.length, 3);
			inputRefs[nextFocus].current?.focus();
			return;
		}

		const newDigits = [...otpDigits];
		newDigits[index] = sanitized;
		setOtpDigits(newDigits);

		if (sanitized && index < 3) {
			inputRefs[index + 1].current?.focus();
		}
	};

	const handleKeyDown = (index, e) => {
		if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
			inputRefs[index - 1].current?.focus();
		}
	};

	const handleSubmit = (e) => {
		e?.preventDefault();
		const fullOtp = otpDigits.join("");
		if (fullOtp.length !== 4) {
			setError("Please enter the complete 4-digit OTP provided by the customer.");
			return;
		}
		onConfirm(fullOtp, setError);
	};

	return createPortal(
		<AnimatePresence>
			<div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
				{/* Backdrop */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={loading ? undefined : onClose}
					className="fixed inset-0 bg-black/80 backdrop-blur-sm"
				/>

				{/* Modal Container */}
				<motion.div
					initial={{ opacity: 0, scale: 0.95, y: 10 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: 10 }}
					transition={{ type: "spring", damping: 25, stiffness: 300 }}
					className="relative w-full max-w-md bg-[#120b24] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden bricolage-grotesque z-10"
				>
					{/* Close Button */}
					{!loading && (
						<button
							onClick={onClose}
							className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
						>
							<X size={16} />
						</button>
					)}

					{/* Header Icon & Title */}
					<div className="flex items-center gap-3 mb-4">
						<div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
							<ShieldCheck size={24} />
						</div>
						<div>
							<h3 className="text-lg font-bold text-white tracking-tight">
								Verify Job Completion
							</h3>
							<p className="text-xs text-slate-400">
								4-Digit Customer Handshake Code
							</p>
						</div>
					</div>

					{/* Booking Summary Box */}
					<div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 mb-5 space-y-1">
						<div className="flex justify-between text-xs">
							<span className="text-slate-400">Service:</span>
							<span className="text-white font-medium truncate max-w-[200px]">
								{booking.service_name || "Job Service"}
							</span>
						</div>
						<div className="flex justify-between text-xs">
							<span className="text-slate-400">Customer:</span>
							<span className="text-white font-medium">
								{booking.customer_name || "Valued Client"}
							</span>
						</div>
					</div>

					{/* Instructions */}
					<p className="text-xs text-slate-300 leading-relaxed mb-4">
						Please ask the customer for the <strong className="text-violet-300">4-digit Completion OTP</strong> displayed in their customer dashboard to finalize this booking and verify completed work.
					</p>

					{/* OTP Inputs Form */}
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="flex justify-center gap-3">
							{otpDigits.map((digit, idx) => (
								<input
									key={idx}
									ref={inputRefs[idx]}
									type="text"
									inputMode="numeric"
									maxLength={idx === 0 ? 4 : 1}
									value={digit}
									disabled={loading}
									onChange={(e) => handleDigitChange(idx, e.target.value)}
									onKeyDown={(e) => handleKeyDown(idx, e)}
									className="w-14 h-14 text-center text-2xl font-mono font-bold text-white bg-slate-950/60 border border-white/10 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all disabled:opacity-50"
									autoComplete="one-time-code"
								/>
							))}
						</div>

						{/* Error Message */}
						{error && (
							<motion.div
								initial={{ opacity: 0, y: -4 }}
								animate={{ opacity: 1, y: 0 }}
								className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium"
							>
								<AlertCircle size={14} className="shrink-0 text-rose-400" />
								<span>{error}</span>
							</motion.div>
						)}

						{/* Actions */}
						<div className="flex gap-2.5 pt-2">
							<button
								type="button"
								onClick={onClose}
								disabled={loading}
								className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 transition-colors disabled:opacity-50 cursor-pointer"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={loading || otpDigits.join("").length !== 4}
								className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-950/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
							>
								{loading ? (
									<>
										<Loader2 size={14} className="animate-spin" />
										<span>Verifying...</span>
									</>
								) : (
									<>
										<CheckCircle2 size={14} />
										<span>Verify & Complete</span>
									</>
								)}
							</button>
						</div>
					</form>
				</motion.div>
			</div>
		</AnimatePresence>,
		document.body,
	);
}
