import React, { useEffect } from "react";

const Alerts = ({ message, type = "success", onClose }) => {
	useEffect(() => {
		const timer = setTimeout(() => {
			onClose();
		}, 2000);

		return () => clearTimeout(timer);
	}, [onClose]);

	const alertTypeClasses = {
		success: "bg-green-500 text-white",
		error: "bg-red-500 text-white",
	};

	return (
		<div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-fade-in-down">
			<div
				className={`flex items-center justify-between duration-150 rounded-lg p-4 shadow-lg min-w-[300px] ${alertTypeClasses[type]}`}
			>
				<span>{message}</span>
				<button
					onClick={onClose}
					className="cursor-pointer ml-4 font-bold text-xl hover:opacity-75"
				>
					&times;
				</button>
			</div>
		</div>
	);
};

export default Alerts;
