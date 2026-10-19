import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Search, LifeBuoy, ChevronRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import KycVerificationModal from "../ui/KycVerificationModal";
import SupportTicketModal from "../ui/SupportTicketModal";
import SupportBanner from "./SupportBanner";
import useKeyboardShortcut from "../hooks/useKeyboardShortcut";
import ServiceIllustration from "../ui/ServiceIllustration";

const RetroGrid = () => {
	return (
		<div className="absolute top-0 inset-x-0 h-[500px] overflow-hidden pointer-events-none select-none -z-10">
			<div className="absolute inset-0 bg-gradient-to-b from-violet-50/60 via-white/40 to-white" />
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const focusRing =
	"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600";
const rowFocusRing =
	"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600";

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Search matches get a highlighter-pen swipe
const Highlight = ({ text, terms }) => {
	if (!terms.length) return text;
	const re = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
	return text.split(re).map((part, i) =>
		i % 2 === 1 ? (
			<mark key={i} className="bg-amber-200 text-slate-950 rounded-sm">
				{part}
			</mark>
		) : (
			part
		),
	);
};

const STATUS_TEXT = {
	good: "text-emerald-700",
	wait: "text-amber-700",
	todo: "text-violet-700",
};

const STATUS_BADGE = {
	good: "bg-emerald-50 text-emerald-800 border border-emerald-200/80",
	wait: "bg-amber-50 text-amber-800 border border-amber-200/80",
	todo: "bg-violet-50 text-violet-800 border border-violet-200/80",
};

// The one thing worth doing next, per topic
const ACTIONS = {
	bookings: { label: "Open my bookings", to: "/dashboard/bookings" },
	payments: { label: "Ask about a payment", ticket: "booking" },
	trust: { label: "Report a problem", ticket: "booking" },
	kyc: { label: "Check my KYC status", kyc: true },
	earnings: { label: "See my earnings", to: "/provider/dashboard/earnings" },
	schedules: {
		label: "Update my availability",
		to: "/provider/dashboard/settings",
	},
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const HelpCenter = () => {
	const navigate = useNavigate();
	const { user } = useAuth();

	const [activeTab, setActiveTab] = useState("customer");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedKey, setSelectedKey] = useState(null);

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
					status: kyc,
					shortcut: "K",
					onClick: handleKycClick,
				},
				{
					title: "Open a ticket",
					sub: "Partner support",
					shortcut: "T",
					onClick: () => handleOpenTicket("kyc"),
				},
				{
					title: "Payouts and earnings",
					sub: "Paid every Wednesday",
					to: "/provider/dashboard/earnings",
				},
				{
					title: "Service settings",
					sub: "Rates and working hours",
					to: "/provider/dashboard/settings",
				},
			];
		}

		if (userRole === "customer") {
			return [
				{
					title: "My bookings",
					sub: "Track and reschedule",
					to: "/dashboard/bookings",
				},
				{
					title: "Open a ticket",
					sub: "Refunds and other questions",
					shortcut: "T",
					onClick: () => handleOpenTicket("booking"),
				},
				{
					title: "Account settings",
					sub: "Profile and addresses",
					to: "/account/settings",
				},
				{
					title: "Become a provider",
					sub: "Earn with TaskGenie",
					to: "/apply-provider",
				},
			];
		}

		return [
			{
				title: "Open a ticket",
				sub: "Send us a question",
				shortcut: "T",
				onClick: () => handleOpenTicket("general"),
			},
			{
				title: "Provider KYC",
				sub: "Sign in to verify your identity",
				shortcut: "K",
				onClick: handleKycClick,
			},
			{
				title: "Join as a provider",
				sub: "Start earning with TaskGenie",
				to: "/apply-provider",
			},
			{
				title: "Your bookings",
				sub: "Sign in to track them",
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

	// Flat list so one question is always selected (falls back to the first)
	const entries = useMemo(
		() =>
			sections.flatMap((cat) =>
				cat.questions.map((item) => ({
					key: `${cat.id}:${item.q}`,
					cat,
					item,
				})),
			),
		[sections],
	);
	const active = entries.find((e) => e.key === selectedKey) || entries[0];

	const resultCount = entries.length;
	const showTabs = !roleKey && !isSearching;

	return (
		<MotionConfig reducedMotion="user">
			<div className="bricolage-grotesque min-h-screen bg-slate-50/50 text-slate-900 selection:bg-violet-950 selection:text-white">
				<RetroGrid />
				<div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-32 pb-24 z-10">
					{/* Hero: big headline and search, with the docket beside it */}
					<div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-12 lg:gap-20 items-start mb-24">
						<div>
							<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100/90 border border-violet-200 text-violet-900 text-xs font-bold tracking-wide uppercase mb-6 shadow-xs">
								<LifeBuoy className="w-3.5 h-3.5 text-violet-700" />
								Help & Knowledge Base
							</div>
							<h1 className="font-mackinac text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] text-slate-950 max-w-2xl">
								{HERO[heroKey].title}
							</h1>
							<p className="bricolage-grotesque mt-5 text-lg sm:text-xl text-slate-700 max-w-xl leading-relaxed font-normal">
								{HERO[heroKey].sub}
							</p>

							<div className="relative mt-10 max-w-2xl">
								<label htmlFor="help-search" className="sr-only">
									Search help
								</label>
								<div className="relative flex items-center border-b-2 border-slate-900 focus-within:border-violet-600 focus-within:shadow-[0_2px_0_0_#7c3aed] transition-all pb-1">
									<Search className="w-6 h-6 text-slate-500 mr-3 shrink-0" />
									<input
										id="help-search"
										ref={searchInputRef}
										type="text"
										autoComplete="off"
										placeholder={PLACEHOLDER[heroKey]}
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="bricolage-grotesque w-full bg-transparent py-2.5 pr-20 text-xl sm:text-2xl font-medium text-slate-950 placeholder:text-slate-400 outline-none"
									/>
									<div className="absolute right-0 bottom-3.5">
										{searchQuery ? (
											<button
												type="button"
												onClick={() => setSearchQuery("")}
												className={`px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition-colors ${focusRing}`}
											>
												Clear
											</button>
										) : (
											<kbd className="hidden sm:inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono font-semibold text-slate-600 bg-slate-100 border border-slate-300 rounded shadow-xs">
												/
											</kbd>
										)}
									</div>
								</div>

								<div
									className="mt-4 min-h-[1.75rem] text-sm text-slate-600"
									aria-live="polite"
								>
									{isSearching ? (
										<p className="font-medium text-slate-800">
											{resultCount === 0
												? "No matching answers"
												: `${resultCount} ${resultCount === 1 ? "answer" : "answers"}`}{" "}
											for “<span className="text-violet-700 font-semibold">{searchQuery.trim()}</span>”
										</p>
									) : (
										<p className="flex flex-wrap items-center gap-x-3 gap-y-2">
											<span className="font-semibold text-xs uppercase tracking-wider text-slate-500">Popular:</span>
											{POPULAR[heroKey].map((term) => (
												<button
													key={term}
													type="button"
													onClick={() => setSearchQuery(term)}
													className={`bricolage-grotesque px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-slate-200 text-slate-800 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50/50 shadow-2xs transition-all cursor-pointer ${focusRing}`}
												>
													{term}
												</button>
											))}
										</p>
									)}
								</div>
							</div>
						</div>

						{/* Docket: a typeset list with dotted leaders, like an index page */}
						<section
							aria-labelledby="common-tasks"
							className="bg-white border border-slate-200/90 shadow-xl shadow-slate-900/[0.04] border-t-4 border-t-violet-950 rounded-2xl overflow-hidden ring-1 ring-slate-900/5"
						>
							<div className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
								<h2
									id="common-tasks"
									className="font-mackinac text-xl sm:text-2xl font-bold text-slate-950"
								>
									Common tasks
								</h2>
								<span className="bricolage-grotesque text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
									Quick Actions
								</span>
							</div>
							<ul className="divide-y divide-slate-100">
								{quickLinks.map((link) => (
									<li key={link.title}>
										<TaskRow link={link} />
									</li>
								))}
							</ul>
							<div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-2.5">
								<span className="relative flex h-2.5 w-2.5">
									{isSupportOnline && (
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
									)}
									<span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSupportOnline ? "bg-emerald-500" : "bg-slate-400"}`}></span>
								</span>
								<span>
									{isSupportOnline
										? "Live support is online now"
										: "Support desk is offline, back at 9 AM"}
								</span>
							</div>
						</section>
					</div>

					{/* Answers: an index of every question, one answer read large beside it */}
					{sections.length === 0 ? (
						<div className="mb-24 max-w-xl border-l-4 border-violet-950 pl-6 bg-white p-6 rounded-r-2xl border border-slate-200 shadow-md">
							<ServiceIllustration scene="search" className="mb-5 w-40 h-auto" />
							<h2 className="font-mackinac text-3xl font-bold text-slate-950">
								No answers for “{searchQuery.trim()}”
							</h2>
							<p className="bricolage-grotesque mt-3 text-slate-700 leading-relaxed">
								Try a shorter word like “refund” or “KYC”. Or send us the
								question and a person will reply.
							</p>
							<div className="mt-6 flex flex-wrap gap-3">
								<button
									type="button"
									onClick={() => setSearchQuery("")}
									className={`bricolage-grotesque px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer ${focusRing}`}
								>
									Clear search
								</button>
								<button
									type="button"
									onClick={() => handleOpenTicket("general")}
									className={`bricolage-grotesque px-4 py-2.5 rounded-xl bg-violet-950 text-sm font-bold text-white hover:bg-violet-900 transition-colors cursor-pointer shadow-sm ${focusRing}`}
								>
									Open a ticket
								</button>
							</div>
						</div>
					) : (
						<div className="grid lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] gap-x-20 gap-y-10 mb-24">
							<div className="min-w-0">
								{showTabs && (
									<div
										role="tablist"
										aria-label="Help for"
										className="mb-8 flex flex-wrap items-center gap-3"
									>
										<span className="bricolage-grotesque text-xs font-bold uppercase tracking-wider text-slate-500 mr-2">
											Audience:
										</span>
										<div className="inline-flex p-1 bg-slate-200/80 rounded-xl border border-slate-300/60 shadow-inner">
											{TABS.map((tab) => {
												const on = activeTab === tab.key;
												return (
													<button
														key={tab.key}
														type="button"
														role="tab"
														aria-selected={on}
														onClick={() => setActiveTab(tab.key)}
														className={`bricolage-grotesque text-sm sm:text-base font-bold px-5 py-2 rounded-lg cursor-pointer transition-all ${focusRing} ${
															on
																? "bg-slate-900 text-white shadow-sm"
																: "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
														}`}
													>
														{tab.label}
													</button>
												);
											})}
										</div>
									</div>
								)}

								<div>
									{sections.map((cat) => (
										<section
											key={cat.id}
											id={cat.id}
											aria-labelledby={`${cat.id}-title`}
											className="border-t border-slate-200 pt-7 pb-9 first:border-t-0 first:pt-0"
										>
											{!roleKey && isSearching && (
												<span className="bricolage-grotesque inline-block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
													{AUDIENCE_LABEL[cat.audience]}
												</span>
											)}
											<h2
												id={`${cat.id}-title`}
												className="font-mackinac text-2xl font-bold text-slate-950 tracking-tight"
											>
												{cat.category}
											</h2>
											<p className="bricolage-grotesque mt-1 mb-4 text-sm text-slate-600">
												{cat.blurb}
											</p>
											<ul className="space-y-1 -mx-2">
												{cat.questions.map((item) => {
													const key = `${cat.id}:${item.q}`;
													const on = active?.key === key;
													const panelId = `${cat.id}-${cat.questions.indexOf(item)}-panel`;
													return (
														<li key={key}>
															<button
																type="button"
																onClick={() => setSelectedKey(key)}
																aria-expanded={on}
																aria-controls={panelId}
																className={`bricolage-grotesque w-full text-left rounded-xl px-3.5 py-3 text-[15px] sm:text-base leading-snug transition-all cursor-pointer flex items-center justify-between gap-3 ${focusRing} ${
																	on
																		? "bg-violet-950 text-white font-semibold shadow-md"
																		: "text-slate-800 font-medium hover:bg-violet-50 hover:text-violet-950"
																}`}
															>
																<span className="flex-1">
																	<Highlight text={item.q} terms={terms} />
																</span>
																<ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${on ? "text-violet-300 rotate-90 lg:rotate-0" : "text-slate-400"}`} />
															</button>
															{/* On small screens the answer opens right under its question */}
															<AnimatePresence initial={false}>
																{on && (
																	<motion.div
																		id={panelId}
																		role="region"
																		aria-label={item.q}
																		initial={{ height: 0, opacity: 0 }}
																		animate={{ height: "auto", opacity: 1 }}
																		exit={{ height: 0, opacity: 0 }}
																		transition={{ duration: 0.2 }}
																		className="overflow-hidden lg:hidden"
																	>
																		<div className="px-3.5 pt-3 pb-5">
																			<p className="bricolage-grotesque text-slate-700 text-base leading-relaxed">
																				<Highlight
																					text={item.a}
																					terms={terms}
																				/>
																			</p>
																			<AnswerActions
																				action={ACTIONS[cat.id]}
																				onKyc={handleKycClick}
																				onTicket={handleOpenTicket}
																			/>
																		</div>
																	</motion.div>
																)}
															</AnimatePresence>
														</li>
													);
												})}
											</ul>
										</section>
									))}
								</div>
							</div>

							{/* Reading pane (desktop) */}
							<div className="hidden lg:block lg:sticky lg:top-28 lg:self-start bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xl shadow-slate-900/[0.04] ring-1 ring-slate-900/5 min-h-[22rem]">
								<AnimatePresence mode="wait" initial={false}>
									{active && (
										<motion.div
											key={active.key}
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0 }}
											transition={{ duration: 0.18 }}
										>
											<span className="bricolage-grotesque inline-block text-xs font-bold uppercase tracking-wider text-violet-800 bg-violet-50 px-3 py-1 rounded-full border border-violet-200/70 mb-4">
												{active.cat.category}
											</span>
											<h2 className="font-mackinac mt-2 max-w-xl text-3xl xl:text-4xl font-extrabold tracking-tight leading-[1.18] text-slate-950">
												<Highlight text={active.item.q} terms={terms} />
											</h2>
											<p className="bricolage-grotesque mt-6 max-w-[60ch] text-lg leading-[1.8] text-slate-700 font-normal">
												<Highlight text={active.item.a} terms={terms} />
											</p>
											<AnswerActions
												action={ACTIONS[active.cat.id]}
												onKyc={handleKycClick}
												onTicket={handleOpenTicket}
											/>
										</motion.div>
									)}
								</AnimatePresence>
							</div>
						</div>
					)}

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
	const className = `group block w-full px-6 py-3.5 text-left transition-colors hover:bg-violet-50/70 cursor-pointer ${rowFocusRing}`;

	const content = (
		<>
			<span className="flex items-baseline gap-3">
				<span className="bricolage-grotesque font-semibold text-slate-900 group-hover:text-violet-700 transition-colors text-[15px]">
					{link.title}
				</span>
				<span
					aria-hidden="true"
					className="flex-1 border-b border-dotted border-slate-300 group-hover:border-violet-300 transition-colors"
				/>
				{link.status ? (
					<span
						className={`bricolage-grotesque text-xs font-bold px-2.5 py-0.5 rounded-full ${STATUS_BADGE[link.status.tone] || "text-slate-700"}`}
					>
						{link.status.label}
					</span>
				) : link.shortcut ? (
					<kbd className="bricolage-grotesque hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-600 bg-slate-100 border border-slate-300 rounded">
						{link.shortcut}
					</kbd>
				) : null}
			</span>
			<span className="bricolage-grotesque block mt-0.5 text-xs sm:text-sm text-slate-600 group-hover:text-slate-800">{link.sub}</span>
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

const AnswerActions = ({ action, onKyc, onTicket }) => {
	const btn = `bricolage-grotesque inline-flex items-center rounded-xl bg-violet-950 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-violet-900 shadow-sm hover:shadow active:scale-[0.98] cursor-pointer ${focusRing}`;

	return (
		<div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 pt-4 border-t border-slate-100">
			{action?.to && (
				<Link to={action.to} className={btn}>
					{action.label}
				</Link>
			)}
			{action?.kyc && (
				<button type="button" onClick={onKyc} className={btn}>
					{action.label}
				</button>
			)}
			{action?.ticket && (
				<button
					type="button"
					onClick={() => onTicket(action.ticket)}
					className={btn}
				>
					{action.label}
				</button>
			)}
			<button
				type="button"
				onClick={() => onTicket("general")}
				className={`bricolage-grotesque text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-violet-700 hover:decoration-violet-600 cursor-pointer rounded ${focusRing}`}
			>
				Not what you needed? Open a ticket
			</button>
		</div>
	);
};

export default HelpCenter;
