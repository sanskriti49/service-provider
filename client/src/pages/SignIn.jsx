import React, { useEffect, useRef, useState } from "react";
import Iridescence from "../ui/Iridescence";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import { Turnstile } from "@marsidev/react-turnstile";

import logoImg from "/images/la.png";
import signInImg from "/images/sign-in.jpg";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";

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
		HAIKUS[Math.floor(Math.random() * HAIKUS.length)]
	);

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
		<div className="bricolage-grotesque w-full overflow-hidden lg:grid lg:grid-cols-3">
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
						<div className="bg-[#ffffffbf] border border-[#5b21b613] backdrop-blur-2xl p-8 rounded-2xl shadow-xl w-full max-w-md ">
							<h1 className="text-2xl text-center mb-2 w-full max-w-md flex flex-col gap-y-3">
								Welcome Back
							</h1>
							<p className="text-gray-700 text-center mb-8">
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
										Sign in with Google
									</button>
								</div>
								<div className="flex items-center gap-4 my-4">
									<div className="flex-1 h-px bg-gray-300"></div>
									<span className="text-gray-600 text-sm">
										or continue with email
									</span>
									<div className="flex-1 h-px bg-gray-300"></div>
								</div>

								<form className="space-y-5" onSubmit={handleSubmit}>
									<label htmlFor="email">Email</label>
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

									<label htmlFor="password">Password</label>
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

									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<label
												htmlFor="password"
												className="block text-gray-700 font-medium"
											></label>
											<Link
												to="/forgot-password"
												className="text-sm text-violet-600 hover:text-violet-800 hover:underline transition-colors font-medium"
											>
												Forgot password?
											</Link>
										</div>
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

									<button className="cursor-pointer w-full bg-[#7c3aed] text-white py-2 rounded-lg font-medium hover:bg-[#5b21b6] transition duration-250">
										Sign In
									</button>
								</form>

								<p className="flex gap-1 items-center justify-center text-sm">
									<span className="text-gray-700">Don't have an account?</span>
									<Link
										to="/sign-up"
										className="text-violet-900 hover:underline transition duration-250"
									>
										Create one
									</Link>
								</p>
							</div>
						</div>
					</div>

					<footer className="mx-auto mt-auto w-full max-w-md text-xs pt-18">
						<div className="text-center">
							<span className="text-gray-700">
								By signing up you agree to our{" "}
							</span>
							<a
								className="underline underline-offset-2 decoration-1 decoration-navy-300 hover:text-violet-600 transition-all"
								href="#"
							>
								terms of service
							</a>
							<span className="text-gray-700"> and </span>
							<a
								className="underline underline-offset-2 decoration-1 decoration-navy-300 hover:text-violet-600 transition-all"
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
