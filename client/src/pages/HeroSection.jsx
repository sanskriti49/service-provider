import BackgroundPattern from "../ui/BackgroundPattern";
import { SearchBar } from "../ui/SearchBar";
import { Link } from "react-router-dom";

const popularSearches = ["Plumbing", "House Cleaning", "Painting", "Haircut"];

export const HeroSection = () => {
	return (
		<main className="relative w-full pb-36 md:-mt-38 md:pb-68 lg:-mt-40 lg:pb-105 xl:-mt-40 xl:pb-75  overflow-hidden">
			<div className="absolute inset-0 w-full h-full mt-35 md:mt-50 lg:mt-70 xl:mt-40">
				<BackgroundPattern />
			</div>

			<div className="relative z-10 mt-80 max-w-4xl mx-auto px-4 sm:px-6">
				<div className="flex flex-col items-center text-center bricolage-grotesque">
					<p className="font-medium text-violet-800/80  text-sm md:text-base tracking-wide">
						"Your Wish, Our Command" —{" "}
						<span className=" text-violet-900">TaskGenie</span>
					</p>

					<h1
						className="text-4xl sm:text-4xl md:text-5xl lg:text-5xl text-[#281950] font-medium leading-[1.1] tracking-tight mb-6"
						style={{ fontFamily: "P22Mackinac, Cambria, sans-serif" }}
					>
						From burst pipes to makeovers,
						<div className="relative inline-block mx-2">
							<span className="relative z-10">get any task done.</span>
						</div>
					</h1>

					<p className="text-[#281950]/80 text-base sm:text-lg md:text-xl mt-4 mb-10 max-w-lg md:max-w-2xl mx-auto leading-relaxed">
						Need a handyman or a hair stylist? Our verified pros are just a tap
						away. Fast, friendly, and always reliable.
					</p>

					<div className="w-full max-w-xl mx-auto">
						<SearchBar />

						<div className="flex flex-wrap items-center justify-center gap-2 mt-6">
							<span className="text-sm font-medium text-gray-500 mr-1">
								Popular:
							</span>
							{popularSearches.map((term) => (
								<Link
									key={term}
									to={`/services/${term.toLowerCase()}`}
									className="px-3 py-1.5 text-xs sm:text-sm font-medium text-violet-700 bg-violet-50/50 border border-violet-100 rounded-full
                                    hover:bg-violet-100 hover:text-violet-900 hover:border-violet-200 hover:scale-105
                                    transition-all duration-200 ease-out cursor-pointer"
								>
									{term}
								</Link>
							))}
						</div>
					</div>
				</div>
			</div>
		</main>
	);
};
