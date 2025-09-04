import {
	ArrowRight,
	ChevronLeft,
	ChevronRight,
	AlertTriangle,
} from "lucide-react";
import Carousel from "react-multi-carousel";
import "react-multi-carousel/lib/styles.css";
import { motion } from "framer-motion";
import { useFetch } from "./hooks/useFetch";
import { useEffect, useState } from "react";
import "./ServicesCarousel.css"; // keep your custom dot styles here
import AuroraBackground from "./AuroraBackground";

// --- Responsive settings for the carousel ---
const responsive = {
	desktop: {
		breakpoint: { max: 4000, min: 1280 },
		items: 3,
		partialVisibilityGutter: 40,
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

// --- Polished Arrow Component ---
const CustomArrow = ({ onClick, direction }) => {
	const Icon = direction === "left" ? ChevronLeft : ChevronRight;
	return (
		<button
			onClick={onClick}
			aria-label={direction === "left" ? "Previous" : "Next"}
			className={`absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-12 h-12 rounded-full bg-white/60 backdrop-blur-md shadow-lg
      hover:bg-white hover:scale-110 transition-all duration-300 ease-in-out group
      ${direction === "left" ? "left-4" : "right-4"}`}
		>
			<Icon className="h-6 w-6 text-slate-700 transition-colors group-hover:text-violet-600" />
		</button>
	);
};

// --- Skeleton Card for loading ---
const SkeletonCard = () => (
	<div className="h-96 w-full animate-pulse rounded-3xl bg-slate-200" />
);

// --- Service Card ---

const ServiceCard = ({ service }) => {
	return (
		<div className="group relative h-[420px] w-full overflow-hidden rounded-2xl shadow-md transition-transform duration-300 hover:scale-[1.02]">
			{/* Background Image */}
			<img
				src={service.image}
				alt={service.name}
				className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
			/>

			{/* Gradient + glass overlay */}
			<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
			<div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />

			{/* Content */}
			<div className="relative z-10 flex h-full flex-col justify-end p-6 text-white">
				<h3
					className="text-2xl font-semibold tracking-tight"
					style={{ fontFamily: "P22Mackinac, serif" }}
				>
					{service.name}
				</h3>

				{/* Description — hidden until hover */}
				<p className="mt-2 text-sm text-gray-200 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
					{service.description}
				</p>

				{/* CTA */}
				<div className="mt-4 flex items-center gap-2 text-violet-200 opacity-0 transition-all duration-300 group-hover:opacity-100">
					<span className="text-sm font-medium">Explore Service</span>
					<ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
				</div>
			</div>
		</div>
	);
};

// --- Aurora Background ---

// --- Carousel Component ---
const ServicesCarousel = ({ services }) => (
	<div className="relative mt-16 w-full cursor-grab pb-16 active:cursor-grabbing">
		<Carousel
			responsive={responsive}
			partialVisible
			infinite
			keyBoardControl
			swipeable
			draggable
			autoPlay
			autoPlaySpeed={5000}
			pauseOnHover
			containerClass="w-full"
			itemClass="px-2 md:px-3"
			showDots={false}
			dotListClass="custom-dot-list"
			customLeftArrow={<CustomArrow direction="left" />}
			customRightArrow={<CustomArrow direction="right" />}
		>
			{services.map((service) => (
				<ServiceCard key={service.id} service={service} />
			))}
		</Carousel>
	</div>
);

// --- Section Wrapper ---
const ServicesSection = () => {
	const {
		data: apiResponse,
		loading,
		error,
	} = useFetch("http://localhost:3000/api/services");
	const services = apiResponse?.services || [];

	// Preload images
	useEffect(() => {
		if (!services || services.length === 0) return;
		services.forEach((service) => {
			const img = new Image();
			img.src =
				service.image ||
				`https://source.unsplash.com/800x1200/?${service.name},abstract`;
		});
	}, [services]);

	return (
		<section className="relative overflow-hidden py-20 sm:py-28">
			<AuroraBackground />

			{/* Section Header */}
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<motion.div
					className="text-center"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.5 }}
					transition={{ duration: 0.6 }}
				>
					<div className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-sm font-semibold text-violet-700">
						Our Services
					</div>
					<h2 className="bricolage-grotesque mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
						Whatever you need, we've got a pro.
					</h2>
					<p className="inter mx-auto mt-5 max-w-2xl text-lg text-slate-600 tracking-wide leading-relaxed font-light">
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

			{/* View All Button */}
			{!loading && !error && services.length > 0 && (
				<div className="mt-10 text-center">
					<motion.a
						href="/services"
						className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all duration-300 hover:bg-violet-700 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
						initial={{ opacity: 0, y: 10 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.5 }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						<span>View All Services</span>
						<ArrowRight className="h-4 w-4" />
					</motion.a>
				</div>
			)}
		</section>
	);
};

export default ServicesSection;
