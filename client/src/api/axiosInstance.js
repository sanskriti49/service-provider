import axios from "axios";
import { apiCache } from "../utils/apiCache";

import { API_URL as BASE_URL } from "../config";

const api = axios.create({
	baseURL: BASE_URL,
	withCredentials: true,
	headers: {
		"Content-Type": "application/json",
	},
});

api.interceptors.request.use(
	(config) => {
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

api.interceptors.response.use(
	(response) => {
		if(["post","put","patch","delete"].includes(response.config?.method) && /^\/api\/(users|providers|reviews|admin)\b/.test(response.config?.url || ""))apiCache.deletePrefix("providers_");
		return response;
	},
	(error) => {
		if (error.response && error.response.status === 401) {
			console.warn("Session expired or unauthorized. Clearing credentials...");

			localStorage.removeItem("token");
			localStorage.removeItem("user");

			if (window.location.pathname !== "/login") {
				window.location.href = "/login";
			}
		}
		return Promise.reject(error);
	},
);

export default api;
export { api };
