import axios from "axios";

// Fall back to empty string ONLY if you rely entirely on Vite's config proxy routing.
// If your backend is hosted explicitly, use your environment variable.
const BASE_URL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
	baseURL: BASE_URL,
	withCredentials: true,
	headers: {
		"Content-Type": "application/json",
	},
});

// 1. Request Interceptor: Auto-attach token to your isolated instance
api.interceptors.request.use(
	(config) => {
		// Multi-part form data uploads (like profile images) require dynamic boundary headers.
		// If we are passing FormData, let Axios drop the manual header so the browser sets it correctly.
		if (config.data instanceof FormData) {
			delete config.headers["Content-Type"];
		}

		const token = localStorage.getItem("token");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error),
);

// 2. Response Interceptor: Handle Token Expiration cleanly across layout components
api.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response && error.response.status === 401) {
			console.warn("Session expired or unauthorized. Clearing credentials...");

			// Wipe specific auth items to prevent split layout states
			localStorage.removeItem("token");
			localStorage.removeItem("user");

			// Avoid cyclic loops if the user is already trying to log in
			if (window.location.pathname !== "/login") {
				window.location.href = "/login";
			}
		}
		return Promise.reject(error);
	},
);

export default api;
