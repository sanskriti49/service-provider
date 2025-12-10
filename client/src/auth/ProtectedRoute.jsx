import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function ProtectedRoute({ children, allowed }) {
	const token = localStorage.getItem("token");
	if (!token) return <Navigate to="/login" />;

	try {
		const decoded = jwtDecode(token);
		if (!allowed.includes(decoded.role)) {
			return <Navigate to="/unauthorized" />;
		}
		return children;
	} catch (e) {
		return <Navigate to="/login" />;
	}
}
