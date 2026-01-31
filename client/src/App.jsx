import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import PlainLayout from "./layouts/PlainLayout";
import ProtectedRoute from "./auth/ProtectedRoute";

const Home = lazy(() => import("./pages/Home"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const ServiceDetails = lazy(() => import("./pages/ServiceDetails"));
const ChooseRole = lazy(() => import("./pages/ChooseRole"));
const AllServices = lazy(() => import("./pages/AllServices"));
const BookingSuccess = lazy(() => import("./pages/BookingSuccess"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));

// Dashboards
const CustomerDashboard = lazy(
	() => import("./dashboards/customer/CustomerDashboard"),
);
const ProviderDashboard = lazy(
	() => import("./dashboards/provider/ProviderDashboard"),
);
const UserProfile = lazy(() => import("./dashboards/customer/UserProfile"));
const DashboardOverview = lazy(
	() => import("./dashboards/customer/DashboardOverview"),
);
const AllBookings = lazy(() => import("./dashboards/customer/AllBookings"));

const PageLoader = () => (
	<div className="flex h-screen w-full items-center justify-center bg-slate-50">
		<div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-600 border-t-transparent"></div>
	</div>
);

const router = createBrowserRouter([
	{
		path: "/",
		element: (
			<Suspense fallback={<PageLoader />}>
				<AppLayout />
			</Suspense>
		),
		children: [
			{ path: "/", element: <Home /> },
			{ path: "/choose-role", element: <ChooseRole /> },
			{ path: "/services", element: <AllServices /> },
			{ path: "/help", element: <HelpCenter /> },
			{
				path: "/dashboard",
				element: (
					<ProtectedRoute allowed={["customer"]}>
						<Suspense fallback={<PageLoader />}>
							<CustomerDashboard />
						</Suspense>
					</ProtectedRoute>
				),
				children: [
					{ index: true, element: <DashboardOverview /> },
					{ path: "bookings", element: <AllBookings /> },
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
		element: (
			<Suspense fallback={<PageLoader />}>
				<PlainLayout />
			</Suspense>
		),
		children: [
			{ path: "login", element: <SignIn /> },
			{ path: "sign-up", element: <SignUp /> },
			{ path: "forgot-password", element: <ForgotPassword /> },
			{ path: "reset-password/:resetToken", element: <ResetPassword /> },
			{ path: "/unauthorized", element: <Unauthorized /> },
			{ path: "services/:slug", element: <ServiceDetails /> },
			{ path: "/book/:customId", element: <BookingPage /> },
			{ path: "/booking-success", element: <BookingSuccess /> },
		],
	},
	{
		path: "/provider/dashboard",
		element: (
			<Suspense fallback={<PageLoader />}>
				<ProtectedRoute allowed={["provider"]}>
					<ProviderDashboard />
				</ProtectedRoute>
			</Suspense>
		),
	},
]);

export default function App() {
	return <RouterProvider router={router} />;
}
