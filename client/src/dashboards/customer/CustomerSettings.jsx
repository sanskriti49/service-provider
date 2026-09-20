import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, LogOut, Navigation } from "lucide-react";
import { toast } from "sonner";
import api from "../../api/axiosInstance";
import { useAuth } from "../../contexts/AuthContext";
import ConfirmDialog from "../../ui/ConfirmDialog";
import Logo from "../../ui/Logo";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const readStoredUser = () => {
	try {
		return JSON.parse(localStorage.getItem("user") || "{}") || {};
	} catch {
		return {};
	}
};

const authHeaders = () => ({
	headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

const initials = (name) => {
	const parts = String(name || "")
		.trim()
		.split(/\s+/);
	return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "C";
};

const inputCls =
	"w-full h-11 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 text-sm text-white placeholder:text-stone-600 transition-colors hover:border-white/[0.16] focus:outline-none focus:border-violet-400/50 focus:ring-2 focus:ring-violet-400/20 disabled:opacity-50";

const primaryBtn =
	"bg-gradient-to-r from-violet-400 to-fuchsia-400 text-[#0d0b12] font-semibold hover:brightness-110 shadow-[0_6px_24px_-8px_rgba(167,139,250,0.7)] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:brightness-100";

const ghostBtn =
	"text-stone-300 hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:opacity-40 disabled:cursor-not-allowed";

const containerVariants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};
const itemVariants = {
	hidden: { opacity: 0, y: 10 },
	show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                           */
/* -------------------------------------------------------------------------- */

function Spinner() {
	return (
		<span className="w-4 h-4 rounded-full border-2 border-[#0d0b12]/30 border-t-[#0d0b12] animate-spin" />
	);
}

function Field({ id, label, hint, error, children }) {
	return (
		<div>
			<label htmlFor={id} className="block text-sm text-stone-300 mb-1.5">
				{label}
			</label>
			{children}
			{error ? (
				<p className="mt-1.5 text-xs text-rose-300">{error}</p>
			) : (
				hint && <p className="mt-1.5 text-xs text-stone-500">{hint}</p>
			)}
		</div>
	);
}

function PasswordField({ id, label, value, onChange, autoComplete, error }) {
	const [show, setShow] = useState(false);
	return (
		<Field id={id} label={label} error={error}>
			<div className="relative">
				<input
					id={id}
					type={show ? "text" : "password"}
					value={value}
					onChange={onChange}
					autoComplete={autoComplete}
					className={`${inputCls} pr-11`}
				/>
				<button
					type="button"
					onClick={() => setShow((s) => !s)}
					aria-label={show ? "Hide password" : "Show password"}
					className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-stone-500 hover:text-white transition-colors"
				>
					{show ? <EyeOff size={16} /> : <Eye size={16} />}
				</button>
			</div>
		</Field>
	);
}

/** Two-column row: what the section is on the left, its fields on the right. */
function Section({ title, description, children }) {
	return (
		<motion.section
			variants={itemVariants}
			className="grid lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] gap-x-16 gap-y-5 py-9 border-t border-white/[0.07]"
		>
			<div>
				<h2 className="font-mackinac text-xl font-bold text-white">{title}</h2>
				{description && (
					<p className="mt-1.5 text-sm leading-relaxed text-stone-500 max-w-[16rem]">
						{description}
					</p>
				)}
			</div>
			<div className="max-w-xl min-w-0">{children}</div>
		</motion.section>
	);
}

function Actions({
	dirty,
	busy,
	onSave,
	onDiscard,
	saveLabel = "Save changes",
	disabled,
}) {
	return (
		<div className="mt-6 flex items-center gap-2">
			<button
				type="button"
				onClick={onSave}
				disabled={!dirty || busy || disabled}
				className={`h-10 min-w-[7.5rem] px-5 inline-flex items-center justify-center rounded-lg text-sm ${primaryBtn}`}
			>
				{busy ? <Spinner /> : saveLabel}
			</button>
			{dirty && onDiscard && !busy && (
				<button
					type="button"
					onClick={onDiscard}
					className={`h-10 px-4 rounded-lg text-sm ${ghostBtn}`}
				>
					Discard
				</button>
			)}
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function CustomerSettings() {
	const navigate = useNavigate();
	const { logout } = useAuth();

	const [user, setUser] = useState(readStoredUser);
	const [busy, setBusy] = useState(null); // "personal" | "email" | "location" | "password"
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

	// Personal
	const [name, setName] = useState(user.name || "");
	const [phone, setPhone] = useState(user.phone ? String(user.phone) : "");

	// Email change: view -> enter -> verify
	const [emailStep, setEmailStep] = useState("view");
	const [newEmail, setNewEmail] = useState("");
	const [otp, setOtp] = useState("");

	// Location
	const [locationText, setLocationText] = useState(user.location || "");
	const [address, setAddress] = useState(user.address || "");
	const [coords, setCoords] = useState(null);
	const [locating, setLocating] = useState(false);

	// Password
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const [photoBroken, setPhotoBroken] = useState(false);

	const syncFields = (u) => {
		setName(u.name || "");
		setPhone(u.phone ? String(u.phone) : "");
		setLocationText(u.location || "");
		setAddress(u.address || "");
	};

	useEffect(() => {
		let alive = true;
		if (!localStorage.getItem("token")) {
			navigate("/login");
			return;
		}
		(async () => {
			try {
				const res = await api.get("/api/auth/me", authHeaders());
				if (!alive || !res.data?.user) return;
				setUser(res.data.user);
				localStorage.setItem("user", JSON.stringify(res.data.user));
				syncFields(res.data.user);
			} catch (err) {
				if (!alive) return;
				if (err.response?.status === 401) {
					logout();
					navigate("/login");
				} else {
					toast.error("Couldn't refresh your account details");
				}
			}
		})();
		return () => {
			alive = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/* ---- saving ---- */

	/** Sends the saved values plus only the changes from the section being saved. */
	const saveProfile = async (key, changes) => {
		setBusy(key);
		try {
			const payload = {};
			["name", "phone", "location", "address"].forEach((k) => {
				if (user[k] !== undefined && user[k] !== null && user[k] !== "")
					payload[k] = user[k];
			});
			Object.assign(payload, changes);

			const res = await api.put(
				`/api/users/${user.id}`,
				payload,
				authHeaders(),
			);
			const updated = { ...user, ...res.data.user };
			localStorage.setItem("user", JSON.stringify(updated));
			setUser(updated);
			return updated;
		} catch (err) {
			toast.error(err.response?.data?.error || "Couldn't save your changes");
			return null;
		} finally {
			setBusy(null);
		}
	};

	const personalDirty =
		name.trim() !== (user.name || "") ||
		phone.trim() !== (user.phone ? String(user.phone) : "");

	const savePersonal = async () => {
		const n = name.trim();
		if (!n) return toast.error("Enter your name");
		const digits = phone.replace(/\D/g, "");
		if (phone && (digits.length < 10 || digits.length > 15)) {
			return toast.error("Enter a valid phone number");
		}
		const u = await saveProfile("personal", {
			name: n,
			...(phone.trim() ? { phone: phone.trim() } : {}),
		});
		if (u) {
			setName(u.name || n);
			setPhone(u.phone ? String(u.phone) : "");
			toast.success("Personal details saved");
		}
	};

	const locationDirty =
		locationText.trim() !== (user.location || "") ||
		address.trim() !== (user.address || "") ||
		Boolean(coords);

	const saveLocation = async () => {
		const u = await saveProfile("location", {
			...(locationText.trim() ? { location: locationText.trim() } : {}),
			address: address.trim(),
			...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
		});
		if (u) {
			setLocationText(u.location || "");
			setAddress(u.address || "");
			setCoords(null);
			toast.success("Location saved");
		}
	};

	const detectLocation = () => {
		if (!navigator.geolocation) {
			return toast.error("Your browser can't share your location");
		}
		setLocating(true);
		navigator.geolocation.getCurrentPosition(
			async ({ coords: c }) => {
				setCoords({ lat: c.latitude, lng: c.longitude });
				try {
					const res = await fetch(
						`https://nominatim.openstreetmap.org/reverse?format=json&lat=${c.latitude}&lon=${c.longitude}`,
					);
					const data = await res.json();
					const place =
						data.address?.city ||
						data.address?.town ||
						data.address?.village ||
						data.address?.suburb ||
						"";
					const state = data.address?.state || "";
					const text =
						place && state ? `${place}, ${state}` : data.display_name || "";
					if (text) setLocationText(text);
					else toast("Got your position. Type your city to finish.");
				} catch {
					toast.error("Couldn't name this place. Type your city instead.");
				} finally {
					setLocating(false);
				}
			},
			(error) => {
				setLocating(false);
				toast.error(
					error.code === 1
						? "Location is blocked. Allow access or type your city."
						: error.code === 3
							? "Location request timed out. Try again."
							: "Couldn't get your location. Check your GPS.",
				);
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
		);
	};

	/* ---- email ---- */

	const cancelEmailChange = () => {
		setEmailStep("view");
		setNewEmail("");
		setOtp("");
	};

	const sendCode = async () => {
		const value = newEmail.trim();
		if (!/^\S+@\S+\.\S+$/.test(value))
			return toast.error("Enter a valid email");
		if (value === user.email) return toast.error("That's already your email");
		setBusy("email");
		try {
			await api.post(
				"/api/auth/request-email-change",
				{ newEmail: value },
				authHeaders(),
			);
			setEmailStep("verify");
			toast.success(`Code sent to ${value}`);
		} catch (err) {
			toast.error(err.response?.data?.error || "Couldn't send the code");
		} finally {
			setBusy(null);
		}
	};

	const verifyEmail = async () => {
		const value = newEmail.trim();
		setBusy("email");
		try {
			await api.post(
				"/api/auth/verify-email-change",
				{ email: value, otp: otp.trim() },
				authHeaders(),
			);
			const updated = { ...user, email: value };
			localStorage.setItem("user", JSON.stringify(updated));
			setUser(updated);
			cancelEmailChange();
			toast.success("Email updated");
		} catch (err) {
			toast.error(err.response?.data?.error || "That code didn't work");
		} finally {
			setBusy(null);
		}
	};

	/* ---- password ---- */

	const isGoogle = Boolean(user.isGoogleUser);
	const tooShort = newPassword.length > 0 && newPassword.length < 6;
	const mismatch =
		confirmPassword.length > 0 && newPassword !== confirmPassword;
	const passwordReady =
		newPassword.length >= 6 &&
		newPassword === confirmPassword &&
		(isGoogle || currentPassword.length > 0);

	const updatePassword = async () => {
		setBusy("password");
		try {
			await api.post(
				"/api/auth/update-password",
				{ currentPassword, newPassword },
				authHeaders(),
			);
			toast.success("Password updated");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch (err) {
			toast.error(err.response?.data?.error || "Couldn't update your password");
		} finally {
			setBusy(null);
		}
	};

	/* ---- sign out ---- */

	const executeLogout = () => {
		setShowLogoutConfirm(false);
		logout();
		navigate("/login");
	};

	const photo = user.photo?.replace("=s96-c", "=s256-c");

	return (
		<MotionConfig reducedMotion="user">
			<div className="min-h-screen bg-[#0d0b12] text-stone-200 bricolage-grotesque antialiased selection:bg-violet-400/30">
				<div
					aria-hidden
					className="fixed inset-x-0 top-0 h-[460px] pointer-events-none bg-[radial-gradient(60%_100%_at_20%_0%,rgba(139,92,246,0.14),transparent_70%),radial-gradient(45%_80%_at_85%_0%,rgba(251,191,36,0.08),transparent_70%)]"
				/>

				<header className="sticky top-0 z-40 bg-[#0d0b12]/90 backdrop-blur-md border-b border-white/[0.06]">
					<div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 h-14 flex items-center gap-3">
						<Link
							to="/dashboard"
							className="-ml-2 h-9 px-2 inline-flex items-center gap-2 rounded-md text-sm text-stone-300 hover:text-white hover:bg-white/[0.06] transition-colors"
						>
							<ArrowLeft size={17} />
							Dashboard
						</Link>
						<span className="flex-1" />
						<Logo to="/" size="md" theme="dark" />
					</div>
				</header>

				<main className="relative max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-12 pb-24">
					<motion.div
						variants={containerVariants}
						initial="hidden"
						animate="show"
					>
						<motion.header variants={itemVariants}>
							<h1 className="font-mackinac text-3xl sm:text-4xl font-bold text-white tracking-tight">
								Settings
							</h1>
							<p className="mt-2 text-sm text-stone-400">
								How you appear, where you're booked, and how you sign in.
							</p>
						</motion.header>

						<motion.div
							variants={itemVariants}
							className="mt-8 mb-9 flex items-center gap-4"
						>
							<div className="p-[2px] rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-amber-300 shrink-0">
								<div className="w-14 h-14 rounded-full bg-[#1a1428] overflow-hidden flex items-center justify-center text-lg font-semibold text-white">
									{photo && !photoBroken ? (
										<img
											src={photo}
											alt=""
											onError={() => setPhotoBroken(true)}
											className="w-full h-full object-cover"
										/>
									) : (
										initials(user.name || user.email)
									)}
								</div>
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-base font-medium text-white truncate">
									{user.name || "Customer"}
								</p>
								<p className="text-sm text-stone-500 truncate">{user.email}</p>
							</div>
							<Link
								to="/account/profile"
								className="shrink-0 text-sm text-violet-300 hover:text-white transition-colors"
							>
								View profile
							</Link>
						</motion.div>

						{/* Personal details */}
						<Section
							title="Personal details"
							description="Providers see your name and number once you book them."
						>
							<div className="space-y-4">
								<Field id="st-name" label="Full name">
									<input
										id="st-name"
										type="text"
										value={name}
										onChange={(e) => setName(e.target.value)}
										autoComplete="name"
										className={inputCls}
									/>
								</Field>
								<Field id="st-phone" label="Phone number">
									<input
										id="st-phone"
										type="tel"
										inputMode="tel"
										autoComplete="tel"
										placeholder="+91 98765 43210"
										value={phone}
										onChange={(e) =>
											setPhone(e.target.value.replace(/[^\d+ ]/g, ""))
										}
										className={inputCls}
									/>
								</Field>
							</div>
							<Actions
								dirty={personalDirty}
								busy={busy === "personal"}
								onSave={savePersonal}
								onDiscard={() => {
									setName(user.name || "");
									setPhone(user.phone ? String(user.phone) : "");
								}}
							/>
						</Section>

						{/* Email */}
						<Section
							title="Email"
							description="We send booking updates and receipts here."
						>
							{emailStep === "view" ? (
								<div className="flex items-center justify-between gap-4">
									<p className="text-sm text-white truncate">
										{user.email || "No email on file"}
									</p>
									<button
										type="button"
										onClick={() => setEmailStep("enter")}
										className={`shrink-0 h-9 px-4 rounded-lg border border-white/[0.12] text-sm ${ghostBtn}`}
									>
										Change email
									</button>
								</div>
							) : (
								<div>
									<div className="space-y-4">
										<Field id="st-new-email" label="New email address">
											<input
												id="st-new-email"
												type="email"
												autoFocus
												value={newEmail}
												onChange={(e) => setNewEmail(e.target.value)}
												disabled={emailStep === "verify"}
												autoComplete="email"
												className={inputCls}
											/>
										</Field>
										{emailStep === "verify" && (
											<Field
												id="st-otp"
												label="Verification code"
												hint={`Enter the code we sent to ${newEmail.trim()}.`}
											>
												<input
													id="st-otp"
													type="text"
													inputMode="numeric"
													autoComplete="one-time-code"
													autoFocus
													value={otp}
													onChange={(e) => setOtp(e.target.value)}
													className={`${inputCls} font-mono tracking-[0.3em]`}
												/>
											</Field>
										)}
									</div>
									<div className="mt-6 flex items-center gap-2">
										{emailStep === "enter" ? (
											<button
												type="button"
												onClick={sendCode}
												disabled={busy === "email" || !newEmail.trim()}
												className={`h-10 min-w-[7.5rem] px-5 inline-flex items-center justify-center rounded-lg text-sm ${primaryBtn}`}
											>
												{busy === "email" ? <Spinner /> : "Send code"}
											</button>
										) : (
											<>
												<button
													type="button"
													onClick={verifyEmail}
													disabled={busy === "email" || !otp.trim()}
													className={`h-10 min-w-[7.5rem] px-5 inline-flex items-center justify-center rounded-lg text-sm ${primaryBtn}`}
												>
													{busy === "email" ? <Spinner /> : "Update email"}
												</button>
												<button
													type="button"
													onClick={sendCode}
													disabled={busy === "email"}
													className={`h-10 px-4 rounded-lg text-sm ${ghostBtn}`}
												>
													Resend code
												</button>
											</>
										)}
										<button
											type="button"
											onClick={cancelEmailChange}
											className={`h-10 px-4 rounded-lg text-sm ${ghostBtn}`}
										>
											Cancel
										</button>
									</div>
								</div>
							)}
						</Section>

						{/* Location */}
						<Section
							title="Location"
							description="Used to find providers near you and to pre-fill your bookings."
						>
							<div className="space-y-4">
								<div>
									<div className="flex items-center justify-between gap-3 mb-1.5">
										<label
											htmlFor="st-region"
											className="text-sm text-stone-300"
										>
											City and state
										</label>
										<button
											type="button"
											onClick={detectLocation}
											disabled={locating}
											className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-white transition-colors disabled:opacity-60"
										>
											<Navigation size={12} />
											{locating ? "Locating…" : "Use my location"}
										</button>
									</div>
									<input
										id="st-region"
										type="text"
										placeholder="Kanpur, Uttar Pradesh"
										value={locationText}
										onChange={(e) => setLocationText(e.target.value)}
										className={inputCls}
									/>
								</div>

								<Field
									id="st-address"
									label="Home address"
									hint="Flat or house number, building, street and a landmark."
								>
									<textarea
										id="st-address"
										rows={3}
										value={address}
										onChange={(e) => setAddress(e.target.value)}
										autoComplete="street-address"
										className={`${inputCls} h-auto py-3 resize-none leading-relaxed`}
									/>
								</Field>
							</div>
							<Actions
								dirty={locationDirty}
								busy={busy === "location"}
								onSave={saveLocation}
								onDiscard={() => {
									setLocationText(user.location || "");
									setAddress(user.address || "");
									setCoords(null);
								}}
							/>
						</Section>

						{/* Password */}
						<Section
							title="Password"
							description={
								isGoogle
									? "You signed in with Google. Set a password to also sign in with your email."
									: "Use at least 6 characters."
							}
						>
							<div className="space-y-4">
								{!isGoogle && (
									<PasswordField
										id="st-current"
										label="Current password"
										value={currentPassword}
										onChange={(e) => setCurrentPassword(e.target.value)}
										autoComplete="current-password"
									/>
								)}
								<PasswordField
									id="st-new"
									label="New password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									autoComplete="new-password"
									error={tooShort ? "Use at least 6 characters." : null}
								/>
								<PasswordField
									id="st-confirm"
									label="Confirm new password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									autoComplete="new-password"
									error={mismatch ? "Passwords don't match." : null}
								/>
							</div>
							<Actions
								dirty={passwordReady}
								busy={busy === "password"}
								onSave={updatePassword}
								saveLabel={isGoogle ? "Set password" : "Update password"}
							/>
						</Section>

						{/* Sign out */}
						<Section
							title="Sign out"
							description="You'll need to sign in again on this device."
						>
							<button
								type="button"
								onClick={() => setShowLogoutConfirm(true)}
								className="h-10 px-5 inline-flex items-center gap-2 rounded-lg border border-rose-400/25 text-sm font-medium text-rose-300 hover:bg-rose-400/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
							>
								<LogOut size={15} />
								Sign out
							</button>
						</Section>
					</motion.div>
				</main>

				<ConfirmDialog
					isOpen={showLogoutConfirm}
					onClose={() => setShowLogoutConfirm(false)}
					onConfirm={executeLogout}
					title="Sign out?"
					description="You'll need to sign in again to access your account."
					confirmText="Sign out"
					cancelText="Cancel"
					variant="danger"
					icon={LogOut}
				/>
			</div>
		</MotionConfig>
	);
}
