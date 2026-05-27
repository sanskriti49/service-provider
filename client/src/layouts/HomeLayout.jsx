import Navbar from "../ui/Navbar";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../pages/Footer";
import { AnimatePresence, motion } from "framer-motion";
import { Suspense } from "react";
import Loader2 from "lucide-react";

export default function HomeLayout() {
	const location = useLocation();

	return (
		<div
			className="relative min-h-screen flex flex-col bg-cover bg-center bg-no-repeat bg-fixed w-full text-white"
			style={{ backgroundImage: "url('/images/background.webp')" }}
		>
			<Navbar />

			{/* main wrapper keeps footer at the bottom of viewport */}
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
						<Suspense
							fallback={
								/* ⚡ min-h-[60vh] forces the wrapper to stay open and center the loader */
								<div className="flex flex-col flex-grow items-center justify-center min-h-[60vh] w-full gap-3 text-slate-400">
									<div className="relative flex items-center justify-center">
										<div className="absolute w-12 h-12 rounded-full bg-violet-500/20 animate-ping duration-1000" />
										<Loader2
											size={36}
											className="animate-spin text-violet-500 relative z-10"
										/>
									</div>
									<p className="text-xs font-medium tracking-wide animate-pulse mt-2 bricolage-grotesque">
										Loading TaskGenie...
									</p>
								</div>
							}
						>
							<Outlet />
						</Suspense>
					</motion.div>
				</AnimatePresence>
			</main>

			<Footer />
		</div>
	);
}
