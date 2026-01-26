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

			{/* 1. Removed 'min-h-screen' from main. 
               The parent 'min-h-screen' + 'flex-grow' handles the footer positioning perfectly.
               Adding min-h-screen here forces a scrollbar unnecessarily.
            */}
			<main className="flex-grow flex flex-col w-full max-w-[100vw]">
				{/* 2. Removed mode="wait". 
                   We don't want to wait. We want the switch to be instant.
                */}
				<AnimatePresence initial={false}>
					<motion.div
						key={location.pathname}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						/* 3. REMOVED THE EXIT PROP.
                           This is the key fix. By removing 'exit', the old page 
                           unmounts instantly. The new page mounts instantly 
                           and fades in. No gap, no bouncing footer.
                        */
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
