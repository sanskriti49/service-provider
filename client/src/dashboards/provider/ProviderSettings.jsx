import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
	User,
	Phone,
	Mail,
	MapPin,
	Image as ImageIcon,
	FileText,
	Lock,
	Trash2,
	Save,
	Eye,
	EyeOff,
	Loader2,
	CheckCircle2,
	AlertTriangle,
	ChevronRight,
	ShieldCheck,
} from "lucide-react";
import api from "../../api/axiosInstance";
import { useAuth } from "../../hooks/useAuth";

function normalizePhone(raw = "") {
	const t = raw.trim();
	if (t.startsWith("+91")) return t;
	return `+91${t.replace(/\s+/g, "")}`;
}
const PHONE_RE = /^\+91 ?[6-9]\d{9}$/;

const ACCENT = {
	violet: { wrap: "bg-violet-500/10 border-violet-500/20 text-violet-400" },
	emerald: { wrap: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
	red: { wrap: "bg-red-500/10 border-red-500/20 text-red-400" },
};

const LOCATION_DATA = {
	Maharashtra: [
		"Mumbai",
		"Pune",
		"Nagpur",
		"Nashik",
		"Aurangabad",
		"Thane",
		"Navi Mumbai",
		"Solapur",
	],
	Delhi: ["Delhi"],
	Karnataka: ["Bangalore", "Mysuru", "Mangalore", "Hubli-Dharwad"],
	Telangana: ["Hyderabad", "Warangal"],
	Tamil_Nadu: ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem"],
	West_Bengal: ["Kolkata"],
	Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"],
	Haryana: ["Gurugram", "Faridabad"],
	Uttar_Pradesh: [
		"Noida",
		"Ghaziabad",
		"Lucknow",
		"Kanpur",
		"Varanasi",
		"Prayagraj",
		"Agra",
		"Meerut",
		"Bareilly",
		"Aligarh",
		"Gorakhpur",
	],
	Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer"],
	Madhya_Pradesh: ["Bhopal", "Indore", "Jabalpur", "Gwalior"],
	Chandigarh: ["Chandigarh"],
	Punjab: ["Ludhiana", "Amritsar", "Jalandhar"],
	Uttarakhand: ["Dehradun"],
	Jammu_and_Kashmir: ["Srinagar", "Jammu"],
	Kerala: ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur"],
	Andhra_Pradesh: ["Visakhapatnam", "Vijayawada"],
	Bihar: ["Patna", "Gaya"],
	Jharkhand: ["Ranchi", "Jamshedpur", "Dhanbad"],
	Odisha: ["Bhubaneswar", "Cuttack", "Rourkela"],
	Assam: ["Guwahati"],
	Chhattisgarh: ["Raipur", "Bhilai"],
	Goa: ["Panaji"],
	Himachal_Pradesh: ["Shimla"],
};

function Card({
	id,
	icon: Icon,
	title,
	subtitle,
	accent = "violet",
	children,
}) {
	const a = ACCENT[accent];
	return (
		<motion.section
			id={id}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-7"
		>
			<div className="flex items-center gap-3 pb-5 mb-5 border-b border-slate-800">
				<div
					className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${a.wrap}`}
				>
					<Icon size={16} />
				</div>
				<div>
					<h2 className="text-sm font-bold text-white">{title}</h2>
					{subtitle && (
						<p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
					)}
				</div>
			</div>
			{children}
		</motion.section>
	);
}

function Label({ children }) {
	return (
		<div className="flex items-center gap-2 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
			{children}
		</div>
	);
}

function TextInput({ icon: Icon, rightSlot, className = "", ...props }) {
	return (
		<div className="relative">
			{Icon && (
				<Icon
					size={13}
					className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"
				/>
			)}
			<input
				className={`w-full bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 transition-all focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 ${Icon ? "pl-9" : "pl-4"} ${rightSlot ? "pr-10" : "pr-4"} py-2.5 ${className}`}
				{...props}
			/>
			{rightSlot && (
				<div className="absolute right-3 top-1/2 -translate-y-1/2">
					{rightSlot}
				</div>
			)}
		</div>
	);
}

function Hint({ children }) {
	return (
		<p className="mt-1.5 text-[11px] text-slate-600 leading-relaxed">
			{children}
		</p>
	);
}

function SubmitBtn({ loading, saved, children }) {
	return (
		<button
			type="submit"
			disabled={loading}
			className="cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 disabled:text-violet-700 transition-all shadow-lg shadow-violet-900/20 disabled:cursor-not-allowed"
		>
			{loading ? (
				<Loader2 size={13} className="animate-spin" />
			) : saved ? (
				<CheckCircle2 size={13} className="text-emerald-300" />
			) : (
				<Save size={13} />
			)}
			{saved ? "Saved!" : children}
		</button>
	);
}

export default function ProviderSettings() {
	// ── useAuth only used for the shared context update (sidebar avatar etc.) ──
	const { setUser: setAuthUser } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const phoneBoxRef = useRef(null);

	const [user, setUser] = useState(
		JSON.parse(localStorage.getItem("user") || "{}"),
	);

	const [name, setName] = useState(user.name || "");
	const [email, setEmail] = useState(user.email || "");
	const [phone, setPhone] = useState(
		user.phone ? normalizePhone(String(user.phone)) : "",
	);
	const [bio, setBio] = useState(user.bio || "");
	const [state, setState] = useState("");
	const [city, setCity] = useState("");
	const [photo, setPhoto] = useState(user.photo || "");
	const [selectedFile, setSelectedFile] = useState(null);

	const [profileLoading, setProfileLoading] = useState(false);
	const [profileSaved, setProfileSaved] = useState(false);

	const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
	const [showPwd, setShowPwd] = useState({
		current: false,
		next: false,
		confirm: false,
	});
	const [pwdLoading, setPwdLoading] = useState(false);
	const [pwdSaved, setPwdSaved] = useState(false);

	const [phrase, setPhrase] = useState("");
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);

	const setPwdField = (k) => (e) =>
		setPwd((p) => ({ ...p, [k]: e.target.value }));
	const toggleShow = (k) => () => setShowPwd((p) => ({ ...p, [k]: !p[k] }));

	// ── 1. Fetch fresh data from server on mount (fixes refresh bug) ──────────
	useEffect(() => {
		const fetchUserData = async () => {
			try {
				const response = await api.get("/api/auth/me");
				const fresh = response.data.user;
				setUser(fresh);
				localStorage.setItem("user", JSON.stringify(fresh));
				// Also sync the auth context so sidebar avatar etc. update
				if (setAuthUser) setAuthUser((prev) => ({ ...prev, ...fresh }));
			} catch (err) {
				console.warn("Could not refresh user:", err.message);
			}
		};
		fetchUserData();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// ── 2. Sync individual fields whenever local user object changes ──────────
	useEffect(() => {
		if (!user || !Object.keys(user).length) return;
		setName(user.name || "");
		setEmail(user.email || "");
		setPhone(user.phone ? normalizePhone(String(user.phone)) : "");
		setBio(user.bio || "");
		setPhoto(user.photo || "");
		// Parse city,state from "City,State" location string
		const [rawCity = "", rawState = ""] = (user.location || "").split(",");
		setState(rawState.trim());
		setCity(rawCity.trim());
	}, [user]);

	// ── Scroll-to-phone from hash link ───────────────────────────────────────
	useEffect(() => {
		if (location.hash === "#phone" && phoneBoxRef.current) {
			const t = setTimeout(() => {
				phoneBoxRef.current.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
				phoneBoxRef.current.querySelector("input")?.focus();
			}, 350);
			return () => clearTimeout(t);
		}
	}, [location.hash]);

	const phoneOk =
		!!phone && PHONE_RE.test(normalizePhone(phone).replace(/\s+/g, ""));

	const showPhoneWarning = () => {
		if (phoneOk) return false;
		if (!user?.phone) return true;
		return !PHONE_RE.test(
			normalizePhone(String(user.phone)).replace(/\s+/g, ""),
		);
	};

	// ── Helper: sync user everywhere after any save ───────────────────────────
	const syncUser = (fresh) => {
		setUser(fresh);
		localStorage.setItem("user", JSON.stringify(fresh));
		if (setAuthUser) setAuthUser((prev) => ({ ...prev, ...fresh }));
	};

	// ── Save profile ──────────────────────────────────────────────────────────
	const saveProfile = async (e) => {
		e.preventDefault();
		const normalizedPhone = normalizePhone(phone);
		if (!PHONE_RE.test(normalizedPhone.replace(/\s/g, ""))) {
			toast.error("Enter a valid Indian mobile number");
			phoneBoxRef.current?.querySelector("input")?.focus();
			return;
		}

		setProfileLoading(true);
		try {
			const formData = new FormData();
			formData.append("name", name);
			formData.append("email", email);
			formData.append("phone", normalizedPhone);
			formData.append("bio", bio);

			// Only send location if we have something meaningful; never send ""
			const locationVal =
				city && state ? `${city},${state}` : user?.location || null;
			if (locationVal) formData.append("location", locationVal);

			if (selectedFile) formData.append("photo", selectedFile);

			await api.put(`/api/users/${user.id}`, formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});

			// Re-fetch authoritative state — same as CustomerSettings does after updateProfile
			const refreshed = await api.get("/api/auth/me");
			const fresh = refreshed.data.user;
			syncUser(fresh);

			setSelectedFile(null);
			setProfileSaved(true);
			toast.success("Profile saved!");
			setTimeout(() => setProfileSaved(false), 3000);
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to save profile");
		} finally {
			setProfileLoading(false);
		}
	};

	// ── Save password ─────────────────────────────────────────────────────────
	const savePassword = async (e) => {
		e.preventDefault();
		if (pwd.next !== pwd.confirm) {
			toast.error("Passwords don't match");
			return;
		}
		if (pwd.next.length < 6) {
			toast.error("Password must be at least 6 characters");
			return;
		}
		if (!phoneOk) {
			toast.error(
				<span>
					Phone required to change password.{" "}
					<button
						className="underline font-bold"
						onClick={() =>
							phoneBoxRef.current?.scrollIntoView({ behavior: "smooth" })
						}
					>
						Add it →
					</button>
				</span>,
				{ duration: 6000 },
			);
			return;
		}
		setPwdLoading(true);
		try {
			await api.put("/api/auth/update-password", {
				currentPassword: pwd.current,
				newPassword: pwd.next,
			});
			setPwd({ current: "", next: "", confirm: "" });
			setPwdSaved(true);
			toast.success("Password updated!");
			setTimeout(() => setPwdSaved(false), 3000);
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to update password");
		} finally {
			setPwdLoading(false);
		}
	};

	// ── Delete account ────────────────────────────────────────────────────────
	const deleteAccount = async () => {
		if (phrase !== "DELETE MY ACCOUNT") return;
		setDeleteLoading(true);
		try {
			await api.delete(`/api/providers/v1/${user.id}`);
			localStorage.clear();
			navigate("/");
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to delete account");
			setDeleteLoading(false);
		}
	};

	const pwdStrength = (() => {
		const v = pwd.next;
		return (
			(v.length >= 6 ? 1 : 0) +
			(/[A-Z]/.test(v) ? 1 : 0) +
			(/\d/.test(v) ? 1 : 0) +
			(/[^a-zA-Z0-9]/.test(v) ? 1 : 0)
		);
	})();
	const strengthColor =
		["bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"][
			pwdStrength - 1
		] || "bg-slate-700";

	return (
		<div className="bricolage-grotesque space-y-5 max-w-[640px]">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800">
				<div>
					<h1 className="text-2xl font-bold text-white tracking-tight">
						Settings
					</h1>
					<p className="text-slate-500 text-sm mt-0.5">
						Profile, credentials, and account management.
					</p>
				</div>
				{showPhoneWarning() && (
					<motion.button
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						onClick={() => {
							phoneBoxRef.current?.scrollIntoView({
								behavior: "smooth",
								block: "center",
							});
							phoneBoxRef.current?.querySelector("input")?.focus();
						}}
						className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-400 text-xs font-bold cursor-pointer hover:bg-amber-500/15 transition-colors shrink-0"
					>
						<AlertTriangle size={12} />
						Phone missing — tap to fix
						<ChevronRight size={12} />
					</motion.button>
				)}
			</div>

			{/* ── 1. Profile ── */}
			<Card
				id="profile"
				icon={User}
				title="Public profile"
				subtitle="Shown to customers who find you."
				accent="violet"
			>
				<form onSubmit={saveProfile} className="space-y-4">
					{/* Avatar */}
					<div className="flex items-center gap-5 p-4 rounded-xl border border-white/5 bg-slate-950/20">
						<div className="relative w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center group shadow-inner">
							{photo ? (
								<img
									src={photo}
									alt="Profile"
									className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
								/>
							) : (
								<User size={26} className="text-slate-600" />
							)}
						</div>
						<div className="flex-1 space-y-1.5">
							<Label>
								<ImageIcon size={11} /> Profile Picture
							</Label>
							<div className="flex items-center gap-3">
								<input
									type="file"
									id="avatar-picker"
									accept="image/*"
									className="hidden"
									onChange={(e) => {
										const file = e.target.files[0];
										if (!file) return;
										if (file.size > 2 * 1024 * 1024) {
											toast.error("Image must be smaller than 2MB");
											return;
										}
										setSelectedFile(file);
										setPhoto(URL.createObjectURL(file));
									}}
								/>
								<label
									htmlFor="avatar-picker"
									className="cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition-colors shadow-sm flex items-center gap-1.5"
								>
									<ImageIcon size={13} className="text-slate-400" /> Browse
									Local Files
								</label>
								{photo && (
									<button
										type="button"
										onClick={() => {
											setPhoto("");
											setSelectedFile(null);
										}}
										className="cursor-pointer px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10 rounded-xl text-xs font-bold transition-all"
									>
										Remove
									</button>
								)}
							</div>
							<Hint>Supports JPG, PNG or WEBP (Max 2MB)</Hint>
						</div>
					</div>

					{/* Name + Email */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<Label>
								<User size={11} /> Full name
							</Label>
							<TextInput
								icon={User}
								type="text"
								required
								minLength={3}
								placeholder="Rajesh Kumar"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div>
							<Label>
								<Mail size={11} /> Email address
							</Label>
							<TextInput
								icon={Mail}
								type="email"
								placeholder="you@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
					</div>

					{/* Phone */}
					<div
						ref={phoneBoxRef}
						className={`rounded-xl p-4 border transition-all duration-300 ${phoneOk ? "border-slate-700 bg-transparent" : "border-amber-500/30 bg-amber-500/[0.04]"}`}
					>
						<Label>
							<Phone size={11} /> Phone number
							{phoneOk ? (
								<span className="normal-case font-semibold text-emerald-400 tracking-normal flex items-center gap-1">
									<CheckCircle2 size={10} /> verified
								</span>
							) : (
								<span className="normal-case font-semibold text-amber-400 tracking-normal flex items-center gap-1">
									<AlertTriangle size={10} /> required for updates
								</span>
							)}
						</Label>
						<TextInput
							icon={Phone}
							type="tel"
							placeholder="+91 98765 43210"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							className={
								!phoneOk ? "border-amber-500/40 focus:border-amber-500/60" : ""
							}
						/>
						<Hint>Indian mobile number: +91 followed by 10 digits.</Hint>
					</div>

					{/* State + City */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<Label>
								<MapPin size={11} /> State
							</Label>
							<div className="relative">
								<MapPin
									size={13}
									className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none z-10"
								/>
								<select
									value={state}
									onChange={(e) => {
										setState(e.target.value);
										setCity("");
									}}
									className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 appearance-none"
								>
									<option value="">Select state</option>
									{Object.keys(LOCATION_DATA).map((st) => (
										<option key={st} value={st}>
											{st.replaceAll("_", " ")}
										</option>
									))}
								</select>
							</div>
						</div>
						<div>
							<Label>
								<MapPin size={11} /> City
							</Label>
							<div className="relative">
								<MapPin
									size={13}
									className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none z-10"
								/>
								<select
									value={city}
									disabled={!state}
									onChange={(e) => setCity(e.target.value)}
									className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 appearance-none disabled:opacity-50"
								>
									<option value="">Select city</option>
									{state &&
										LOCATION_DATA[state]?.map((ct) => (
											<option key={ct} value={ct}>
												{ct}
											</option>
										))}
								</select>
							</div>
						</div>
					</div>

					{/* Bio */}
					<div>
						<Label>
							<FileText size={11} /> Bio
						</Label>
						<div className="relative">
							<FileText
								size={13}
								className="absolute left-3 top-3 text-slate-600 pointer-events-none"
							/>
							<textarea
								maxLength={500}
								rows={3}
								placeholder="Experienced electrician with 8+ years..."
								value={bio}
								onChange={(e) => setBio(e.target.value)}
								className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 transition-all"
							/>
						</div>
						<div className="flex justify-end mt-1">
							<span className="text-[10px] text-slate-600">
								{bio.length} / 500
							</span>
						</div>
					</div>

					<div className="flex justify-end pt-1">
						<SubmitBtn loading={profileLoading} saved={profileSaved}>
							Save changes
						</SubmitBtn>
					</div>
				</form>
			</Card>

			{/* ── 2. Password ── */}
			<Card
				id="password"
				icon={Lock}
				title="Change password"
				subtitle="Use a strong password you don't reuse."
				accent="emerald"
			>
				<form onSubmit={savePassword} className="space-y-4">
					{[
						{
							key: "current",
							label: "Current password",
							placeholder: "Your current password",
						},
						{
							key: "next",
							label: "New password",
							placeholder: "At least 6 characters",
						},
						{
							key: "confirm",
							label: "Confirm password",
							placeholder: "Repeat new password",
						},
					].map(({ key, label, placeholder }) => (
						<div key={key}>
							<Label>
								<Lock size={11} /> {label}
							</Label>
							<TextInput
								icon={Lock}
								type={showPwd[key] ? "text" : "password"}
								placeholder={placeholder}
								value={pwd[key]}
								onChange={setPwdField(key)}
								rightSlot={
									<button
										type="button"
										onClick={toggleShow(key)}
										className="cursor-pointer text-slate-600 hover:text-slate-400 transition-colors"
									>
										{showPwd[key] ? <EyeOff size={14} /> : <Eye size={14} />}
									</button>
								}
							/>
							{key === "next" && pwd.next.length > 0 && (
								<div className="flex gap-1.5 mt-2">
									{[1, 2, 3, 4].map((n) => (
										<div
											key={n}
											className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${n <= pwdStrength ? strengthColor : "bg-slate-700"}`}
										/>
									))}
								</div>
							)}
						</div>
					))}
					<div className="flex justify-end pt-1">
						<SubmitBtn loading={pwdLoading} saved={pwdSaved}>
							Update password
						</SubmitBtn>
					</div>
				</form>
			</Card>

			{/* ── 3. Danger zone ── */}
			<Card
				id="danger"
				icon={AlertTriangle}
				title="Danger zone"
				subtitle="Permanent actions that cannot be undone."
				accent="red"
			>
				<p className="text-sm text-slate-500 leading-relaxed mb-5">
					Deleting your account permanently removes your provider profile,
					services, availability slots, and all associated data.
				</p>
				{!deleteOpen ? (
					<button
						type="button"
						onClick={() => setDeleteOpen(true)}
						className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl text-sm font-bold transition-all"
					>
						<Trash2 size={14} /> Delete provider account
					</button>
				) : (
					<AnimatePresence>
						<motion.div
							initial={{ opacity: 0, y: -6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							className="space-y-3 p-4 bg-red-500/[0.04] border border-red-500/20 rounded-xl"
						>
							<p className="text-xs text-red-400 leading-relaxed">
								Type{" "}
								<span className="font-black font-mono tracking-widest">
									DELETE MY ACCOUNT
								</span>{" "}
								to confirm permanently.
							</p>
							<input
								type="text"
								placeholder="DELETE MY ACCOUNT"
								value={phrase}
								onChange={(e) => setPhrase(e.target.value)}
								className="w-full px-4 py-2.5 bg-slate-800 border border-red-500/30 focus:border-red-500/50 rounded-xl text-sm text-white font-mono tracking-widest placeholder-slate-700 focus:outline-none transition-all"
							/>
							<div className="flex gap-2 pt-1">
								<button
									type="button"
									onClick={() => {
										setDeleteOpen(false);
										setPhrase("");
									}}
									className="flex-1 py-2.5 text-sm font-medium text-slate-400 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
								>
									Cancel
								</button>
								<button
									type="button"
									disabled={phrase !== "DELETE MY ACCOUNT" || deleteLoading}
									onClick={deleteAccount}
									className="flex-1 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 disabled:bg-red-950 disabled:text-red-800 border border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2"
								>
									{deleteLoading ? (
										<Loader2 size={13} className="animate-spin" />
									) : (
										<Trash2 size={13} />
									)}{" "}
									Confirm delete
								</button>
							</div>
						</motion.div>
					</AnimatePresence>
				)}
			</Card>

			<div className="flex items-center gap-2 text-slate-700 text-xs pb-2">
				<ShieldCheck size={12} className="text-emerald-700" /> Data stored
				securely. Your information is never shared.
			</div>
		</div>
	);
}
