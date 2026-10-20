import HowItWorksSection from "./HowItWorksSection";
import WorkWUs from "./WorkWUs";
import ContactSection from "./ContactSection";
import FadeIn from "../ui/FadeIn";

export default function HomeDetails() {
	return <>
		<FadeIn><div id="how-it-works" className="scroll-mt-24"><HowItWorksSection /></div></FadeIn>
		<FadeIn><div id="work-with-us" className="scroll-mt-24"><WorkWUs /></div></FadeIn>
		<FadeIn><div id="contact" className="scroll-mt-24"><ContactSection /></div></FadeIn>
	</>;
}
