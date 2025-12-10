import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { StarIcon } from "@heroicons/react/24/solid";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowBigLeft, ArrowLeft, ChevronDown } from "lucide-react";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const formatDate = (dateString) => {
	return new Date(dateString).toLocaleString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
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

	// Data fetching logic
	useEffect(() => {
		if (!slug) return;
		async function fetchServiceAndProviders() {
			try {
				setLoading(true);
				setError(null);
				const serviceRes = await fetch(
					`http://localhost:3000/api/services/v1/${slug}`
				);
				if (!serviceRes.ok) throw new Error("Service not found");
				const serviceData = await serviceRes.json();
				setService(serviceData);

				const providersRes = await fetch(
					`http://localhost:3000/api/providers/v1?service=${encodeURIComponent(
						serviceData.name
					)}`
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

	// GSAP
	useEffect(() => {
		if (!loading && service && mainRef.current) {
			let ctx = gsap.context(() => {
				// SCROLLTRIGGER 1: The Animation (Shrinking & Fading)
				const tl = gsap.timeline({
					scrollTrigger: {
						trigger: mainRef.current,
						start: "top top",
						end: "+=500", // Animate over the first 500px of scroll
						scrub: 1, // A bit of smoothing on the scrub
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

				// SCROLLTRIGGER 2: The Pinning
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
			// scrollTo: {
			// 	y: contentRef.current,
			// },
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
			navigate(-1); // Go back to the previous page
		} else {
			navigate("/"); // Go to homepage as a fallback
		}
	};

	return (
		<>
			{/* <Navbar /> */}

			<section ref={mainRef} className="bg-[#191034] text-white">
				<div ref={headerRef} className="relative z-10 h-[90vh] w-full">
					<div className="sticky top-0 h-full w-full flex flex-col ">
						{/* <div className="cursor-pointer z-200 m-10 w-12 h-12 rounded-full border border-violet-400/50 flex items-center justify-center bg-black/20 backdrop-blur-sm text-violet-300 hover:bg-violet-500/20 hover:border-violet-400 transition-all duration-300" redirect> */}
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
						{/* Gradient overlay for smooth transition */}
						<div className="absolute inset-0 bg-gradient-to-t from-[#191034] via-[#191034]/70 to-transparent"></div>
						{/* Improved text layout */}
						<div
							id="header-content"
							className="relative z-10 mt-auto p-8 md:p-12 lg:p-16 w-full max-w-7xl mx-auto text-left"
						>
							<h1 className="text-5xl md:text-6xl lg:text-7xl bricolage-grotesque text-white font-bold [text-shadow:_0_2px_10px_rgb(0_0_0_/_0.5)]">
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

// --- Child Components ---

const ProviderCard = ({ provider, isExpanded, onToggleExpand }) => {
	const groupedSlots = provider.availability.reduce((acc, slot) => {
		const date = formatDate(slot.date);
		if (!acc[date]) acc[date] = [];
		acc[date].push(slot.start_time);
		acc[date].sort();
		return acc;
	}, {});

	return (
		<div className="bg-gradient-to-br from-[#2a1d5a] to-[#1e143f] rounded-xl border border-violet-900/50 flex flex-col transition-all duration-300 hover:border-violet-700 hover:shadow-xl hover:shadow-violet-600/20 hover:-translate-y-2">
			<div className="p-6">
				<div className="flex items-start gap-4">
					<img
						src={
							provider.photo ||
							`https://ui-avatars.com/api/?name=${provider.name}&background=6d28d9&color=fff`
						}
						alt={provider.name}
						className="w-20 h-20 rounded-full object-cover border-2 border-violet-500 flex-shrink-0"
					/>
					<div className="flex-1">
						<h3 className="font-bold text-xl text-white">{provider.name}</h3>
						<p className="text-sm text-gray-400 mt-1 line-clamp-2">
							{provider.bio || "No bio available."}
						</p>
					</div>
				</div>
			</div>

			<div className="px-6 py-4 border-y border-violet-900/50 text-sm flex justify-between items-center gap-4">
				<div className="flex items-center gap-1.5 text-yellow-400">
					<StarIcon className="h-5 w-5" />
					<span className="font-bold text-white">
						{provider.rating?.toFixed(1) || "New"}
					</span>
					<span className="text-gray-400 text-xs">(Rating)</span>
				</div>
				<div className="text-right">
					<span className="font-bold text-lg text-white">
						₹{provider.price?.toFixed(2) || "N/A"}
					</span>
					<span className="text-gray-400 text-xs">/session</span>
				</div>
			</div>

			<div className="p-6 flex-grow flex flex-col">
				{provider.availability?.length > 0 ? (
					<>
						<button
							onClick={onToggleExpand}
							className="cursor-pointer w-full text-center bg-violet-800/50 text-violet-200 px-4 py-2 rounded-lg hover:bg-violet-800 transition-colors font-semibold"
						>
							{isExpanded ? "Hide Availability" : "View Availability"}
						</button>

						{isExpanded && (
							<div className="mt-4 space-y-3 animate-fade-in">
								{/* {groupedSlots[date]} */}
								{Object.entries(groupedSlots).map(([date, times]) => (
									<div key={date}>
										<p className="font-semibold text-gray-300 text-sm mb-2">
											{date}
										</p>
										<div className="flex flex-wrap gap-2">
											{times.map((time) => (
												<span
													key={time}
													className="bg-violet-900/70 text-gray-200 text-xs font-mno px-3 py-1 rounded-full"
												>
													{time}
												</span>
											))}
										</div>
									</div>
								))}
							</div>
						)}
					</>
				) : (
					<p className="text-center text-gray-500 text-sm py-2">
						No availability posted.
					</p>
				)}
			</div>

			<div className="p-6 pt-0 mt-auto">
				{/* IMPROVED: Gradient button with stronger hover state */}
				<button className="cursor-pointer w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold px-4 py-3 rounded-lg hover:from-violet-500 hover:to-purple-500 hover:scale-105 transition-all duration-300">
					Book Now
				</button>
			</div>
		</div>
	);
};

// --- Child Components ---

// const ProviderCard = ({ provider, isExpanded, onToggleExpand }) => {
// 	// Group availability slots by date
// 	const groupedSlots = provider.availability.reduce((acc, slot) => {
// 		const date = formatDate(slot.date);
// 		if (!acc[date]) {
// 			acc[date] = [];
// 		}
// 		// Assuming start_time is what you want to show
// 		acc[date].push(slot.start_time);
// 		// Sort times chronologically
// 		acc[date].sort();
// 		return acc;
// 	}, {});

// 	return (
// 		<div className="bg-[#22194A] rounded-xl shadow-lg border border-violet-900/50 flex flex-col transition-all duration-300 hover:shadow-violet-500/30 hover:-translate-y-1">
// 			{/* Provider Info */}
// 			<div className="p-6">
// 				<div className="flex items-start gap-4">
// 					<img
// 						src={
// 							provider.photo ||
// 							`https://ui-avatars.com/api/?name=${provider.name}&background=6d28d9&color=fff`
// 						}
// 						alt={provider.name}
// 						className="w-20 h-20 rounded-full object-cover border-2 border-violet-500 flex-shrink-0"
// 					/>
// 					<div className="flex-1">
// 						<h3 className="font-bold text-xl text-white">{provider.name}</h3>
// 						<p className="text-sm text-gray-400 mt-1 line-clamp-2">
// 							{provider.bio || "No bio available."}
// 						</p>
// 					</div>
// 				</div>
// 			</div>

// 			{/* Stats */}
// 			<div className="px-6 py-4 border-t border-b border-violet-900/50 text-sm flex justify-between items-center gap-4">
// 				<div className="flex items-center gap-1 text-yellow-400">
// 					<StarIcon className="h-5 w-5" />
// 					<span className="font-bold text-white">
// 						{provider.rating?.toFixed(1) || "N/A"}
// 					</span>
// 					<span className="text-gray-400">(Rating)</span>
// 				</div>
// 				<div className="text-right">
// 					<span className="font-bold text-lg text-white">
// 						₹{provider.price?.toFixed(2) || "N/A"}
// 					</span>
// 					<span className="text-gray-400"> / session</span>
// 				</div>
// 			</div>

// 			{/* Availability */}
// 			<div className="p-6 flex-grow flex flex-col">
// 				{provider.availability && provider.availability.length > 0 ? (
// 					<>
// 						<button
// 							onClick={onToggleExpand}
// 							className="cursor-pointer w-full text-center bg-violet-800/50 text-violet-200 px-4 py-2 rounded-lg hover:bg-violet-800 transition-colors"
// 						>
// 							{isExpanded ? "Hide Availability" : "View Availability"}
// 						</button>

// 						{isExpanded && (
// 							<div className="mt-4 space-y-3 animate-fade-in">
// 								{Object.entries(groupedSlots).map(([date, times]) => (
// 									<div key={date}>
// 										<p className="font-semibold text-gray-300 text-sm mb-2">
// 											{date}
// 										</p>
// 										<div className="flex flex-wrap gap-2">
// 											{times.map((time) => (
// 												<span
// 													key={time}
// 													className="bg-violet-900/70 text-gray-200 text-xs font-mono px-3 py-1 rounded-full"
// 												>
// 													{time}
// 												</span>
// 											))}
// 										</div>
// 									</div>
// 								))}
// 							</div>
// 						)}
// 					</>
// 				) : (
// 					<p className="text-center text-gray-500 text-sm">
// 						No availability posted.
// 					</p>
// 				)}
// 			</div>

// 			<div className="p-6 pt-0 mt-auto">
// 				<button className="cursor-pointer w-full bg-violet-600 text-white font-bold px-4 py-3 rounded-lg hover:bg-violet-700 transition-colors">
// 					Book Now
// 				</button>
// 			</div>
// 		</div>
// 	);
// };

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
