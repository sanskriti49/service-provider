import { useMemo } from "react";
import { jwtDecode } from "jwt-decode";

/**
 * Returns `{ user, isExpired, isValid }` derived from the stored JWT.
 *
 * user     — decoded payload, or null if no/invalid token
 * isValid  — token exists, parses, and is not expired
 */
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
			// Corrupted / tampered token
			localStorage.removeItem("token");
			return { user: null, isValid: false };
		}
	}, []); // runs once per mount — re-mount happens on navigation anyway
}
