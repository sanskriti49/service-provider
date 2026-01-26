import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@mui/material";
import {
	MapPin,
	Phone,
	User,
	Mail,
	Lock,
	ShieldCheck,
	CheckCircle2,
	Eye,
	EyeOff,
	Save,
} from "lucide-react";
import Alerts from "../ui/Alerts";
import api from "../api/axios";

const SaveButton = ({ loading, disabled, onClick, label, loadingLabel }) => (
	<button
		onClick={onClick}
		disabled={disabled || loading}
		className={`w-full flex items-center justify-center gap-2 text-sm font-bold py-3 px-6 rounded-xl transition-all duration-200 ${
			disabled || loading
				? "bg-gray-100 text-gray-400 cursor-not-allowed"
				: "bg-violet-700 text-white hover:bg-violet-800 shadow-lg shadow-violet-200 cursor-pointer hover:-translate-y-0.5"
		}`}
	>
		{loading ? (
			loadingLabel || "Saving..."
		) : (
			<>
				<Save size={18} /> {label || "Save Changes"}
			</>
		)}
	</button>
);

const PasswordInput = ({
	value,
	onChange,
	placeholder,
	show,
	toggleShow,
	disabled = false,
}) => (
	<div className="relative group">
		<input
			type={show ? "text" : "password"}
			placeholder={placeholder}
			value={value}
			onChange={onChange}
			disabled={disabled}
			className="w-full px-4 py-3.5 pr-12 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none text-sm bg-white transition-all font-medium disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400"
		/>
		<button
			type="button"
			onClick={() => toggleShow(!show)}
			className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all cursor-pointer"
			tabIndex="-1"
		>
			{show ? <EyeOff size={18} /> : <Eye size={18} />}
		</button>
	</div>
);

