// import { useEffect, useRef } from "react";
// import { Outlet, useLocation } from "react-router-dom";
// import Navbar from "../ui/Navbar";
// import Footer from "../pages/Footer";
// import nprogress from "nprogress";
// import "nprogress/nprogress.css";
// import gsap from "gsap";

// nprogress.configure({ showSpinner: false, speed: 400 });

// export default function AppLayout() {
// 	const { pathname } = useLocation();
// 	const mainRef = useRef(null);

// 	// ── NProgress bar on every route change ──────────────────────────────────
// 	useEffect(() => {
// 		nprogress.start();
// 		const timer = setTimeout(() => nprogress.done(), 200);
// 		return () => {
// 			clearTimeout(timer);
// 			nprogress.done();
// 		};
// 	}, [pathname]);

// 	// ── GSAP fade-in on route change ──────────────────────────────────────────
// 	useEffect(() => {
// 		if (!mainRef.current) return;
// 		gsap.fromTo(
// 			mainRef.current,
// 			{ opacity: 0, y: 10 },
// 			{ opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
// 		);
// 	}, [pathname]);

// 	return (
// 		<div
// 			className="relative min-h-screen flex flex-col bg-cover bg-center bg-no-repeat bg-fixed w-full"
// 			style={{ backgroundImage: "url('/images/background.webp')" }}
// 		>
// 			<Navbar />
// 			<main
// 				ref={mainRef}
// 				className="flex-grow flex flex-col w-full max-w-[100vw]"
// 			>
// 				<Outlet />
// 			</main>
// 			<Footer />
// 		</div>
// 	);
// }

// src/layouts/AppLayout.jsx
import { useEffect, useRef, Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../ui/Navbar";
import Footer from "../pages/Footer";
import { Loader2 } from "lucide-react"; // ✅ fix the named import too
import nprogress from "nprogress";
import "nprogress/nprogress.css";
import gsap from "gsap";

nprogress.configure({ showSpinner: false, speed: 400 });

// Inline loader — sits between Navbar and Footer, no dark overlay
function ContentLoader() {
	return (
		<div className="flex flex-col flex-1 items-center justify-center min-h-[60vh] w-full gap-3 text-slate-400">
			<div className="relative flex items-center justify-center">
				<div className="absolute w-12 h-12 rounded-full bg-violet-500/20 animate-ping" />
				<Loader2
					size={36}
					className="animate-spin text-violet-500 relative z-10"
				/>
			</div>
			<p className="text-xs font-medium tracking-wide animate-pulse bricolage-grotesque">
				Loading TaskGenie...
			</p>
		</div>
	);
}

export default function AppLayout() {
	const { pathname } = useLocation();
	const mainRef = useRef(null);

	useEffect(() => {
		nprogress.start();
		const timer = setTimeout(() => nprogress.done(), 200);
		return () => {
			clearTimeout(timer);
			nprogress.done();
		};
	}, [pathname]);

	useEffect(() => {
		if (!mainRef.current) return;
		gsap.fromTo(
			mainRef.current,
			{ opacity: 0, y: 10 },
			{ opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
		);
	}, [pathname]);

	return (
		<div
			className="relative min-h-screen flex flex-col bg-cover bg-center bg-no-repeat bg-fixed w-full"
			style={{ backgroundImage: "url('/images/background.webp')" }}
		>
			<Navbar />
			<main
				ref={mainRef}
				className="flex-grow flex flex-col w-full max-w-[100vw]"
			>
				<Suspense fallback={<ContentLoader />}>
					<Outlet />
				</Suspense>
			</main>
			<Footer />
		</div>
	);
}
