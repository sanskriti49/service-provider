import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
	Search,
	ChevronDown,
	ChevronRight,
	ShieldCheck,
	Briefcase,
	User,
	IndianRupee,
	LifeBuoy,
	CalendarCheck,
	Wrench,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import KycVerificationModal from "../ui/KycVerificationModal";
import SupportTicketModal from "../ui/SupportTicketModal";
import SupportBanner from "./SupportBanner";
import useKeyboardShortcut from "../hooks/useKeyboardShortcut";
import gsap from "gsap";

const RetroGrid = () => {
	return (
		<div className="absolute top-0 inset-x-0 h-[500px] overflow-hidden pointer-events-none select-none -z-10">
			{/* Background base fade */}
			<div className="absolute inset-0 bg-gradient-to-b from-violet-50/60 via-white/40 to-white" />

			{/* Perspective 3D Grid */}
			<div className="absolute inset-0 [perspective:1000px] [transform-style:preserve-3d]">
				<div
					className="absolute inset-0 h-[200%] w-full origin-top"
					style={{
						backgroundImage: `
                            linear-gradient(to right, rgba(139, 92, 246, 0.12) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(139, 92, 246, 0.12) 1px, transparent 1px)
                        `,
						backgroundSize: "60px 60px",
						transform: "rotateX(60deg) translateY(-100px) scale(1.5)",
						maskImage:
							"linear-gradient(to bottom, rgba(0,0,0,1) 0%, transparent 60%)",
						WebkitMaskImage:
							"linear-gradient(to bottom, rgba(0,0,0,1) 0%, transparent 60%)",
					}}
				/>
			</div>

			{/* Radial glow without heavy mix-blend or excessive blur */}
			<div
				className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[280px] pointer-events-none"
				style={{
					background:
						"radial-gradient(circle at center top, rgba(139, 92, 246, 0.08) 0%, transparent 70%)",
				}}
			/>
		</div>
	);
};

