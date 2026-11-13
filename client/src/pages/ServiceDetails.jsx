import { useParams, Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { StarIcon } from "@heroicons/react/24/solid";
import {
	ArrowLeft,
	ArrowDown,
	ArrowRight,
	Clock,
	Calendar,
	MapPin,
	Navigation,
	SlidersHorizontal,
	Sparkles,
	Star,
} from "lucide-react";
import { UNIT_LABELS } from "../utils/pricingHelper";
import ReviewModal from "../ui/ReviewModal";
import { apiCache } from "../utils/apiCache";
import VerifiedBadge from "../ui/VerifiedBadge";
import TaskGenieLoader from "../ui/TaskGenieLoader";
import CustomerServiceLocation from "../ui/CustomerServiceLocation";
import useModal from "../hooks/useModal";

import { API_URL } from "../config";
import {
	locationParams,
	requestCacheKey,
	createRequestGuard,
	serviceLocation,
	indiaDate,
	validCoordinates,
	reverseLocation,
} from "../utils/serviceLocation";
import "./ServiceDetails.css";
import Logo from "../ui/Logo";

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

	const navigate = useNavigate();
	const [serviceResult, setServiceResult] = useState(null);
	const [providerResult, setProviderResult] = useState(null);
	const [expandedIndex, setExpandedIndex] = useState(-1);
	const [userCoords, setUserCoords] = useState(null);
	const [locationState, setLocationState] = useState("resolving");
	const [sortBy, setSortBy] = useState("recommended");
	const [radius, setRadius] = useState(50);
	const [retry, setRetry] = useState(0);
	const providerRequests = useRef(createRequestGuard());
	const locationRevision = useRef(0);
	const locationTimer = useRef(null);
	const contentRef = useRef(null);

	const service = serviceResult?.slug === slug ? serviceResult.data : null;
	const serviceLoading = serviceResult?.slug !== slug;
	const hasLocation = locationState === "ready" && validCoordinates(userCoords?.lat, userCoords?.lng);
	const lat = hasLocation ? userCoords.lat : null;
	const lng = hasLocation ? userCoords.lng : null;
	const filterKey = hasLocation && slug ? requestCacheKey("providers", {
		service: slug, sort_by: sortBy, radius: String(radius), lat: String(lat), lng: String(lng),
	}) : null;
	const currentResult = filterKey && providerResult?.key === filterKey ? providerResult : null;
	const providers = currentResult?.data || [];
	const error = currentResult?.error || null;
	const providersLoading = locationState === "resolving" || (hasLocation && !currentResult);
	const isLocating = locationState === "resolving";

	const requestLocation = useCallback(() => {
		const revision = ++locationRevision.current;
		clearTimeout(locationTimer.current);
		setProviderResult(null);
		setUserCoords(null);
		setLocationState("resolving");
		if (!navigator.geolocation) {
			setLocationState("unavailable");
			return;
		}
		const fail = (code) => {
			if (revision !== locationRevision.current) return;
			++locationRevision.current;
			clearTimeout(locationTimer.current);
			setLocationState(code === 1 ? "denied" : code === 3 ? "timeout" : "unavailable");
		};
		// Also bound the wait when a browser leaves the permission prompt unanswered.
		locationTimer.current = setTimeout(() => fail(3), 11000);
		try {
			navigator.geolocation.getCurrentPosition((pos) => {
				if (revision !== locationRevision.current) return;
				const { latitude, longitude } = pos.coords;
				if (!validCoordinates(latitude, longitude)) { fail(2); return; }
				clearTimeout(locationTimer.current);
				setUserCoords(serviceLocation({ lat: latitude, lng: longitude, address: "Current Location", source: "browser" }));
				setLocationState("ready");
				reverseLocation(latitude, longitude).then((resolved) => {
					if (revision === locationRevision.current) {
						setUserCoords((previous) => previous && previous.lat === latitude && previous.lng === longitude
							? { ...previous, address: resolved.address } : previous);
					}
				}).catch(() => {});
			}, (failure) => fail(failure?.code), { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 });
		} catch {
			fail(2);
		}
	}, []);

	useEffect(() => {
		const revisions = locationRevision;
		const timer = locationTimer;
		requestLocation();
		return () => { ++revisions.current; clearTimeout(timer.current); };
	}, [requestLocation]);

	useEffect(() => {
		if (!slug) return;
		const controller = new AbortController();
		const key = requestCacheKey("service", { slug });
		const load = async () => {
			try {
				let data = apiCache.get(key);
				if (!data) {
					const response = await fetch(`${API_URL}/api/services/v1/${slug}`, { signal: controller.signal });
					if (!response.ok) throw new Error("Service not found");
					data = await response.json();
					if (!controller.signal.aborted) apiCache.set(key, data, 300000);
				}
				if (!controller.signal.aborted) setServiceResult({ slug, data });
			} catch {
				if (!controller.signal.aborted) setServiceResult({ slug, data: null });
			}
		};
		load();
		return () => controller.abort();
	}, [slug]);

	useEffect(() => {
		if (!filterKey) return;
		const request = providerRequests.current.begin();
		const params = { service: slug, sort_by: sortBy, radius: String(radius), ...locationParams({ lat, lng }) };
		const load = async () => {
			try {
				let data = apiCache.get(filterKey);
				if (!data) {
					const response = await fetch(`${API_URL}/api/providers/v1?${new URLSearchParams(params)}`, { signal: request.signal });
					if (!response.ok) {
						const failure = await response.json().catch(() => ({}));
						throw new Error(failure.error || "Couldn't load providers. Please try again.");
					}
					data = await response.json();
					if (!Array.isArray(data)) throw new Error("Couldn't load providers.");
					if (request.current()) apiCache.set(filterKey, data, 15000);
				}
				if (request.current()) { setProviderResult({ key: filterKey, data }); setExpandedIndex(-1); }
			} catch (err) {
				if (request.current()) setProviderResult({ key: filterKey, error: err.message });
			}
		};
		load();
		return request.cancel;
	}, [filterKey, slug, sortBy, radius, lat, lng, retry]);

	const handleScrollDown = () => {
		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		contentRef.current?.scrollIntoView({
			behavior: reducedMotion ? "auto" : "smooth",
		});
	};

	const handleToggleExpand = (index) => {
		setExpandedIndex((prevIndex) => (prevIndex === index ? -1 : index));
	};

	if (serviceLoading && !service) {
		return (
			<TaskGenieLoader
				fullScreen
				message="Loading Available Experts"
				submessage="Finding verified professionals for your request..."
			/>
		);
	}

	if (!service && !serviceLoading) {
		return (
			<section className="bg-[#191034] text-white min-h-screen flex items-center justify-center p-4">
				<div className="text-center max-w-lg mx-auto">
					<div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-xl shadow-violet-900/30">
						<Sparkles size={32} />
					</div>
					<h2 className="text-3xl font-bold bricolage-grotesque">
						{service ? "No Providers Available Yet" : "Service Not Found"}
					</h2>
					<p className="font-geist text-gray-300 mt-3 text-sm leading-relaxed">
						{service
							? "We're currently expanding our network of verified professionals for this category. In the meantime, check out other popular services or reach out to our support team."
							: "The service you're looking for might have been moved or doesn't exist :("}
					</p>
					<div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
						<Link
							to="/services"
							className="font-geist inline-flex items-center gap-2 bg-violet-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-violet-500 transition-all shadow-lg shadow-violet-900/40 cursor-pointer"
						>
							<span>Explore All Services</span>
						</Link>
						<Link
							to="/"
							className="font-geist inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-6 py-3 rounded-xl font-semibold border border-white/10 transition-all cursor-pointer"
						>
							<span>Go Back Home</span>
						</Link>
					</div>
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
		<section className="sd-page">
			<header className="sd-hero">
				<div className="sd-shell">
					<div className="sd-topbar">
						<button type="button" onClick={handleGoBack} className="sd-back">
							<ArrowLeft size={16} aria-hidden="true" />{" "}
							<span>Back to services</span>
						</button>
						<Logo to="/" size="lg" theme="dark" />
						<span className="sd-topbar-note">
							A LITTLE HELP GOES A LONG WAY
						</span>
					</div>
					<div className="sd-hero-grid">
						<div className="sd-hero-copy">
							<div className="sd-eyebrow">
								<span aria-hidden="true">✳</span> YOUR SERVICE GUIDE
							</div>
							<h1>
								{service.name}
								<span className="sd-title-dot">.</span>
							</h1>
							<p>
								{service.description ||
									"Find the right person for the task you have in mind."}
							</p>
							<button
								type="button"
								onClick={handleScrollDown}
								className="sd-hero-cta"
							>
								Explore professionals <ArrowDown size={17} aria-hidden="true" />
							</button>
							<div className="sd-hero-caption">
								<span>01 / FIND YOUR FIT</span>
								<span>YOUR TASK, YOUR WAY</span>
							</div>
						</div>
						<div className="sd-hero-art">
							<div className="sd-art-frame">
								<img
									src={
										service.image_url || "/images/illustrations/workbench.webp"
									}
									alt={service.name}
								/>
							</div>
							<div className="sd-art-sticker" aria-hidden="true">
								<Sparkles size={19} />
								<span>
									GOOD THINGS
									<br />
									START HERE
								</span>
							</div>
							<span className="sd-art-number" aria-hidden="true">
								✳
							</span>
						</div>
					</div>
				</div>
			</header>

			<div ref={contentRef} className="sd-content" id="service-professionals">
				<div className="sd-shell">
					<div className="sd-section-heading">
						<div>
							<p className="sd-section-kicker">
								<span>✳</span> EXPLORE YOUR OPTIONS
							</p>
							<h2>
								Meet the professionals<span>.</span>
							</h2>
							<p className="sd-section-description">
								Compare rates, read reviews and find a time that works for you.
							</p>
						</div>
					</div>

					<div className="sd-discovery">
						<div className="sd-discovery-heading">
							<div className="sd-location-icon">
								<MapPin size={19} aria-hidden="true" />
							</div>
							<div>
								<strong>Where do you need a hand?</strong>
								<span>Set your service address to find people nearby.</span>
							</div>
						</div>
						<div className="sd-location-row">
							<div className="sd-location-picker">
								<CustomerServiceLocation
									value={userCoords}
									onChange={(location) => {
										locationRevision.current++;
										clearTimeout(locationTimer.current);
										setUserCoords(location);
										setLocationState(validCoordinates(location?.lat, location?.lng) ? "ready" : "unavailable");
									}}
								/>
							</div>
							{!userCoords ? (
								<button
									type="button"
									onClick={requestLocation}
									disabled={isLocating}
									className="sd-location-button"
								>
									<Navigation
										size={15}
										className={isLocating ? "animate-spin" : ""}
										aria-hidden="true"
									/>
									{isLocating ? "Finding location..." : "Use my location"}
								</button>
							) : (
								<span className="sd-location-active">
									<MapPin size={14} aria-hidden="true" /> Location set
								</span>
							)}
						</div>
					</div>

					<div className="sd-results-bar">
						<p aria-live="polite">
							{providersLoading
								? "Finding providers near your location…"
								: !hasLocation
									? "Choose a location to see nearby providers"
								: error
									? "Unable to load professionals"
									: `${providers.length} ${providers.length === 1 ? "professional" : "professionals"} found`}
						</p>
						<div className="sd-filters">
							<label className="sd-filter">
								<span>Within</span>
								<select
									aria-label="Search radius"
									value={radius}
									onChange={(event) => setRadius(Number(event.target.value))}
									disabled={!userCoords}
								>
									{[25, 50, 100, 200, 500].map((km) => (
										<option key={km} value={km}>
											{km} km
										</option>
									))}
								</select>
							</label>
							<label className="sd-filter">
								<SlidersHorizontal size={14} aria-hidden="true" />
								<span>Sort by</span>
								<select
									aria-label="Sort professionals"
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value)}
								>
									<option value="recommended">Recommended</option>
									<option value="distance" disabled={!userCoords}>
										Nearest first
									</option>
									<option value="rating">Top rated</option>
									<option value="price_asc">Price: low to high</option>
								</select>
							</label>
						</div>
					</div>
					{error && (
						<div role="alert" className="sd-error">
							{error}
							<button
								type="button"
								onClick={() => { setProviderResult(null); setRetry((current) => current + 1); }}
							>
								Try again <ArrowRight size={14} aria-hidden="true" />
							</button>
						</div>
					)}
					<div className="sd-provider-grid" aria-busy={providersLoading}>
						{providersLoading ? (
							[...Array(2)].map((_, i) => <SkeletonCard key={i} />)
						) : !hasLocation ? (
							<div className="sd-empty" role="status">
								<MapPin size={24} aria-hidden="true" />
								<h3>{locationState === "denied" ? "Location permission is off" : locationState === "timeout" ? "Finding your location timed out" : "We couldn't find your location"}</h3>
								<p>{locationState === "denied" ? "Allow location access in your browser settings, or choose a service address above." : "Try again, or choose a service address above to see providers nearby."}</p>
								<button type="button" onClick={requestLocation}>Try again <ArrowRight size={15} aria-hidden="true" /></button>
							</div>
						) : (
							<>
								{!error && providers.length === 0 && (
									<div className="sd-empty">
										<Sparkles size={23} aria-hidden="true" />
										<h3>
											{userCoords
												? `No providers found within ${radius} km`
												: "No providers available for this service"}
										</h3>
										<p>
											{userCoords
												? "Try a wider search area. Your service and filters will stay selected."
												: "Share your service location to search nearby."}
										</p>
										{userCoords && radius < 500 && (
											<button
												type="button"
												onClick={() =>
													setRadius(
														radius < 100 ? 100 : Math.min(500, radius * 2),
													)
												}
											>
												Expand to{" "}
												{radius < 100 ? 100 : Math.min(500, radius * 2)} km{" "}
												<ArrowRight size={15} aria-hidden="true" />
											</button>
										)}
									</div>
								)}
								{providers.map((p, index) => (
									<ProviderCard
										key={p.user_id || index}
										provider={p}
										service={service}
										userCoords={userCoords}
										searchRadius={radius}
										isExpanded={expandedIndex === index}
										onToggleExpand={() => handleToggleExpand(index)}
									/>
								))}
							</>
						)}
					</div>
				</div>
			</div>
		</section>
	);
};

