import React from "react"; // ✅ Required for JSX
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import axios from "axios";
axios.defaults.baseURL = "http://localhost:3000";

axios.interceptors.response.use(
	(response) => response, //if response is good, do nothing
	(error) => {
		if (error.response && error.response.status === 401) {
			console.log("Session expired or user deleted. Logging out...");

			localStorage.removeItem("token");
			if (window.location.pathname !== "/login") {
				window.location.href = "/login";
			}
		}
		return Promise.reject(error);
	}
);
createRoot(document.getElementById("root")).render(
	<StrictMode>
		<App />
	</StrictMode>
);
