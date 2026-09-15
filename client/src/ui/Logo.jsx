import React from "react";
import { Link } from "react-router-dom";

/**
 * Standardized TaskGenie Logo Component
 *
 * Consistent across Landing, Admin Dashboard, Provider Dashboard, Auth, and Footer:
 * - Official Magic Lamp SVG (/images/taskgenie-logo.svg)
 * - Authentic brand Lobster Two cursive typography
 * - Dynamic size & theme variants (dark/light/primary)
 * - Optional link wrapping
 */
export default function Logo({
	size = "md", // "xs" | "sm" | "md" | "lg" | "xl" | number
	variant = "full", // "full" | "icon" | "wordmark"
	theme = "dark", // "dark" (violet-400->fuchsia-400) | "light" (violet-700->fuchsia-700) | "primary" (violet-600->fuchsia-600)
	to = null, // if provided, wraps in React Router <Link>
	className = "",
	onClick,
}) {
	// Size mapping for icon and typography
	const sizeMap = {
		xs: { icon: "h-6 w-6", text: "text-lg", imgSize: 24 },
		sm: { icon: "h-7 w-7", text: "text-xl", imgSize: 28 },
		md: { icon: "h-8 w-8", text: "text-2xl", imgSize: 32 },
		lg: { icon: "h-10 w-10", text: "text-3xl", imgSize: 40 },
		xl: { icon: "h-11 w-11", text: "text-3xl sm:text-4xl", imgSize: 44 },
	};

	const resolvedSize =
		typeof size === "string"
			? sizeMap[size] || sizeMap.md
			: {
					icon: "",
					text: "text-2xl",
					customIconStyle: { width: `${size}px`, height: `${size}px` },
					customTextStyle: { fontSize: `${Math.round(size * 0.75)}px` },
				};

	// Typography gradient by theme
	const themeGradients = {
		dark: "bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-300",
		light: "bg-gradient-to-r from-violet-700 via-fuchsia-700 to-fuchsia-700",
		primary: "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600",
	};

	const textGradient = themeGradients[theme] || themeGradients.dark;

	const Icon = (
		<div
			className={`shrink-0 overflow-hidden drop-shadow-md transition-transform duration-300 group-hover:scale-105 ${
				resolvedSize.icon || ""
			}`}
			style={resolvedSize.customIconStyle}
		>
			<img
				src="/images/taskgenie-logo.svg"
				alt="TaskGenie Logo"
				className="h-full w-full object-contain"
				loading="eager"
			/>
		</div>
	);

	const Wordmark = (
		<span
			className={`lobster font-bold bg-clip-text text-transparent pb-0.5 tracking-tight ${textGradient} ${
				resolvedSize.text || ""
			}`}
			style={resolvedSize.customTextStyle}
		>
			TaskGenie
		</span>
	);

	const content = (
		<div
			className={`inline-flex items-center gap-2.5 group select-none ${className}`}
			onClick={onClick}
		>
			{variant !== "wordmark" && Icon}
			{variant !== "icon" && Wordmark}
		</div>
	);

	if (to) {
		return (
			<Link to={to} className="inline-flex items-center">
				{content}
			</Link>
		);
	}

	return content;
}
