import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import ChatProvider from "./chat/ChatProvider.jsx";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<AuthProvider>
			<ChatProvider><App /></ChatProvider>
		</AuthProvider>
	</StrictMode>,
);
