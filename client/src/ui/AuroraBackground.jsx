import { motion } from "framer-motion";
const AuroraBackground = () => (
	<div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
		<div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50" />
		<motion.div
			className="absolute -top-32 -left-32 h-[450px] w-[450px] rounded-full bg-violet-400/30 blur-3xl will-change-transform"
			animate={{ x: [0, 40, -30, 0], y: [0, -20, 30, 0] }}
			transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
		/>
		<motion.div
			className="absolute top-1/3 -right-40 h-[380px] w-[380px] rounded-full bg-fuchsia-400/30 blur-3xl will-change-transform"
			animate={{ x: [0, -30, 20, 0], y: [0, 40, -20, 0] }}
			transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
		/>
		<motion.div
			className="absolute bottom-0 left-1/4 h-[280px] w-[500px] rounded-full bg-purple-300/25 blur-3xl will-change-transform"
			animate={{ x: [0, 50, -40, 0], y: [0, -30, 20, 0] }}
			transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
		/>
	</div>
);
export default AuroraBackground;
