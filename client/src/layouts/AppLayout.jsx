import Navbar from "../ui/Navbar";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../pages/Footer";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

const ScrollToTop = () => {
	const { pathname } = useLocation();
	useEffect(() => {
		window.scrollTo(0, 0);
	}, [pathname]);
	return null;
};

export default function AppLayout() {
	const location = useLocation();

	return (
		<div
			className="relative min-h-screen flex flex-col bg-cover bg-center bg-no-repeat bg-fixed overflow-x-hidden w-full"
			style={{ backgroundImage: "url('/images/background.webp')" }}
		>
			<ScrollToTop />
			<div className="absolute inset-0 -z-10 pointer-events-none" />

			<Navbar />

			<main className="flex-grow flex flex-col w-full max-w-[100vw]">
				<AnimatePresence initial={false} mode="wait">
					<motion.div
						key={location.key}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.3, ease: "easeOut" }}
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
