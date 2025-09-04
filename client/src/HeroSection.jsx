import React, { useState } from "react";
import BackgroundPattern from "./ui/BackgroundPattern";
import { SearchBar } from "./ui/SearchBar";

const popularSearches = ["Plumbing", "Cleaning", "Painting", "Haircut"];

export const HeroSection = () => {
	// This function will be called when a search is submitted.
	// You can replace the console.log with your actual search logic,
	// like navigating to a results page.
	const handleSearch = (query) => {
		console.log("Searching for:", query);
	};

	const [searchQuery, setSearchQuery] = useState("");

	return (
		<main className="text-center py-20 md:py-28 lg:py-32">
			<div className="absolute inset-0 min-w-full h-auto overflow-hidden -z-10">
				<BackgroundPattern />
			</div>

			<div className="relative max-w-4xl mx-auto -mt-75 px-4">
				<div className="flex flex-col items-center bricolage-grotesque">
					<p className="font-medium text-violet-800/70 mt-10">
						"Your Wish, Our Command" — <span className="genie">TaskGenie</span>
					</p>

					<h1
						className="text-4xl md:text-5xl lg:text-6xl text-[#281950]/95 font-medium leading-tight"
						style={{ fontFamily: "P22Mackinac, Cambria, sans-serif" }}
					>
						From burst pipes to makeovers,
						<div className="relative inline-block mx-2">
							<span className="relative z-10">get any task done.</span>
							<svg
								width="123"
								height="12"
								viewBox="0 0 123 12"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
								className="absolute -bottom-2 left-0 w-full"
								preserveAspectRatio="none"
							></svg>
						</div>
					</h1>

					<p className="text-[#281950bf] text-md md:text-lg mt-6 mb-6 max-w-lg lg:max-w-2xl mx-auto">
						Need a handyman or a hair stylist? Our verified pros are just a tap
						away. Fast, friendly, and always reliable.
					</p>

					{/* Use the new component */}
					<div className="w-full max-w-xl mx-auto">
						<SearchBar onSearch={handleSearch} />

						<div className="flex items-center justify-center gap-2 md:gap-3 mt-4">
							<span className="text-sm text-gray-600">Popular:</span>
							{popularSearches.map((term) => (
								<button
									key={term}
									type="button"
									onClick={() => handleSearch(term)} // Popular searches trigger a search directly
									className="cursor-pointer relative group px-3 py-1.5 text-sm text-violet-800 rounded-full
                                    backdrop-blur-sm shadow-sm hover:bg-purple-200/50 -bottom-0.5  group-hover:opacity-100 hover:text-violet-900
                                    transition-all duration-200"
								>
									{term}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>
		</main>
	);
};
