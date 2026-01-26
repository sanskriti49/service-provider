import {
	ArrowRight,
	ChevronLeft,
	ChevronRight,
	AlertTriangle,
} from "lucide-react";
import Carousel from "react-multi-carousel";
import "react-multi-carousel/lib/styles.css";
import { motion } from "framer-motion";
import { useFetch } from "../hooks/useFetch";
import { useEffect, useState } from "react";
import "./ServicesCarousel.css";
import AuroraBackground from "../ui/AuroraBackground";
import { Link } from "react-router-dom";

// --- CAROUSEL CONFIG ---
const responsive = {
	desktop: {
		breakpoint: { max: 4000, min: 1280 },
		items: 3,
		partialVisibilityGutter: 20,
		slidesToScroll: 1, // Changed to 1 for smoother scrolling
	},
	laptop: {
		breakpoint: { max: 1280, min: 768 },
		items: 2,
		partialVisibilityGutter: 30,
		slidesToScroll: 1,
	},
	mobile: {
		breakpoint: { max: 768, min: 0 },
		items: 1,
		partialVisibilityGutter: 30,
		slidesToScroll: 1,
	},
};

const CustomArrow = ({ onClick, direction }) => {
	const Icon = direction === "left" ? ChevronLeft : ChevronRight;
	return (
		<button
			onClick={onClick}
			aria-label={direction === "left" ? "Previous" : "Next"}
			className={`cursor-pointer absolute top-1/2 z-20 flex items-center justify-center w-12 h-12 rounded-full bg-white/70 backdrop-blur-md shadow-lg
        -translate-y-1/2 transition-all duration-200 ease-in-out hover:bg-white hover:scale-110
        ${direction === "left" ? "left-4" : "right-4"}`}
		>
			<Icon className="h-6 w-6 text-slate-700" />
		</button>
	);
};

const SkeletonCard = () => (
	<div className="h-[450px] w-full animate-pulse rounded-3xl bg-slate-200" />
);

// --- SERVICE CARD COMPONENT ---
const ServiceCard = ({ service, isActive }) => {
	const serviceUrl = `/services/${service.slug || service.id}`;

	// ✅ DIRECT CLOUD IMAGE
	// Your DB now has the full Cloudinary URL, so we just use it.
	const imageUrl = service.image_url || "/images/default-service.jpg";

	return (
		<motion.a
			href={serviceUrl}
			className="group relative block h-[450px] w-full overflow-hidden rounded-3xl shadow-lg border border-white/20"
			initial={{ scale: 0.9, opacity: 0.5 }}
			animate={{
				scale: isActive ? 1 : 0.95,
				opacity: isActive ? 1 : 0.7,
				filter: isActive
					? "grayscale(0%) brightness(1)"
					: "grayscale(30%) brightness(0.9)",
			}}
			transition={{ duration: 0.4, ease: "easeInOut" }}
		>
			{/* Image Layer */}
			<div className="absolute inset-0 h-full w-full bg-slate-200">
				<img
					src={imageUrl}
					alt={service.name}
					loading="lazy"
					className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
				/>
			</div>

			{/* Gradient Overlay */}
			<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-90" />

			{/* Content Layer */}
			<div className="relative z-10 flex h-full flex-col justify-end p-8 text-white">
				<div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-md text-white/90 w-fit">
					{service.category || "General"}
				</div>

				<h3
					className="text-3xl font-bold tracking-tight text-white mb-2"
					style={{ fontFamily: "P22Mackinac, serif" }}
				>
					{service.name}
				</h3>

				{/* ✅ PRICE DISPLAY */}
				{service.price && (
					<p className="text-violet-300 font-semibold mb-2">
						₹{service.price}
						<span className="text-sm font-normal text-gray-300 ml-1">
							{service.price_unit !== "fixed" ? service.price_unit : ""}
						</span>
					</p>
				)}

				<p className="inter line-clamp-2 text-sm text-gray-300 opacity-90 transition-opacity duration-300 group-hover:text-white">
					{service.description}
				</p>

				<div className="inter group/cta mt-6 flex items-center gap-2 text-violet-300 font-medium">
					<span className="transition-colors duration-200 group-hover/cta:text-violet-400">
						View Providers
					</span>
					<ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 group-hover/cta:text-violet-400" />
				</div>
			</div>
		</motion.a>
	);
};

