// import { Link } from "react-router-dom";
// import NavServices from "./NavServices";

// const Navbar = () => {
// 	//const [isHover, setIsHover] = useSta;

// 	return (
// 		<div className="relative z-50">
// 			<header className="justify-self-center font-medium  z-[9999] container xl:px-35 flex items-center h-64 w-full">
// 				<div className="grad">
// 					<svg
// 						class="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-full min-w-[80rem] h-auto"
// 						width="1171"
// 						height="241"
// 						viewBox="0 0 1171 241"
// 						fill="none"
// 					>
// 						<g opacity=".195" filter="url(#filter0_f)">
// 							<path
// 								d="M731.735 -179.55C596.571 -157.762 516.36 -74.1815 552.576 7.13199C588.793 88.4455 727.724 136.701 862.887 114.913C998.051 93.1247 1078.26 9.54454 1042.05 -71.769C1005.83 -153.082 866.898 -201.337 731.735 -179.55Z"
// 								fill="url(#paint0_linear)"
// 							></path>
// 							<path
// 								d="M378 114.106C520.489 114.106 636 45.8883 636 -38.2623C636 -122.413 520.489 -190.63 378 -190.63C235.511 -190.63 120 -122.413 120 -38.2623C120 45.8883 235.511 114.106 378 114.106Z"
// 								fill="url(#paint1_linear)"
// 							></path>
// 						</g>
// 						<defs>
// 							<filter
// 								id="filter0_f"
// 								x="0"
// 								y="-310.63"
// 								width="1170.74"
// 								height="550.775"
// 								filterUnits="userSpaceOnUse"
// 								colorInterpolationFilters="sRGB"
// 							>
// 								<feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
// 								<feBlend
// 									mode="normal"
// 									in="SourceGraphic"
// 									in2="BackgroundImageFix"
// 									result="shape"
// 								></feBlend>
// 								<feGaussianBlur
// 									stdDeviation="60"
// 									result="effect1_foregroundBlur"
// 								></feGaussianBlur>
// 							</filter>
// 							<linearGradient
// 								id="paint0_linear"
// 								x1="567.5"
// 								y1="1.03997"
// 								x2="1029.02"
// 								y2="64.6468"
// 								gradientUnits="userSpaceOnUse"
// 							>
// 								<stop stopColor="#001AFF"></stop>
// 								<stop offset="1" stopColor="#6EE5C2"></stop>
// 							</linearGradient>
// 							<linearGradient
// 								id="paint1_linear"
// 								x1="155"
// 								y1="-11.0234"
// 								x2="511.855"
// 								y2="-162.127"
// 								gradientUnits="userSpaceOnUse"
// 							>
// 								<stop stopColor="#FFC83A"></stop>
// 								<stop offset="0.504191" stopColor="#FF008A"></stop>
// 								<stop offset="1" stopColor="#6100FF"></stop>
// 							</linearGradient>
// 						</defs>
// 					</svg>
// 				</div>
// 				<div className="grid grid-cols-[auto_1fr_auto] w-full items-center -mt-40 mx-auto">
// 					{/* Left: Logo & Title (This column will be as wide as its content) */}
// 					<div className="flex">
// 						{/* Added items-center for better alignment */}
// 						<div className="h-5 w-15 flex items-center cursor-pointer">
// 							<img
// 								src="/images/la.png"
// 								className="flex justify-center items-center h-15 w-14"
// 							/>
// 						</div>
// 						<p className="text-4xl lobster font-bold bg-gradient-to-r from-violet-700 via-fuchsia-700 to-fuchsia-700 bg-clip-text text-transparent drop-shadow-md tracking-tight cursor-pointer hover:scale-105 transition-transform">
// 							TaskGenie
// 						</p>
// 					</div>

