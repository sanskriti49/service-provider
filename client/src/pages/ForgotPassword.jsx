import { useState } from "react";
import api from "../api/axiosInstance";
import { Link } from "react-router-dom";
import logoImg from "/images/taskgenie-logo.svg";

const ForgotPassword = () => {
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setMessage("");
		setError("");
		setLoading(true);

		try {
			await api.post("/api/auth/forgot-password", { email });
			setMessage("Email sent! Check your inbox for the reset link.");
		} catch (err) {
			setError(err.response?.data?.error || "Failed to send email");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 bricolage-grotesque">
			<div className="auth-card w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100" style={{ color: "#0f172a" }}>
				<div className="text-center mb-8">
					<img src={logoImg} alt="TaskGenie Logo" className="w-12 mx-auto mb-4" />
					<h2 className="text-2xl font-bold text-slate-900" style={{ color: "#0f172a" }}>Forgot Password</h2>
					<p className="auth-subtext text-slate-600 mt-2" style={{ color: "#475569" }}>
						Enter your email to receive a password reset link
					</p>
				</div>

				{error && (
					<div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-center text-sm font-medium">
						{error}
					</div>
				)}
				{message && (
					<div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg mb-4 text-center text-sm font-medium">
						{message}
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label
							htmlFor="email"
							className="block text-sm font-semibold text-slate-800 mb-1"
							style={{ color: "#1e293b" }}
						>
							Email Address
						</label>
						<input
							id="email"
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
							className="w-full px-4 py-2 border border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition shadow-sm"
							placeholder="you@example.com"
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className={`cursor-pointer w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 rounded-lg transition-colors duration-200 shadow-md shadow-violet-500/20 ${
							loading ? "opacity-70 cursor-not-allowed" : ""
						}`}
					>
						{loading ? "Sending..." : "Send Reset Link"}
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

export default ForgotPassword;
