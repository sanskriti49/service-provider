import {
	createBrowserRouter,
	RouterProvider,
	useLocation,
} from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import PlainLayout from "./layouts/PlainLayout";

import Home from "./pages/Home";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import BookingPage from "./pages/BookingPage";
import ServiceDetails from "./pages/ServiceDetails";
import ProtectedRoute from "./auth/ProtectedRoute";
import CustomerDashboard from "./dashboards/customer/CustomerDashboard";
import ProviderDashboard from "./dashboards/provider/ProviderDashboard";
import ChooseRole from "./pages/ChooseRole";
import AllServices from "./pages/AllServices";
import BookingSuccess from "./pages/BookingSuccess";
import Unauthorized from "./pages/Unauthorized";
import SettingsPage from "./pages/SettingsPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import UserProfile from "./dashboards/customer/UserProfile";
import DashboardOverview from "./dashboards/customer/DashboardOverview";
import AllBookings from "./dashboards/customer/AllBookings";
import HelpCenter from "./pages/HelpCenter";

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
			{ path: "/help", element: <HelpCenter /> },
			{
				path: "/dashboard",
				element: (
					<ProtectedRoute allowed={["customer"]}>
						<CustomerDashboard />
					</ProtectedRoute>
				),
				children: [
					{
						index: true,
						element: <DashboardOverview />,
					},
					{
						path: "bookings",
						element: <AllBookings />,
					},
				],
			},
			{
				path: "/profile",
				element: (
					<ProtectedRoute allowed={["customer"]}>
						<UserProfile />
					</ProtectedRoute>
				),
			},
			{
				path: "/settings",
				element: (
					<ProtectedRoute allowed={["customer"]}>
						<SettingsPage />
					</ProtectedRoute>
				),
			},
		],
	},

	{
		element: <PlainLayout />,
		children: [
			{ path: "login", element: <SignIn /> },
			{ path: "sign-up", element: <SignUp /> },
			{ path: "forgot-password", element: <ForgotPassword /> },
			{ path: "reset-password/:resetToken", element: <ResetPassword /> },
			{ path: "/unauthorized", element: <Unauthorized /> },
			{ path: "services/:slug", element: <ServiceDetails /> },
			{ path: "/book/:customId", element: <BookingPage /> },
			{
				path: "/booking-success",
				element: <BookingSuccess />,
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
