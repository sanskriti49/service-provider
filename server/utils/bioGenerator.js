// Professional bio and gender-aligned photo generator for service providers

const FEMALE_FIRST_NAMES = new Set([
	"ananya", "pooja", "priya", "sneha", "kavita", "ritu", "sunita", "deepika",
	"shreya", "anita", "meera", "neha", "tanvi", "isha", "pallavi", "divya",
	"swati", "jyoti", "rekha", "radhika", "chandrani", "eshita", "deeksha",
	"vaijayanthi", "aditi", "aarushi", "simran", "komal", "mansi", "bhavna",
	"alka", "sapna", "poonam", "vandana", "geeta", "mamta", "preeti", "monika",
	"archana", "shweta", "nisha", "dimple", "seema", "chhaya", "shilpa", "roshni",
]);

const MALE_FIRST_NAMES = new Set([
	"rahul", "amit", "vikram", "suresh", "rohan", "arjun", "rajesh", "deepak",
	"manoj", "sanjay", "abhishek", "aryan", "girik", "upendra", "chapal",
	"giriraaj", "vinay", "ajay", "vijay", "sunil", "anil", "pankaj", "rakesh",
	"gaurav", "kunal", "nitin", "harsh", "varun", "prateek", "sachin", "karan",
	"alok", "vivek", "ashok", "dinesh", "mahesh", "naresh", "kamal", "lalit",
]);

// Services that are typically provided by female professionals
const FEMALE_SERVICES = new Set([
	"women's-haircut",
	"women's-hair-spa",
	"bridal-makeup",
	"eyebrow-threading",
	"facial",
	"makeup",
	"mehndi",
	"waxing",
	"nail-studio",
]);

// Services that are typically provided by male professionals
const MALE_SERVICES = new Set([
	"men's-haircut",
	"men's-hair-spa",
	"shaving",
]);

/**
 * Determine gender ('female' | 'male') based on name or service hint.
 */
