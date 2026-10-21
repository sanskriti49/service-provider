import * as React from "react";
import { Link } from "react-router-dom";
import {
	FilePenLine,
	Users,
	CheckCircle,
	Star,
	ArrowRight,
	ShieldCheck,
	MapPin,
	Wrench,
	Check,
} from "lucide-react";
import { motion, useScroll, useSpring, useReducedMotion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

/* ------------------------------------------------------------------ */
/*  Mini "product" vignettes: each step shows what the user will see   */
/* ------------------------------------------------------------------ */

const Frame = ({ accent, children }) => (
	<div className="relative w-full max-w-sm mx-auto">
		<div
			className={`absolute -inset-4 rounded-[2rem] bg-gradient-to-br ${accent} opacity-20 blur-2xl`}
		/>
		<div className="relative rounded-3xl bg-white/80 backdrop-blur-xl border border-white/70 shadow-xl shadow-purple-900/10 p-5">
			{children}
		</div>
	</div>
);

const TaskVignette = ({ reduce }) => (
	<div className="space-y-3">
		<div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
			<Wrench size={14} className="text-violet-600" />
			New task
		</div>
		<div className="rounded-2xl border border-violet-100 bg-white p-4 text-sm leading-relaxed text-[#281950]">
			My kitchen faucet has been leaking since morning. Need it fixed today if
			possible.
			<motion.span
				className="inline-block w-[2px] h-4 bg-violet-600 align-middle ml-0.5"
				animate={reduce ? undefined : { opacity: [1, 0, 1] }}
				transition={{ duration: 1, repeat: Infinity }}
			/>
		</div>
		<div className="flex flex-wrap gap-2 text-xs font-semibold">
			{["Plumbing", "Today, 5 PM", "Kitchen"].map((c) => (
				<span
					key={c}
					className="px-3 py-1 rounded-full bg-violet-100 text-violet-700"
				>
					{c}
				</span>
			))}
		</div>
	</div>
);

const MatchVignette = () => (
	<div className="space-y-4">
		<div className="flex items-center gap-3">
			<div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold flex items-center justify-center">
				AK
			</div>
			<div className="flex-1 min-w-0">
				<div className="font-bold text-[#281950] leading-tight">Arjun K.</div>
				<div className="text-xs text-slate-500">Plumber, 212 jobs done</div>
			</div>
			<div className="flex items-center gap-1 text-sm font-bold text-amber-500">
				<Star size={14} className="fill-amber-400 text-amber-400" />
				4.9
			</div>
		</div>
		<div className="flex flex-wrap gap-2 text-xs font-semibold">
			<span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">
				<ShieldCheck size={13} /> Background checked
			</span>
			<span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pink-50 text-pink-700">
				<MapPin size={13} /> 1.8 km away
			</span>
		</div>
		<motion.div
			initial={{ scale: 0.9, opacity: 0 }}
			whileInView={{ scale: 1, opacity: 1 }}
			viewport={{ once: true }}
			transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 18 }}
			className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 py-2.5 text-sm font-bold text-white"
		>
			<Check size={16} /> Matched
		</motion.div>
	</div>
);

const DoneVignette = () => {
	const rows = ["Pro is on the way", "Pro has arrived", "Job completed"];
	return (
		<div className="space-y-4">
			<div className="space-y-3">
				{rows.map((r, i) => (
					<motion.div
						key={r}
						initial={{ opacity: 0.35 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true }}
						transition={{ delay: 0.3 + i * 0.5 }}
						className="flex items-center gap-3 text-sm font-semibold text-[#281950]"
					>
						<span className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white flex items-center justify-center">
							<Check size={14} strokeWidth={3} />
						</span>
						{r}
					</motion.div>
				))}
			</div>
			<div className="h-2 rounded-full bg-pink-100 overflow-hidden">
				<motion.div
					initial={{ width: "8%" }}
					whileInView={{ width: "100%" }}
					viewport={{ once: true }}
					transition={{ duration: 1.6, delay: 0.3, ease: "easeInOut" }}
					className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500"
				/>
			</div>
		</div>
	);
};

