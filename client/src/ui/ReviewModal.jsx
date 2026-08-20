import React, { useState } from "react";
import { Star, X, Sparkles, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

const RATING_LABELS = {
	5: "Outstanding Experience! 🌟",
	4: "Very Good & Professional 👍",
	3: "Average Service 😐",
	2: "Below Expectations 👎",
	1: "Poor Experience ⚠️",
};

const SUGGESTED_TAGS = [
	"⚡ Punctual & On-Time",
	"🌟 Highly Skilled",
	"🧹 Clean & Tidy Work",
	"💬 Great Communication",
	"💰 Fair & Transparent",
	"🛡️ Safe & Verified",
];

export default function ReviewModal({
	isOpen,
	onClose,
	providerId,
	providerName,
	bookingId,
	onReviewSubmitted,
}) {
	const [rating, setRating] = useState(5);
	const [hoverRating, setHoverRating] = useState(0);
	const [comment, setComment] = useState("");
	const [selectedTags, setSelectedTags] = useState([]);
	const [isSubmitting, setIsSubmitting] = useState(false);

	if (!isOpen) return null;

	const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

	const toggleTag = (tag) => {
		setSelectedTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
		);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const token = localStorage.getItem("token");
		if (!token) {
			toast.error("Please login to leave a review");
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await fetch(`${API_URL}/api/reviews`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					provider_id: providerId,
					booking_id: bookingId || null,
					rating,
					comment: comment.trim(),
					tags: selectedTags,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Failed to submit review");
			}

			toast.success("Thank you for your review!");
			if (onReviewSubmitted) onReviewSubmitted(data.review);
			onClose();
		} catch (err) {
			console.error("Review submit error:", err);
			toast.error(err.message || "Failed to submit review");
		} finally {
			setIsSubmitting(false);
		}
	};

	const activeRating = hoverRating || rating;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
			<div className="relative w-full max-w-lg bg-[#1e153f] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-white overflow-hidden">
				{/* Background glow */}
				<div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

				<button
					onClick={onClose}
					className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
				>
					<X size={18} />
				</button>

				<div className="text-center space-y-2 mb-6">
					<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold">
						<Sparkles size={12} className="text-yellow-400" />
						<span>Verified Customer Feedback</span>
					</div>
					<h3 className="text-2xl font-bold bricolage-grotesque">
						Rate Your Experience
					</h3>
					<p className="text-sm text-gray-400">
						How was your service with <span className="text-violet-300 font-semibold">{providerName || "your expert"}</span>?
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-5">
					{/* Interactive Star Rating */}
					<div className="flex flex-col items-center gap-2">
						<div className="flex items-center gap-2">
							{[1, 2, 3, 4, 5].map((star) => (
								<button
									key={star}
									type="button"
									onClick={() => setRating(star)}
									onMouseEnter={() => setHoverRating(star)}
									onMouseLeave={() => setHoverRating(0)}
									className="p-1.5 transition-transform hover:scale-125 cursor-pointer focus:outline-none"
								>
									<Star
										size={32}
										className={`${
											star <= activeRating
												? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
												: "text-gray-600"
										} transition-colors duration-150`}
									/>
								</button>
							))}
						</div>
						<span className="text-xs font-semibold text-violet-300 h-5">
							{RATING_LABELS[activeRating]}
						</span>
					</div>

					{/* Tag Chips */}
					<div>
						<label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
							What went well?
						</label>
						<div className="flex flex-wrap gap-2">
							{SUGGESTED_TAGS.map((tag) => {
								const isSelected = selectedTags.includes(tag);
								return (
									<button
										key={tag}
										type="button"
										onClick={() => toggleTag(tag)}
										className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
											isSelected
												? "bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-900/30"
												: "bg-white/5 border-white/10 text-gray-400 hover:border-violet-500/40 hover:text-white"
										}`}
									>
										{isSelected && <Check size={12} />}
										<span>{tag}</span>
									</button>
								);
							})}
						</div>
					</div>

					{/* Review Text */}
					<div>
						<label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
							Write your review
						</label>
						<textarea
							value={comment}
							onChange={(e) => setComment(e.target.value)}
							rows={3}
							placeholder="Share specific details about the quality of service, timeliness, and experience..."
							className="w-full bg-[#140d2d] border border-white/10 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
						/>
					</div>

					{/* Action Buttons */}
					<div className="flex items-center justify-end gap-3 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="px-5 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition-all cursor-pointer"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="px-7 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-900/40 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
						>
							{isSubmitting ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<Sparkles size={14} className="text-yellow-300" />
							)}
							<span>Submit Review</span>
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