function inferGender(name, serviceSlug = "") {
	const slug = (serviceSlug || "").toLowerCase();
	if (FEMALE_SERVICES.has(slug)) return "female";
	if (MALE_SERVICES.has(slug)) return "male";

	const firstName = (name || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
	if (FEMALE_FIRST_NAMES.has(firstName)) return "female";
	if (MALE_FIRST_NAMES.has(firstName)) return "male";

	// Heuristics for Indian names: endings like -a, -i, -ee, -ti, -ka often female
	if (firstName.endsWith("a") || firstName.endsWith("i") || firstName.endsWith("ee") || firstName.endsWith("ya")) {
		return "female";
	}
	return "male";
}

// Curated high-resolution professional portrait photos
function getGenderMatchedPhoto(gender, seedNumber = 1) {
	const idx = (Math.abs(seedNumber) % 95) + 1;
	if (gender === "female") {
		return `https://randomuser.me/api/portraits/women/${idx}.jpg`;
	}
	return `https://randomuser.me/api/portraits/men/${idx}.jpg`;
}

// Realistic professional bios keyed by service category/slug
const SERVICE_BIO_TEMPLATES = {
	"house-cleaning": [
		"Certified cleaning specialist with {years}+ years of experience delivering pristine, sanitized spaces. Skilled in deep dusting, floor polishing, and eco-friendly housekeeping.",
		"Professional housekeeper dedicated to meticulous residential and office cleaning. Known for punctual arrival, thorough sanitization, and spotless results.",
		"Experienced home cleaning professional with {years} years of service. Expert in kitchen degreasing, bathroom deep-cleaning, and hygienic stain removal.",
	],
	"laundry": [
		"Fabric care expert with {years}+ years of experience in dry-cleaning, steam-ironing, and specialized stain removal. Treats garments with utmost attention.",
		"Professional laundry and garment specialist focused on fabric longevity, delicate garment handling, and crisp doorstep finishing.",
	],
	"plumbing": [
		"Licensed master plumber with {years}+ years solving residential water leaks, pipe blockages, pressure issues, and modern sanitary installations.",
		"Experienced plumbing technician equipped with advanced diagnostic tools. Specializes in bathroom fittings, drainage repairs, and rapid emergency service.",
		"Certified plumbing professional with {years} years of trade experience. Reliable, transparent pricing, and guaranteed durable fittings.",
	],
	"pest-control": [
		"Government-licensed pest management technician with {years}+ years experience. Uses safe, odorless, and government-approved eco-treatments for lasting protection.",
		"Certified pest control expert specializing in termite, bedbug, and rodent prevention. Focused on family and pet-safe fumigation.",
	],
	"electrical-repair": [
		"Licensed electrician with {years}+ years handling residential wiring, circuit breaker diagnostics, switchboard repairs, and safety load audits.",
		"Certified electrical professional specializing in modern lighting fixtures, inverter setups, and short-circuit troubleshooting with safety guarantees.",
		"Skilled technician with {years} years in domestic and commercial electrical installations. Punctual, meticulous, and strict on safety codes.",
	],
	"computer-tech-repair": [
		"Certified IT hardware and network technician with {years}+ years experience. Expert in laptop chip-level fixes, OS restoration, and malware removal.",
		"Experienced tech specialist specializing in PC assembly, broken screen replacements, thermal servicing, and data recovery with transparent quotes.",
	],
	"cooking-help": [
		"Trained culinary assistant with {years}+ years crafting wholesome, hygienic North and South Indian meals tailored to your dietary preferences.",
		"Experienced home chef focused on nutritious daily meal preparation, kitchen sanitation, and customized regional recipes for families.",
	],
	"gardening": [
		"Skilled horticulturist and gardener with {years}+ years maintaining terrace gardens, indoor plants, soil enrichment, and artistic landscape pruning.",
		"Passionate plant care expert with {years} years in organic pest defense, drip setups, and flourishing ornamental plant maintenance.",
	],
	"massage": [
		"Certified massage therapist with {years}+ years experience in therapeutic de-stress techniques, deep tissue relief, and restorative posture care.",
		"Professional wellness practitioner skilled in acupressure and relaxation therapies, providing a revitalizing spa experience at home.",
	],
	"moving-help": [
		"Reliable relocation and packing specialist with {years}+ years handling fragile goods, furniture disassembling, and damage-free transport loading.",
		"Experienced moving professional known for organized labeling, protective bubble-wrapping, and heavy-furniture logistics.",
	],
	"painting": [
		"Master painter with {years}+ years specializing in interior wall putty finishes, waterproofing primers, and seamless geometric accent walls.",
		"Experienced painting contractor dedicated to zero-mess masking, premium emulsions, and durable weather-resistant exterior coatings.",
	],
	"appliance-repair": [
		"Multi-brand appliance technician with {years}+ years experience servicing split ACs, refrigerators, microwaves, and front-load washing machines.",
		"Certified cooling and appliance specialist focused on genuine OEM spare parts, fast diagnostic turnaround, and transparent warranty.",
	],
	"driver-service": [
		"Professional chauffeur with a spotless 10-year driving record, {years} years navigating city and highway routes, and polite demeanor.",
		"Experienced personal and corporate driver skilled in automatic and manual luxury sedans and SUVs. Always punctual and courteous.",
	],
	"men's-haircut": [
		"Expert men's barber and stylist with {years}+ years crafting classic fades, modern pompadours, and bespoke beard sculpts.",
		"Professional groomer skilled in precision scissor cuts, skin fades, and personalized styling recommendations.",
	],
	"men's-hair-spa": [
		"Certified hair and scalp care specialist providing revitalizing oil treatments, dandruff control rituals, and stress-relieving head massages.",
	],
	"shaving": [
		"Master barber specializing in traditional hot towel straight-razor shaves, skin soothing balms, and clean facial contouring.",
	],
	"women's-haircut": [
		"Senior hair stylist with {years}+ years experience in custom layers, textured bobs, feather cuts, and face-flattering blowouts.",
		"Professional salon artist dedicated to precision styling, split-end treatments, and effortless, voluminous everyday cuts.",
	],
	"women's-hair-spa": [
		"Hair care specialist focused on deep-conditioning keratin rituals, scalp nourishment, and restorative hydration for damaged hair.",
	],
	"bridal-makeup": [
		"Professional bridal artist with {years}+ years creating radiant, HD airbrush looks tailored to wedding couture and lighting.",
		"Celebrated bridal cosmetologist focused on natural glow, water-resistant elegance, and enduring bridal glamour.",
	],
	"eyebrow-threading": [
		"Gentle aesthetician with {years}+ years experience in symmetrical eyebrow shaping, upper lip threading, and precision facial hair removal.",
	],
	"facial": [
		"Certified aesthetician specializing in fruit peels, anti-aging collagen facials, and deep pore extraction for glowing, youthful skin.",
		"Skilled skin therapist providing customized organic facials, relaxing lymphatic massage, and clear-skin rejuvenation.",
	],
	"makeup": [
		"Certified makeup artist with {years}+ years experience in party glam, editorial shoots, and elegant minimalist day looks.",
	],
	"mehndi": [
		"Artistic mehndi designer with {years}+ years crafting intricate Arabic, bridal, and contemporary organic henna patterns with deep color results.",
	],
	"waxing": [
		"Hygienic and gentle waxing specialist using premium Rica and organic waxes for painless, smooth, and long-lasting hair removal.",
	],
	"nail-studio": [
		"Certified nail technician skilled in long-lasting gel extensions, artistic ombre nail art, and cuticle revitalizing manicures.",
	],
	"babysitting": [
		"First-aid certified childcare specialist with {years}+ years experience. Patient, attentive, and engaging with creative developmental play.",
		"Compassionate child caregiver dedicated to child safety, nutritious snacks, bedtime routines, and attentive supervision.",
	],
	"child-tutoring": [
		"Experienced educator with {years}+ years teaching mathematics, science, and English. Emphasizes foundational clarity and exam confidence.",
		"Dedicated private tutor focused on interactive learning, homework guidance, and individualized academic mentoring.",
	],
	"nutritionist": [
		"Certified clinical dietitian with {years}+ years developing sustainable nutrition plans for weight management, diabetes care, and gut health.",
		"Wellness consultant and nutritionist helping clients achieve energy and fitness goals through wholesome, balanced daily eating.",
	],
	"yoga-instructor": [
		"Certified Hatha and Vinyasa yoga instructor with {years}+ years guiding breathwork, flexibility, mindful meditation, and stress release.",
		"Holistic yoga practitioner offering customized 1-on-1 sessions for posture alignment, core stamina, and daily mental clarity.",
	],
};

const DEFAULT_BIO_TEMPLATES = [
	"Dedicated and background-verified {service} professional with {years}+ years of hands-on experience. Known for punctual arrival, meticulous attention to detail, and 100% customer satisfaction.",
	"Experienced {service} specialist focused on reliable quality and customer delight. Equipped with modern tools and committed to honest, upfront service.",
	"Trusted {service} provider with {years} years in the trade. Backed by dozens of 5-star reviews for polite communication and outstanding craftsmanship.",
];

/**
 * Generate a realistic, professional service-specific bio.
 */
function generateProfessionalBio(serviceName = "", serviceSlug = "", yearsOfExperience = null) {
	const slug = (serviceSlug || serviceName.toLowerCase().replace(/\s+/g, "-")).toLowerCase();
	const years = yearsOfExperience || Math.floor(Math.random() * 8) + 4; // 4 - 11 years

	const templates = SERVICE_BIO_TEMPLATES[slug] || DEFAULT_BIO_TEMPLATES;
	const template = templates[Math.floor(Math.random() * templates.length)];

	return template
		.replace(/{years}/g, years)
		.replace(/{service}/g, serviceName || "Home Service");
}

module.exports = {
	inferGender,
	getGenderMatchedPhoto,
	generateProfessionalBio,
	FEMALE_SERVICES,
	MALE_SERVICES,
};
