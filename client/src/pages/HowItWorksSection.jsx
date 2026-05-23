import * as React from "react";
import { FilePenLine, Users, CheckCircle, Star } from "lucide-react";
import { motion } from "framer-motion";
import AuroraBackground from "../ui/AuroraBackground";

const steps = [
	{
		icon: FilePenLine,
		title: "Describe Your Task",
		description:
			"Tell us what you need, from a leaky faucet to a full house cleaning. Be as detailed as you like.",
		number: "01",
	},
	{
		icon: Users,
		title: "Get Matched Instantly",
		description:
			"Our smart system connects you with a top-rated, background-checked professional in your area.",
		number: "02",
	},
	{
		icon: CheckCircle,
		title: "Your Task Gets Done",
		description:
			"Your chosen pro arrives on time and completes the job. You just sit back, relax, and consider it done!",
		number: "03",
	},
	{
		icon: Star,
		title: "Rate Your Pro",
		description:
			"After the job is complete, you can rate your professional and provide feedback to help our community.",
		number: "04",
	},
];

const StepCard = ({ step, index }) => (
	<motion.div
		initial={{ opacity: 0, y: 24 }}
		whileInView={{ opacity: 1, y: 0 }}
		viewport={{ once: true, amount: 0.3 }}
		transition={{ duration: 0.5, delay: index * 0.1 }}
		className="relative flex gap-4 sm:gap-6"
	>
		{/* Left: connector line + dot */}
		<div className="flex flex-col items-center flex-shrink-0">
			<div
				className="flex h-12 w-12 items-center justify-center rounded-full
                   bg-violet-100 border-2 border-violet-300 shadow-md shadow-violet-200
                   z-10 flex-shrink-0"
			>
				<step.icon className="h-5 w-5 text-violet-700" strokeWidth={2} />
			</div>
			{index < steps.length - 1 && (
				<div className="w-0.5 flex-1 min-h-[2rem] bg-gradient-to-b from-violet-300 to-violet-100 mt-2" />
			)}
		</div>

		{/* Right: card content */}
		<div className="pb-8 flex-1 min-w-0">
			<div
				className="p-5 bg-white/70 backdrop-blur-xl rounded-2xl border border-violet-100
                   shadow-sm hover:shadow-violet-200/70 hover:bg-white/90
                   transition-all duration-300"
			>
				<div className="flex items-start justify-between gap-3 mb-2">
					<h3
						className="text-lg font-semibold text-violet-900 leading-snug"
						style={{ fontFamily: "P22Mackinac, serif" }}
					>
						{step.title}
					</h3>
					<span className="text-xs font-bold text-violet-300 tracking-widest flex-shrink-0 pt-1 select-none">
						{step.number}
					</span>
				</div>
				<p className="text-slate-600 text-sm leading-relaxed inter">
					{step.description}
				</p>
			</div>
		</div>
	</motion.div>
);

const HowItWorksSection = () => {
	return (
		<section id="how-it-works" className="relative py-20 overflow-hidden">
			<AuroraBackground />

			<div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Badge */}
				<div className="flex justify-center mb-5">
					<span className="bricolage-grotesque rounded-full bg-violet-100 px-4 py-1.5 text-sm font-semibold text-violet-700">
						How It Works
					</span>
				</div>

				{/* Heading */}
				<div className="text-center text-[#281950] mb-12">
					<h2 className="bricolage-grotesque text-3xl sm:text-4xl font-bold tracking-tight">
						4 Simple Steps, Done in a Flash
					</h2>
					<p className="mt-4 inter text-base sm:text-lg text-slate-600 max-w-xl mx-auto">
						Getting help has never been easier. Here's how our process connects
						you with the perfect pro.
					</p>
				</div>

				{/* Steps — single clean vertical timeline on all sizes */}
				<div>
					{steps.map((step, index) => (
						<StepCard key={index} step={step} index={index} />
					))}
				</div>
			</div>
		</section>
	);
};

export default HowItWorksSection;
