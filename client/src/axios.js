import axios from "axios";

axios.defaults.baseURL =
	import.meta.env.VITE_API_URL || "http://localhost:3000";

//  Request interceptor: attach JWT to every outgoing request
axios.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem("token");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error),
);

//  Response interceptor: handle expired / revoked tokens globally
axios.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401) {
			console.warn("Session expired or token invalid — logging out.");
			localStorage.removeItem("token");

			if (window.location.pathname !== "/login") {
				window.location.href = "/login";
			}
		}
		return Promise.reject(error);
	},
);

export default axios;
