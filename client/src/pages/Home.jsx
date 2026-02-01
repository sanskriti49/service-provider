import { HeroSection } from "./HeroSection";
import ServicesSection from "./ServicesSection";
import HowItWorksSection from "./HowItWorksSection";
import WorkWUs from "./WorkWUs";
import FadeIn from "../ui/FadeIn";
import ContactSection from "./ContactSection";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
export default function Home() {
	const { hash } = useLocation();

	useEffect(() => {
		if (hash) {
			setTimeout(() => {
				const elem = document.getElementById(hash.replace("#", ""));
				if (elem) {
					elem.scrollIntoView({ behavior: "smooth" });
				}
			});
		}
	}, [hash]);
	return (
		<div className="relative w-full">
			<div id="hero">
				<HeroSection />
			</div>
			<div id="services">
				<ServicesSection />
			</div>
			<FadeIn>
				<div id="how-it-works">
					<HowItWorksSection />
				</div>
			</FadeIn>
			<FadeIn>
				<div id="work-with-us">
					<WorkWUs />
				</div>
			</FadeIn>
			<FadeIn>
				<div id="contact">
					<ContactSection />
				</div>
			</FadeIn>
		</div>
	);
}
