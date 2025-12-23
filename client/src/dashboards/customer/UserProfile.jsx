import { Avatar, MenuItem } from "@mui/material";
import {
	Bell,
	CreditCard,
	HelpCircle,
	Lock,
	LogOut,
	MapPin,
	Section,
	User,
} from "lucide-react";
import { useState } from "react";

export default function UserProfile() {
	const [user, setUser] = useState(
		JSON.parse(localStorage.getItem("user") || "{}")
	);

	const getInitials = (name) => {
		if (!name) return "U";
		const parts = name.split(" ");
		return `${parts[0][0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
	};
	const themeGradient = "linear-gradient(135deg, #7c3aed, #db2777)";
	const iconColor = "#7c3aed";

	return (
		<div className="max-w-2xl mx-auto p-6">
			<Avatar
				sx={{
					width: 40,
					height: 40,
					background: themeGradient,
					fontSize: "1rem",
					fontWeight: "bold",
					border: "2px solid rgba(255,255,255,0.5)",
					boxShadow: "0 4px 10px rgba(124,58,237,0.25)",
				}}
			>
				{getInitials(user.name || user.fullName || user.email)}
			</Avatar>

			{/* 2. Menu Groups */}
			<div className="space-y-6">
				<Section title="Account">
					<MenuItem icon={<User />} label="Personal Information" />
					<MenuItem icon={<MapPin />} label="Saved Addresses" />
					<MenuItem icon={<CreditCard />} label="Payment Methods" />
				</Section>

				<Section title="Preferences">
					<MenuItem icon={<Bell />} label="Notifications" />
					<MenuItem icon={<Lock />} label="Security & Password" />
				</Section>

				<Section title="Support">
					<MenuItem icon={<HelpCircle />} label="Help Center" />
					<MenuItem icon={<LogOut />} label="Log Out" isDanger />
				</Section>
			</div>
		</div>
	);
}
