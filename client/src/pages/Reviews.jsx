import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
	Star,
	ShieldCheck,
	ThumbsUp,
	Search,
	ArrowRight,
	ArrowLeft,
	X,
	MessageSquare,
	RotateCcw,
	BadgeCheck,
} from "lucide-react";
import { FadeLoader } from "react-spinners";
import gsap from "gsap";
import { useAuth } from "../contexts/AuthContext";
import VerifiedBadge from "../ui/VerifiedBadge";
import { API_URL } from "../config";
import Logo from "../ui/Logo";

const CATEGORIES = [
	{ id: "all", label: "All" },
	{ id: "house-cleaning", label: "House Cleaning" },
	{ id: "plumbing", label: "Plumbing" },
	{ id: "electrical-repair", label: "Electrical" },
	{ id: "laundry", label: "Laundry" },
	{ id: "cooking-help", label: "Cooking" },
	{ id: "pest-control", label: "Pest Control" },
	{ id: "gardening", label: "Gardening" },
	{ id: "computer-tech-repair", label: "Tech Repair" },
	{ id: "moving-help", label: "Moving" },
];

const SORT_OPTIONS = [
	{ value: "recent", label: "Most recent" },
	{ value: "highest", label: "Highest rated" },
	{ value: "lowest", label: "Lowest rated" },
];

/* Reusable star row (filled / empty) */
function Stars({ value, size = 14 }) {
	return (
		<div
			className="flex items-center gap-0.5"
			aria-label={`${value} out of 5 stars`}
		>
			{[1, 2, 3, 4, 5].map((n) => (
				<Star
					key={n}
					size={size}
					className={
						n <= value
							? "fill-amber-300 text-amber-300"
							: "fill-transparent text-white/20"
					}
				/>
			))}
		</div>
	);
}

