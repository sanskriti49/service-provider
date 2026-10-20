const scenes = {
	home: "home-life",
	workbench: "workbench",
	calendar: "quiet-calendar",
	mail: "all-caught-up",
	support: "support-desk",
	search: "curious-search",
	reviews: "customer-stories",
	crew: "neighborhood-crew",
	checkout: "quiet-checkout",
	paperTrail: "paper-trail",
};

/** Decorative scenes: the surrounding heading carries the meaning. */
export default function ServiceIllustration({
	scene = "home",
	className = "",
	priority = false,
}) {
	return (
		<img
			src={`/images/illustrations/${scenes[scene] || scenes.home}.webp`}
			alt=""
			aria-hidden="true"
			width="768"
			height="512"
			loading={priority ? "eager" : "lazy"}
			decoding="async"
			draggable={false}
			className={`pointer-events-none select-none object-contain ${className}`}
		/>
	);
}
