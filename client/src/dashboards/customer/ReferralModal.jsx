import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
	Share2,
	Copy,
	Check,
	Gift,
	Users,
	Sparkles,
	X,
	MessageCircle,
	ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useModal } from "../../hooks/useModal";

export default function ReferralModal({ isOpen, onClose, user }) {
	const [copiedCode, setCopiedCode] = useState(false);
	const [copiedLink, setCopiedLink] = useState(false);

	useModal({
		isOpen,
		onClose,
		id: "referral-modal",
		lockScroll: true,
	});

	// Derive a clean, memorable referral code from user's custom_id or ID
	const referralCode =
		user?.custom_id
			? `GENIE-${user.custom_id.replace(/^CUST-?/i, "").toUpperCase()}`
			: user?.id
				? `GENIE-${user.id.slice(0, 6).toUpperCase()}`
				: "GENIE-FRIEND";

	const origin = typeof window !== "undefined" ? window.location.origin : "https://taskgenie.in";
	const referralLink = `${origin}/sign-up?ref=${encodeURIComponent(referralCode)}`;

	const handleCopyCode = async () => {
		try {
			await navigator.clipboard.writeText(referralCode);
			setCopiedCode(true);
			toast.success("Referral code copied to clipboard!");
			setTimeout(() => setCopiedCode(false), 2000);
		} catch {
			toast.error("Failed to copy. Please select and copy manually.");
		}
	};

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(referralLink);
			setCopiedLink(true);
			toast.success("Invite link copied to clipboard!");
			setTimeout(() => setCopiedLink(false), 2000);
		} catch {
			toast.error("Failed to copy. Please select and copy manually.");
		}
	};

	const handleNativeShare = async () => {
		const shareData = {
			title: "Get ₹150 off home services on TaskGenie!",
			text: `Use my invite code ${referralCode} to get ₹150 off your first expert home service on TaskGenie!`,
			url: referralLink,
		};

		if (navigator.share) {
			try {
				await navigator.share(shareData);
				toast.success("Shared successfully!");
			} catch (err) {
				if (err.name !== "AbortError") {
					handleCopyLink();
				}
			}
		} else {
			// Fallback to WhatsApp Web/App
			const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
				`Hey! Use my code *${referralCode}* to get ₹150 off your first home service on TaskGenie! Book here: ${referralLink}`,
			)}`;
			window.open(waUrl, "_blank", "noopener,noreferrer");
		}
	};

	if (typeof document === "undefined") return null;

	return createPortal(
		<AnimatePresence>
			{isOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bricolage-grotesque">
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-[#07050a]/80 backdrop-blur-md"
					/>

					{/* Modal Dialog */}
					<motion.div
						initial={{ opacity: 0, scale: 0.96, y: 14 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 1, y: 0 }}
						transition={{ duration: 0.25, ease: "easeOut" }}
						className="relative w-full max-w-lg bg-[#130f1c] border border-white/[0.12] rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] text-stone-200 overflow-hidden z-10 my-8"
					>
						{/* Ambient Glow */}
						<div
							aria-hidden
							className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 bg-gradient-to-b from-fuchsia-400/20 to-transparent blur-3xl pointer-events-none"
						/>

						{/* Header */}
						<div className="relative px-6 py-5 border-b border-white/[0.08] flex items-center justify-between">
							<div className="flex items-center gap-3">
								<span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-fuchsia-300 flex items-center justify-center border border-fuchsia-500/30">
									<Gift size={18} />
								</span>
								<div>
									<h2 className="font-mackinac text-xl font-bold text-white tracking-tight">
										Refer Friends & Earn
									</h2>
									<p className="text-xs text-stone-400">
										Give ₹150, Get ₹150 for every friend you invite
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={onClose}
								className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/[0.06] transition-colors"
							>
								<X size={18} />
							</button>
						</div>

						{/* Content */}
						<div className="p-6 space-y-6">
							{/* Hero Banner */}
							<div className="relative rounded-2xl bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-amber-500/10 border border-violet-400/20 p-5 overflow-hidden text-center">
								<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-400/15 border border-violet-400/30 text-xs font-semibold text-violet-300 mb-2">
									<Sparkles size={12} />
									TaskGenie Rewards
								</div>
								<h3 className="font-mackinac text-2xl font-bold text-white">
									Both of you save ₹150!
								</h3>
								<p className="mt-1.5 text-xs text-stone-300 max-w-sm mx-auto leading-relaxed">
									Your friend gets ₹150 discount on their first service. When their booking completes, ₹150 is instantly credited to your account!
								</p>
							</div>

							{/* Referral Code Box */}
							<div className="space-y-2">
								<label className="block text-xs font-medium text-stone-400">
									Your Exclusive Invite Code
								</label>
								<div className="flex items-center gap-2">
									<div className="flex-1 h-12 rounded-xl bg-black/40 border border-white/[0.12] px-4 flex items-center justify-between">
										<span className="font-mono text-base font-bold text-amber-300 tracking-wider">
											{referralCode}
										</span>
										<span className="text-[10px] text-stone-500 uppercase tracking-widest font-semibold">
											Active
										</span>
									</div>
									<button
										type="button"
										onClick={handleCopyCode}
										className="h-12 px-4 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shrink-0"
									>
										{copiedCode ? (
											<>
												<Check size={14} className="text-emerald-400" />
												<span className="text-emerald-400">Copied</span>
											</>
										) : (
											<>
												<Copy size={14} />
												<span>Copy Code</span>
											</>
										)}
									</button>
								</div>
							</div>

							{/* Share Link & WhatsApp Buttons */}
							<div className="grid grid-cols-2 gap-3 pt-1">
								<button
									type="button"
									onClick={handleNativeShare}
									className="h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-[0_4px_15px_rgba(16,185,129,0.25)]"
								>
									<MessageCircle size={15} />
									<span>Share via WhatsApp</span>
								</button>
								<button
									type="button"
									onClick={handleCopyLink}
									className="h-11 rounded-xl border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.07] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
								>
									{copiedLink ? (
										<>
											<Check size={15} className="text-emerald-400" />
											<span className="text-emerald-400">Link Copied!</span>
										</>
									) : (
										<>
											<Share2 size={15} />
											<span>Copy Invite Link</span>
										</>
									)}
								</button>
							</div>

							{/* How It Works Steps */}
							<div className="space-y-3 pt-2">
								<h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
									How it works
								</h4>
								<div className="grid grid-cols-3 gap-2.5">
									{[
										{
											step: "1",
											title: "Invite",
											desc: "Send your code or link to friends.",
										},
										{
											step: "2",
											title: "They Book",
											desc: "They get ₹150 off their first booking.",
										},
										{
											step: "3",
											title: "You Earn",
											desc: "₹150 credited to you automatically.",
										},
									].map(({ step, title, desc }) => (
										<div
											key={step}
											className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] text-center"
										>
											<span className="w-5 h-5 rounded-full bg-violet-400/20 text-violet-300 text-[10px] font-bold inline-flex items-center justify-center mb-1.5">
												{step}
											</span>
											<p className="text-xs font-semibold text-white">{title}</p>
											<p className="text-[10px] text-stone-400 mt-0.5 leading-snug">
												{desc}
											</p>
										</div>
									))}
								</div>
							</div>
						</div>

						{/* Footer */}
						<div className="px-6 py-4 border-t border-white/[0.08] bg-black/20 flex items-center justify-between text-xs text-stone-500">
							<span>No limit on how many friends you can invite.</span>
							<button
								type="button"
								onClick={onClose}
								className="text-stone-400 hover:text-white"
							>
								Close
							</button>
						</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>,
		document.body,
	);
}
