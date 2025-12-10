import axios from "axios";
import React from "react";
import { useNavigate } from "react-router-dom";

const ChooseRole = () => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);

	const setRole = async (role) => {
		try {
			setLoading(true);

			const token = localStorage.getItem("token");

			await axios.post(
				"/api/auth/set-role",
				{ role },
				{ headers: { Authorization: `Bearer ${token}` } }
			);

			if (role === "customer") navigate("/dashboard");
			else navigate("/provider/dashboard");
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	};
	return (
		<div className="bricolage-grotesque min-h-[70vh] flex flex-col items-center justify-center space-y-6">
			<h1 className="text-3xl font-bold">Choose Your Role</h1>

			<div className="flex gap-6">
				<button
					onClick={() => setRole("customer")}
					className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg hover:scale-105 transition"
				>
					Customer
				</button>
				<button
					onClick={() => setRole("provider")}
					className="px-6 py-3 bg-purple-600 text-white rounded-xl shadow-lg hover:scale-105 transition"
				>
					Service Provider
				</button>

				{loading && <p className="text-gray-500">Updating role...</p>}
			</div>
		</div>
	);
};

export default ChooseRole;
