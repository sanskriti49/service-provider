import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { StarIcon } from "@heroicons/react/24/solid";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
	ArrowLeft,
	ChevronDown,
	Clock,
	Calendar,
	CheckCircle2,
	MapPin,
	Navigation,
	SlidersHorizontal,
	Sparkles,
	MessageSquare,
	Star,
	ThumbsUp,
} from "lucide-react";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { UNIT_LABELS } from "../utils/pricingHelper";
import ReviewModal from "../ui/ReviewModal";
import { apiCache } from "../utils/apiCache";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const formatTime = (timeStr) => {
	if (!timeStr) return "";
	const [hours, minutes] = timeStr.split(":");
	const date = new Date();
	date.setHours(parseInt(hours, 10));
	date.setMinutes(parseInt(minutes, 10));

	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
};

const ServiceDetails = () => {
	const { slug } = useParams();

	const [service, setService] = useState(null);
	const navigate = useNavigate();
	const [providers, setProviders] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [expandedIndex, setExpandedIndex] = useState(-1);
	const [userCoords, setUserCoords] = useState(null);
	const [sortBy, setSortBy] = useState("recommended");
	const [isLocating, setIsLocating] = useState(false);

	const mainRef = useRef(null);
	const headerRef = useRef(null);
	const contentRef = useRef(null);
	const scrollRef = useRef(null);

	const isAnyExpanded = expandedIndex !== -1;

	useEffect(() => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(pos) => {
					setUserCoords({
						lat: pos.coords.latitude,
						lng: pos.coords.longitude,
					});
				},
				() => {
					console.log("Geolocation prompt dismissed or denied.");
				},
				{ timeout: 3000, enableHighAccuracy: false },
			);
		}
	}, []);

	const requestLocation = () => {
		if (!navigator.geolocation) return;
		setIsLocating(true);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setUserCoords({
					lat: pos.coords.latitude,
					lng: pos.coords.longitude,
				});
				setIsLocating(false);
			},
			() => {
				setIsLocating(false);
			},
			{ timeout: 5000 },
		);
	};

	useEffect(() => {
		if (!slug) return;
		async function fetchServiceAndProviders() {
			try {
				setLoading(true);
				setError(null);

				const cacheKeyService = `service_${slug}`;
				let serviceData = apiCache.get(cacheKeyService);
				if (!serviceData) {
					const serviceRes = await fetch(`${API_URL}/api/services/v1/${slug}`);
					if (!serviceRes.ok) throw new Error("Service not found");
					serviceData = await serviceRes.json();
					apiCache.set(cacheKeyService, serviceData, 300000);
				}
				setService(serviceData);

				const params = new URLSearchParams({
					service: slug,
					sort_by: sortBy,
					...(userCoords?.lat && { lat: String(userCoords.lat) }),
					...(userCoords?.lng && { lng: String(userCoords.lng) }),
				});

				const cacheKeyProviders = `providers_${slug}_${sortBy}_${userCoords?.lat || ""}`;
				let providersData = apiCache.get(cacheKeyProviders);
				if (!providersData) {
					const providersRes = await fetch(
						`${API_URL}/api/providers/v1?${params.toString()}`,
					);
					if (!providersRes.ok) throw new Error("Could not fetch providers");
					providersData = await providersRes.json();
					apiCache.set(cacheKeyProviders, providersData, 60000);
				}
				setProviders(Array.isArray(providersData) ? providersData : []);
			} catch (err) {
				console.error("Error fetching providers:", err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}
		fetchServiceAndProviders();
	}, [slug, userCoords?.lat, userCoords?.lng, sortBy]);

	useEffect(() => {
		if (!loading && service && mainRef.current) {
			let ctx = gsap.context(() => {
				const tl = gsap.timeline({
					scrollTrigger: {
						trigger: mainRef.current,
						start: "top top",
						end: "+=500",
						scrub: 1,
					},
				});
				tl.to(headerRef.current.querySelector("img"), {
					opacity: 0.3,
					ease: "power1.inOut",
				});
				tl.to(
					headerRef.current.querySelector("#header-content"),
					{
						opacity: 0,
						y: -50,
						ease: "power1.inOut",
					},
					0,
				);

				ScrollTrigger.create({
					trigger: headerRef.current,
					start: "top top",
					end: `bottom+=${contentRef.current.offsetHeight} top`,
					pin: true,
					pinSpacing: false,
				});

				gsap.to(scrollRef.current, {
					y: -10,
					repeat: -1,
					yoyo: true,
					ease: "sine.inOut",
					duration: 1,
				});

				gsap.to(scrollRef.current, {
					scrollTrigger: {
						trigger: headerRef.current,
						start: "top top",
						end: "+=300",
						scrub: true,
					},
					opacity: 0,
					scale: 0.5,
				});
			}, mainRef);

			return () => ctx.revert();
		}
	}, [loading, service]);

	const handleScrollDown = () => {
		gsap.to(window, {
			duration: 0.5,
			scrollTo: contentRef.current,
			ease: "power2.inOut",
		});
	};

	const handleToggleExpand = (index) => {
		setExpandedIndex((prevIndex) => (prevIndex === index ? -1 : index));
	};

	if (loading) {
		return <ServiceDetailsSkeleton />;
	}

	if (!service || (providers.length === 0 && !loading)) {
		return (
			<section className="bg-[#191034] text-white min-h-screen flex items-center justify-center p-4">
				<div className="text-center">
					<h2 className="text-3xl font-bold bricolage-grotesque">
						{service ? "No Providers Available Yet" : "Service Not Found"}
					</h2>
					<p className="inter text-gray-400 mt-3 max-w-md">
						{service
							? "We're working on adding experts for this service. Please check back later."
							: "The service you're looking for might have been moved or doesn't exist :("}
					</p>
					<Link
						to="/"
						className="inter mt-8 inline-block bg-violet-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-violet-700 transition-colors"
					>
						Go Back Home
					</Link>
				</div>
			</section>
		);
	}

	const handleGoBack = () => {
		if (window.history.length > 1) {
			navigate(-1);
		} else {
			navigate("/");
		}
	};

	return (
		<section ref={mainRef} className="bg-[#191034] text-white">
			<div ref={headerRef} className="relative z-10 h-[90vh] w-full">
				<div className="sticky top-0 h-full w-full flex flex-col">
					<div
						onClick={handleGoBack}
						className="cursor-pointer z-[20] m-10 p-2 w-16 h-16 rounded-full border border-violet-400/50 flex items-center justify-center bg-black/20 backdrop-blur-sm text-violet-300 hover:bg-violet-500/20 hover:border-violet-400 transition-all duration-300"
					>
						<ArrowLeft />
					</div>
					<img
						src={service.image_url}
						alt={service.name}
						className="absolute inset-0 w-full h-full object-cover opacity-50"
					/>

					<div className="absolute inset-0 bg-gradient-to-t from-[#191034] via-[#191034]/70 to-transparent"></div>
					<div
						id="header-content"
						className="relative z-10 mt-auto p-8 md:p-12 lg:p-14 w-full max-w-7xl mx-auto text-left"
					>
						<h1 className="text-5xl md:text-6xl lg:text-6xl bricolage-grotesque text-white font-bold [text-shadow:_0_2px_10px_rgb(0_0_0_/_0.5)]">
							{service.name}
						</h1>
						<p className="inter mt-4 max-w-xl text-gray-300 text-base md:text-lg [text-shadow:_0_1px_5px_rgb(0_0_0_/_0.5)]">
							{service.description}
						</p>
					</div>
				</div>
			</div>

			<div
				ref={scrollRef}
				onClick={handleScrollDown}
				className="fixed right-8 -translate-x-1/2 z-20 cursor-pointer"
			>
				<div className="w-12 h-12 rounded-full border border-violet-400/50 flex items-center justify-center bg-black/20 backdrop-blur-sm text-violet-300 hover:bg-violet-500/20 hover:border-violet-400 transition-all duration-300">
					<ChevronDown size={28} />
				</div>
			</div>

			<div
				ref={contentRef}
				className="inter relative z-20 bg-[#191034] max-w-7xl mt-10 mx-auto py-16 sm:py-10 px-4 sm:px-6 lg:px-8 rounded-t-3xl border-t border-violet-800/50 shadow-2xl shadow-black/50"
			>
				<div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 pb-4 border-b border-white/5">
					<div>
						<h2 className="text-3xl sm:text-4xl font-bold text-gray-200 bricolage-grotesque">
							Available Experts
						</h2>
						<p className="mt-1 text-gray-400 text-sm">
							Matched by proximity, customer reviews, and verified expertise.
						</p>
					</div>

					<div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
						{!userCoords ? (
							<button
								onClick={requestLocation}
								disabled={isLocating}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 text-xs font-semibold transition-all cursor-pointer"
							>
								<Navigation size={12} className={isLocating ? "animate-spin" : ""} />
								<span>{isLocating ? "Locating..." : "Use My Location"}</span>
							</button>
						) : (
							<div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-medium">
								<MapPin size={12} />
								<span>Location active</span>
							</div>
						)}

						<div className="flex items-center gap-2 bg-[#22194A] border border-white/10 px-3 py-1.5 rounded-xl text-xs">
							<SlidersHorizontal size={12} className="text-violet-400" />
							<span className="text-gray-400">Sort by:</span>
							<select
								value={sortBy}
								onChange={(e) => setSortBy(e.target.value)}
								className="bg-transparent text-white font-semibold outline-none cursor-pointer"
							>
								<option value="recommended" className="bg-[#191034]">Recommended</option>
								<option value="distance" className="bg-[#191034]">Nearest First</option>
								<option value="rating" className="bg-[#191034]">Top Rated</option>
								<option value="price_asc" className="bg-[#191034]">Price: Low to High</option>
							</select>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
					{providers.map((p, index) => (
						<ProviderCard
							key={p.user_id || index}
							provider={p}
							service={service}
							userCoords={userCoords}
							isExpanded={expandedIndex === index}
							isAnyExpanded={isAnyExpanded}
							onToggleExpand={() => handleToggleExpand(index)}
						/>
					))}
				</div>
			</div>
		</section>
	);
};

const ProviderCard = ({
	provider,
	service,
	userCoords,
	isExpanded,
	isAnyExpanded,
	onToggleExpand,
}) => {
	const navigate = useNavigate();

	const [activeTab, setActiveTab] = useState("schedule");
	const [availability, setAvailability] = useState([]);
	const [loadingSlots, setLoadingSlots] = useState(false);
	const [hasLoadedSlots, setHasLoadedSlots] = useState(false);

	const [reviewsData, setReviewsData] = useState(null);
	const [loadingReviews, setLoadingReviews] = useState(false);
	const [showReviewModal, setShowReviewModal] = useState(false);

	const [selectedDateStr, setSelectedDateStr] = useState(null);
	const [selectedTime, setSelectedTime] = useState(null);
	const dateScrollRef = useRef(null);

	const loadAvailability = async () => {
		if (hasLoadedSlots) return;
		setLoadingSlots(true);

		try {
			const today = new Date();
			const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

			const params = new URLSearchParams({
				from: todayStr,
				days: "14",
				service: service?.slug || "",
				...(userCoords?.lat && { lat: String(userCoords.lat) }),
				...(userCoords?.lng && { lng: String(userCoords.lng) }),
			});

			const providerIdentifier = provider.user_id || provider.id || provider.custom_id;
			const cacheKey = `avail_${providerIdentifier}_${todayStr}_${userCoords?.lat || ""}`;
			let data = apiCache.get(cacheKey);

			if (!data) {
				const res = await fetch(
					`${API_URL}/api/providers/v1/${providerIdentifier}/availability?${params.toString()}`,
				);
				if (!res.ok) throw new Error("Failed to load slots");
				data = await res.json();
				apiCache.set(cacheKey, data, 60000);
			}

			setAvailability(
				Array.isArray(data.availability) ? data.availability : [],
			);
			setHasLoadedSlots(true);
		} catch (error) {
			console.error("Availability error:", error);
			setAvailability([]);
		} finally {
			setLoadingSlots(false);
		}
	};

	const loadReviews = async () => {
		if (reviewsData) return;
		setLoadingReviews(true);
		try {
			const providerIdentifier = provider.user_id || provider.id || provider.custom_id;
			const cacheKey = `reviews_${providerIdentifier}`;
			let data = apiCache.get(cacheKey);

			if (!data) {
				const res = await fetch(`${API_URL}/api/reviews/provider/${providerIdentifier}`);
				if (res.ok) {
					data = await res.json();
					apiCache.set(cacheKey, data, 120000);
				}
			}
			setReviewsData(data);
		} catch (err) {
			console.error("Failed to load reviews:", err);
		} finally {
			setLoadingReviews(false);
		}
	};

	const handleOpenSchedule = () => {
		setActiveTab("schedule");
		onToggleExpand();
		if (!isExpanded) {
			loadAvailability();
		}
	};

	const handleOpenReviews = () => {
		setActiveTab("reviews");
		if (!isExpanded) onToggleExpand();
		loadReviews();
	};

	const processedData = useMemo(() => {
		const validData = {};

		availability.forEach((dayGroup) => {
			const dateStr = dayGroup.date;
			const slots = dayGroup.free_slots || [];

			const now = new Date();
			const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
			const isToday = dateStr === todayStr;

			const validTimes = slots
				.filter((t) => {
					const sStart = t.start_time || t.start;
					if (!sStart) return false;
					if (!isToday) return true;

					const [h, m] = sStart.split(":").map(Number);
					const slotTime = new Date();
					slotTime.setHours(h, m, 0, 0);

					return slotTime > new Date();
				})
				.map((t) => ({
					start: t.start_time || t.start,
					end: t.end_time || t.end,
					start_time: t.start_time || t.start,
					end_time: t.end_time || t.end,
				}))
				.sort((a, b) => a.start.localeCompare(b.start));

			if (validTimes.length > 0) {
				validData[dateStr] = validTimes;
			}
		});

		return validData;
	}, [availability]);

	const validDates = Object.keys(processedData);

	useEffect(() => {
		if (validDates.length > 0 && !selectedDateStr) {
			setSelectedDateStr(validDates[0]);
		}
	}, [validDates, selectedDateStr]);

	useEffect(() => {
		setSelectedTime(null);
	}, [selectedDateStr]);

	useEffect(() => {
		if (!isExpanded) return;

		const handleEsc = (e) => {
			if (e.key === "Escape") {
				onToggleExpand();
			}
		};
		window.addEventListener("keydown", handleEsc);

		return () => window.removeEventListener("keydown", handleEsc);
	}, [isExpanded, onToggleExpand]);

	return (
		<div
			className={`
    relative flex flex-col bg-[#22194A] rounded-3xl overflow-hidden
    transition-all duration-300 border border-white/5
    ${
		isExpanded
			? "ring-2 ring-violet-500/60 shadow-2xl shadow-violet-900/30 scale-[1.02]"
			: isAnyExpanded
				? "opacity-60 pointer-events-none"
				: "hover:-translate-y-2 hover:shadow-2xl hover:shadow-violet-900/30 hover:border-violet-500/30"
	}
  `}
		>
			<div className="p-7">
				<div className="flex gap-5 items-start">
					<div className="relative">
						<div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/10 shadow-lg">
							<img
								src={
									provider.photo ||
									`https://ui-avatars.com/api/?name=${encodeURIComponent(provider.name)}&background=6d28d9&color=fff`
								}
								alt={provider.name}
								className="w-full h-full object-cover"
							/>
						</div>

						<div className="absolute -bottom-3 -right-2 bg-[#1a103f] border border-violet-500/30 px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
							<StarIcon className="h-3.5 w-3.5 text-yellow-400" />
							<span className="text-xs font-bold text-white">
								{provider.rating ? Number(provider.rating).toFixed(1) : "5.0"}
							</span>
						</div>
					</div>

					<div className="flex-1 min-w-0 pt-1">
						<h3 className="plus-jakarta-sans font-bold text-[22px] text-white truncate">
							{provider.name}
						</h3>
						<div className="flex items-center gap-2 text-xs text-violet-300/80 mt-1 mb-2.5">
							<div className="flex items-center gap-1">
								<CheckCircle2 size={12} className="text-green-400" />
								<span>Verified</span>
							</div>

							{provider.distance_km != null && (
								<div className="flex items-center gap-1 text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-md text-[11px] font-medium border border-violet-500/20">
									<MapPin size={10} className="text-violet-400" />
									<span>{provider.distance_km} km</span>
								</div>
							)}
						</div>

						<div className="flex items-center justify-between">
							<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-200 text-sm">
								<span className="font-bold">₹{provider.price}</span>
								<span className="text-xs opacity-60 font-normal">
									/{" "}
									{UNIT_LABELS[provider.price_unit] ||
										provider.price_unit ||
										"Fixed Rate"}
								</span>
							</div>

							<button
								onClick={handleOpenReviews}
								className="text-xs text-violet-300 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
							>
								<MessageSquare size={12} />
								<span>Reviews</span>
							</button>
						</div>
					</div>
				</div>

				<p className="text-md text-gray-400 mt-6 leading-relaxed line-clamp-2">
					{provider.bio ||
						"Experienced professional dedicated to delivering high-quality service tailored to your specific needs."}
				</p>
			</div>

			<div className="bg-black/20 border-t border-white/5 transition-all duration-500 ease-in-out">
				<div className="p-4 flex gap-2">
					<button
						onClick={handleOpenSchedule}
						disabled={loadingSlots}
						className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
							isExpanded && activeTab === "schedule"
								? "bg-white/10 text-violet-200 border border-white/20"
								: "bg-violet-500/20 text-violet-200 border border-violet-500/30 hover:bg-violet-500/30"
						}`}
					>
						{loadingSlots ? (
							<>
								<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
								<span>Loading...</span>
							</>
						) : isExpanded && activeTab === "schedule" ? (
							"Close Schedule"
						) : (
							"Check Availability"
						)}
					</button>

					<button
						onClick={handleOpenReviews}
						className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
							isExpanded && activeTab === "reviews"
								? "bg-amber-500/30 text-amber-200 border border-amber-500/40"
								: "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
						}`}
					>
						<Star size={14} className="text-yellow-400" />
						<span>Reviews</span>
					</button>
				</div>

				<div
					className={`overflow-hidden transition-all duration-500 ease-in-out ${
						isExpanded ? "max-h-[460px] opacity-100" : "max-h-0 opacity-0"
					}`}
				>
					{activeTab === "schedule" && (
						<div className="px-6 pb-6">
							{!loadingSlots && validDates.length === 0 && (
								<div className="text-center py-8 bg-white/5 rounded-2xl border border-dashed border-white/10">
									<Calendar className="w-10 h-10 text-violet-300/20 mx-auto mb-3" />
									<p className="text-gray-400 text-sm">
										No upcoming slots available.
									</p>
								</div>
							)}

							{validDates.length > 0 && (
								<div className="space-y-4">
									<div>
										<h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
											Select Date
										</h4>
										<div
											ref={dateScrollRef}
											className="flex gap-2 overflow-x-auto pb-4 snap-x -mx-2 px-2 custom-scrollbar-x momentum-scroll"
										>
											{validDates.map((dateStr) => {
												const isSelected = selectedDateStr === dateStr;
												const [yr, mo, dy] = dateStr.split("-").map(Number);
												const dObj = new Date(yr, mo - 1, dy);
												return (
													<button
														key={dateStr}
														onClick={() => setSelectedDateStr(dateStr)}
														className={`flex-shrink-0 snap-start px-4 py-2.5 rounded-xl border text-md font-medium transition-all duration-200 min-w-[80px] cursor-pointer ${
															isSelected
																? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/40"
																: "bg-[#1a103f] border-white/10 text-gray-400 hover:border-violet-500/50 hover:text-white"
														}`}
													>
														<div className="text-xs opacity-70">
															{dObj.toLocaleString("en-US", {
																weekday: "short",
															})}
														</div>
														<div className="font-bold">
															{dObj.getDate()}
														</div>
													</button>
												);
											})}
										</div>
									</div>

									{selectedDateStr && processedData[selectedDateStr] && (
										<div className="animate-fade-in">
											<div className="flex items-center justify-between mb-3">
												<h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
													Select Time
												</h4>
												<span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300 flex items-center gap-1">
													<Clock size={10} />{" "}
													{processedData[selectedDateStr].length} slots
												</span>
											</div>

											<div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar-y">
												{processedData[selectedDateStr].map((slot, idx) => {
													const isSelected = selectedTime?.start === slot.start;
													return (
														<button
															key={`${slot.start}-${idx}`}
															onClick={() => setSelectedTime(slot)}
															className={`text-xs py-2 rounded-lg transition-all duration-200 border cursor-pointer ${
																isSelected
																	? "bg-white text-violet-900 font-bold border-white shadow-md scale-95"
																	: "bg-white/5 border-transparent text-gray-300 hover:bg-white/10 hover:border-white/20"
															}`}
														>
															{formatTime(slot.start)} - {formatTime(slot.end)}
														</button>
													);
												})}
											</div>
										</div>
									)}

									<div className="flex justify-center mt-4">
										<button
											disabled={!selectedTime}
											onClick={() =>
												navigate(`/book/${provider.custom_id}`, {
													state: {
														provider: {
															...provider,
															service_id: provider.service_id,
														},
														serviceName: service.name,
														preloadedAvailability: availability,
														selectedDateStr,
														selectedSlot: {
															date: selectedDateStr,
															start_time: selectedTime?.start_time || selectedTime?.start,
															end_time: selectedTime?.end_time || selectedTime?.end,
															start: selectedTime?.start_time || selectedTime?.start,
															end: selectedTime?.end_time || selectedTime?.end,
														},
													},
												})
											}
											className={`inline-flex items-center justify-center gap-2 w-full btn-xl btn-purple btn-border-dark px-7 py-3 rounded-lg group/btn transition-all cursor-pointer ${
												selectedTime
													? "opacity-100 hover:scale-[1.02]"
													: "opacity-40 cursor-not-allowed pointer-events-none"
											}`}
										>
											<span>Continue to Booking</span>
										</button>
									</div>
								</div>
							)}
						</div>
					)}

					{activeTab === "reviews" && (
						<div className="px-6 pb-6 space-y-4">
							{loadingReviews ? (
								<div className="text-center py-8">
									<div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
									<p className="text-xs text-gray-400">Loading reviews...</p>
								</div>
							) : (
								<>
									<div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10">
										<div className="flex items-center gap-3">
											<div className="text-3xl font-bold text-white">
												{reviewsData?.average_rating ? Number(reviewsData.average_rating).toFixed(1) : (provider.rating || "5.0")}
											</div>
											<div>
												<div className="flex items-center gap-0.5">
													{[1, 2, 3, 4, 5].map((s) => (
														<Star
															key={s}
															size={13}
															className={
																s <= Math.round(reviewsData?.average_rating || provider.rating || 5)
																	? "text-yellow-400 fill-yellow-400"
																	: "text-gray-600"
															}
														/>
													))}
												</div>
												<span className="text-[11px] text-gray-400">
													Based on {reviewsData?.total_reviews || 0} reviews
												</span>
											</div>
										</div>

										<button
											onClick={() => setShowReviewModal(true)}
											className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
										>
											Rate Expert
										</button>
									</div>

									<div className="max-h-48 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar-y">
										{reviewsData?.reviews && reviewsData.reviews.length > 0 ? (
											reviewsData.reviews.map((rev) => (
												<div
													key={rev.id}
													className="p-3 bg-black/20 rounded-xl border border-white/5 text-xs space-y-1.5"
												>
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2">
															<span className="font-bold text-white">
																{rev.customer?.name || "Customer"}
															</span>
															<div className="flex items-center gap-0.5">
																{[...Array(rev.rating || 5)].map((_, i) => (
																	<Star
																		key={i}
																		size={10}
																		className="text-yellow-400 fill-yellow-400"
																	/>
																))}
															</div>
														</div>
														<span className="text-[10px] text-gray-500">
															{new Date(rev.created_at).toLocaleDateString("en-US", {
																month: "short",
																day: "numeric",
															})}
														</span>
													</div>

													{rev.comment && (
														<p className="text-gray-300 text-xs leading-relaxed">
															"{rev.comment}"
														</p>
													)}

													{rev.tags && rev.tags.length > 0 && (
														<div className="flex flex-wrap gap-1 pt-0.5">
															{rev.tags.map((t, idx) => (
																<span
																	key={idx}
																	className="text-[9px] bg-violet-500/15 text-violet-300 px-1.5 py-0.5 rounded-md border border-violet-500/20"
																>
																	{t}
																</span>
															))}
														</div>
													)}
												</div>
											))
										) : (
											<div className="text-center py-6 text-xs text-gray-400">
												No reviews yet. Be the first to review {provider.name}!
											</div>
										)}
									</div>
								</>
							)}
						</div>
					)}
				</div>
			</div>

			<ReviewModal
				isOpen={showReviewModal}
				onClose={() => setShowReviewModal(false)}
				providerId={provider.user_id || provider.id}
				providerName={provider.name}
				onReviewSubmitted={(newReview) => {
					loadReviews();
				}}
			/>
		</div>
	);
};