const allFaqs = {
	customer: [
		{
			id: "bookings",
			audience: "customer",
			category: "Bookings & Service Scheduling",
			blurb: "Matching, rescheduling and the completion OTP.",
			questions: [
				{
					q: "How does TaskGenie match me with local professionals?",
					a: "When you request a service, our matching engine identifies verified professionals within your geographical radius based on proximity, ratings, real-time slot availability, and specialization.",
				},
				{
					q: "Can I reschedule or cancel my service booking?",
					a: "Yes. You can reschedule or cancel directly from 'My Bookings'. Free cancellations are available up to 2 hours before the scheduled appointment time.",
				},
				{
					q: "How does the Completion OTP work?",
					a: "When your service provider finishes the job satisfactorily, share the 6-digit OTP displayed on your booking screen. The payment is only released to the provider after OTP verification.",
				},
			],
		},
		{
			id: "payments",
			audience: "customer",
			category: "Payments, Refunds & Invoices",
			blurb: "Payment methods, refund timelines and GST invoices.",
			questions: [
				{
					q: "What payment methods are supported?",
					a: "We accept all major Indian payment options: UPI (Google Pay, PhonePe, Paytm), Credit and Debit Cards (Visa, Mastercard, RuPay), Net Banking, and Pay After Service.",
				},
				{
					q: "How do refunds work?",
					a: "Approved refunds are processed immediately and reflect in your original payment method within 5 to 7 business days.",
				},
				{
					q: "Can I get a GST tax invoice?",
					a: "Yes. Once a booking is marked completed, you can download a GST-compliant tax invoice directly from your Bookings dashboard.",
				},
			],
		},
		{
			id: "trust",
			audience: "customer",
			category: "Trust, Safety & Quality Guarantee",
			blurb: "How professionals are verified and what we guarantee.",
			questions: [
				{
					q: "Are all professionals background verified?",
					a: "Yes. Every technician undergoes Aadhaar/PAN government identity vetting and skill screening before they can accept bookings.",
				},
				{
					q: "What is the TaskGenie Happiness Guarantee?",
					a: "If the service does not meet quality standards, report it within 24 hours. We will either send a senior technician to re-do the service for free or issue a full refund.",
				},
			],
		},
	],
	provider: [
		{
			id: "kyc",
			audience: "provider",
			category: "KYC & Identity Verification",
			blurb: "Accepted documents, review time and the Verified Pro badge.",
			questions: [
				{
					q: "How long does KYC verification take?",
					a: "Our compliance desk reviews submitted government documents within 24 to 48 business hours. Once verified, the gold 'Verified Pro' badge is awarded and you can receive client bookings.",
				},
				{
					q: "Which identification documents are accepted?",
					a: "We accept valid Indian government-issued documents: Aadhaar Card (front and back, masked Aadhaar accepted), Indian Driving License, Trade Certificates, and PAN Cards.",
				},
				{
					q: "What if my KYC submission was rejected?",
					a: "If rejected, click 'KYC Verification' above to view the specific reason left by the compliance officer. The most common issues are blurry photos or name mismatches. You can upload clear new photos and re-submit immediately.",
				},
				{
					q: "Why do I need the Verified Pro badge?",
					a: "Verified Pros receive 3.8x higher booking conversion, priority algorithmic matching for nearby homeowners, and access to expedited weekly bank payouts.",
				},
			],
		},
		{
			id: "earnings",
			audience: "provider",
			category: "Earnings, Payouts & Commission",
			blurb: "Weekly payouts, the 15% commission and setting your rates.",
			questions: [
				{
					q: "How and when are provider earnings paid out?",
					a: "Earnings from completed bookings are compiled weekly and transferred directly to your bank account or UPI ID every Wednesday via NEFT/IMPS.",
				},
				{
					q: "What is TaskGenie's platform commission?",
					a: "TaskGenie charges a transparent 15% platform commission on completed jobs. This covers payment gateway processing, customer marketing, dispute insurance, and 24/7 client dispatch.",
				},
				{
					q: "Can I set custom pricing per service?",
					a: "Yes. In your Provider Dashboard under 'Services', you can toggle between Fixed Rates and Hourly Rates for each trade you offer.",
				},
			],
		},
		{
			id: "schedules",
			audience: "provider",
			category: "Schedules, Cancellations & Disputes",
			blurb: "Availability, late cancellations and on-site disputes.",
			questions: [
				{
					q: "How do I manage my weekly availability?",
					a: "Go to Dashboard > Settings > Availability. You can set working hours for each day of the week, or toggle off-days when you are taking time off.",
				},
				{
					q: "What happens if a customer cancels late?",
					a: "If a homeowner cancels within 2 hours of the scheduled service time, Late Cancellation Protection is triggered, and a compensation fee is credited to your provider wallet.",
				},
				{
					q: "What should I do if a dispute arises on-site?",
					a: "Open a Support Ticket selecting 'Booking Dispute'. Our mediation team will inspect the booking notes, photos, and timestamps to ensure a fair resolution within 24 hours.",
				},
			],
		},
	],
};

const HERO = {
	guest: {
		title: "What do you need help with?",
		sub: "Search the answers below or pick a common task. If you can't find it, support replies every day from 9 AM to 11 PM.",
	},
	customer: {
		title: "Help with your bookings, payments and account",
		sub: "Search the answers below or pick a common task. If you can't find it, support replies every day from 9 AM to 11 PM.",
	},
	provider: {
		title: "Help with KYC, payouts and your jobs",
		sub: "Search the answers below or pick a common task. Partner queries are answered by the same team, every day from 9 AM to 11 PM.",
	},
};

const PLACEHOLDER = {
	guest: "Search refunds, KYC, payouts…",
	customer: "Search bookings, refunds, invoices…",
	provider: "Search KYC, payouts, disputes…",
};

const POPULAR = {
	guest: ["Refund", "KYC", "Payout", "Cancellation"],
	customer: ["Refund", "Reschedule", "OTP", "Invoice"],
	provider: ["KYC", "Payout", "Commission", "Cancellation"],
};

const TABS = [
	{ key: "customer", label: "Homeowners" },
	{ key: "provider", label: "Service providers" },
];

const AUDIENCE_LABEL = {
	customer: "For homeowners",
	provider: "For service providers",
};

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

const focusRing =
	"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600";
const rowFocusRing =
	"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600";

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const Highlight = ({ text, terms }) => {
	if (!terms.length) return text;
	const re = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
	return text.split(re).map((part, i) =>
		i % 2 === 1 ? (
			<mark key={i} className="bg-violet-100 text-violet-900 rounded-sm">
				{part}
			</mark>
		) : (
			part
		),
	);
};

