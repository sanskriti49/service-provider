import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children, allowed }) {
	const { user, isValid } = useAuth();

	if (!isValid || !user) return <Navigate to="/login" replace />;

	if (!user.role) return <Navigate to="/choose-role" replace />;

	if (allowed && !allowed.includes(user.role)) {
		return <Navigate to="/unauthorized" replace />;
	}

	return children;
}
