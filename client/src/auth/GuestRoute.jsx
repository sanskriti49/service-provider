import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
export default function GuestRoute({ children }) {
	const { user, isValid } = useAuth();

	if (!isValid || !user) return children;

	if (!user.role) return <Navigate to="/choose-role" replace />;

	if (user.role === "provider")
		return <Navigate to="/provider/dashboard" replace />;
	return <Navigate to="/dashboard" replace />;
}
