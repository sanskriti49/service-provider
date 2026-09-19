import React from "react";
import { Link } from "react-router-dom";

/**
 * Standardized TaskGenie Logo Component
 *
 * Consistent across Landing, Admin Dashboard, Provider Dashboard, Auth, and Footer:
 * - Handcrafted Artisanal Magic Lamp SVG (/images/taskgenie-logo.svg)
 * - Authentic Lobster Two brand typography with anti-clipping padding
 * - Harmonious theme variants (dark/light/primary)
 * - Optional link wrapping
 */
export default function Logo({
	size = "md", // "xs" | "sm" | "md" | "lg" | "xl" | number
	variant = "full", // "full" | "icon" | "wordmark"
	theme = "dark", // "dark" | "light" | "primary"
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
		xl: { icon: "h-12 w-12 sm:h-14 sm:w-14", text: "text-3xl sm:text-4xl", imgSize: 44 },
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

	// Theme color treatments
	const themeStyles = {
		dark: {
			prefix: "text-white",
			suffix:
				"bg-gradient-to-r from-violet-300 via-indigo-200 to-amber-300 bg-clip-text text-transparent",
		},
		light: {
			prefix: "text-slate-900",
			suffix:
				"bg-gradient-to-r from-violet-600 via-indigo-600 to-amber-600 bg-clip-text text-transparent",
		},
		primary: {
			prefix: "text-[#1E1B4B]",
			suffix:
				"bg-gradient-to-r from-violet-600 via-indigo-600 to-amber-500 bg-clip-text text-transparent",
		},
	};

	const currentTheme = themeStyles[theme] || themeStyles.dark;

	const Icon = (
		<div
			className={`shrink-0 overflow-hidden drop-shadow-sm transition-transform duration-300 group-hover:scale-105 ${
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
			className={`font-lobster font-bold select-none leading-normal inline-flex items-baseline ${
				resolvedSize.text || ""
			}`}
			style={resolvedSize.customTextStyle}
		>
			<span className={currentTheme.prefix}>Task</span>
			{/*
			  We use inline-block with pl-2 -ml-2 and pr-1 so the calligraphic left swash/loop
			  of capital 'G' in Lobster Two is never clipped by the CSS background-clip: text box!
			*/}
			<span
				className={`inline-block pl-2 -ml-2 pr-1.5 py-0.5 ${currentTheme.suffix}`}
			>
				Genie
			</span>
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
