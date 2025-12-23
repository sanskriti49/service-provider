import { Outlet } from "react-router-dom";

export default function PlainLayout() {
	return (
		<div
			className="min-h-screen w-full bg-cover bg-center bg-no-repeat bg-fixed"
			style={{ backgroundImage: "url('/images/background.webp')" }}
		>
			<Outlet />
		</div>
	);
}
