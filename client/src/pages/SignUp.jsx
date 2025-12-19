import React, { useEffect, useRef, useState } from "react";

import logoImg from "/images/la.png";
import signInImg from "/images/sign-in.jpg";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Turnstile } from "@marsidev/react-turnstile";
import api from "../api/axios";

const SignUp = () => {
	const navigate = useNavigate();
	const turnstileRef = useRef();
	const [token, setToken] = useState("");
	const [loading, setLoading] = useState(false);

	const [form, setForm] = useState({
		name: "",
		email: "",
		password: "",
		role: "",
	});

	const handleChange = (e) => {
		setForm({ ...form, [e.target.name]: e.target.value });
	};
	useEffect(() => {
		window.google.accounts.id.initialize({
			client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
			callback: handleGoogleResponse,
		});

		window.google.accounts.id.renderButton(
			document.getElementById("googleButtonDiv"),
			{
				theme: "outline",
				size: "large",
				width: 400,
			}
		);
	}, []);

	const handleGoogleResponse = async (response) => {
		try {
			const position = await new Promise((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(resolve, reject);
			});
			const lat = position.coords.latitude;
			const lng = position.coords.longitude;

			const res = await api.post("/api/auth/google", {
				googleToken: response.credential,
				lat,
				lng,
			});
			const { token, user } = res.data;
			localStorage.setItem("token", token);

			if (!user.role) {
				navigate("/choose-role");
			} else if (user.role === "provider") {
				navigate("/provider/dashboard");
			} else {
				navigate("/dashboard");
			}
		} catch (err) {
			console.error(err);
			alert("Google login failed");
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!form.role) {
			return alert("Please select a role");
		}

		if (!token) {
			return alert("Please verify you are human");
		}
		setLoading(true);

		try {
			const res = await api.post("/api/auth/register", {
				...form,
				captchaToken: token,
			});
			// get token and user data from the response
			const { token: authToken, user } = res.data;
			localStorage.setItem("token", authToken);

			alert("Account created!");
			if (form.role === "provider") {
				navigate("/provider/dashboard");
			} else {
				navigate("/dashboard");
			}
		} catch (err) {
			console.log(err);
			alert(err.response?.data?.error || err.message);

			setToken("");
			if (turnstileRef.current) {
				turnstileRef.current.reset();
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="bricolage-grotesque w-full overflow-hidden lg:grid lg:grid-cols-3">
			<div className="relative lg:col-span-2 flex flex-col p-5 overflow-hidden h-full">
				<div className="flex flex-col h-full z-10 relative">
					<div className="flex items-center mb-8">
						<div className=" w-14 flex items-center cursor-pointer">
							<img
								src={logoImg}
								className="h-full w-full"
								alt="TaskGenie Logo"
							/>
						</div>
						<p className="text-3xl lobster font-bold bg-gradient-to-r from-violet-700 via-fuchsia-700 to-fuchsia-700 bg-clip-text text-transparent drop-shadow-md tracking-tight cursor-pointer hover:scale-105 transition-transform">
							TaskGenie
						</p>
					</div>

					<div className="flex-1 flex flex-col justify-center items-center">
						<div className="bg-[#ffffffbf] border border-[#5b21b613] backdrop-blur-2xl p-8 rounded-2xl shadow-xl w-full max-w-md ">
							<h1 className="text-2xl text-center mb-2 w-full max-w-md flex flex-col gap-y-3">
								Sign up for an Account
							</h1>
							<p className="text-gray-700 text-center mb-8">
								Join us to manage your tasks efficiently
							</p>

							<div className="space-y-4">
								<div className="relative w-full">
									<div
										id="googleButtonDiv"
										className="absolute inset-0 z-10 opacity-0 overflow-hidden flex items-center justify-center cursor-pointer"
									></div>

									<button
										type="button"
										className="
											w-full flex items-center justify-center gap-2
											text-gray-700 font-medium
											py-2 rounded-lg transition cursor-pointer
											bg-white border border-[#d4ceea]
											shadow-[inset_0px_1px_6px_1px_#E7E6F4]       
											hover:shadow-[inset_0_3px_6px_#ddd6fe]         
											active:shadow-[inset_0_0_6px_#ddd6fe]         
										"
									>
										<img
											src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
											className="w-5 h-5"
											alt="Google Logo"
										/>
										Sign up with Google
									</button>
								</div>

								<div className="flex items-center gap-4 my-4">
									<div className="flex-1 h-px bg-gray-300"></div>
									<span className="text-gray-600 text-sm">or</span>
									<div className="flex-1 h-px bg-gray-300"></div>
								</div>

								<form className="space-y-5" onSubmit={handleSubmit}>
									<div className="space-y-2">
										<label className="text-gray-700">I am signing up as:</label>

										<div className="flex gap-4" onSubmit={handleSubmit}>
											<label className="flex items-center gap-2 cursor-pointer">
												<input
													type="radio"
													name="role"
													value="customer"
													onChange={handleChange}
													className="accent-violet-600"
												/>
												Customer
											</label>

											<label className="flex items-center gap-2 cursor-pointer">
												<input
													type="radio"
													name="role"
													value="provider"
													onChange={handleChange}
													className="accent-violet-600"
												/>
												Provider
											</label>
										</div>
									</div>

									<label htmlFor="name">Full Name</label>
									<input
										name="name"
										value={form.name}
										onChange={handleChange}
										type="text"
										className="capitalize
											w-full rounded-lg px-3 py-2
											border border-[#d4ceea]
											shadow-sm
											focus:outline-none
											focus:border-violet-500
											focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] transition duration-250
										"
									/>

									<label htmlFor="name">Email</label>
									<input
										name="email"
										value={form.email}
										onChange={handleChange}
										type="email"
										className="
											w-full rounded-lg px-3 py-2
											border border-[#d4ceea]
											shadow-sm
											focus:outline-none
											focus:border-violet-500
											focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] transition duration-250
										"
									/>

									<label htmlFor="name">Password</label>
									<input
										name="password"
										value={form.password}
										onChange={handleChange}
										type="password"
										className="
											w-full rounded-lg px-3 py-2
											border border-[#d4ceea]
											shadow-sm
											focus:outline-none
											focus:border-violet-500
											focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] transition duration-250
										"
									/>

									<div className="flex justify-center">
										<Turnstile
											ref={turnstileRef}
											siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
											onSuccess={(token) => setToken(token)}
											onError={() => alert("Verification failed")}
											options={{
												theme: "light",
												size: "flexible",
											}}
										/>
									</div>

									<button
										disabled={loading}
										className={`cursor-pointer w-full bg-[#7c3aed] text-white py-2 rounded-lg font-medium hover:bg-[#5b21b6] transition duration-250 ${
											loading ? "opacity-70 cursor-not-allowed" : ""
										}`}
									>
										{loading ? "Creating..." : "Create Account"}{" "}
									</button>
								</form>

								<p className="flex gap-1 items-center justify-center text-gray-700 text-sm">
									Already have an account?
									<Link
										to="/login"
										className="text-violet-700 font-medium hover:underline transition duration-250"
									>
										Sign in
									</Link>
								</p>
							</div>
						</div>
					</div>

					<footer className="mx-auto mt-auto w-full max-w-md text-xs pt-6">
						<div className="text-center">
							<span className="text-gray-700">
								By signing up you agree to our{" "}
							</span>
							<a
								className="text-navy underline underline-offset-2 decoration-1 decoration-navy-300 hover:text-violet-600 transition-all"
								href="#"
								//	target="_blank"
							>
								terms of service
							</a>
							<span className="text-gray-700"> and </span>
							<a
								className="text-navy underline underline-offset-2 decoration-1 decoration-navy-300 hover:text-violet-600 transition-all"
								href="#"
								//	target="_blank"
							>
								privacy policy
							</a>
							.
						</div>
					</footer>
				</div>
			</div>

			<aside className="relative hidden lg:block lg:w-[28rem] xl:w-[32rem] h-full p-16">
				<img
					src={signInImg}
					className="absolute inset-0 max-w-none w-full h-full object-cover"
					alt=""
				/>
				<blockquote className="relative z-20 text-xl font-heading text-purple-900">
					<p className="leading-tight">A fresh start awaits</p>

					<p className="leading-tight">Your tasks, your flow, your new space</p>

					<p className="leading-tight">Come create with us</p>

					<cite className="block not-italic text-xl mt-6">
						<span className="opacity-40">—</span>Your journey begins here
					</cite>
				</blockquote>
			</aside>
		</div>
	);
};

export default SignUp;
