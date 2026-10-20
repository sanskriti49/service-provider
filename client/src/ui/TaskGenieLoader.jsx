import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
	motion,
	AnimatePresence,
	useAnimation,
	useReducedMotion,
} from "framer-motion";

const MESSAGES = [
	"Every great task starts with a little magic.",
	"Finding the right hands for the job.",
	"Putting the pieces together.",
	"Your wish is taking shape.",
];

const STAGES = [1600, 1800, 1500, 2300, 650];

const COLORS = {
	smoke: "#C4B5FD",
	smokeSoft: "#DDD6FE",
	amber: "#FCD34D",
};

const PATHS = {
	// The smoke emerges from the lamp and travels upwards.
	wisp: "M100 172C83 158 118 148 101 134Q96 130 100 125",
	// Roof and walls are separate so the home builds naturally.
	roof: "M51 79L100 40L149 79",
	walls: "M59 74V118H141V74",

	door: "M89 118V95Q89 86 100 86Q111 86 111 95V118",
	chimney: "M119 55V38H132V65",

	windowLeft: "M68 85H82V100H68Z M75 85V100 M68 92.5H82",
	windowRight: "M118 85H132V100H118Z M125 85V100 M118 92.5H132",
};

const SPARKLE =
	"M0 -7C1 -2 2 -1 7 0C2 1 1 2 0 7C-1 2 -2 1 -7 0C-2 -1 -1 -2 0 -7Z";

function DrawPath({
	d,
	active,
	delay = 0,
	duration = 0.8,
	width = 3,
	reduced = false,
	color = COLORS.smoke,
}) {
	return (
		<motion.path
			d={d}
			fill="none"
			stroke={color}
			strokeWidth={width}
			strokeLinecap="round"
			strokeLinejoin="round"
			initial={false}
			animate={{
				pathLength: active ? 1 : 0,
				opacity: active ? 1 : 0,
			}}
			transition={
				reduced
					? { duration: 0 }
					: {
							pathLength: {
								duration: active ? duration : 0.35,
								delay: active ? delay : 0,
								ease: [0.4, 0, 0.2, 1],
							},
							opacity: {
								duration: active ? 0.12 : 0.25,
								delay: active ? delay : 0,
							},
						}
			}
		/>
	);
}

function Window({ x, active, reduced }) {
	return (
		<motion.rect
			x={x}
			y={85}
			width={14}
			height={15}
			rx={1.5}
			fill={COLORS.amber}
			initial={false}
			animate={{
				opacity: active ? 0.9 : 0,
				scale: active ? 1 : 0.7,
			}}
			style={{
				transformBox: "fill-box",
				transformOrigin: "center",
			}}
			transition={
				reduced
					? { duration: 0 }
					: active
						? {
								delay: 0.75,
								type: "spring",
								stiffness: 240,
								damping: 18,
							}
						: { duration: 0.2 }
			}
		/>
	);
}

function Sparkle({ x, y, size = 1, active, delay = 0, reduced }) {
	return (
		<g transform={`translate(${x} ${y})`}>
			<motion.path
				d={SPARKLE}
				fill={COLORS.amber}
				style={{
					transformBox: "fill-box",
					transformOrigin: "center",
				}}
				initial={false}
				animate={{
					scale: active ? size : 0,
					rotate: active ? 25 : 0,
					opacity: active ? 1 : 0,
				}}
				transition={
					reduced
						? { duration: 0 }
						: active
							? {
									delay,
									type: "spring",
									stiffness: 260,
									damping: 15,
								}
							: { duration: 0.18 }
				}
			/>
		</g>
	);
}

