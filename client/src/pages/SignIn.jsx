import React, { useEffect, useState } from "react";
import Iridescence from "../ui/Iridescence";
import { jwtDecode } from "jwt-decode";
import axios from "axios";

import logoImg from "/images/la.png";
import signInImg from "/images/sign-in.jpg";
import { Link, useNavigate } from "react-router-dom";

const SignIn = () => {
	const navigate = useNavigate();

	const [form, setForm] = useState({
		email: "",
		password: "",
	});

	const handleChange = (e) => {
		setForm({ ...form, [e.target.name]: e.target.value });
	};

	// useEffect(() => {
	// 	window.google.accounts.id.initialize({
	// 		client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
	// 		callback: handleGoogleResponse,
	// 	});

	// 	window.google.accounts.id.renderButton(
	// 		document.getElementById("googleButtonDiv"),
	// 		{ theme: "outline", size: "large" }
	// 	);
	// }, []);
	useEffect(() => {
		/* Initialize Google Accounts */
		window.google.accounts.id.initialize({
			client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
			callback: handleGoogleResponse,
		});

		/* Render the button via Google API */
		window.google.accounts.id.renderButton(
			document.getElementById("googleButtonDiv"),
			{
				theme: "outline",
				size: "large",
				width: 400, // Make it wide enough to cover your container
			}
		);
	}, []);

	const handleGoogleLogin = () => {
		// const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

		// // Debugging: Check if ID is loaded
		// console.log("Google Client ID:", clientId);

		// if (!clientId) {
		// 	alert("Google Client ID is missing! Check your .env file.");
		// 	return;
		// }

		// window.google.accounts.id.initialize({
		// 	client_id: clientId,
		// 	callback: handleGoogleResponse,
		// });

		window.google.accounts.id.prompt();
	};

	const handleGoogleResponse = async (response) => {
		try {
			const googleToken = response.credential;
			const res = await axios.post("http://localhost:3000/api/auth/google", {
				googleToken,
			});

			const { token } = res.data;
			localStorage.setItem("token", token);

			const decoded = jwtDecode(token);
			if (decoded.role === "provider") {
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

		try {
			const res = await axios.post(
				"http://localhost:3000/api/auth/login",
				form
			);

			// const token = res.data.token;
			const { token } = res.data;
			localStorage.setItem("token", token);

			const decoded = jwtDecode(token);
			if (decoded.role == "provider") {
				navigate("/provider/dashboard");
			} else {
				navigate("/dashboard");
			}
		} catch (err) {
			alert(err.response?.data?.error || "Login failed");
		}
	};
	return (
		<div className="bricolage-grotesque w-full overflow-hidden lg:grid lg:grid-cols-3">
			<div className="relative lg:col-span-2 flex flex-col p-5 overflow-hidden h-full">
				{/* Background Effect
				<div className="absolute inset-0 -z-10">
					<Iridescence
						color={[0.5, 0.6, 0.8]}
						mouseReact={false}
						amplitude={0.1}
						speed={1.0}
					/>
				</div> */}

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
								{/* Sign /in With Google */}
								<div className="relative w-full">
									{/* 1. INVISIBLE GOOGLE BUTTON (Captures the click) */}
									<div
										id="googleButtonDiv"
										className="absolute inset-0 z-10 opacity-0 overflow-hidden flex items-center justify-center cursor-pointer"
									></div>

									{/* 2. VISIBLE CUSTOM BUTTON (Visuals only) */}
									{/* Note: We removed onClick={handleGoogleLogin} because the div above catches the click */}
									<button
										type="button" // Prevent form submission
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
								{/* Divider */}
								<div className="flex items-center gap-4 my-4">
									<div className="flex-1 h-px bg-gray-300"></div>
									<span className="text-gray-600 text-sm">
										or continue with email
									</span>
									<div className="flex-1 h-px bg-gray-300"></div>
								</div>

								<form className="space-y-5" onSubmit={handleSubmit}>
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

									<button className="cursor-pointer w-full bg-[#7c3aed] text-white py-2 rounded-lg font-medium hover:bg-[#5b21b6] transition duration-250">
										Sign In
									</button>
								</form>

								{/* Already have account */}
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
								//	target="_blank"
							>
								terms of service
							</a>
							<span className="text-gray-700"> and </span>
							<a
								className="underline underline-offset-2 decoration-1 decoration-navy-300 hover:text-violet-600 transition-all"
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

			{/* --- RIGHT SIDE (25% Width) --- */}
			<aside className="relative hidden lg:block lg:w-[28rem] xl:w-[32rem] h-full p-16">
				<img
					src={signInImg}
					className="absolute inset-0 max-w-none w-full h-full object-cover"
					alt=""
				/>
				<blockquote className="relative z-20 text-2xl font-heading text-purple-900">
					<p className="leading-tight">A gentle reminder</p>
					<p className="leading-tight">Your tasks await your return</p>
					<p className="leading-tight">Please sign in to start</p>

					<cite className="block not-italic text-xl mt-6">
						<span className="opacity-40">—</span>A welcoming haiku
					</cite>
				</blockquote>
			</aside>
		</div>
	);
};

export default SignIn;
