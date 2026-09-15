import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, Zap } from "lucide-react";

void motion;

const LOADING_STEPS = [
	"Connecting verified experts...",
	"Verifying real-time availability...",
	"Tailoring the best service rates...",
	"Readying your TaskGenie experience...",
];

export default function TaskGenieLoader({
	fullScreen = true,
	message,
	submessage,
	className = "",
}) {
	const [stepIndex, setStepIndex] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			setStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
		}, 1400);
		return () => clearInterval(interval);
	}, []);

	const containerClasses = fullScreen
		? "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#090514]/95 backdrop-blur-2xl overflow-hidden select-none"
		: `relative min-h-[75vh] w-full flex flex-col items-center justify-center bg-[#090514]/80 backdrop-blur-md overflow-hidden select-none ${className}`;

	return (
		<AnimatePresence>
			<motion.div
				key="taskgenie-loader-overlay"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.35, ease: "easeInOut" }}
				className={containerClasses}
			>
				{/* Background ambient lighting glows */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/15 rounded-full blur-[120px] pointer-events-none animate-pulse" />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-fuchsia-600/10 rounded-full blur-[100px] pointer-events-none" />

				{/* Central Orbital Gyroscope Container */}
				<div className="relative flex items-center justify-center w-36 h-36 mb-8">
					{/* Outer Conic Gradient Spinning Ring */}
					<div className="absolute inset-0 rounded-full border border-violet-500/20" />
					<motion.div
						animate={{ rotate: 360 }}
						transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
						className="absolute inset-0 rounded-full p-[2px] bg-gradient-to-tr from-transparent via-violet-500 to-fuchsia-500"
						style={{
							WebkitMask:
								"radial-gradient(farthest-side, transparent calc(100% - 2.5px), #fff calc(100% - 2px))",
							mask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #fff calc(100% - 2px))",
						}}
					/>

					{/* Middle Reverse-Spinning Ring with Orbital Dots */}
					<motion.div
						animate={{ rotate: -360 }}
						transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
						className="absolute inset-3 rounded-full border border-dashed border-violet-400/40"
					>
						<span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-fuchsia-400 shadow-[0_0_12px_#d946ef]" />
						<span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_10px_#8b5cf6]" />
					</motion.div>

					{/* Inner Pulsing Hexagonal/Circle Core */}
					<motion.div
						animate={{
							scale: [1, 1.08, 1],
							boxShadow: [
								"0 0 20px rgba(139, 92, 246, 0.3)",
								"0 0 40px rgba(217, 70, 239, 0.5)",
								"0 0 20px rgba(139, 92, 246, 0.3)",
							],
						}}
						transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
						className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1a103c] via-[#24134a] to-[#120826] border border-violet-400/40 flex items-center justify-center shadow-xl"
					>
						<motion.div
							animate={{ rotate: [0, 15, -15, 0] }}
							transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
						>
							<Sparkles className="w-9 h-9 text-violet-300 drop-shadow-[0_0_12px_rgba(167,139,250,0.8)]" />
						</motion.div>
					</motion.div>
				</div>

				{/* Brand Title with Shimmer Gradient */}
				<div className="flex flex-col items-center text-center px-4 max-w-sm">
					<h3 className="bricolage-grotesque text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-fuchsia-300">
						TaskGenie
					</h3>

					{/* Dynamic Step Text */}
					<motion.div
						key={stepIndex}
						initial={{ opacity: 0, y: 5 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -5 }}
						transition={{ duration: 0.3 }}
						className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-950/60 border border-violet-500/30 text-violet-200/90 text-xs font-medium backdrop-blur-sm shadow-inner"
					>
						<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
						<span className="inter">
							{message || LOADING_STEPS[stepIndex]}
						</span>
					</motion.div>

					{submessage && (
						<p className="inter text-slate-400 text-xs mt-2 max-w-xs leading-relaxed">
							{submessage}
						</p>
					)}

					{/* Features Micro Badges */}
					<div className="flex items-center gap-4 mt-6 text-[11px] text-slate-400 font-medium">
						<div className="flex items-center gap-1 text-slate-300">
							<ShieldCheck size={13} className="text-violet-400" />
							<span>Verified Pros</span>
						</div>
						<span className="w-1 h-1 rounded-full bg-slate-700" />
						<div className="flex items-center gap-1 text-slate-300">
							<Zap size={13} className="text-fuchsia-400" />
							<span>Instant Booking</span>
						</div>
					</div>
				</div>
			</motion.div>
		</AnimatePresence>
	);
}
