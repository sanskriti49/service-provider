import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function ProtectedRoute({ children, allowed }) {
	const token = localStorage.getItem("token");
	if (!token) return <Navigate to="/login" replace />;

	try {
		const decoded = jwtDecode(token);
		const userRole = decoded.role;

		// if (!allowed.includes(decoded.role)) {
		// 	return <Navigate to="/unauthorized" />;
		// }
		// 4. Check if Role is allowed
		// (allowed is an array like ["customer"] or ["provider"])
		if (allowed && !allowed.includes(userRole)) {
			// If user has NO role yet (google login), send to choose role
			if (!userRole) {
				return <Navigate to="/choose-role" replace />;
			}
			// Otherwise, they are unauthorized (e.g., provider trying to see customer dash)
			return <Navigate to="/unauthorized" replace />;
		}
		return children;
	} catch (e) {
		// If token is gibberish or invalid, clear it and go to login
		console.error("Invalid token in protected route", error);
		localStorage.removeItem("token");
		return <Navigate to="/login" replace />;
	}
}
