import Navbar from "../ui/Navbar";

import { Outlet } from "react-router-dom";
import Footer from "../pages/Footer";
import { useState } from "react";

export default function AppLayout() {
	const [searchQuery, setSearchQuery] = useState("");
	const handleSearch = (query) => {
		setSearchQuery(query);
	};
	return (
		<div>
			<div className="relative  overflow-hidden">
				<Navbar />

				<main className="flex-grow">
					<Outlet />
				</main>
				<Footer />
			</div>
		</div>
	);
}

// import { HeroSection } from "./pages/HeroSection";
// import ServicesSection from "./pages/ServicesSection";

// import HowItWorksSection from "./pages/HowItWorksSection";
// import FadeIn from "../src/ui/FadeIn";
// import WorkWUs from "./WorkWUs";
{
	/* <div className="relative w-full">
					<HeroSection id="" />
					<ServicesSection />
					<FadeIn>
						<HowItWorksSection id="how-it-works" />
					</FadeIn>
					<FadeIn>
						<section id="work-with-us">
							<WorkWUs />
						</section>
					</FadeIn>
					<Footer />
				</div> */
}
