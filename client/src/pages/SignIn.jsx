import React, { useEffect, useRef, useState } from "react";
import Iridescence from "../ui/Iridescence";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import { Turnstile } from "@marsidev/react-turnstile";

import logoImg from "/images/taskgenie-logo.svg";
import signInImg from "/images/sign-in.jpg";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axiosInstance";

const SignIn = () => {
	const navigate = useNavigate();
	const turnstileRef = useRef();
	const [token, setToken] = useState("");

	const [form, setForm] = useState({
		email: "",
		password: "",
	});

	const HAIKUS = [
		{
			lines: [
				"The to-do list grows",
				"Weekend sun is shining bright",
				"We handle the chores",
			],
			author: "Reclaim Your Saturday",
		},
		{
			lines: [
				"Drip drip goes the sink",
				"Silence is a luxury",
				"Fixed in just one click",
			],
			author: "Peace of Mind",
		},
		{
			lines: [
				"Dust bunnies attack",
				"Guests arriving in an hour",
				"Genie saves the day",
			],
			author: "The Clean Sweep",
		},
		{
			lines: [
				"Furniture in box",
				"Instructions make zero sense",
				"Help is on the way",
			],
			author: "Assembly Required",
		},
		{
			lines: [
				"Grass is getting tall",
				"Allergies are kicking in",
				"Lawn is looking green",
			],
			author: "Curb Appeal",
		},
		{
			lines: [
				"Tools are heavy weight",
				"Skill is lighter than a feather",
				"Job done perfectly",
			],
			author: "Expert Hands",
		},
	];
	const [haiku, setHaiku] = useState(
		HAIKUS[Math.floor(Math.random() * HAIKUS.length)],
	);

	const handleChange = (e) => {
		setForm({ ...form, [e.target.name]: e.target.value });
	};

	useEffect(() => {
		const initGoogle = () => {
			if (
				window.google?.accounts?.id &&
				document.getElementById("googleButtonDiv")
			) {
				window.google.accounts.id.initialize({
					client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
					callback: handleGoogleResponse,
					itp_support: true,
				});

				window.google.accounts.id.renderButton(
					document.getElementById("googleButtonDiv"),
					{
						theme: "outline",
						size: "large",
						width: 400,
					},
				);
			}
		};

		if (window.google?.accounts?.id) {
			initGoogle();
		} else {
			const interval = setInterval(() => {
				if (window.google?.accounts?.id) {
					initGoogle();
					clearInterval(interval);
				}
			}, 300);
			const timer = setTimeout(() => clearInterval(interval), 4000);
			return () => {
				clearInterval(interval);
				clearTimeout(timer);
			};
		}
	}, []);

	const handleGoogleResponse = async (response) => {
		try {

			const res = await api.post("/api/auth/google", {
				googleToken: response.credential,
			});

			const { token } = res.data;
			localStorage.setItem("token", token);

			const decoded = jwtDecode(token);
			if (!decoded.role) {
				navigate("/choose-role");
			} else if (decoded.role === "provider") {
				navigate("/provider/dashboard");
			} else {
				navigate("/dashboard");
			}
		} catch (err) {
			console.error(err);
			if (err.code === 1) {
				alert("Location permission is required to sign in.");
			} else {
				alert("Google login failed");
			}
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!token) {
			return alert("Please verify you are human");
		}

		try {
			const res = await api.post("/api/auth/login", {
				...form,
				captchaToken: token,
			});

			const { token: authToken } = res.data;
			localStorage.setItem("token", authToken);

			const decoded = jwtDecode(authToken);
			if (decoded.role === "provider") {
				navigate("/provider/dashboard");
			} else {
				navigate("/dashboard");
			}
		} catch (err) {
			alert(err.response?.data?.error || "Login failed");

			setToken("");
			if (turnstileRef.current) {
				turnstileRef.current.reset();
			}
		}
	};

	return (
		<div className="bricolage-grotesque w-full min-h-screen overflow-hidden lg:grid lg:grid-cols-3">
			<div className="relative lg:col-span-2 flex flex-col p-5 overflow-hidden h-full">
				<div className="flex flex-col h-full z-10 relative">
					<div className="flex items-center mb-10">
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
						<div className="auth-card bg-[#ffffffbf] border border-[#5b21b613] backdrop-blur-2xl p-8 rounded-2xl shadow-xl w-full max-w-md" style={{ color: "#0f172a" }}>
							<h1 className="text-2xl font-bold text-slate-900 text-center mb-2 w-full max-w-md flex flex-col gap-y-3" style={{ color: "#0f172a" }}>
								Welcome Back
							</h1>
							<p className="auth-subtext text-slate-600 text-center mb-8" style={{ color: "#475569" }}>
								Sign in to continue to your dashboard
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
                                            text-slate-700 font-medium
                                            py-2 rounded-lg transition cursor-pointer
                                            bg-white border border-[#d4ceea]
                                            shadow-[inset_0px_1px_6px_1px_#E7E6F4]       
                                            hover:shadow-[inset_0_3px_6px_#ddd6fe]         
                                            active:shadow-[inset_0_0_6px_#ddd6fe]         
                                    "
										style={{ color: "#334155" }}
									>
										<img
											src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
											className="w-5 h-5"
											alt="Google Logo"
										/>
										Continue with Google
									</button>
								</div>
								<div className="flex items-center gap-4 my-4">
									<div className="flex-1 h-px bg-slate-300"></div>
									<span className="text-slate-600 text-sm" style={{ color: "#475569" }}>
										or continue with email
									</span>
									<div className="flex-1 h-px bg-slate-300"></div>
								</div>

								<form className="space-y-5" onSubmit={handleSubmit}>
									<div>
										<label htmlFor="email" className="block text-sm font-semibold text-slate-800 mb-1" style={{ color: "#1e293b" }}>
											Email
										</label>
										<input
											name="email"
											value={form.email}
											onChange={handleChange}
											type="email"
											style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
											className="
                                                w-full rounded-lg px-3 py-2
                                                border border-[#d4ceea] bg-white text-slate-900 placeholder-slate-400
                                                shadow-sm
                                                focus:outline-none
                                                focus:border-violet-500
                                                focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] transition duration-250
                                        "
										/>
									</div>

									<div>
										<div className="flex items-center justify-between mb-1">
											<label htmlFor="password" className="block text-sm font-semibold text-slate-800" style={{ color: "#1e293b" }}>
												Password
											</label>
											<Link
												to="/forgot-password"
												className="text-xs text-violet-700 hover:text-violet-900 hover:underline transition-colors font-medium"
											>
												Forgot password?
											</Link>
										</div>
										<input
											name="password"
											value={form.password}
											onChange={handleChange}
											type="password"
											style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
											className="
                                                w-full rounded-lg px-3 py-2
                                                border border-[#d4ceea] bg-white text-slate-900 placeholder-slate-400
                                                shadow-sm
                                                focus:outline-none
                                                focus:border-violet-500
                                                focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] transition duration-250
                                        "
										/>
									</div>

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

									<button className="cursor-pointer w-full bg-[#7c3aed] text-white py-2.5 rounded-lg font-bold hover:bg-[#5b21b6] transition duration-250 shadow-md shadow-violet-500/20">
										Sign In
									</button>
								</form>

								<p className="flex gap-1 items-center justify-center text-sm" style={{ color: "#475569" }}>
									<span className="text-slate-600" style={{ color: "#475569" }}>Don't have an account?</span>
									<Link
										to="/sign-up"
										className="text-violet-700 font-bold hover:underline transition duration-250"
									>
										Create one
									</Link>
								</p>
							</div>
						</div>
					</div>

					<footer className="auth-footer mx-auto mt-auto w-full max-w-md text-xs pt-18" style={{ color: "#475569" }}>
						<div className="text-center">
							<span className="text-slate-600" style={{ color: "#475569" }}>
								By signing up you agree to our{" "}
							</span>
							<a
								className="text-slate-800 font-medium underline underline-offset-2 decoration-1 decoration-slate-400 hover:text-violet-700 transition-all"
								style={{ color: "#1e293b" }}
								href="#"
							>
								terms of service
							</a>
							<span className="text-slate-600" style={{ color: "#475569" }}> and </span>
							<a
								className="text-slate-800 font-medium underline underline-offset-2 decoration-1 decoration-slate-400 hover:text-violet-700 transition-all"
								style={{ color: "#1e293b" }}
								href="#"
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

				<blockquote
					className="relative z-20 text-xl text-purple-900 animate-in fade-in duration-1000 leading-snug"
					style={{ fontFamily: '"P22Mackinac", serif' }}
				>
					{haiku.lines.map((line, index) => (
						<p key={index}>{line}</p>
					))}

					<cite
						className="block not-italic text-xl mt-8 opacity-80"
						style={{ fontFamily: '"P22Mackinac", serif' }}
					>
						<span className="opacity-40 mr-2">—</span>
						{haiku.author}
					</cite>
				</blockquote>
			</aside>
		</div>
	);
};

export default SignIn;
