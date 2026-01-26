require("dotenv").config({ path: "../.env" });
const { fakerEN_IN: faker } = require("@faker-js/faker");
const db = require("../config/db");
const { getPriceDetails } = require("../utils/pricing");
const { hashIfPresent } = require("../utils/hash");
const { customAlphabet } = require("nanoid");
const {
	generateMasterSchedule,
	generateRealSlots,
} = require("../utils/timeUtils");

const PROVIDER_COUNT = 50;
const RESET_PROVIDERS_ONLY = true;

const indianCities = [
	{ city: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
	{ city: "Delhi", state: "Delhi", lat: 28.7041, lng: 77.1025 },
	{ city: "Bangalore", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
	{ city: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.4867 },
	{ city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
	{ city: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
	{ city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
	{ city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },

	{ city: "Gurugram", state: "Haryana", lat: 28.4595, lng: 77.0266 },
	{ city: "Noida", state: "Uttar Pradesh", lat: 28.5355, lng: 77.391 },
	{ city: "Ghaziabad", state: "Uttar Pradesh", lat: 28.6692, lng: 77.4538 },
	{ city: "Faridabad", state: "Haryana", lat: 28.4089, lng: 77.3178 },

	{ city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
	{ city: "Kanpur", state: "Uttar Pradesh", lat: 26.4499, lng: 80.3319 },
	{ city: "Varanasi", state: "Uttar Pradesh", lat: 25.3176, lng: 82.9739 },
	{ city: "Prayagraj", state: "Uttar Pradesh", lat: 25.4683, lng: 81.8546 },
	{ city: "Agra", state: "Uttar Pradesh", lat: 27.1767, lng: 78.0081 },
	{ city: "Meerut", state: "Uttar Pradesh", lat: 28.9845, lng: 77.7064 },
	{ city: "Bareilly", state: "Uttar Pradesh", lat: 28.367, lng: 79.4304 },
	{ city: "Aligarh", state: "Uttar Pradesh", lat: 27.8974, lng: 78.088 },
	{ city: "Gorakhpur", state: "Uttar Pradesh", lat: 26.7606, lng: 83.3732 },

	{ city: "Nagpur", state: "Maharashtra", lat: 21.1458, lng: 79.0882 },
	{ city: "Nashik", state: "Maharashtra", lat: 19.9975, lng: 73.7898 },
	{ city: "Aurangabad", state: "Maharashtra", lat: 19.8762, lng: 75.3433 },
	{ city: "Thane", state: "Maharashtra", lat: 19.2183, lng: 72.9781 },
	{ city: "Navi Mumbai", state: "Maharashtra", lat: 19.033, lng: 73.0297 },
	{ city: "Solapur", state: "Maharashtra", lat: 17.6599, lng: 75.9064 },

	{ city: "Surat", state: "Gujarat", lat: 21.1702, lng: 72.8311 },
	{ city: "Vadodara", state: "Gujarat", lat: 22.3072, lng: 73.1812 },
	{ city: "Rajkot", state: "Gujarat", lat: 22.3039, lng: 70.8022 },
	{ city: "Bhavnagar", state: "Gujarat", lat: 21.7645, lng: 72.1519 },

	{ city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
	{ city: "Jodhpur", state: "Rajasthan", lat: 26.2389, lng: 73.0243 },
	{ city: "Udaipur", state: "Rajasthan", lat: 24.5854, lng: 73.7125 },
	{ city: "Kota", state: "Rajasthan", lat: 25.2138, lng: 75.8648 },
	{ city: "Ajmer", state: "Rajasthan", lat: 26.4499, lng: 74.6399 },

	{ city: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lng: 77.4126 },
	{ city: "Indore", state: "Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
	{ city: "Jabalpur", state: "Madhya Pradesh", lat: 23.1815, lng: 79.9864 },
	{ city: "Gwalior", state: "Madhya Pradesh", lat: 26.2183, lng: 78.1828 },

	{ city: "Chandigarh", state: "Chandigarh", lat: 30.7333, lng: 76.7794 },
	{ city: "Ludhiana", state: "Punjab", lat: 30.901, lng: 75.8573 },
	{ city: "Amritsar", state: "Punjab", lat: 31.634, lng: 74.8723 },
	{ city: "Jalandhar", state: "Punjab", lat: 31.326, lng: 75.5762 },
	{ city: "Dehradun", state: "Uttarakhand", lat: 30.3165, lng: 78.0322 },
	{ city: "Srinagar", state: "Jammu and Kashmir", lat: 34.0837, lng: 74.7973 },
	{ city: "Jammu", state: "Jammu and Kashmir", lat: 32.7266, lng: 74.857 },

	{ city: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, lng: 76.9558 },
	{ city: "Madurai", state: "Tamil Nadu", lat: 9.9252, lng: 78.1198 },
	{ city: "Tiruchirappalli", state: "Tamil Nadu", lat: 10.7905, lng: 78.7047 },
	{ city: "Salem", state: "Tamil Nadu", lat: 11.6643, lng: 78.146 },
	{ city: "Mysuru", state: "Karnataka", lat: 12.2958, lng: 76.6394 },
	{ city: "Mangalore", state: "Karnataka", lat: 12.9141, lng: 74.856 },
	{ city: "Hubli-Dharwad", state: "Karnataka", lat: 15.3647, lng: 75.124 },
	{ city: "Kochi", state: "Kerala", lat: 9.9312, lng: 76.2673 },
	{ city: "Thiruvananthapuram", state: "Kerala", lat: 8.5241, lng: 76.9366 },
	{ city: "Kozhikode", state: "Kerala", lat: 11.2588, lng: 75.7804 },
	{ city: "Thrissur", state: "Kerala", lat: 10.5276, lng: 76.2144 },
	{
		city: "Visakhapatnam",
		state: "Andhra Pradesh",
		lat: 17.6868,
		lng: 83.2185,
	},
	{ city: "Vijayawada", state: "Andhra Pradesh", lat: 16.5062, lng: 80.648 },
	{ city: "Warangal", state: "Telangana", lat: 17.9689, lng: 79.5941 },

	{ city: "Patna", state: "Bihar", lat: 25.5941, lng: 85.1376 },
	{ city: "Gaya", state: "Bihar", lat: 24.7914, lng: 85.0002 },
	{ city: "Ranchi", state: "Jharkhand", lat: 23.3441, lng: 85.3096 },
	{ city: "Jamshedpur", state: "Jharkhand", lat: 22.8046, lng: 86.2029 },
	{ city: "Dhanbad", state: "Jharkhand", lat: 23.7957, lng: 86.4304 },
	{ city: "Bhubaneswar", state: "Odisha", lat: 20.2961, lng: 85.8245 },
	{ city: "Cuttack", state: "Odisha", lat: 20.4625, lng: 85.8828 },
	{ city: "Rourkela", state: "Odisha", lat: 22.2604, lng: 84.8536 },
	{ city: "Guwahati", state: "Assam", lat: 26.1445, lng: 91.7362 },
	{ city: "Raipur", state: "Chhattisgarh", lat: 21.2514, lng: 81.6296 },
	{ city: "Bhilai", state: "Chhattisgarh", lat: 21.1938, lng: 81.3509 },

	{ city: "Panaji", state: "Goa", lat: 15.4909, lng: 73.8278 },
	{ city: "Shimla", state: "Himachal Pradesh", lat: 31.1048, lng: 77.1734 },
];

function getRandomRating() {
	const raw = Math.random();
	if (raw < 0.1) return (Math.random() * 1.9 + 1).toFixed(1);
	if (raw < 0.4) return (Math.random() * 0.9 + 3).toFixed(1);
	return (Math.random() * 0.6 + 4.3).toFixed(1);
}

const seedData = async () => {
	const client = await db.connect();

	try {
		console.log("✅ Connected to the DB for seeding Providers...");

		if (RESET_PROVIDERS_ONLY) {
			console.log("🔄 Clearing old Providers & Users...");
			await client.query(
				"TRUNCATE availability_slots, provider_master_availability, providers, users RESTART IDENTITY CASCADE",
			);
		}
		await client.query("BEGIN");

		console.log("📥 Fetching live services from DB...");
		const dbServicesResult = await client.query("SELECT * FROM services");
		const dbServices = dbServicesResult.rows;

		if (dbServices.length === 0) {
			throw new Error(
				"❌ No services found! Run 'node seed-cloud-services.js' first.",
			);
		}

		console.log(`👨‍🔧 Creating ${PROVIDER_COUNT} Fake Providers...`);

		for (let i = 0; i < PROVIDER_COUNT; i++) {
			const dbService = faker.helpers.arrayElement(dbServices);

			const firstName = faker.person.firstName();
			const lastName = faker.person.lastName();
			const name = `${firstName} ${lastName}`;
			const phone =
				"+91" +
				faker.helpers.arrayElement(["6", "7", "8", "9"]) +
				faker.string.numeric(9);
			const email = faker.internet
				.email({ firstName, lastName, provider: "gmail.com" })
				.toLowerCase();
			const password = await hashIfPresent("password123");
			const photo = faker.image.avatar();
			const bio = faker.person.bio();

			const cityObj = faker.helpers.arrayElement(indianCities);
			const formattedLocation = `${cityObj.city}, ${cityObj.state}`;
			const [lat, lng] = faker.location.nearbyGPSCoordinate({
				origin: [cityObj.lat, cityObj.lng],
				radius: 5,
			});

			const customId =
				"SRV" + customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 12)();

			const userRes = await client.query(
				`INSERT INTO users (name, email, role, custom_id, password, photo, location, lat, lng, bio, phone) 
                 VALUES ($1, $2, 'provider', $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
				[
					name,
					email,
					customId,
					password,
					photo,
					formattedLocation,
					lat,
					lng,
					bio,
					phone,
				],
			);
			const userId = userRes.rows[0].id;

			const pricingInfo = getPriceDetails(dbService.name);
			const basePrice = Number(pricingInfo.price);
			const variance = Math.floor(basePrice * 0.2);
			const randomVariance =
				Math.floor(Math.random() * (variance * 2 + 1)) - variance;

			let finalPrice = Math.ceil((basePrice + randomVariance) / 10) * 10;
			if (finalPrice < 50) finalPrice = 50;

			const rating = getRandomRating();

			// a realistic Persona
			const masterSchedule = generateMasterSchedule();

			// store the "Master Schedule" intent as JSON for quick reference in frontend cards
			const availabilityJson = JSON.stringify(masterSchedule);

			await client.query(
				`INSERT INTO providers 
                (user_id, service_id, slug, description, price, rating, availability, price_unit) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[
					userId,
					dbService.id,
					dbService.slug,
					dbService.description,
					finalPrice,
					rating,
					availabilityJson,
					pricingInfo.unit,
				],
			);

			// insert Master Availability (The Rules)
			for (const slot of masterSchedule) {
				await client.query(
					`INSERT INTO provider_master_availability (provider_id, day_of_week, start_time, end_time)
                     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
					[userId, slot.day, slot.start, slot.end],
				);
			}

			// generate and insert real slots ( calendar for next 30 days)
			const realSlots = generateRealSlots(masterSchedule);
			for (const s of realSlots) {
				await client.query(
					`INSERT INTO availability_slots (provider_id, date, start_time, end_time)
                     VALUES ($1, $2, $3, $4)`,
					[userId, s.date, s.start_time, s.end_time],
				);
			}

			console.log(
				`👤 Provider created: ${name} -> ${dbService.name} (₹${finalPrice} ${pricingInfo.unit}) - ${realSlots.length} slots generated`,
			);
		}

		await client.query("COMMIT");
		console.log(`🎉 Successfully seeded ${PROVIDER_COUNT} providers!`);
	} catch (err) {
		console.error("❌ Error during provider seeding:", err);
		await client.query("ROLLBACK");
	} finally {
		client.release();
		await db.end();
	}
};

seedData();
