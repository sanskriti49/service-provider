import { useState, useMemo, useEffect, useRef } from "react";
import { Search, ArrowRight, AlertCircle, X, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import gsap from "gsap";

const CATEGORIES = [
	"All",
	"Home Services",
	"Personal Care",
	"Child Services",
	"Fitness / Health",
];

export default function AllServices() {
	const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

	const {
		data: apiResponse,
		loading,
		error,
	} = useFetch(`${API_URL}/api/services/v1`);

	const services = Array.isArray(apiResponse)
		? apiResponse
		: apiResponse?.data || [];

	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("All");

	const gridRef = useRef(null);

	const filtered = useMemo(() => {
		if (!services) return [];
		return services.filter((s) => {
			const searchMatch = s.name
				.toLowerCase()
				.includes(searchQuery.toLowerCase());
			const categoryMatch =
				selectedCategory === "All" ||
				s.category?.toLowerCase() === selectedCategory.toLowerCase();

			return searchMatch && categoryMatch;
		});
	}, [services, searchQuery, selectedCategory]);

	useEffect(() => {
		if (!filtered || filtered.length === 0) return;
		const cards = gridRef.current?.querySelectorAll(".service-card");

		if (cards) {
			gsap.fromTo(
				cards,
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					stagger: 0.05,
					duration: 0.4,
					ease: "power2.out",
					clearProps: "all",
				},
			);
		}
	}, [filtered, selectedCategory]);

	return (
		<div className="min-h-screen pt-32 pb-12 px-4 sm:px-8 relative overflow-hidden bg-slate-50">
			{/* Background Ambience - Very Soft Pastel */}
			<div className="absolute top-0 left-1/4 w-146 h-96 bg-purple-200/30 rounded-full blur-[100px] pointer-events-none" />
			<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-200/20 rounded-full blur-[100px] pointer-events-none" />

			<div className="max-w-7xl mx-auto relative z-10">
				<div className="text-center mb-12">
					<h1 className="bricolage-grotesque text-4xl md:text-6xl font-bold mb-4 tracking-tight text-slate-900">
						Find the perfect{" "}
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-500">
							Service
						</span>
					</h1>
					<p className="inter text-slate-600 text-lg max-w-2xl mx-auto">
						Search through our wide range of professional services tailored to
						your needs.
					</p>
				</div>

				{/* Search Bar */}
				<div className="inter relative max-w-2xl mx-auto mb-10 group">
					<div className="absolute left-5 inset-y-0 flex items-center text-violet-300 group-focus-within:text-violet-600 transition-colors duration-300">
						<Search className="h-5 w-5" />
					</div>

					<input
						type="text"
						placeholder="What do you need help with?"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-14 pr-12 py-4 rounded-full bg-white border border-slate-200 text-slate-900
                        shadow-lg shadow-purple-100/50 text-lg placeholder:text-slate-400
                        focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 transition-all duration-300"
					/>

					{searchQuery && (
						<button
							onClick={() => setSearchQuery("")}
							className="cursor-pointer absolute right-5 inset-y-0 flex items-center text-slate-400 hover:text-red-500 transition-colors"
						>
							<X className="h-5 w-5" />
						</button>
					)}
				</div>

				{/* Categories */}
				<div className="flex flex-wrap justify-center gap-3 mb-16">
					{CATEGORIES.map((cat) => (
						<button
							key={cat}
							onClick={() => setSelectedCategory(cat)}
							className={`inter cursor-pointer px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 border ${
								selectedCategory === cat
									? "bg-violet-800 text-white border-violet-600 shadow-md shadow-violet-200 scale-105"
									: "bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50"
							}`}
						>
							{cat}
						</button>
					))}
				</div>

				{/* Content Area */}
				{loading && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
						{[...Array(8)].map((_, i) => (
							<div
								key={i}
								className="h-[400px] bg-white rounded-3xl animate-pulse border border-slate-200"
							/>
						))}
					</div>
				)}

				{error && (
					<div className="py-20 text-center bg-white rounded-3xl border border-red-100 shadow-sm">
						<div className="inline-flex p-3 bg-red-50 rounded-full mb-4">
							<AlertCircle size={32} className="text-red-500" />
						</div>
						<h3 className="text-xl font-bold text-slate-800 mb-2">
							Unable to load services
						</h3>
						<p className="text-slate-500">{error}</p>
					</div>
				)}

				{!loading && filtered.length === 0 && (
					<div className="bricolage-grotesque text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300">
						<div className="inline-flex p-4 bg-violet-50 rounded-full mb-4">
							<Filter size={32} className="text-violet-600" />
						</div>
						<h3 className="text-xl font-bold text-slate-800 mb-2">
							No services found
						</h3>
						<p className="text-slate-500 text-lg mb-6">
							Try adjusting your search or filters.
						</p>
						<button
							onClick={() => {
								setSelectedCategory("All");
								setSearchQuery("");
							}}
							className="text-violet-600 font-semibold hover:text-violet-800 transition-colors underline underline-offset-4"
						>
							Clear all filters
						</button>
					</div>
				)}

				{!loading && filtered.length > 0 && (
					<div
						ref={gridRef}
						className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
					>
						{filtered.map((s) => (
							<ServiceCard key={s.id} service={s} />
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function ProgressiveImage({ src, alt }) {
	const imgRef = useRef(null);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		if (loaded && imgRef.current) {
			gsap.to(imgRef.current, {
				opacity: 1,
				scale: 1,
				duration: 0.5,
				ease: "power2.out",
			});
		}
	}, [loaded]);

	return (
		<div className="relative w-full h-full bg-slate-100 overflow-hidden">
			{!loaded && (
				<div className="absolute inset-0 bg-violet-100 animate-pulse z-10" />
			)}
			<img
				ref={imgRef}
				src={src}
				alt={alt}
				loading="lazy"
				onLoad={() => setLoaded(true)}
				className="w-full h-full object-cover transition-transform duration-700 opacity-0 scale-110"
			/>
		</div>
	);
}

function ServiceCard({ service }) {
	const imageUrl = service.image_url || "/images/default-service.jpg";

	return (
		<div className="service-card group flex flex-col rounded-3xl bg-gradient-to-br from-white to-[#ede9fe] overflow-hidden shadow-sm hover:shadow-xl hover:shadow-purple-200/60 transition-all duration-300 hover:-translate-y-2 border border-violet-100 hover:border-violet-300">
			<Link
				to={`/services/${service.slug || service.id}`}
				className="h-full flex flex-col"
			>
				<div className="relative h-64 overflow-hidden">
					<ProgressiveImage src={imageUrl} alt={service.name} />

					{/* Category Tag */}
					<div className="inter absolute top-4 left-4 z-20">
						<span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-white/90 backdrop-blur-md text-violet-800 rounded-full shadow-sm border border-violet-100">
							{service.category || "Service"}
						</span>
					</div>
				</div>

				<div className="p-6 flex flex-col flex-grow">
					<div className="flex justify-between items-start mb-3">
						<h3 className="mackinac text-[22px] font-bold text-slate-800 group-hover:text-violet-900 transition-colors line-clamp-1">
							{service.name}
						</h3>
					</div>

					<p className="inter text-slate-600 text-sm line-clamp-2 mb-6 flex-grow">
						{service.description}
					</p>

					<div className="inter flex items-center justify-between mt-auto pt-4 border-t border-violet-200/50">
						<div className="flex flex-col">
							<span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
								Starts from
							</span>
							<span className="text-violet-900 font-bold text-lg">
								₹{service.price || "On Request"}
								{service.price && (
									<span className="text-xs text-slate-500 font-normal ml-1">
										{service.price_unit !== "fixed"
											? `/ ${service.price_unit}`
											: ""}
									</span>
								)}
							</span>
						</div>

						<div className="w-10 h-10 rounded-full bg-white/80 border border-violet-200 flex items-center justify-center text-violet-500 group-hover:bg-violet-800 group-hover:text-white group-hover:border-violet-400 transition-all duration-300 shadow-sm">
							<ArrowRight size={18} />
						</div>
					</div>
				</div>
			</Link>
		</div>
	);
}