const scrollToId = (e, id) => {
	const el = document.getElementById(id);
	if (!el) return;
	e.preventDefault();
	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
};

const STATUS_TONE = {
	good: "text-emerald-700",
	wait: "text-amber-700",
	todo: "text-violet-700",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const HelpCenter = () => {
	const navigate = useNavigate();
	const { user } = useAuth();

	const [activeTab, setActiveTab] = useState("customer");
	const [searchQuery, setSearchQuery] = useState("");

	// Modals
	const [showKycModal, setShowKycModal] = useState(false);
	const [showTicketModal, setShowTicketModal] = useState(false);
	const [ticketCategory, setTicketCategory] = useState("general");

	const searchInputRef = useRef(null);

	const currentHour = new Date().getHours();
	const isSupportOnline = currentHour >= 9 && currentHour < 23;

	const userRole = user?.role || null;
	// Anything that isn't a customer or provider (e.g. admin) is treated as a guest for FAQ purposes
	const roleKey =
		userRole === "customer" || userRole === "provider" ? userRole : null;
	const heroKey = roleKey || "guest";

	useEffect(() => {
		if (roleKey) setActiveTab(roleKey);
	}, [roleKey]);

	const handleKycClick = () => {
		if (!user) {
			navigate("/auth/signin?role=provider");
			return;
		}
		if (user.role === "provider") {
			setShowKycModal(true);
		} else {
			navigate("/apply-provider");
		}
	};

	const handleOpenTicket = (category = "general") => {
		setTicketCategory(category);
		setShowTicketModal(true);
	};

	// Keyboard shortcuts using centralized hook & modalStack awareness
	useKeyboardShortcut(
		["ctrl+k", "cmd+k", "/"],
		() => {
			searchInputRef.current?.focus();
			searchInputRef.current?.select();
		},
		{ ignoreWhenModalOpen: true },
	);

	useKeyboardShortcut(
		"escape",
		() => {
			if (searchQuery) {
				setSearchQuery("");
				searchInputRef.current?.blur();
			}
		},
		{ ignoreWhenModalOpen: true, enableInInputs: true },
	);

	useKeyboardShortcut(
		"t",
		() => {
			handleOpenTicket(userRole === "provider" ? "kyc" : "booking");
		},
		{ ignoreWhenModalOpen: true },
	);

	useKeyboardShortcut(
		"k",
		() => {
			handleKycClick();
		},
		{ ignoreWhenModalOpen: true },
	);

	// Common tasks, tailored to who's signed in
	const quickLinks = useMemo(() => {
		const icon = "w-5 h-5";

		if (userRole === "provider") {
			const kyc = user?.is_verified
				? { label: "Verified", tone: "good" }
				: user?.kyc_status === "pending"
					? { label: "Under review", tone: "wait" }
					: { label: "Not verified", tone: "todo" };
			return [
				{
					title: "KYC verification",
					sub: "Documents and status",
					icon: <ShieldCheck className={icon} />,
					status: kyc,
					shortcut: "K",
					onClick: handleKycClick,
				},
				{
					title: "Open a ticket",
					sub: "Partner support",
					icon: <LifeBuoy className={icon} />,
					shortcut: "T",
					onClick: () => handleOpenTicket("kyc"),
				},
				{
					title: "Payouts and earnings",
					sub: "Paid every Wednesday",
					icon: <IndianRupee className={icon} />,
					to: "/provider/dashboard/earnings",
				},
				{
					title: "Service settings",
					sub: "Rates and working hours",
					icon: <Wrench className={icon} />,
					to: "/provider/dashboard/settings",
				},
			];
		}

		if (userRole === "customer") {
			return [
				{
					title: "My bookings",
					sub: "Track and reschedule",
					icon: <CalendarCheck className={icon} />,
					to: "/dashboard/bookings",
				},
				{
					title: "Open a ticket",
					sub: "Refunds and other questions",
					icon: <LifeBuoy className={icon} />,
					shortcut: "T",
					onClick: () => handleOpenTicket("booking"),
				},
				{
					title: "Account settings",
					sub: "Profile and addresses",
					icon: <User className={icon} />,
					to: "/account/settings",
				},
				{
					title: "Become a provider",
					sub: "Earn with TaskGenie",
					icon: <Briefcase className={icon} />,
					to: "/apply-provider",
				},
			];
		}

		// Guest
		return [
			{
				title: "Open a ticket",
				sub: "Send us a question",
				icon: <LifeBuoy className={icon} />,
				shortcut: "T",
				onClick: () => handleOpenTicket("general"),
			},
			{
				title: "Provider KYC",
				sub: "Sign in to verify your identity",
				icon: <ShieldCheck className={icon} />,
				shortcut: "K",
				onClick: handleKycClick,
			},
			{
				title: "Join as a provider",
				sub: "Start earning with TaskGenie",
				icon: <Briefcase className={icon} />,
				to: "/apply-provider",
			},
			{
				title: "Your bookings",
				sub: "Sign in to track them",
				icon: <CalendarCheck className={icon} />,
				to: "/auth/signin",
			},
		];
	}, [userRole, user]);

	// Search: every word must appear in the question, answer or category name
	const terms = useMemo(
		() => searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean),
		[searchQuery],
	);
	const isSearching = terms.length > 0;

	const sections = useMemo(() => {
		const base = roleKey
			? allFaqs[roleKey]
			: isSearching
				? [...allFaqs.customer, ...allFaqs.provider]
				: allFaqs[activeTab];

		if (!isSearching) return base;

		return base
			.map((cat) => {
				const catText = cat.category.toLowerCase();
				if (terms.every((t) => catText.includes(t))) return cat;
				return {
					...cat,
					questions: cat.questions.filter((item) => {
						const hay = `${item.q} ${item.a} ${cat.category}`.toLowerCase();
						return terms.every((t) => hay.includes(t));
					}),
				};
			})
			.filter((cat) => cat.questions.length > 0);
	}, [roleKey, activeTab, isSearching, terms]);

	const resultCount = sections.reduce((n, c) => n + c.questions.length, 0);
	const showTabs = !roleKey && !isSearching;

	return (
		<MotionConfig reducedMotion="user">
			<div className="font-geist min-h-screen  text-slate-900 selection:bg-violet-600 selection:text-white">
				<RetroGrid />
				<div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-32 pb-24 z-10">
					{/* Hero: heading + search on the left, common tasks on the right */}
					<div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-start mb-20">
						<div>
							<h1
								className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-slate-900 max-w-xl"
								style={{ fontFamily: "P22Mackinac, serif" }}
							>
								{HERO[heroKey].title}
							</h1>
							<p className="mt-5 text-lg text-slate-600 max-w-xl leading-relaxed">
								{HERO[heroKey].sub}
							</p>

							<div className="mt-8 max-w-xl">
								<label htmlFor="help-search" className="sr-only">
									Search help
								</label>
								<div className="relative">
									<Search
										aria-hidden="true"
										className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
									/>
									<input
										id="help-search"
										ref={searchInputRef}
										type="text"
										autoComplete="off"
										placeholder={PLACEHOLDER[heroKey]}
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="w-full h-14 pl-12 pr-24 rounded-xl border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20 transition-colors"
									/>
									<div className="absolute right-3 top-1/2 -translate-y-1/2">
										{searchQuery ? (
											<button
												type="button"
												onClick={() => setSearchQuery("")}
												className={`px-2 py-1 text-sm font-medium text-slate-500 hover:text-slate-900 rounded cursor-pointer ${focusRing}`}
											>
												Clear
											</button>
										) : (
											<kbd className="hidden sm:inline-block px-2 py-0.5 text-xs font-mono text-slate-400 border border-slate-200 rounded">
												/
											</kbd>
										)}
									</div>
								</div>

								<div
									className="mt-4 min-h-[1.75rem] text-sm text-slate-500"
									aria-live="polite"
								>
									{isSearching ? (
										<p>
											{resultCount === 0
												? "No matching answers"
												: `${resultCount} ${resultCount === 1 ? "answer" : "answers"}`}{" "}
											for “{searchQuery.trim()}”
										</p>
									) : (
										<p className="flex flex-wrap items-center gap-x-4 gap-y-1">
											<span>Popular:</span>
											{POPULAR[heroKey].map((term) => (
												<button
													key={term}
													type="button"
													onClick={() => setSearchQuery(term)}
													className={`text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-violet-700 hover:decoration-violet-600 cursor-pointer rounded ${focusRing}`}
												>
													{term}
												</button>
											))}
										</p>
									)}
								</div>
							</div>
						</div>

						<section
							aria-labelledby="common-tasks"
							className="rounded-xl border border-slate-200 bg-white overflow-hidden"
						>
							<h2
								id="common-tasks"
								className="mackinac px-4 pt-4 pb-2 text-lg font-bold text-slate-900"
							>
								Common tasks
							</h2>
							<ul className="divide-y divide-slate-100">
								{quickLinks.map((link) => (
									<li key={link.title}>
										<TaskRow link={link} />
									</li>
								))}
							</ul>
						</section>
					</div>

					{/* Answers */}
					<div
						className={
							sections.length > 0
								? "grid lg:grid-cols-[13rem_minmax(0,1fr)] gap-x-16 gap-y-8 mb-24"
								: "mb-24"
						}
					>
						{sections.length > 0 && (
							<nav
								aria-label="Help topics"
								className="lg:self-start lg:sticky lg:top-28"
							>
								<p className="hidden lg:block text-sm font-semibold text-slate-900 mb-3">
									Topics
								</p>
								<ul className="flex lg:flex-col gap-x-6 gap-y-0.5 overflow-x-auto lg:overflow-visible border-b border-slate-200 lg:border-b-0 pb-2 lg:pb-0">
									{sections.map((cat) => (
										<li key={cat.id} className="shrink-0">
											<a
												href={`#${cat.id}`}
												onClick={(e) => scrollToId(e, cat.id)}
												className={`block py-1.5 text-sm text-slate-600 hover:text-violet-700 whitespace-nowrap lg:whitespace-normal rounded ${focusRing}`}
											>
												{cat.category}
											</a>
										</li>
									))}
									<li className="shrink-0 lg:mt-3 lg:pt-3 lg:border-t lg:border-slate-200">
										<a
											href="#contact"
											onClick={(e) => scrollToId(e, "contact")}
											className={`block py-1.5 text-sm font-medium text-slate-900 hover:text-violet-700 whitespace-nowrap rounded ${focusRing}`}
										>
											Contact support
										</a>
									</li>
								</ul>
							</nav>
						)}

						<div className="min-w-0">
							{showTabs && (
								<div
									role="tablist"
									aria-label="Help for"
									className="flex gap-7 border-b border-slate-200 mb-10"
								>
									{TABS.map((tab) => {
										const active = activeTab === tab.key;
										return (
											<button
												key={tab.key}
												type="button"
												role="tab"
												aria-selected={active}
												onClick={() => setActiveTab(tab.key)}
												className={`-mb-px pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${focusRing} ${
													active
														? "border-violet-600 text-slate-900"
														: "border-transparent text-slate-500 hover:text-slate-800"
												}`}
											>
												{tab.label}
											</button>
										);
									})}
								</div>
							)}

							{sections.length === 0 ? (
								<div className="rounded-xl border border-dashed border-slate-300 p-8 sm:p-10">
									<h2 className="mackinac text-2xl font-bold text-slate-900">
										No answers for “{searchQuery.trim()}”
									</h2>
									<p className="mt-2 text-slate-600 max-w-md leading-relaxed">
										Try a shorter word like “refund” or “KYC”. Or send us the
										question and a person will reply.
									</p>
									<div className="mt-6 flex flex-wrap gap-3">
										<button
											type="button"
											onClick={() => setSearchQuery("")}
											className={`px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer ${focusRing}`}
										>
											Clear search
										</button>
										<button
											type="button"
											onClick={() => handleOpenTicket("general")}
											className={`px-4 py-2.5 rounded-lg bg-violet-600 text-sm font-semibold text-white hover:bg-violet-500 transition-colors cursor-pointer ${focusRing}`}
										>
											Open a ticket
										</button>
									</div>
								</div>
							) : (
								<div className="space-y-14">
									{sections.map((cat) => (
										<FaqSection
											key={cat.id}
											category={cat}
											terms={terms}
											showAudience={!roleKey && isSearching}
										/>
									))}
								</div>
							)}
						</div>
					</div>

					<div id="contact" className="scroll-mt-28">
						<SupportBanner
							isSupportOnline={isSupportOnline}
							userRole={userRole}
							onOpenTicket={handleOpenTicket}
						/>
					</div>
				</div>

				<KycVerificationModal
					isOpen={showKycModal}
					onClose={() => setShowKycModal(false)}
				/>

				<SupportTicketModal
					isOpen={showTicketModal}
					onClose={() => setShowTicketModal(false)}
					defaultRole={roleKey || activeTab}
					defaultCategory={ticketCategory}
				/>
			</div>
		</MotionConfig>
	);
};

