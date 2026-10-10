import { ArrowLeft, Check } from "lucide-react";
import Logo from "../../ui/Logo";

const ring =
	"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300";

const jump = (ref) => {
	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	ref.current?.scrollIntoView({
		behavior: reduce ? "auto" : "smooth",
		block: "start",
	});
};

/**
 * steps: [{ key, label, done, ref }] in page order.
 * The first step that isn't done is treated as the current one.
 */
export default function BookingHeader({ steps, onBack }) {
	const current = Math.max(
		0,
		steps.findIndex((s) => !s.done),
	);

	return (
		<header className="sticky top-0 z-40 bg-[#0d0b12]/90 backdrop-blur-md border-b border-white/[0.06]">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-2 sm:gap-4">
				<button
					type="button"
					onClick={onBack}
					aria-label="Go back"
					className={`inline-flex items-center gap-1.5 p-2 -ml-2 rounded-md text-sm text-stone-300 hover:text-white hover:bg-white/[0.06] transition-colors ${ring}`}
				>
					<ArrowLeft size={18} />
					<span className="hidden sm:inline">Back</span>
				</button>

				<Logo to="/" size="md" theme="dark" />

				<nav aria-label="Booking progress" className="ml-auto">
					<ol className="flex items-center">
						{steps.map((s, i) => {
							const isCurrent = i === current;
							return (
								<li key={s.key} className="flex items-center">
									{i > 0 && (
										<span
											aria-hidden
											className={`mx-2 sm:mx-3 h-px w-3 sm:w-8 ${
												steps[i - 1].done
													? "bg-violet-300/60"
													: "bg-white/[0.12]"
											}`}
										/>
									)}
									<button
										type="button"
										onClick={() => jump(s.ref)}
										aria-current={isCurrent ? "step" : undefined}
										aria-label={`${s.label}${s.done ? ", done" : ""}`}
										className={`group flex items-center gap-2 rounded-md py-1.5 ${ring}`}
									>
										<span
											className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${
												s.done
													? "bg-violet-300 text-[#0d0b12]"
													: isCurrent
														? "border border-white text-white"
														: "border border-white/[0.16] text-stone-500"
											}`}
										>
											{s.done ? <Check size={11} strokeWidth={3} /> : i + 1}
										</span>
										{/* On phones only the current step keeps its label */}
										<span
											className={`text-sm transition-colors group-hover:text-white ${
												isCurrent
													? "text-white font-medium underline decoration-amber-200 decoration-2 underline-offset-[6px]"
													: `hidden sm:inline ${s.done ? "text-stone-300" : "text-stone-500"}`
											}`}
										>
											{s.label}
										</span>
									</button>
								</li>
							);
						})}
					</ol>
				</nav>
			</div>
		</header>
	);
}
