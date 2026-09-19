// Single source of truth for the API origin.
// In development, empty string "" leverages Vite's dev proxy (/api -> http://localhost:3000),
// completely eliminating CORS issues, cross-origin cookie blocks, and connection resets.
// If VITE_API_URL is explicitly defined, use it (e.g. production / custom backend).
export const API_URL =
	import.meta.env.VITE_API_URL !== undefined
		? import.meta.env.VITE_API_URL
		: import.meta.env.DEV
			? ""
			: "http://localhost:3000";

export default API_URL;
