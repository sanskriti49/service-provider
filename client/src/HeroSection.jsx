import React from "react";
import BackgroundPattern from "./ui/BackgroundPattern";
import AnimatedGradient from "./ui/AnimatedGradient";
import { Link } from "react-router-dom";

export const HeroSection = () => {
	return (
		<main className="mt-30">
			<div className="absolute min-w-full left-1/2 lg:-bottom-30 md:-bottom-10 bottom-5 3xl:inset-0 -translate-x-1/2 3xl:translate-x-0">
				<BackgroundPattern />
			</div>
			<header className="hero relative flex flex-col  -mt-85">
				<div className="flex flex-col items-center justify-center bricolage-grotesque">
					{/* <div className="hidden fixed xl:flex items-center left-1/2 -translate-x-1/2 rounded-full bg-white/75 bg-gradient-to-r from-pink-200/40 via-violet-200/40 to-indigo-200/40 border border-white/50 px-3 text-sm font-medium text-gray-800 shadow-lg shadow-gray-800/5 ring-1 ring-gray-800/[.075] backdrop-blur-xl bricolage-grotesque">
						<Link
							to="/"
							className="hover:text-violet-600  transition-colors duration-300 flex-none bubble-wrap hidden shrink-0 xl:flex group relative px-3 py-2.5 cursor-pointer"
						>
							Home
							<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 from-10% via-violet-400 to-violet-500/0 to-90% transition duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
							<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
								<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
							</span>
						</Link>
						<Link
							to="/"
							className="hover:text-violet-600  transition-colors duration-300 flex-none bubble-wrap hidden shrink-0 xl:flex group relative px-3 py-2.5 cursor-pointer"
						>
							Services
							<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 from-10% via-violet-400 to-violet-500/0 to-90% transition duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
							<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
								<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
							</span>
						</Link>
						<Link
							to="/"
							className="hover:text-violet-600  transition-colors duration-300 flex-none bubble-wrap hidden shrink-0 xl:flex group relative px-3 py-2.5 cursor-pointer"
						>
							About
							<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 from-10% via-violet-400 to-violet-500/0 to-90% transition duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
							<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
								<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
							</span>
						</Link>
						<Link
							to="/"
							className="hover:text-violet-600  transition-colors duration-300 flex-none bubble-wrap hidden shrink-0 xl:flex group relative px-3 py-2.5 cursor-pointer"
						>
							Contact
							<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 from-10% via-violet-400 to-violet-500/0 to-90% transition duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
							<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
								<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
							</span>
						</Link>
					</div> */}
					<div
						className="md:text-[45px] text-3xl text-center text-[#281950]/90"
						style={{ fontFamily: "P22Mackinac, Cambria, sans-serif" }}
					>
						<p>
							"Your Wish, Our Command" —
							<span className="genie pr-1"> TaskGenie</span>
						</p>
						<div className="">
							<p className="relative">
								Home & Beauty Services in a <i>Snap</i>
							</p>
							<svg
								width="123"
								height="12"
								viewBox="0 0 123 12"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
								className=" md:ml-174 ml-85 w-40 lg:w-[123px] -mt-2"
							>
								<path
									d="M123.009 5.81545C123.25 3.67665 120.682 4.04783 119.862 3.49978C110.203 0.937858 92.4445 0.474625 82.6576 0.461803C74.7486 0.499776 66.8437 0.160488 58.9355 0.540872C53.1009 0.611392 47.287 1.55413 41.4534 1.75452C29.1682 2.64054 16.8209 3.5218 4.69766 7.0475C3.44485 7.58767 2.10057 7.74695 0.912449 8.59287C-2.07936 12.3709 3.66051 11.9052 4.91424 11.4259C41.2086 3.58427 41.6964 3.82131 69.4462 3.04723C81.7181 2.63495 93.9724 4.14169 112.877 6.21046C113.358 6.27687 113.788 5.54767 113.688 4.76586C115.543 5.02767 117.392 5.3773 119.233 5.8143C120.191 6.11726 121.152 6.40328 122.102 6.75605C122.508 6.89397 122.915 6.47364 123.009 5.81709V5.81545Z"
									fill="url(#paint0_linear_2002_4234)"
								/>
								<defs>
									<linearGradient
										id="paint0_linear_2002_4234"
										x1="-0.22812"
										y1="-0.0322311"
										x2="-93.0838"
										y2="157.327"
										gradientUnits="userSpaceOnUse"
									>
										<stop offset="0.05" stopColor="#CA7FF8" />
										<stop offset="0.95" stopColor="#795BE9" />
									</linearGradient>
								</defs>
							</svg>
						</div>
					</div>
					<p className="text-[#281950bf] text-md md:text-base lg:text-lg mt-3 mb-9 px-2 max-w-lg lg:max-w-2xl mx-auto">
						Need a handyman or a hair stylist? From plumbing to pedicures, our
						verified pros are just a tap away. Fast, friendly, and always
						reliable.
					</p>
					<button
						className="cursor-pointer text-white group relative text-lg flex justify-center items-center w-fit -mr-2 h-12 border-none rounded-full px-5 py-5 
															bg-[#7c3aed] bg-gradient-to-br from-[#A02BE4] via-transparent to-[#4f46e5]
															hover:bg-[#6d28d9] transition-all duration-300 ease-in-out"
					>
						Get Started &#8594;
					</button>
				</div>
				{/* <div
					className="absolute opacity-80 -right-15 -bottom-48 3xl:inset-0 -translate-x-1/6"
					aria-hidden="true"
				>
					<img width="480" src="/images/gn.png" className=""></img>
				</div> */}
			</header>
		</main>
	);
};
