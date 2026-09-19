import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Clock, Sparkles } from "lucide-react";

const SOULFUL_MESSAGES = [
	"Finding the right hands for your home...",
	"Matching trusted local craftspeople...",
	"Polishing every detail for your request...",
	"Your wish is almost ready...",
];

// Rising magic ember particles from the lamp spout
const EMBERS = [
	{ id: 1, x: 0, y: -20, size: 4, delay: 0, duration: 2.2 },
	{ id: 2, x: 8, y: -35, size: 3, delay: 0.5, duration: 2.5 },
	{ id: 3, x: -6, y: -45, size: 5, delay: 1.1, duration: 2.0 },
	{ id: 4, x: 12, y: -60, size: 3, delay: 1.6, duration: 2.4 },
	{ id: 5, x: -3, y: -70, size: 4, delay: 0.8, duration: 2.6 },
];

export default function TaskGenieLoader({
	fullScreen = true,
	message,
	submessage,
	className = "",
}) {
	const [stepIndex, setStepIndex] = useState(0);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const interval = setInterval(() => {
			setStepIndex((prev) => (prev + 1) % SOULFUL_MESSAGES.length);
		}, 2000);
		return () => clearInterval(interval);
	}, []);

	const content = (
		<AnimatePresence>
			<motion.div
				key="taskgenie-soulful-loader"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.3, ease: "easeOut" }}
				className={
					fullScreen
						? "fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#090616]/92 backdrop-blur-xl px-4 select-none overflow-hidden"
						: `relative min-h-[55vh] w-full flex flex-col items-center justify-center py-16 px-4 bg-[#090616]/80 backdrop-blur-md rounded-3xl overflow-hidden select-none ${className}`
				}
				style={{ pointerEvents: fullScreen ? "auto" : "default" }}
			>
				{/* Warm atmospheric ambient halos */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-violet-600/15 rounded-full blur-[100px] pointer-events-none" />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none" />

				{/* Central Artisanal Lamp Illustration with Gentle Breathing Levitation */}
				<div className="relative flex items-center justify-center mb-6">
					{/* Soft Golden Halo Pulse behind Lamp */}
					<motion.div
						animate={{
							scale: [0.92, 1.08, 0.92],
							opacity: [0.3, 0.65, 0.3],
						}}
						transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
						className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-amber-500/20 via-violet-500/25 to-amber-300/15 blur-2xl pointer-events-none"
					/>

					{/* The Floating Lamp Vessel */}
					<motion.div
						animate={{
							y: [0, -8, 0],
							rotate: [-0.5, 0.5, -0.5],
						}}
						transition={{
							duration: 3.6,
							repeat: Infinity,
							ease: "easeInOut",
						}}
						className="relative z-10 w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center"
					>
						{/* Real Handcrafted SVG Lamp */}
						<img
							src="/images/taskgenie-logo.svg"
							alt="TaskGenie Magic Lamp"
							className="w-full h-full object-contain filter drop-shadow-[0_10px_25px_rgba(124,58,237,0.35)]"
							loading="eager"
						/>

						{/* Organic Rising Magic Embers from the Lamp Spout */}
						<div className="absolute top-6 right-6 w-12 h-20 pointer-events-none overflow-visible">
							{EMBERS.map((ember) => (
								<motion.span
									key={ember.id}
									initial={{ opacity: 0, y: 0, x: 0, scale: 0.5 }}
									animate={{
										opacity: [0, 0.85, 0.85, 0],
										y: [0, ember.y],
										x: [0, ember.x],
										scale: [0.5, 1, 0.8, 0.3],
									}}
									transition={{
										duration: ember.duration,
										repeat: Infinity,
										delay: ember.delay,
										ease: "easeOut",
									}}
									className="absolute bottom-0 left-1/2 rounded-full bg-gradient-to-t from-amber-400 to-amber-200 shadow-[0_0_8px_#f59e0b]"
									style={{
										width: `${ember.size}px`,
										height: `${ember.size}px`,
									}}
								/>
							))}
						</div>
					</motion.div>
				</div>

				{/* Human-Crafted Brand & Status Messenger */}
				<div className="flex flex-col items-center text-center max-w-sm z-10">
					{/* Brand Wordmark */}
					<h3 className="font-lobster text-2xl sm:text-3xl font-bold select-none leading-normal inline-flex items-baseline">
						<span className="text-white">Task</span>
						<span className="inline-block pl-2 -ml-2 pr-1.5 py-0.5 bg-gradient-to-r from-violet-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
							Genie
						</span>
					</h3>

					{/* Live Dynamic Status Pill */}
					<div className="mt-3.5 min-h-[36px] flex items-center justify-center">
						<AnimatePresence mode="wait">
							<motion.div
								key={message || stepIndex}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.3, ease: "easeOut" }}
								className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-md shadow-sm"
							>
								{/* Warm solid golden ember dot */}
								<span className="w-2 h-2 rounded-full bg-amber-400 inline-block shrink-0" />
								<span className="text-xs sm:text-sm font-medium text-slate-200 tracking-wide font-['Plus_Jakarta_Sans',sans-serif]">
									{message || SOULFUL_MESSAGES[stepIndex]}
								</span>
							</motion.div>
						</AnimatePresence>
					</div>

					{submessage && (
						<p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
							{submessage}
						</p>
					)}

					{/* Tactile Progress Indicator Bar */}
					<div className="w-36 sm:w-44 h-1 bg-white/10 rounded-full mt-5 overflow-hidden relative">
						<motion.div
							className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-violet-500 via-indigo-400 to-amber-400 rounded-full"
							animate={{
								x: ["-100%", "100%"],
							}}
							transition={{
								duration: 1.8,
								repeat: Infinity,
								ease: "easeInOut",
							}}
							style={{ width: "60%" }}
						/>
					</div>

					{/* Trust and Craftsmanship Badges */}
					<div className="flex items-center gap-4 mt-6 text-[11px] font-medium text-slate-400/90">
						<div className="flex items-center gap-1.5">
							<ShieldCheck size={13} className="text-violet-400" />
							<span>Verified Specialists</span>
						</div>
						<span className="w-1 h-1 rounded-full bg-slate-700" />
						<div className="flex items-center gap-1.5">
							<Clock size={13} className="text-amber-400" />
							<span>Instant Availability</span>
						</div>
					</div>
				</div>
			</motion.div>
		</AnimatePresence>
	);

	if (fullScreen && mounted && typeof document !== "undefined") {
		return createPortal(content, document.body);
	}

	return content;
}
