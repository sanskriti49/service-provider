// List
export const SERVICE_NAMES = [
	// Home Services
	"House Cleaning",
	"Laundry",
	"Plumbing",
	"Pest Control",
	"Electrical Repair",
	"Tech Support",
	"Cooking Help",
	"Gardening",
	"Massage",
	"Moving Help",
	"Painting",
	"Appliance Repair",
	"Driver Service",

	// Beauty & Personal Care - Men
	"Haircut",
	"Shaving",

	// Beauty & Personal Care - Women
	"Bridal Makeup",
	"Eyebrow Threading",
	"Facial",
	"Hair Spa",
	"Makeup",
	"Hand Spa",
	"Nail Art",
	"Foot Spa",
	"Full Body Glow",
	"Arm Smoothening ",
	"Leg Smoothening ",
	"Mehndi",

	// Child Services
	"Babysitting",
	"Child Tutoring",

	// Fitness / Health
	"Nutritionist",
	"Yoga Instructor",
];
// Helpers
export function slugify(serviceName) {
	return serviceName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

export function getDescriptionForService(serviceName) {
	const descriptions = {
		// Home Services
		"House Cleaning": "Professional and thorough cleaning for a spotless home.",
		Laundry:
			"Convenient and hygienic laundry service including washing, drying, and folding—right at your doorstep.",
		Plumbing: "Expert plumbing solutions for leaks, clogs, and installations.",
		"Electrical Repair":
			"Certified electricians for safe home electrical fixes.",
		Gardening: "Plant care, lawn maintenance, and landscaping by pros.",
		"Pest Control": "Safe and effective pest removal and prevention.",
		"Appliance Repair": "Quick and reliable repair for household appliances.",
		"Cooking Help": "Daily meal prep and kitchen assistance by skilled cooks.",
		"Tech Support": "On-demand help with gadgets, Wi-Fi, and computer issues.",
		"Moving Help": "Efficient packing, lifting, and moving assistance.",
		Painting: "Smooth and clean wall painting by professionals.",
		"Driver Service": "Trained drivers for travel or local errands.",
		Massage: "Therapeutic massage for relaxation and stress relief.",

		// Child Services
		Babysitting: "Trusted babysitters to care for your little ones.",
		"Child Tutoring": "Personalized tutoring in core school subjects.",
		"Haircut (Kids)": "Friendly and patient haircuts for kids.",

		// Beauty & Personal Care - Women
		"Haircut (Women)": "Salon-style women’s haircut in the comfort of home.",
		Makeup: "Flawless makeup for daily wear or special events.",
		"Bridal Makeup": "Elegant and long-lasting bridal makeup service.",
		"Eyebrow Threading": "Perfectly shaped brows with minimal discomfort.",
		Facial: "Glowing skin with deep-cleansing and nourishing facials.",
		Manicure: "Clean, shaped nails with polish and hand care.",
		Pedicure: "Relaxing foot care and grooming by professionals.",
		"Waxing (Full Body)": "Smooth skin with hygienic full-body waxing.",
		"Waxing (Arms)": "Quick and gentle waxing for arms.",
		"Waxing (Legs)": "Expert waxing for silky-smooth legs.",
		"Hair Coloring": "Safe, trendy hair coloring by trained stylists.",
		"Nail Art": "Stylish and creative nail designs at home.",
		"Skin Treatment": "Targeted skincare for healthy and radiant skin.",
		"Hair Spa": "Deep conditioning hair spa to nourish and restore.",
		Mehndi: "Beautiful mehndi designs for weddings and occasions.",

		// Beauty & Personal Care - Men
		"Haircut (Men)": "Clean, sharp haircuts tailored to your style.",
		"Beard Styling": "Trim, shape, and style your beard professionally.",
		Shaving: "Smooth and comfortable shaving at home.",

		// Fitness / Health
		"Yoga Instructor": "Guided personal yoga sessions for mind and body.",
		Nutritionist: "Personal diet plans for better health and lifestyle.",
	};

	return descriptions[serviceName] || "High-quality service at your doorstep.";
}

export function getImageForService(serviceName) {
	const images = {
		// Home Services
		"House Cleaning": "/images/clean.jpg",
		Laundry: "/images/laundryy.jpg",
		Plumbing: "/images/plumbi.jpg",
		"Electrical Repair": "/images/electr.jpg",
		Gardening: "/images/gardenn.jpg",
		"Pest Control": "/images/pestt.jpg",
		"Appliance Repair": "/images/repai.jpg",
		"Cooking Help": "/images/cookk.jpg",
		"Tech Support": "/images/tech.jpg",
		"Moving Help": "/images/moving.jpg",
		Painting: "/images/painting.jpg",
		"Driver Service": "/images/drive.jpg",
		Massage: "/images/massagee.jpg",
		Haircut: "/images/haircut-all.jpg",

		// Child Services
		Babysitting: "/images/baby-sit.jpg",
		"Child Tutoring": "/images/child-tutor.jpg",

		// Beauty & Personal Care - Women
		Makeup: "/images/makeup2.jpg",
		"Bridal Makeup": "/images/makeup1.jpg",
		"Eyebrow Threading": "/images/threading.jpg",
		Facial: "/images/faciall.jpg",
		"Hand Spa": "/images/manicureee.jpg",
		"Foot Spa": "/images/pedicuree.jpg",
		"Full Body Glow": "/images/wax.jpg",
		"Arm Smoothening ": "/images/wax.jpg",
		"Leg Smoothening ": "/images/wax.jpg",
		"Hair Spa": "/images/hair.jpg",

		//"Color & Highlights": "/images/hair-colour.jpg",
		"Nail Art": "/images/nail-art.jpg",
		Mehndi: "/images/mehendii.jpg",

		// Beauty & Personal Care - Men
		Shaving: "/images/shave.jpg",

		// Fitness / Health
		"Yoga Instructor": "/images/yogaaa.jpg",
		Nutritionist: "/images/nutrition.jpg",
	};

	const img = images[serviceName];
	if (!img) {
		console.warn(`No image found for service: "${serviceName}"`);
	}
	return img || null;
}

// Services with metadata
export const SERVICES = SERVICE_NAMES.map((name) => ({
	name,
	slug: slugify(name),
	description: getDescriptionForService(name),
	image: getImageForService(name),
}));
