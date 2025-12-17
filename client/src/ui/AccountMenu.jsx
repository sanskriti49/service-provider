import { useState } from "react";
import {
	Avatar,
	IconButton,
	Menu,
	MenuItem,
	ListItemIcon,
	Divider,
} from "@mui/material";
import { Link } from "react-router-dom";

import {
	LayoutDashboard,
	UserCircle,
	Settings,
	HelpCircle,
	LogOut,
	CalendarCheck,
	Wallet,
	Star,
	Briefcase,
	BarChart3,
} from "lucide-react";

export default function AccountMenu({ user }) {
	const [anchorEl, setAnchorEl] = useState(null);
	const open = Boolean(anchorEl);

	const getInitials = (name) => {
		if (!name) return "U";
		const parts = name.split(" ");
		return `${parts[0][0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
	};

	const handleClick = (e) => setAnchorEl(e.currentTarget);
	const handleClose = () => setAnchorEl(null);

	const themeGradient = "linear-gradient(135deg, #7c3aed, #db2777)";
	const iconColor = "#7c3aed";

	return (
		<div>
			{/* Avatar Button */}
			<IconButton
				onClick={handleClick}
				sx={{
					ml: 2,
					transition: "0.2s",
					"&:hover": { transform: "scale(1.1)" },
				}}
			>
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
			</IconButton>

			{/* Menu */}
			<Menu
				anchorEl={anchorEl}
				open={open}
				onClose={handleClose}
				disableScrollLock
				PaperProps={{
					elevation: 0,
					sx: {
						mt: 1.5,
						minWidth: 190,
						overflow: "visible",
						background: "rgba(255,255,255,0.85)",
						backdropFilter: "blur(12px)",
						borderRadius: "16px",
						border: "1px solid rgba(255,255,255,0.5)",
						boxShadow: "0 8px 32px rgba(31,38,135,0.15)",
						"&:before": {
							content: '""',
							position: "absolute",
							top: 0,
							right: 20,
							width: 10,
							height: 10,
							bgcolor: "rgba(255,255,255,0.85)",
							transform: "translateY(-50%) rotate(45deg)",
							borderTop: "1px solid rgba(255,255,255,0.6)",
							borderLeft: "1px solid rgba(255,255,255,0.6)",
						},
					},
				}}
			>
				{/* Profile */}
				<MenuItem component={Link} to="/profile">
					<ListItemIcon>
						<UserCircle size={18} color={iconColor} />
					</ListItemIcon>
					Profile
				</MenuItem>

				{/* Dashboard */}
				<MenuItem
					component={Link}
					to={user.role === "provider" ? "/provider/dashboard" : "/dashboard"}
				>
					<ListItemIcon>
						<LayoutDashboard size={18} color={iconColor} />
					</ListItemIcon>
					Dashboard
				</MenuItem>

				{/* PROVIDER-SPECIFIC MENUS */}
				{user.role === "provider" && (
					<>
						<MenuItem component={Link} to="/provider/services">
							<ListItemIcon>
								<Briefcase size={18} color={iconColor} />
							</ListItemIcon>
							My Services
						</MenuItem>

						<MenuItem component={Link} to="/provider/bookings">
							<ListItemIcon>
								<CalendarCheck size={18} color={iconColor} />
							</ListItemIcon>
							Bookings
						</MenuItem>

						<MenuItem component={Link} to="/provider/earnings">
							<ListItemIcon>
								<Wallet size={18} color={iconColor} />
							</ListItemIcon>
							Earnings
						</MenuItem>

						<MenuItem component={Link} to="/provider/reviews">
							<ListItemIcon>
								<Star size={18} color={iconColor} />
							</ListItemIcon>
							Reviews
						</MenuItem>

						<MenuItem component={Link} to="/provider/analytics">
							<ListItemIcon>
								<BarChart3 size={18} color={iconColor} />
							</ListItemIcon>
							Analytics
						</MenuItem>
					</>
				)}

				{/* Settings */}
				<MenuItem component={Link} to="/settings">
					<ListItemIcon>
						<Settings size={18} color={iconColor} />
					</ListItemIcon>
					Settings
				</MenuItem>

				{/* Help */}
				<MenuItem component={Link} to="/help">
					<ListItemIcon>
						<HelpCircle size={18} color={iconColor} />
					</ListItemIcon>
					Help & Support
				</MenuItem>

				<Divider sx={{ my: 1 }} />

				{/* Logout */}
				<MenuItem
					onClick={() => {
						localStorage.removeItem("token");
						window.location.reload();
					}}
					sx={{ color: "#ef4444" }}
				>
					<ListItemIcon>
						<LogOut size={18} color="#ef4444" />
					</ListItemIcon>
					Logout
				</MenuItem>
			</Menu>
		</div>
	);
}
