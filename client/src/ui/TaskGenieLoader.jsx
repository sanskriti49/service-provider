import { useState, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import {
	motion as Motion,
	AnimatePresence,
	useReducedMotion,
	useAnimationControls,
} from "framer-motion";
import Logo from "./Logo";

/**
 * TaskGenie loader: "rub the lamp"
 *
 * One orchestrated moment: every few seconds the lamp gets a little rub,
 * wiggles, glows, and flares a burst of stardust from its spout. Tapping the
 * lamp triggers the same moment on demand.
 *
 * One line of story copy plus four sparkles that light up as the wish moves
 * along. The sparkles advance on a timer, or follow `progress` (0-100) when
 * the caller knows how far along things are. No other text on purpose: a
 * loader should say one thing.
 *
 * Props
 *  - fullScreen  portal to <body> as a fixed overlay (default) or render inline
 *  - message     overrides the story copy
 *  - submessage  optional real context only (e.g. "Uploading photo 2 of 3")
 *  - progress    optional 0-100, switches the ribbon + wishes to determinate mode
 */

const STAGES = [
	"Every great task starts with a little magic.",
	"Finding the right hands for the job.",
	"Putting the pieces together.",
	"Your wish is taking shape.",
];

const STAGE_INTERVAL_MS = 3600;
const RUB_INTERVAL_MS = 4800;

// Anchor points are percentages of the lamp artwork (spout tip, smoke curl).
const SPOUT = { left: "92%", top: "38%" };
const SMOKE_TIP = { left: "60%", top: "14%" };

// A fan of sparkles that leaves the spout, pointing up and away from the lamp.
const BURST = Array.from({ length: 9 }, (_, i) => {
	const angle = ((-165 + i * (130 / 8)) * Math.PI) / 180;
	const distance = 52 + (i % 3) * 16;
	return {
		dx: Math.cos(angle) * distance,
		dy: Math.sin(angle) * distance,
		size: 9 + (i % 3) * 3,
		delay: i * 0.035,
		color: ["text-amber-200", "text-fuchsia-200", "text-violet-200"][i % 3],
	};
});

// Quiet "wish dust" that drifts off the end of the painted smoke.
const DUST = [
	{
		x: -24,
		drift: -14,
		size: 6,
		duration: 3.6,
		delay: 0,
		color: "text-amber-200",
	},
	{
		x: 6,
		drift: 10,
		size: 8,
		duration: 4.2,
		delay: 1.1,
		color: "text-violet-200",
	},
	{
		x: 30,
		drift: 22,
		size: 5,
		duration: 3.9,
		delay: 2.2,
		color: "text-fuchsia-200",
	},
	{
		x: -8,
		drift: -26,
		size: 5,
		duration: 4.5,
		delay: 2.9,
		color: "text-amber-100",
	},
];

const WAVE =
	"M4 12 C 24 2, 44 22, 64 12 S 104 2, 124 12 S 164 22, 184 12 S 216 2, 236 12";

function Sparkle({ className = "" }) {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className={className}
			fill="currentColor"
		>
			<path d="M12 0c.9 7 5 11.1 12 12-7 .9-11.1 5-12 12-.9-7-5-11.1-12-12C7 11.1 11.1 7 12 0z" />
		</svg>
	);
}

function Burst() {
	return (
		<div className="pointer-events-none absolute" style={SPOUT}>
			<Motion.span
				className="absolute left-0 top-0 -ml-10 -mt-10 h-20 w-20 rounded-full"
				style={{
					background:
						"radial-gradient(circle, rgba(253,230,138,0.85) 0%, rgba(253,230,138,0) 70%)",
				}}
				initial={{ opacity: 0, scale: 0.3 }}
				animate={{ opacity: [0, 0.9, 0], scale: [0.3, 1.2, 1.8] }}
				transition={{ duration: 0.9, ease: "easeOut", times: [0, 0.3, 1] }}
			/>
			{BURST.map((star, index) => (
				<Motion.span
					key={index}
					className={`absolute left-0 top-0 ${star.color}`}
					style={{
						width: star.size,
						height: star.size,
						marginLeft: -star.size / 2,
						marginTop: -star.size / 2,
					}}
					initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
					animate={{
						opacity: [0, 1, 0],
						scale: [0, 1, 0.3],
						x: [0, star.dx * 0.7, star.dx],
						y: [0, star.dy * 0.7, star.dy],
						rotate: [0, 90, 180],
					}}
					transition={{
						duration: 1.3,
						delay: star.delay,
						ease: "easeOut",
						times: [0, 0.35, 1],
					}}
				>
					<Sparkle className="h-full w-full" />
				</Motion.span>
			))}
		</div>
	);
}

