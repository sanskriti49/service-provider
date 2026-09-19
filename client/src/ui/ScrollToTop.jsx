import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Universal ScrollToTop Handler
 *
 * Ensures that navigating to any route immediately places the user at the top (0, 0)
 * of the screen, preventing browser scroll retention from the prior page.
 * If an explicit URL hash is present (e.g. #how-it-works, #contact), it smoothly
 * anchors to that element.
 */
export default function ScrollToTop() {
	const { pathname, hash } = useLocation();

	useEffect(() => {
		// Prevent browsers from preserving scrolled position on navigation
		if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
			window.history.scrollRestoration = "manual";
		}

		if (hash) {
			const id = hash.replace("#", "");
			const element = document.getElementById(id);
			if (element) {
				const yOffset = id === "hero" ? 0 : -85;
				const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
				window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
				return;
			}
		}

		// Reset viewport directly to top
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	}, [pathname, hash]);

	return null;
}
