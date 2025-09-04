require("dotenv").config({ path: "../.env" }); // if outside 'server'
const { Client } = require("pg");
const { faker } = require("@faker-js/faker");
const { customAlphabet } = require("nanoid");
const { hashIfPresent } = require("../utils/hash");
const { getPriceForService } = require("../utils/getPriceForService");
const { generateAvailability } = require("../utils/generateAvailability");

const db = require("../config/db");
const {
	SERVICES,
	slugify,
	getDescriptionForService,
} = require("../utils/services");

// const db = new Client({
// 	host: process.env.DB_HOST,
// 	user: process.env.DB_USER,
// 	port: process.env.DB_PORT,
// 	password: process.env.DB_PASSWORD,
// 	database: process.env.DB_NAME,
// });

// CONFIG
const PROVIDER_COUNT = 5;
const RESET_TABLES = false;

// Indian cities
const indianCities = [
	{ city: "Mumbai", lat: 19.076, lng: 72.8777 },
	{ city: "Delhi", lat: 28.7041, lng: 77.1025 },
	{ city: "Bangalore", lat: 12.9716, lng: 77.5946 },
	{ city: "Hyderabad", lat: 17.385, lng: 78.4867 },
	{ city: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
	{ city: "Gurugram", lat: 28.4595, lng: 77.0266 },
	{ city: "Noida", lat: 28.5355, lng: 77.391 },
	{ city: "Ghaziabad", lat: 28.6692, lng: 77.4538 },
	{ city: "Prayagraj", lat: 25.4683, lng: 81.8546 },
	{ city: "Agra", lat: 27.1767, lng: 78.0081 },
	{ city: "Chennai", lat: 13.0827, lng: 80.2707 },
	{ city: "Kolkata", lat: 22.5726, lng: 88.3639 },
	{ city: "Pune", lat: 18.5204, lng: 73.8567 },
	{ city: "Jaipur", lat: 26.9124, lng: 75.7873 },
	{ city: "Lucknow", lat: 26.8467, lng: 80.9462 },
	{ city: "Kanpur", lat: 26.4499, lng: 80.3319 },
	{ city: "Bhopal", lat: 23.2599, lng: 77.4126 },
	{ city: "Indore", lat: 22.7196, lng: 75.8577 },
	{ city: "Nagpur", lat: 21.1458, lng: 79.0882 },
	{ city: "Patna", lat: 25.5941, lng: 85.1376 },
	{ city: "Surat", lat: 21.1702, lng: 72.8311 },
	{ city: "Ranchi", lat: 23.3441, lng: 85.3096 },
	{ city: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
	{ city: "Vadodara", lat: 22.3072, lng: 73.1812 },
	{ city: "Thiruvananthapuram", lat: 8.5241, lng: 76.9366 },
	{ city: "Coimbatore", lat: 11.0168, lng: 76.9558 },
	{ city: "Amritsar", lat: 31.634, lng: 74.8723 },
	{ city: "Jodhpur", lat: 26.2389, lng: 73.0243 },
	{ city: "Raipur", lat: 21.2514, lng: 81.6296 },
	{ city: "Guwahati", lat: 26.1445, lng: 91.7362 },
	{ city: "Mysuru", lat: 12.2958, lng: 76.6394 },
	{ city: "Dehradun", lat: 30.3165, lng: 78.0322 },
	{ city: "Chandigarh", lat: 30.7333, lng: 76.7794 },
	{ city: "Jabalpur", lat: 23.1815, lng: 79.9864 },
	{ city: "Meerut", lat: 28.9845, lng: 77.7064 },
];

function getRandomRating() {
	const raw = Math.random();
	let rating;

	if (raw < 0.1) {
		// 10% chance of a poor rating (1.0 to 2.9)
		rating = (Math.random() * 1.9 + 1).toFixed(1);
	} else if (raw < 0.4) {
		// 30% chance of average (3.0 to 3.9)
		rating = (Math.random() * 0.9 + 3).toFixed(1);
	} else if (raw < 0.85) {
		// 45% chance of good (4.0 to 4.6)
		rating = (Math.random() * 0.6 + 4).toFixed(1);
	} else {
		// 15% chance of excellent (4.7 to 5.0)
		rating = (Math.random() * 0.3 + 4.7).toFixed(1);
	}

	return parseFloat(rating);
}
const seedData = async () => {
	try {
		await db.connect();
		console.log("✅ Connected to the DB for seeding...");

		if (RESET_TABLES) {
			console.log("🔄 Resetting tables...");
			await db.query(
				"TRUNCATE availability_slots, providers, users RESTART IDENTITY CASCADE"
			);
		}

		await db.query("BEGIN");

		for (let i = 0; i < PROVIDER_COUNT; i++) {
			const service = faker.helpers.arrayElement(SERVICES);
			const city = faker.helpers.arrayElement(indianCities);
			const [lat, lng] = faker.location.nearbyGPSCoordinate({
				origin: [city.lat, city.lng],
				radius: 5,
			});
			const slots = generateAvailability();

			const name = faker.person.fullName();
			const email = faker.internet.email({ firstName: name });
			const password = await hashIfPresent(faker.internet.password());
			const photo = faker.image.avatar();
			const bio = faker.person.bio();

			const slug = slugify(service.name);
			const description = getDescriptionForService(service.name);
			const price = getPriceForService(service.name);
			const rating = getRandomRating();
			const availability = JSON.stringify(slots, null, 2);
			const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20);
			const customId = "SRV" + nanoid();
			// Create user
			const userRes = await db.query(
				`INSERT INTO users 
				(name, email, role, custom_id, password, photo, location, lat, lng, bio) 
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) 
				RETURNING id`,
				[
					name,
					email,
					"provider",
					customId,
					password,
					photo,
					city.city,
					lat,
					lng,
					bio,
				]
			);
			const userId = userRes.rows[0].id;

			// Create provider
			const providerResult = await db.query(
				`INSERT INTO providers 
   (user_id, service, slug, description, price, rating, availability) 
   VALUES ($1,$2,$3,$4,$5,$6,$7)`,
				[userId, service.name, slug, description, price, rating, availability]
			);

			// Insert slots
			for (const slot of slots) {
				await db.query(
					`INSERT INTO availability_slots 
					(provider_id, date, start_time, end_time) 
					VALUES ($1, $2, $3, $4)`,
					[userId, slot.date, slot.start_time, slot.end_time]
				);
			}

			console.log(`👤 Provider #${i + 1} inserted`);
		}

		await db.query("COMMIT");
		console.log(`🎉 Seeded ${PROVIDER_COUNT} providers successfully!`);
	} catch (err) {
		console.error("❌ Error during seeding:", err.message);
		await db.query("ROLLBACK");
	} finally {
		await db.end();
		console.log("🔌 DB connection closed.");
	}
};

seedData();
