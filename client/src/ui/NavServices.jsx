import { Link } from "react-router-dom";

const servicesList = [
	{ name: "House Cleaning", path: "/services/house-cleaning" },
	{ name: "Laundry", path: "/services/laundry" },
	{ name: "Plumbing", path: "/services/plumbing" },
	{ name: "Electrical Repair", path: "/services/electric-repair" },
	{ name: "Gardening", path: "/services/gardening" },
	{ name: "Pest Control", path: "/services/pest-control" },
	{ name: "Cooking Help", path: "/services/cook" },
	{ name: "Tech Support", path: "/services/tech-support" },
	{ name: "Moving Help", path: "/services/move-help" },
	{ name: "Painting", path: "/services/painting" },
	{ name: "Driver Service", path: "/services/driver" },
	{ name: "Massage", path: "/services/massage" },
	{ name: "Haircut", path: "/services/haircut" },
];

const NavServices = () => {
	return (
		<div className="w-96 rounded-xl border border-white/50 bg-white p-6 text-gray-800 shadow-xl backdrop-blur-xl ring-1 ring-black/5">
			<h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
				Popular Services
			</h3>
			<div className="grid grid-cols-2 gap-x-6 gap-y-2 font-medium text-gray-700">
				{servicesList.map((service) => (
					<Link
						key={service.name}
						to={service.path}
						className="block rounded-lg p-2 -m-2 hover:bg-violet-100/50 hover:text-violet-700 before:scale-90 before:rounded-lg focus:before:scale-100 focus:before:bg-violet-100 before:transition-all focus:text-violet-600 transition-colors"
					>
						{service.name}
					</Link>
				))}
			</div>
		</div>
	);
};

export default NavServices;
