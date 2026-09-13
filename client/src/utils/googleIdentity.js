// Loads the Google Identity Services script on demand.
// Keeping it off the global page means every non-auth route avoids a
// third-party request that would otherwise delay the window load event.
const GSI_SRC = "https://accounts.google.com/gsi/client";

let loader = null;

export function loadGoogleIdentity() {
	if (window.google?.accounts?.id) return Promise.resolve(window.google);
	if (loader) return loader;

	loader = new Promise((resolve, reject) => {
		const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
		const script = existing || document.createElement("script");

		const onLoad = () => {
			if (window.google?.accounts?.id) resolve(window.google);
			else reject(new Error("Google Identity Services unavailable"));
		};

		script.addEventListener("load", onLoad, { once: true });
		script.addEventListener(
			"error",
			() => {
				loader = null;
				reject(new Error("Failed to load Google Identity Services"));
			},
			{ once: true },
		);

		if (!existing) {
			script.src = GSI_SRC;
			script.async = true;
			script.defer = true;
			document.head.appendChild(script);
		}
	});

	return loader;
}

export default loadGoogleIdentity;
