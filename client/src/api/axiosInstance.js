import axios from "axios";

const api = axios.create({
	baseURL: "",
	withCredentials: true,
});

// 1. Request Interceptor: Auto-attach token
api.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem("token");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error),
);

// 2. Response Interceptor: Handle Token Expiration
api.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response && error.response.status === 401) {
			// 401 means "Unauthorized" (Token expired or invalid)
			console.warn("Session expired. Logging out...");

			localStorage.removeItem("token");
			localStorage.removeItem("user");

			// Redirect to login (window.location is robust for hard redirects)
			if (window.location.pathname !== "/login") {
				window.location.href = "/login";
			}
		}
		return Promise.reject(error);
	},
);

export default api;
