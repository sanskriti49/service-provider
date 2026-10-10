import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
	MessageSquare,
	Star,
	CheckCircle2,
	X,
	Loader2,
	Send,
	Sparkles,
	History,
	Heart,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../api/axiosInstance";
import { useModal } from "../../hooks/useModal";

const CATEGORIES = [
	{ id: "service_quality", label: "Service Quality", emoji: "✨" },
	{ id: "app_experience", label: "App & Booking Flow", emoji: "📱" },
	{ id: "pricing", label: "Pricing & Transparent Bills", emoji: "💰" },
	{ id: "feature_request", label: "Feature Suggestion", emoji: "💡" },
	{ id: "general", label: "General Feedback", emoji: "💬" },
];

const RATING_LABELS = {
	1: "Disappointing 😞",
	2: "Needs Improvement 😐",
	3: "Good & Fair 🙂",
	4: "Very Good! 😊",
	5: "Exceptional Experience! 🌟",
};

export default function FeedbackModal({ isOpen, onClose }) {
	const [rating, setRating] = useState(5);
	const [hoveredRating, setHoveredRating] = useState(0);
	const [category, setCategory] = useState("app_experience");
	const [feedbackText, setFeedbackText] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [submittedSuccess, setSubmittedSuccess] = useState(false);
	const [pastFeedback, setPastFeedback] = useState([]);
	const [loadingPast, setLoadingPast] = useState(false);
	const [showPastList, setShowPastList] = useState(false);

	useModal({
		isOpen,
		onClose,
		id: "customer-feedback-modal",
		lockScroll: true,
	});

	const fetchPastFeedback = async () => {
		try {
			setLoadingPast(true);
			const res = await api.get("/api/account/feedback");
			setPastFeedback(res.data?.feedback || []);
		} catch (err) {
			console.warn("Could not fetch feedback history:", err.message);
		} finally {
			setLoadingPast(false);
		}
	};

	useEffect(() => {
		if (isOpen) {
			setSubmittedSuccess(false);
			setFeedbackText("");
			setRating(5);
			setShowPastList(false);
			fetchPastFeedback();
		}
	}, [isOpen]);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!feedbackText.trim()) {
			toast.error("Please enter a few words about your experience.");
			return;
		}

		setSubmitting(true);
		try {
			await api.post("/api/account/feedback", {
				rating,
				category,
				feedback: feedbackText.trim(),
			});
			setSubmittedSuccess(true);
			toast.success("Feedback submitted! Thank you for helping us improve.");
			fetchPastFeedback();
		} catch (err) {
			console.error("Submit feedback error:", err);
			toast.error(err.response?.data?.error || "Failed to submit feedback.");
		} finally {
			setSubmitting(false);
		}
	};

	const effectiveRating = hoveredRating || rating;

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
									<MessageSquare size={18} />
								</span>
								<div>
									<h2 className="font-mackinac text-xl font-bold text-white tracking-tight">
										Share Your Feedback
									</h2>
									<p className="text-xs text-stone-400">
										Your input directly guides our team and roadmap
									</p>
								</div>
							</div>
							<div className="flex items-center gap-1">
								{pastFeedback.length > 0 && !submittedSuccess && (
									<button
										type="button"
										onClick={() => setShowPastList(!showPastList)}
										className={`h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
											showPastList
												? "border-amber-400/40 bg-amber-400/15 text-amber-300"
												: "border-white/[0.08] bg-white/[0.03] text-stone-400 hover:text-white"
										}`}
									>
										<History size={13} />
										<span>Past ({pastFeedback.length})</span>
									</button>
								)}
								<button
									type="button"
									onClick={onClose}
									className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/[0.06] transition-colors"
								>
									<X size={18} />
								</button>
							</div>
						</div>

						{/* Content Body */}
						<div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
							{/* SUCCESS STATE */}
							{submittedSuccess ? (
								<motion.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									className="py-10 text-center space-y-4"
								>
									<div className="w-16 h-16 rounded-full bg-emerald-400/10 text-emerald-300 flex items-center justify-center mx-auto border border-emerald-400/30 shadow-[0_0_30px_rgba(52,211,153,0.2)]">
										<CheckCircle2 size={32} />
									</div>
									<h3 className="font-mackinac text-2xl font-bold text-white">
										Thank You So Much!
									</h3>
									<p className="text-sm text-stone-300 max-w-sm mx-auto leading-relaxed">
										We’ve registered your feedback. Ideas and suggestions like
										yours keep TaskGenie evolving and delighting customers.
									</p>
									<div className="pt-4 flex justify-center gap-3">
										<button
											type="button"
											onClick={() => {
												setSubmittedSuccess(false);
												setFeedbackText("");
											}}
											className="h-10 px-5 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-white transition-colors"
										>
											Submit Another Thought
										</button>
										<button
											type="button"
											onClick={onClose}
											className="h-10 px-5 rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-400 text-[#0d0b12] text-xs font-semibold hover:brightness-110 transition-all"
										>
											Close
										</button>
									</div>
								</motion.div>
							) : showPastList ? (
								/* PAST FEEDBACK HISTORY VIEW */
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<h4 className="text-sm font-semibold text-white">
											Your Previously Submitted Feedback
										</h4>
										<button
											type="button"
											onClick={() => setShowPastList(false)}
											className="text-xs text-amber-300 hover:underline"
										>
											← Back to feedback form
										</button>
									</div>

									{loadingPast ? (
										<div className="py-8 text-center">
											<Loader2
												size={20}
												className="animate-spin text-amber-300 mx-auto"
											/>
										</div>
									) : (
										<div className="space-y-3">
											{pastFeedback.map((item) => (
												<div
													key={item.id}
													className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-2"
												>
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-1.5">
															{[1, 2, 3, 4, 5].map((s) => (
																<Star
																	key={s}
																	size={12}
																	className={
																		s <= item.rating
																			? "text-amber-400 fill-amber-400"
																			: "text-stone-600"
																	}
																/>
															))}
															<span className="ml-2 text-xs font-medium text-stone-300 capitalize">
																{item.category?.replace(/_/g, " ")}
															</span>
														</div>
														<span className="text-[10px] text-stone-500 font-mono">
															{new Date(item.created_at).toLocaleDateString(
																"en-IN",
																{ month: "short", day: "numeric", year: "numeric" },
															)}
														</span>
													</div>
													<p className="text-xs text-stone-300 leading-relaxed">
														"{item.feedback}"
													</p>
													<div className="pt-1 flex items-center gap-1.5 text-[10px] text-emerald-400">
														<Sparkles size={11} />
														<span>Reviewed by TaskGenie Team</span>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							) : (
								/* FEEDBACK FORM */
								<form onSubmit={handleSubmit} className="space-y-5">
									{/* Star Rating Section */}
									<div className="text-center py-2 space-y-2">
										<label className="block text-xs font-medium text-stone-400">
											How would you rate your overall TaskGenie experience?
										</label>
										<div className="flex items-center justify-center gap-2 pt-1">
											{[1, 2, 3, 4, 5].map((star) => (
												<button
													key={star}
													type="button"
													onMouseEnter={() => setHoveredRating(star)}
													onMouseLeave={() => setHoveredRating(0)}
													onClick={() => setRating(star)}
													className="p-1.5 rounded-xl transition-transform hover:scale-125 focus:outline-none"
												>
													<Star
														size={30}
														className={`transition-colors ${
															star <= effectiveRating
																? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
																: "text-stone-700 hover:text-stone-500"
														}`}
													/>
												</button>
											))}
										</div>
										<p className="text-xs font-semibold text-amber-300 h-5">
											{RATING_LABELS[effectiveRating]}
										</p>
									</div>

									{/* Category Pills */}
									<div>
										<label className="block text-xs font-medium text-stone-400 mb-2">
											What area does this feedback relate to?
										</label>
										<div className="flex flex-wrap gap-2">
											{CATEGORIES.map(({ id, label, emoji }) => {
												const active = category === id;
												return (
													<button
														key={id}
														type="button"
														onClick={() => setCategory(id)}
														className={`h-8 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
															active
																? "border-amber-400/60 bg-amber-400/15 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.12)]"
																: "border-white/[0.08] bg-white/[0.03] text-stone-400 hover:bg-white/[0.06] hover:text-stone-200"
														}`}
													>
														<span>{emoji}</span>
														<span>{label}</span>
													</button>
												);
											})}
										</div>
									</div>

									{/* Feedback Textarea */}
									<div>
										<label className="block text-xs font-medium text-stone-400 mb-1.5">
											Tell us what worked well or what we can improve *
										</label>
										<textarea
											rows={4}
											required
											value={feedbackText}
											onChange={(e) => setFeedbackText(e.target.value)}
											placeholder="Share your experience with service booking, providers, pricing, or ideas for new features..."
											className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/[0.12] text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-amber-400 transition-colors leading-relaxed"
										/>
									</div>

									{/* Action Buttons */}
									<div className="pt-2 flex gap-3">
										<button
											type="submit"
											disabled={submitting}
											className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 text-[#0d0b12] text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50 shadow-[0_6px_20px_-5px_rgba(251,191,36,0.5)]"
										>
											{submitting ? (
												<Loader2 size={16} className="animate-spin" />
											) : (
												<Send size={15} />
											)}
											<span>Submit Feedback</span>
										</button>
										<button
											type="button"
											onClick={onClose}
											className="h-11 px-5 rounded-xl border border-white/[0.1] text-xs font-medium text-stone-400 hover:text-white transition-colors"
										>
											Cancel
										</button>
									</div>
								</form>
							)}
						</div>

						{/* Footer */}
						<div className="px-6 py-4 border-t border-white/[0.08] bg-black/20 flex items-center justify-between text-xs text-stone-500">
							<span className="flex items-center gap-1.5">
								<Heart size={12} className="text-rose-400 fill-rose-400" />
								Thank you for making TaskGenie better
							</span>
							<button
								type="button"
								onClick={onClose}
								className="text-stone-400 hover:text-white"
							>
								Close
							</button>
						</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>,
		document.body,
	);
}
