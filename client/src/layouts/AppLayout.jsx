





import { useEffect, useRef, Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import gsap from "gsap";
import Navbar from "../ui/Navbar";
import Footer from "../pages/Footer";
import TaskGenieLoader from "../ui/TaskGenieLoader";
import ScrollToTop from "../ui/ScrollToTop";
import nprogress from "nprogress";
import "nprogress/nprogress.css";

nprogress.configure({ showSpinner: false, speed: 400 });

export default function AppLayout() {
	const { pathname } = useLocation();
	const mainRef = useRef(null);

	const isFirstMount = useRef(true);

	useEffect(() => {
		nprogress.start();
		const timer = setTimeout(() => nprogress.done(), 200);

		// GSAP smooth page transition on route change (without blocking initial LCP render with opacity: 0)
		if (mainRef.current && !isFirstMount.current) {
			gsap.fromTo(
				mainRef.current,
				{ opacity: 0.85, y: 6 },
				{
					opacity: 1,
					y: 0,
					duration: 0.25,
					ease: "power2.out",
					clearProps: "transform,opacity",
				},
			);
		}
		isFirstMount.current = false;

		return () => {
			clearTimeout(timer);
			nprogress.done();
		};
	}, [pathname]);

	const isServiceDetails = pathname.startsWith("/services/") && pathname !== "/services";

	return (
		<div
			className="relative min-h-screen flex flex-col bg-cover bg-center bg-no-repeat w-full"
			style={{ backgroundImage: "url('/images/background.webp')" }}
		>
			<ScrollToTop />
			{!isServiceDetails && <Navbar />}
			<main
				ref={mainRef}
				className="flex-grow flex flex-col w-full max-w-[100vw]"
			>
				<Suspense fallback={<TaskGenieLoader fullScreen />}>
					<Outlet />
				</Suspense>
			</main>
			{!isServiceDetails && <Footer />}
		</div>
	);
}

