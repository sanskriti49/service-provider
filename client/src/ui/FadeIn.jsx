import { motion as Motion, useReducedMotion } from "framer-motion";

const FadeIn = ({ children, className }) => {
	const reduce = useReducedMotion();
	return (
		<Motion.div
			initial={reduce ? false : { opacity: 0, y: 15 }}
			whileInView={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, ease: "easeOut" }}
			viewport={{ once: true, margin: "-40px" }}
			className={className}
		>
			{children}
		</Motion.div>
	);
};

export default FadeIn;
