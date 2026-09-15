import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import ConfirmDialog from "../ui/ConfirmDialog";

const Unauthorized = () => {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
	const isProvider = user?.role === "provider";

	const handleSwitchAccounts = (e) => {
		e.preventDefault();
		setShowLogoutConfirm(true);
	};

	return (
		<div
			className="flex flex-col items-center justify-center h-screen bg-cover bg-center bg-no-repeat px-4 select-none"
			style={{ backgroundImage: `url('/images/error.jpg')` }}
		>
			<div className="font-geist max-w-md w-full backdrop-blur-xl bg-purple-950/40 border border-white/10 p-8 rounded-2xl shadow-2xl text-center flex flex-col items-center">
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

				<div className="w-full space-y-3">
					{isProvider ? (
						<Link
							to="/provider/dashboard"
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

			<ConfirmDialog
				isOpen={showLogoutConfirm}
				onClose={() => setShowLogoutConfirm(false)}
				onConfirm={async () => {
					setShowLogoutConfirm(false);
					if (logout) await logout();
					navigate("/login");
				}}
				title="Sign out to change profiles?"
				description="You'll be logged out of your current session to sign in with a different profile ID."
				confirmText="Log out"
				cancelText="Cancel"
				variant="danger"
			/>
		</div>
	);
};

export default Unauthorized;
