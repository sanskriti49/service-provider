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
} from "lucide-react";
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
	//const [expandedProviderId, setExpandedProviderId] = useState(null);
	const [expandedIndex, setExpandedIndex] = useState(-1); // -1 means nothing is open
	const mainRef = useRef(null);
	const headerRef = useRef(null);
	const contentRef = useRef(null);
	const scrollRef = useRef(null);

	const isAnyExpanded = expandedIndex !== -1;

	useEffect(() => {
		if (!slug) return;
		async function fetchServiceAndProviders() {
			try {
				setLoading(true);
				setError(null);
				const serviceRes = await fetch(`${API_URL}/api/services/v1/${slug}`);
				if (!serviceRes.ok) throw new Error("Service not found");
				const serviceData = await serviceRes.json();
				setService(serviceData);

				const providersRes = await fetch(
					`${API_URL}/api/providers/v1?service=${encodeURIComponent(slug)}`,
				);
				if (!providersRes.ok) throw new Error("Could not fetch providers");
				const providersData = await providersRes.json();
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
			ease: "bounce",
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
					<div className="text-center mb-12">
						<h2 className="text-3xl sm:text-4xl font-bold text-gray-200 bricolage-grotesque">
							Available Providers
						</h2>
						<p className=" mt-3 text-gray-400">
							Choose from our top-rated experts.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
						{providers.map((p, index) => (
							<ProviderCard
								key={p.user_id || index}
								provider={p}
								isExpanded={expandedIndex === index}
								isAnyExpanded={isAnyExpanded}
								onToggleExpand={() => handleToggleExpand(index)}
							/>
						))}
					</div>
				</div>
			</section>
		</>
	);
};

const ProviderCard = ({
	provider,
	isExpanded,
	isAnyExpanded,
	onToggleExpand,
}) => {
	const navigate = useNavigate();

	const [availability, setAvailability] = useState([]);
	const [loadingSlots, setLoadingSlots] = useState(false);
	const [hasLoaded, setHasLoaded] = useState(false);

	const [selectedDateStr, setSelectedDateStr] = useState(null);
	const [selectedTime, setSelectedTime] = useState(null);
	const dateScrollRef = useRef(null);

	const loadAvailability = async () => {
		if (hasLoaded) return;
		setLoadingSlots(true);

		try {
			const res = await fetch(
				`${API_URL}/api/providers/v1/${provider.user_id}/availability`,
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
		const grouped = availability.reduce((acc, slot) => {
			const dateKey = slot.date;
			if (!acc[dateKey]) acc[dateKey] = [];
			acc[dateKey].push(slot.start_time);
			return acc;
		}, {});

		const sortedDates = Object.keys(grouped)
			.sort((a, b) => new Date(a) - new Date(b))
			.filter((dateStr) => {
				const slotDate = new Date(dateStr);
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				return slotDate >= today;
			});

		const validData = {};
		sortedDates.forEach((dateStr) => {
			const isToday =
				new Date(dateStr).toDateString() === new Date().toDateString();

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

	useEffect(() => {
		const el = dateScrollRef.current;
		if (!el) return;

		const onEnter = () => {
			gsap.to(el, {
				"--thumb-color": "rgba(139, 92, 246, 0.6)",
				duration: 0.25,
				ease: "power2.out",
			});
		};

		const onLeave = () => {
			gsap.to(el, {
				"--thumb-color": "rgba(255, 255, 255, 0.18)",
				duration: 0.25,
				ease: "power2.out",
			});
		};

		let scrollTimeout;
		const onScroll = () => {
			gsap.to(el, {
				"--thumb-color": "rgba(139, 92, 246, 0.8)",
				duration: 0.15,
			});

			clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(() => {
				gsap.to(el, {
					"--thumb-color": "rgba(255, 255, 255, 0.18)",
					duration: 0.3,
				});
			}, 300);
		};

		el.addEventListener("mouseenter", onEnter);
		el.addEventListener("mouseleave", onLeave);
		el.addEventListener("scroll", onScroll);

		return () => {
			el.removeEventListener("mouseenter", onEnter);
			el.removeEventListener("mouseleave", onLeave);
			el.removeEventListener("scroll", onScroll);
		};
	}, []);

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
			{/* Top Gradient Accent */}
			<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

			<div className="p-7">
				{/* Header Section */}
				<div className="flex gap-5 items-start">
					<div className="relative">
						<div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/10 shadow-lg group-hover:border-violet-500/50 transition-colors duration-300">
							<img
								src={
									provider.photo ||
									`https://ui-avatars.com/api/?name=${provider.name}&background=6d28d9&color=fff`
								}
								alt={provider.name}
								className="w-full h-full object-cover"
							/>
						</div>
						{/* Rating Badge */}
						<div className="absolute -bottom-3 -right-2 bg-[#1a103f] border border-violet-500/30 px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
							<StarIcon className="h-3.5 w-3.5 text-yellow-400" />
							<span className="text-xs font-bold text-white">
								{provider.rating || "New"}
							</span>
						</div>
					</div>

					<div className="flex-1 min-w-0 pt-1">
						<h3 className="plus-jakarta-sans font-bold text-[22px] text-white truncate group-hover:text-violet-300 transition-colors">
							{provider.name}
						</h3>
						<div className="flex items-center gap-1 text-xs text-violet-300/60 mt-1 mb-3">
							<CheckCircle2 size={12} className="text-green-400" />
							<span>Verified Expert</span>
						</div>

						{/* Price Tag - Modern Pill */}
						<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-200 text-sm">
							<span className="font-bold">₹{provider.price}</span>
							<span className="text-xs opacity-60 font-normal">/ visit</span>
						</div>
					</div>
				</div>

				<p className="text-md text-gray-400 mt-6 leading-relaxed line-clamp-2">
					{provider.bio ||
						"Experienced professional dedicated to delivering high-quality service tailored to your specific needs."}
				</p>
			</div>

			<div
				className={`bg-black/20 border-t border-white/5 transition-all duration-500 ease-in-out`}
			>
				{/* Expand/Collapse Button Area */}
				<div className="p-4">
					<button
						onClick={handleViewAvailability}
						disabled={loadingSlots}
						className={`cursor-pointer w-full py-3 rounded-lg font-semibold text-md
  transition-all duration-300 flex items-center justify-center gap-2
  ${
		isExpanded
			? "bg-white/5 text-violet-200 border border-white/10"
			: " bg-violet-400/10 text-violet-200 border border-violet-500/30 hover:bg-violet-500/20"
	}`}
					>
						{loadingSlots ? (
							<>
								<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
								Loading...
							</>
						) : isExpanded ? (
							<>Close Schedule</>
						) : (
							<>Check Availability</>
						)}
					</button>
				</div>

				{/* Expanded Content */}
				<div
					className={`overflow-hidden transition-all duration-500 ease-in-out
    ${isExpanded ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"}
  `}
				>
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
								{/* Date Selector - FIXED SCROLLBAR */}
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
											return (
												<button
													key={dateStr}
													onClick={() => setSelectedDateStr(dateStr)}
													className={`flex-shrink-0 snap-start px-4 py-2.5 rounded-xl border text-md font-medium transition-all duration-200 min-w-[80px]
                                                    ${
																											isSelected
																												? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/40"
																												: "bg-[#1a103f] border-white/10 text-gray-400 hover:border-violet-500/50 hover:text-white"
																										}`}
												>
													<div className="text-xs opacity-70">
														{new Date(dateStr).toLocaleString("en-US", {
															weekday: "short",
														})}
													</div>
													<div className="font-bold">
														{new Date(dateStr).getDate()}
													</div>
												</button>
											);
										})}
									</div>
								</div>

								{/* Time Selector */}
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
											{processedData[selectedDateStr].map((time) => {
												const isSelected = selectedTime === time;
												return (
													<button
														key={time}
														onClick={() => setSelectedTime(time)}
														className={`text-xs py-2 rounded-lg transition-all duration-200 border
                                                        ${
																													isSelected
																														? "bg-white text-violet-900 font-bold border-white shadow-md scale-95"
																														: "bg-white/5 border-transparent text-gray-300 hover:bg-white/10 hover:border-white/20"
																												}`}
													>
														{formatTime(time)}
													</button>
												);
											})}
										</div>
									</div>
								)}

								{/* Book Button */}
								<div className="flex justify-center mt-4">
									<button
										disabled={!selectedTime}
										onClick={() =>
											navigate(`/book/${provider.custom_id}`, {
												state: {
													provider,
													preloadedAvailability: availability,
													selectedDateStr,
													selectedTime,
												},
											})
										}
										className={`
      inline-flex items-center justify-center gap-2 w-full
      btn-xl btn-purple btn-border-dark
      px-7 py-3 rounded-lg
      group/btn transition-all
      ${
				selectedTime
					? "opacity-100 hover:scale-[1.02]"
					: "opacity-40 cursor-not-allowed pointer-events-none"
			}
    `}
									>
										<span>Continue to Booking</span>

										<div className="flex items-center opacity-50 group-hover/btn:opacity-100 transition-opacity">
											<svg
												viewBox="0 0 16 16"
												className="w-0 group-hover/btn:w-2.5 h-3 translate-x-2.5 transition-all duration-200"
												fill="currentColor"
											>
												<path d="M1 9h14a1 1 0 000-2H1a1 1 0 000 2z" />
											</svg>

											<svg
												viewBox="0 0 16 16"
												className="size-[0.7em]"
												fill="currentColor"
											>
												<path d="M7.293 1.707L13.586 8l-6.293 6.293a1 1 0 001.414 1.414l7-7a.999.999 0 000-1.414l-7-7a1 1 0 00-1.414 1.414z" />
											</svg>
										</div>
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
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
