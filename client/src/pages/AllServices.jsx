import { useState, useMemo, useEffect, useRef } from "react";
import { Search, ArrowRight, AlertCircle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import gsap from "gsap";

const CATEGORIES = [
	"All",
	"Home Services",
	"Personal Care",
	"Child Services",
	"Fitness / Health",
	"Repairs",
];

export default function AllServices() {
	const {
		data: services,
		loading,
		error,
	} = useFetch("http://localhost:3000/api/services/v1");

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

		gsap.fromTo(
			cards,
			{ opacity: 0, y: 20, filter: "blur(6px)" },
			{
				opacity: 1,
				y: 0,
				filter: "blur(0px)",
				stagger: 0.06,
				duration: 0.45,
				ease: "power2.out",
			}
		);
	}, [filtered]);

	return (
		<div className="lg:-mt-40 -mt-50 bricolage-grotesque min-h-screen pt-24 pb-12 px-4 sm:px-8">
			<div className="max-w-7xl mx-auto">
				<h1 className="text-center text-4xl md:text-5xl font-bold text-slate-900 mb-8">
					Find the perfect{" "}
					<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">
						Service
					</span>
				</h1>

				<div className="relative max-w-xl mx-auto mb-8">
					<div className="absolute left-4 inset-y-0 flex items-center text-gray-400">
						<Search className="h-5 w-5" />
					</div>

					<input
						type="text"
						placeholder="What do you need help with?"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-12 pr-12 py-4 rounded-full bg-white border border-[#d4ceea]
						shadow-lg focus:outline-none focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] transition duration-250"
					/>

					{searchQuery && (
						<button
							onClick={() => setSearchQuery("")}
							className="cursor-pointer absolute right-4 inset-y-0 flex items-center text-gray-400 hover:text-violet-500"
						>
							<X className="h-5 w-5" />
						</button>
					)}
				</div>

				<div className="flex flex-wrap justify-center gap-3 mb-12">
					{CATEGORIES.map((cat) => (
						<button
							key={cat}
							onClick={() => setSelectedCategory(cat)}
							className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border ${
								selectedCategory === cat
									? "bg-violet-900 text-white border-violet-900 shadow-lg scale-105"
									: "bg-white text-slate-600 border-gray-200 hover:bg-violet-50 hover:border-violet-300"
							}`}
						>
							{cat}
						</button>
					))}
				</div>

				{loading && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
						{[...Array(8)].map((_, i) => (
							<div
								key={i}
								className="h-[350px] bg-slate-100 rounded-3xl animate-pulse"
							/>
						))}
					</div>
				)}

				{error && (
					<div className="py-20 text-center text-red-600">
						<AlertCircle size={40} className="mx-auto mb-2" />
						Could not load services.
					</div>
				)}

				{!loading && filtered.length === 0 && (
					<div className="text-center py-20">
						<p className="text-slate-400 text-lg">No services found.</p>
						<button
							onClick={() => {
								setSelectedCategory("All");
								setSearchQuery("");
							}}
							className="mt-3 text-violet-600 font-semibold hover:underline"
						>
							Clear Filters
						</button>
					</div>
				)}

				{!loading && filtered.length > 0 && (
					<div
						ref={gridRef}
						className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
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
		if (loaded) {
			gsap.to(imgRef.current, {
				opacity: 1,
				scale: 1,
				duration: 0.6,
				ease: "power2.out",
			});
		}
	}, [loaded]);

	return (
		<div className="relative w-full h-full bg-slate-200 overflow-hidden rounded-3xl">
			{!loaded && (
				<div className="absolute inset-0 bg-slate-200 animate-pulse z-10"></div>
			)}

			<img
				ref={imgRef}
				src={src}
				alt={alt}
				loading="lazy"
				onLoad={() => setLoaded(true)}
				className="w-full h-full object-cover opacity-0 scale-110 rounded-3xl"
			/>
		</div>
	);
}

function ServiceCard({ service }) {
	return (
		<div className="service-card rounded-3xl overflow-hidden relative shadow-md hover:shadow-xl transition-all">
			<Link
				to={`/services/${service.slug}`}
				className="block h-[350px] group relative"
			>
				<div className="absolute inset-0">
					<ProgressiveImage src={service.image} alt={service.name} />

					<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-90 transition-all duration-300" />
				</div>

				<div className="absolute inset-0 p-6 flex flex-col justify-end text-white pointer-events-none z-20">
					<h3 className="text-2xl font-bold mb-2">{service.name}</h3>

					<p className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm text-gray-300 line-clamp-2 mb-4">
						{service.description}
					</p>

					<div className="flex items-center gap-2 text-sm text-violet-300 group-hover:text-violet-200">
						<span>Book Now</span>
						<ArrowRight
							size={16}
							className="transition group-hover:translate-x-1"
						/>
					</div>
				</div>
			</Link>
		</div>
	);
}
