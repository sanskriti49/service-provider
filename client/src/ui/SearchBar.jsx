import { Search, ArrowRight, X, AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";

export const SearchBar = () => {
	const navigate = useNavigate();
	const API_URL =
		(import.meta.env && import.meta.env.VITE_API_URL) ||
		"http://localhost:3000";

	const [query, setQuery] = useState("");
	const [suggestions, setSuggestions] = useState([]);
	const [allServices, setAllServices] = useState([]);
	const [activeIndex, setActiveIndex] = useState(-1);

	const [showError, setShowError] = useState(false);
	const [isShaking, setIsShaking] = useState(false);

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
		if (showError) setShowError(false);

		if (query.length > 1 && allServices.length > 0) {
			const filtered = allServices.filter((service) =>
				(service.name || service.title || service.serviceName)
					?.toLowerCase()
					.includes(query.toLowerCase()),
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
				setShowError(false);
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

	const triggerError = () => {
		setShowError(true);
		setIsShaking(true);

		setTimeout(() => setIsShaking(false), 500);
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		if (!query.trim()) return;

		const exact = allServices.find(
			(s) => s.name.toLowerCase() === query.toLowerCase(),
		);

		if (exact) return handleSelectService(exact);
		if (suggestions[0]) return handleSelectService(suggestions[0]);

		triggerError();
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
					(i) => (i - 1 + suggestions.length) % suggestions.length,
				);
				break;
			case "Enter":
				e.preventDefault();
				if (activeIndex >= 0) handleSelectService(suggestions[activeIndex]);
				else handleSubmit(e);
				break;
			case "Escape":
				setSuggestions([]);
				setShowError(false);
				break;
		}
	};

	const clearInput = () => {
		setQuery("");
		setSuggestions([]);
		setShowError(false);
	};

	return (
		<form
			className="w-full max-w-2xl mx-auto relative z-30"
			onSubmit={handleSubmit}
			ref={searchContainerRef}
			autoComplete="off"
		>
			{/* Main Container 
                Added logic for 'isShaking' (animation) and 'showError' (red border)
            */}
			<div
				className={`relative w-full h-16 flex items-center group transition-transform duration-100 ${
					isShaking ? "translate-x-[-10px] animate-shake" : ""
				}`}
				style={
					isShaking
						? { animation: "shake 0.4s cubic-bezier(.36,.07,.19,.97) both" }
						: {}
				}
			>
				{/* 1. INPUT FIELD */}
				<input
					type="text"
					value={query}
					onKeyDown={handleKeyDown}
					onChange={(e) => {
						setQuery(e.target.value);
						setActiveIndex(-1);
					}}
					placeholder={loading ? "Loading..." : "What service do you need?"}
					className={`w-full h-full pl-12 pr-[5.5rem] md:pr-44 py-4 text-base md:text-lg rounded-full border bg-white shadow-xl focus:outline-none transition-all duration-300 placeholder:text-gray-400 text-gray-800
                    ${
											showError
												? "border-red-400 ring-4 ring-red-500/10 shadow-red-500/10"
												: "border-gray-200 shadow-violet-900/5 focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500"
										}`}
					disabled={loading || !!error}
				/>

				<div
					className={`absolute left-4 pointer-events-none transition-colors duration-300 z-10 ${
						showError
							? "text-red-500"
							: "text-violet-400 group-focus-within:text-violet-600"
					}`}
				>
					<Search className="w-5 h-5" />
				</div>

				{query && !loading && (
					<button
						type="button"
						onClick={clearInput}
						className="absolute right-[3.5rem] md:right-[10.5rem] p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-all z-20 cursor-pointer"
					>
						<X className="h-4 w-4" />
					</button>
				)}

				<button
					type="submit"
					disabled={!query.trim()}
					className={`cursor-pointer absolute right-2 top-2 bottom-2 
                    aspect-square md:aspect-auto md:px-6 rounded-full 
                    text-white shadow-lg 
                    hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                    transition-all duration-300 flex items-center justify-center gap-2 z-20
                    ${
											showError
												? "bg-red-500 shadow-red-500/30 hover:bg-red-600"
												: "bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-500/30 hover:shadow-violet-500/50 hover:from-violet-500 hover:to-indigo-500"
										}`}
				>
					<span className="hidden md:inline font-medium tracking-wide">
						{showError ? "Retry" : "Search"}
					</span>
					<ArrowRight className="w-5 h-5 md:w-4 md:h-4" />
				</button>
			</div>

			{suggestions.length > 0 && (
				<ul className="absolute top-full left-0 right-0 mt-3 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
					{suggestions.map((service, i) => (
						<li
							key={service.id || i}
							onClick={() => handleSelectService(service)}
							className={`px-6 py-4 cursor-pointer text-left text-gray-700 font-medium hover:bg-violet-50 hover:text-violet-700 transition-colors border-b border-gray-50 last:border-none flex items-center justify-between group ${
								i === activeIndex ? "bg-violet-50 text-violet-700" : ""
							}`}
						>
							<span>{service.name}</span>
							<ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-violet-400" />
						</li>
					))}
				</ul>
			)}

			{showError && suggestions.length === 0 && (
				<div className="absolute top-full left-0 right-0 mt-3 p-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-red-100 z-50 animate-in fade-in slide-in-from-top-2 duration-200 ring-1 ring-red-500/10">
					<div className="flex items-start gap-4">
						<div className="p-2 bg-red-50 rounded-full text-red-500 shrink-0">
							<AlertCircle className="w-6 h-6" />
						</div>
						<div className="flex-1">
							<h3 className="font-semibold text-gray-900">No services found</h3>
							<p className="text-sm text-gray-500 mt-1">
								We couldn't find a match for "
								<span className="font-medium text-gray-800">{query}</span>".
							</p>
							<p className="text-sm text-gray-400 mt-2">
								Try searching for "Plumbing", "Cleaning", or "Electrician".
							</p>
						</div>
						<button
							type="button"
							onClick={clearInput}
							className="cursor-pointer text-xs font-medium px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
						>
							Clear
						</button>
					</div>
				</div>
			)}

			{/* CSS Animation for Shake */}
			<style>{`
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }
            `}</style>
		</form>
	);
};