// 					{/* Center: Navigation (This column will take up all remaining space) */}
// 					<div className="flex justify-center">
// 						<div className="bricolage-grotesque gap-4 hidden shrink-1 md:flex  items-center rounded-full bg-white/75 bg-gradient-to-r from-pink-200/40 via-violet-200/40 to-indigo-200/40 border border-white/50 px-3 text-sm font-medium text-gray-800 shadow-lg shadow-gray-800/5 ring-1 ring-gray-800/[.075] backdrop-blur-xl">
// 							<Link
// 								to="/"
// 								className="hover:text-violet-600  transition-colors duration-300  group relative px-3 py-2.5 cursor-pointer group ease-out active:scale-95 hover:scale-105"
// 							>
// 								Home
// 								<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 from-10% via-violet-400 to-violet-500/0 to-90% transition duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
// 								<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
// 									<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
// 								</span>
// 							</Link>

// 							{/* <div className="relative group"> */}
// 							<Link
// 								to="/"
// 								className="relative hover:text-violet-600  transition-colors duration-300 group px-3 py-0 cursor-pointer group ease-out active:scale-95 hover:scale-105"
// 							>
// 								<p className="flex justify-center items-center">
// 									<p>Services</p>

// 									<span className="inline-block transition-transform duration-150 ease-out hover:scale-105 active:scale-95">
// 										<svg
// 											version="1.0"
// 											xmlns="http://www.w3.org/2000/svg"
// 											width="14.000000pt"
// 											height="10.000000pt"
// 											viewBox="0 0 512.000000 512.000000"
// 											preserveAspectRatio="xMidYMid meet"
// 											className="fill-current text-black group-hover:text-violet-600 transition-transform duration-150 ease-out hover:scale-105 active:scale-95"
// 										>
// 											<g
// 												transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)"
// 												stroke="none"
// 											>
// 												<path
// 													d="M895 3506 c-67 -29 -105 -105 -90 -183 6 -34 100 -131 843 -875 744
// -743 841 -837 875 -843 94 -18 39 -66 949 843 909 909 861 855 843 949 -9 49
// -69 109 -118 118 -94 18 -46 59 -875 -768 l-762 -762 -758 757 c-424 424 -769
// 762 -785 768 -38 14 -85 12 -122 -4z"
// 												/>
// 											</g>
// 										</svg>
// 									</span>
// 								</p>

// 								<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 from-10% via-violet-400 to-violet-500/0 to-90% transition duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
// 								<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
// 									<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
// 								</span>
// 							</Link>

// 							{/* </div> */}

// 							<NavLink to="/work">Work With Us</NavLink>
// 							<NavLink to="/about">About</NavLink>
// 							<NavLink to="/contact">Contact</NavLink>

// 						</div>
// 					</div>

// 					{/* Right: Login / Sign up (This column will be as wide as its content) */}
// 					<div className="flex justify-self-end">
// 						<div className="bricolage-grotesque  flex items-center shrink-1 rounded-full bg-white/75 bg-gradient-to-r from-pink-200/40 via-violet-200/40 to-indigo-200/40 border border-white/50 px-3 lg:text-sm font-medium text-gray-800 shadow-lg shadow-gray-800/5 ring-1 ring-gray-800/[.075] backdrop-blur-xl">
// 							<Link
// 								to="/"
// 								className="flex-none group relative text-base sm:text-sm -ml-2 my-1 inline-flex items-center bg-clip-padding rounded-l-[20px] rounded-r-[8px] border h-8 pl-3 pr-[10px] bg-white/40 border-white/90 shadow hover:text-violet-600 hover:bg-violet-50/40 transition-colors duration-300 group ease-out active:scale-95 hover:scale-105"
// 							>
// 								Sign in
// 								<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
// 									<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-400/20 to-transparent blur rounded-t-full"></span>
// 								</span>
// 							</Link>
// 							<Link
// 								to="/"
// 								className="text-white group relative text-base sm:text-sm flex justify-center items-center ml-[5px] pl-2 -mr-2 my-1 h-8 pr-2 border-none rounded-r-[20px] rounded-l-[8px]
// 											bg-[#7c3aed] bg-gradient-to-br from-[#A02BE4]  to-[#4f46e5]
// 											hover:bg-[#6d28d9] transition-all duration-300  group ease-out active:scale-95 hover:scale-105"
// 							>
// 								Book a demo
// 							</Link>
// 						</div>
// 					</div>
// 				</div>
// 			</header>
// 		</div>
// 	);
// };

