import React, { useId } from "react";

export default function Logo({ variant = "full", size = 40, className = "" }) {
	const gradientId = useId();
	const fill = `url(#${gradientId})`;

	const Icon = (
		<svg
			viewBox="0 0 48 48"
			width={size}
			height={size}
			role="img"
			aria-label="TaskGenie"
			className="shrink-0"
		>
			<defs>
				<linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#7C3AED" />
					<stop offset="55%" stopColor="#C026D3" />
					<stop offset="100%" stopColor="#EC4899" />
				</linearGradient>
			</defs>

			<circle cx="1" cy="27" r="1.6" fill={fill} opacity="0.9" />
			<circle cx="3" cy="21" r="1.2" fill={fill} opacity="0.6" />
			<circle cx="7" cy="16" r="0.9" fill={fill} opacity="0.4" />

			<path d="M17,28 C11,26 5,28 2,32 C4,34 11,33 17,31 Z" fill={fill} />
			<ellipse cx="26" cy="30" rx="10" ry="8.5" fill={fill} />
			<rect x="23" y="21" width="6" height="5" rx="1" fill={fill} />
			<circle cx="26" cy="19" r="2.4" fill={fill} />
			<path
				d="M36,25 C42,27 42,33 36,35"
				fill="none"
				stroke={fill}
				strokeWidth="2.2"
				strokeLinecap="round"
			/>
			<rect x="16" y="40" width="20" height="3" rx="1.5" fill={fill} />

			<circle
				cx="37"
				cy="15"
				r="7"
				fill="#ffffff"
				stroke={fill}
				strokeWidth="1.4"
			/>
			<path
				d="M33.5,15 L36,17.5 L41,11.5"
				fill="none"
				stroke={fill}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);

	const Wordmark = (
		<span
			className="font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500"
			style={{ fontSize: size * 0.68, lineHeight: 1 }}
		>
			TaskGenie
		</span>
	);

	if (variant === "icon") return <div className={className}>{Icon}</div>;
	if (variant === "wordmark")
		return <div className={className}>{Wordmark}</div>;

	return (
		<div className={`inline-flex items-center gap-2.5 ${className}`}>
			{Icon}
			{Wordmark}
		</div>
	);
}
