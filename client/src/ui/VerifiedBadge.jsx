import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";

/**
 * VerifiedBadge - Authentic, premium trust mark for background & ID verified providers.
 * Designed with a refined metallic gold/amber micro-gradient and crisp typography.
 */
export default function VerifiedBadge({
	size = "sm",
	showTooltip = true,
	className = "",
}) {
	const [isHovered, setIsHovered] = useState(false);

	const isIconOnly = size === "icon";

	// Size dimension tokens
	const sizeClasses = {
		xs: "px-1.5 py-0.5 text-[10px] gap-1",
		sm: "px-2 py-0.5 text-xs gap-1.5",
		md: "px-2.5 py-1 text-xs gap-1.5",
		lg: "px-3 py-1.5 text-sm gap-2",
		icon: "p-1 text-xs",
	}[size] || "px-2 py-0.5 text-xs gap-1.5";

	const iconSizes = {
		xs: 11,
		sm: 13,
		md: 14,
		lg: 16,
		icon: 14,
	}[size] || 13;

	return (
		<span
			className="relative inline-flex items-center"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<span
				className={`inline-flex items-center select-none font-medium rounded-full transition-all duration-200
					bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-yellow-500/15
					text-amber-400 dark:text-amber-300
					border border-amber-500/30 dark:border-amber-400/35
					shadow-[0_1px_3px_rgba(245,158,11,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]
					hover:border-amber-400/50 hover:shadow-[0_2px_8px_rgba(245,158,11,0.2)]
					${sizeClasses} ${className}`}
				role="status"
				aria-label="Verified Pro: Identity and background check verified"
			>
				{/* Shield icon with subtle metallic gold stroke */}
				<ShieldCheck
					size={iconSizes}
					className="text-amber-400 dark:text-amber-300 shrink-0 stroke-[2.2]"
					aria-hidden="true"
				/>

				{!isIconOnly && (
					<span className="font-semibold tracking-wide whitespace-nowrap">
						Verified Pro
					</span>
				)}
			</span>

			{/* Tooltip on hover */}
			{showTooltip && isHovered && (
				<div
					className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none transition-all duration-150 transform"
					style={{ filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))" }}
				>
					<div className="bg-neutral-900 border border-amber-500/30 text-neutral-100 text-[11px] rounded-md px-2.5 py-1.5 whitespace-nowrap flex items-center gap-1.5 shadow-xl">
						<span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
						<span>Govt ID &amp; Background Check Verified by TaskGenie</span>
					</div>
					<div className="w-2 h-2 bg-neutral-900 border-b border-r border-amber-500/30 transform rotate-45 mx-auto -mt-1" />
				</div>
			)}
		</span>
	);
}
