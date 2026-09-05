import { useMemo } from "react";
import { jwtDecode } from "jwt-decode";

export function useAuth() {
	return useMemo(() => {
		const token = localStorage.getItem("token");
		if (!token) return { user: null, isValid: false };

		try {
			const decoded = jwtDecode(token);
			const isExpired = decoded.exp * 1000 < Date.now();

			if (isExpired) {
				localStorage.removeItem("token");
				return { user: null, isValid: false };
			}

			return { user: decoded, isValid: true };
		} catch {
			localStorage.removeItem("token");
			return { user: null, isValid: false };
		}
	}, []);
}