const RateVignette = () => (
	<div className="space-y-3 text-center">
		<div className="flex justify-center gap-1.5">
			{[0, 1, 2, 3, 4].map((i) => (
				<motion.span
					key={i}
					initial={{ scale: 0.6, opacity: 0.3 }}
					whileInView={{ scale: 1, opacity: 1 }}
					viewport={{ once: true }}
					transition={{
						delay: 0.25 + i * 0.12,
						type: "spring",
						stiffness: 300,
					}}
				>
					<Star size={30} className="fill-amber-400 text-amber-400" />
				</motion.span>
			))}
		</div>
		<div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm text-indigo-900 leading-relaxed">
			Arrived on time and fixed the leak in 20 minutes. Super tidy.
		</div>
		<div className="text-xs font-semibold text-slate-500">
			Your review helps the next customer choose
		</div>
	</div>
);

/* ------------------------------------------------------------------ */

const steps = [
	{
		icon: FilePenLine,
		title: "Describe your task",
		description:
			"Tell us what you need, from a leaky faucet to a full house cleaning. Be as detailed as you like.",
		accent: "from-violet-500 to-purple-600",
		Vignette: TaskVignette,
	},
	{
		icon: Users,
		title: "Get matched instantly",
		description:
			"Our smart system connects you with a top-rated, background-checked professional in your area.",
		accent: "from-purple-500 to-pink-600",
		Vignette: MatchVignette,
	},
	{
		icon: CheckCircle,
		title: "Your task gets done",
		description:
			"Your chosen pro arrives on time and completes the job. You just sit back, relax, and consider it done.",
		accent: "from-pink-500 to-rose-600",
		Vignette: DoneVignette,
	},
	{
		icon: Star,
		title: "Rate your pro",
		description:
			"After the job is complete, rate your professional and share feedback to help our community.",
		accent: "from-indigo-500 to-violet-600",
		Vignette: RateVignette,
	},
];

