import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function BookingSuccess() {
	const navigate = useNavigate();

	// Little confetti animation (pure CSS)
	useEffect(() => {
		const confetti = document.createElement("div");
		confetti.className = "confetti";
		document.body.appendChild(confetti);

		setTimeout(() => confetti.remove(), 2000);
	}, []);

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-[#0d0b21] text-white p-6 relative overflow-hidden">
			{/* Confetti container */}
			<div className="confetti-animation absolute inset-0 overflow-hidden pointer-events-none"></div>

			{/* Card */}
			<div className="bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl p-10 rounded-3xl text-center animate-fade-slide">
				<div className="w-24 h-24 rounded-full bg-green-500/20 border border-green-400 flex items-center justify-center mx-auto animate-scale-pop">
					<span className="text-5xl">✓</span>
				</div>

				<h1 className="text-3xl font-bold mt-6">Booking Confirmed!</h1>
				<p className="text-gray-300 mt-3 text-lg">
					Your session has been successfully booked.
				</p>

				<button
					onClick={() => navigate("/")}
					className="cursor-pointer mt-8 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl shadow-lg hover:opacity-90 transition font-semibold"
				>
					Go to Home
				</button>
			</div>

			{/* Extra animated glow */}
			<div className="absolute bottom-0 w-full h-40 bg-gradient-to-t from-purple-600/30 to-transparent blur-3xl"></div>
		</div>
	);
}
