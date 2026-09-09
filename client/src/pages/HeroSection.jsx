import BackgroundPattern from "../ui/BackgroundPattern";
import { SearchBar } from "../ui/SearchBar";
import { Link } from "react-router-dom";

const popularSearches = ["Plumbing", "House Cleaning", "Laundry", "Haircut"];

export const HeroSection = () => {
	return (
		<main className="relative w-full pt-32 pb-24 md:pt-40 md:pb-32 lg:pt-44 lg:pb-36 overflow-hidden">
			<div className="absolute inset-0 w-full h-full pointer-events-none opacity-80 pt-28 md:pt-36 lg:pt-40">
				<BackgroundPattern />
			</div>

			<div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6">
				<div className="flex flex-col items-center text-center bricolage-grotesque">
					<p className="font-semibold text-violet-900 text-xs sm:text-sm tracking-widest uppercase mb-3 backdrop-blur-md px-4 py-1.5 shadow-xs">
						"Your Wish, Our Command" —{" "}
						<span className="text-violet-950 font-bold">TaskGenie</span>
					</p>

					<h1
						className="text-4xl sm:text-5xl md:text-6xl text-[#281950] font-bold leading-[1.1] tracking-tight mb-3"
						style={{ fontFamily: "P22Mackinac, Cambria, sans-serif" }}
					>
						From burst pipes to makeovers,
						<span className="block mt-1 bg-gradient-to-r from-[#4c1d95] via-[#3b0764] to-[#1e1b4b] bg-clip-text text-transparent font-extrabold [text-shadow:none]">
							get any task done.
						</span>
					</h1>

					<p className="text-[#281950]/90 text-base sm:text-lg md:text-xl mt-2 mb-8 max-w-xl mx-auto leading-relaxed font-medium bg-white/40 backdrop-blur-xs px-4 py-1.5 rounded-2xl border border-white/40">
						Need a handyman or a hair stylist? Our verified pros are just a tap
						away. Fast, friendly, and always reliable.
					</p>

					<div className="w-full max-w-xl mx-auto">
						<SearchBar />

						<div className="flex flex-wrap items-center justify-center gap-2 mt-6">
							<span className="text-xs sm:text-sm font-semibold text-violet-950/80 mr-1">
								Popular:
							</span>
							{popularSearches.map((term) => (
								<Link
									key={term}
									to={`/services/${term.toLowerCase().replace(/\s+/g, "-")}`}
									className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-violet-900 bg-white/80 border border-violet-200/80 rounded-full
                                    hover:bg-violet-600 hover:text-white hover:border-violet-600 hover:scale-105 shadow-xs backdrop-blur-md
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
