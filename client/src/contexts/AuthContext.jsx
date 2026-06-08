import { createContext, useContext, useState, useEffect, useMemo } from "react";
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
				localStorage.clear();
				return null;
			}

			// Hydrate initially from persistent storage to minimize visual layout shifts
			const cachedDetails = JSON.parse(localStorage.getItem("user") || "{}");
			return { ...decoded, ...cachedDetails };
		} catch {
			localStorage.clear();
			return null;
		}
	});

	// Fetches fully fleshed database row to capture fields missing from JWT payload strings
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
				console.warn("Session profile hydration fallback failed:", err.message);
			}
		};

		hydrateDatabaseProfile();
	}, []);

	const syncUser = (freshUserData) => {
		if (!freshUserData) {
			setUserState(null);
			localStorage.clear();
		} else {
			setUserState((prev) => {
				const updated = { ...prev, ...freshUserData };
				localStorage.setItem("user", JSON.stringify(updated));
				return updated;
			});
		}
	};

	const value = useMemo(
		() => ({
			user,
			isValid: !!user,
			syncUser,
			logout: () => syncUser(null),
		}),
		[user],
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