// --- CAROUSEL LOGIC ---
const ServicesCarousel = ({ services }) => {
	const [activeIndex, setActiveIndex] = useState(0);

	const getVisibleItems = () => {
		const width = window.innerWidth;
		if (width >= 1280) return 3;
		if (width >= 768) return 2;
		return 1;
	};

	useEffect(() => {
		const visible = getVisibleItems();
		setActiveIndex(Math.floor(visible / 2));
	}, []);

	return (
		<div className="relative mt-12 w-full cursor-grab pb-12 active:cursor-grabbing select-none">
			<Carousel
				responsive={responsive}
				infinite={true}
				centerMode={window.innerWidth >= 1024}
				afterChange={(previousSlide, { currentSlide }) => {
					const visible = getVisibleItems();
					const center =
						(currentSlide + Math.floor(visible / 2)) % services.length;
					setActiveIndex(center);
				}}
				keyBoardControl
				swipeable
				draggable
				pauseOnHover
				containerClass="w-full py-10"
				itemClass="px-3"
				showDots={false}
				customLeftArrow={<CustomArrow direction="left" />}
				customRightArrow={<CustomArrow direction="right" />}
			>
				{services.map((service) => (
					<ServiceCard
						key={service.slug || service.id}
						service={service}
						isActive={true}
					/>
				))}
			</Carousel>
		</div>
	);
};

// --- MAIN SECTION ---
const ServicesSection = () => {
	const API_URL = "http://localhost:3000";

	const {
		data: apiResponse,
		loading,
		error,
	} = useFetch(`${API_URL}/api/services/v1`);

	const services = Array.isArray(apiResponse)
		? apiResponse
		: apiResponse?.data || [];
	console.log("API Data:", services);

	return (
		<section id="services" className="relative overflow-hidden py-24 ">
			<AuroraBackground />

			<div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.5 }}
					transition={{ duration: 0.6 }}
				>
					<span className="bricolage-grotesque inline-block rounded-full bg-violet-100 px-4 py-1.5 text-sm font-semibold text-violet-700 mb-4">
						Expert Services
					</span>
					<h2 className="bricolage-grotesque text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl mb-6">
						Find the right pro for every job.
					</h2>
					<p className="inter mx-auto max-w-2xl text-lg text-slate-600">
						From home repairs to personal wellness, connect with trusted
						professionals in your area instantly.
					</p>
				</motion.div>
			</div>

			{/* Carousel Content */}
			<div className="w-full relative z-10">
				{loading && (
					<div className="mt-16 grid grid-cols-1 gap-8 px-4 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
						<SkeletonCard />
						<SkeletonCard />
						<SkeletonCard />
					</div>
				)}

				{error && (
					<div className="mt-12 flex justify-center">
						<div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
							<AlertTriangle className="h-6 w-6" />
							<div>
								<h3 className="font-semibold">Unable to load services</h3>
								<p className="text-sm opacity-90">{error}</p>
							</div>
						</div>
					</div>
				)}

				{!loading && !error && services.length > 0 && (
					<ServicesCarousel services={services} />
				)}
			</div>

			{!loading && !error && (
				<div className="text-center mt-8 relative z-10">
					<Link to="/services">
						<button className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-slate-900 px-8 py-3 text-white transition-all hover:bg-slate-800 hover:scale-105 active:scale-95 shadow-xl shadow-slate-200">
							<span className="font-medium">View All Categories</span>
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
						</button>
					</Link>
				</div>
			)}
		</section>
	);
};

export default ServicesSection;
