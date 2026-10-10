import * as React from "react";
import { Link } from "react-router-dom";
import {
	ArrowRight,
	ArrowUpRight,
	ChevronLeft,
	ChevronRight,
	AlertTriangle,
	RefreshCw,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useFetch } from "../hooks/useFetch";
import AuroraBackground from "../ui/AuroraBackground";
import { API_URL } from "../config";

/* Rail is padded so its first card lines up with the max-w-7xl header above it */
const railPad = {
	paddingLeft: "max(1rem, calc((100vw - 80rem) / 2 + 2rem))",
	paddingRight: "max(1rem, calc((100vw - 80rem) / 2 + 2rem))",
	scrollPaddingLeft: "max(1rem, calc((100vw - 80rem) / 2 + 2rem))",
};

const cardSize =
	"h-[460px] sm:h-[500px] w-[82vw] max-w-[360px] md:max-w-none shrink-0 rounded-[1.75rem]";
const widthActive = "md:w-[420px] lg:w-[520px]";
const widthIdle = "md:w-[150px] lg:w-[180px]";

const fallbackGradients = [
	"from-violet-500 to-purple-700",
	"from-fuchsia-500 to-pink-600",
	"from-indigo-500 to-violet-700",
	"from-purple-500 to-rose-500",
];

/* ------------------------------------------------------------------ */

