import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, Filter, AlertCircle } from "lucide-react";
import { useFetch } from "../hooks/useFetch"; // Assuming you have this from previous code
import { Link } from "react-router-dom";

// --- Categories Config (You can also fetch these from backend) ---
const CATEGORIES = [
	"All",
	"Home Services",
	"Personal Care",
	"Child Services",
	"Fitness / Health",
	"Repairs",
];

// --- Animation Variants ---
const containerVariants = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: { staggerChildren: 0.1 },
	},
};

const cardVariants = {
	hidden: { opacity: 0, y: 20 },
	show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AllServices() {
	const {
		data: services,
		loading,
		error,
	} = useFetch("http://localhost:3000/api/services/v1");

	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("All");
	const [filteredServices, setFilteredServices] = useState([]);

	useEffect(() => {
		if (!services) return;

		let result = services;

		// 1. Search Filter
		if (searchQuery) {
			result = result.filter((s) =>
				s.name.toLowerCase().includes(searchQuery.toLowerCase())
			);
		}

		// 2. Category Filter (Matches your service naming conventions or specific category field)
		// Note: Since your current backend mock might not have a 'category' field,
		// we can simulate it or rely on the name.
		// For now, I will skip strict category filtering unless your backend sends a 'category' key.
		// If you add a 'category' column to DB, uncomment the lines below:

		/* if (selectedCategory !== "All") {
       result = result.filter(s => s.category === selectedCategory);
    }
    */

		setFilteredServices(result);
	}, [services, searchQuery, selectedCategory]);

	return (
		<div className="lg:-mt-40 -mt-50 bricolage-grotesque min-h-screen relative overflow-hidden pt-24 pb-12 px-4 sm:px-8">
			<div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1">
				{/* --- Header Section --- */}
				<div className="text-center max-w-3xl mx-auto mb-16">
					<motion.h1
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						className="bricolage-grotesque text-4xl md:text-5xl font-bold text-slate-900 mb-6"
					>
						Find the perfect{" "}
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">
							Service
						</span>
					</motion.h1>

					{/* Search Bar */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: 0.1 }}
						className="relative max-w-xl mx-auto"
					>
						<div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
							<Search className="h-5 w-5" />
						</div>
						<input
							type="text"
							placeholder="What do you need help with? (e.g. Cleaning, AC...)"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-12 pr-4 py-4 rounded-full bg-white border border-gray-200 shadow-xl shadow-violet-100/50 focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-400 text-lg transition-all"
						/>
					</motion.div>

					{/* Category Pills */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.2 }}
						className="mt-8 flex flex-wrap justify-center gap-2"
					>
						{CATEGORIES.map((cat) => (
							<button
								key={cat}
								onClick={() => setSelectedCategory(cat)}
								className={`cursor-pointer px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border
                  ${
										selectedCategory === cat
											? "bg-violet-900 text-white border-slate-900 shadow-lg scale-105"
											: "bg-white text-slate-600 border-gray-200 hover:border-violet-300 hover:bg-violet-50"
									}`}
							>
								{cat}
							</button>
						))}
					</motion.div>
				</div>

				{/* --- Content Area --- */}
				{loading ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
						{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
							<div
								key={i}
								className="h-80 bg-slate-200 rounded-2xl animate-pulse"
							/>
						))}
					</div>
				) : error ? (
					<div className="flex flex-col items-center justify-center py-20 text-red-500 bg-red-50 rounded-3xl border border-red-100">
						<AlertCircle size={48} className="mb-4" />
						<h3 className="text-xl font-bold">
							Oops! Could not load services.
						</h3>
						<p>{error}</p>
					</div>
				) : (
					<>
						{filteredServices.length === 0 ? (
							<div className="text-center py-20">
								<p className="text-slate-400 text-lg">
									No services found matching "{searchQuery}".
								</p>
								<button
									onClick={() => {
										setSearchQuery("");
										setSelectedCategory("All");
									}}
									className="mt-4 text-violet-600 font-semibold hover:underline"
								>
									Clear Filters
								</button>
							</div>
						) : (
							<motion.div
								variants={containerVariants}
								initial="hidden"
								animate="show"
								className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
							>
								<AnimatePresence>
									{filteredServices.map((service) => (
										<ServiceGridCard
											key={service.id || service.slug}
											service={service}
										/>
									))}
								</AnimatePresence>
							</motion.div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

// --- Individual Card Component ---
function ServiceGridCard({ service }) {
	return (
		<motion.div variants={cardVariants} layout>
			<Link
				to={`/services/${service.slug}`}
				className="group relative block h-[350px] w-full overflow-hidden rounded-3xl bg-white shadow-sm hover:shadow-xl transition-all duration-500 border border-white/40"
			>
				{/* Image Background */}
				<div className="absolute inset-0">
					<img
						src={service.image}
						alt={service.name}
						className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
					/>
					{/* Gradient Overlay */}
					<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
				</div>

				{/* Content */}
				<div className="absolute inset-0 p-6 flex flex-col justify-end text-white">
					<div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
						<h3
							className="text-2xl font-bold mb-2"
							style={{ fontFamily: "P22Mackinac, serif" }}
						>
							{service.name}
						</h3>

						<p className="text-gray-300 text-sm line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75 mb-4">
							{service.description}
						</p>

						<div className="flex items-center gap-2 text-sm font-medium text-violet-300 group-hover:text-violet-200">
							<span>Book Now</span>
							<div className="bg-white/20 p-1 rounded-full group-hover:bg-violet-500 group-hover:text-white transition-colors duration-300">
								<ArrowRight size={14} />
							</div>
						</div>
					</div>
				</div>
			</Link>
		</motion.div>
	);
}