const HowItWorksSection = () => {
	const { user } = useAuth();
	const reduce = useReducedMotion();
	const timelineRef = React.useRef(null);

	const { scrollYProgress } = useScroll({
		target: timelineRef,
		offset: ["start 65%", "end 75%"],
	});
	const progress = useSpring(scrollYProgress, {
		stiffness: 90,
		damping: 28,
		restDelta: 0.001,
	});

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
			className="relative scroll-mt-24 py-20 sm:py-28 overflow-hidden text-slate-800"
		>
			{/* soft background blobs, same language as the Contact page */}
			<div className="pointer-events-none absolute -top-10 -left-20 w-96 h-96 rounded-full bg-purple-300 mix-blend-multiply blur-3xl opacity-25 animate-blob" />
			<div className="pointer-events-none absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-pink-300 mix-blend-multiply blur-3xl opacity-25 animate-blob animation-delay-2000" />
			<div className="pointer-events-none absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-orange-200 mix-blend-multiply blur-3xl opacity-25 animate-blob animation-delay-4000" />

			<div className="relative max-w-5xl mx-auto px-5 sm:px-8">
				{/* Header */}
				<div className="max-w-2xl mx-auto text-center mb-16 sm:mb-24">
					<h2 className="bricolage-grotesque text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-[#281950]">
						From{" "}
						<span className="text-slate-400 line-through decoration-pink-400/70 decoration-[3px]">
							"it's broken"
						</span>{" "}
						to{" "}
						<span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
							"it's fixed"
						</span>{" "}
						in four steps
					</h2>
					<p className="font-geist mt-5 text-base sm:text-lg text-slate-600 leading-relaxed">
						Getting help has never been easier. Here's how our seamless process
						connects you with the perfect pro.
					</p>
				</div>

				{/* Timeline */}
				<div ref={timelineRef} className="relative">
					<div className="absolute left-5 md:left-1/2 -translate-x-1/2 top-5 bottom-0 w-[3px] [mask-image:linear-gradient(to_bottom,black_85%,transparent)]">
						<div className="absolute inset-0 rounded-full bg-violet-200/60" />
						<motion.div
							style={{ scaleY: reduce ? 1 : progress }}
							className="absolute inset-0 origin-top rounded-full bg-gradient-to-b from-violet-500 via-purple-500 to-pink-500"
						/>
					</div>

					<div className="space-y-16 sm:space-y-24">
						{steps.map((step, index) => {
							const Icon = step.icon;
							const textLeft = index % 2 === 0;
							const { Vignette } = step;

							return (
								<div
									key={step.title}
									className="relative grid md:grid-cols-2 gap-6 md:gap-x-24 items-center pl-14 md:pl-0"
								>
									{/* node on the line */}
									<motion.div
										initial={reduce ? false : { scale: 0.6 }}
										whileInView={{ scale: 1 }}
										viewport={{ once: true, amount: 0.8 }}
										transition={{ type: "spring", stiffness: 300, damping: 18 }}
										className={`absolute left-5 md:left-1/2 top-0 md:top-1/2 -translate-x-1/2 md:-translate-y-1/2 w-11 h-11 rounded-full bg-gradient-to-br ${step.accent} text-white flex items-center justify-center ring-[6px] ring-[#F7F4FF] shadow-lg shadow-purple-500/30 z-10`}
									>
										<Icon size={19} strokeWidth={2.3} />
									</motion.div>

									{/* text */}
									<div
										className={
											textLeft
												? "md:order-1 md:text-right"
												: "md:order-2 md:text-left"
										}
									>
										<div
											className={`bricolage-grotesque text-6xl sm:text-7xl font-extrabold leading-none bg-gradient-to-br ${step.accent} bg-clip-text text-transparent opacity-30 select-none`}
										>
											0{index + 1}
										</div>
										<h3
											className="mt-2 text-2xl sm:text-3xl font-bold text-[#281950] leading-tight"
											style={{ fontFamily: "P22Mackinac, serif" }}
										>
											{step.title}
										</h3>
										<p
											className={`font-geist mt-3 text-base text-slate-600 leading-relaxed max-w-sm ${
												textLeft ? "md:ml-auto" : ""
											}`}
										>
											{step.description}
										</p>
									</div>

									{/* vignette */}
									<div className={textLeft ? "md:order-2" : "md:order-1"}>
										<Frame accent={step.accent}>
											<Vignette reduce={reduce} />
										</Frame>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* CTA */}
				<div className="relative mt-24 sm:mt-32 overflow-hidden rounded-[2rem] bg-[#281950] px-6 py-10 sm:px-12 sm:py-12">
					<div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-pink-500/40 blur-3xl" />
					<div className="pointer-events-none absolute -bottom-28 -left-10 w-72 h-72 rounded-full bg-violet-500/40 blur-3xl" />

					<div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-8">
						<div className="max-w-md">
							<h3 className="bricolage-grotesque text-2xl sm:text-3xl font-extrabold text-white leading-tight">
								Post your first task in under 2 minutes
							</h3>
							<ul className="font-geist mt-4 space-y-2 text-sm text-violet-100/90">
								{[
									"Background-checked pros",
									"Matched in your area",
									"Rated by the community",
								].map((t) => (
									<li key={t} className="flex items-center gap-2">
										<span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
											<Check size={12} strokeWidth={3} />
										</span>
										{t}
									</li>
								))}
							</ul>
						</div>

						<Link
							to={targetLink}
							className="group inline-flex items-center justify-center gap-2 self-start md:self-auto rounded-full bg-white px-8 py-4 text-base font-bold text-[#281950] shadow-lg shadow-black/20 transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-300"
						>
							Get started
							<ArrowRight
								size={18}
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
