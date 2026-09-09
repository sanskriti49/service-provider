const AuroraBackground = () => (
	<div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
		<div className="absolute inset-0 bg-gradient-to-br from-violet-50/80 via-white to-fuchsia-50/70" />
		<div className="absolute -top-24 -left-24 h-[350px] w-[350px] rounded-full bg-violet-300/20 blur-2xl" />
		<div className="absolute top-1/3 -right-24 h-[320px] w-[320px] rounded-full bg-fuchsia-300/15 blur-2xl" />
		<div className="absolute bottom-0 left-1/4 h-[240px] w-[400px] rounded-full bg-purple-200/20 blur-2xl" />
	</div>
);

export default AuroraBackground;
