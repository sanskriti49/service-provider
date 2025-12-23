const CATEGORIES = {
	HOME: "Home Services",
	PERSONAL: "Personal Care",
	CHILD: "Child Services",
	FITNESS: "Fitness / Health",
};

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
	"Arm Smoothening",
	"Leg Smoothening",
	"Mehndi",

	// Child Services
	"Babysitting",
	"Child Tutoring",

	// Fitness / Health
	"Nutritionist",
	"Yoga Instructor",
];

export const SERVICE_CATEGORIES = {
	// --- Home Services ---
	"House Cleaning": CATEGORIES.HOME,
	Laundry: CATEGORIES.HOME,
	Plumbing: CATEGORIES.HOME,
	"Pest Control": CATEGORIES.HOME,
	"Electrical Repair": CATEGORIES.HOME,
	"Tech Support": CATEGORIES.HOME,
	"Cooking Help": CATEGORIES.HOME,
	Gardening: CATEGORIES.HOME,
	Massage: CATEGORIES.PERSONAL,
	"Moving Help": CATEGORIES.HOME,
	Painting: CATEGORIES.HOME,
	"Appliance Repair": CATEGORIES.HOME,
	"Driver Service": CATEGORIES.HOME,

	// --- Personal Care ---
	Haircut: CATEGORIES.PERSONAL,
	Shaving: CATEGORIES.PERSONAL,
	"Bridal Makeup": CATEGORIES.PERSONAL,
	"Eyebrow Threading": CATEGORIES.PERSONAL,
	Facial: CATEGORIES.PERSONAL,
	"Hair Spa": CATEGORIES.PERSONAL,
	Makeup: CATEGORIES.PERSONAL,
	"Hand Spa": CATEGORIES.PERSONAL,
	"Nail Art": CATEGORIES.PERSONAL,
	"Foot Spa": CATEGORIES.PERSONAL,
	"Full Body Glow": CATEGORIES.PERSONAL,
	"Arm Smoothening": CATEGORIES.PERSONAL,
	"Leg Smoothening": CATEGORIES.PERSONAL,
	Mehndi: CATEGORIES.PERSONAL,

	// --- Child Services ---
	Babysitting: CATEGORIES.CHILD,
	"Child Tutoring": CATEGORIES.CHILD,

	// --- Fitness / Health ---
	Nutritionist: CATEGORIES.FITNESS,
	"Yoga Instructor": CATEGORIES.FITNESS,
};

export const slugify = (text) =>
	text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^\w\-]+/g, "")
		.replace(/\-\-+/g, "-")
		.replace(/^-+/, "")
		.replace(/-+$/, "");

// 5. Helper: Get Description
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

		// Beauty & Personal Care
		Haircut: "Clean and stylish haircut by a trained professional.",
		Shaving: "Smooth and comfortable shaving at home.",
		"Bridal Makeup": "Elegant and long-lasting bridal makeup service.",
		"Eyebrow Threading": "Perfectly shaped brows with minimal discomfort.",
		Facial: "Glowing skin with deep-cleansing and nourishing facials.",
		"Hair Spa": "Deep conditioning hair spa to nourish and restore.",
		Makeup: "Flawless makeup for daily wear or special events.",
		"Hand Spa": "Relaxing hand spa with exfoliation and moisturization.",
		"Nail Art": "Stylish and creative nail designs at home.",
		"Foot Spa": "Soothing foot spa for relaxation and soft skin.",
		"Full Body Glow": "Skin-brightening and exfoliating full-body treatment.",
		"Arm Smoothening": "Gentle exfoliation and smoothening treatment for arms.",
		"Leg Smoothening": "Smoothening and exfoliation treatment for legs.",
		Mehndi: "Beautiful mehndi designs for weddings and occasions.",

		// Child Services
		Babysitting: "Trusted babysitters to care for your little ones.",
		"Child Tutoring": "Personalized tutoring in core school subjects.",

		// Fitness / Health
		Nutritionist: "Personal diet plans for better health and lifestyle.",
		"Yoga Instructor": "Guided personal yoga sessions for mind and body.",
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

		// Beauty
		Haircut: "/images/haircut-all.jpg",
		Shaving: "/images/shave.jpg",
		Makeup: "/images/makeup2.jpg",
		"Bridal Makeup": "/images/makeup1.jpg",
		"Eyebrow Threading": "/images/threading.jpg",
		Facial: "/images/faciall.jpg",
		"Hand Spa": "/images/manicureee.jpg",
		"Foot Spa": "/images/pedicuree.jpg",
		"Full Body Glow": "/images/wax.jpg",
		"Arm Smoothening": "/images/wax.jpg",
		"Leg Smoothening": "/images/wax.jpg",
		"Hair Spa": "/images/hair.jpg",
		"Nail Art": "/images/nail-art.jpg",
		Mehndi: "/images/mehendii.jpg",

		// Child
		Babysitting: "/images/baby-sit.jpg",
		"Child Tutoring": "/images/child-tutor.jpg",

		// Fitness
		"Yoga Instructor": "/images/yogaaa.jpg",
		Nutritionist: "/images/nutrition.jpg",
	};

	const img = images[serviceName];
	// if (!img) console.warn(`No image found for service: "${serviceName}"`);
	return img || "/images/default-service.jpg";
}

export const SERVICES = SERVICE_NAMES.map((name) => ({
	name,
	slug: slugify(name),
	description: getDescriptionForService(name),
	image: getImageForService(name),
	category: SERVICE_CATEGORIES[name] || "General",
}));