function WishDust() {
	return (
		<div className="pointer-events-none absolute" style={SMOKE_TIP}>
			{DUST.map((mote, index) => (
				<Motion.span
					key={index}
					className={`absolute left-0 top-0 ${mote.color}`}
					style={{
						width: mote.size,
						height: mote.size,
						marginLeft: mote.x,
						marginTop: -mote.size / 2,
					}}
					initial={{ opacity: 0 }}
					animate={{
						opacity: [0, 0.9, 0],
						y: [0, -26, -58],
						x: [0, mote.drift * 0.5, mote.drift],
						scale: [0.3, 1, 0.3],
						rotate: [0, 60, 120],
					}}
					transition={{
						duration: mote.duration,
						delay: mote.delay,
						repeat: Infinity,
						ease: "easeOut",
						times: [0, 0.4, 1],
					}}
				>
					<Sparkle className="h-full w-full" />
				</Motion.span>
			))}
		</div>
	);
}

// A wavy ribbon of smoke. Indeterminate: a comet of smoke travels along it.
// Determinate: the ribbon fills left to right with `progress`.
function SmokeRibbon({ progress, reduced }) {
	const gradientId = `tg-ribbon-${useId().replace(/:/g, "")}`;
	const determinate = typeof progress === "number";

	let motionProps;
	if (determinate) {
		motionProps = {
			initial: reduced ? false : { pathLength: 0 },
			animate: { pathLength: progress / 100 },
			transition: { duration: reduced ? 0 : 0.6, ease: "easeOut" },
		};
	} else if (reduced) {
		motionProps = {
			initial: false,
			animate: { pathLength: 0.35, pathOffset: 0.3 },
			transition: { duration: 0 },
		};
	} else {
		motionProps = {
			initial: { pathLength: 0.02, pathOffset: 0 },
			animate: {
				pathLength: [0.02, 0.3, 0.3, 0.02],
				pathOffset: [0, 0.35, 0.7, 0.98],
			},
			transition: {
				duration: 2.6,
				repeat: Infinity,
				ease: "easeInOut",
				times: [0, 0.4, 0.7, 1],
			},
		};
	}

	return (
		<svg
			viewBox="0 0 240 24"
			className="h-6 w-60 overflow-visible"
			aria-hidden="true"
		>
			<defs>
				<linearGradient
					id={gradientId}
					gradientUnits="userSpaceOnUse"
					x1="0"
					y1="0"
					x2="240"
					y2="0"
				>
					<stop offset="0%" stopColor="#c4b5fd" />
					<stop offset="55%" stopColor="#f5d0fe" />
					<stop offset="100%" stopColor="#fde68a" />
				</linearGradient>
			</defs>
			<path
				d={WAVE}
				fill="none"
				stroke="rgba(196,181,253,0.16)"
				strokeWidth="2"
				strokeLinecap="round"
			/>
			<Motion.path
				d={WAVE}
				fill="none"
				stroke={`url(#${gradientId})`}
				strokeWidth="6"
				strokeLinecap="round"
				style={{ filter: "blur(4px)", opacity: 0.45 }}
				{...motionProps}
			/>
			<Motion.path
				d={WAVE}
				fill="none"
				stroke={`url(#${gradientId})`}
				strokeWidth="2.5"
				strokeLinecap="round"
				{...motionProps}
			/>
		</svg>
	);
}

