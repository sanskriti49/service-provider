import * as React from "react";
import { FilePenLine, Users, CheckCircle, Star } from "lucide-react";
import FadeIn from "../ui/FadeIn";
import { motion } from "framer-motion";

import Timeline from "@mui/lab/Timeline";
import TimelineItem from "@mui/lab/TimelineItem";
import TimelineSeparator from "@mui/lab/TimelineSeparator";
import TimelineConnector from "@mui/lab/TimelineConnector";
import TimelineContent from "@mui/lab/TimelineContent";
import TimelineDot from "@mui/lab/TimelineDot";
import AuroraBackground from "../ui/AuroraBackground";

const steps = [
	{
		icon: FilePenLine,
		title: "Describe Your Task",
		description:
			"Tell us what you need, from a leaky faucet to a full house cleaning. Be as detailed as you like.",
	},
	{
		icon: Users,
		title: "Get Matched Instantly",
		description:
			"Our smart system connects you with a top-rated, background-checked professional in your area.",
	},
	{
		icon: CheckCircle,
		title: "Your Task Gets Done",
		description:
			"Your chosen pro arrives on time and completes the job. You just sit back, relax, and consider it done!",
	},
	{
		icon: Star,
		title: "Rate Your Pro",
		description:
			"After the job is complete, you can rate your professional and provide feedback to help our community.",
	},
];

const TimelineCard = ({ step }) => (
	<motion.div
		initial={{ opacity: 0, y: 30 }}
		whileInView={{ opacity: 1, y: 0 }}
		viewport={{ once: true, amount: 0.4 }}
		transition={{ duration: 0.6 }}
		className="p-6 bg-white/60 backdrop-blur-xl hover:bg-white/80 hover:scale-[1.03] 
               cursor-pointer rounded-2xl shadow-md hover:shadow-violet-300/60 
               border border-violet-100 transition duration-300 w-full"
	>
		<div className="flex items-center gap-4">
			<div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
				<step.icon className="h-6 w-6 text-violet-700" strokeWidth={2} />
			</div>
			<h3
				className="text-xl font-semibold text-violet-800"
				style={{ fontFamily: "P22Mackinac, serif" }}
			>
				{step.title}
			</h3>
		</div>
		<p className="mt-3 text-slate-600 inter text-base leading-relaxed">
			{step.description}
		</p>
	</motion.div>
);

const HowItWorksSection = () => {
	return (
		<section
			id="how-it-works"
			className="relative py-20 lg:py-18 overflow-hidden"
		>
			<AuroraBackground />
			<div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="mx-auto bricolage-grotesque flex justify-center  w-fit mb-5 rounded-full bg-violet-100 px-4 py-1.5 text-sm font-semibold text-violet-700">
					How It Works
				</div>
				<div className="text-center text-[#281950]">
					<h2 className="bricolage-grotesque text-3xl lg:text-4xl font-bold tracking-tight">
						4 Simple Steps, Done in a Flash
					</h2>
					<p className="mt-4 inter text-lg text-slate-600 max-w-2xl mx-auto">
						Getting help has never been easier. Here’s how our process connects
						you with the perfect pro.
					</p>
				</div>
				<div className="mt-16">
					<Timeline position="alternate">
						{steps.map((step, index) => (
							<TimelineItem key={index}>
								<TimelineSeparator>
									<TimelineConnector sx={{ bgcolor: "rgb(196 181 253)" }} />
									<TimelineDot
										sx={{
											bgcolor: "rgb(237 233 254)",
											borderColor: "rgb(167 139 250)",
											borderWidth: 4,
											p: 1.5,
											boxShadow: "0 4px 10px rgba(167,139,250,0.4)",
											"&:hover": {
												bgcolor: "rgb(221 214 254)",
												transform: "scale(1.1)",
											},
											transition: "all 0.3s ease",
										}}
									>
										<step.icon
											className="h-6 w-6 text-violet-700"
											strokeWidth={2}
										/>
									</TimelineDot>
									<TimelineConnector sx={{ bgcolor: "rgb(196 181 253)" }} />
								</TimelineSeparator>

								<TimelineContent sx={{ py: "12px", px: 2 }}>
									<TimelineCard step={step} />
								</TimelineContent>
							</TimelineItem>
						))}
					</Timeline>
				</div>
			</div>
		</section>
	);
};

export default HowItWorksSection;
