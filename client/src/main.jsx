// import React from "react";
// import { StrictMode } from "react";
// import { createRoot } from "react-dom/client";
// import "./index.css";
// import App from "./App.jsx";
// import axios from "axios";
// axios.defaults.baseURL =
// 	import.meta.env.VITE_API_URL || "http://localhost:3000";

// // ✅ Attach token to every outgoing request automatically
// axios.interceptors.request.use((config) => {
// 	const token = localStorage.getItem("token");
// 	if (token) {
// 		config.headers.Authorization = `Bearer ${token}`;
// 	}
// 	return config;
// });

// // ✅ Handle expired/invalid token globally
// axios.interceptors.response.use(
// 	(response) => response, //if response is good, do nothing
// 	(error) => {
// 		if (error.response && error.response.status === 401) {
// 			console.log("Session expired or user deleted. Logging out...");

// 			localStorage.removeItem("token");
// 			if (window.location.pathname !== "/login") {
// 				window.location.href = "/login";
// 			}
// 		}
// 		return Promise.reject(error);
// 	},
// );
// createRoot(document.getElementById("root")).render(
// 	<StrictMode>
// 		<App />
// 	</StrictMode>,
// );

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./axios"; // ✅ Side-effect import — sets up interceptors once
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
