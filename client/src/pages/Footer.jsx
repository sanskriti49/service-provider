import React from "react";
import { Link } from "react-router-dom";
import { HashLink } from "react-router-hash-link";

const Footer = () => {
	return (
		<footer className="mt-auto py-10 bg-[#191034] text-white bricolage-grotesque w-full">
			<div className="container mx-auto px-6 lg:px-16">
				<div className="flex flex-col md:flex-row md:justify-between gap-10">
					<div className="md:w-1/4">
						<Link
							to="/"
							className="text-2xl tracking-wide font-semibold flex items-center gap-2 text-white hover:text-violet-300 transition"
							style={{ fontFamily: "P22Mackinac, Cambria, sans-serif" }}
						>
							<img
								src="/images/taskgenie-logo.svg"
								alt="TaskGenie Logo"
								className="w-7 h-7 object-contain rounded-lg"
							/>
							<span>TaskGenie</span>
						</Link>
						<p className="text-sm text-[#A39AC1] mt-3 leading-relaxed">
							Your wish, our command. From plumbers to stylists — TaskGenie
							connects you with trusted professionals for every need.
						</p>
					</div>

					<div className="flex-grow grid grid-cols-2 md:grid-cols-4 gap-8">
						<div>
							<h3 className="font-bold uppercase tracking-wider text-[12px] text-white">
								Company
							</h3>
							<div className="flex flex-col mt-3 space-y-2 text-[13px] text-[#A39AC1]">
								<HashLink
									smooth
									to="/#hero"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									About Us
								</HashLink>
								<Link
									to="/services"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									Services & Pricing
								</Link>
								<Link
									to="/apply-now"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									Careers
								</Link>
								<HashLink
									smooth
									to="/#services"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									Categories
								</HashLink>
							</div>
						</div>

						<div>
							<h3 className="font-bold uppercase tracking-wider text-[12px] text-white">
								For Customers
							</h3>
							<div className="flex flex-col mt-3 space-y-2 text-[13px] text-[#A39AC1]">
								<HashLink
									smooth
									to="/#how-it-works"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									How It Works
								</HashLink>
								<Link
									to="/services"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									Browse Pros
								</Link>
								<Link
									to="/help"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									Help Center
								</Link>
							</div>
						</div>

						<div>
							<h3 className="font-bold uppercase tracking-wider text-[12px] text-white">
								For Providers
							</h3>
							<div className="flex flex-col mt-3 space-y-2 text-[13px] text-[#A39AC1]">
								<Link
									to="/apply-now"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									Join as Provider
								</Link>
								<Link
									to="/provider-dashboard"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									Pro Dashboard
								</Link>
								<HashLink
									smooth
									to="/#work-with-us"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									Benefits & Earnings
								</HashLink>
								<Link
									to="/help"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									Support
								</Link>
							</div>
						</div>

						<div>
							<h3 className="font-bold uppercase tracking-wider text-[12px] text-white">
								Resources
							</h3>
							<div className="flex flex-col mt-3 space-y-2 text-[13px] text-[#A39AC1]">
								<Link
									to="/help"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									FAQs
								</Link>
								<Link
									to="/help"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									Terms & Safety
								</Link>
								<HashLink
									smooth
									to="/#contact"
									className="cursor-pointer hover:text-violet-400 transition"
								>
									Contact Us
								</HashLink>
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