const ServicePanel = ({ service, index, active, onActivate }) => {
	const url = `/services/${service.slug || service.id}`;
	const image = service.image_url || "/images/default-service.jpg";
	const unit =
		service.price_unit && service.price_unit !== "fixed"
			? service.price_unit
			: "";

	/* On tablets (no hover) the first tap should expand the panel, the second opens it */
	const handleClick = (e) => {
		if (
			!active &&
			window.matchMedia("(min-width: 768px) and (hover: none)").matches
		) {
			e.preventDefault();
			onActivate();
		}
	};

	return (
		<Link
			to={url}
			onMouseEnter={onActivate}
			onFocus={onActivate}
			onClick={handleClick}
			aria-label={`${service.name}, view providers`}
			className={`group relative block snap-start overflow-hidden bg-gradient-to-br ${
				fallbackGradients[index % fallbackGradients.length]
			} ${cardSize} ${
				active ? widthActive : widthIdle
			} shadow-lg shadow-purple-900/10 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-400`}
		>
			<img
				src={image}
				alt=""
				loading="lazy"
				className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 motion-reduce:transition-none ${
					active ? "md:scale-100" : "md:scale-110"
				}`}
			/>

			{/* readability + idle dimming */}
			<div className="absolute inset-0 bg-gradient-to-t from-[#1b1038] via-[#1b1038]/50 to-transparent" />
			<div
				className={`absolute inset-0 bg-[#281950]/50 transition-opacity duration-500 ${
					active ? "md:opacity-0" : "md:opacity-100"
				} opacity-0`}
			/>

			{/* index + price */}
			<div className="absolute inset-x-0 top-0 flex items-start justify-between p-5 lg:p-6">
				<span className="font-geist text-sm font-semibold tabular-nums text-white/80">
					{String(index + 1).padStart(2, "0")}
				</span>
				{service.price && (
					<span
						className={`rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-[#281950] shadow-md transition-opacity duration-300 ${
							active ? "md:opacity-100 md:delay-200" : "md:opacity-0"
						}`}
					>
						<span className="text-[11px] font-semibold text-violet-600">
							from{" "}
						</span>
						₹{service.price}
						{unit && (
							<span className="ml-1 text-xs font-medium text-slate-500">
								{unit}
							</span>
						)}
					</span>
				)}
			</div>

			{/* idle state: vertical name */}
			<div
				className={`pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center transition-opacity duration-300 md:flex ${
					active ? "opacity-0" : "opacity-100 delay-200"
				}`}
				aria-hidden="true"
			>
				<span
					className="max-h-[330px] overflow-hidden text-ellipsis whitespace-nowrap text-2xl font-bold text-white"
					style={{
						writingMode: "vertical-rl",
						transform: "rotate(180deg)",
						fontFamily: "P22Mackinac, serif",
					}}
				>
					{service.name}
				</span>
			</div>

			{/* active state: full details (always visible on mobile) */}
			<div
				className={`absolute bottom-0 left-0 p-6 text-white transition-all duration-500 lg:p-8 ${
					active
						? "md:translate-y-0 md:opacity-100 md:delay-150"
						: "md:pointer-events-none md:translate-y-3 md:opacity-0"
				}`}
			>
				<div className="w-full md:w-[372px] lg:w-[456px]">
					<span className="inline-block rounded-full bg-white/20 px-3 py-1 font-geist text-xs font-medium text-white/95 backdrop-blur-md">
						{service.category || "General"}
					</span>
					<h3
						className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
						style={{ fontFamily: "P22Mackinac, serif" }}
					>
						{service.name}
					</h3>
					{service.description && (
						<p className="font-geist mt-2 line-clamp-2 max-w-md text-sm leading-relaxed text-white/80">
							{service.description}
						</p>
					)}
					<span className="font-geist mt-5 inline-flex items-center gap-2 rounded-full bg-white py-2.5 pl-5 pr-2.5 text-sm font-bold text-[#281950] transition-colors group-hover:bg-violet-100">
						View providers
						<span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#281950] text-white">
							<ArrowUpRight className="h-4 w-4" />
						</span>
					</span>
				</div>
			</div>
		</Link>
	);
};

const RailSkeleton = () => (
	<div
		className="flex gap-3 overflow-hidden"
		style={railPad}
		aria-hidden="true"
	>
		{[0, 1, 2, 3].map((i) => (
			<div
				key={i}
				className={`${cardSize} animate-pulse bg-slate-200/80 ${
					i === 0 ? widthActive : widthIdle
				} ${i > 1 ? "hidden md:block" : ""}`}
			/>
		))}
	</div>
);

const RoundButton = ({ direction, onClick, disabled }) => {
	const Icon = direction === "left" ? ChevronLeft : ChevronRight;
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={direction === "left" ? "Scroll left" : "Scroll right"}
			className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-violet-200 bg-white/80 text-[#281950] backdrop-blur-md transition-all hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-default disabled:opacity-35 disabled:hover:shadow-none"
		>
			<Icon className="h-5 w-5" />
		</button>
	);
};

/* ------------------------------------------------------------------ */

const ServicesSection = () => {
	const reduce = useReducedMotion();
	const {
		data: apiResponse,
		loading,
		error,
	} = useFetch(`${API_URL}/api/services/v1`);

	const services = Array.isArray(apiResponse)
		? apiResponse
		: apiResponse?.data || [];

	const [category, setCategory] = React.useState("All");
	const [active, setActive] = React.useState(0);
	const [scroll, setScroll] = React.useState({
		progress: 0,
		canPrev: false,
		canNext: false,
		scrollable: false,
	});
	const railRef = React.useRef(null);

	const categories = React.useMemo(() => {
		const counts = new Map();
		services.forEach((s) => {
			const c = s.category || "General";
			counts.set(c, (counts.get(c) || 0) + 1);
		});
		return [
			{ name: "All", count: services.length },
			...[...counts].map(([name, count]) => ({ name, count })),
		];
	}, [services]);

	const visible =
		category === "All"
			? services
			: services.filter((s) => (s.category || "General") === category);

	const updateScroll = React.useCallback(() => {
		const el = railRef.current;
		if (!el) return;
		const max = el.scrollWidth - el.clientWidth;
		setScroll({
			progress: max > 0 ? el.scrollLeft / max : 0,
			canPrev: el.scrollLeft > 4,
			canNext: el.scrollLeft < max - 4,
			scrollable: max > 4,
		});
	}, []);

	React.useEffect(() => {
		updateScroll();
		window.addEventListener("resize", updateScroll);
		return () => window.removeEventListener("resize", updateScroll);
	}, [updateScroll, visible.length]);

	const pickCategory = (name) => {
		setCategory(name);
		setActive(0);
		railRef.current?.scrollTo({ left: 0, behavior: "auto" });
	};

	const scrollRail = (dir) => {
		const el = railRef.current;
		if (!el) return;
		el.scrollBy({
			left: dir * Math.min(520, el.clientWidth * 0.8),
			behavior: reduce ? "auto" : "smooth",
		});
	};

	const showFilters = categories.length > 2;

	return (
		<section id="services" className="relative overflow-hidden py-20 sm:py-28">
			<AuroraBackground />

			<div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				{/* Header */}
				<div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
					<div className="max-w-2xl">
						<h2 className="bricolage-grotesque text-4xl font-extrabold leading-[1.08] tracking-tight text-[#281950] sm:text-5xl lg:text-6xl">
							Find the right pro for every job.
						</h2>
						<p className="font-geist mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
							From home repairs to personal wellness, connect with trusted
							professionals in your area instantly.
						</p>
					</div>

					<div className="hidden shrink-0 items-center gap-2 md:flex">
						<RoundButton
							direction="left"
							onClick={() => scrollRail(-1)}
							disabled={!scroll.canPrev}
						/>
						<RoundButton
							direction="right"
							onClick={() => scrollRail(1)}
							disabled={!scroll.canNext}
						/>
					</div>
				</div>

				{/* Category filter */}
				{!loading && !error && showFilters && (
					<div
						role="tablist"
						aria-label="Filter services by category"
						className="mt-10 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					>
						{categories.map((c) => {
							const selected = category === c.name;
							return (
								<button
									key={c.name}
									type="button"
									role="tab"
									aria-selected={selected}
									onClick={() => pickCategory(c.name)}
									className={`bricolage-grotesque relative shrink-0 cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 ${
										selected
											? "border-transparent text-white"
											: "border-violet-200 bg-white/70 text-slate-600 hover:border-violet-300 hover:text-violet-700"
									}`}
								>
									{selected && (
										<motion.span
											layoutId="service-category-pill"
											transition={
												reduce
													? { duration: 0 }
													: { type: "spring", stiffness: 420, damping: 34 }
											}
											className="absolute inset-0 rounded-full bg-[#281950]"
										/>
									)}
									<span className="relative z-10">
										{c.name}
										<span
											className={`ml-1.5 text-xs tabular-nums ${
												selected ? "text-violet-200" : "text-slate-400"
											}`}
										>
											{c.count}
										</span>
									</span>
								</button>
							);
						})}
					</div>
				)}
			</div>

			{/* Rail */}
			<div className="relative z-10 mt-8">
				{loading && <RailSkeleton />}

				{error && (
					<div className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
						<div className="flex w-full max-w-xl items-start gap-4 rounded-2xl border border-rose-200 bg-rose-50/90 p-6 text-rose-700">
							<AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
							<div className="flex-1">
								<h3 className="font-semibold">We couldn't load services</h3>
								<p className="mt-1 text-sm opacity-90">
									{String(error?.message || error)}
								</p>
								<button
									type="button"
									onClick={() => window.location.reload()}
									className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200"
								>
									<RefreshCw className="h-4 w-4" />
									Try again
								</button>
							</div>
						</div>
					</div>
				)}

				{!loading && !error && services.length === 0 && (
					<p className="font-geist mx-auto max-w-7xl px-4 text-slate-500 sm:px-6 lg:px-8">
						Services will appear here soon.
					</p>
				)}

				{!loading && !error && visible.length > 0 && (
					<div
						ref={railRef}
						onScroll={updateScroll}
						onTransitionEnd={updateScroll}
						style={railPad}
						className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-6 [scrollbar-width:none] md:snap-none [&::-webkit-scrollbar]:hidden"
					>
						{visible.map((service, i) => (
							<ServicePanel
								key={service.slug || service.id}
								service={service}
								index={i}
								active={i === active}
								onActivate={() => setActive(i)}
							/>
						))}
					</div>
				)}
			</div>

			{/* Footer: progress + browse all */}
			{!loading && !error && services.length > 0 && (
				<div className="relative z-10 mx-auto mt-4 flex max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
					<div
						className={`h-1 max-w-xs flex-1 overflow-hidden rounded-full bg-violet-200/70 ${
							scroll.scrollable ? "" : "invisible"
						}`}
						aria-hidden="true"
					>
						<div
							className="h-full rounded-full bg-gradient-to-r from-violet-600 to-pink-500"
							style={{
								width: "28%",
								marginLeft: `${scroll.progress * 72}%`,
							}}
						/>
					</div>

					<Link
						to="/services"
						className="font-geist group ml-auto inline-flex items-center gap-2 text-base font-bold text-[#281950] transition-colors hover:text-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 rounded-full px-2 py-1"
					>
						Browse all services
						<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
					</Link>
				</div>
			)}
		</section>
	);
};

export default ServicesSection;
