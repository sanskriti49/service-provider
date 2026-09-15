require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Pool } = require("pg");
const { fakerEN_IN: faker } = require("@faker-js/faker");
const { customAlphabet } = require("nanoid");
const { hashIfPresent } = require("../utils/hash");
const { getPriceDetails } = require("../utils/pricing");
const { generateMasterSchedule, generateRealSlots } = require("../utils/timeUtils");
const {
	getGenderMatchedPhoto,
	generateProfessionalBio,
	FEMALE_SERVICES,
	MALE_SERVICES,
} = require("../utils/bioGenerator");

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
	{ city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
	{ city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
	{ city: "Chandigarh", state: "Chandigarh", lat: 30.7333, lng: 76.7794 },
	{ city: "Kochi", state: "Kerala", lat: 9.9312, lng: 76.2673 },
	{ city: "Indore", state: "Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
];

function getRandomRating() {
	const raw = Math.random();
	if (raw < 0.05) return (Math.random() * 0.4 + 4.3).toFixed(1);
	if (raw < 0.4) return (Math.random() * 0.4 + 4.5).toFixed(1);
	return (Math.random() * 0.3 + 4.7).toFixed(1);
}

function localDateStr(dt) {
	if (typeof dt === "string") return dt.slice(0, 10);
	const year = dt.getFullYear();
	const month = String(dt.getMonth() + 1).padStart(2, "0");
	const day = String(dt.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

async function migrateSchema(client) {
	console.log("🛠️  Applying necessary schema migrations to providers table...");
	const statements = [
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'approved' NOT NULL`,
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS rejection_reason text NULL`,
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS approved_at timestamptz DEFAULT now() NULL`,
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS kyc_doc_type text NULL`,
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS kyc_doc_number text NULL`,
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS kyc_doc_front text NULL`,
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS kyc_doc_back text NULL`,
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS kyc_status varchar(20) DEFAULT 'approved' NOT NULL`,
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS is_verified bool DEFAULT true NOT NULL`,
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS verification_badge varchar(20) DEFAULT 'pro' NULL`,
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS verified_at timestamptz DEFAULT now() NULL`,
		`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz DEFAULT now() NULL`,
		`UPDATE public.providers SET status = 'approved' WHERE status IS NULL OR status = 'pending'`,
		`UPDATE public.providers SET is_verified = TRUE, verification_badge = 'pro' WHERE is_verified IS NOT TRUE`,
		`UPDATE public.providers SET kyc_status = 'approved' WHERE kyc_status IS NULL OR kyc_status = 'pending'`,
	];

	for (const sql of statements) {
		try {
			await client.query(sql);
		} catch (err) {
			console.warn(`Migration step warning (${sql.slice(0, 40)}...):`, err.message);
		}
	}
	console.log("✅ Schema migrations applied.");
}

async function ensureProvidersForPool(pool, poolName) {
	console.log(`\n========================================`);
	console.log(`🚀 ENSURING PROVIDERS ON: ${poolName}`);
	console.log(`========================================`);

	const client = await pool.connect();
	try {
		await migrateSchema(client);

		const servicesRes = await client.query("SELECT * FROM services ORDER BY name ASC");
		const services = servicesRes.rows;
		console.log(`Found ${services.length} services.`);

		const MIN_PROVIDERS_PER_SERVICE = 4;

		for (const service of services) {
			// Check current active provider count for this service
			const curCountRes = await client.query(
				`SELECT count(DISTINCT ps.provider_id) as cnt
				 FROM provider_services ps
				 JOIN providers p ON p.user_id = ps.provider_id
				 WHERE ps.service_id = $1 AND ps.is_visible = TRUE AND COALESCE(p.status, 'approved') = 'approved'`,
				[service.id]
			);
			let currentCount = parseInt(curCountRes.rows[0].cnt, 10);
			const needed = Math.max(0, MIN_PROVIDERS_PER_SERVICE - currentCount);

			if (needed === 0) {
				console.log(`✓ Service "${service.name}" (${service.slug}): already has ${currentCount} providers.`);
				continue;
			}

			console.log(`⚡ Service "${service.name}" (${service.slug}): has ${currentCount} providers, adding ${needed} more...`);

			for (let i = 0; i < needed; i++) {
				let sex = faker.helpers.arrayElement(["male", "female"]);
				if (FEMALE_SERVICES.has(service.slug)) {
					sex = "female";
				} else if (MALE_SERVICES.has(service.slug)) {
					sex = "male";
				}

				const firstName = faker.person.firstName(sex);
				const lastName = faker.person.lastName();
				const name = `${firstName} ${lastName}`;
				const phone =
					"+91" +
					faker.helpers.arrayElement(["6", "7", "8", "9"]) +
					faker.string.numeric(9);
				const email = `expert.${service.slug.slice(0, 8)}.${Date.now()}.${i}@taskgenie.in`;
				const password = await hashIfPresent("password123");
				const photo = getGenderMatchedPhoto(sex, currentCount + i + 1);
				const bio = generateProfessionalBio(service.name, service.slug);
				const cityObj = faker.helpers.arrayElement(indianCities);
				const location = `${cityObj.city}, ${cityObj.state}`;
				const [lat, lng] = faker.location.nearbyGPSCoordinate({
					origin: [cityObj.lat, cityObj.lng],
					radius: 10,
				});
				const customId =
					"SRV" + customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 15)();

				const userRes = await client.query(
					`INSERT INTO users (name, email, role, custom_id, password, photo, location, lat, lng, bio, phone)
					 VALUES ($1,$2,'provider',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
					[name, email, customId, password, photo, location, lat, lng, bio, phone]
				);
				const userId = userRes.rows[0].id;

				const pricingInfo = getPriceDetails(service.name);
				const basePrice = Number(pricingInfo.price);
				const variance = Math.floor(basePrice * 0.15);
				let finalPrice =
					Math.ceil(
						(basePrice +
							Math.floor(Math.random() * (variance * 2 + 1)) -
							variance) /
							10,
					) * 10;
				if (finalPrice < 50) finalPrice = 50;

				const rating = getRandomRating();
				const masterSchedule = generateMasterSchedule();

				await client.query(
					`INSERT INTO providers (
						user_id, rating, availability, status, is_verified, verification_badge, kyc_status, verified_at, approved_at
					 )
					 VALUES ($1,$2,$3,'approved',TRUE,'pro','approved',NOW(),NOW())
					 ON CONFLICT (user_id) DO UPDATE SET
						rating = EXCLUDED.rating,
						availability = EXCLUDED.availability,
						status = 'approved',
						is_verified = TRUE`,
					[userId, rating, JSON.stringify(masterSchedule)]
				);

				await client.query(
					`INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible)
					 VALUES ($1,$2,$3,$4,TRUE)
					 ON CONFLICT (provider_id, service_id) DO UPDATE SET is_visible = TRUE, price = EXCLUDED.price`,
					[userId, service.id, finalPrice, pricingInfo.unit]
				);

				for (const slot of masterSchedule) {
					await client.query(
						`INSERT INTO provider_master_availability (provider_id, day_of_week, start_time, end_time)
						 VALUES ($1,$2,$3,$4)
						 ON CONFLICT (provider_id, day_of_week, start_time, end_time) DO NOTHING`,
						[userId, slot.day, slot.start, slot.end]
					);
				}

				const realSlots = generateRealSlots(masterSchedule);
				for (const s of realSlots) {
					const cleanDateStr = localDateStr(s.date);
					await client.query(
						`INSERT INTO availability_slots (provider_id, date, start_time, end_time)
						 VALUES ($1,$2::date,$3,$4)`,
						[userId, cleanDateStr, s.start_time, s.end_time]
					);
				}

				currentCount++;
			}

			console.log(`✅ Service "${service.name}": now has ${currentCount} active providers.`);
		}

		// Also link unmapped existing providers to suitable services
		const unmapped = await client.query(
			`SELECT u.id, u.name, u.bio
			 FROM users u
			 JOIN providers p ON p.user_id = u.id
			 WHERE u.role = 'provider'
			   AND NOT EXISTS (
				   SELECT 1 FROM provider_services ps WHERE ps.provider_id = u.id
			   )`
		);
		console.log(`Unmapped provider users found: ${unmapped.rows.length}`);

		for (let idx = 0; idx < unmapped.rows.length; idx++) {
			const u = unmapped.rows[idx];
			const s = services[idx % services.length];
			const pricingInfo = getPriceDetails(s.name);
			const price = Number(pricingInfo.price) || 299;

			await client.query(
				`INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible)
				 VALUES ($1, $2, $3, $4, TRUE)
				 ON CONFLICT (provider_id, service_id) DO UPDATE SET is_visible = TRUE`,
				[u.id, s.id, price, pricingInfo.unit || "fixed"]
			);

			const masterSchedule = generateMasterSchedule();
			await client.query(
				`UPDATE providers SET
					status = 'approved',
					is_verified = TRUE,
					verification_badge = 'pro',
					kyc_status = 'approved',
					rating = COALESCE(rating, 4.8),
					availability = $1
				 WHERE user_id = $2`,
				[JSON.stringify(masterSchedule), u.id]
			);

			for (const slot of masterSchedule) {
				await client.query(
					`INSERT INTO provider_master_availability (provider_id, day_of_week, start_time, end_time)
					 VALUES ($1,$2,$3,$4)
					 ON CONFLICT DO NOTHING`,
					[u.id, slot.day, slot.start, slot.end]
				);
			}

			const realSlots = generateRealSlots(masterSchedule);
			for (const sl of realSlots) {
				await client.query(
					`INSERT INTO availability_slots (provider_id, date, start_time, end_time)
					 VALUES ($1, $2::date, $3, $4)`,
					[u.id, localDateStr(sl.date), sl.start_time, sl.end_time]
				);
			}
		}

		console.log(`🎉 Success! All services now have active, verified providers.`);
	} finally {
		client.release();
	}
}

async function run() {
	// 1. Run on Local DB
	const localDb = require("../config/db");
	try {
		await ensureProvidersForPool(localDb, "LOCAL POSTGRESQL");
	} catch (err) {
		console.error("Local DB seeding error:", err);
	}

	// 2. Run on Neon Cloud DB
	if (process.env.DATABASE_URL) {
		const neonPool = new Pool({
			connectionString: process.env.DATABASE_URL,
			ssl: { rejectUnauthorized: false },
		});
		try {
			await ensureProvidersForPool(neonPool, "NEON CLOUD DATABASE");
		} catch (err) {
			console.error("Neon DB seeding error:", err);
		} finally {
			await neonPool.end();
		}
	}

	await localDb.end();
	console.log("\n🚀 Seeding and verification completed!");
	process.exit(0);
}

if (require.main === module) {
	run();
}

module.exports = { ensureProvidersForPool };
