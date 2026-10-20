import { HeroSection } from "./HeroSection";
import ServicesSection from "./ServicesSection";
import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const detailHashes = new Set(["#how-it-works", "#work-with-us", "#contact"]);

export default function Home() {
	const { hash } = useLocation();
	const detailsRef = useRef(null);
	const [nearDetails, setNearDetails] = useState(false);
	const [Details, setDetails] = useState(null);
	const [detailsError, setDetailsError] = useState(false);
	const needDetails = nearDetails || detailHashes.has(hash);
	const sectionReady = !detailHashes.has(hash) || !!Details || detailsError;

	useEffect(() => {
		if (!("IntersectionObserver" in window)) { setNearDetails(true); return; }
		const observer = new IntersectionObserver(entries => {
			if (entries.some(entry => entry.isIntersecting)) {
				setNearDetails(true);
				observer.disconnect();
			}
		}, { rootMargin: "200px" });
		observer.observe(detailsRef.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!needDetails) return;
		let active = true;
		import("./HomeDetails").then(module => {
			if (active) setDetails(() => module.default);
		}).catch(() => { if (active) setDetailsError(true); });
		return () => { active = false; };
	}, [needDetails]);

	useEffect(() => {
		// Wait for the actual section to mount, including on a slow direct hash visit.
		if (!sectionReady) return;
		const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
		if (hash) {
			const targetId = hash.replace("#", "");
			const scrollWithOffset = () => {
				const elem = document.getElementById(targetId) || (detailHashes.has(hash) ? detailsRef.current : null);
				if (elem) {
					const yOffset = targetId === "hero" ? 0 : -90;
					let y = 0;
					// Layout offsets exclude the decorative entrance transform.
					for (let node = elem; node; node = node.offsetParent) y += node.offsetTop;
					y = targetId === "hero" ? 0 : y + yOffset;
					window.scrollTo({ top: Math.max(0, y), behavior });
					return true;
				}
				return false;
			};

			scrollWithOffset();
		} else {
			window.scrollTo({ top: 0, behavior });
		}
	}, [hash, sectionReady]);

	return (
		<div className="relative w-full">
			<div id="hero" className="scroll-mt-24">
				<HeroSection />
			</div>
			<div id="services" className="scroll-mt-24">
				<ServicesSection />
			</div>
			<div ref={detailsRef}>
				{Details ? <Details /> : <div className="min-h-[6800px] md:min-h-[4400px] px-6 pt-16 text-center text-violet-950">
					{detailsError ? <div role="alert">This section couldn't load. Check your connection, then <button type="button" onClick={() => window.location.reload()} className="underline cursor-pointer">reload the page</button>.</div>
						: needDetails && <p role="status">Loading more of TaskGenie…</p>}
				</div>}
			</div>
		</div>
	);
}
