import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	build: {
		target: "esnext",
		minify: "esbuild",
		cssMinify: true,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (
						id.includes("node_modules/react/") ||
						id.includes("node_modules/react-dom/") ||
						id.includes("node_modules/react-router-dom/")
					) {
						return "vendor-react";
					}
					if (id.includes("node_modules/framer-motion/")) {
						return "vendor-motion";
					}
					if (
						id.includes("node_modules/lucide-react/") ||
						id.includes("node_modules/@heroicons/")
					) {
						return "vendor-icons";
					}
					if (
						id.includes("node_modules/chart.js/") ||
						id.includes("node_modules/react-chartjs-2/")
					) {
						return "vendor-charts";
					}
				},
			},
		},
		chunkSizeWarningLimit: 800,
	},
	server: {
		maxHttpHeaderSize: 16384,
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
				secure: false,
			},
			"/socket.io": {
				target: "http://localhost:3000",
				ws: true,
				changeOrigin: true,
			},
		},
	},
});