const ProviderCard = ({
	provider,
	service,
	userCoords,
	searchRadius,
	isExpanded,
	onToggleExpand,
}) => {
	const navigate = useNavigate();
	const panelId = useId();

	const [activeTab, setActiveTab] = useState("schedule"); // 'schedule' or 'reviews'
	const [availability, setAvailability] = useState([]);
	const [loadingSlots, setLoadingSlots] = useState(false);
	const [slotsError, setSlotsError] = useState(null);
	const slotRequests = useRef(createRequestGuard());
	useEffect(() => () => slotRequests.current.cancel(), []);

	const [reviewsData, setReviewsData] = useState(null);
	const [loadingReviews, setLoadingReviews] = useState(false);
	const [showReviewModal, setShowReviewModal] = useState(false);
	const [failedPhoto, setFailedPhoto] = useState(null);

	const [selectedDateStr, setSelectedDateStr] = useState(null);
	const [selectedTime, setSelectedTime] = useState(null);
	const dateScrollRef = useRef(null);

	const loadAvailability = async () => {
		if (!validCoordinates(userCoords?.lat, userCoords?.lng)) {
			slotRequests.current.cancel();
			setAvailability([]);
			setSelectedTime(null);
			setSlotsError(
				"Choose your service location above to check travel availability.",
			);
			setLoadingSlots(false);
			return;
		}
		const request = slotRequests.current.begin();
		setLoadingSlots(true);
		setSlotsError(null);
		setSelectedTime(null);
		try {
			const parameters = {
				from: indiaDate(),
				days: "14",
				service_id: String(provider.service_id || service?.id || ""),
				...locationParams(userCoords),
				...(userCoords ? { radius: String(searchRadius) } : {}),
			};
			const identifier = provider.user_id || provider.id || provider.custom_id;
			const response = await fetch(
				`${API_URL}/api/providers/v1/${identifier}/availability?${new URLSearchParams(parameters)}`,
				{ signal: request.signal },
			);
			if (!response.ok) {
				const failure = await response.json().catch(() => ({}));
				throw new Error(
					failure.message ||
						failure.error ||
						"Availability couldn't be verified. Please try again.",
				);
			}
			const data = await response.json();
			if (request.current())
				setAvailability(
					Array.isArray(data.availability) ? data.availability : [],
				);
		} catch (err) {
			if (request.current()) {
				setAvailability([]);
				setSlotsError(err.message);
			}
		} finally {
			if (request.current()) setLoadingSlots(false);
		}
	};

	const loadReviews = async () => {
		if (reviewsData) return;
		setLoadingReviews(true);
		try {
			const providerIdentifier =
				provider.user_id || provider.id || provider.custom_id;
			const cacheKey = `reviews_${providerIdentifier}`;
			let data = apiCache.get(cacheKey);

			if (!data) {
				const res = await fetch(
					`${API_URL}/api/reviews/provider/${providerIdentifier}`,
				);
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
		if (isExpanded && activeTab === "schedule") {
			onToggleExpand();
		} else {
			setActiveTab("schedule");
			if (!isExpanded) onToggleExpand();
		}
	};
	useEffect(() => {
		const requests = slotRequests.current;
		requests.cancel();
		setAvailability([]);
		setSelectedTime(null);
		setSelectedDateStr(null);
		setSlotsError(null);
		if (isExpanded && activeTab === "schedule") loadAvailability();
		return () => requests.cancel();
		// Requests depend on the complete location/service/radius selection.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		isExpanded,
		activeTab,
		userCoords?.lat,
		userCoords?.lng,
		provider.service_id,
		searchRadius,
	]);

	const handleOpenReviews = () => {
		if (isExpanded && activeTab === "reviews") {
			onToggleExpand();
		} else {
			setActiveTab("reviews");
			if (!isExpanded) onToggleExpand();
			loadReviews();
		}
	};

	const processedData = useMemo(() => {
		const validData = {};

		availability.forEach((dayGroup) => {
			const dateStr = dayGroup.date;
			const slots = dayGroup.free_slots || [];

			const now = new Date();
			const todayStr = indiaDate(now);
			const isToday = dateStr === todayStr;

			const validTimes = slots
				.filter((t) => {
					const sStart = t.start_time || t.start;
					if (!sStart) return false;
					if (!isToday) return true;

					const [h, m] = sStart.split(":").map(Number);
					const slotTime = new Date(
						`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`,
					);

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

	useModal({
		isOpen: isExpanded,
		onClose: onToggleExpand,
		id: "service-details-slot-picker",
		lockScroll: false,
	});

	return (
		<>
			<article className={`sd-card${isExpanded ? " is-expanded" : ""}`}>
				<div className="sd-card-body">
					<div className="sd-person">
						<div className="sd-avatar" aria-hidden="true">
							{provider.photo && failedPhoto !== provider.photo ? (
								<img src={provider.photo} alt="" onError={() => setFailedPhoto(provider.photo)} />
							) : (
								<span>{String(provider.name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
							)}
						</div>
						<div className="sd-person-info">
							<h3>{provider.name}</h3>
							<div className="sd-person-badges">
								{provider.is_verified ? (
									<VerifiedBadge
										size="lg"
										className="!text-amber-800 !border-amber-500/40"
									/>
								) : (
									<span>Service professional</span>
								)}
							</div>
						</div>
					</div>
					<div className="sd-card-details">
						<div className="sd-rating">
							{provider.rating != null && <StarIcon aria-hidden="true" />}
							<span>{provider.rating != null ? Number(provider.rating).toFixed(1) : "Not rated yet"}</span>
						</div>
						{provider.location && <p className="sd-person-location"><MapPin size={16} aria-hidden="true" />{provider.location}</p>}
					</div>
					<p className="sd-bio">
						{provider.bio ||
							"No introduction added yet."}
					</p>
					<div className="sd-card-meta">
						<div>
							<span className="sd-meta-label">Service rate</span>
							<strong>
								{provider.price != null
									? `₹${provider.price}`
									: "Ask for price"}
							</strong>
							{provider.price != null && (
								<small>
									{" "}
									/{" "}
									{UNIT_LABELS[provider.price_unit] ||
										provider.price_unit ||
										"Fixed Rate"}
								</small>
							)}
						</div>
						{provider.distance_km != null && <div className="sd-distance">
							<MapPin size={15} aria-hidden="true" />
							<span>
								{`${Number(provider.distance_km).toFixed(1)} km${provider.distance_km > 100 ? " · long distance" : " away"}`}
							</span>
						</div>}
					</div>
				</div>

				<div className="sd-card-footer">
					<div className="sd-card-actions">
						<button
							type="button"
							onClick={handleOpenSchedule}
							disabled={loadingSlots}
							aria-expanded={isExpanded && activeTab === "schedule"}
							aria-controls={panelId}
							className="sd-availability-button"
						>
							{loadingSlots ? (
								<>
									<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
									<span>Loading...</span>
								</>
							) : isExpanded && activeTab === "schedule" ? (
								"Close Schedule"
							) : (
								<>
									Check availability <ArrowRight size={15} aria-hidden="true" />
								</>
							)}
						</button>

						<button
							type="button"
							onClick={handleOpenReviews}
							aria-expanded={isExpanded && activeTab === "reviews"}
							aria-controls={panelId}
							className="sd-reviews-button"
						>
							<Star size={14} aria-hidden="true" />
							<span>
								{isExpanded && activeTab === "reviews"
									? "Close Reviews"
									: "Reviews"}
							</span>
						</button>
					</div>

					<div id={panelId} className="sd-card-expansion" hidden={!isExpanded}>
						{/* TAB: SCHEDULE */}
						{activeTab === "schedule" && (
							<div className="px-6 pb-6">
								{slotsError && (
									<p role="alert" className="px-6 py-3 text-sm text-amber-300">
										{slotsError}
									</p>
								)}
								{!loadingSlots && !slotsError && validDates.length === 0 && (
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
															<div className="font-bold">{dObj.getDate()}</div>
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
														const isSelected =
															selectedTime?.start === slot.start;
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
																{formatTime(slot.start)} -{" "}
																{formatTime(slot.end)}
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
													navigate(
														`/book/${provider.custom_id}?service_id=${encodeURIComponent(provider.service_id)}&radius=${searchRadius}`,
														{
															state: {
																provider: {
																	...provider,
																	service_id: provider.service_id,
																},
																serviceName: provider.service || service.name,
																serviceLocation: serviceLocation(
																	userCoords || {},
																),
																searchRadius,
																preloadedAvailability: availability,
																selectedDateStr,
																selectedSlot: {
																	date: selectedDateStr,
																	start_time:
																		selectedTime?.start_time ||
																		selectedTime?.start,
																	end_time:
																		selectedTime?.end_time || selectedTime?.end,
																	start:
																		selectedTime?.start_time ||
																		selectedTime?.start,
																	end:
																		selectedTime?.end_time || selectedTime?.end,
																},
															},
														},
													)
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

						{/* TAB: REVIEWS */}
						{activeTab === "reviews" && (
							<div className="px-6 pb-6 space-y-4">
								{loadingReviews ? (
									<div className="text-center py-8">
										<div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
										<p className="text-xs text-gray-400">Loading reviews...</p>
									</div>
								) : (
									<>
										{/* Rating Overview */}
										<div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10">
											<div className="flex items-center gap-3">
												<div className="text-3xl font-bold text-white">
													{reviewsData?.average_rating
														? Number(reviewsData.average_rating).toFixed(1)
														: (provider.rating ?? "Not rated")}
												</div>
												<div>
													<div className="flex items-center gap-0.5">
														{[1, 2, 3, 4, 5].map((s) => (
															<Star
																key={s}
																size={13}
																className={
																	s <=
																	Math.round(
																		reviewsData?.average_rating ||
																			provider.rating ||
																			5,
																	)
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

										{/* Reviews List */}
										<div className="max-h-48 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar-y">
											{reviewsData?.reviews &&
											reviewsData.reviews.length > 0 ? (
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
																{new Date(rev.created_at).toLocaleDateString(
																	"en-US",
																	{
																		month: "short",
																		day: "numeric",
																	},
																)}
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
													No reviews yet. Be the first to review {provider.name}
													!
												</div>
											)}
										</div>
									</>
								)}
							</div>
						)}
					</div>
				</div>
			</article>
			<ReviewModal
				isOpen={showReviewModal}
				onClose={() => setShowReviewModal(false)}
				providerId={provider.user_id || provider.id}
				providerName={provider.name}
				onReviewSubmitted={(newReview) => {
					loadReviews();
				}}
			/>
		</>
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
	<div className="sd-skeleton" aria-hidden="true">
		<div className="sd-skeleton-header"><span /><div><i /><i /></div></div>
		<div className="sd-skeleton-body"><i /><i /><i /><i /></div>
	</div>
);

export default ServiceDetails;
