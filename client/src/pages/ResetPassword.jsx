import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/axiosInstance";
import logoImg from "/images/la.png";

const ResetPassword = () => {
	const { resetToken } = useParams();
	const navigate = useNavigate();

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setMessage("");
		setError("");

		if (password.length < 6) {
			return setError("Password must be at least 6 characters long.");
		}

		if (password !== confirmPassword) {
			return setError("Passwords do not match.");
		}

		setLoading(true);

		try {
			const res = await api.put(`/api/auth/reset-password/${resetToken}`, {
				password,
			});
			setMessage(res.data.message || "Password updated successfully!");
			setTimeout(() => {
				navigate("/login");
			}, 2500);
		} catch (err) {
			setError(err.response?.data?.error || "Failed to reset password. Link may be invalid or expired.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 bricolage-grotesque">
			<div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
				<div className="text-center mb-8">
					<img src={logoImg} alt="TaskGenie Logo" className="w-12 mx-auto mb-4" />
					<h2 className="text-2xl font-bold text-slate-900">Set New Password</h2>
					<p className="text-slate-600 mt-2">
						Please enter your new password below
					</p>
				</div>

				{error && (
					<div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-center text-sm font-medium">
						{error}
					</div>
				)}
				{message && (
					<div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg mb-4 text-center text-sm font-medium">
						{message} Redirecting to sign in...
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-5">
					<div>
						<label
							htmlFor="password"
							className="block text-sm font-semibold text-slate-800 mb-1"
						>
							New Password
						</label>
						<input
							id="password"
							type="password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full px-4 py-2 border border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition shadow-sm"
							placeholder="At least 6 characters"
						/>
					</div>

					<div>
						<label
							htmlFor="confirmPassword"
							className="block text-sm font-semibold text-slate-800 mb-1"
						>
							Confirm New Password
						</label>
						<input
							id="confirmPassword"
							type="password"
							required
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							className="w-full px-4 py-2 border border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition shadow-sm"
							placeholder="Re-enter your password"
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className={`cursor-pointer w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 rounded-lg transition-colors duration-200 shadow-md shadow-violet-500/20 ${
							loading ? "opacity-70 cursor-not-allowed" : ""
						}`}
					>
						{loading ? "Resetting Password..." : "Reset Password"}
					</button>
				</form>

				<div className="mt-6 text-center">
					<Link
						to="/login"
						className="text-sm text-violet-700 hover:text-violet-900 font-bold hover:underline"
					>
						Back to Sign In
					</Link>
				</div>
			</div>
		</div>
	);
};

export default ResetPassword;
