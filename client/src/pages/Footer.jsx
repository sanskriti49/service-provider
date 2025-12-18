import React from "react";

const Footer = () => {
	return (
		<footer className="mt-auto py-10 bg-[#191034] text-white bricolage-grotesque w-full">
			<div className="container mx-auto px-6 lg:px-16">
				{/* Top section */}
				<div className="flex flex-col md:flex-row md:justify-between gap-10">
					{/* Logo + small intro */}
					<div className="md:w-1/4">
						<a
							href="/"
							className="text-2xl tracking-wide font-semibold flex items-center gap-2"
							style={{ fontFamily: "P22Mackinac, Cambria, sans-serif" }}
						>
							🧞 TaskGenie
						</a>
						<p className="text-sm text-[#A39AC1] mt-3 leading-relaxed">
							Your wish, our command. From plumbers to stylists — TaskGenie
							connects you with trusted professionals for every need.
						</p>

						<div className="flex gap-4 mt-5 text-[#A39AC1] text-sm">
							<a
								href="#"
								className="cursor-pointer hover:text-violet-500 transition"
							>
								Twitter
							</a>
							<a
								href="#"
								className="cursor-pointer hover:text-violet-500 transition"
							>
								LinkedIn
							</a>
							<a
								href="#"
								className="cursor-pointer hover:text-violet-500 transition"
							>
								Instagram
							</a>
						</div>
					</div>

					<div className="flex-grow grid grid-cols-2 md:grid-cols-4 gap-8">
						<div>
							<h3 className="font-bold uppercase tracking-wider text-[12px] text-white">
								Company
							</h3>
							<div className="flex flex-col mt-3 space-y-2 text-[13px] text-[#A39AC1]">
								<a className="cursor-pointer hover:text-violet-500 transition">
									About Us
								</a>
								<a className="cursor-pointer hover:text-violet-500 transition">
									Pricing
								</a>
								<a className="cursor-pointer hover:text-violet-500 transition">
									Careers
								</a>
								<a className="cursor-pointer hover:text-violet-500 transition">
									Press
								</a>
							</div>
						</div>

						<div>
							<h3 className="font-bold uppercase tracking-wider text-[12px] text-white">
								For Customers
							</h3>
							<div className="flex flex-col mt-3 space-y-2 text-[13px] text-[#A39AC1]">
								<a
									href="#how-it-works"
									className="cursor-pointer hover:text-violet-500 transition"
								>
									How It Works
								</a>
								<a className="cursor-pointer hover:text-violet-500 transition">
									Trust & Safety
								</a>
								<a className="cursor-pointer hover:text-violet-500 transition">
									Help Center
								</a>
							</div>
						</div>

						<div>
							<h3 className="font-bold uppercase tracking-wider text-[12px] text-white">
								For Providers
							</h3>
							<div className="flex flex-col mt-3 space-y-2 text-[13px] text-[#A39AC1]">
								<a className="cursor-pointer hover:text-violet-500 transition">
									Join as Provider
								</a>
								<a className="cursor-pointer hover:text-violet-500 transition">
									Dashboard
								</a>
								<a className="cursor-pointer hover:text-violet-500 transition">
									Provider Guidelines
								</a>
								<a className="cursor-pointer hover:text-violet-500 transition">
									Earnings
								</a>
							</div>
						</div>

						<div>
							<h3 className="font-bold uppercase tracking-wider text-[12px] text-white">
								Resources
							</h3>
							<div className="flex flex-col mt-3 space-y-2 text-[13px] text-[#A39AC1]">
								<a className="cursor-pointer hover:text-violet-500 transition">
									FAQs
								</a>
								<a className="cursor-pointer hover:text-violet-500 transition">
									Terms of Service
								</a>
								<a className="cursor-pointer hover:text-violet-500 transition">
									Privacy Policy
								</a>
								<a className="cursor-pointer hover:text-violet-500 transition">
									Contact Us
								</a>
							</div>
						</div>
					</div>
				</div>

				<div className="mt-12 pt-6 border-t border-gray-700 flex flex-col sm:flex-row justify-between items-center">
					<p className="text-sm text-[#A39AC1]">
						&copy; {new Date().getFullYear()} TaskGenie. All rights reserved.
					</p>
					<p className="text-xs text-[#7B7199] mt-2 sm:mt-0">
						Made with ❤️ by the TaskGenie Team
					</p>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
