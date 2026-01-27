import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { jwtDecode } from "jwt-decode";
import { Link } from "react-router-dom"; // Added Link
import {
	Search,
	MessageCircle,
	Mail,
	ChevronDown,
	Shield,
	CreditCard,
	Briefcase,
	User,
	IndianRupee,
} from "lucide-react";

// --- COMPONENT: Retro Perspective Grid ---
const RetroGrid = () => {
	return (
		<div className="absolute top-0 inset-x-0 h-[600px] overflow-hidden pointer-events-none select-none z-0">
			<div className="absolute inset-0 bg-gradient-to-b from-violet-50/80 via-white/50 to-white" />
			<div className="absolute inset-0 [perspective:1000px] [transform-style:preserve-3d]">
				<div
					className="absolute inset-0 h-[200%] w-full origin-top"
					style={{
						backgroundImage: `
              linear-gradient(to right, rgba(139, 92, 246, 0.15) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(139, 92, 246, 0.15) 1px, transparent 1px)
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
			<div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[300px] bg-violet-500/10 blur-[120px] rounded-full mix-blend-multiply" />
		</div>
	);
};

// Updated with real routes noticed in your App.js
const quickLinksData = {
	common: [
		{
			title: "Settings",
			icon: <User className="w-5 h-5 text-violet-600" />,
			color: "bg-violet-50",
			to: "/settings",
		},
		{
			title: "Support Ticket",
			icon: <CreditCard className="w-5 h-5 text-rose-600" />,
			color: "bg-rose-50",
			to: "/#contact",
		},
	],
	customer: [
		{
			title: "My Bookings",
			icon: <Search className="w-5 h-5 text-blue-600" />,
			color: "bg-blue-50",
			to: "/dashboard/bookings",
		},
	],
	provider: [
		{
			title: "KYC Verification",
			icon: <Shield className="w-5 h-5 text-emerald-600" />,
			color: "bg-emerald-50",
			to: "/provider/dashboard", // KYC usually lives in provider dashboard
		},
	],
};

const allFaqs = {
	customer: [
		{
			category: "Payments & Refunds",
			icon: <IndianRupee className="w-6 h-6 text-rose-600" />,
			bg: "bg-rose-100",
			questions: [
				{
					q: "What payment methods do you accept?",
					a: "We accept all major Indian payment methods including UPI, Credit/Debit Cards, and Net Banking.",
				},
				{
					q: "How do refunds work?",
					a: "Refunds are processed within 5-7 business days to the original payment source.",
				},
			],
		},
		{
			category: "Safety & Trust",
			icon: <Shield className="w-6 h-6 text-emerald-600" />,
			bg: "bg-emerald-100",
			questions: [
				{
					q: "Are professionals verified?",
					a: "Yes, every professional undergoes Aadhaar-based KYC.",
				},
			],
		},
	],
	provider: [
		{
			category: "Earnings & Payouts",
			icon: <Briefcase className="w-6 h-6 text-amber-600" />,
			bg: "bg-amber-100",
			questions: [
				{
					q: "When do I get paid?",
					a: "Payouts are processed every Wednesday via NEFT/IMPS.",
				},
			],
		},
		{
			category: "Onboarding & KYC",
			icon: <User className="w-6 h-6 text-blue-600" />,
			bg: "bg-blue-100",
			questions: [
				{
					q: "What documents are required?",
					a: "You need a valid Aadhaar Card, PAN Card, and bank details.",
				},
			],
		},
	],
};

const HelpCenter = () => {
	const [activeTab, setActiveTab] = useState("customer");
	const [searchQuery, setSearchQuery] = useState("");
	const [userRole, setUserRole] = useState(null);

	const currentHour = new Date().getHours();
	const isSupportOnline = currentHour >= 9 && currentHour < 23;

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (token) {
			try {
				const decoded = jwtDecode(token);
				if (decoded.role) {
					setUserRole(decoded.role);
					setActiveTab(decoded.role);
				}
			} catch (e) {
				console.error("Auth error", e);
			}
		}
	}, []);

	const visibleQuickLinks = useMemo(() => {
		if (userRole === "customer")
			return [...quickLinksData.customer, ...quickLinksData.common];
		if (userRole === "provider")
			return [...quickLinksData.provider, ...quickLinksData.common];
		return [
			...quickLinksData.customer,
			...quickLinksData.provider,
			...quickLinksData.common,
		];
	}, [userRole]);

	const filteredFaqs = useMemo(() => {
		let pool = userRole
			? allFaqs[userRole]
			: searchQuery
				? [...allFaqs.customer, ...allFaqs.provider]
				: allFaqs[activeTab];
		if (!searchQuery) return pool;
		const q = searchQuery.toLowerCase();
		return pool
			.map((cat) => ({
				...cat,
				questions: cat.questions.filter(
					(item) =>
						item.q.toLowerCase().includes(q) ||
						item.a.toLowerCase().includes(q),
				),
			}))
			.filter(
				(cat) =>
					cat.questions.length > 0 || cat.category.toLowerCase().includes(q),
			);
	}, [activeTab, searchQuery, userRole]);

	const leftColumnFaqs = filteredFaqs.filter((_, i) => i % 2 === 0);
	const rightColumnFaqs = filteredFaqs.filter((_, i) => i % 2 !== 0);

	return (
		<div className="relative min-h-screen bg-white text-slate-900 selection:bg-violet-600 pt-8">
			<RetroGrid />
			<div className="max-w-5xl mx-auto px-4 pt-20 pb-20 relative z-10">
				{/* --- HERO --- */}
				<div className="text-center mb-10">
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className={`inline-flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-sm border shadow-sm mb-6 ${isSupportOnline ? "bg-white/80 border-violet-100" : "bg-slate-50/80 border-slate-200"}`}
					>
						<span className="relative flex h-2 w-2">
							{isSupportOnline && (
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
							)}
							<span
								className={`relative inline-flex rounded-full h-2 w-2 ${isSupportOnline ? "bg-emerald-500" : "bg-slate-400"}`}
							></span>
						</span>
						<span
							className={`font-mono text-xs font-semibold uppercase tracking-wide ${isSupportOnline ? "text-violet-700" : "text-slate-500"}`}
						>
							{isSupportOnline ? "Support Online" : "Support Offline"}
						</span>
					</motion.div>

					<h1
						className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6"
						style={{ fontFamily: "P22Mackinac, serif" }}
					>
						Welcome, how can we{" "}
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
							help?
						</span>
					</h1>

					<div className="relative max-w-2xl mx-auto">
						<div className="relative flex items-center bg-white shadow-xl shadow-slate-200/50 rounded-2xl p-2 border border-slate-100">
							<div className="pl-4 text-slate-400">
								<Search className="w-6 h-6" />
							</div>
							<input
								type="text"
								placeholder={
									userRole
										? `Search help for ${userRole}s...`
										: "Search 'refund', 'invoice', 'KYC'..."
								}
								className="inter w-full p-4 bg-transparent text-lg outline-none placeholder:text-slate-400 text-slate-800"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
					</div>
				</div>

				{!searchQuery && (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
						{/* FIX: Dynamic grid column count based on links available */}
						<div
							className={`grid gap-4 mb-16 ${visibleQuickLinks.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}
						>
							{visibleQuickLinks.map((link, idx) => (
								<Link to={link.to} key={idx}>
									<motion.div
										whileHover={{ y: -4 }}
										className="mackinac cursor-pointer flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all group h-full text-center"
									>
										<div
											className={`p-4 rounded-2xl ${link.color} group-hover:scale-110 transition-transform duration-300`}
										>
											{link.icon}
										</div>
										<span className="font-semibold text-slate-700">
											{link.title}
										</span>
									</motion.div>
								</Link>
							))}
						</div>

						{!userRole && (
							<div className="flex justify-center mb-12">
								<div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl inline-flex border border-slate-200/50 shadow-sm">
									{["customer", "provider"].map((tab) => (
										<button
											key={tab}
											onClick={() => setActiveTab(tab)}
											className={`inter px-8 py-3 rounded-xl text-sm font-medium transition-all relative z-10 ${activeTab === tab ? "text-violet-900" : "text-slate-500 hover:text-slate-700"}`}
										>
											{activeTab === tab && (
												<motion.div
													layoutId="tab-bg"
													className="absolute inset-0 bg-white shadow-md rounded-xl border border-slate-100"
												/>
											)}
											<span className="inter relative z-20 capitalize flex items-center gap-2">
												{tab === "customer" ? (
													<User size={14} />
												) : (
													<Briefcase size={14} />
												)}{" "}
												{tab}
											</span>
										</button>
									))}
								</div>
							</div>
						)}
					</motion.div>
				)}

				{/* FAQ Results */}
				<div className="flex flex-col md:flex-row gap-8 mb-24 items-start">
					<div className="flex-1 flex flex-col gap-8 w-full">
						{leftColumnFaqs.map((cat, idx) => (
							<FaqCategoryCard key={idx} category={cat} />
						))}
					</div>
					<div className="flex-1 flex flex-col gap-8 w-full">
						{rightColumnFaqs.map((cat, idx) => (
							<FaqCategoryCard key={idx} category={cat} />
						))}
					</div>
				</div>

				{/* --- HUMAN SUPPORT --- */}
				<div className="mackinac bg-slate-900 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden text-center md:text-left shadow-2xl">
					<div className="absolute top-0 right-0 w-64 h-64 bg-violet-600 rounded-full blur-[80px] opacity-20" />
					<div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
						<div>
							<h3 className="text-3xl font-bold text-white mb-4">
								Still stuck?
							</h3>
							<p className="bricolage-grotesque text-slate-400 text-lg mb-8 max-w-md">
								Our support team typically replies in under 2 minutes.
							</p>
							<div className="flex flex-col sm:flex-row gap-4">
								<a
									href="https://wa.me/916306642481"
									target="_blank"
									className="flex items-center justify-center gap-2 bg-white text-slate-900 px-8 py-4 rounded-xl font-bold hover:bg-violet-100 transition-all"
								>
									<MessageCircle className="w-5 h-5" /> WhatsApp
								</a>
								<a
									href="mailto:sanskriti0409@gmail.com"
									className="flex items-center justify-center gap-2 bg-slate-800 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-700 transition-all"
								>
									<Mail className="w-5 h-5" /> Email
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

const FaqCategoryCard = ({ category }) => (
	<div className="bg-white mackinac rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden h-fit">
		<div className="p-8 border-b border-slate-50 bg-gradient-to-r from-slate-50/50 to-transparent flex items-center gap-4">
			<div className={`p-3 rounded-2xl ${category.bg}`}>{category.icon}</div>
			<h3 className="text-xl font-bold text-slate-900">{category.category}</h3>
		</div>
		<div className="divide-y divide-slate-50">
			{category.questions.map((q, idx) => (
				<AccordionItem key={idx} question={q.q} answer={q.a} />
			))}
		</div>
	</div>
);

const AccordionItem = ({ question, answer }) => {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<div
			className={`bg-white transition-colors duration-300 ${isOpen ? "bg-violet-50/10" : ""}`}
		>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between text-left p-6 hover:bg-slate-50/50 group"
			>
				<span
					className={`mackinac font-semibold text-lg transition-colors ${isOpen ? "text-violet-700" : "text-slate-700 group-hover:text-slate-900"}`}
				>
					{question}
				</span>
				<ChevronDown
					className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180 text-violet-600" : "text-slate-400"}`}
				/>
			</button>
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="overflow-hidden"
					>
						<div className="bricolage-grotesque px-6 pb-6 text-slate-500 leading-relaxed italic">
							{answer}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default HelpCenter;
