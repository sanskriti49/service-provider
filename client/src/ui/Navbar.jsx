import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HashLink } from "react-router-hash-link";
import { jwtDecode } from "jwt-decode";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import AccountMenu from "./AccountMenu";
import NavServices from "./NavServices";

function cn(...inputs) {
	return twMerge(clsx(inputs));
}

const ChevronDown = ({ open }) => (
	<motion.svg
		animate={{ rotate: open ? 180 : 0 }}
		transition={{ duration: 0.2 }}
		xmlns="http://www.w3.org/2000/svg"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.5"
		strokeLinecap="round"
		strokeLinejoin="round"
		className="ml-1 text-violet-500"
	>
		<path d="m6 9 6 6 6-6" />
	</motion.svg>
);

const Navbar = () => {
	const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
	const [user, setUser] = useState(null);
	const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [hoveredTab, setHoveredTab] = useState(null);
	const [isDropdownOpen, setDropdownOpen] = useState(false);
	const location = useLocation();

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (token) {
			try {
				const decoded = jwtDecode(token);
				setUser(decoded);
			} catch (e) {
				localStorage.removeItem("token");
			}
		}
	}, [API_URL]);

	useEffect(() => {
		setMobileMenuOpen(false);
		setDropdownOpen(false);
	}, [location]);

	return (
		/* CHANGED: 'fixed' -> 'absolute' so it scrolls away */
		<div className="absolute top-0 left-0 w-full z-50 pt-4 sm:pt-6 px-4 pointer-events-none">
			{/* Main Container */}
			<div className="max-w-7xl mx-auto relative flex items-center justify-between">
				{/* 1. LOGO (LEFT) */}
				<div className="pointer-events-auto flex-none z-50">
					<Link
						to="/"
						className="flex items-center gap-2 group"
						onMouseEnter={() => setHoveredTab(null)}
					>
						<div className="h-12 w-12 overflow-hidden drop-shadow-sm">
							<img
								src="/images/la.png"
								className="h-full w-full object-contain"
								alt="TaskGenie Logo"
							/>
						</div>
						<span className="text-3xl lobster font-bold bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 bg-clip-text text-transparent pb-1 drop-shadow-sm">
							TaskGenie
						</span>
					</Link>
				</div>

				{/* 2. NAVBAR (CENTER) */}
				<div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 hidden md:block z-40">
					<motion.header
						className={cn(
							"flex items-center justify-center rounded-full border transition-all duration-500 backdrop-blur-xl",
							"bg-purple-100/60 border-white/60 py-2 px-6 shadow-xl shadow-indigo-500/10",
						)}
					>
						<nav
							className="flex items-center gap-1 font-medium text-sm text-gray-600"
							onMouseLeave={() => setHoveredTab(null)}
						>
							<NavPath
								to="/#hero"
								label="Home"
								setHoveredTab={setHoveredTab}
								hoveredTab={hoveredTab}
							/>

							{/* Services Dropdown */}
							<div
								className="bricolage-grotesque text-[16px] relative px-3 py-2 cursor-pointer z-10"
								onMouseEnter={() => {
									setDropdownOpen(true);
									setHoveredTab("services");
								}}
								onMouseLeave={() => {
									setDropdownOpen(false);
									setHoveredTab(null);
								}}
							>
								{hoveredTab === "services" && (
									<motion.div
										layoutId="nav-bg"
										className="absolute inset-0 bg-violet-200/70 rounded-full -z-10"
										transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
									/>
								)}
								<button className="flex items-center gap-1 relative z-20 outline-none">
									Services <ChevronDown open={isDropdownOpen} />
								</button>
								<AnimatePresence>
									{isDropdownOpen && (
										<motion.div
											initial={{ opacity: 0, y: 10, scale: 0.95 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: 10, scale: 0.95 }}
											transition={{ duration: 0.2 }}
											className="absolute top-full left-1/2 -translate-x-1/2 pt-4"
										>
											<div className="bg-white/80 backdrop-blur-2xl rounded-2xl border border-white/50 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] p-1 min-w-[260px] overflow-hidden ring-1 ring-black/5">
												<NavServices />
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</div>

							<NavPath
								to="/#how-it-works"
								label="How It Works"
								setHoveredTab={setHoveredTab}
								hoveredTab={hoveredTab}
							/>
							<NavPath
								to="/#work-with-us"
								label="Provider"
								setHoveredTab={setHoveredTab}
								hoveredTab={hoveredTab}
							/>
							<NavPath
								to="/#contact"
								label="Contact"
								setHoveredTab={setHoveredTab}
								hoveredTab={hoveredTab}
							/>
						</nav>
					</motion.header>
				</div>

				{/* 3. ACTIONS (RIGHT) */}
				<div className="bricolage-grotesque pointer-events-auto flex-none flex items-center gap-3 z-50">
					{!user ? (
						<div className="hidden md:flex flex-none items-center rounded-full bg-white/75 bg-gradient-to-r from-pink-200/40 via-violet-200/40 to-indigo-200/40 border border-white/50 px-1.5 py-1 text-sm font-medium text-gray-800 shadow-lg shadow-gray-800/5 ring-1 ring-gray-800/[.075] backdrop-blur-xl">
							<Link
								to="/login"
								className="flex-none group relative text-sm inline-flex items-center justify-center bg-clip-padding rounded-l-[20px] rounded-r-[10px] border h-9 px-4 bg-white/40 border-white/90 shadow-sm hover:text-violet-600 hover:bg-violet-50/60 transition-colors duration-300"
							>
								Log In
								<span className="absolute left-4 right-1 -bottom-px h-px bg-gradient-to-r from-violet-500/0 via-violet-400 to-violet-500/0 transition duration-300 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100" />
								<span className="overflow-hidden absolute inset-0 transition origin-bottom duration-300 opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100 rounded-l-[20px] rounded-r-[10px]">
									<span className="absolute inset-x-4 -bottom-2 h-full bg-gradient-to-t from-violet-500/20 to-transparent blur-sm rounded-t-full" />
								</span>
							</Link>

							<Link
								to="/sign-up"
								className="flex-none group relative text-sm ml-1 h-9 px-5 flex items-center justify-center bg-violet-600 text-white font-semibold shadow-md shadow-violet-200 rounded-r-[20px] rounded-l-[10px] hover:bg-violet-700 transition-all"
							>
								Get Started
							</Link>
						</div>
					) : (
						<AccountMenu user={user} />
					)}

					{/* Mobile Menu Toggle */}
					<button
						onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
						className="md:hidden p-2 rounded-full bg-white/80 border border-white/60 text-gray-600 shadow-sm hover:bg-gray-100 hover:text-violet-600 active:scale-95 transition-all"
					>
						{isMobileMenuOpen ? (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M18 6 6 18" />
								<path d="m6 6 18 18" />
							</svg>
						) : (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<line x1="4" x2="20" y1="12" y2="12" />
								<line x1="4" x2="20" y1="6" y2="6" />
								<line x1="4" x2="20" y1="18" y2="18" />
							</svg>
						)}
					</button>
				</div>
			</div>

			{/* Mobile Menu Overlay */}
			<AnimatePresence>
				{isMobileMenuOpen && (
					<motion.div
						initial={{ opacity: 0, y: -20, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -10, scale: 0.95 }}
						transition={{ duration: 0.2 }}
						className="absolute top-[calc(100%+12px)] inset-x-4 md:hidden pointer-events-auto"
					>
						<div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] border border-white/50 shadow-2xl p-6 flex flex-col gap-2">
							<MobileLink to="/#hero" onClick={() => setMobileMenuOpen(false)}>
								Home
							</MobileLink>
							<MobileLink
								to="/#services"
								onClick={() => setMobileMenuOpen(false)}
							>
								Services
							</MobileLink>
							<MobileLink
								to="/#how-it-works"
								onClick={() => setMobileMenuOpen(false)}
							>
								How It Works
							</MobileLink>
							<MobileLink
								to="/#work-with-us"
								onClick={() => setMobileMenuOpen(false)}
							>
								Become a Provider
							</MobileLink>
							<MobileLink to="/help" onClick={() => setMobileMenuOpen(false)}>
								Help & Support
							</MobileLink>
							<MobileLink
								to="/#contact"
								onClick={() => setMobileMenuOpen(false)}
							>
								Contact
							</MobileLink>
							{!user && (
								<div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
									<Link
										to="/login"
										className="py-3 rounded-xl text-center font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100"
									>
										Log in
									</Link>
									<Link
										to="/sign-up"
										className="py-3 rounded-xl text-center font-semibold text-white bg-violet-600 shadow-md shadow-violet-200"
									>
										Get Started
									</Link>
								</div>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

const NavPath = ({ to, label, setHoveredTab, hoveredTab }) => (
	<HashLink
		smooth
		to={to}
		className="bricolage-grotesque relative px-4 py-2 text-[16px] rounded-full z-10 transition-colors duration-200 hover:text-violet-700"
		onMouseEnter={() => setHoveredTab(label)}
	>
		{hoveredTab === label && (
			<motion.div
				layoutId="nav-bg"
				className="absolute inset-0 bg-violet-200/70 rounded-full -z-10"
				transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
			/>
		)}
		<span className="relative z-20">{label}</span>
	</HashLink>
);

const MobileLink = ({ to, children, onClick }) => (
	<HashLink
		smooth
		to={to}
		onClick={onClick}
		className="bricolage-grotesque block w-full p-3 rounded-xl text-lg font-medium text-gray-600 hover:bg-violet-50 hover:text-violet-700 transition-all"
	>
		{children}
	</HashLink>
);

export default Navbar;