export default function TaskGenieLoader({
	fullScreen = true,
	message,
	submessage,
	progress,
	className = "",
}) {
	const reduced = useReducedMotion();
	const hasProgress = typeof progress === "number" && Number.isFinite(progress);
	const pct = hasProgress ? Math.min(100, Math.max(0, progress)) : undefined;

	const [timedStage, setTimedStage] = useState(0);
	const [rub, setRub] = useState(0);
	const lampControls = useAnimationControls();
	const glowControls = useAnimationControls();

	// Which of the four wishes we're on: follows progress if given, otherwise the clock.
	const stageIndex = hasProgress
		? Math.min(STAGES.length - 1, Math.floor(pct / (100 / STAGES.length)))
		: timedStage;

	useEffect(() => {
		if (reduced || hasProgress) return;
		const timer = window.setInterval(() => {
			setTimedStage((previous) => (previous + 1) % STAGES.length);
		}, STAGE_INTERVAL_MS);
		return () => window.clearInterval(timer);
	}, [reduced, hasProgress]);

	// The recurring "rub": first one shortly after mount, then on a steady beat.
	useEffect(() => {
		if (reduced) return;
		const first = window.setTimeout(() => setRub((count) => count + 1), 1100);
		const loop = window.setInterval(
			() => setRub((count) => count + 1),
			RUB_INTERVAL_MS,
		);
		return () => {
			window.clearTimeout(first);
			window.clearInterval(loop);
		};
	}, [reduced]);

	useEffect(() => {
		if (reduced || rub === 0) return;
		lampControls.start({
			rotate: [0, -6, 5, -4, 3, 0],
			scaleX: [1, 1.03, 0.98, 1.02, 1, 1],
			scaleY: [1, 0.96, 1.03, 0.98, 1.01, 1],
			transition: { duration: 0.9, ease: "easeInOut" },
		});
		glowControls.start({
			opacity: [0.45, 0.95, 0.45],
			scale: [1, 1.12, 1],
			transition: { duration: 1.6, ease: "easeOut", times: [0, 0.35, 1] },
		});
	}, [rub, reduced, lampControls, glowControls]);

	const currentMessage = message || STAGES[stageIndex];
	const floatTransition = {
		duration: 4.2,
		repeat: Infinity,
		ease: "easeInOut",
	};

	const content = (
		<Motion.div
			role="status"
			aria-label="Loading TaskGenie"
			initial={reduced ? false : { opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: reduced ? 0 : 0.2 }}
			className={
				fullScreen
					? "fixed inset-0 z-[99999] flex select-none flex-col items-center justify-center overflow-hidden bg-[#0B0718] px-5"
					: `relative flex min-h-[55vh] w-full select-none flex-col items-center justify-center overflow-hidden rounded-3xl bg-[#0B0718] px-5 py-12 ${className}`
			}
		>
			{/* Rotating decorative copy should not repeat live announcements. */}
			<span className="sr-only">
				{message || "Getting things ready…"}
				{hasProgress ? ` ${Math.round(pct)}% complete.` : ""}
			</span>

			{/* Dot grid that fades out toward the edges, so the lamp sits in a pool of texture. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 opacity-[0.14]"
				style={{
					backgroundImage: "radial-gradient(#C4B5FD 0.7px, transparent 0.7px)",
					backgroundSize: "26px 26px",
					WebkitMaskImage:
						"radial-gradient(ellipse at 50% 42%, #000 15%, transparent 68%)",
					maskImage:
						"radial-gradient(ellipse at 50% 42%, #000 15%, transparent 68%)",
				}}
			/>

			<div className="relative z-10 flex w-full flex-col items-center">
				{/* Decorative easter egg: tapping the lamp rubs it. */}
				<div
					className="relative h-48 w-48 shrink-0 cursor-pointer sm:h-60 sm:w-60"
					aria-hidden="true"
					onPointerDown={() => {
						if (!reduced) setRub((count) => count + 1);
					}}
					style={{ touchAction: "manipulation" }}
				>
					<Motion.div
						className="pointer-events-none absolute inset-4 rounded-full blur-2xl"
						style={{
							background:
								"radial-gradient(circle, rgba(167,139,250,0.55) 0%, rgba(167,139,250,0) 68%)",
						}}
						initial={{ opacity: 0.45, scale: 1 }}
						animate={reduced ? { opacity: 0.45, scale: 1 } : glowControls}
					/>

					<Motion.div
						className="pointer-events-none absolute bottom-1 left-1/2 h-2 w-28 rounded-full bg-violet-300/20 blur-md"
						style={{ x: "-50%" }}
						initial={reduced ? false : { scaleX: 1, opacity: 0.65 }}
						animate={
							reduced
								? { scaleX: 1, opacity: 0.65 }
								: { scaleX: [1, 0.8, 1], opacity: [0.65, 0.35, 0.65] }
						}
						transition={reduced ? { duration: 0 } : floatTransition}
					/>

					{/* Slow float lives on the wrapper; the rub lives on the image. */}
					<Motion.div
						className="absolute inset-0"
						initial={reduced ? false : { y: 2, rotate: -2 }}
						animate={
							reduced
								? { y: 0, rotate: 0 }
								: { y: [2, -6, 2], rotate: [-2, 2, -2] }
						}
						transition={reduced ? { duration: 0 } : floatTransition}
					>
						<Motion.img
							src="/images/taskgenie-lamp-256.webp?v=5"
							width="256"
							height="256"
							alt=""
							className="relative h-full w-full object-contain"
							style={{ transformOrigin: "50% 88%" }}
							animate={reduced ? undefined : lampControls}
							loading="eager"
							draggable={false}
						/>
						{!reduced && <WishDust />}
						{!reduced && rub > 0 && <Burst key={rub} />}
					</Motion.div>
				</div>

				<div className="mt-4" aria-hidden="true">
					<Logo variant="wordmark" size="lg" theme="dark" />
				</div>

				<div
					className="mt-3 flex min-h-14 w-full max-w-sm items-center justify-center text-center"
					aria-hidden="true"
				>
					<AnimatePresence mode="wait" initial={false}>
						<Motion.p
							key={currentMessage}
							initial={
								reduced ? false : { opacity: 0, y: 6, filter: "blur(4px)" }
							}
							animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
							exit={
								reduced ? undefined : { opacity: 0, y: -4, filter: "blur(4px)" }
							}
							transition={{ duration: reduced ? 0 : 0.3 }}
							className="text-base italic leading-relaxed text-violet-100/90 sm:text-[17px]"
							style={{
								fontFamily: "P22Mackinac, 'P22 Mackinac Pro', Georgia, serif",
							}}
						>
							{currentMessage}
						</Motion.p>
					</AnimatePresence>
				</div>

				<div className="mt-2" aria-hidden="true">
					<SmokeRibbon progress={pct} reduced={reduced} />
				</div>

				{/* Four sparkles: lit = current, soft = done, dim = still to come. */}
				<ol
					className="mt-4 flex items-center justify-center gap-5"
					aria-hidden="true"
				>
					{STAGES.map((_, index) => {
						const active = index === stageIndex;
						const done = index < stageIndex;
						return (
							<li key={index}>
								<Motion.span
									className={`block ${active ? "text-amber-200" : done ? "text-violet-300/70" : "text-violet-300/25"}`}
									animate={{ scale: active ? 1.4 : 1 }}
									transition={{ duration: reduced ? 0 : 0.35, ease: "easeOut" }}
								>
									<Sparkle className="h-3 w-3" />
								</Motion.span>
							</li>
						);
					})}
				</ol>

				{submessage && (
					<p className="mt-3 max-w-xs text-center text-xs leading-relaxed text-slate-400">
						{submessage}
					</p>
				)}
			</div>
		</Motion.div>
	);

	if (fullScreen && typeof document !== "undefined" && document.body) {
		return createPortal(content, document.body);
	}
	return content;
}
