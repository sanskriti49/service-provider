import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Mail, Copy, Check, CheckCircle2 } from "lucide-react";

const WHATSAPP_DIGITS = "916306642481";
const WHATSAPP_DISPLAY = "+91 63066 42481";

// Only uses ticket categories your page already passes around ("booking", "kyc", "general").
// Add more here if SupportTicketModal supports them (e.g. "payment", "payout").
const TOPICS = {
	customer: [
		{ label: "Booking or reschedule", category: "booking" },
		{ label: "Refund or payment", category: "booking" },
		{ label: "Something else", category: "general" },
	],
	provider: [
		{ label: "KYC verification", category: "kyc" },
		{ label: "Payout or dispute", category: "booking" },
		{ label: "Something else", category: "general" },
	],
};

const HANDY = {
	customer: [
		"Booking ID (from My Bookings)",
		"Photos of the issue, if there are any",
		"The phone number on your account",
	],
	provider: [
		"Booking ID, if it's about a job",
		"Your name as it appears on your KYC document",
		"The phone number on your account",
	],
};

const focusRing =
	"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300";

const SupportBanner = ({ isSupportOnline, userRole, onOpenTicket }) => {
	const [copied, setCopied] = useState(false);
	const timer = useRef(null);

	const roleKey = userRole === "provider" ? "provider" : "customer";
	const defaultCategory = userRole === "provider" ? "kyc" : "booking";

	useEffect(() => () => clearTimeout(timer.current), []);

	const copyNumber = async () => {
		try {
			await navigator.clipboard.writeText(`+${WHATSAPP_DIGITS}`);
			setCopied(true);
			clearTimeout(timer.current);
			timer.current = setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard blocked (older browsers / insecure context): the number is still visible to copy by hand.
		}
	};

	return (
		<section
			aria-labelledby="support-heading"
			className="mackinac bg-slate-900 text-white rounded-3xl overflow-hidden shadow-xl shadow-slate-900/10 grid lg:grid-cols-[1.35fr_1fr]"
		>
			{/* Left: message, topics, actions */}
			<div className="p-8 md:p-12">
				<p className="flex items-center gap-2.5 text-sm font-medium text-slate-300 mb-6">
					<span
						aria-hidden="true"
						className={`w-2 h-2 rounded-full shrink-0 ${
							isSupportOnline ? "bg-emerald-400" : "bg-slate-500"
						}`}
					/>
					{isSupportOnline
						? "Support desk is open until 11 PM"
						: "Support desk is closed. It opens at 9 AM"}
				</p>

				<h3
					id="support-heading"
					className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4"
				>
					Didn't find your answer?
					<br className="hidden sm:block" /> Talk to a person.
				</h3>

				<p className="bricolage-grotesque text-slate-300 text-base sm:text-lg leading-relaxed max-w-md mb-8">
					Our team replies every day from 9 AM to 11 PM. Messages sent after
					hours are queued and answered first thing in the morning.
				</p>

				<div className="mb-8">
					<p className="text-sm font-semibold text-slate-200 mb-3">
						Start a ticket about
					</p>
					<div className="flex flex-wrap gap-2">
						{TOPICS[roleKey].map((t) => (
							<button
								key={t.label}
								type="button"
								onClick={() => onOpenTicket(t.category)}
								className={`bricolage-grotesque cursor-pointer px-4 py-2 rounded-full border border-white/20 text-sm text-slate-100 hover:bg-white/10 hover:border-white/40 transition-colors ${focusRing}`}
							>
								{t.label}
							</button>
						))}
					</div>
				</div>

				<div className="flex flex-wrap gap-3">
					<a
						href={`https://wa.me/${WHATSAPP_DIGITS}`}
						target="_blank"
						rel="noreferrer"
						className={`flex items-center gap-2 bg-white text-slate-900 px-5 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors active:scale-[0.98] ${focusRing}`}
					>
						<MessageCircle className="w-5 h-5 text-emerald-600" />
						Chat on WhatsApp
					</a>

					<button
						type="button"
						onClick={() => onOpenTicket(defaultCategory)}
						className={`flex items-center gap-2 bg-violet-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-violet-500 transition-colors active:scale-[0.98] cursor-pointer ${focusRing}`}
					>
						<Mail className="w-5 h-5" />
						Open a ticket
						<kbd className="hidden sm:inline ml-1 text-[11px] font-mono text-violet-100 bg-violet-700/70 border border-violet-400/40 px-1.5 rounded">
							T
						</kbd>
					</button>
				</div>
			</div>

			{/* Right: what to expect, what to have ready */}
			<div className="bg-white/[0.04] border-t lg:border-t-0 lg:border-l border-white/10 p-8 md:p-10 flex flex-col gap-8">
				<div>
					<h4 className="text-sm font-semibold text-slate-200 mb-3">
						When you'll hear back
					</h4>
					<dl className="divide-y divide-white/10 border-y border-white/10 text-sm">
						<div className="flex items-baseline justify-between gap-4 py-3">
							<dt className="text-slate-300">WhatsApp</dt>
							<dd className="font-semibold text-white">
								{isSupportOnline ? "Under 1 hour" : "After 9 AM"}
							</dd>
						</div>
						<div className="flex items-baseline justify-between gap-4 py-3">
							<dt className="text-slate-300">Support ticket</dt>
							<dd className="font-semibold text-white text-right">
								{isSupportOnline ? "2 to 4 hours" : "2 to 4 hours after 9 AM"}
							</dd>
						</div>
					</dl>
					<p className="bricolage-grotesque text-xs text-slate-400 leading-relaxed mt-3">
						Every ticket gets a tracking number, and you're notified each time
						its status changes.
					</p>
				</div>

				<div>
					<h4 className="text-sm font-semibold text-slate-200 mb-3">
						Have these ready to get a faster answer
					</h4>
					<ul className="space-y-2.5">
						{HANDY[roleKey].map((item) => (
							<li
								key={item}
								className="bricolage-grotesque flex items-start gap-2.5 text-sm text-slate-300"
							>
								<CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
								{item}
							</li>
						))}
					</ul>
				</div>

				<div className="mt-auto flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
					<div className="min-w-0">
						<p className="text-xs text-slate-400">WhatsApp number</p>
						<p className="text-sm font-semibold text-white tabular-nums">
							{WHATSAPP_DISPLAY}
						</p>
					</div>
					<button
						type="button"
						onClick={copyNumber}
						aria-label="Copy WhatsApp number"
						className={`flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${focusRing}`}
					>
						{copied ? (
							<Check className="w-4 h-4 text-emerald-400" />
						) : (
							<Copy className="w-4 h-4" />
						)}
						<span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
					</button>
				</div>
			</div>
		</section>
	);
};

export default SupportBanner;

/*
  USAGE in HelpCenter.jsx

  1. Add to the lucide-react import: Copy, Check   (Sparkles is no longer needed here)
  2. Import:  import SupportBanner from "./SupportBanner";   // or paste the component into the same file
  3. Replace the whole <div className="mackinac bg-slate-900 ..."> block with:

     <SupportBanner
       isSupportOnline={isSupportOnline}
       userRole={userRole}
       onOpenTicket={handleOpenTicket}
     />
*/
