import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Blocks unauthenticated or unauthorised users.
 *
 * Props:
 *   allowed  — array of roles that may access this route, e.g. ["customer"]
 *   children — the page/component to render if checks pass
 */
export default function ProtectedRoute({ children, allowed }) {
	const { user, isValid } = useAuth();

	// Not logged in → go to login
	if (!isValid || !user) return <Navigate to="/login" replace />;

	// Google-OAuth user who hasn't picked a role yet
	if (!user.role) return <Navigate to="/choose-role" replace />;

	// Role check — e.g. provider trying to reach customer dashboard
	if (allowed && !allowed.includes(user.role)) {
		return <Navigate to="/unauthorized" replace />;
	}

	return children;
}
