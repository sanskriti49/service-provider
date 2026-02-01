import { motion } from "framer-motion";

export default function PaymentOptions({
	method,
	currentMethod,
	setMethod,
	title,
	subtitle,
	icon: Icon,
}) {
	const isActive = currentMethod === method;

	return (
		<button
			onClick={() => setMethod(method)}
			className="inter relative group outline-none w-full"
		>
			{/* Animated Glow Backdrop */}
			{isActive && (
				<motion.div
					layoutId="payment-glow"
					className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl blur opacity-30"
				/>
			)}

			<div
				className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 overflow-hidden
                ${
									isActive
										? "bg-[#2d2265] border-violet-500/50 shadow-xl"
										: "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.08]"
								}`}
			>
				{/* Subtle Shine Effect */}
				<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

				{/* Icon Container - Now on the Left */}
				<div
					className={`flex-shrink-0 p-3 rounded-xl transition-colors duration-300 ${
						isActive
							? "bg-violet-600 text-white shadow-lg shadow-violet-900/20"
							: "bg-white/10 text-gray-400"
					}`}
				>
					<Icon size={22} />
				</div>

				{/* Text Content - Now Aligned Left */}
				<div className="flex flex-col items-start flex-grow">
					<span
						className={`text-[15px] font-bold tracking-tight transition-colors duration-300 ${
							isActive ? "text-white" : "text-gray-200"
						}`}
					>
						{title}
					</span>
					<span className="text-[11px] font-medium uppercase tracking-wider opacity-60 text-gray-400">
						{subtitle}
					</span>
				</div>

				{/* Selected Indicator - Moved to the Right End */}
				<div
					className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
						isActive
							? "bg-violet-600 border-violet-400 scale-110"
							: "border-white/10 scale-100"
					}`}
				>
					{isActive && (
						<motion.div
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							className="w-2 h-2 bg-white rounded-full shadow-sm"
						/>
					)}
				</div>
			</div>
		</button>
	);
}
