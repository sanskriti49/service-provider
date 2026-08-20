import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	build: {
		target: "esnext",
		minify: "esbuild",
		cssMinify: true,
		rollupOptions: {
			output: {
				manualChunks: {
					"vendor-react": ["react", "react-dom", "react-router-dom"],
					"vendor-motion": ["framer-motion"],
					"vendor-icons": ["lucide-react", "@heroicons/react"],
					"vendor-gsap": ["gsap"],
					"vendor-charts": ["chart.js", "react-chartjs-2"],
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
			},
		},
	},
});
