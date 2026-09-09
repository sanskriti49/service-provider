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
			const targetId = hash.replace("#", "");
			const scrollWithOffset = () => {
				const elem = document.getElementById(targetId);
				if (elem) {
					const yOffset = targetId === "hero" ? 0 : -90;
					const y =
						targetId === "hero"
							? 0
							: elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
					window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
					return true;
				}
				return false;
			};

			if (!scrollWithOffset()) {
				// Poll briefly until lazy components mount and populate the DOM
				const interval = setInterval(() => {
					if (scrollWithOffset()) {
						clearInterval(interval);
					}
				}, 60);
				const timeout = setTimeout(() => clearInterval(interval), 1500);
				return () => {
					clearInterval(interval);
					clearTimeout(timeout);
				};
			}
		} else {
			window.scrollTo({ top: 0, behavior: "smooth" });
		}
	}, [hash]);

	return (
		<div className="relative w-full">
			<div id="hero" className="scroll-mt-24">
				<HeroSection />
			</div>
			<div id="services" className="scroll-mt-24">
				<ServicesSection />
			</div>
			<FadeIn>
				<div id="how-it-works" className="scroll-mt-24">
					<HowItWorksSection />
				</div>
			</FadeIn>
			<FadeIn>
				<div id="work-with-us" className="scroll-mt-24">
					<WorkWUs />
				</div>
			</FadeIn>
			<FadeIn>
				<div id="contact" className="scroll-mt-24">
					<ContactSection />
				</div>
			</FadeIn>
		</div>
	);
}
