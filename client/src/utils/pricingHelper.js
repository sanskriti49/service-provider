export const UNIT_LABELS = {
	fixed: "Fixed Rate",
	"per hr": "Per Hour",
	"per meal": "Per Meal",
	"per cloth": "Per Cloth",
	"per session": "Per Session",
	"per hand": "Per Hand",
	"starts at": "Starts At",
	package: "Package Deal",
	visiting: "Visiting Charge",
};

const PRICING_GROUPS = {
	standardHome: ["fixed", "starts at", "visiting"],
	timeBased: ["per hr", "fixed", "package"],
	laundry: ["per cloth", "package", "fixed"],
	kitchen: ["per meal", "per hr", "fixed", "package"],
	grooming: ["per session", "fixed", "starts at"],
	artistry: ["per hand", "per session", "fixed", "starts at"],
	coaching: ["per hr", "per session", "package", "fixed"],
};

const SERVICE_UNIT_WHITELIST = {
	// --- Home Services Category ---
	"house-cleaning": ["fixed", "starts at", "per hr"],
	laundry: PRICING_GROUPS.laundry,
	plumbing: PRICING_GROUPS.standardHome,
	"pest-control": ["fixed", "starts at", "package"],
	"electrical-repair": PRICING_GROUPS.standardHome,
	"computer-tech-repair": PRICING_GROUPS.standardHome,
	"cooking-help": PRICING_GROUPS.kitchen,
	gardening: ["per hr", "fixed", "starts at"],
	"moving-help": ["fixed", "per hr", "package"],
	painting: ["fixed", "starts at", "package"],
	"appliance-repair": PRICING_GROUPS.standardHome,
	"driver-service": ["per hr", "fixed", "package"],

	// --- Personal Care / Grooming ---
	massage: ["per session", "per hr", "fixed"],
	"mens-haircut": PRICING_GROUPS.grooming,
	"mens-hair-spa": PRICING_GROUPS.grooming,
	shaving: PRICING_GROUPS.grooming,
	"womens-haircut": PRICING_GROUPS.grooming,
	"womens-hair-spa": PRICING_GROUPS.grooming,
	"bridal-makeup": ["package", "fixed", "starts at"],
	"eyebrow-threading": ["per session", "fixed"],
	facial: PRICING_GROUPS.grooming,
	makeup: ["per session", "fixed", "starts at"],
	mehndi: PRICING_GROUPS.artistry,
	waxing: ["per session", "fixed", "starts at"],
	"nail-studio": ["per session", "fixed", "starts at"],

	// --- Child & Health Services ---
	babysitting: PRICING_GROUPS.timeBased,
	"child-tutoring": PRICING_GROUPS.coaching,
	nutritionist: ["per session", "package", "fixed"],
	"yoga-instructor": PRICING_GROUPS.coaching,
};

export const getAllowedUnits = (slug, dbDefaultUnit) => {
	const normalizedSlug = slug?.toLowerCase().trim();
	const normalizedDefault = dbDefaultUnit?.toLowerCase().trim();

	const explicitAllowed = SERVICE_UNIT_WHITELIST[normalizedSlug];

	if (explicitAllowed) {
		if (normalizedDefault && !explicitAllowed.includes(normalizedDefault)) {
			return [normalizedDefault, ...explicitAllowed];
		}
		return explicitAllowed;
	}

	return normalizedDefault ? [normalizedDefault] : ["fixed"];
};
