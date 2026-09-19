import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import api from "../api/axiosInstance";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
	const [user, setUserState] = useState(() => {
		const token = localStorage.getItem("token");
		if (!token) return null;

		try {
			const decoded = jwtDecode(token);
			const isExpired = decoded.exp * 1000 < Date.now();
			if (isExpired) {
				localStorage.removeItem("token");
				localStorage.removeItem("user");
				return null;
			}

			const cachedDetails = JSON.parse(localStorage.getItem("user") || "{}");
			return { ...decoded, ...cachedDetails };
		} catch {
			localStorage.removeItem("token");
			localStorage.removeItem("user");
			return null;
		}
	});

	const syncUser = useCallback((freshUserData) => {
		if (!freshUserData) {
			setUserState(null);
			localStorage.removeItem("token");
			localStorage.removeItem("user");
		} else {
			setUserState((prev) => {
				const updated = { ...prev, ...freshUserData };
				localStorage.setItem("user", JSON.stringify(updated));
				return updated;
			});
		}
	}, []);

	const login = useCallback((token, freshUserData) => {
		if (!token) return null;
		localStorage.setItem("token", token);
		let decoded = {};
		try {
			decoded = jwtDecode(token);
		} catch (err) {
			console.error("JWT decode failed during login:", err);
		}

		const fullUser = { ...decoded, ...(freshUserData || {}) };
		localStorage.setItem("user", JSON.stringify(fullUser));
		setUserState(fullUser);
		return fullUser;
	}, []);

	const logout = useCallback(() => {
		syncUser(null);
	}, [syncUser]);

	// Self-healing check: if user state is empty or desynced but token is present in localStorage
	useEffect(() => {
		if (!user?.id) {
			const token = localStorage.getItem("token");
			if (token) {
				try {
					const decoded = jwtDecode(token);
					if (decoded.exp * 1000 >= Date.now()) {
						const cached = JSON.parse(localStorage.getItem("user") || "{}");
						setUserState({ ...decoded, ...cached });
					} else {
						localStorage.removeItem("token");
						localStorage.removeItem("user");
					}
				} catch {
					localStorage.removeItem("token");
					localStorage.removeItem("user");
				}
			}
		}
	}, [user?.id]);

	// Listen to storage events across tabs or external token writes
	useEffect(() => {
		const handleStorageChange = (e) => {
			if (e.key === "token" || e.key === "user") {
				const token = localStorage.getItem("token");
				if (!token) {
					setUserState(null);
				} else {
					try {
						const decoded = jwtDecode(token);
						const cached = JSON.parse(localStorage.getItem("user") || "{}");
						setUserState({ ...decoded, ...cached });
					} catch {
						setUserState(null);
					}
				}
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => window.removeEventListener("storage", handleStorageChange);
	}, []);

	// Background DB profile hydration
	useEffect(() => {
		const hydrateDatabaseProfile = async () => {
			const token = localStorage.getItem("token");
			if (!token) return;

			try {
				const response = await api.get("/api/auth/me");
				const freshDbUser = response.data?.user;
				if (freshDbUser) {
					syncUser(freshDbUser);
				}
			} catch (err) {
				console.warn("Session profile hydration fallback notice:", err.message);
			}
		};

		hydrateDatabaseProfile();
	}, [syncUser]);

	const value = useMemo(
		() => ({
			user,
			isValid: Boolean(user?.id && user?.role),
			login,
			syncUser,
			logout,
		}),
		[user, login, syncUser, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
