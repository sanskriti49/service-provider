import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, LogOut, Info, X } from "lucide-react";

export default function ConfirmDialog({
	isOpen,
	onClose,
	onConfirm,
	title = "Confirm action?",
	description = "This action cannot be undone.",
	confirmText = "Confirm",
	cancelText = "Cancel",
	variant = "danger", // "danger" | "warning" | "default"
	icon: CustomIcon,
	loading = false,
}) {
	// Close on Escape key
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape" && isOpen && !loading) {
				onClose?.();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, loading, onClose]);

	// Prevent background scrolling when open
	useEffect(() => {
		if (isOpen) {
			const originalOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = originalOverflow;
			};
		}
	}, [isOpen]);

	if (typeof document === "undefined") return null;

	const getIcon = () => {
		if (CustomIcon) return <CustomIcon size={20} />;
		if (variant === "danger") return <Trash2 size={20} />;
		if (variant === "warning") return <AlertTriangle size={20} />;
		return <Info size={20} />;
	};

	const getIconContainerStyle = () => {
		switch (variant) {
			case "danger":
				return "bg-rose-500/10 text-rose-400 border-rose-500/20";
			case "warning":
				return "bg-amber-500/10 text-amber-400 border-amber-500/20";
			default:
				return "bg-violet-500/10 text-violet-300 border-violet-500/20";
		}
	};

	const getConfirmButtonStyle = () => {
		switch (variant) {
			case "danger":
				return "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40";
			case "warning":
				return "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40";
			default:
				return "bg-violet-600 hover:bg-violet-500 text-white shadow-violet-950/40";
		}
	};

	return createPortal(
		<AnimatePresence>
			{isOpen && (
				<div
					className="fixed inset-0 z-[9999] flex items-center justify-center p-4 antialiased"
					role="dialog"
					aria-modal="true"
					aria-labelledby="confirm-dialog-title"
				>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						onClick={!loading ? onClose : undefined}
						className="fixed inset-0 bg-black/75 backdrop-blur-xs"
					/>

					{/* Dialog Card */}
					<motion.div
						initial={{ opacity: 0, scale: 0.96, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 8 }}
						transition={{ duration: 0.15, ease: "easeOut" }}
						className="relative w-full max-w-[420px] rounded-2xl bg-[#120a22] border border-white/[0.1] shadow-2xl shadow-black/80 overflow-hidden text-slate-100"
					>
						<div className="p-5 sm:p-6 space-y-4">
							{/* Header Row */}
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-3">
									<div
										className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${getIconContainerStyle()}`}
									>
										{getIcon()}
									</div>
									<div>
										<h3
											id="confirm-dialog-title"
											className="text-base font-bold text-white tracking-tight leading-snug"
										>
											{title}
										</h3>
									</div>
								</div>

								<button
									type="button"
									onClick={onClose}
									disabled={loading}
									className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-40"
									aria-label="Close dialog"
								>
									<X size={16} />
								</button>
							</div>

							{/* Description */}
							<p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-0.5">
								{description}
							</p>

							{/* Actions Row */}
							<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
								<button
									type="button"
									onClick={onClose}
									disabled={loading}
									className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer disabled:opacity-40"
								>
									{cancelText}
								</button>
								<button
									type="button"
									onClick={onConfirm}
									disabled={loading}
									className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 min-w-[90px] ${getConfirmButtonStyle()}`}
								>
									{loading ? (
										<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									) : (
										confirmText
									)}
								</button>
							</div>
						</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>,
		document.body,
	);
}