// const NavLink = ({ to, children }) => (
// 	<Link
// 		to={to}
// 		className="hover:text-violet-600 transition-colors duration-300 group relative px-3 py-2.5 cursor-pointer ease-out active:scale-95 hover:scale-105"
// 	>
// 		{children}
// 		<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 from-10% via-violet-400 to-violet-500/0 to-90% transition duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
// 		<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
// 			<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
// 		</span>
// 	</Link>
// );
// export default Navbar;
import { Link } from "react-router-dom";
import NavServices from "./NavServices";
import { useState } from "react";

const Navbar = () => {
	const [isServicesHovered, setIsServicesHovered] = useState(false);

	return (
		<div className="relative z-50">
			<header className="justify-self-center font-medium z-[9999] container xl:px-35 flex items-center h-64 w-full">
				<div className="grad">
					<svg
						class="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-full min-w-[80rem] h-auto"
						width="1171"
						height="241"
						viewBox="0 0 1171 241"
						fill="none"
					>
						<g opacity=".195" filter="url(#filter0_f)">
							<path
								d="M731.735 -179.55C596.571 -157.762 516.36 -74.1815 552.576 7.13199C588.793 88.4455 727.724 136.701 862.887 114.913C998.051 93.1247 1078.26 9.54454 1042.05 -71.769C1005.83 -153.082 866.898 -201.337 731.735 -179.55Z"
								fill="url(#paint0_linear)"
							></path>
							<path
								d="M378 114.106C520.489 114.106 636 45.8883 636 -38.2623C636 -122.413 520.489 -190.63 378 -190.63C235.511 -190.63 120 -122.413 120 -38.2623C120 45.8883 235.511 114.106 378 114.106Z"
								fill="url(#paint1_linear)"
							></path>
						</g>
						<defs>
							<filter
								id="filter0_f"
								x="0"
								y="-310.63"
								width="1170.74"
								height="550.775"
								filterUnits="userSpaceOnUse"
								colorInterpolationFilters="sRGB"
							>
								<feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
								<feBlend
									mode="normal"
									in="SourceGraphic"
									in2="BackgroundImageFix"
									result="shape"
								></feBlend>
								<feGaussianBlur
									stdDeviation="60"
									result="effect1_foregroundBlur"
								></feGaussianBlur>
							</filter>
							<linearGradient
								id="paint0_linear"
								x1="567.5"
								y1="1.03997"
								x2="1029.02"
								y2="64.6468"
								gradientUnits="userSpaceOnUse"
							>
								<stop stopColor="#001AFF"></stop>
								<stop offset="1" stopColor="#6EE5C2"></stop>
							</linearGradient>
							<linearGradient
								id="paint1_linear"
								x1="155"
								y1="-11.0234"
								x2="511.855"
								y2="-162.127"
								gradientUnits="userSpaceOnUse"
							>
								<stop stopColor="#FFC83A"></stop>
								<stop offset="0.504191" stopColor="#FF008A"></stop>
								<stop offset="1" stopColor="#6100FF"></stop>
							</linearGradient>
						</defs>
					</svg>
				</div>

				<div className="grid grid-cols-[auto_1fr_auto] w-full items-center -mt-40 mx-auto">
					{/* Left: Logo & Title */}
					<div className="flex items-center">
						<div className="h-15 w-14 flex items-center cursor-pointer">
							<img
								src="/images/la.png"
								className="h-full w-full"
								alt="TaskGenie Logo"
							/>
						</div>
						<p className="text-4xl lobster font-bold bg-gradient-to-r from-violet-700 via-fuchsia-700 to-fuchsia-700 bg-clip-text text-transparent drop-shadow-md tracking-tight cursor-pointer hover:scale-105 transition-transform">
							TaskGenie
						</p>
					</div>

					<nav className="flex justify-center">
						<div className="bricolage-grotesque gap-4 hidden shrink-1 md:flex items-center rounded-full bg-white/75 bg-gradient-to-r from-pink-200/40 via-violet-200/40 to-indigo-200/40 border border-white/50 px-3 text-sm font-medium text-gray-800 shadow-lg shadow-gray-800/5 ring-1 ring-gray-800/[.075] backdrop-blur-xl">
							<NavLink to="/">Home</NavLink>

							<div
								className="relative"
								onMouseEnter={() => setIsServicesHovered(true)}
								onMouseLeave={() => setIsServicesHovered(false)}
							>
								<div className="hover:text-violet-600 transition-colors duration-300 group relative px-3 py-2.5 cursor-pointer">
									<p className="flex items-center gap-1">
										Services
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="12"
											height="12"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
											className={`transition-transform duration-300 ${
												isServicesHovered ? "rotate-180" : ""
											}`}
										>
											<polyline points="6 9 12 15 18 9"></polyline>
										</svg>
									</p>
									<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 via-violet-400 to-violet-500/0 transition-all duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
								</div>

								<div
									className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-300 ease-in-out
                    ${
											isServicesHovered
												? "opacity-100 visible translate-y-0"
												: "opacity-0 invisible -translate-y-2"
										}`}
								>
									<NavServices />
								</div>
							</div>

							<NavLink to="/work-with-us">Work With Us</NavLink>
							<NavLink to="/about">About</NavLink>
							<NavLink to="/contact">Contact</NavLink>
						</div>
					</nav>

					<div className="flex justify-self-end">
						<div className="bricolage-grotesque  flex items-center shrink-1 rounded-full bg-white/75 bg-gradient-to-r from-pink-200/40 via-violet-200/40 to-indigo-200/40 border border-white/50 px-3 lg:text-sm font-medium text-gray-800 shadow-lg shadow-gray-800/5 ring-1 ring-gray-800/[.075] backdrop-blur-xl">
							<Link
								to="/"
								className="flex-none group relative text-base sm:text-sm -ml-2 my-1 inline-flex items-center bg-clip-padding rounded-l-[20px] rounded-r-[8px] border h-8 pl-3 pr-[10px] bg-white/40 border-white/90 shadow hover:text-violet-600 hover:bg-violet-50/40 transition-colors duration-300 group ease-out active:scale-95 hover:scale-105"
							>
								Sign in
								<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
									<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-400/20 to-transparent blur rounded-t-full"></span>
								</span>
							</Link>
							<Link
								to="/"
								className="text-white group relative text-base sm:text-sm flex justify-center items-center ml-[5px] pl-2 -mr-2 my-1 h-8 pr-2 border-none rounded-r-[20px] rounded-l-[8px]
											bg-[#7c3aed] bg-gradient-to-br from-[#A02BE4]  to-[#4f46e5]
											hover:bg-[#6d28d9] transition-all duration-300  group ease-out active:scale-95 hover:scale-105"
							>
								Book a demo
							</Link>
						</div>
					</div>
				</div>
			</header>
		</div>
	);
};

// Helper component for cleaner Nav Links
const NavLink = ({ to, children }) => (
	<Link
		to={to}
		className="hover:text-violet-600 transition-colors duration-300 group relative px-3 py-2.5 cursor-pointer ease-out active:scale-95 hover:scale-105"
	>
		{children}
		<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 from-10% via-violet-400 to-violet-500/0 to-90% transition duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
		<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
			<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
		</span>
	</Link>
);

export default Navbar;
