import { HeroSection } from "../src/HeroSection";
import ServicesSection from "../src/ServicesSection";
import Navbar from "../src/ui/Navbar";
import HowItWorksSection from "./ui/HowItWorksSection";
import FadeIn from "./ui/FadeIn";

export default function AppLayout() {
	return (
		<div>
			<div className="relative  overflow-hidden">
				<Navbar />

				<div className="relative w-full">
					<HeroSection />

					<FadeIn>
						<ServicesSection />
					</FadeIn>

					<FadeIn>
						<HowItWorksSection />
					</FadeIn>
				</div>
			</div>
		</div>
	);
}
