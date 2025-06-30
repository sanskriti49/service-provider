require("dotenv").config({ path: "../.env" }); // if outside 'server'
const { Client } = require("pg");
const { faker } = require("@faker-js/faker");
const { customAlphabet } = require("nanoid");
const { hashIfPresent } = require("../utils/hash");
const { getPriceForService } = require("../utils/getPriceForService");
const { generateAvailability } = require("../utils/generateAvailability");

const db = require("../config/db");

// const db = new Client({
// 	host: process.env.DB_HOST,
// 	user: process.env.DB_USER,
// 	port: process.env.DB_PORT,
// 	password: process.env.DB_PASSWORD,
// 	database: process.env.DB_NAME,
// });

const SERVICES = [
	"House Cleaning",
	"Plumbing",
	"Electrical Repair",
	"Gardening",
	"Babysitting",
	"Pet Sitting",
	"Pest Control",
	"Appliance Repair",
	"Window Cleaning",
	"Carpet Cleaning",
	"Haircut",
	"Makeup",
	"Eyebrow Threading",
	"Facial",
	"Manicure",
	"Pedicure",
	"Waxing - Full Body",
	"Waxing - Arms",
	"Waxing - Legs",
	"Massage Therapy",
	"Bridal Makeup",
	"Hair Coloring",
	"Nail Art",
	"Eyelash Extensions",
	"Skin Treatment",
	"Beard Styling",
	"Hair Spa",
	"Mehndi (Henna)",
];

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

		console.log("Connected to the database for seeding...");

		const providers = Array.from({ length: 5 }, (_, i) => {
			const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
			const cityData =
				indianCities[Math.floor(Math.random() * indianCities.length)];
			const [lat, lng] = faker.location.nearbyGPSCoordinate({
				origin: [cityData.lat, cityData.lng],
				radius: 5,
			});

			return {
				name: faker.person.fullName(),
				email: faker.internet.email(),
				password: faker.internet.password(),
				photo: faker.image.avatar(),
				location: cityData.city,
				lat: lat,
				lng: lng,
				bio: faker.person.bio(),
				service: service,
				price: getPriceForService(service),
				rating: getRandomRating(),
				availability: JSON.stringify(generateAvailability(), null, 2),
			};
		});

		await db.query("BEGIN");
		const role = "provider";

		for (const provider of providers) {
			const slots = generateAvailability();
			console.log(slots);
			provider.availability = JSON.stringify(slots, null, 2);
			const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20);
			const customId = "SRV" + nanoid();

			const userResult = await db.query(
				"INSERT INTO users (name, email,role,custom_id, password, photo, location, lat, lng, bio) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
				[
					provider.name,
					provider.email,
					role,
					customId,
					provider.password,
					provider.photo,
					provider.location,
					provider.lat,
					provider.lng,
					provider.bio,
				]
			);
			const userId = userResult.rows[0].id;

			const providerResult = await db.query(
				"INSERT INTO providers (user_id,service, price, rating, availability) VALUES ($1,$2,$3,$4,$5) RETURNING user_id",
				[
					userId,
					provider.service,
					provider.price,
					provider.rating,
					provider.availability,
				]
			);
			const providerId = providerResult.rows[0].user_id;
			console.log(providerId);

			for (const slot of slots) {
				await db.query(
					"INSERT INTO availability_slots (provider_id, date, start_time, end_time) VALUES ($1, $2, $3, $4)",
					[providerId, slot.date, slot.start_time, slot.end_time]
				);
			}
		}
		await db.query("COMMIT");
		console.log("Seeding completed with faker! 🚀");
	} catch (err) {
		db.query("ROLLBACK");
		console.error("Seeding failed❌:", err);
	} finally {
		await db.end();
		console.log("Connection closed.");
	}
};
seedData();