const SettingsPage = () => {
	const navigate = useNavigate();

	const [user, setUser] = useState(
		JSON.parse(localStorage.getItem("user") || "{}"),
	);

	const [name, setName] = useState(user.name || "");
	const [nameLoading, setNameLoading] = useState(false);

	const [email, setEmail] = useState(user.email || "");
	const [isEditingEmail, setIsEditingEmail] = useState(false);
	const [otp, setOtp] = useState("");
	const [otpSent, setOtpSent] = useState(false);
	const [emailLoading, setEmailLoading] = useState(false);

	const [address, setAddress] = useState(user.location || user.address || "");
	const [addressLoading, setAddressLoading] = useState(false);

	const [phone, setPhone] = useState(user.phone ? String(user.phone) : "");
	const [phoneLoading, setPhoneLoading] = useState(false);

	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordLoading, setPasswordLoading] = useState(false);

	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);

	const [alert, setAlert] = useState(null);

	const getInitials = (name) => {
		if (!name) return "U";
		const parts = name.split(" ");
		return `${parts[0][0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
	};

	const handlePasswordUpdate = async () => {
		if (newPassword.length < 6)
			return setAlert({
				type: "error",
				message: "Password must be at least 6 characters",
			});
		if (newPassword !== confirmPassword)
			return setAlert({ type: "error", message: "Passwords do not match" });
		if (!user.isGoogleUser && !currentPassword) {
			return setAlert({
				type: "error",
				message: "Please enter your current password",
			});
		}

		try {
			setPasswordLoading(true);
			const token = localStorage.getItem("token");
			await api.post(
				"/api/auth/update-password",
				{ currentPassword, newPassword },
				{ headers: { Authorization: `Bearer ${token}` } },
			);
			setAlert({ type: "success", message: "Password updated successfully!" });
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setShowCurrent(false);
			setShowNew(false);
		} catch (err) {
			setAlert({
				type: "error",
				message: err.response?.data?.error || "Failed to update password!",
			});
		} finally {
			setPasswordLoading(false);
		}
	};

	const updateProfile = async (dataToUpdate, specificLoadingSet) => {
		try {
			if (specificLoadingSet) specificLoadingSet(true);
			const token = localStorage.getItem("token");
			const payload = {
				...dataToUpdate,
				name:
					dataToUpdate.name !== undefined
						? dataToUpdate.name
						: name || user.name,
				address:
					dataToUpdate.address !== undefined
						? dataToUpdate.address
						: address || user.location,
				phone:
					dataToUpdate.phone !== undefined
						? dataToUpdate.phone
						: phone || user.phone,
			};
			const response = await api.put(`/api/users/${user.id}`, payload, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const updatedUser = { ...user, ...response.data.user };
			if (response.data.user.name) setName(response.data.user.name);
			if (response.data.user.location) setAddress(response.data.user.location);
			if (response.data.user.phone) setPhone(response.data.user.phone);
			localStorage.setItem("user", JSON.stringify(updatedUser));
			setUser(updatedUser);
			setAlert({ type: "success", message: "Profile updated successfully!" });
		} catch (err) {
			setAlert({
				type: "error",
				message: err.response?.data?.error || "Failed to update profile.",
			});
		} finally {
			if (specificLoadingSet) specificLoadingSet(false);
		}
	};

	const handleSendOtp = async () => {
		if (!email.includes("@"))
			return setAlert({ type: "error", message: "Invalid email" });
		try {
			setEmailLoading(true);
			const token = localStorage.getItem("token");
			await api.post(
				"/api/auth/request-email-change",
				{ newEmail: email },
				{ headers: { Authorization: `Bearer ${token}` } },
			);
			await new Promise((resolve) => setTimeout(resolve, 1000));
			setOtpSent(true);
			setAlert({ type: "success", message: `OTP sent to ${email}` });
		} catch (err) {
			setAlert({ type: "error", message: "Failed to send OTP" });
		} finally {
			setEmailLoading(false);
		}
	};

	const handleVerifyAndChangeEmail = async () => {
		try {
			setEmailLoading(true);
			const token = localStorage.getItem("token");
			await api.post(
				"/api/auth/verify-email-change",
				{ email, otp },
				{ headers: { Authorization: `Bearer ${token}` } },
			);
			await new Promise((resolve) => setTimeout(resolve, 1000));
			const updatedUser = { ...user, email: email };
			localStorage.setItem("user", JSON.stringify(updatedUser));
			setUser(updatedUser);
			setIsEditingEmail(false);
			setOtpSent(false);
			setOtp("");
			setAlert({ type: "success", message: "Email updated successfully!" });
		} catch (err) {
			setAlert({ type: "error", message: "Invalid OTP or failed to update" });
		} finally {
			setEmailLoading(false);
		}
	};

	const handleCurrentLocation = () => {
		if (!navigator.geolocation)
			return setAlert({ type: "error", message: "Geolocation not supported." });

		setAddressLoading(true);

		const options = {
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 0,
		};

		navigator.geolocation.getCurrentPosition(
			async (position) => {
				const { latitude, longitude } = position.coords;

				try {
					const response = await fetch(
						`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
					);
					const data = await response.json();

					updateProfile(
						{
							lat: latitude,
							lng: longitude,
							location: data.display_name || `${latitude}, ${longitude}`,
						},
						setAddressLoading,
					);
				} catch (err) {
					updateProfile(
						{
							lat: latitude,
							lng: longitude,
							location: `${latitude}, ${longitude}`,
						},
						setAddressLoading,
					);
				}
			},
			(error) => {
				setAddressLoading(false);
				let msg = "Unable to retrieve location.";
				if (error.code === 1) msg = "Location permission denied.";
				if (error.code === 2) msg = "Position unavailable (check GPS).";
				if (error.code === 3) msg = "Location request timed out.";
				setAlert({ type: "error", message: msg });
			},
			options,
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
				handleLogout();
			}
		};
		fetchUserData();
	}, [navigate]);

	useEffect(() => {
		if (user && Object.keys(user).length > 0) {
			setName(user.name || "");
			setEmail(user.email || "");
			setAddress(user.location || user.address || "");
			setPhone(user.phone ? String(user.phone) : "");
		}
	}, [user]);

	const handleLogout = () => {
		localStorage.removeItem("token");
		localStorage.removeItem("user");
		navigate("/login");
	};

	return (
		<div className="bricolage-grotesque min-h-screen text-[#191034] p-6 md:p-12 font-sans pt-24 md:pt-32">
			{alert && (
				<Alerts
					message={alert.message}
					type={alert.type}
					onClose={() => setAlert(null)}
				/>
			)}
			<div className="max-w-6xl mx-auto space-y-8">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#e7e6f4] pb-6 gap-4">
					<div>
						<h1 className="text-4xl font-bold bg-gradient-to-r from-violet-700 via-fuchsia-600 to-violet-700 bg-clip-text text-transparent bg-300% animate-gradient">
							Account Settings
						</h1>
						<p className="text-gray-500 mt-2 text-lg">
							Manage your personal details and security.
						</p>
					</div>
				</div>

				<div className="grid lg:grid-cols-12 gap-8 items-start">
					{/* Left Column: Avatar & Basic Info */}
					<div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
						<div className="bg-white border border-gray-100 p-8 rounded-3xl flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow duration-300">
							<div className="relative w-32 h-32 mb-6 group">
								<div className="w-full h-full rounded-full p-1 border-2 border-dashed border-violet-200 group-hover:border-violet-400 transition-colors">
									{user.photo ? (
										<img
											src={user.photo.replace("=s96-c", "=s256-c")}
											alt="Profile"
											className="w-full h-full object-cover rounded-full"
										/>
									) : (
										<Avatar
											sx={{
												width: "100%",
												height: "100%",
												fontSize: "2.5rem",
												fontWeight: "bold",
												background: "linear-gradient(135deg, #7c3aed, #c026d3)",
											}}
										>
											{getInitials(user.name || user.email)}
										</Avatar>
									)}
								</div>
								<div className="absolute bottom-2 right-1 w-7 h-7 bg-green-500 border-4 border-white rounded-full shadow-sm" />
							</div>

							<div className="w-full space-y-5">
								{/* Name Input */}
								<div className="text-left group">
									<label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5 block">
										Display Name
									</label>
									<div className="relative mb-3">
										<User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-violet-500 transition-colors" />
										<input
											type="text"
											value={name}
											onChange={(e) => setName(e.target.value)}
											className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all font-semibold text-gray-700 bg-gray-50/50 focus:bg-white"
										/>
									</div>
									<SaveButton
										loading={nameLoading}
										disabled={name === user.name}
										onClick={() => updateProfile({ name }, setNameLoading)}
										label="Save Name"
									/>
								</div>

								<div className="h-px bg-gray-100 w-full" />

								{/* Email Input */}
								<div className="text-left">
									<label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5 block">
										Email Address
									</label>
									{!isEditingEmail ? (
										<div className="flex items-center justify-between bg-gray-50 p-3.5 rounded-xl border border-gray-200 group hover:border-violet-200 transition-colors">
											<div className="flex items-center gap-3 overflow-hidden">
												<div className="bg-white p-1.5 rounded-lg shadow-sm text-gray-400">
													<Mail className="w-4 h-4" />
												</div>
												<span className="text-sm font-medium text-gray-700 truncate">
													{user.email}
												</span>
											</div>
											<button
												onClick={() => setIsEditingEmail(true)}
												className="cursor-pointer text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
											>
												Edit
											</button>
										</div>
									) : (
										<div className="space-y-3 bg-violet-50/50 p-4 rounded-xl border border-violet-100 animate-in fade-in slide-in-from-top-2 duration-200">
											<input
												type="email"
												value={email}
												onChange={(e) => setEmail(e.target.value)}
												placeholder="New Email Address"
												className="w-full px-3 py-2.5 rounded-lg border border-violet-200 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 text-sm bg-white"
											/>
											{otpSent && (
												<input
													type="text"
													value={otp}
													onChange={(e) => setOtp(e.target.value)}
													placeholder="Enter Code"
													className="w-full px-3 py-2.5 rounded-lg border border-violet-200 focus:outline-none focus:border-violet-500 text-sm text-center tracking-[0.25em] font-mono font-bold bg-white"
												/>
											)}
											<div className="flex gap-2 pt-1">
												<button
													onClick={() => {
														setIsEditingEmail(false);
														setOtpSent(false);
														setEmail(user.email);
													}}
													className="cursor-pointer flex-1 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200/50 rounded-lg transition-colors"
												>
													Cancel
												</button>
												{!otpSent ? (
													<button
														onClick={handleSendOtp}
														disabled={emailLoading || email === user.email}
														className="cursor-pointer disabled:cursor-not-allowed flex-1 py-2 text-xs font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-all shadow-md"
													>
														{emailLoading ? "Sending..." : "Send OTP"}
													</button>
												) : (
													<button
														onClick={handleVerifyAndChangeEmail}
														disabled={emailLoading || !otp}
														className="cursor-pointer disabled:cursor-not-allowed flex-1 py-2 text-xs font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-md"
													>
														{emailLoading ? "Verifying..." : "Verify"}
													</button>
												)}
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Right Column: Contact, Address, Security */}
					<div className="lg:col-span-8 space-y-6">
						<div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-sm">
							<h3 className="text-xl font-bold text-[#191034] mb-8 flex items-center gap-3">
								<div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
									<MapPin size={22} />
								</div>
								Contact & Location
							</h3>

							<div className="grid md:grid-cols-2 gap-8">
								{/* Phone Number */}
								<div className="space-y-2">
									<label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
										Phone Number
									</label>
									<div className="relative group mb-3">
										<Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-violet-500 transition-colors" />
										<input
											type="text"
											inputMode="tel"
											placeholder="+91 9876543210"
											value={phone}
											onChange={(e) =>
												setPhone(e.target.value.replace(/[^\d+ ]/g, ""))
											}
											className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/30 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all font-medium"
										/>
									</div>
									<SaveButton
										loading={phoneLoading}
										disabled={phone === (user.phone || "")}
										onClick={() => updateProfile({ phone }, setPhoneLoading)}
										label="Save Phone"
									/>
								</div>

								{/* Auto Detect Button */}
								<div className="flex flex-col justify-end">
									<div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 text-center space-y-3 h-full flex flex-col justify-center">
										<p className="text-sm text-gray-500 font-medium">
											Need to update your address quickly?
										</p>
										<button
											onClick={handleCurrentLocation}
											className="cursor-pointer w-full flex items-center justify-center gap-2 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 px-4 py-3 rounded-xl transition-all shadow-lg shadow-gray-200 hover:-translate-y-0.5"
										>
											<MapPin size={16} />
											Auto-Detect Location
										</button>
									</div>
								</div>
							</div>

							{/* Address Text Area */}
							<div className="mt-8">
								<label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 mb-2 block">
									Permanent Address
								</label>
								<textarea
									value={address}
									onChange={(e) => setAddress(e.target.value)}
									placeholder="Enter your full address details..."
									rows="3"
									className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-gray-50/30 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all resize-none leading-relaxed mb-4"
								/>
								{/* FIX: Button is always visible, but disabled/greyed until change */}
								<SaveButton
									loading={addressLoading}
									disabled={address === (user.location || user.address || "")}
									onClick={() => updateProfile({ address }, setAddressLoading)}
									label="Update Address"
								/>
							</div>
						</div>

						{/* Security Section */}
						<div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-sm">
							<h3 className="text-xl font-bold text-[#191034] mb-8 flex items-center gap-3">
								<div className="bg-amber-50 p-2.5 rounded-xl text-amber-600">
									<ShieldCheck size={22} />
								</div>
								Security & Password
							</h3>

							<div className="grid md:grid-cols-2 gap-10">
								{/* Change Password Form */}
								<div className="order-2 md:order-1 bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
									<h4 className="font-bold text-gray-700 mb-5 flex items-center gap-2">
										<CheckCircle2 size={18} className="text-emerald-500" />
										Update Password
									</h4>

									<div className="space-y-4">
										{!user.isGoogleUser && (
											<PasswordInput
												value={currentPassword}
												onChange={(e) => setCurrentPassword(e.target.value)}
												placeholder="Current Password"
												show={showCurrent}
												toggleShow={setShowCurrent}
											/>
										)}
										<PasswordInput
											value={newPassword}
											onChange={(e) => setNewPassword(e.target.value)}
											placeholder="New Password (min 6 chars)"
											show={showNew}
											toggleShow={setShowNew}
										/>
										<PasswordInput
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											placeholder="Confirm New Password"
											show={showNew}
											toggleShow={setShowNew}
										/>

										<SaveButton
											loading={passwordLoading}
											disabled={!newPassword || passwordLoading}
											onClick={handlePasswordUpdate}
											label="Update Password"
											loadingLabel="Updating..."
										/>
									</div>
								</div>

								{/* Current Status & Logout */}
								<div className="order-1 md:order-2 flex flex-col justify-between h-full">
									<div>
										<label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
											Security Status
										</label>
										<div className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
											<div
												className={`p-2 rounded-lg ${
													user.isGoogleUser
														? "bg-orange-50 text-orange-600"
														: "bg-emerald-50 text-emerald-600"
												}`}
											>
												<Lock size={20} />
											</div>
											<div className="flex-1">
												<p className="font-bold text-gray-800 text-sm">
													{user.isGoogleUser
														? "Google Authenticated"
														: "Password Protected"}
												</p>
												<p className="text-xs text-gray-500 mt-0.5">
													Your account is secure.
												</p>
											</div>
										</div>
									</div>

									<div className="mt-6 md:mt-0">
										<button
											onClick={handleLogout}
											className="cursor-pointer w-full group border border-red-100 bg-red-50 text-red-600 px-6 py-4 rounded-2xl font-bold hover:bg-red-600 hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
										>
											<span className="group-hover:hidden">
												Log Out All Devices
											</span>
											<span className="hidden group-hover:inline">
												Confirm Logout
											</span>
										</button>
									</div>
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