const ServiceDetailsSkeleton = () => (
	<section className="bg-[#191034] min-h-screen pb-20">
		<div className="relative">
			<div className="w-full h-80 bg-gray-800 opacity-30"></div>
			<div className="absolute inset-0 flex flex-col justify-center items-center text-center p-4">
				<div className="h-12 w-3/5 bg-gray-700 rounded-md animate-pulse"></div>
				<div className="h-4 w-4/5 mt-4 bg-gray-700 rounded-md animate-pulse"></div>
			</div>
		</div>
		<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16">
			<div className="h-8 w-1/3 bg-gray-700 rounded-md mb-6 animate-pulse"></div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
				{[...Array(3)].map((_, i) => (
					<SkeletonCard key={i} />
				))}
			</div>
		</div>
	</section>
);

const SkeletonCard = () => (
	<div className="bg-[#22194A] rounded-xl shadow-lg border border-violet-900/50 p-6 animate-pulse">
		<div className="flex items-start gap-4">
			<div className="w-20 h-20 rounded-full bg-gray-700 flex-shrink-0"></div>
			<div className="flex-1 space-y-2">
				<div className="h-6 w-3/4 bg-gray-700 rounded-md"></div>
				<div className="h-4 w-full bg-gray-700 rounded-md"></div>
				<div className="h-4 w-1/2 bg-gray-700 rounded-md"></div>
			</div>
		</div>
		<div className="mt-6 h-10 w-full bg-gray-700 rounded-md"></div>
		<div className="mt-4 h-12 w-full bg-gray-700 rounded-md"></div>
	</div>
);

export default ServiceDetails;
