import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import PlainLayout from "./layouts/PlainLayout";
import ProtectedRoute from "./auth/ProtectedRoute";
import GuestRoute from "./auth/GuestRoute";
import { Toaster } from "sonner";
import PageLoader from "./ui/PageLoader";
import ProviderBookings from "./dashboards/provider/ProviderBookings";
import ProviderEarnings from "./dashboards/provider/ProviderEarnings";
import ProviderServices from "./dashboards/provider/ProviderServices";
import ProviderSettings from "./dashboards/provider/ProviderSettings";

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

// Suspense is placed at the layout level so each layout gets ONE fallback.
// Child routes are lazy but share the parent's Suspense boundary.
const router = createBrowserRouter([
	{
		element: <AppLayout />,
		children: [
			{ path: "/", element: <Home /> },
			{ path: "/choose-role", element: <ChooseRole /> },
			{ path: "/services", element: <AllServices /> },
			{ path: "/help", element: <HelpCenter /> },
			{ path: "/unauthorized", element: <Unauthorized /> },

			// customer-only routes
			{
				path: "/dashboard",
				element: (
					<ProtectedRoute allowed={["customer"]}>
						<CustomerDashboard />
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
			{
				path: "/login",
				element: (
					<GuestRoute>
						<SignIn />
					</GuestRoute>
				),
			},
			{
				path: "/sign-up",
				element: (
					<GuestRoute>
						<SignUp />
					</GuestRoute>
				),
			},
			{ path: "/forgot-password", element: <ForgotPassword /> },
			{ path: "/reset-password/:resetToken", element: <ResetPassword /> },
			{ path: "/services/:slug", element: <ServiceDetails /> },
			{
				path: "/book/:customId",
				element: (
					<ProtectedRoute allowed={["customer"]}>
						<BookingPage />
					</ProtectedRoute>
				),
			},
			{
				path: "/booking-success",
				element: (
					<ProtectedRoute allowed={["customer"]}>
						<BookingSuccess />
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
		children: [
			{ index: true, element: null },
			{ path: "bookings", element: <ProviderBookings /> },
			{ path: "earnings", element: <ProviderEarnings /> },
			{ path: "services", element: <ProviderServices /> },
			{ path: "settings", element: <ProviderSettings /> },
		],
	},
]);

export default function App() {
	return (
		<>
			<Toaster
				richColors
				position="top-center"
				closeButton
				expand={true}
				visibleToasts={3}
				toastOptions={{
					unstyled: false,
					classNames: {
						toast: "text-base font-sans rounded-2xl",
						title: "text-base font-bold",
						description: "text-sm",
					},
				}}
			/>
			<RouterProvider router={router} />
		</>
	);
}
