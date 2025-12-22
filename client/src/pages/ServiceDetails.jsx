import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { StarIcon } from "@heroicons/react/24/solid";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowBigLeft, ArrowLeft, ChevronDown, Clock } from "lucide-react";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const formatDate = (dateString) => {
	const date = new Date(dateString);
	return date.toLocaleString("en-IN", {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
};

const formatTime = (timeStr) => {
	if (!timeStr) {
		return "";
	}
	const [hours, minutes] = timeStr.split(":");
	const date = new Date();
	date.setHours(hours);
	date.setMinutes(minutes);

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
	const [expandedProviderId, setExpandedProviderId] = useState(null);

	const mainRef = useRef(null);
	const headerRef = useRef(null);
	const contentRef = useRef(null);
	const scrollRef = useRef(null);

	useEffect(() => {
		if (!slug) return;
		async function fetchServiceAndProviders() {
			try {
				setLoading(true);
				setError(null);
				const serviceRes = await fetch(`${API_URL}/api/services/v1/${slug}`);
				if (!serviceRes.ok) throw new Error("Service not found");
				const serviceData = await serviceRes.json();
				console.log(serviceData);
				setService(serviceData);

				const providersRes = await fetch(
					`${API_URL}/api/providers/v1?service=${encodeURIComponent(slug)}`
				);
				if (!providersRes.ok) throw new Error("Could not fetch providers");
				const providersData = await providersRes.json();
				console.log("providersData: ", providersData);
				setProviders(providersData);
			} catch (err) {
				console.error("Error fetching providers:", err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}
		fetchServiceAndProviders();
	}, [slug]);

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
					0
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

			ease: "bounce",
		});
	};

	const handleToggleExpand = (providerId) => {
		setExpandedProviderId((prevId) =>
			prevId === providerId ? null : providerId
		);
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
					<p className="text-gray-400 mt-3 max-w-md">
						{service
							? "We're working on adding experts for this service. Please check back later."
							: "The service you're looking for might have been moved or doesn't exist."}
					</p>
					<Link
						to="/"
						className="mt-8 inline-block bg-violet-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-violet-700 transition-colors"
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
		<>
			<section ref={mainRef} className="bg-[#191034] text-white">
				<div ref={headerRef} className="relative z-10 h-[90vh] w-full">
					<div className="sticky top-0 h-full w-full flex flex-col ">
						<div
							onClick={handleGoBack}
							className="cursor-pointer z-200 m-10 w-12 h-12 rounded-full border border-violet-400/50 flex items-center justify-center bg-black/20 backdrop-blur-sm text-violet-300 hover:bg-violet-500/20 hover:border-violet-400 transition-all duration-300"
							redirect
						>
							<ArrowLeft />
						</div>
						<img
							src={service.image}
							alt={service.name}
							className="absolute inset-0 w-full h-full object-cover opacity-50"
						/>

						<div className="absolute inset-0 bg-gradient-to-t from-[#191034] via-[#191034]/70 to-transparent"></div>
						<div
							id="header-content"
							className="relative z-10 mt-auto p-8 md:p-12 lg:p-16 w-full max-w-7xl mx-auto text-left"
						>
							<h1 className="text-5xl md:text-6xl lg:text-7xl bricolage-grotesque text-white font-bold [text-shadow:_0_2px_10px_rgb(0_0_0_/_0.5)]">
								{service.name}
							</h1>
							<p className="mt-4 max-w-xl text-gray-300 text-base md:text-lg [text-shadow:_0_1px_5px_rgb(0_0_0_/_0.5)]">
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
					className="plus-jakarta-sans relative z-20 bg-[#191034] max-w-7xl mt-10 mx-auto py-16 sm:py-10 px-4 sm:px-6 lg:px-8 rounded-t-3xl border-t border-violet-800/50 shadow-2xl shadow-black/50"
				>
					<div className="text-center mb-12">
						<h2 className="text-3xl sm:text-4xl font-bold text-gray-200 bricolage-grotesque">
							Available Providers
						</h2>
						<p className=" mt-3 text-gray-400">
							Choose from our top-rated experts.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{providers.map((p) => (
							<ProviderCard
								key={p.user_id}
								provider={p}
								isExpanded={expandedProviderId === p.user_id}
								onToggleExpand={() => handleToggleExpand(p.user_id)}
							/>
						))}
					</div>
				</div>
			</section>
		</>
	);
};

const ProviderCard = ({ provider, isExpanded, onToggleExpand }) => {
	const navigate = useNavigate();

	const [availability, setAvailability] = useState([]);
	const [loadingSlots, setLoadingSlots] = useState(false);
	const [hasLoaded, setHasLoaded] = useState(false);

	const [selectedDateStr, setSelectedDateStr] = useState(null);
	const [selectedTime, setSelectedTime] = useState(null);

	const loadAvailability = async () => {
		if (hasLoaded) return;
		setLoadingSlots(true);

		try {
			const res = await fetch(
				`${API_URL}/api/providers/v1/${provider.user_id}/availability`
			);
			if (!res.ok) throw new Error("Failed to load slots");
			const data = await res.json();
			setAvailability(data);
			setHasLoaded(true);
		} catch (error) {
			console.error(error);
		} finally {
			setLoadingSlots(false);
		}
	};

	const handleViewAvailability = () => {
		onToggleExpand();

		if (!isExpanded) {
			loadAvailability();
		}
	};

	const processedData = useMemo(() => {
		// group by date (YYYY-MM-DD) for sorting logic
		const grouped = availability.reduce((acc, slot) => {
			const dateKey = slot.date;
			if (!acc[dateKey]) acc[dateKey] = [];
			acc[dateKey].push(slot.start_time);
			return acc;
		}, {});

		// 2. Filter & Sort Dates
		const sortedDates = Object.keys(grouped)
			.sort((a, b) => new Date(a) - new Date(b)) // Sort chronologically
			.filter((dateStr) => {
				const slotDate = new Date(dateStr);
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				return slotDate >= today; // Remove past dates
			});

		const validData = {};
		sortedDates.forEach((dateStr) => {
			const isToday =
				new Date(dateStr).toDateString() === new Date().toDateString();

			// Filter times for this specific date
			const validTimes = grouped[dateStr]
				.filter((t) => {
					if (!isToday) return true;
					const [h, m] = t.split(":");
					const slotTime = new Date();
					slotTime.setHours(h, m, 0, 0);
					return slotTime > new Date();
				})
				.sort();

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

	return (
		<div className="bg-gradient-to-br from-[#2a1d5a] to-[#1e143f] rounded-xl border border-violet-900/50 flex flex-col transition-all duration-300 hover:border-violet-700 hover:shadow-xl hover:shadow-violet-600/20 hover:-translate-y-2">
			<div className="p-6 pb-4">
				<div className="flex items-start gap-4">
					<img
						src={
							provider.photo ||
							`https://ui-avatars.com/api/?name=${provider.name}&background=6d28d9&color=fff`
						}
						alt={provider.name}
						className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-violet-500 flex-shrink-0"
					/>
					<div className="flex-1 min-w-0">
						<h3 className="font-bold text-lg md:text-xl text-white truncate">
							{provider.name}
						</h3>
						<div className="flex items-center gap-1 mt-1 text-yellow-400">
							<StarIcon className="h-4 w-4" />
							<span className="text-sm font-medium text-gray-200">
								{provider.rating || "New"}
							</span>
							{/* <span className="text-xs text-gray-500 ml-1">
								({provider.reviews_count || 0} reviews)
							</span> */}
						</div>
						<p className="text-sm text-gray-400 mt-2 line-clamp-2 leading-relaxed">
							{provider.bio || "Experience top-tier service..."}
						</p>
					</div>
				</div>
			</div>

			<div className="p-6 flex-grow flex flex-col">
				<div className="px-6 rounded-2xl mb-5 py-3 border-y border-white/5 bg-black/20 flex justify-between items-center">
					<span className="text-gray-400 text-sm">Service Rate</span>
					<span className="text-violet-300 font-semibold text-lg">
						₹{provider.price}{" "}
						<span className="text-xs text-gray-500 font-normal">/ visit</span>
					</span>
				</div>

				<button
					onClick={handleViewAvailability}
					disabled={loadingSlots}
					className={`cursor-pointer w-full text-center px-4 py-2.5 rounded-xl font-semibold transition-all duration-300 border 
                    ${
											isExpanded
												? "bg-violet-900/30 border-violet-500/50 text-violet-200"
												: "bg-violet-300/5 border-white/10 text-gray-300 hover:bg-violet-600/10 hover:border-violet-500/30 hover:text-white"
										}`}
				>
					{loadingSlots ? (
						<span className="flex items-center justify-center gap-2">
							<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
							Checking Schedule...
						</span>
					) : isExpanded ? (
						"Hide Availability"
					) : (
						"View Availability"
					)}
				</button>

				{isExpanded && (
					<div className="mt-6 animate-fade-in space-y-4">
						{!loadingSlots && validDates.length === 0 && (
							<div className="text-center py-6 bg-white/5 rounded-lg border border-dashed border-white/10">
								<Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
								<p className="text-gray-400 text-sm">
									No slots available soon.
								</p>
							</div>
						)}

						{validDates.length > 0 && (
							<>
								<div
									className="flex gap-2 overflow-x-auto pb-2 snap-x 
    cursor-pointer
    scrollbar-thin scrollbar-track-transparent scrollbar-thumb-violet-900/50
    [&::-webkit-scrollbar]:h-1 
    [&::-webkit-scrollbar]:w-1
    [&::-webkit-scrollbar-track]:bg-transparent
    [&::-webkit-scrollbar-thumb]:bg-violet-600/50 
    hover:[&::-webkit-scrollbar-thumb]:bg-violet-600 
    [&::-webkit-scrollbar-thumb]:rounded-full"
								>
									{validDates.map((dateStr) => {
										const isSelected = selectedDateStr === dateStr;
										const dateLabel = formatDate(dateStr);

										return (
											<button
												key={dateStr}
												onClick={() => setSelectedDateStr(dateStr)}
												className={`cursor-pointer flex-shrink-0 snap-start px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all duration-200
                                                ${
																									isSelected
																										? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/40"
																										: "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
																								}`}
											>
												{formatDate(dateStr)}
											</button>
										);
									})}
								</div>

								{selectedDateStr && processedData[selectedDateStr] && (
									<div className="bg-black/20 rounded-xl p-4 border border-white/5">
										<div className="flex items-center gap-2 mb-3 text-xs text-violet-300 font-medium uppercase tracking-wider">
											<Clock className="w-3 h-3" />
											Available Times
										</div>
										<div className="grid grid-cols-3 gap-2">
											{processedData[selectedDateStr].map((time) => {
												const isSelected = selectedTime === time;
												return (
													<div
														key={time}
														onClick={() => setSelectedTime(time)}
														className={`tabular-nums text-xs px-2 py-2 cursor-pointer rounded-md transition-colors
                                                ${
																									isSelected
																										? "bg-violet-600 text-white font-bold shadow-lg shadow-violet-900/50 scale-101 border border-violet-500"
																										: "bg-violet-500/10 border border-violet-500/20 text-violet-100 hover:bg-violet-500/20 hover:border-violet-500/40"
																								}`}
													>
														{formatTime(time)}
													</div>
												);
											})}
										</div>
									</div>
								)}
							</>
						)}
					</div>
				)}
			</div>

			<div className="p-6 pt-0 mt-auto">
				<button
					onClick={() =>
						navigate(`/book/${provider.custom_id}`, {
							state: {
								provider,
								preloadedAvailability: availability,
								selectedDateStr: selectedDateStr,
								selectedTime: selectedTime,
							},
						})
					}
					className="cursor-pointer w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold px-4 py-3 rounded-lg hover:from-violet-500 hover:to-purple-500 hover:scale-101 transition-all duration-300"
				>
					Book Now
				</button>
			</div>
		</div>
	);
};

const ServiceDetailsSkeleton = () => (
	<section className="bg-[#191034] min-h-screen pb-20">
		{/* Header Skeleton */}
		<div className="relative">
			<div className="w-full h-80 bg-gray-800 opacity-30"></div>
			<div className="absolute inset-0 flex flex-col justify-center items-center text-center p-4">
				<div className="h-12 w-3/5 bg-gray-700 rounded-md animate-pulse"></div>
				<div className="h-4 w-4/5 mt-4 bg-gray-700 rounded-md animate-pulse"></div>
			</div>
		</div>
		{/* Cards Skeleton */}
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