export default function Reviews() {
	const { user } = useAuth();

	const [reviews, setReviews] = useState([]);
	const [stats, setStats] = useState({
		total_reviews: 0,
		average_rating: 0,
		satisfaction_rate: 0,
		distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const [selectedCategory, setSelectedCategory] = useState("all");
	const [selectedRating, setSelectedRating] = useState("all");
	const [sortOrder, setSortOrder] = useState("recent");
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [helpfulVotes, setHelpfulVotes] = useState({});
	const [retryTick, setRetryTick] = useState(0);

	const gridRef = useRef(null);

	const backUrl = useMemo(() => {
		if (user?.role === "provider") return "/provider/dashboard";
		if (user?.role === "admin") return "/admin";
		if (user?.role === "customer") return "/dashboard";
		return "/";
	}, [user?.role]);

	/* Debounce search into its own value so there is a single fetch effect */
	useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
		return () => clearTimeout(t);
	}, [searchQuery]);

	/* Single fetch effect with abort guard */
	useEffect(() => {
		const controller = new AbortController();

		(async () => {
			setLoading(true);
			setError("");
			try {
				const params = new URLSearchParams();
				if (selectedCategory !== "all")
					params.append("service", selectedCategory);
				if (selectedRating !== "all") params.append("rating", selectedRating);
				if (sortOrder) params.append("sort", sortOrder);
				if (debouncedSearch) params.append("search", debouncedSearch);

				const res = await fetch(`${API_URL}/api/reviews?${params.toString()}`, {
					signal: controller.signal,
				});
				if (!res.ok) throw new Error("Failed to load reviews");

				const data = await res.json();
				setReviews(data.reviews || []);
				if (data.distribution) {
					setStats({
						total_reviews: data.total_reviews || 0,
						average_rating: data.average_rating || 0,
						satisfaction_rate: data.satisfaction_rate || 0,
						distribution: data.distribution,
					});
				}
			} catch (err) {
				if (err.name === "AbortError") return;
				console.error("Error fetching reviews:", err);
				setError("We couldn't load reviews right now. Please try again.");
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		})();

		return () => controller.abort();
	}, [selectedCategory, selectedRating, sortOrder, debouncedSearch, retryTick]);

	/* Gentle entrance animation */
	useEffect(() => {
		if (loading || !gridRef.current) return;
		const cards = gridRef.current.querySelectorAll(".review-card");
		if (!cards.length) return;
		gsap.fromTo(
			cards,
			{ opacity: 0, y: 12 },
			{
				opacity: 1,
				y: 0,
				stagger: 0.04,
				duration: 0.4,
				ease: "power2.out",
				clearProps: "all",
			},
		);
	}, [reviews, loading]);

	const toggleHelpful = (id) =>
		setHelpfulVotes((prev) => ({ ...prev, [id]: !prev[id] }));

	const resetFilters = () => {
		setSelectedCategory("all");
		setSelectedRating("all");
		setSortOrder("recent");
		setSearchQuery("");
	};

	const hasActiveFilters =
		selectedCategory !== "all" ||
		selectedRating !== "all" ||
		searchQuery.trim() !== "";

	const totalDist =
		Object.values(stats.distribution).reduce((a, b) => a + b, 0) || 1;

	return (
		<div className="min-h-screen bg-[#0d0b12] text-stone-200 antialiased">
			{/* ───────── Top bar ───────── */}
			<header className="border-b border-white/[0.06]">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
					<Logo to="/" size="md" theme="primary" />
					<div className="flex items-center gap-3">
						{user?.role === "provider" && (
							<Link
								to="/provider/dashboard/reviews"
								className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30 transition-colors"
							>
								<Star size={13} className="fill-amber-400 text-amber-400" />
								<span>Your Reviews Dashboard</span>
							</Link>
						)}
						<Link
							to={backUrl}
							className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-white transition-colors"
						>
							<ArrowLeft size={15} />
							<span>{user ? "Back to dashboard" : "Back to Home"}</span>
						</Link>
					</div>
				</div>
			</header>

			<main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* ───────── Hero ───────── */}
				<section className="pt-16 sm:pt-24 pb-14 grid lg:grid-cols-12 gap-12 lg:gap-16 items-end">
					<div className="lg:col-span-7">
						<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/80 mb-5">
							Customer reviews
						</p>
						<h1 className="font-mackinac text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.08] tracking-tight">
							What people say after
							<br className="hidden sm:block" /> the work is done.
						</h1>
						<p className="bricolage-grotesque mt-6 text-base text-stone-400 leading-relaxed max-w-xl">
							Every review is tied to a completed, OTP-verified booking. No paid
							placements and no anonymous posts.
						</p>
						<div className="mt-6 inline-flex items-center gap-2 text-sm text-stone-300">
							<ShieldCheck size={16} className="text-emerald-400" />
							<span>Only customers who booked can review</span>
						</div>
					</div>

					{/* Score summary */}
					<div className="lg:col-span-5">
						<div className="flex items-end gap-5">
							<span className="font-mackinac text-7xl sm:text-8xl font-bold text-white leading-none">
								{stats.average_rating ? stats.average_rating.toFixed(1) : "–"}
							</span>
							<div className="pb-2 space-y-1.5">
								<Stars value={Math.round(stats.average_rating)} size={16} />
								<p className="text-sm text-stone-400">
									{stats.total_reviews.toLocaleString("en-IN")} verified reviews
								</p>
							</div>
						</div>

						{/* Distribution */}
						<div className="mt-8 space-y-1">
							{[5, 4, 3, 2, 1].map((stars) => {
								const count = stats.distribution[stars] || 0;
								const pct = Math.round((count / totalDist) * 100);
								const active = selectedRating === String(stars);
								return (
									<button
										key={stars}
										type="button"
										onClick={() =>
											setSelectedRating(active ? "all" : String(stars))
										}
										aria-pressed={active}
										className={`w-full flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-lg text-sm transition-colors ${
											active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
										}`}
									>
										<span className="w-4 text-stone-400 tabular-nums text-right">
											{stars}
										</span>
										<Star
											size={12}
											className="fill-amber-300 text-amber-300 -ml-1"
										/>
										<div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
											<div
												className={`h-full rounded-full transition-all duration-500 ${
													active ? "bg-violet-400" : "bg-amber-300/80"
												}`}
												style={{ width: `${pct}%` }}
											/>
										</div>
										<span className="w-9 text-right text-xs text-stone-500 tabular-nums">
											{pct}%
										</span>
									</button>
								);
							})}
						</div>
					</div>
				</section>

				{/* ───────── Sticky filter bar ───────── */}
				<section className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 bg-[#0d0b12]/90 backdrop-blur-md border-y border-white/[0.06]">
					<div className="flex flex-col gap-4">
						<div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
							{/* Search */}
							<div className="relative w-full sm:max-w-sm">
								<Search
									size={16}
									className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500"
								/>
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search by keyword or professional"
									aria-label="Search reviews"
									className="w-full h-10 pl-10 pr-9 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-violet-400/60 focus:bg-white/[0.06] transition-colors"
								/>
								{searchQuery && (
									<button
										type="button"
										onClick={() => setSearchQuery("")}
										aria-label="Clear search"
										className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white transition-colors"
									>
										<X size={14} />
									</button>
								)}
							</div>

							{/* Sort */}
							<div className="flex items-center gap-2 text-sm">
								<label htmlFor="sort" className="text-stone-500">
									Sort
								</label>
								<select
									id="sort"
									value={sortOrder}
									onChange={(e) => setSortOrder(e.target.value)}
									className="h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-stone-200 focus:outline-none focus:border-violet-400/60 cursor-pointer"
								>
									{SORT_OPTIONS.map((o) => (
										<option
											key={o.value}
											value={o.value}
											className="bg-[#16121f]"
										>
											{o.label}
										</option>
									))}
								</select>
							</div>
						</div>

						{/* Category chips */}
						<div className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
							{CATEGORIES.map((cat) => {
								const active = selectedCategory === cat.id;
								return (
									<button
										key={cat.id}
										type="button"
										onClick={() => setSelectedCategory(cat.id)}
										aria-pressed={active}
										className={`shrink-0 h-8 px-3.5 rounded-full text-[13px] font-medium transition-colors ${
											active
												? "bg-white text-[#0d0b12]"
												: "text-stone-400 hover:text-white hover:bg-white/[0.06]"
										}`}
									>
										{cat.label}
									</button>
								);
							})}
						</div>
					</div>
				</section>

				{/* ───────── Results ───────── */}
				<section className="py-10">
					{/* Result summary + active filters */}
					{!loading && !error && (
						<div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-8 text-sm">
							<p className="text-stone-400">
								Showing{" "}
								<span className="text-white font-medium">{reviews.length}</span>{" "}
								{reviews.length === 1 ? "review" : "reviews"}
							</p>
							{selectedRating !== "all" && (
								<button
									type="button"
									onClick={() => setSelectedRating("all")}
									className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white/[0.06] text-stone-200 text-xs hover:bg-white/[0.1] transition-colors"
								>
									{selectedRating} stars
									<X size={12} />
								</button>
							)}
							{hasActiveFilters && (
								<button
									type="button"
									onClick={resetFilters}
									className="text-xs text-violet-300 hover:text-violet-200 underline underline-offset-4 decoration-violet-300/30"
								>
									Clear all
								</button>
							)}
						</div>
					)}

					{loading ? (
						<div className="py-28 flex flex-col items-center gap-4">
							<FadeLoader
								color="#a78bfa"
								height={10}
								width={3}
								radius={2}
								margin={2}
							/>
							<p className="text-sm text-stone-500">Loading reviews…</p>
						</div>
					) : error ? (
						<div className="py-20 text-center max-w-sm mx-auto space-y-4">
							<p className="text-stone-300">{error}</p>
							<button
								type="button"
								onClick={() => setRetryTick((t) => t + 1)}
								className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-white text-[#0d0b12] text-sm font-semibold hover:bg-stone-200 transition-colors"
							>
								<RotateCcw size={14} />
								Try again
							</button>
						</div>
					) : reviews.length === 0 ? (
						<div className="py-20 text-center max-w-sm mx-auto space-y-4">
							<div className="w-11 h-11 mx-auto rounded-full border border-white/10 flex items-center justify-center text-stone-500">
								<MessageSquare size={18} />
							</div>
							<h3 className="font-mackinac text-xl font-bold text-white">
								No matching reviews
							</h3>
							<p className="text-sm text-stone-400 leading-relaxed">
								Nothing fits those filters yet. Try a broader search or clear
								the filters.
							</p>
							<button
								type="button"
								onClick={resetFilters}
								className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-white text-[#0d0b12] text-sm font-semibold hover:bg-stone-200 transition-colors"
							>
								<RotateCcw size={14} />
								Clear filters
							</button>
						</div>
					) : (
						<div
							ref={gridRef}
							className="grid grid-cols-1 md:grid-cols-2 gap-5"
						>
							{reviews.map((rev) => {
								const voted = Boolean(helpfulVotes[rev.id]);
								const date = new Date(rev.created_at).toLocaleDateString(
									"en-IN",
									{
										month: "short",
										day: "numeric",
										year: "numeric",
									},
								);

								return (
									<article
										key={rev.id}
										className="review-card flex flex-col p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.14] transition-colors"
									>
										{/* Rating + date */}
										<div className="flex items-center justify-between">
											<Stars value={rev.rating} />
											<time className="text-xs text-stone-500">{date}</time>
										</div>

										{/* Service label */}
										{rev.service?.name && (
											<p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300/80">
												{rev.service.name}
											</p>
										)}

										{/* Comment */}
										<p className="bricolage-grotesque mt-2 text-[15px] leading-[1.7] text-stone-200 flex-1">
											{rev.comment}
										</p>

										{/* Tags */}
										{rev.tags?.length > 0 && (
											<div className="mt-4 flex flex-wrap gap-1.5">
												{rev.tags.map((tag, i) => (
													<span
														key={i}
														className="px-2.5 py-1 rounded-md bg-white/[0.05] text-[11px] text-stone-400"
													>
														{tag}
													</span>
												))}
											</div>
										)}

										{/* Footer: author, provider, helpful */}
										<div className="mt-6 pt-5 border-t border-white/[0.06] space-y-4">
											<div className="flex items-center justify-between gap-3">
												<div className="flex items-center gap-3 min-w-0">
													<div className="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center text-sm font-semibold text-white overflow-hidden shrink-0">
														{rev.customer?.photo ? (
															<img
																src={rev.customer.photo}
																alt=""
																className="w-full h-full object-cover"
															/>
														) : (
															<span>
																{rev.customer?.name?.[0]?.toUpperCase() || "C"}
															</span>
														)}
													</div>
													<div className="min-w-0">
														<p className="text-sm font-medium text-white truncate">
															{rev.customer?.name || "Verified customer"}
														</p>
														<p className="flex items-center gap-1 text-xs text-stone-500">
															<BadgeCheck
																size={12}
																className="text-emerald-400"
															/>
															Verified booking
														</p>
													</div>
												</div>

												<button
													type="button"
													onClick={() => toggleHelpful(rev.id)}
													aria-pressed={voted}
													className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
														voted
															? "bg-violet-400/15 border-violet-400/40 text-violet-200"
															: "border-white/[0.1] text-stone-400 hover:text-white hover:border-white/25"
													}`}
												>
													<ThumbsUp
														size={12}
														className={voted ? "fill-violet-300/40" : ""}
													/>
													Helpful
												</button>
											</div>

											{rev.provider?.name && (
												<Link
													to={`/services/${rev.service?.slug || "all"}`}
													className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-200 transition-colors group"
												>
													<span>Served by</span>
													<span className="font-medium text-stone-300 group-hover:text-white">
														{rev.provider.name}
													</span>
													{rev.provider.is_verified && (
														<VerifiedBadge size="sm" />
													)}
													<ArrowRight
														size={12}
														className="ml-auto opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
													/>
												</Link>
											)}
										</div>
									</article>
								);
							})}
						</div>
					)}
				</section>

				{/* ───────── Closing CTA ───────── */}
				<section className="py-20 border-t border-white/[0.06] text-center">
					<h2 className="font-mackinac text-3xl sm:text-4xl font-bold text-white tracking-tight">
						Ready to book someone you can trust?
					</h2>
					<p className="bricolage-grotesque mt-4 text-stone-400 max-w-md mx-auto leading-relaxed">
						Browse verified professionals, compare ratings, and book in minutes.
					</p>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
						<Link
							to="/services"
							className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-white text-[#0d0b12] text-sm font-semibold hover:bg-stone-200 transition-colors"
						>
							Browse services
							<ArrowRight size={15} />
						</Link>
						<Link
							to="/help"
							className="inline-flex items-center h-11 px-6 rounded-lg border border-white/15 text-sm font-medium text-stone-200 hover:bg-white/[0.06] transition-colors"
						>
							Our satisfaction guarantee
						</Link>
					</div>
				</section>
			</main>
		</div>
	);
}
