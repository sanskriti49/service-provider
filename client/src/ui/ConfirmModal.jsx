import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, X } from "lucide-react";

export default function ConfirmModal({
	isOpen,
	onClose,
	onConfirm,
	title,
	message,
	loading,
}) {
	return createPortal(
		<AnimatePresence>
			{isOpen && (
				<div className="bricolage-grotesque fixed inset-0 z-[9999] flex items-center justify-center p-4">
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm"
					/>

					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
					>
						<div className="p-8">
							<div className="flex justify-between items-start mb-6">
								<div className="p-3 bg-red-50 rounded-2xl text-red-600 ring-1 ring-red-100">
									<AlertCircle size={28} />
								</div>
								<button
									onClick={onClose}
									className="cursor-pointer p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors"
								>
									<X size={20} />
								</button>
							</div>

							<h3 className="text-[23px] font-extrabold text-gray-900 bricolage-grotesque">
								{title}
							</h3>
							<p className="text-[15px] text-gray-500 mt-3 leading-relaxed">
								{message}
							</p>

							<div className="flex gap-3 mt-8">
								<button
									onClick={onClose}
									className="cursor-pointer flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-50 border border-gray-100 rounded-2xl hover:bg-gray-100 transition-all active:scale-95 duration-300"
								>
									No, Keep it
								</button>
								<button
									onClick={onConfirm}
									disabled={loading}
									className="cursor-pointer flex-1 px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-2xl hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center duration-300"
								>
									{loading ? (
										<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									) : (
										"Yes, Cancel"
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
