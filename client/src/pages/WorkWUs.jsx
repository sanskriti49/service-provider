import React from "react";
import { Link } from "react-router-dom";
import {
	CalendarSync,
	CheckCircle,
	HandCoins,
	Users,
	ArrowRight,
	Sparkles,
	ShieldCheck,
	TrendingUp,
} from "lucide-react";

/**
 * Modern Light-Mode WorkWUs Component for TaskGenie
 */
const BENEFITS = [
	{
		icon: CalendarSync,
		title: "Flexible Work",
		subtitle: "Choose your own schedule",
		description:
			"Work full-time or pick up extra gigs whenever you choose. Total control over your hours.",
		badge: "100% Flexible",
		iconBg: "bg-violet-100 text-violet-600 border-violet-200/80",
		badgeBg: "bg-violet-100/80 text-violet-700 border-violet-200",
	},
	{
		icon: TrendingUp,
		title: "Grow Your Skills",
		subtitle: "Access new clients daily",
		description:
			"Expand your client base, receive verified reviews, and scale your personal reputation.",
		badge: "Career Growth",
		iconBg: "bg-pink-100 text-pink-600 border-pink-200/80",
		badgeBg: "bg-pink-100/80 text-pink-700 border-pink-200",
	},
	{
		icon: HandCoins,
		title: "Reliable Payments",
		subtitle: "Secure & on-time payouts",
		description:
			"Enjoy total price transparency with automated, direct payments right after job completion.",
		badge: "Guaranteed Payouts",
		iconBg: "bg-emerald-100 text-emerald-600 border-emerald-200/80",
		badgeBg: "bg-emerald-100/80 text-emerald-700 border-emerald-200",
	},
	{
		icon: Users,
		title: "Trusted Network",
		subtitle: "Join verified professionals",
		description:
			"Be part of a premium network backed by dedicated 24/7 support and safety protocols.",
		badge: "Verified Community",
		iconBg: "bg-indigo-100 text-indigo-600 border-indigo-200/80",
		badgeBg: "bg-indigo-100/80 text-indigo-700 border-indigo-200",
	},
];

