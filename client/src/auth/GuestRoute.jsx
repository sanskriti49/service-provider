import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
/**
 * Prevents logged-in users from reaching guest-only pages (login, sign-up).
 * Redirects them to their appropriate dashboard instead.
 */
export default function GuestRoute({ children }) {
	const { user, isValid } = useAuth();

	// Not logged in → show the guest page
	if (!isValid || !user) return children;

	// Logged in but role not chosen yet (e.g. fresh Google OAuth)
	if (!user.role) return <Navigate to="/choose-role" replace />;

	// Send to the correct dashboard based on role
	if (user.role === "provider")
		return <Navigate to="/provider/dashboard" replace />;
	return <Navigate to="/dashboard" replace />;
}
