import { Search, ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";

export const SearchBar = () => {
	const navigate = useNavigate();
	const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

	const [query, setQuery] = useState("");
	const [suggestions, setSuggestions] = useState([]);
	const [allServices, setAllServices] = useState([]);
	const [activeIndex, setActiveIndex] = useState(-1);

	const searchContainerRef = useRef(null);

	const {
		data: apiResponse,
		loading,
		error,
	} = useFetch(`${API_URL}/api/services/v1`);

	useEffect(() => {
		if (!apiResponse) return;

		if (apiResponse.services) {
			setAllServices(apiResponse.services);
		} else if (Array.isArray(apiResponse)) {
			setAllServices(apiResponse);
		} else if (apiResponse.data) {
			setAllServices(apiResponse.data);
		}
	}, [apiResponse]);

	useEffect(() => {
		if (query.length > 1 && allServices.length > 0) {
			const filtered = allServices.filter((service) =>
				(service.name || service.title || service.serviceName)
					?.toLowerCase()
					.includes(query.toLowerCase())
			);
			setSuggestions(filtered);
		} else {
			setSuggestions([]);
		}
	}, [query, allServices]);

	useEffect(() => {
		const handler = (e) => {
			if (
				searchContainerRef.current &&
				!searchContainerRef.current.contains(e.target)
			) {
				setSuggestions([]);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const handleSelectService = (service) => {
		setQuery(service.name);
		setSuggestions([]);
		navigate(`/services/${service.slug}`);
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		if (!query.trim()) return;

		const exact = allServices.find(
			(s) => s.name.toLowerCase() === query.toLowerCase()
		);

		if (exact) return handleSelectService(exact);
		if (suggestions[0]) return handleSelectService(suggestions[0]);
	};

	const handleKeyDown = (e) => {
		if (suggestions.length === 0) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setActiveIndex((i) => (i + 1) % suggestions.length);
				break;
			case "ArrowUp":
				e.preventDefault();
				setActiveIndex(
					(i) => (i - 1 + suggestions.length) % suggestions.length
				);
				break;
			case "Enter":
				e.preventDefault();
				if (activeIndex >= 0) handleSelectService(suggestions[activeIndex]);
				else handleSubmit(e);
				break;
			case "Escape":
				setSuggestions([]);
				break;
		}
	};

	const clearInput = () => {
		setQuery("");
		setSuggestions([]);
	};

	return (
		<form
			className="w-full max-w-2xl mx-auto relative z-30"
			onSubmit={handleSubmit}
			ref={searchContainerRef}
			autoComplete="off"
		>
			<div className="relative group drop-shadow-2xl">
				{/* Search Icon */}
				<div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-violet-900/50 group-focus-within:text-violet-700 transition-colors duration-300">
					<Search className="w-5 h-5" />
				</div>

				{/* Input Field */}
				<input
					type="text"
					value={query}
					onKeyDown={handleKeyDown}
					onChange={(e) => {
						setQuery(e.target.value);
						setActiveIndex(-1);
					}}
					placeholder={loading ? "Loading..." : "What service do you need?"}
					// Adjusted padding-right (pr) to prevent text going behind buttons
					className="w-full pl-12 pr-[5.5rem] md:pr-40 py-4 text-base md:text-lg 
                    rounded-full border border-white/40 bg-white/60 backdrop-blur-xl 
                    shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-500/30
                    focus:bg-white transition-all duration-300 placeholder:text-gray-500 text-gray-800"
					disabled={loading || !!error}
				/>

				{/* Clear (X) Button */}
				{query && !loading && (
					<button
						type="button"
						onClick={clearInput}
						className="absolute right-[3.5rem] md:right-[8.5rem] top-1/2 -translate-y-1/2 
                        p-1.5 rounded-full hover:bg-gray-200/50 text-gray-400 hover:text-gray-600 transition-all"
					>
						<X className="h-4 w-4" />
					</button>
				)}

				{/* Submit Button */}
				<button
					type="submit"
					disabled={!query.trim()}
					className="absolute right-1.5 top-1.5 bottom-1.5 
                    aspect-square md:aspect-auto md:px-6 rounded-full 
                   bg-violet-600 bg-gradient-to-br from-[#b369de] to-[#4f46e5] text-white 
                    shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 
                    hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed
                    transition-all duration-300 flex items-center justify-center gap-2 group/btn"
				>
					<span className="hidden md:inline font-medium">Search</span>
					<ArrowRight className="w-5 h-5 md:w-4 md:h-4 group-hover/btn:translate-x-0.5 transition-transform" />
				</button>
			</div>

			{/* Suggestions Dropdown */}
			{suggestions.length > 0 && (
				<ul className="absolute w-full mt-2 bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
					{suggestions.map((service, i) => (
						<li
							key={service.id || i}
							onClick={() => handleSelectService(service)}
							className={`px-6 py-3.5 cursor-pointer text-left text-gray-700 font-medium
                             hover:bg-violet-50 hover:text-violet-700 transition-colors border-b border-gray-100 last:border-none
                             ${
																i === activeIndex
																	? "bg-violet-50 text-violet-700"
																	: ""
															}
                            `}
						>
							{service.name}
						</li>
					))}
				</ul>
			)}
		</form>
	);
};
