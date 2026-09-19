import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
	CalendarSync,
	CheckCircle,
	HandCoins,
	Users,
	TrendingUp,
} from "lucide-react";

/*
 * Design tokens (Tailwind arbitrary values, so no config changes needed)
 *  ink     #1E1240  deep aubergine: headings, dark panel
 *  brand   #5B2EE0  primary actions
 *  lilac   #CDBBFF  icons on dark
 *  mist    #EFEAFB  image stage
 *  body    text-slate-600 on light, text-white/70 on dark
 */

const BENEFITS = [
	{
		icon: CalendarSync,
		title: "Work when you want",
		description:
			"Go full-time or pick up extra jobs around your day. You choose your hours and which jobs to accept.",
	},
	{
		icon: TrendingUp,
		title: "Grow your reputation",
		description:
			"Meet new clients every day, collect verified reviews, and build a profile that brings repeat work.",
	},
	{
		icon: HandCoins,
		title: "Get paid on time",
		description:
			"Prices are clear up front, and your payout is sent directly once the job is complete.",
	},
	{
		icon: Users,
		title: "Join a trusted network",
		description:
			"Work alongside verified professionals, with 24/7 support and safety protocols behind you.",
	},
];

const focusRing =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const WorkWUs = () => {
	const [imgFailed, setImgFailed] = useState(false);

	return (
		<section
			aria-labelledby="work-with-us-heading"
			className="bricolage-grotesque mx-auto max-w-6xl px-4 py-12 text-[#1E1240] sm:px-6 sm:py-16 lg:py-20"
		>
			{/* Hero */}
			<div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
				<div>
					<h2
						id="work-with-us-heading"
						className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]"
					>
						Join TaskGenie's service experts and turn your talent into income.
					</h2>

					<p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
						Whether you're just starting out or growing an established business,
						we connect you with clients who value your skills. Set your own
						hours, build your reputation, and get paid on time.
					</p>

					<div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
						<Link
							to="/apply-now"
							className={`inline-flex items-center justify-center rounded-full bg-[#5B2EE0] px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#4A22C4] focus-visible:ring-[#5B2EE0] focus-visible:ring-offset-white ${focusRing}`}
						>
							Apply now
						</Link>
						<a
							href="#why-work-with-us"
							className={`rounded-sm text-base font-semibold underline decoration-[#5B2EE0]/40 underline-offset-4 transition-colors hover:decoration-[#5B2EE0] focus-visible:ring-[#5B2EE0] ${focusRing}`}
						>
							See why experts join
						</a>
					</div>

					<ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
						{["Fast registration", "Zero upfront fees"].map((text) => (
							<li key={text} className="flex items-center gap-2">
								<CheckCircle
									size={16}
									strokeWidth={2}
									className="text-[#5B2EE0]"
									aria-hidden="true"
								/>
								{text}
							</li>
						))}
					</ul>
				</div>

				{/* Image stage */}
				<div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[2rem] bg-[#EFEAFB] lg:max-w-none">
					{imgFailed ? (
						<div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
							<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#5B2EE0]">
								<Users size={26} aria-hidden="true" />
							</div>
							<p className="text-lg font-semibold">10,000+ active experts</p>
							<p className="max-w-[16rem] text-sm text-slate-600">
								Connecting local professionals with clients every day
							</p>
						</div>
					) : (
						<>
							<div
								className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
								aria-hidden="true"
							/>
							<img
								src="/images/globe.webp"
								alt="Illustration of a globe connecting service professionals"
								loading="lazy"
								decoding="async"
								onError={() => setImgFailed(true)}
								className="absolute left-1/2 top-1/2 h-auto w-[62%] -translate-x-1/2 -translate-y-1/2 object-contain"
							/>
							<div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-white py-2 pl-3 pr-4 text-sm font-semibold shadow-sm">
								<Users
									size={16}
									className="text-[#5B2EE0]"
									aria-hidden="true"
								/>
								10,000+ active experts
							</div>
						</>
					)}
				</div>
			</div>

			{/* Benefits */}
			<div
				id="why-work-with-us"
				className="mt-16 scroll-mt-8 rounded-[2rem] bg-[#1E1240] px-6 py-12 text-white sm:px-12 lg:mt-24 lg:px-16 lg:py-16"
			>
				<div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
					<div className="lg:col-span-5">
						<h3 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
							Everything you need to run your own service business
						</h3>
						<p className="mt-4 max-w-sm text-base leading-relaxed text-white/70">
							We handle clients, payments, and support, so you can focus on
							doing great work.
						</p>
						<Link
							to="/apply-now"
							className={`mt-8 inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-base font-semibold text-[#1E1240] transition-colors hover:bg-[#EDE6FF] focus-visible:ring-white focus-visible:ring-offset-[#1E1240] ${focusRing}`}
						>
							Apply now
						</Link>
					</div>

					<ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-7">
						{BENEFITS.map(({ icon: Icon, title, description }) => (
							<li key={title} className="border-t border-white/15 pt-6">
								<Icon
									size={26}
									strokeWidth={1.5}
									className="text-[#CDBBFF]"
									aria-hidden="true"
								/>
								<h4 className="mt-4 text-lg font-semibold">{title}</h4>
								<p className="mt-2 text-[15px] leading-relaxed text-white/70">
									{description}
								</p>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
};

export default WorkWUs;
