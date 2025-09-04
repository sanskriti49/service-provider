import { motion } from "framer-motion";

const FadeIn = ({ children, className }) => {
	return (
		<motion.div
			variants={{
				hidden: {
					opacity: 0,
					y: 20,
				},
				visible: {
					opacity: 1,
					y: 0,
				},
			}}
			initial="hidden"
			whileInView="visible"
			transition={{ duration: 0.6, ease: "easeInOut" }}
			viewport={{ once: true }}
			className={className}
		>
			{children}
		</motion.div>
	);
};

export default FadeIn;
