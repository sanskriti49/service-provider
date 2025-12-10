import { createBrowserRouter, RouterProvider } from "react-router-dom";
import AppLayout from "./AppLayout";
import PlainLayout from "./PlainLayout";

import Home from "./pages/Home";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ServiceDetails from "./pages/ServiceDetails";
import ProtectedRoute from "./auth/ProtectedRoute";
import CustomerDashboard from "./dashboards/customer/CustomerDashboard";
import ProviderDashboard from "./dashboards/provider/ProviderDashboard";
import ChooseRole from "./pages/ChooseRole";
import AllServices from "./pages/AllServices";

const router = createBrowserRouter([
	{
		path: "/",
		element: <AppLayout />,
		children: [
			{ path: "/", element: <Home /> },
			{
				path: "/choose-role",
				element: <ChooseRole />,
			},
			{ path: "/services", element: <AllServices /> },
		],
	},

	{
		element: <PlainLayout />,
		children: [
			{ path: "login", element: <SignIn /> },
			{ path: "sign-up", element: <SignUp /> },
			{ path: "services/:slug", element: <ServiceDetails /> },
		],
	},
	{
		element: <AppLayout />,
		children: [
			{
				path: "/dashboard",
				element: (
					<ProtectedRoute allowed={["customer"]}>
						<CustomerDashboard />
					</ProtectedRoute>
				),
			},
		],
	},
	{
		path: "/provider/dashboard",
		element: (
			<ProtectedRoute allowed={["provider"]}>
				<ProviderDashboard />
			</ProtectedRoute>
		),
	},
]);

export default function App() {
	return <RouterProvider router={router} />;
}
