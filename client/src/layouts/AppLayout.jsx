import Navbar from "../ui/Navbar";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../pages/Footer";
import { AnimatePresence, motion } from "framer-motion";

export default function AppLayout() {
	const location = useLocation();

	return (
		// 1. Added 'relative' so the absolute overlay stays inside this div
		<div
			className="relative min-h-screen flex flex-col bg-cover bg-center bg-no-repeat bg-fixed"
			style={{ backgroundImage: "url('/images/background.webp')" }}
		>
			{/* 2. Restored the overlay so you can see the BG 'nicely' (tinted) */}
			{/* Added pointer-events-none so you can still click things underneath if z-index fails */}
			<div className="absolute inset-0 bg-white/80 -z-10 pointer-events-none" />

			<Navbar />

			{/* 3. Main container takes remaining space */}
			<main className="flex-grow flex flex-col">
				<AnimatePresence mode="wait">
					{/* 4. The Motion Div must grow to fill the main area */}
					<motion.div
						key={location.pathname}
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -15 }}
						transition={{ duration: 0.3 }}
						className="flex-grow w-full flex flex-col" // Added flex-col to keep child layout intact
					>
						<Outlet />
					</motion.div>
				</AnimatePresence>
			</main>

			<Footer />
		</div>
	);
}