/* ------------------------------------------------------------------ */
/*  Pieces                                                             */
/* ------------------------------------------------------------------ */

const TaskRow = ({ link }) => {
	const className = `group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 cursor-pointer ${rowFocusRing}`;

	const content = (
		<>
			<span className="text-slate-500 group-hover:text-violet-700 transition-colors">
				{link.icon}
			</span>
			<span className="flex-1 min-w-0">
				<span className="block font-medium text-slate-900">{link.title}</span>
				<span className="block text-sm text-slate-500">{link.sub}</span>
			</span>
			{link.status && (
				<span
					className={`text-xs font-semibold ${STATUS_TONE[link.status.tone]}`}
				>
					{link.status.label}
				</span>
			)}
			{link.shortcut && (
				<kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-mono text-slate-400 border border-slate-200 rounded">
					{link.shortcut}
				</kbd>
			)}
			<ChevronRight
				aria-hidden="true"
				className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors"
			/>
		</>
	);

	if (link.onClick) {
		return (
			<button type="button" onClick={link.onClick} className={className}>
				{content}
			</button>
		);
	}
	return (
		<Link to={link.to} className={className}>
			{content}
		</Link>
	);
};

const FaqSection = ({ category, terms, showAudience }) => (
	<section
		id={category.id}
		aria-labelledby={`${category.id}-title`}
		className="scroll-mt-28"
	>
		{showAudience && (
			<p className="text-sm text-slate-500 mb-1">
				{AUDIENCE_LABEL[category.audience]}
			</p>
		)}
		<h2
			id={`${category.id}-title`}
			className="mackinac text-2xl sm:text-3xl font-bold tracking-tight text-slate-900"
		>
			{category.category}
		</h2>
		<p className="mt-1.5 mb-5 text-slate-600">{category.blurb}</p>

		<div className="border-y border-slate-200 divide-y divide-slate-200">
			{category.questions.map((item, i) => (
				<AccordionItem
					key={item.q}
					id={`${category.id}-${i}`}
					question={item.q}
					answer={item.a}
					terms={terms}
					expandAll={terms.length > 0}
				/>
			))}
		</div>
	</section>
);

