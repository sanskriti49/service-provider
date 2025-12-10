import { Search, ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";

export const SearchBar = () => {
	const [query, setQuery] = useState("");
	const [suggestions, setSuggestions] = useState([]);
	const [allServices, setAllServices] = useState([]);
	const [activeIndex, setActiveIndex] = useState(-1);

	const searchContainerRef = useRef(null);
	const navigate = useNavigate();

	const {
		data: apiResponse,
		loading,
		error,
	} = useFetch("http://localhost:3000/api/services/v1");

	// Load services
	useEffect(() => {
		if (!apiResponse) return;

		// Case 1: backend returns { services: [...] }
		if (apiResponse.services) {
			setAllServices(apiResponse.services);
		}

		// Case 2: backend returns array directly
		else if (Array.isArray(apiResponse)) {
			setAllServices(apiResponse);
		}

		// Case 3: backend returns { data: [...] }
		else if (apiResponse.data) {
			setAllServices(apiResponse.data);
		}
	}, [apiResponse]);

	// Filter suggestions
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

	// Hide dropdown when clicking outside
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

	// Navigate to selected
	const handleSelectService = (service) => {
		setQuery(service.name);
		setSuggestions([]);
		navigate(`/services/${service.slug}`);
	};

	// Form submit
	const handleSubmit = (e) => {
		e.preventDefault();
		if (!query.trim()) return;

		const exact = allServices.find(
			(s) => s.name.toLowerCase() === query.toLowerCase()
		);

		if (exact) return handleSelectService(exact);
		if (suggestions[0]) return handleSelectService(suggestions[0]);
	};

	// Keyboard navigation
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
			className="w-full max-w-2xl mx-auto relative"
			onSubmit={handleSubmit}
			ref={searchContainerRef}
			autoComplete="off"
		>
			{/* SEARCH BAR */}
			<div className="relative group drop-shadow-xl">
				<Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-900/50 group-focus-within:text-violet-700 transition" />

				<input
					type="text"
					value={query}
					onKeyDown={handleKeyDown}
					onChange={(e) => {
						setQuery(e.target.value);
						setActiveIndex(-1);
					}}
					placeholder={
						loading ? "Loading services..." : "What service do you need today?"
					}
					className="w-full pl-14 pr-32 py-4 text-lg rounded-full border border-transparent bg-white/70 backdrop-blur-md shadow-lg
					focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all duration-300 placeholder:text-gray-600"
					disabled={loading || !!error}
				/>

				{/* CLEAR BUTTON */}
				{query && !loading && (
					<button
						type="button"
						onClick={clearInput}
						className="absolute right-36 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 p-2"
					>
						<X className="h-5 w-5" />
					</button>
				)}

				{/* SUBMIT BUTTON */}
				<button
					type="submit"
					disabled={!query.trim()}
					className="absolute right-2 top-1/2 -translate-y-1/2 h-12 px-6 rounded-full text-white font-medium flex items-center gap-2
					bg-gradient-to-br from-violet-600 to-indigo-600 
					shadow-md hover:shadow-violet-300/40 hover:scale-105 active:scale-95
					transition-all duration-300"
				>
					Search
					<ArrowRight className="w-4 h-4" />
				</button>
			</div>

			{/* DROPDOWN */}
			{suggestions.length > 0 && (
				<ul className="absolute w-full max-w-2xl mt-2 bg-white/90 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50 z-20 overflow-hidden">
					{suggestions.map((service, i) => (
						<li
							key={service.id}
							onClick={() => handleSelectService(service)}
							className={`px-6 py-3 cursor-pointer text-left text-indigo-900 
							 hover:bg-violet-100/80 transition
							 ${i === activeIndex ? "bg-violet-200/80" : ""}
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
