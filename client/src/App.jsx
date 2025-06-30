import { createBrowserRouter, RouterProvider } from "react-router-dom";
import AppLayout from "./AppLayout";
const router = createBrowserRouter([
	{
		path: "/",
		element: <AppLayout />,
	},
]);

function App() {
	return <RouterProvider router={router} />;
}
export default App;
