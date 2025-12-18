import React from "react";
import { Link } from "react-router-dom";

const Unauthorized = () => {
	return (
		<div className="flex flex-col items-center justify-center h-screen">
			<h1 className="text-3xl font-bold text-red-600">Access Denied</h1>
			<p>You do not have permission to view this page.</p>
			<Link to="/login" className="mt-4 text-blue-500 underline">
				Go to Login
			</Link>
		</div>
	);
};
export default Unauthorized;
