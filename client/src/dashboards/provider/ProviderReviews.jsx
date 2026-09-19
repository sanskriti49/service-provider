import React, { useState, useEffect, useRef, useMemo } from "react";
import { useOutletContext, Link } from "react-router-dom";
import {
	Star,
	Search,
	RotateCcw,
	MessageSquare,
	ArrowUpRight,
	X,
	BadgeCheck,
} from "lucide-react";
import { FadeLoader } from "react-spinners";
import gsap from "gsap";
import api from "../../api/axiosInstance";
import { useAuth } from "../../contexts/AuthContext";

const RATING_FILTERS = [
	{ key: "all", label: "All" },
	{ key: "5", label: "5★" },
	{ key: "4", label: "4★" },
	{ key: "3", label: "3★" },
	{ key: "critical", label: "Needs attention" },
];

const SORT_OPTIONS = [
	{ value: "recent", label: "Most recent" },
	{ value: "highest", label: "Highest rated" },
	{ value: "lowest", label: "Lowest rated" },
];

const EMPTY_DATA = {
	total_reviews: 0,
	average_rating: 0,
	satisfaction_rate: 0,
	distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
	reviews: [],
};

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

export default function ProviderReviews() {
	const outletContext = useOutletContext();
	const { user: authUser } = useAuth();
	const user = outletContext?.user || authUser;

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [reviewsData, setReviewsData] = useState(EMPTY_DATA);
	const [retryTick, setRetryTick] = useState(0);

	const [selectedRating, setSelectedRating] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [sortOrder, setSortOrder] = useState("recent");

	const listRef = useRef(null);

	/* Debounce search into its own value → one fetch effect */
	useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
		return () => clearTimeout(t);
	}, [searchQuery]);

	useEffect(() => {
		const controller = new AbortController();

		(async () => {
			setLoading(true);
			setError("");

			const params = new URLSearchParams();
			// "critical" is filtered client-side below so 1★ and 2★ are both included
			if (selectedRating !== "all" && selectedRating !== "critical") {
				params.append("rating", selectedRating);
			}
			if (debouncedSearch) params.append("search", debouncedSearch);
			if (sortOrder) params.append("sort", sortOrder);

			try {
				const res = await api.get(
					`/api/reviews/my-reviews?${params.toString()}`,
					{
						signal: controller.signal,
					},
				);
				setReviewsData({ ...EMPTY_DATA, ...res.data });
			} catch (err) {
				if (controller.signal.aborted) return;
				try {
					if (!user?.id) throw err;
					const fb = await api.get(
						`/api/reviews/provider/${user.id}?${params.toString()}`,
						{ signal: controller.signal },
					);
					setReviewsData({ ...EMPTY_DATA, ...fb.data });
				} catch (fbErr) {
					if (controller.signal.aborted) return;
					console.error("Failed to load provider reviews:", fbErr);
					setError("We couldn't load your reviews right now.");
				}
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		})();

		return () => controller.abort();
	}, [selectedRating, debouncedSearch, sortOrder, retryTick, user?.id]);

	const { total_reviews, average_rating, satisfaction_rate, distribution } =
		reviewsData;

	const reviews = useMemo(() => {
		const list = reviewsData.reviews || [];
		if (selectedRating === "critical") {
			return list.filter((r) => Number(r.rating) <= 2);
		}
		return list;
	}, [reviewsData.reviews, selectedRating]);

	/* Entrance animation */
	useEffect(() => {
		if (loading || !listRef.current) return;
		const cards = listRef.current.querySelectorAll(".review-item");
		if (!cards.length) return;
		gsap.fromTo(
			cards,
			{ opacity: 0, y: 10 },
			{
				opacity: 1,
				y: 0,
				stagger: 0.04,
				duration: 0.35,
				ease: "power2.out",
				clearProps: "all",
			},
		);
	}, [reviews, loading]);

	const totalDist =
		Object.values(distribution || {}).reduce(
			(s, n) => s + (Number(n) || 0),
			0,
		) || 1;
	const fiveStarPct = Math.round(((distribution?.[5] || 0) / totalDist) * 100);
	const hasActiveFilter = selectedRating !== "all" || searchQuery.trim() !== "";

	const resetFilters = () => {
		setSelectedRating("all");
		setSearchQuery("");
		setSortOrder("recent");
	};

	return (
		<div className="pb-16">
			{/* ───────── Header ───────── */}
			<header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
				<div>
					<h1 className="font-mackinac text-3xl sm:text-4xl font-bold text-white tracking-tight">
						Reviews
					</h1>
					<p className="mt-2 text-sm text-stone-400 max-w-md leading-relaxed">
						Feedback from customers after completed, OTP-verified bookings.
					</p>
				</div>
				<Link
					to="/reviews"
					target="_blank"
					className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-white transition-colors"
				>
					View public page
					<ArrowUpRight size={15} />
				</Link>
			</header>

			{/* ───────── Summary ───────── */}
			<section className="mt-10 grid lg:grid-cols-12 gap-10 lg:gap-14 pb-10 border-b border-white/[0.06]">
				{/* Score + secondary stats */}
				<div className="lg:col-span-5">
					<div className="flex items-end gap-5">
						<span className="font-mackinac text-7xl font-bold text-white leading-none tabular-nums">
							{total_reviews > 0 ? Number(average_rating).toFixed(1) : "–"}
						</span>
						<div className="pb-1.5 space-y-1.5">
							<Stars value={Math.round(average_rating || 0)} size={16} />
							<p className="text-sm text-stone-400">
								from {total_reviews.toLocaleString("en-IN")}{" "}
								{total_reviews === 1 ? "review" : "reviews"}
							</p>
						</div>
					</div>

					<dl className="mt-8 grid grid-cols-2 gap-6">
						<div>
							<dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
								Satisfaction
							</dt>
							<dd className="mt-1.5 font-mackinac text-2xl font-bold text-white tabular-nums">
								{total_reviews > 0 ? `${satisfaction_rate}%` : "–"}
							</dd>
							<p className="mt-0.5 text-xs text-stone-500">
								rated 4★ or higher
							</p>
						</div>
						<div>
							<dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
								Five-star
							</dt>
							<dd className="mt-1.5 font-mackinac text-2xl font-bold text-white tabular-nums">
								{total_reviews > 0 ? `${fiveStarPct}%` : "–"}
							</dd>
							<p className="mt-0.5 text-xs text-stone-500">
								{distribution?.[5] || 0} top-rated reviews
							</p>
						</div>
					</dl>
				</div>

				{/* Distribution (also a filter) */}
				<div className="lg:col-span-7">
					<div className="flex items-baseline justify-between mb-3">
						<h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
							Breakdown
						</h2>
						<span className="text-xs text-stone-600">
							Select a row to filter
						</span>
					</div>
					<div className="space-y-0.5">
						{[5, 4, 3, 2, 1].map((stars) => {
							const count = distribution?.[stars] || 0;
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
									className={`w-full flex items-center gap-4 px-3 py-2 -mx-3 rounded-lg text-sm transition-colors ${
										active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
									}`}
								>
									<span className="flex items-center gap-1 w-8 text-stone-300 tabular-nums">
										{stars}
										<Star size={12} className="fill-amber-300 text-amber-300" />
									</span>
									<div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
										<div
											className={`h-full rounded-full transition-all duration-500 ${
												active ? "bg-violet-400" : "bg-amber-300/80"
											}`}
											style={{ width: `${pct}%` }}
										/>
									</div>
									<span className="w-16 text-right text-xs text-stone-500 tabular-nums">
										{count}
										<span className="text-stone-600"> · {pct}%</span>
									</span>
								</button>
							);
						})}
					</div>
				</div>
			</section>

			{/* ───────── Toolbar ───────── */}
			<section className="py-6 flex flex-col gap-4">
				<div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
					<div className="relative w-full sm:max-w-sm">
						<Search
							size={16}
							className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500"
						/>
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search by customer, service or keyword"
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
								<option key={o.value} value={o.value} className="bg-[#16121f]">
									{o.label}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3">
					<div
						role="tablist"
						aria-label="Filter by rating"
						className="inline-flex p-1 rounded-lg bg-white/[0.04] border border-white/[0.07] overflow-x-auto max-w-full"
					>
						{RATING_FILTERS.map((f) => {
							const active = selectedRating === f.key;
							return (
								<button
									key={f.key}
									role="tab"
									aria-selected={active}
									type="button"
									onClick={() => setSelectedRating(f.key)}
									className={`shrink-0 h-8 px-3.5 rounded-md text-[13px] font-medium transition-colors ${
										active
											? "bg-white text-[#0d0b12]"
											: "text-stone-400 hover:text-white"
									}`}
								>
									{f.label}
								</button>
							);
						})}
					</div>

					{hasActiveFilter && (
						<button
							type="button"
							onClick={resetFilters}
							className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 underline underline-offset-4 decoration-violet-300/30"
						>
							<RotateCcw size={12} />
							Clear filters
						</button>
					)}
				</div>
			</section>

			{/* ───────── Reviews ───────── */}
			<section>
				{loading ? (
					<div className="py-24 flex flex-col items-center gap-4">
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
							{hasActiveFilter ? "No matching reviews" : "No reviews yet"}
						</h3>
						<p className="text-sm text-stone-400 leading-relaxed">
							{hasActiveFilter
								? "Try a broader search or clear the filters."
								: "Once customers confirm a completed booking with their OTP, their reviews will show up here."}
						</p>
						{hasActiveFilter ? (
							<button
								type="button"
								onClick={resetFilters}
								className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-white text-[#0d0b12] text-sm font-semibold hover:bg-stone-200 transition-colors"
							>
								<RotateCcw size={14} />
								Clear filters
							</button>
						) : (
							<Link
								to="/provider/dashboard/bookings"
								className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-white text-[#0d0b12] text-sm font-semibold hover:bg-stone-200 transition-colors"
							>
								View bookings
								<ArrowUpRight size={14} />
							</Link>
						)}
					</div>
				) : (
					<>
						<p className="mb-4 text-sm text-stone-500">
							Showing{" "}
							<span className="text-white font-medium">{reviews.length}</span>{" "}
							{reviews.length === 1 ? "review" : "reviews"}
						</p>

						<div ref={listRef} className="space-y-3">
							{reviews.map((r) => {
								const rating = Number(r.rating || 0);
								const critical = rating <= 2;
								const dateStr = r.created_at
									? new Date(r.created_at).toLocaleDateString("en-IN", {
											day: "numeric",
											month: "short",
											year: "numeric",
										})
									: "Recent";
								const bookingRef = r.booking_id
									? `#${String(r.booking_id).slice(0, 8).toUpperCase()}`
									: null;

								return (
									<article
										key={r.id}
										className={`review-item relative p-6 rounded-2xl bg-white/[0.03] border transition-colors hover:border-white/[0.14] ${
											critical ? "border-rose-400/25" : "border-white/[0.07]"
										}`}
									>
										{critical && (
											<span
												aria-hidden
												className="absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full bg-rose-400/70"
											/>
										)}

										{/* Top row */}
										<div className="flex items-start justify-between gap-4">
											<div className="flex items-center gap-3 min-w-0">
												<div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center text-sm font-semibold text-white overflow-hidden shrink-0">
													{r.customer?.photo ? (
														<img
															src={r.customer.photo}
															alt=""
															className="w-full h-full object-cover"
														/>
													) : (
														<span>
															{r.customer?.name?.charAt(0).toUpperCase() || "C"}
														</span>
													)}
												</div>
												<div className="min-w-0">
													<p className="text-sm font-medium text-white truncate">
														{r.customer?.name || "Verified customer"}
													</p>
													<p className="flex items-center gap-1 text-xs text-stone-500">
														<BadgeCheck
															size={12}
															className="text-emerald-400 shrink-0"
														/>
														Verified booking
													</p>
												</div>
											</div>

											<div className="flex flex-col items-end gap-1 shrink-0">
												<Stars value={rating} />
												<time className="text-xs text-stone-500">
													{dateStr}
												</time>
											</div>
										</div>

										{/* Comment */}
										<p className="mt-5 text-[15px] leading-[1.7] text-stone-200 max-w-3xl">
											{r.comment}
										</p>

										{/* Tags */}
										{Array.isArray(r.tags) && r.tags.length > 0 && (
											<div className="mt-4 flex flex-wrap gap-1.5">
												{r.tags.map((tag, i) => (
													<span
														key={i}
														className="px-2.5 py-1 rounded-md bg-white/[0.05] text-[11px] text-stone-400"
													>
														{tag}
													</span>
												))}
											</div>
										)}

										{/* Meta line */}
										<div className="mt-5 pt-4 border-t border-white/[0.06] flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
											<span className="text-stone-300 font-medium">
												{r.service_name || "Completed service"}
											</span>
											{bookingRef && (
												<>
													<span aria-hidden>·</span>
													<span className="font-mono">
														Booking {bookingRef}
													</span>
												</>
											)}
											{r.customer?.custom_id && (
												<>
													<span aria-hidden>·</span>
													<span className="font-mono">
														{r.customer.custom_id}
													</span>
												</>
											)}
										</div>
									</article>
								);
							})}
						</div>
					</>
				)}
			</section>
		</div>
	);
}
