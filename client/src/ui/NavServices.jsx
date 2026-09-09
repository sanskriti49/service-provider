import { Link, useNavigate, useLocation } from "react-router-dom";
import {
	Sparkles,
	ArrowRight,
	Wrench,
	Home,
	Zap,
	ShieldCheck,
	Flame,
	Tv,
	Compass,
	Scissors,
	PaintBucket,
	Truck,
} from "lucide-react";

const popularServices = [
	{
		name: "House Cleaning",
		path: "/services/house-cleaning",
		icon: Home,
		color: "text-sky-600 bg-sky-50",
	},
	{
		name: "Plumbing",
		path: "/services/plumbing",
		icon: Wrench,
		color: "text-blue-600 bg-blue-50",
	},
	{
		name: "Electrical Repair",
		path: "/services/electrical-repair",
		icon: Zap,
		color: "text-amber-600 bg-amber-50",
	},
	{
		name: "Pest Control",
		path: "/services/pest-control",
		icon: ShieldCheck,
		color: "text-emerald-600 bg-emerald-50",
	},
	{
		name: "Cooking Help",
		path: "/services/cooking-help",
		icon: Flame,
		color: "text-orange-600 bg-orange-50",
	},
	{
		name: "Tech Repair",
		path: "/services/computer-tech-repair",
		icon: Tv,
		color: "text-indigo-600 bg-indigo-50",
	},
	{
		name: "Painting",
		path: "/services/painting",
		icon: PaintBucket,
		color: "text-purple-600 bg-purple-50",
	},
	{
		name: "Moving Help",
		path: "/services/moving-help",
		icon: Truck,
		color: "text-violet-600 bg-violet-50",
	},
	{
		name: "Personal Grooming",
		path: "/services/mens-haircut",
		icon: Scissors,
		color: "text-pink-600 bg-pink-50",
	},
	{
		name: "Full Marketplace",
		path: "/services",
		icon: Compass,
		color: "text-fuchsia-600 bg-fuchsia-50",
		highlight: true,
	},
];

const NavServices = ({ onClose }) => {
	const navigate = useNavigate();
	const location = useLocation();

	const handleScrollToSection = (e) => {
		e.preventDefault();
		onClose?.();
		if (location.pathname === "/") {
			const el = document.getElementById("services");
			if (el) {
				const y = el.getBoundingClientRect().top + window.pageYOffset - 90;
				window.scrollTo({ top: y, behavior: "smooth" });
			}
		} else {
			navigate("/#services");
		}
	};

	return (
		<div className="w-[420px] rounded-2xl border border-violet-100/60 bg-white/95 backdrop-blur-2xl p-4 text-slate-800 shadow-2xl ring-1 ring-black/5">
			{/* Header */}
			<div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 px-1">
				<div className="flex items-center gap-2">
					<Sparkles size={16} className="text-violet-600" />
					<span className="text-xs font-bold uppercase tracking-wider text-slate-500">
						Popular Services
					</span>
				</div>
				<Link
					to="/services"
					onClick={() => onClose?.()}
					className="text-xs font-semibold text-violet-700 hover:text-violet-900 flex items-center gap-1 transition-colors group"
				>
					View All Services
					<ArrowRight
						size={13}
						className="group-hover:translate-x-0.5 transition-transform"
					/>
				</Link>
			</div>

			{/* Service Grid */}
			<div className="grid grid-cols-2 gap-1.5">
				{popularServices.map((service) => {
					const Icon = service.icon;
					return (
						<Link
							key={service.name}
							to={service.path}
							onClick={() => onClose?.()}
							className={`flex items-center gap-2.5 p-2 rounded-xl text-sm font-medium transition-all group ${
								service.highlight
									? "bg-violet-50/70 hover:bg-violet-100 text-violet-800 font-semibold"
									: "text-slate-700 hover:bg-slate-50 hover:text-violet-700"
							}`}
						>
							<div
								className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${service.color}`}
							>
								<Icon size={15} />
							</div>
							<span className="truncate">{service.name}</span>
						</Link>
					);
				})}
			</div>

			{/* Bottom Jump Bar */}
			<div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between px-1 text-xs">
				<button
					type="button"
					onClick={handleScrollToSection}
					className="text-slate-500 hover:text-violet-700 font-medium transition-colors cursor-pointer"
				>
					Jump to Featured on Home &darr;
				</button>
				<Link
					to="/services"
					onClick={() => onClose?.()}
					className="font-bold text-violet-600 hover:underline"
				>
					Browse 20+ categories
				</Link>
			</div>
		</div>
	);
};

export default NavServices;
