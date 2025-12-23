import Navbar from "../ui/Navbar";
import { Outlet } from "react-router-dom";
import Footer from "../pages/Footer";

export default function AppLayout() {
	return (
		<div
			className="min-h-screen flex flex-col bg-cover bg-center bg-no-repeat bg-fixed"
			style={{ backgroundImage: "url('/images/background.webp')" }}
		>
			{/* <div className="absolute inset-0 bg-white/80 -z-10" /> */}

			<Navbar />

			<main className="flex-grow">
				<Outlet />
			</main>

			<Footer />
		</div>
	);
}