const AccordionItem = ({ id, question, answer, terms, expandAll }) => {
	const [isOpen, setIsOpen] = useState(false);

	// While searching, open every result so matches inside answers are visible
	useEffect(() => {
		setIsOpen(expandAll);
	}, [expandAll]);

	const panelId = `${id}-panel`;

	return (
		<div>
			<h3>
				<button
					type="button"
					onClick={() => setIsOpen((o) => !o)}
					aria-expanded={isOpen}
					aria-controls={panelId}
					className={`group w-full flex items-start justify-between gap-6 py-5 text-left cursor-pointer ${focusRing}`}
				>
					<span
						className={`mackinac text-lg font-semibold leading-snug transition-colors ${
							isOpen
								? "text-violet-700"
								: "text-slate-900 group-hover:text-violet-700"
						}`}
					>
						<Highlight text={question} terms={terms} />
					</span>
					<ChevronDown
						aria-hidden="true"
						className={`w-5 h-5 mt-1 shrink-0 transition-transform duration-200 ${
							isOpen ? "rotate-180 text-violet-600" : "text-slate-400"
						}`}
					/>
				</button>
			</h3>
			<AnimatePresence initial={false}>
				{isOpen && (
					<motion.div
						id={panelId}
						role="region"
						aria-label={question}
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="overflow-hidden"
					>
						<p className="pb-6 pr-10 max-w-[65ch] text-slate-600 leading-relaxed">
							<Highlight text={answer} terms={terms} />
						</p>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default HelpCenter;
