import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

const Unauthorized = () => {
	const { user, logout } = useAuth(); // Destructured logout function from your context
	const navigate = useNavigate();
	const isProvider = user?.role === "provider";

	const handleSwitchAccounts = (e) => {
		e.preventDefault();

		toast.custom(
			(t) => (
				<div className=" w-full max-w-sm bg-purple-950/95 backdrop-blur-md border border-white/10 p-5 rounded-xl shadow-2xl text-left">
					<h3 className="text-sm font-semibold text-white mb-1">
						Sign out to change profiles?
					</h3>
					<p className="text-xs text-purple-200/70 mb-4 leading-normal">
						You'll be logged out of your current session to sign in with a
						different profile ID.
					</p>
					<div className="flex items-center justify-end gap-2">
						<button
							onClick={() => toast.dismiss(t)}
							className="cursor-pointer px-3 py-1.5 text-xs font-medium text-purple-200 hover:text-white transition rounded-md bg-white/5 hover:bg-white/10"
						>
							Cancel
						</button>
						<button
							onClick={async () => {
								toast.dismiss(t);
								try {
									if (logout) await logout();
									navigate("/login");
								} catch (error) {
									toast.error("Failed to log out. Please try again.");
								}
							}}
							className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 transition rounded-md shadow"
						>
							Log Out
						</button>
					</div>
				</div>
			),
			{
				duration: Infinity,
				position: "bottom-center",
			},
		);
	};

	return (
		<div
			className="flex flex-col items-center justify-center h-screen bg-cover bg-center bg-no-repeat px-4 select-none"
			style={{ backgroundImage: `url('/images/error.jpg')` }}
		>
			{/* Glassmorphic Container integrated with the image palette */}
			<div className="inter max-w-md w-full backdrop-blur-xl bg-purple-950/40 border border-white/10 p-8 rounded-2xl shadow-2xl text-center flex flex-col items-center">
				{/* Visual indicator blending with the horizon */}
				<div className="w-16 h-16 bg-gradient-to-tr from-pink-500/20 to-purple-500/20 text-pink-300 rounded-full flex items-center justify-center mb-6 border border-pink-400/20 shadow-lg">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={1.5}
						stroke="currentColor"
						className="w-7 h-7"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
						/>
					</svg>
				</div>

				<h1 className="font-bricolage text-2xl font-extrabold text-white tracking-tight mb-3">
					Lost in Space?
				</h1>

				<p className="text-purple-200/90 text-sm font-medium mb-8 leading-relaxed max-w-sm">
					{isProvider ? (
						<>
							It seems like your{" "}
							<span className="text-pink-300 font-semibold">
								Provider profile
							</span>{" "}
							doesn't have clearance for this customer page. Let's steer you
							back to your workspace.
						</>
					) : (
						<>
							This view requires specific account privileges that your profile
							doesn't currently hold.
						</>
					)}
				</p>

				{/* Grounded Action Paths */}
				<div className="w-full space-y-3">
					{isProvider ? (
						<Link
							to="/provider/dashboard" // Swap with your actual provider home route
							className="block w-full py-3 px-6 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-md transition duration-200 transform active:scale-[0.99] text-sm text-center"
						>
							Go to Provider Dashboard
						</Link>
					) : (
						<Link
							to="/dashboard"
							className="block w-full py-3 px-6 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-md transition duration-200 transform active:scale-[0.99] text-sm text-center"
						>
							Return Home
						</Link>
					)}

					<button
						onClick={handleSwitchAccounts}
						className="block w-full py-3 px-6 bg-white/5 border border-white/10 text-purple-200 font-medium rounded-xl hover:bg-white/10 hover:text-white transition duration-200 text-sm text-center cursor-pointer"
					>
						Switch Accounts
					</button>
				</div>
			</div>
		</div>
	);
};

export default Unauthorized;
