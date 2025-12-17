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

const responsive = {
	desktop: {
		breakpoint: { max: 4000, min: 1280 },
		items: 3,
		partialVisibilityGutter: 20,
		slidesToScroll: 3,
	},
	laptop: {
		breakpoint: { max: 1280, min: 768 },
		items: 2,
		partialVisibilityGutter: 30,
		slidesToScroll: 2,
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
        -translate-y-1/2 transition-all duration-200 ease-in-out
        ${
					direction === "left"
						? "left-0 translate-x-1/2"
						: "right-0 -translate-x-1/2"
				}`}
		>
			<Icon className="h-6 w-6 text-slate-700" />
		</button>
	);
};

// --- Skeleton Card for loading ---
const SkeletonCard = () => (
	<div className="h-96 w-full animate-pulse rounded-3xl bg-slate-200" />
);

// --- Service Card ---
const ServiceCard = ({ service, isActive = 2 }) => {
	const serviceUrl = `/services/${service.slug || service.id}`;

	return (
		<motion.a
			href={serviceUrl}
			className="group relative block h-[420px] w-full overflow-hidden rounded-2xl shadow-md"
			// transition-transform duration-300 hover:scale-[1.02]
			initial={{ scale: 0.9, opacity: 0.5 }}
			animate={{
				scale: isActive ? 1 : 0.9,
				opacity: isActive ? 1 : 0.5,
				filter: isActive
					? "grayscale(0%) brightness(1)"
					: "grayscale(50%) brightness(0.8)",
			}}
			transition={{ duration: 0.5, ease: "easeInOut" }}
		>
			<img
				src={service.image}
				alt={service.name}
				loading="lazy"
				className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
			<div className="relative z-10 flex h-full flex-col justify-end p-6 text-white">
				<h3
					className="text-2xl font-semibold tracking-tight"
					style={{ fontFamily: "P22Mackinac, serif" }}
				>
					{service.name}
				</h3>

				<p className="mt-2 text-sm text-gray-200 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
					{service.description}
				</p>

				<div className="group/cta mt-4 flex items-center gap-2 text-violet-200 opacity-0 transition-all duration-300 group-hover:opacity-100">
					<span className="text-sm font-medium group-hover/cta:text-violet-500 duration-200 group-hover/cta:scale-110">
						Explore Service
					</span>
					<ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 group-hover/cta:text-violet-400 group-hover/cta:scale-110" />
				</div>
			</div>
		</motion.a>
	);
};

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
		const initialCenter = Math.floor(visible / 2);
		setActiveIndex(initialCenter);
	}, []);

	return (
		<div className="relative mt-16 w-full cursor-grab pb-16 active:cursor-grabbing">
			<Carousel
				responsive={responsive}
				partialVisible={window.innerWidth >= 1280}
				afterChange={(previousSlide, { currentSlide }) => {
					const visible = getVisibleItems();
					const center = currentSlide + Math.floor(visible / 2);
					setActiveIndex(center);
				}}
				// infinite // <-- Disable this. It clones items and is heavy.
				keyBoardControl
				swipeable
				draggable
				// autoPlay // <-- Disable this. Constant animation is costly.
				// autoPlaySpeed={8000} // If you must use it, make it slower.
				pauseOnHover
				containerClass="w-full"
				itemClass="px-2 md:px-3"
				showDots={false}
				customLeftArrow={<CustomArrow direction="left" />}
				customRightArrow={<CustomArrow direction="right" />}
			>
				{services.map((service, index) => (
					<ServiceCard
						key={service.slug || service.id}
						service={service}
						isActive={index === activeIndex}
					/>
				))}
			</Carousel>
		</div>
	);
};

const ServicesSection = ({ searchQuery }) => {
	const {
		data: apiResponse,
		loading,
		error,
	} = useFetch("http://localhost:3000/api/services/v1");
	const services = apiResponse || [];

	// Preload images
	useEffect(() => {
		if (!services || services.length === 0) return;

		const preloadNearby = (idx) => {
			const range = 4;
			for (
				let i = Math.max(0, idx - range);
				i <= Math.min(services.length - 1, idx + range);
				i++
			) {
				const img = new Image();
				img.src = services[i].image;
			}
		};

		preloadNearby(0);
	}, [services]);

	return (
		<section
			id="services"
			className="relative overflow-hidden mt-1 md:mt-14 xl:mt-22 py-20 sm:py-28"
		>
			<AuroraBackground />

			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<motion.div
					className="text-center"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.5 }}
					transition={{ duration: 0.6 }}
				>
					<div className="bricolage-grotesque inline-block rounded-full bg-violet-100 px-4 py-1.5 text-sm font-semibold text-violet-700">
						Our Services
					</div>
					<h2 className="bricolage-grotesque mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
						Whatever you need, we've got a pro.
					</h2>
					<p className="inter mx-auto mt-5 max-w-2xl text-lg text-slate-600 tracking-wide leading-relaxed">
						From quick fixes to major projects, find the perfect help in
						minutes.
					</p>
				</motion.div>
			</div>

			{/* Carousel */}
			<div className="w-full">
				{loading && (
					<div className="mt-16 grid grid-cols-1 gap-8 px-4 md:grid-cols-2 lg:grid-cols-3 xl:max-w-7xl xl:mx-auto">
						<SkeletonCard />
						<SkeletonCard />
						<SkeletonCard />
					</div>
				)}
				{error && (
					<div className="mt-16 max-w-2xl mx-auto flex flex-col items-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-700">
						<AlertTriangle className="h-10 w-10" />
						<h3 className="text-xl font-semibold">Something went wrong</h3>
						<p>{error}</p>
					</div>
				)}
				{!loading && !error && services.length > 0 && (
					<ServicesCarousel services={services} />
				)}
			</div>

			{!loading && !error && services.length > 0 && (
				<div className=" text-center">
					<Link to="/services">
						<button
							type="button"
							className="cursor-pointer text-white group/btn inline-flex justify-center items-center h-12 border-none rounded-full px-6
						bg-violet-600 bg-gradient-to-br from-[#b369de] to-[#4f46e5]
						active:scale-95 hover:scale-105 hover:shadow-lg hover:shadow-violet-400/50 
						transition-all duration-300 ease-in-out"
						>
							<span className="inter mr-2">View All Services</span>{" "}
							<ArrowRight className="h-4 w-4" />
						</button>
					</Link>
				</div>
			)}
		</section>
	);
};

export default ServicesSection;
