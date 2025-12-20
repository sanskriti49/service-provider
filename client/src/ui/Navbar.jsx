import { Link } from "react-router-dom";
import { HashLink } from "react-router-hash-link";
import NavServices from "./NavServices";
import { useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { jwtDecode } from "jwt-decode";
import { Avatar } from "@mui/material";
import AccountMenu from "./AccountMenu";

gsap.registerPlugin(ScrollToPlugin);

const Navbar = () => {
	const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

	const [isServicesHovered, setIsServicesHovered] = useState(false);
	const [user, setUser] = useState(null);
	const [isOpen, setOpen] = useState(false);

	useEffect(() => {
		const token = localStorage.getItem("token");

		if (token) {
			try {
				const decoded = jwtDecode(token);
				setUser(decoded);
				if (decoded.custom_id) {
					fetch(`${API_URL}/api/users/${decoded.custom_id}`)
						.then((res) => {
							if (res.status === 404) {
								localStorage.removeItem("token");
								setUser(null);
							}
						})
						.catch(() => {
							localStorage.removeItem("token");
							setUser(null);
						});
				}
			} catch (e) {
				localStorage.removeItem("token");
			}
		}
	}, []);

	// Helper to close menu when a link is clicked
	const handleLinkClick = () => {
		setOpen(false);
	};

	return (
		<div className="relative z-50">
			<header className="flex items-center justify-self-center lg:px-35 h-64 w-full font-medium z-[9999]">
				<div className="grad">
					<svg
						className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-full min-w-[80rem] h-auto"
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

				<div className="grid grid-cols-[auto_1fr_auto] w-full items-center -mt-40 mx-auto px-4 md:px-0">
					<Link to="/" className="flex items-center">
						<div className="h-13 w-12 flex items-center cursor-pointer">
							<img
								src="/images/la.png"
								className="h-full w-full"
								alt="TaskGenie Logo"
							/>
						</div>
						<p className="text-3xl lobster font-bold bg-gradient-to-r from-violet-700 via-fuchsia-700 to-fuchsia-700 bg-clip-text text-transparent drop-shadow-md tracking-tight cursor-pointer hover:scale-105 transition-transform">
							TaskGenie
						</p>
					</Link>

					{/* Desktop Nav */}
					<nav className="flex justify-center">
						<div className="hidden md:flex bricolage-grotesque gap-4 -ml-15 shrink-1 items-center rounded-full bg-white/75 bg-gradient-to-r from-pink-200/40 via-violet-200/40 to-indigo-200/40 border border-white/50 px-3 text-sm font-medium text-gray-800 shadow-lg shadow-gray-800/5 ring-1 ring-gray-800/[.075] backdrop-blur-xl">
							<HashLink
								smooth
								to="/#hero"
								className="nav-link group relative px-3 py-2.5 cursor-pointer"
							>
								Home
								<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 via-violet-400 to-violet-500/0 transition-all duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
								<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
									<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
								</span>
							</HashLink>

							<div className="relative group">
								<HashLink
									smooth
									to="/#services"
									className="nav-link group relative px-3 py-2.5 cursor-pointer flex items-center gap-1"
								>
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
										className="transition-transform duration-300 group-hover:rotate-180"
									>
										<polyline points="6 9 12 15 18 9"></polyline>
									</svg>
									<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 via-violet-400 to-violet-500/0 transition-all duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
									<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
										<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
									</span>
								</HashLink>

								<div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 ease-in-out">
									<NavServices />
								</div>
							</div>

							<HashLink
								smooth
								to="/#how-it-works"
								className="nav-link group relative px-3 py-2.5 cursor-pointer"
							>
								How It Works
								<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 via-violet-400 to-violet-500/0 transition-all duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
								<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
									<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
								</span>
							</HashLink>

							<HashLink
								smooth
								to="/#work-with-us"
								className="nav-link group relative px-3 py-2.5 cursor-pointer"
							>
								Become a Provider{" "}
								<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 via-violet-400 to-violet-500/0 transition-all duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
								<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
									<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
								</span>
							</HashLink>

							<HashLink
								smooth
								to="/#contact"
								className="nav-link group relative px-3 py-2.5 cursor-pointer"
							>
								Contact
								<span className="absolute inset-x-1 h-px bg-gradient-to-r from-violet-500/0 via-violet-400 to-violet-500/0 transition-all duration-300 -bottom-0.5 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"></span>
								<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
									<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur rounded-t-full"></span>
								</span>
							</HashLink>
						</div>
					</nav>

					{/* Auth & Mobile Toggle */}
					<div className="flex justify-self-end items-center">
						{!user ? (
							<>
								{/* desktop auth */}
								<div className="hidden md:flex bricolage-grotesque items-center shrink-1 rounded-full bg-white/75 bg-gradient-to-r from-pink-200/40 via-violet-200/40 to-indigo-200/40 border border-white/50 px-3 lg:text-sm font-medium text-gray-800 shadow-lg shadow-gray-800/5 ring-1 ring-gray-800/[.075] backdrop-blur-xl">
									<Link
										to="/login"
										className="flex-none group relative text-base sm:text-sm -ml-2 my-1 inline-flex items-center bg-clip-padding rounded-l-[20px] rounded-r-[8px] border h-8 pl-3 pr-[10px] bg-white/40 border-white/90 shadow hover:text-violet-600 hover:bg-violet-50/40 transition-colors duration-300 group ease-out active:scale-95 hover:scale-105"
									>
										Log in{" "}
										<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100">
											<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-400/20 to-transparent blur rounded-t-full"></span>
										</span>
									</Link>
									<Link
										to="/sign-up"
										className="text-white group relative text-base sm:text-sm flex justify-center items-center ml-[5px] pl-2 -mr-2 my-1 h-8 pr-2 border-none rounded-r-[20px] rounded-l-[8px]
                                    bg-[#7c3aed] bg-gradient-to-br from-[#A02BE4]  to-[#4f46e5]
                                    hover:bg-[#6d28d9] transition-all duration-300  group ease-out active:scale-95 hover:scale-105"
									>
										Get Started{" "}
									</Link>
								</div>

								{/* mobile toggle btn */}
								<button
									onClick={() => setOpen(!isOpen)}
									className="cursor-pointer md:hidden z-50 p-2 rounded-full bg-white/40 backdrop-blur-md border border-white/50 text-gray-800 shadow-sm hover:bg-white/60 transition-all duration-300"
								>
									{isOpen ? (
										// close icon
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<line x1="18" y1="6" x2="6" y2="18"></line>
											<line x1="6" y1="6" x2="18" y2="18"></line>
										</svg>
									) : (
										// hamburger
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<line x1="4" y1="12" x2="20" y2="12"></line>
											<line x1="4" y1="6" x2="20" y2="6"></line>
											<line x1="4" y1="18" x2="20" y2="18"></line>
										</svg>
									)}
								</button>
							</>
						) : (
							<AccountMenu user={user} />
						)}
					</div>
				</div>

				{/* mobile menu dropdown*/}
				{isOpen && !user && (
					<div className="bricolage-grotesque absolute top-[80px] left-0 w-full z-40 md:hidden px-4 animate-in fade-in slide-in-from-top-4 duration-300">
						<div className="flex flex-col items-center gap-5 py-8 rounded-[2rem] bg-white/40 backdrop-blur-xl border border-white/40 shadow-2xl ring-1 ring-white/50">
							<HashLink
								smooth
								to="/#hero"
								onClick={handleLinkClick}
								className="text-gray-800 text-lg font-medium hover:text-violet-600 transition-colors"
							>
								Home
							</HashLink>
							<HashLink
								smooth
								to="/#services"
								onClick={handleLinkClick}
								className="text-gray-800 text-lg font-medium hover:text-violet-600 transition-colors"
							>
								Services
							</HashLink>
							<HashLink
								smooth
								to="/#how-it-works"
								onClick={handleLinkClick}
								className="text-gray-800 text-lg font-medium hover:text-violet-600 transition-colors"
							>
								How It Works
							</HashLink>
							<HashLink
								smooth
								to="/#work-with-us"
								onClick={handleLinkClick}
								className="text-gray-800 text-lg font-medium hover:text-violet-600 transition-colors"
							>
								Become a Provider
							</HashLink>
							<HashLink
								smooth
								to="/#contact"
								onClick={handleLinkClick}
								className="text-gray-800 text-lg font-medium hover:text-violet-600 transition-colors"
							>
								Contact
							</HashLink>

							<div className="w-16 h-px bg-gray-300/50 my-1"></div>

							<div className="flex flex-col gap-3 w-3/4 max-w-xs">
								<Link
									to="/login"
									onClick={handleLinkClick}
									className="text-center w-full py-3 rounded-2xl border border-white/60 bg-white/50 shadow-sm text-gray-700 font-semibold hover:bg-white hover:text-violet-600 transition-all duration-300 backdrop-blur-sm"
								>
									Log in
								</Link>
								<Link
									to="/sign-up"
									onClick={handleLinkClick}
									className="text-center w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-xl hover:bg-violet-300 transition-all duration-300 transform active:scale-95"
								>
									Get Started
								</Link>
							</div>
						</div>
					</div>
				)}
			</header>
		</div>
	);
};

export default Navbar;