export default function TaskGenieLoader({
	fullScreen = true,
	message,
	submessage,
	className = "",
}) {
	const reduced = useReducedMotion();
	const lamp = useAnimation();
	const [stage, setStage] = useState(0);

	useEffect(() => {
		if (reduced) return;

		const timer = window.setTimeout(() => {
			setStage((previous) => (previous + 1) % STAGES.length);
		}, STAGES[stage]);

		return () => window.clearTimeout(timer);
	}, [stage, reduced]);

	useEffect(() => {
		if (reduced) {
			lamp.set({ rotate: 0, y: 0 });
			return;
		}

		if (stage === 0) {
			lamp.start({
				rotate: [0, -7, 5, -3, 0],
				y: [0, -2, 0, -1, 0],
				transition: {
					duration: 0.7,
					ease: "easeInOut",
				},
			});
		}

		if (stage === 3) {
			lamp.start({
				y: [0, -5, 0],
				transition: {
					duration: 0.5,
					delay: 0.35,
					ease: "easeOut",
				},
			});
		}
	}, [stage, reduced, lamp]);

	const currentStage = reduced ? 3 : stage;
	const visible = currentStage < 4;
	const finished = currentStage === 3;

	const showWisp = visible;
	const showHouse = visible && currentStage >= 1;
	const showDetails = visible && currentStage >= 2;
	const showWindows = finished;

	const currentMessage = message || MESSAGES[Math.min(stage, 3)];

	const content = (
		<motion.div
			role="status"
			aria-label="Loading TaskGenie"
			initial={reduced ? false : { opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: reduced ? 0 : 0.25 }}
			className={
				fullScreen
					? "fixed inset-0 z-[99999] flex select-none flex-col items-center justify-center overflow-hidden bg-[#0B0718] px-5"
					: `relative flex min-h-[55vh] w-full select-none flex-col items-center justify-center overflow-hidden rounded-3xl bg-[#0B0718] px-5 py-16 ${className}`
			}
		>
			{/* Subtle background decoration */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 opacity-[0.14]"
				style={{
					backgroundImage: "radial-gradient(#C4B5FD 0.7px, transparent 0.7px)",
					backgroundSize: "26px 26px",
				}}
			/>

			<div className="relative z-10 flex w-full flex-col items-center">
				{/* Illustration */}
				<div
					className="relative h-[250px] w-[210px] shrink-0"
					aria-hidden="true"
				>
					<svg
						className="absolute inset-0 h-full w-full overflow-visible"
						viewBox="0 0 200 250"
						fill="none"
					>
						{/* Smoke appears first */}
						<DrawPath
							d={PATHS.wisp}
							active={showWisp}
							duration={1.1}
							delay={0.15}
							width={3.5}
							reduced={reduced}
						/>

						{/* House outline */}
						<DrawPath
							d={PATHS.roof}
							active={showHouse}
							duration={0.85}
							reduced={reduced}
						/>

						<DrawPath
							d={PATHS.walls}
							active={showHouse}
							delay={0.35}
							duration={0.85}
							reduced={reduced}
						/>

						{/* Door and chimney */}
						<DrawPath
							d={PATHS.door}
							active={showDetails}
							duration={0.65}
							reduced={reduced}
						/>

						<DrawPath
							d={PATHS.chimney}
							active={showDetails}
							delay={0.3}
							duration={0.5}
							reduced={reduced}
						/>

						{/* Window illumination */}
						<Window x={68} active={showWindows} reduced={reduced} />
						<Window x={118} active={showWindows} reduced={reduced} />

						<DrawPath
							d={PATHS.windowLeft}
							active={showWindows}
							duration={0.45}
							reduced={reduced}
						/>

						<DrawPath
							d={PATHS.windowRight}
							active={showWindows}
							delay={0.12}
							duration={0.45}
							reduced={reduced}
						/>

						{/* Completion sparkles */}
						<Sparkle
							x={100}
							y={21}
							size={1.2}
							active={finished}
							delay={0.85}
							reduced={reduced}
						/>
						<Sparkle
							x={155}
							y={52}
							size={0.8}
							active={finished}
							delay={1.05}
							reduced={reduced}
						/>
						<Sparkle
							x={44}
							y={58}
							size={0.7}
							active={finished}
							delay={1.2}
							reduced={reduced}
						/>
					</svg>

					{/* Lamp and grounding line */}
					<div className="absolute bottom-0 left-1/2 h-px w-40 -translate-x-1/2 bg-violet-200/25" />

					<div className="absolute inset-x-0 bottom-px flex justify-center">
						<motion.img
							src="/images/taskgenie-lamp-256.webp?v=5"
							alt=""
							animate={lamp}
							style={{ transformOrigin: "50% 90%" }}
							className="h-24 w-24 object-contain"
							loading="eager"
							draggable={false}
						/>
					</div>
				</div>

				{/* Brand */}
				<h2 className="mt-5 flex items-baseline font-lobster text-3xl font-bold leading-normal">
					<span className="text-white">Task</span>
					<span className="pl-1 text-amber-300">Genie</span>
				</h2>

				{/* Animated messages */}
				<div className="mt-3 flex min-h-[52px] w-full max-w-sm items-center justify-center text-center sm:min-h-[38px]">
					<AnimatePresence mode="wait" initial={false}>
						<motion.p
							key={message ? "custom" : Math.min(stage, 3)}
							initial={reduced ? false : { opacity: 0, y: 9 }}
							animate={{ opacity: 1, y: 0 }}
							exit={reduced ? undefined : { opacity: 0, y: -9 }}
							transition={{
								duration: reduced ? 0 : 0.24,
								ease: "easeOut",
							}}
							className="text-[16px] leading-relaxed text-violet-100/90 sm:text-[17px]"
							style={{
								fontFamily: "P22Mackinac, 'P22 Mackinac Pro', Georgia, serif",
								fontStyle: "italic",
							}}
						>
							{currentMessage}
						</motion.p>
					</AnimatePresence>
				</div>

				{submessage && (
					<p className="mt-2 max-w-xs text-center text-xs leading-relaxed text-slate-400">
						{submessage}
					</p>
				)}

				{/* Footer */}
				<div className="mt-7 flex items-center gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200/50">
					<span>Trusted local services</span>
					<span className="text-amber-300/60">✦</span>
					<span>Made effortless</span>
				</div>
			</div>
		</motion.div>
	);

	if (fullScreen && typeof document !== "undefined" && document.body) {
		return createPortal(content, document.body);
	}

	return content;
}
