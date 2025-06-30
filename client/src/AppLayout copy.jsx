import { HeroSection } from "./HeroSection";
import BackgroundNavbar from "./ui/BackgroundNavbar";
import Navbar from "./ui/Navbar";

export default function AppLayout() {
	return (
		<div>
			<div className="aboslute">
				<Navbar />

				<div className="">
					<BackgroundNavbar /> {/* Custom component or background div */}
					<HeroSection />
				</div>
			</div>
		</div>
	);
}
