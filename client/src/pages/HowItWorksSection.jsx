import * as React from "react";
import { Link } from "react-router-dom";
import {
	FilePenLine,
	Users,
	CheckCircle,
	Star,
	Sparkles,
	ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import AuroraBackground from "../ui/AuroraBackground";
import { useAuth } from "../hooks/useAuth";

const steps = [
	{
		icon: FilePenLine,
		title: "Describe Your Task",
		subtitle: "Tell us what you need",
		description:
			"Tell us what you need, from a leaky faucet to a full house cleaning. Be as detailed as you like.",
		number: "01",
		accent: "from-violet-500 to-purple-600",
		badgeBg: "bg-violet-100 text-violet-700 border-violet-200",
	},
	{
		icon: Users,
		title: "Get Matched Instantly",
		subtitle: "Smart pro matching",
		description:
			"Our smart system connects you with a top-rated, background-checked professional in your area.",
		number: "02",
		accent: "from-purple-500 to-pink-600",
		badgeBg: "bg-purple-100 text-purple-700 border-purple-200",
	},
	{
		icon: CheckCircle,
		title: "Your Task Gets Done",
		subtitle: "Sit back & relax",
		description:
			"Your chosen pro arrives on time and completes the job. You just sit back, relax, and consider it done!",
		number: "03",
		accent: "from-pink-500 to-rose-600",
		badgeBg: "bg-pink-100 text-pink-700 border-pink-200",
	},
	{
		icon: Star,
		title: "Rate Your Pro",
		subtitle: "Share your feedback",
		description:
			"After the job is complete, you can rate your professional and provide feedback to help our community.",
		number: "04",
		accent: "from-indigo-500 to-violet-600",
		badgeBg: "bg-indigo-100 text-indigo-700 border-indigo-200",
	},
];

const HowItWorksSection = () => {
	const { user } = useAuth();
	const targetLink = !user
		? "/sign-up"
		: user.role === "customer"
			? "/services"
			: user.role === "provider"
				? "/provider-dashboard"
				: "/admin";

	return (
		<section
			id="how-it-works"
			className="relative py-16 sm:py-24 overflow-hidden text-slate-800"
		>
			<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-violet-200/30 via-purple-200/20 to-pink-200/30 blur-[140px] pointer-events-none rounded-full" />

			<div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-center mb-4">
					<span className="bricolage-grotesque rounded-full bg-violet-100/90 border border-violet-200 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-violet-700 flex items-center gap-1.5">
						How It Works
					</span>
				</div>

				<div className="text-center text-[#281950] mb-16 space-y-3">
					<h2 className="bricolage-grotesque text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15]">
						4 Simple Steps,{" "}
						<span className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
							Done in a Flash
						</span>
					</h2>
					<p className="inter text-base sm:text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
						Getting help has never been easier. Here's how our seamless process
						connects you with the perfect pro.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
					<div className="hidden lg:block absolute top-12 left-[12%] right-[12%] h-[2px] bg-gradient-to-r from-violet-300 via-purple-300 to-pink-300 z-0" />

					{steps.map((step, index) => {
						const IconComp = step.icon;
						return (
							<motion.div
								key={index}
								initial={{ opacity: 0, y: 28 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true, amount: 0.2 }}
								transition={{ duration: 0.5, delay: index * 0.12 }}
								whileHover={{ y: -6 }}
								className="group relative flex flex-col justify-between p-6 rounded-3xl bg-white/90 border border-violet-100 shadow-lg shadow-purple-900/5 hover:shadow-xl hover:shadow-purple-900/10 hover:border-violet-300 backdrop-blur-xl transition-all duration-300 z-10"
							>
								<div>
									<div className="flex items-center justify-between mb-6">
										<div
											className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${step.accent} text-white flex items-center justify-center shadow-md shadow-purple-500/20 transition-transform duration-300 group-hover:scale-110`}
										>
											<IconComp size={22} strokeWidth={2.2} />
										</div>

										<span
											className={`text-xs font-black tracking-widest px-3 py-1 rounded-full border ${step.badgeBg}`}
										>
											{step.number}
										</span>
									</div>

									<div className="space-y-1.5">
										<h3
											className="text-lg font-bold text-[#281950] group-hover:text-violet-700 transition-colors leading-snug"
											style={{ fontFamily: "P22Mackinac, serif" }}
										>
											{step.title}
										</h3>
										<div className="text-xs font-semibold text-violet-600/90">
											{step.subtitle}
										</div>
										<p className="inter text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
											{step.description}
										</p>
									</div>
								</div>

								<div className="mt-6 pt-4 border-t border-violet-100/80 flex items-center justify-between text-[11px] font-bold text-violet-700">
									<span>Step {index + 1} of 4</span>
									<span className="w-1.5 h-1.5 rounded-full bg-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
							</motion.div>
						);
					})}
				</div>

				<div className="mt-14 text-center">
					<div className="inline-flex flex-col sm:flex-row items-center gap-4 p-4 sm:px-8 rounded-full bg-gradient-to-r from-violet-50 via-purple-50 to-pink-50 border border-violet-200/80 shadow-sm">
						<span className="text-xs sm:text-sm font-semibold text-slate-700">
							Ready to get started? Post your first task in under 2 minutes.
						</span>
						<Link
							to={targetLink}
							className="group inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 px-6 py-2.5 rounded-full shadow-md shadow-purple-500/20 hover:shadow-pink-500/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
						>
							<span>Get Started</span>
							<ArrowRight
								size={15}
								className="transition-transform group-hover:translate-x-1"
							/>
						</Link>
					</div>
				</div>
			</div>
		</section>
	);
};

export default HowItWorksSection;
