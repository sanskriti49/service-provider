import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@mui/material";
import { Navigation, MapPin, Phone } from "lucide-react";
import Alerts from "../ui/Alerts";
import api from "../api/axios";

const SettingsPage = () => {
	const navigate = useNavigate();
	const [user, setUser] = useState(
		JSON.parse(localStorage.getItem("user") || "{}")
	);

	const [address, setAddress] = useState(user.address || "");
	const [addressLoading, setAddressLoading] = useState(false);

	const [phone, setPhone] = useState(user.phone || "");
	const [phoneLoading, setPhoneLoading] = useState(false);

	const [alert, setAlert] = useState(null);

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const getInitials = (name) => {
		if (!name) return "U";
		const parts = name.split(" ");
		return `${parts[0][0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
	};

	const updateProfile = async (dataToUpdate, specificLoadingSet) => {
		try {
			if (specificLoadingSet) specificLoadingSet(true);
			const token = localStorage.getItem("token");

			const payload = {
				...dataToUpdate,
				address:
					(dataToUpdate.address != undefined
						? dataToUpdate.address
						: address) || undefined,
				phone:
					(dataToUpdate.phone !== undefined ? dataToUpdate.phone : phone) ||
					undefined,
			};

			const response = await api.put(`/api/users/${user.id}`, payload, {
				headers: { Authorization: `Bearer ${token}` },
			});

			const updatedUser = { ...user, ...response.data.user };

			if (response.data.user.location) {
				setAddress(response.data.user.location);
			} else if (response.data.user.address) {
				setAddress(response.data.user.address);
			}

			if (response.data.user.phone) {
				setPhone(response.data.user.phone);
			}

			localStorage.setItem("user", JSON.stringify(updatedUser));
			setUser(updatedUser);

			setAlert({
				type: "success",
				message: "Profile updated successfully!",
			});
		} catch (err) {
			console.error(err);
			setAlert({
				type: "error",
				message: err.response?.data?.error || "Failed to update profile.",
			});
		} finally {
			if (specificLoadingSet) specificLoadingSet(false);
		}
	};

	const handleCurrentLocation = () => {
		if (!navigator.geolocation) {
			return setAlert({
				type: "error",
				message: "Geolocation is not supported by your browser.",
			});
		}

		setAddressLoading(true);

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const { latitude, longitude } = position.coords;

				updateProfile({
					lat: latitude,
					lng: longitude,
					location: "",
					address: "",
				});
			},
			(error) => {
				console.error(error);
				setAddressLoading(false);
				setAlert({
					type: "error",
					message: "Unable to retrieve your location.",
				});
			}
		);
	};

	useEffect(() => {
		const fetchUserData = async () => {
			const token = localStorage.getItem("token");
			if (!token) {
				navigate("/login");
				return;
			}
			try {
				const response = await api.get("/api/auth/me", {
					headers: { Authorization: `Bearer ${token}` },
				});
				setUser(response.data.user);
				localStorage.setItem("user", JSON.stringify(response.data.user));
			} catch (err) {
				console.error("Failed to fetch user", err);
				handleLogout();
			}
		};
		fetchUserData();
	}, [navigate]);

	useEffect(() => {
		if (user.location) setAddress(user.location);
		else if (user.address) setAddress(user.address);
	}, [user]);

	const handleLogout = () => {
		localStorage.removeItem("token");
		localStorage.removeItem("user");
		navigate("/login");
	};

	const handlePasswordUpdate = async () => {
		if (password.length < 6)
			return alert("Password must be at least 6 characters");
		if (password !== confirmPassword) return alert("Passwords do not match");

		try {
			setLoading(true);
			const token = localStorage.getItem("token");

			await api.post(
				"/api/auth/update-password",
				{ newPassword: password },
				{ headers: { Authorization: `Bearer ${token}` } }
			);

			alert(
				user.isGoogleUser
					? "Password created! You can now log in with email."
					: "Password updated successfully!"
			);
			setPassword("");
			setConfirmPassword("");

			const updatedUser = { ...user, isGoogleUser: false };
			localStorage.setItem("user", JSON.stringify(updatedUser));
			setUser(updatedUser);
		} catch (err) {
			console.error(err);
			setAlert({
				type: "error",
				message: "Failed to update password!",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="-mt-40 min-h-screen bg-[#fdfdff] text-[#191034] p-6 md:p-12 bricolage-grotesque">
			{alert && (
				<Alerts
					message={alert.message}
					type={alert.type}
					onClose={() => setAlert(null)}
				/>
			)}
			<div className="max-w-5xl mx-auto space-y-8">
				<div className="border-b border-[#e7e6f4] pb-6">
					<h1 className="text-4xl font-bold bg-gradient-to-r from-violet-700 via-fuchsia-700 to-fuchsia-700 bg-clip-text text-transparent">
						Account Settings
					</h1>
					<p className="text-gray-500 mt-2 text-lg">
						Manage your profile and security preferences.
					</p>
				</div>

				<div className="grid md:grid-cols-3 gap-8">
					<div className="md:col-span-1">
						<div className="bg-white border border-[#e7e6f4] p-8 rounded-3xl flex flex-col items-center text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
							<div className="relative w-28 h-28 mb-6 flex items-center justify-center">
								{user.photo ? (
									<img
										src={user.photo.replace("=s96-c", "=s256-c")}
										alt="Profile"
										referrerPolicy="no-referrer"
										crossOrigin="anonymous"
										onError={(e) => {
											e.currentTarget.style.display = "none";
										}}
										className="w-full h-full object-cover rounded-full
        border-4 border-white shadow-lg ring-1 ring-[#e7e6f4]"
									/>
								) : (
									<Avatar
										sx={{
											width: 112,
											height: 112,
											fontSize: "2rem",
											fontWeight: "bold",
											background: "linear-gradient(135deg, #7c3aed, #c026d3)",
											color: "#fff",
											border: "4px solid white",
											boxShadow: "0 8px 24px rgba(124,58,237,0.35)",
										}}
									>
										{getInitials(user.name || user.email)}
									</Avatar>
								)}

								<div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full" />
							</div>

							<h2 className="cursor-default text-2xl font-bold capitalize text-[#191034]">
								{user.name || "User"}
							</h2>
							<p className="text-gray-500 cursor-default mb-6 font-medium">
								{user.email}
							</p>

							<span
								className={`cursor-default px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border
                                ${
																	user.role === "provider"
																		? "bg-purple-50 text-purple-700 border-purple-100"
																		: "bg-blue-50 text-blue-700 border-blue-100"
																}`}
							>
								{user.role || "No Role"}
							</span>
						</div>
					</div>

					<div className="md:col-span-2 space-y-8">
						<div
							className="bg-white border border-[#e7e6f4] p-8 rounded-3xl
					shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
						>
							<div className="flex items-center gap-4 mb-6">
								<div className="p-2 bg-violet-500/10 w-fit rounded-lg shrink-0">
									<Phone className="w-5 h-5 text-violet-400" />
								</div>
								<h3 className="text-xl font-bold text-[#191034]">
									Contact Information
								</h3>
							</div>
							<div className="space-y-4">
								<div>
									<label className="text-sm font-medium text-gray-600 mb-2 block">
										Phone Number
									</label>
									<input
										type="text"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
										placeholder="+91 9876543210"
										className="w-full rounded-xl px-4 py-3 border border-[#d4ceea] shadow-sm bg-white 
                                        focus:outline-none focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] 
                                        transition duration-200"
									/>
									<p className="text-xs text-gray-400 mt-2">
										Format: +91 followed by 10 digits
									</p>
								</div>

								<div className="flex justify-end">
									<button
										onClick={() => updateProfile({ phone }, setPhoneLoading)}
										disabled={phoneLoading}
										className="cursor-pointer flex justify-center items-center gap-2
                                        bg-[#7c3aed] text-white px-6 py-2.5 rounded-xl font-semibold
                                        hover:bg-[#6d28d9] transition-all duration-200
                                        shadow-[0_6px_20px_rgba(124,58,237,0.35)]
                                        disabled:opacity-60 disabled:pointer-events-none"
									>
										{phoneLoading ? "Saving..." : "Save Phone"}
									</button>
								</div>
							</div>
						</div>

						<div className="bg-white border border-[#e7e6f4] p-8 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
							<div className="flex items-center justify-between mb-6">
								<div className="flex items-center gap-4">
									<div className="p-2 bg-violet-500/10 w-fit rounded-lg shrink-0">
										<Navigation className="w-5 h-5 text-violet-400" />
									</div>
									<h3 className="text-xl font-bold text-[#191034]">
										Address Details
									</h3>
								</div>

								<button
									onClick={handleCurrentLocation}
									title="Use Current Location"
									className="cursor-pointer text-sm flex items-center gap-2 text-violet-600 hover:text-violet-800 font-semibold transition-colors"
								>
									<MapPin className="w-4 h-4" />
									<span className="cursor-pointer">Use GPS</span>
								</button>
							</div>

							<div className="space-y-4">
								<div>
									<label className="text-sm font-medium text-gray-600 mb-2 block">
										Permanent Address
									</label>
									<div className="relative">
										<textarea
											value={address}
											onChange={(e) => setAddress(e.target.value)}
											placeholder="Enter your street, city, state, and zip code..."
											rows="3"
											className="w-full rounded-xl px-4 py-3 border border-[#d4ceea] shadow-sm bg-white 
                                        focus:outline-none focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] 
                                        transition duration-200 resize-none"
										/>
									</div>
								</div>

								<div className="flex justify-end">
									<button
										onClick={() => updateProfile({ address })} // Send manual text
										disabled={addressLoading}
										className="cursor-pointer flex justify-center items-center gap-2
                                    bg-[#7c3aed] text-white px-6 py-2.5 rounded-xl font-semibold
                                    hover:bg-[#6d28d9] transition-all duration-200
                                    shadow-[0_6px_20px_rgba(124,58,237,0.35)]
                                    disabled:opacity-60 disabled:pointer-events-none"
									>
										{addressLoading ? "Processing..." : "Save Address"}
									</button>
								</div>
							</div>
						</div>
						<div className="md:col-span-2 space-y-8">
							<div className="bg-white border border-[#e7e6f4] p-8 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
								<h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-[#191034]">
									<span className="bg-violet-100 p-2 rounded-lg text-violet-700">
										🔒
									</span>{" "}
									Security
								</h3>

								{user.isGoogleUser ? (
									<div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl mb-4">
										<div className="flex items-start gap-4">
											<div className="text-2xl">⚠️</div>
											<div className="w-full">
												<h4 className="font-bold text-amber-900">
													Set a Password
												</h4>
												<p className="text-sm text-amber-700/80 mt-1 mb-6">
													You currently log in via Google. Create a password to
													enable email login as a backup.
												</p>
												<div className="grid gap-4 max-w-md">
													<input
														type="password"
														placeholder="New Password"
														value={password}
														onChange={(e) => setPassword(e.target.value)}
														className="w-full rounded-xl px-4 py-3 border border-[#d4ceea] shadow-sm bg-white focus:outline-none focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] transition duration-200"
													/>
													<input
														type="password"
														placeholder="Confirm Password"
														value={confirmPassword}
														onChange={(e) => setConfirmPassword(e.target.value)}
														className="w-full rounded-xl px-4 py-3 border border-[#d4ceea] shadow-sm bg-white focus:outline-none focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] transition duration-200"
													/>
													<button
														onClick={handlePasswordUpdate}
														disabled={loading}
														className="
														cursor-pointer min-w-[180px]
														flex justify-center items-center
														bg-[#7c3aed] text-white
														px-6 py-3 rounded-xl font-semibold
														hover:bg-[#6d28d9]
														transition-all duration-200
														shadow-[0_6px_20px_rgba(124,58,237,0.35)]
														disabled:opacity-60 disabled:pointer-events-none
													"
													>
														{loading ? "Creating..." : "Create Password"}
													</button>
												</div>
											</div>
										</div>
									</div>
								) : (
									<div>
										<h4 className="font-semibold text-gray-700 mb-4">
											Change Password
										</h4>
										<div className="space-y-4 max-w-md">
											<div>
												<label className="text-sm font-medium text-gray-600 mb-1 block">
													New Password
												</label>
												<input
													type="password"
													value={password}
													onChange={(e) => setPassword(e.target.value)}
													className="w-full rounded-xl px-4 py-3 border border-[#d4ceea] shadow-sm bg-white focus:outline-none focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] transition duration-200"
												/>
											</div>
											<div>
												<label className="text-sm font-medium text-gray-600 mb-1 block">
													Confirm New Password
												</label>
												<input
													type="password"
													value={confirmPassword}
													onChange={(e) => setConfirmPassword(e.target.value)}
													className="w-full rounded-xl px-4 py-3 border border-[#d4ceea] shadow-sm bg-white focus:outline-none focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] transition duration-200"
												/>
											</div>
											<div className="pt-2">
												<button
													onClick={handlePasswordUpdate}
													disabled={loading}
													className="
													cursor-pointer min-w-[180px]
													flex justify-center items-center
													bg-[#7c3aed] text-white
													px-6 py-3 rounded-xl font-semibold
													hover:bg-[#6d28d9]
													transition-all duration-200
													shadow-[0_6px_20px_rgba(124,58,237,0.35)]
													disabled:opacity-60 disabled:pointer-events-none
												"
												>
													{loading ? "Updating..." : "Update Password"}
												</button>
											</div>
										</div>
									</div>
								)}
							</div>

							<div className="bg-red-50/50 border border-red-100 p-8 rounded-3xl">
								<h3 className="text-xl font-bold text-red-600 mb-4">
									Danger Zone
								</h3>
								<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
									<p className="text-red-700/70 text-sm font-medium">
										Sign out of your account on this device.
									</p>
									<button
										onClick={handleLogout}
										className="cursor-pointer
										border border-red-200 bg-white text-red-600
										px-6 py-2.5 rounded-xl font-semibold
										hover:bg-red-50 hover:border-red-300
										transition-all duration-200
										shadow-sm
									"
									>
										Log Out
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SettingsPage;
