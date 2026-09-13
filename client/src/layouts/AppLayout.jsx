





import { useEffect, useRef, Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../ui/Navbar";
import Footer from "../pages/Footer";
import { Loader2 } from "lucide-react";
import nprogress from "nprogress";
import "nprogress/nprogress.css";

nprogress.configure({ showSpinner: false, speed: 400 });

function ContentLoader() {
	return (
		<div className="flex flex-col flex-1 items-center justify-center min-h-[60vh] w-full gap-3 text-slate-400">
			<div className="relative flex items-center justify-center">
				<Loader2
					size={36}
					className="animate-spin text-violet-500 relative z-10"
				/>
			</div>
			<p className="text-xs font-medium tracking-wide bricolage-grotesque">
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

	const isServiceDetails = pathname.startsWith("/services/") && pathname !== "/services";

	return (
		<div
			className="relative min-h-screen flex flex-col bg-cover bg-center bg-no-repeat w-full"
			style={{ backgroundImage: "url('/images/background.webp')" }}
		>
			{!isServiceDetails && <Navbar />}
			<main
				key={pathname}
				ref={mainRef}
				className="animate-fade-slide flex-grow flex flex-col w-full max-w-[100vw]"
			>
				<Suspense fallback={<ContentLoader />}>
					<Outlet />
				</Suspense>
			</main>
			{!isServiceDetails && <Footer />}
		</div>
	);
}
