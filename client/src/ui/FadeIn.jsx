import { motion } from "framer-motion";

const FadeIn = ({ children, className }) => {
	return (
		<motion.div
			initial={{ opacity: 0, y: 15 }}
			whileInView={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, ease: "easeOut" }}
			viewport={{ once: true, margin: "-40px" }}
			className={className}
		>
			{children}
		</motion.div>
	);
};

export default FadeIn;
