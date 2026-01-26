import Navbar from "../ui/Navbar";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../pages/Footer";
import { AnimatePresence, motion } from "framer-motion";

export default function HomeLayout() {
	const location = useLocation();

	return (
		<div
			className="relative min-h-screen flex flex-col bg-cover bg-center bg-no-repeat bg-fixed"
			style={{ backgroundImage: "url('/images/background.webp')" }}
		>
			<div className="absolute inset-0 -z-10 pointer-events-none" />

			<Navbar />

			{/* 3. Main container takes remaining space */}
			<main className="flex-grow flex flex-col">
				<AnimatePresence mode="wait">
					<motion.div
						key={location.pathname}
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -15 }}
						transition={{ duration: 0.3 }}
						className="flex-grow w-full flex flex-col"
					>
						<Outlet />
					</motion.div>
				</AnimatePresence>
			</main>

			<Footer />
		</div>
	);
}
