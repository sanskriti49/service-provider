import { AnimatePresence, motion } from "framer-motion";
import { Outlet } from "react-router-dom";

export default function PlainLayout() {
	return (
		<AnimatePresence mode="wait">
			<div
				className="min-h-screen w-full bg-cover bg-center bg-no-repeat bg-fixed"
				style={{ backgroundImage: "url('/images/background.webp')" }}
			>
				<motion.div
					// Key is vital! It tells Framer "this is a different page"
					key={location.pathname}
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -15 }}
					transition={{ duration: 0.3 }}
					className="w-full h-full"
				>
					{/* Outlet renders the child route (Home, Dashboard, etc.) */}
					<Outlet />
				</motion.div>
			</div>
		</AnimatePresence>
	);
}
