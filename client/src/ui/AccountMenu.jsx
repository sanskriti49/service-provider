import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { Link } from "react-router-dom";
import {
	LayoutDashboard,
	UserCircle,
	Settings,
	HelpCircle,
	LogOut,
	CalendarCheck,
	Wallet,
	Star,
	Briefcase,
	BarChart3,
	History,
	Heart,
} from "lucide-react";

export default function AccountMenu({ user }) {
	const getInitials = (name) => {
		if (!name) return "U";
		const parts = name.split(" ");
		return `${parts[0][0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
	};

	const isProvider = user?.role === "provider";

	const nuclearSafeClass =
		"" +
		"focus:!bg-transparent active:!bg-transparent " +
		"before:!hidden after:!hidden";

	return (
		<Menu as="div" className="relative ml-3 bricolage-grotesque">
			<div>
				<Menu.Button
					className={`group relative flex rounded-full text-sm transition-transform hover:scale-105 active:scale-95 !outline-none !ring-0 !ring-offset-0 focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 ${nuclearSafeClass}`}
					style={{
						WebkitTapHighlightColor: "transparent",
						outline: "none",
						boxShadow: "none",
					}}
				>
					<span className="sr-only">Open user menu</span>

					<div
						className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/30 border-2 border-white/80"
						style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)" }}
					>
						{getInitials(user.name || user.fullName || user.email)}
					</div>

					<span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-400 ring-2 ring-white" />
				</Menu.Button>
			</div>

			{/* 2. THE DROPDOWN PANEL */}
			<Transition
				as={Fragment}
				enter="transition ease-out duration-200"
				enterFrom="transform opacity-0 scale-95"
				enterTo="transform opacity-100 scale-100"
				leave="transition ease-in duration-75"
				leaveFrom="transform opacity-100 scale-100"
				leaveTo="transform opacity-0 scale-95"
			>
				<Menu.Items className="absolute right-0 z-50 mt-3 w-64 origin-top-right rounded-2xl bg-white/95 backdrop-blur-xl py-1 shadow-2xl ring-1 ring-black/5 focus:outline-none border border-white/50 outline-none">
					{/* Header: User Info */}
					<div className="cursor-default px-4 py-4 border-b border-gray-100">
						<p className="text-sm font-semibold text-gray-900 truncate">
							{user.name || "User"}
						</p>
						<p className="text-xs text-gray-500 truncate font-medium">
							{user.email}
						</p>
						<div className="mt-2 flex items-center gap-1">
							<span
								className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide 
                                ${
																	isProvider
																		? "bg-purple-100 text-purple-700"
																		: "bg-blue-100 text-blue-700"
																}`}
							>
								{isProvider ? "Provider" : "Customer"}
							</span>
						</div>
					</div>

					{!isProvider && (
						<div className="p-1">
							<MenuLink to="/dashboard" icon={LayoutDashboard}>
								Dashboard
							</MenuLink>
							<MenuLink to="/profile" icon={UserCircle}>
								Profile
							</MenuLink>
							<MenuLink to="/dashboard/bookings" icon={History}>
								My Bookings
							</MenuLink>
							<MenuLink to="/saved" icon={Heart}>
								Saved Services
							</MenuLink>
						</div>
					)}

					{/* === PROVIDER MENU ITEMS === */}
					{isProvider && (
						<div className="p-1">
							<MenuLink to="/provider/dashboard" icon={LayoutDashboard}>
								Dashboard
							</MenuLink>
							<MenuLink to="/provider/bookings" icon={CalendarCheck}>
								Manage Bookings
							</MenuLink>
							<MenuLink to="/provider/services" icon={Briefcase}>
								My Services
							</MenuLink>
							<MenuLink to="/provider/earnings" icon={Wallet}>
								Earnings
							</MenuLink>
							<MenuLink to="/provider/reviews" icon={Star}>
								Reviews
							</MenuLink>
							<MenuLink to="/provider/analytics" icon={BarChart3}>
								Analytics
							</MenuLink>
						</div>
					)}

					<div className="h-px bg-gray-100 my-1 mx-2" />

					<div className="p-1">
						<MenuLink to="/settings" icon={Settings}>
							Settings
						</MenuLink>
						<MenuLink to="/help" icon={HelpCircle}>
							Help & Support
						</MenuLink>
					</div>

					<div className="h-px bg-gray-100 my-1 mx-2" />

					<div className="p-1">
						<Menu.Item>
							{({ active }) => (
								<button
									onClick={() => {
										localStorage.removeItem("token");
										window.location.reload();
									}}
									className={`${
										active ? "bg-red-50 text-red-600" : "text-gray-700"
									} group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors outline-none`}
								>
									<LogOut
										className={`mr-3 h-4 w-4 ${
											active
												? "text-red-600"
												: "text-gray-400 group-hover:text-red-500"
										}`}
									/>
									Sign out
								</button>
							)}
						</Menu.Item>
					</div>
				</Menu.Items>
			</Transition>
		</Menu>
	);
}

function MenuLink({ to, children, icon: Icon }) {
	return (
		<Menu.Item>
			{({ active }) => (
				<Link
					to={to}
					className={`${
						active ? "bg-violet-50 text-violet-700" : "text-gray-700"
					} group flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors outline-none`}
				>
					{Icon && (
						<Icon
							className={`mr-3 h-4 w-4 transition-colors ${
								active
									? "text-violet-600"
									: "text-gray-400 group-hover:text-violet-500"
							}`}
						/>
					)}
					{children}
				</Link>
			)}
		</Menu.Item>
	);
}
