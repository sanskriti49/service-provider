import { useState } from "react";
import api from "../api/axios";
import { Link } from "react-router-dom";
import logoImg from "/images/la.png";

const ForgotPassword = () => {
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = async (e) => {
		e.preventDefault();
		setMessage("");
		setError("");

		try {
			await api.post("/api/auth/forgotpassword", { email });
			setMessage("Email sent! Check your inbox for the reset link.");
		} catch (err) {
			setError(err.response?.data?.error || "Failed to send email");
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 bricolage-grotesque">
			<div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
				<div className="text-center mb-8">
					<img src={logoImg} alt="Logo" className="w-12 mx-auto mb-4" />
					<h2 className="text-2xl font-bold text-gray-800">Reset Password</h2>
					<p className="text-gray-500 mt-2">
						Enter your email to receive a reset link
					</p>
				</div>

				{error && (
					<div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center text-sm">
						{error}
					</div>
				)}
				{message && (
					<div className="bg-green-100 text-green-700 p-3 rounded-lg mb-4 text-center text-sm">
						{message}
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label
							htmlFor="email"
							className="block text-sm font-medium text-gray-700 mb-1"
						>
							Email Address
						</label>
						<input
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition"
							placeholder="you@example.com"
						/>
					</div>

					<button
						type="submit"
						className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-lg transition-colors duration-200"
					>
						Send Reset Link
					</button>
				</form>

				<div className="mt-6 text-center">
					<Link
						to="/login"
						className="text-sm text-violet-600 hover:text-violet-800 font-medium hover:underline"
					>
						Back to Sign In
					</Link>
				</div>
			</div>
		</div>
	);
};

export default ForgotPassword;
