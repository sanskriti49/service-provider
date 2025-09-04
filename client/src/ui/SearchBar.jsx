import { Search, ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetch } from "../hooks/useFetch";

// const allServices = [
// 	"Plumbing",
// 	"Cleaning",
// 	"Painting",
// 	"Haircut",
// 	"Electrician",
// 	"Gardening",
// 	"Moving",
// 	"Appliance Repair",
// 	"Pest Control",
// 	"Personal Trainer",
// 	"Handyman Services",
// 	"Housekeeping",
// ];

export const SearchBar = ({ onSearch }) => {
	const [query, setQuery] = useState("");
	const [suggestions, setSuggestions] = useState([]);
	const [activeIndex, setActiveIndex] = useState(-1);
	const searchContainerRef = useRef(null);

	const {
		data: apiResponse,
		loading,
		error,
	} = useFetch("http://localhost:3000/api/services");

	const [allServices, setAllServices] = useState([]);
	useEffect(() => {
		if (apiResponse && apiResponse.services) {
			// Assuming each service is an object with a 'name' property
			const serviceNames = apiResponse.services.map((service) => service.name);
			setAllServices(serviceNames);
		}
	}, [apiResponse]); // This effect runs only when the apiResponse data arrives/changes

	// This ensures that if the services load *after* you've typed,
	// the suggestions are correctly filtered.
	useEffect(() => {
		if (query.length > 1 && allServices.length > 0) {
			const filteredSuggestions = allServices.filter((serviceName) =>
				serviceName.toLowerCase().includes(query.toLowerCase())
			);
			setSuggestions(filteredSuggestions);
		} else {
			setSuggestions([]);
		}
	}, [query, allServices]);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (
				searchContainerRef.current &&
				!searchContainerRef.current.contains(event.target)
			) {
				setSuggestions([]);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	const handleInputChange = (e) => {
		setQuery(e.target.value);
		setActiveIndex(-1);
	};

	const handleSuggestionClick = (suggestion) => {
		setQuery(suggestion);
		setSuggestions([]);
		onSearch(suggestion);
	};

	const handleKeyDown = (e) => {
		if (suggestions.length === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((prevIndex) => (prevIndex + 1) % suggestions.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			// FIX #2: Corrected the modulo logic for negative numbers
			setActiveIndex(
				(prevIndex) => (prevIndex - 1 + suggestions.length) % suggestions.length
			);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (activeIndex > -1) {
				const selectedSuggestion = suggestions[activeIndex];
				handleSuggestionClick(selectedSuggestion);
			} else {
				handleSubmit(e);
			}
		} else if (e.key === "Escape") {
			setSuggestions([]);
		}
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		if (query.trim()) {
			onSearch(query.trim());
			setSuggestions([]);
		}
	};
	const clearInput = () => {
		setQuery("");
		setSuggestions([]);
	};

	return (
		// ... your JSX remains the same, it was already correct ...
		<form
			className="w-full max-w-xl mx-auto"
			onSubmit={handleSubmit}
			ref={searchContainerRef}
		>
			<div className="relative group">
				<Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-900/50 pointer-events-none transition-colors group-focus-within:text-violet-600" />
				<input
					type="text"
					value={query}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					className="w-full pl-14 pr-32 py-4 rounded-full border border-transparent text-indigo-900/95 bg-white/60 backdrop-blur-sm
					focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white/80
					transition-all duration-300 shadow-lg shadow-gray-800/10 placeholder:text-gray-500"
					placeholder={
						loading ? "Loading services..." : "What service do you need today?"
					}
					disabled={loading || error}
					autoComplete="off"
				/>

				{query && !loading && (
					<button
						type="button"
						onClick={clearInput}
						className="absolute right-36 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-800"
						aria-label="Clear search"
					>
						<X className="w-5 h-5" />
					</button>
				)}

				<button
					type="submit"
					className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-white group/btn flex justify-center items-center h-12 border-none rounded-full px-6
					bg-violet-600 bg-gradient-to-br from-[#b369de] to-[#4f46e5]
					active:scale-95 hover:scale-105 hover:shadow-lg hover:shadow-violet-400/50 
					transition-all duration-300 ease-in-out"
				>
					<span className="font-semibold">Search</span>
					<ArrowRight className="w-4 h-4 ml-2 transition-transform duration-300 group-hover/btn:translate-x-1" />
				</button>
			</div>

			{error && <p className="text-red-500 text-sm mt-2">{error}</p>}

			{suggestions.length > 0 && (
				<ul className="absolute w-full max-w-xl mt-2 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden z-20">
					{suggestions.map((suggestion, index) => (
						<li
							key={suggestion}
							onClick={() => handleSuggestionClick(suggestion)}
							className={`px-6 py-3 cursor-pointer text-left text-indigo-900/90 hover:bg-violet-100/80 transition-colors duration-150 ${
								index === activeIndex ? "bg-violet-200/80" : ""
							}`}
						>
							{suggestion}
						</li>
					))}
				</ul>
			)}
		</form>
	);
};