const WorkWUs = () => {
	return (
		<section className="bricolage-grotesque max-w-6xl mx-auto px-4 py-10 relative overflow-hidden text-slate-800">
			<div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-r from-violet-200/40 via-purple-200/30 to-pink-200/40 blur-[130px] pointer-events-none rounded-full" />

			<div className="flex flex-col lg:flex-row items-center justify-between gap-10 py-6 text-center lg:text-left">
				<div className="flex-1 space-y-4">
					<div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-100/80 border border-violet-200 text-violet-700 text-xs font-bold uppercase tracking-wider">
						<Sparkles size={13} className="text-pink-600" /> Grow Your Career
						With Us
					</div>

					<h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#281950] tracking-tight leading-[1.15]">
						Join our family of service experts and{" "}
						<span className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
							turn your talent into income.
						</span>
					</h2>

					<p className="text-base sm:text-lg text-slate-700 leading-relaxed max-w-2xl">
						At{" "}
						<strong className="text-violet-600 font-semibold">TaskGenie</strong>
						, we believe great talent deserves great opportunities. Whether
						you’re just starting out or looking to expand your career, our
						platform connects you with clients who value your skills. Work on
						your own terms, build your reputation, and enjoy the security of
						reliable payments — all in one place.
					</p>
				</div>

				{/* Right Column: Illustration Graphic */}
				<div className="relative group shrink-0">
					<div className="absolute inset-0 bg-gradient-to-tr from-violet-400/20 to-pink-400/20 rounded-3xl blur-2xl opacity-60 group-hover:opacity-90 transition-opacity duration-500" />

					<div className="relative p-4 sm:p-6 rounded-3xl bg-white/80 border border-violet-100/80 backdrop-blur-xl shadow-xl shadow-violet-900/5 flex flex-col items-center">
						<img
							src="/images/globe.png"
							alt="Work with us illustration"
							className="w-56 sm:w-64 lg:w-72 h-auto object-contain transition-transform duration-500 group-hover:scale-105"
							onError={(e) => {
								// Fallback graphic box if local image path isn't loaded
								e.target.style.display = "none";
								e.target.nextSibling.style.display = "flex";
							}}
						/>
						{/* Fallback Graphic Badge */}
						<div className="hidden w-60 h-60 rounded-2xl bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 border border-violet-200 flex-col items-center justify-center text-center p-6 space-y-3">
							<div className="w-14 h-14 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center">
								<Users size={28} className="text-violet-600" />
							</div>
							<span className="text-sm font-bold text-[#281950]">
								10,000+ Active Experts
							</span>
							<span className="text-xs text-slate-600">
								Connecting top local pros with clients daily
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Light Mode Gradient Divider Bar */}
			<div className="my-10 flex items-center justify-center gap-3">
				<div className="h-[1px] w-24 bg-gradient-to-r from-transparent to-violet-300" />
				<div className="h-1.5 w-14 rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-pink-500 shadow-sm shadow-purple-500/20" />
				<div className="h-[1px] w-24 bg-gradient-to-l from-transparent to-pink-300" />
			</div>

			{/* Main Feature Section Card (Light Mode Pastel Gradient & Glass) */}
			<div className="relative rounded-3xl p-6 sm:p-10 border border-violet-200/60 bg-gradient-to-br from-pink-100/80 via-violet-100/70 to-indigo-100/80 backdrop-blur-md shadow-xl shadow-purple-900/5">
				{/* Card Header */}
				<div className="text-center max-w-xl mx-auto mb-10 space-y-2">
					<h3 className="text-2xl sm:text-3xl font-extrabold text-[#281950] tracking-tight">
						Why Work With{" "}
						<span className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
							TaskGenie
						</span>
					</h3>
					<p className="text-xs sm:text-sm text-slate-700 font-medium">
						Everything you need to build a lucrative, independent service
						business.
					</p>
				</div>

				{/* 2x2 Feature Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
					{BENEFITS.map((item, index) => {
						const IconComp = item.icon;
						return (
							<div
								key={index}
								className="group relative p-6 rounded-2xl bg-white/90 border border-violet-100/80 hover:border-violet-300 transition-all duration-300 hover:shadow-xl hover:shadow-purple-900/10 flex items-start gap-4"
							>
								<div
									className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${item.iconBg} transition-transform duration-300 group-hover:scale-110 shadow-sm`}
								>
									<IconComp size={22} />
								</div>

								<div className="space-y-1 flex-1 min-w-0">
									<div className="flex items-center justify-between gap-2">
										<h4 className="text-base font-bold text-slate-900 group-hover:text-violet-700 transition-colors">
											{item.title}
										</h4>
										<span
											className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${item.badgeBg}`}
										>
											{item.badge}
										</span>
									</div>
									<div className="text-xs font-semibold text-violet-700">
										{item.subtitle}
									</div>
									<p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
										{item.description}
									</p>
								</div>
							</div>
						);
					})}
				</div>

				{/* Call to Action Footer */}
				<div className="mt-10 pt-8 border-t border-violet-200/80 flex flex-col sm:flex-row items-center justify-between gap-6">
					<div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-700">
						<span className="flex items-center gap-1.5 text-emerald-700 font-bold">
							<CheckCircle size={15} className="text-emerald-600" /> Fast
							Registration
						</span>
						<span>•</span>
						<span className="flex items-center gap-1.5 text-violet-700 font-bold">
							<ShieldCheck size={15} className="text-violet-600" /> Zero Upfront
							Fees
						</span>
					</div>

					<Link
						to="/apply-now"
						className="group relative cursor-pointer px-9 py-3.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/25 hover:shadow-pink-500/35 hover:scale-105 active:scale-95 flex items-center gap-2"
					>
						<span>Apply Now</span>
						<ArrowRight
							size={16}
							className="transition-transform group-hover:translate-x-1"
						/>
					</Link>
				</div>
			</div>
		</section>
	);
};

export default WorkWUs;
