import { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { HashLink } from "react-router-hash-link";
import { jwtDecode } from "jwt-decode";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import AccountMenu from "./AccountMenu";
import NavServices from "./NavServices";
import NotificationBell from "./NotificationBell";

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

	const dropdownTimeoutRef = useRef(null);
	const dropdownContainerRef = useRef(null);

	const location = useLocation();
	const navigate = useNavigate();

	const handleLogout = () => {
		localStorage.removeItem("token");
		setUser(null);
		setMobileMenuOpen(false);
		navigate("/login");
	};

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

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (
				dropdownContainerRef.current &&
				!dropdownContainerRef.current.contains(event.target)
			) {
				setDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
		};
	}, []);

	const handleDropdownMouseEnter = () => {
		if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
		setDropdownOpen(true);
		setHoveredTab("services");
	};

	const handleDropdownMouseLeave = () => {
		dropdownTimeoutRef.current = setTimeout(() => {
			setDropdownOpen(false);
			setHoveredTab(null);
		}, 200);
	};

	const handleDropdownToggle = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setDropdownOpen((prev) => !prev);
		setHoveredTab((prev) => (prev === "services" ? null : "services"));
	};

	return (
		<div className="absolute top-0 left-0 w-full z-50 pt-4 sm:pt-6 px-4 pointer-events-none">
			<div className="max-w-7xl mx-auto relative flex items-center justify-between">
				{/* Logo */}
				<div className="pointer-events-auto flex-none z-50">
					<Link
						to="/"
						className="flex items-center gap-2.5 group"
						onMouseEnter={() => setHoveredTab(null)}
					>
						<div className="h-11 w-11 overflow-hidden drop-shadow-md transition-transform duration-300 group-hover:scale-105">
							<img
								src="/images/taskgenie-logo.svg"
								className="h-full w-full object-contain"
								alt="TaskGenie Logo"
							/>
						</div>
						<span className="text-3xl sm:text-4xl lobster font-bold bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 bg-clip-text text-transparent pb-1 drop-shadow-lg tracking-tight">
							TaskGenie
						</span>
					</Link>
				</div>

				{/* Desktop Navigation Header */}
				<div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 hidden md:block z-40">
					<motion.header
						className={cn(
							"flex items-center justify-center rounded-full border transition-all duration-500 backdrop-blur-xl",
							"bg-white/80 border-white/60 py-1.5 px-5 shadow-xl shadow-indigo-500/10 ring-1 ring-black/5",
						)}
					>
						<nav
							className="flex items-center gap-1 font-medium text-sm text-gray-700"
							onMouseLeave={() => {
								if (!isDropdownOpen) setHoveredTab(null);
							}}
						>
							<NavPath
								to="/#hero"
								label="Home"
								setHoveredTab={setHoveredTab}
								hoveredTab={hoveredTab}
							/>

							{/* Services Dropdown Item */}
							<div
								ref={dropdownContainerRef}
								className="bricolage-grotesque text-[16px] relative px-3 py-2 cursor-pointer z-10"
								onMouseEnter={handleDropdownMouseEnter}
								onMouseLeave={handleDropdownMouseLeave}
							>
								{(hoveredTab === "services" || isDropdownOpen) && (
									<motion.div
										layoutId="nav-bg"
										className="absolute inset-0 bg-violet-100/90 rounded-full -z-10"
										transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
									/>
								)}
								<button
									type="button"
									onClick={handleDropdownToggle}
									className="flex items-center gap-1 relative z-20 outline-none text-slate-800 hover:text-violet-700 transition-colors font-medium"
								>
									Services <ChevronDown open={isDropdownOpen} />
								</button>

								<AnimatePresence>
									{isDropdownOpen && (
										<motion.div
											initial={{ opacity: 0, y: 8, scale: 0.96 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: 8, scale: 0.96 }}
											transition={{ duration: 0.18, ease: "easeOut" }}
											className="absolute top-full left-1/2 -translate-x-1/2 pt-3 before:content-[''] before:absolute before:-top-3 before:inset-x-0 before:h-4"
										>
											<NavServices onClose={() => setDropdownOpen(false)} />
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

				{/* Right Side / Auth & Profile Actions */}
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
								className="flex-none group relative text-sm inline-flex items-center justify-center bg-clip-padding rounded-r-[20px] rounded-l-[10px] border h-9 px-4 bg-violet-600 border-violet-600 text-white shadow-sm hover:bg-violet-700 transition-colors duration-300 font-semibold"
							>
								Sign Up
								<span className="absolute left-4 right-1 -bottom-px h-px bg-gradient-to-r from-violet-500/0 via-violet-400 to-violet-500/0 transition duration-300 opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100" />
							</Link>
						</div>
					) : (
						<div className="flex items-center gap-3">
							<NotificationBell />
							<AccountMenu user={user} onLogout={handleLogout} />
						</div>
					)}

					{/* Mobile Menu Button */}
					<button
						type="button"
						onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
						aria-label="Toggle Navigation Menu"
						className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-white/80 border border-white/50 backdrop-blur-md shadow-md text-slate-700 focus:outline-none"
					>
						<svg
							className="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							{isMobileMenuOpen ? (
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2.5"
									d="M6 18L18 6M6 6l12 12"
								/>
							) : (
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2.5"
									d="M4 6h16M4 12h16M4 18h16"
								/>
							)}
						</svg>
					</button>
				</div>
			</div>

			{/* Mobile Drawer Menu */}
			<AnimatePresence>
				{isMobileMenuOpen && (
					<motion.div
						initial={{ opacity: 0, y: -10, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -10, scale: 0.95 }}
						transition={{ duration: 0.2 }}
						className="absolute top-[calc(100%+12px)] inset-x-4 md:hidden pointer-events-auto"
					>
						<div className="bg-white/95 backdrop-blur-2xl rounded-[2rem] border border-white/50 shadow-2xl p-6 flex flex-col gap-2 ring-1 ring-black/5">
							<MobileLink to="/#hero" onClick={() => setMobileMenuOpen(false)}>
								Home
							</MobileLink>

							<div className="py-2 px-3 bg-violet-50/50 rounded-2xl flex flex-col gap-1 border border-violet-100/50">
								<div className="text-xs font-bold uppercase tracking-wider text-violet-700 px-1 pt-1">
									Services
								</div>
								<Link
									to="/services"
									onClick={() => setMobileMenuOpen(false)}
									className="bricolage-grotesque block w-full p-2 rounded-xl text-base font-semibold text-slate-800 hover:text-violet-700"
								>
									Browse All Services &rarr;
								</Link>
								<MobileLink
									to="/#services"
									onClick={() => setMobileMenuOpen(false)}
								>
									Featured on Home
								</MobileLink>
							</div>

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

							{!user ? (
								<div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
									<Link
										to="/login"
										onClick={() => setMobileMenuOpen(false)}
										className="cursor-pointer py-3 rounded-xl text-center font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100"
									>
										Log in
									</Link>
									<Link
										to="/sign-up"
										onClick={() => setMobileMenuOpen(false)}
										className="cursor-pointer py-3 rounded-xl text-center font-semibold text-white bg-violet-600 shadow-md shadow-violet-200"
									>
										Get Started
									</Link>
								</div>
							) : (
								<div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
									<Link
										to={
											user.role === "provider"
												? "/provider/dashboard"
												: "/dashboard"
										}
										onClick={() => setMobileMenuOpen(false)}
										className="cursor-pointer bricolage-grotesque block text-center w-full p-3 rounded-xl text-lg font-medium text-gray-700 bg-gray-50 hover:bg-violet-50 hover:text-violet-700 transition-all"
									>
										Go to Dashboard ({user.name || "Account"})
									</Link>

									<button
										onClick={handleLogout}
										className="cursor-pointer bricolage-grotesque w-full p-3 rounded-xl text-lg font-semibold text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 transition-all text-center"
									>
										Log Out
									</button>
								</div>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

const NavPath = ({ to, label, setHoveredTab, hoveredTab }) => {
	const location = useLocation();
	const hashId = to.includes("#") ? to.split("#")[1] : null;

	const handleClick = (e) => {
		if (location.pathname === "/" && hashId) {
			e.preventDefault();
			if (hashId === "hero") {
				window.scrollTo({ top: 0, behavior: "smooth" });
			} else {
				const elem = document.getElementById(hashId);
				if (elem) {
					const yOffset = -90;
					const y = elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
					window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
				}
			}
			window.history.replaceState(null, "", to);
		}
	};

	return (
		<HashLink
			smooth
			to={to}
			onClick={handleClick}
			scroll={(el) => {
				const yOffset = -90;
				const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
				window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
			}}
			className="bricolage-grotesque relative px-4 py-2 text-[16px] rounded-full z-10 transition-colors duration-200 text-slate-800 hover:text-violet-700"
			onMouseEnter={() => setHoveredTab(label)}
		>
			{hoveredTab === label && (
				<motion.div
					layoutId="nav-bg"
					className="absolute inset-0 bg-violet-100/90 rounded-full -z-10"
					transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
				/>
			)}
			<span className="relative z-20 font-medium">{label}</span>
		</HashLink>
	);
};

const MobileLink = ({ to, children, onClick }) => {
	const location = useLocation();
	const hashId = to.includes("#") ? to.split("#")[1] : null;

	const handleClick = (e) => {
		onClick?.();
		if (location.pathname === "/" && hashId) {
			e.preventDefault();
			if (hashId === "hero") {
				window.scrollTo({ top: 0, behavior: "smooth" });
			} else {
				const elem = document.getElementById(hashId);
				if (elem) {
					const yOffset = -90;
					const y = elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
					window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
				}
			}
			window.history.replaceState(null, "", to);
		}
	};

	return (
		<HashLink
			smooth
			to={to}
			onClick={handleClick}
			scroll={(el) => {
				const yOffset = -90;
				const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
				window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
			}}
			className="bricolage-grotesque block w-full p-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition-all"
		>
			{children}
		</HashLink>
	);
};

export default Navbar;
