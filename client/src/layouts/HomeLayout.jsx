import Navbar from "../ui/Navbar";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../pages/Footer";
import { AnimatePresence, motion } from "framer-motion";
import { Suspense } from "react";
import TaskGenieLoader from "../ui/TaskGenieLoader";

export default function HomeLayout() {
	const location = useLocation();

	return (
		<div
			className="relative min-h-screen flex flex-col bg-cover bg-center bg-no-repeat bg-fixed w-full text-white"
			style={{ backgroundImage: "url('/images/background.webp')" }}
		>
			<Navbar />

			<main className="flex-1 flex flex-col w-full">
				<AnimatePresence mode="wait">
					<motion.div
						key={location.pathname}
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -15 }}
						transition={{ duration: 0.3 }}
						className="flex-1 w-full flex flex-col"
					>
						<Suspense fallback={<TaskGenieLoader fullScreen />}>
							<Outlet />
						</Suspense>
					</motion.div>
				</AnimatePresence>
			</main>

			<Footer />
		</div>
	);
}
