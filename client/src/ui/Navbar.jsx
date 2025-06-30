import { Link } from "react-router-dom";
import PurpleGradientIcon from "./PurpleGradientIcon";

import React from "react";

const Navbar = () => {
	return (
		<div>
			<header className="navbar relative z-[100]  px-4 lg:px-8 pt-8 font-medium text-md">
				<nav className="flex justify-between">
					<div className="flex gap-1">
						<div className="h-5 flex items-center">
							{/* <PurpleGradientIcon /> */}
							<div className="flex  cursor-pointer">
								<img
									src="/images/la.png"
									className="flex justify-center items-center h-15 w-14"
								/>
							</div>
						</div>
						<p className="text-4xl lobster font-bold bg-gradient-to-r from-violet-700 via-fuchsia-700 to-fuchsia-700 bg-clip-text text-transparent drop-shadow-md tracking-tight cursor-pointer hover:scale-105">
							TaskGenie
						</p>
					</div>

					<div
						className="hidden fixed xl:flex items-center left-1/2 -translate-x-1/2 rounded-full 
  bg-white/10 border border-white/30 px-3 text-sm font-medium text-gray-800 
  shadow-lg shadow-gray-800/10 ring-1 ring-white/20 
  backdrop-blur-2xl bricolage-grotesque"
					>
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
					</div>

					<div className="bricolage-grotesque ml-5 flex-none flex items-center rounded-full bg-white/75 bg-gradient-to-r from-pink-200/40 via-violet-200/40 to-indigo-200/40 border border-white/50 px-3 text-sm font-medium text-gray-800 shadow-lg shadow-gray-800/5 ring-1 ring-gray-800/[.075] backdrop-blur-xl">
						<Link
							to="/"
							className="flex-none group relative text-base sm:text-sm -ml-2 my-1 inline-flex items-center bg-clip-padding rounded-l-[20px] rounded-r-[8px] border h-8 pl-3 pr-[10px] bg-white/40 border-white/90 shadow hover:text-violet-600 hover:bg-violet-50/40 transition-colors duration-300"
						>
							Sign in
							<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
								<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-400/20 to-transparent blur rounded-t-full"></span>
							</span>
						</Link>
						<Link
							to="/"
							className="text-white group relative text-base sm:text-sm flex justify-center items-center ml-[5px] pl-2 -mr-2 my-1 h-8 pr-2 border-none rounded-r-[20px] rounded-l-[8px] 
											bg-[#7c3aed] bg-gradient-to-br from-[#A02BE4] via-transparent to-[#4f46e5]
											hover:bg-[#6d28d9] transition-all duration-300 ease-in-out"
						>
							Book a demo
						</Link>
					</div>
				</nav>
			</header>
		</div>
	);
};

export default Navbar;
