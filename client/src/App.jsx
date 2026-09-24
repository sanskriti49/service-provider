import { lazy, Suspense } from "react";
import {
	createBrowserRouter,
	RouterProvider,
	Navigate,
} from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import PlainLayout from "./layouts/PlainLayout";
import ProtectedRoute from "./auth/ProtectedRoute";
import GuestRoute from "./auth/GuestRoute";
import { Toaster } from "sonner";
import PageLoader from "./ui/PageLoader";
import Home from "./pages/Home";

const ProviderBookings = lazy(
	() => import("./dashboards/provider/ProviderBookings"),
);
const ProviderEarnings = lazy(
	() => import("./dashboards/provider/ProviderEarnings"),
);
const ProviderServices = lazy(
	() => import("./dashboards/provider/ProviderServices"),
);
const ProviderReviews = lazy(
	() => import("./dashboards/provider/ProviderReviews"),
);
const ProviderSettings = lazy(
	() => import("./dashboards/provider/ProviderSettings"),
);
const ApplyProvider = lazy(() => import("./pages/ApplyProvider"));
const AdminDashboard = lazy(() => import("./dashboards/admin/AdminDashboard"));

const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const BookingPage = lazy(() => import("./dashboards/customer/BookingPage"));
const ServiceDetails = lazy(() => import("./pages/ServiceDetails"));
const ChooseRole = lazy(() => import("./pages/ChooseRole"));
const AllServices = lazy(() => import("./pages/AllServices"));
const BookingSuccess = lazy(
	() => import("./dashboards/customer/BookingSuccess"),
);
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const CustomerSettings = lazy(
	() => import("./dashboards/customer/CustomerSettings"),
);
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Reviews = lazy(() => import("./pages/Reviews"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));

const CustomerDashboard = lazy(
	() => import("./dashboards/customer/CustomerDashboard"),
);
const ProviderDashboard = lazy(
	() => import("./dashboards/provider/ProviderDashboard"),
);
const CustomerProfile = lazy(
	() => import("./dashboards/customer/CustomerProfile"),
);
const DashboardOverview = lazy(
	() => import("./dashboards/customer/DashboardOverview"),
);
const AllBookings = lazy(() => import("./dashboards/customer/AllBookings"));

const router = createBrowserRouter([
	{
		element: <AppLayout />,
		children: [
			{ path: "/", element: <Home /> },
			{ path: "/choose-role", element: <ChooseRole /> },
			{ path: "/services", element: <AllServices /> },

			{ path: "/help", element: <HelpCenter /> },
			{ path: "/unauthorized", element: <Unauthorized /> },

			{ path: "/services/:slug", element: <ServiceDetails /> },
			{ path: "/apply-now", element: <ApplyProvider /> },
			{ path: "*", element: <Navigate to="/" replace /> },
		],
	},
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
			{ index: true, element: null },
			{ path: "bookings", element: <AllBookings /> },
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
			{ path: "/sign-in", element: <Navigate to="/login" replace /> },
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
			{
				path: "/account/profile",
				element: (
					<ProtectedRoute allowed={["customer"]}>
						<CustomerProfile />
					</ProtectedRoute>
				),
			},
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
			{ path: "/notifications", element: <NotificationsPage /> },
			{
				path: "/account/settings",
				element: (
					<ProtectedRoute allowed={["customer"]}>
						<CustomerSettings />
					</ProtectedRoute>
				),
			},
			{ path: "/reviews", element: <Reviews /> },
		],
	},
	{
		path: "/provider/dashboard",
		element: (
			<ProtectedRoute allowed={["provider"]}>
				<Suspense fallback={<PageLoader />}>
					<ProviderDashboard />
				</Suspense>
			</ProtectedRoute>
		),
		children: [
			{ index: true, element: null },
			{ path: "bookings", element: <ProviderBookings /> },
			{ path: "earnings", element: <ProviderEarnings /> },
			{ path: "services", element: <ProviderServices /> },
			{ path: "reviews", element: <ProviderReviews /> },
			{ path: "settings", element: <ProviderSettings /> },
		],
	},
	{
		path: "/admin",
		element: (
			<ProtectedRoute allowed={["admin"]}>
				<Suspense fallback={<PageLoader />}>
					<AdminDashboard />
				</Suspense>
			</ProtectedRoute>
		),
	},
]);

export default function App() {
	return (
		<>
			<Toaster
				theme="dark"
				position="bottom-right"
				closeButton
				gap={8}
				offset={20}
				visibleToasts={4}
				toastOptions={{
					className: "taskgenie-toast",
					classNames: {
						toast:
							"bg-[#120a22]/95 backdrop-blur-md border border-white/10 text-slate-100 rounded-xl shadow-2xl shadow-black/80 px-4 py-3 text-xs flex items-start gap-3",
						title: "text-xs font-bold text-white tracking-tight",
						description:
							"text-[11px] text-slate-300 font-normal leading-relaxed mt-0.5",
						actionButton:
							"bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg",
						cancelButton:
							"bg-white/[0.04] text-slate-300 hover:text-white text-xs px-2.5 py-1 rounded-lg border border-white/10",
						closeButton:
							"!bg-[#1a1130] !border-white/10 !text-slate-400 hover:!text-white",
						success: "!border-emerald-500/20 [&_[data-icon]]:!text-emerald-400",
						error: "!border-rose-500/20 [&_[data-icon]]:!text-rose-400",
						warning: "!border-amber-500/20 [&_[data-icon]]:!text-amber-400",
						info: "!border-violet-500/20 [&_[data-icon]]:!text-violet-400",
						loading: "!border-violet-500/20 [&_[data-icon]]:!text-violet-400",
					},
				}}
			/>
			<RouterProvider router={router} />
		</>
	);
}
