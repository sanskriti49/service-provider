const CATEGORIES = {
	HOME: "Home Services",
	PERSONAL: "Personal Care",
	CHILD: "Child Services",
	FITNESS: "Fitness / Health",
};

const SERVICE_NAMES = [
	// --- Home Services ---
	"House Cleaning",
	"Laundry",
	"Plumbing",
	"Pest Control",
	"Electrical Repair",
	"Computer & Tech Repair",
	"Cooking Help",
	"Gardening",
	"Massage",
	"Moving Help",
	"Painting",
	"Appliance Repair",
	"Driver Service",

	// --- Men's Grooming ---
	"Men's Haircut",
	"Men's Hair Spa",
	"Shaving",

	// --- Women's Beauty ---
	"Women's Haircut",
	"Women's Hair Spa",
	"Bridal Makeup",
	"Eyebrow Threading",
	"Facial",
	"Makeup",
	"Mehndi",
	"Waxing",
	"Nail Studio",

	// --- Child & Health ---
	"Babysitting",
	"Child Tutoring",
	"Nutritionist",
	"Yoga Instructor",
];

const SERVICE_CATEGORIES = {
	"House Cleaning": CATEGORIES.HOME,
	Laundry: CATEGORIES.HOME,
	Plumbing: CATEGORIES.HOME,
	"Pest Control": CATEGORIES.HOME,
	"Electrical Repair": CATEGORIES.HOME,
	"Computer & Tech Repair": CATEGORIES.HOME,
	"Cooking Help": CATEGORIES.HOME,
	Gardening: CATEGORIES.HOME,
	Massage: CATEGORIES.PERSONAL,
	"Moving Help": CATEGORIES.HOME,
	Painting: CATEGORIES.HOME,
	"Appliance Repair": CATEGORIES.HOME,
	"Driver Service": CATEGORIES.HOME,

	"Men's Haircut": CATEGORIES.PERSONAL,
	"Men's Hair Spa": CATEGORIES.PERSONAL,
	Shaving: CATEGORIES.PERSONAL,
	"Women's Haircut": CATEGORIES.PERSONAL,
	"Women's Hair Spa": CATEGORIES.PERSONAL,
	"Bridal Makeup": CATEGORIES.PERSONAL,
	"Eyebrow Threading": CATEGORIES.PERSONAL,
	Facial: CATEGORIES.PERSONAL,
	Makeup: CATEGORIES.PERSONAL,
	Mehndi: CATEGORIES.PERSONAL,
	Waxing: CATEGORIES.PERSONAL,
	"Nail Studio": CATEGORIES.PERSONAL,

	Babysitting: CATEGORIES.CHILD,
	"Child Tutoring": CATEGORIES.CHILD,
	Nutritionist: CATEGORIES.FITNESS,
	"Yoga Instructor": CATEGORIES.FITNESS,
};

const slugify = (text) =>
	text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^\w\-]+/g, "")
		.replace(/\-\-+/g, "-")
		.replace(/&/g, "and")
		.replace(/^-+/, "")
		.replace(/-+$/, "");

function getDescriptionForService(serviceName) {
	const descriptions = {
		"House Cleaning":
			"Come home to a sparkling clean space. We handle deep cleaning so you can relax.",
		Laundry:
			"Fresh, crisp clothes without the chore. Wash, dry, and fold service right at your doorstep.",
		Plumbing:
			"Expert fixes for leaks, clogs, and fittings to keep your day flowing smoothly.",
		"Pest Control":
			"Safe and effective treatments to keep your home bug-free and peaceful.",
		"Electrical Repair":
			"Certified electricians to keep your lights on and your home safe.",
		"Computer & Tech Repair":
			"Frustrated with tech? We fix laptops, Wi-Fi, and smart devices right at your desk.",
		"Cooking Help":
			"Delicious, home-cooked meals prepared in your own kitchen, just the way you like.",
		Gardening:
			"Keep your green space blooming with expert care for your lawn and plants.",
		Massage:
			"Unwind and de-stress with a therapeutic massage in the comfort of your home.",
		"Moving Help":
			"Heavy lifting handled with care. We make your move smooth and stress-free.",
		Painting:
			"Refresh your walls with vibrant colors and a flawless, mess-free finish.",
		"Appliance Repair":
			"Quick fixes for your AC, fridge, or washing machine to get life back to normal.",
		"Driver Service":
			"Reliable chauffeurs for your own car, whether for a daily commute or a weekend trip.",
		"Men's Haircut":
			"Sharp cuts, fades, and classic styling delivered by skilled barbers at your convenience.",
		Shaving:
			"Experience a clean, professional shave or beard trim without leaving the house.",
		"Men's Hair Spa":
			"Revitalize your scalp and relax with a deep-conditioning treatment designed for men.",
		"Women's Haircut":
			"Refresh your look with a stylish cut, trim, or complete restyle from top stylists.",
		"Women's Hair Spa":
			"Deep nourishment and steam treatments to bring shine and softness back to your hair.",
		"Bridal Makeup":
			"Radiant, long-lasting makeup to make you look and feel breathtaking on your big day.",
		"Eyebrow Threading":
			"Precise shaping for perfect brows, done gently and hygienically.",
		Facial:
			"Restore your natural glow with refreshing facials tailored to your specific skin type.",
		Makeup:
			"Get party-ready with flawless makeup application for any special occasion or event.",
		Mehndi:
			"Beautiful, intricate henna designs for weddings, festivals, or just because.",
		Waxing:
			"Smooth, silky skin with gentle and hygienic waxing services for arms, legs, and body.",
		"Nail Studio":
			"Pamper your hands and feet with manicures, pedicures, and creative nail art.",
		Babysitting:
			"Reliable, verified babysitters providing safe and attentive childcare at home.",
		"Child Tutoring":
			"Personalized support to help your child grasp concepts and boost their confidence.",
		Nutritionist:
			"Achieve your health goals with personalized diet plans that actually fit your lifestyle.",
		"Yoga Instructor":
			"Find your balance and strength with guided yoga sessions tailored to your fitness level.",
	};
	return (
		descriptions[serviceName] ||
		"High-quality professional service at your doorstep."
	);
}

// NOTE: This function is for FALLBACK only.
function getImageForService(serviceName) {
	const slug = slugify(serviceName);
	return `/images/${slug}.jpg`;
}

const SERVICES = SERVICE_NAMES.map((name) => ({
	name,
	slug: slugify(name),
	description: getDescriptionForService(name),
	image: getImageForService(name),
	category: SERVICE_CATEGORIES[name] || "General",
}));

module.exports = {
	CATEGORIES,
	SERVICE_NAMES,
	SERVICE_CATEGORIES,
	SERVICES,
	slugify,
	getDescriptionForService,
	getImageForService,
};
