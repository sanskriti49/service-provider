import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";

export default function PlainLayout() {
	const location = useLocation();

	return (
		<AnimatePresence mode="wait">
			<div
				className="min-h-screen w-full bg-cover bg-center bg-no-repeat bg-fixed overflow-x-hidden"
				style={{ backgroundImage: "url('/images/background.webp')" }}
			>
				<motion.div
					key={location.pathname}
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -15 }}
					transition={{ duration: 0.3 }}
					className="w-full h-full"
				>
					<Outlet />
				</motion.div>
			</div>
		</AnimatePresence>
	);
}
