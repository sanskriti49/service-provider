const db = require("../config/db");

const REVIEW_TEMPLATES = [
	{
		customer_name: "Pooja Sharma",
		customer_email: "pooja.sharma.test@gmail.com",
		rating: 5,
		comment: "Prompt, extremely polite, and left our 3BHK sparkling clean! Brought professional supplies and cleaned tough grease off the kitchen chimney that other services couldn't remove. Absolutely worth every rupee.",
		tags: ["⚡ Punctual & On-Time", "🧹 Clean & Tidy Work", "🌟 Highly Skilled", "🛡️ Safe & Verified"],
		service_slug: "house-cleaning",
	},
	{
		customer_name: "Aarav Mehta",
		customer_email: "aarav.mehta.test@gmail.com",
		rating: 5,
		comment: "Fixed a persistent kitchen pipe leak in under 40 minutes. Explained the root cause clearly and replaced the washer with zero mess. Very honest and fair billing without surprise charges.",
		tags: ["💰 Fair & Transparent", "⚡ Punctual & On-Time", "🌟 Highly Skilled"],
		service_slug: "plumbing",
	},
	{
		customer_name: "Neha Kapoor",
		customer_email: "neha.kapoor.test@gmail.com",
		rating: 5,
		comment: "Booking was seamless with the completion OTP. Arrived right on schedule, sorted our circuit breaker tripping issue, and even insulated exposed wires behind the entertainment unit. Super impressed!",
		tags: ["⚡ Punctual & On-Time", "🛡️ Safe & Verified", "💬 Great Communication"],
		service_slug: "electrical-repair",
	},
	{
		customer_name: "Rahul Iyer",
		customer_email: "rahul.iyer.test@gmail.com",
		rating: 4,
		comment: "Very neat clothes laundry and steam ironing service. Handled delicate silk kurtas with utmost care. Clothes were neatly folded and delivered right on time.",
		tags: ["🧹 Clean & Tidy Work", "💰 Fair & Transparent"],
		service_slug: "laundry",
	},
	{
		customer_name: "Ananya Deshmukh",
		customer_email: "ananya.d.test@gmail.com",
		rating: 5,
		comment: "Prepared a wholesome North & South Indian meal for our family dinner. The food was hygienic, delicious, and healthy. Cleaned up the kitchen countertop before leaving too!",
		tags: ["🌟 Highly Skilled", "🧹 Clean & Tidy Work", "💬 Great Communication"],
		service_slug: "cooking-help",
	},
	{
		customer_name: "Vikram Malhotra",
		customer_email: "vikram.m.test@gmail.com",
		rating: 5,
		comment: "Complete pest treatment done thoroughly across all corners, balcony drains, and bathroom ducts. Completely odorless chemical used as promised. Very professional specialist.",
		tags: ["🛡️ Safe & Verified", "🌟 Highly Skilled"],
		service_slug: "pest-control",
	},
	{
		customer_name: "Meera Nair",
		customer_email: "meera.nair.test@gmail.com",
		rating: 5,
		comment: "Transformed our unruly balcony garden into a lush green haven. Pruned overgrown bougainvillea, re-potted monstera plants, and added organic fertilizer. True craftsman!",
		tags: ["🌟 Highly Skilled", "🧹 Clean & Tidy Work"],
		service_slug: "gardening",
	},
	{
		customer_name: "Siddharth Rao",
		customer_email: "siddharth.rao.test@gmail.com",
		rating: 4,
		comment: "Upgraded our home PC RAM and cloned SSD within an hour. Tested all performance benchmarks before closing the booking. Very knowledgeable specialist.",
		tags: ["⚡ Punctual & On-Time", "🌟 Highly Skilled"],
		service_slug: "computer-tech-repair",
	},
	{
		customer_name: "Kavita Reddy",
		customer_email: "kavita.reddy.test@gmail.com",
		rating: 5,
		comment: "The Gold Verified badge gave us confidence to book. Arrived in full company uniform, respectful of family elders, and did an outstanding deep cleaning job.",
		tags: ["🛡️ Safe & Verified", "🧹 Clean & Tidy Work", "⚡ Punctual & On-Time"],
		service_slug: "house-cleaning",
	},
	{
		customer_name: "Rohan Mukherjee",
		customer_email: "rohan.m.test@gmail.com",
		rating: 5,
		comment: "Moving help arrived with heavy-duty dollies and straps. Loaded our double-door refrigerator and solid wood dining table without a single scratch on the walls or staircase.",
		tags: ["⚡ Punctual & On-Time", "💰 Fair & Transparent", "🌟 Highly Skilled"],
		service_slug: "moving-help",
	},
];

const { customAlphabet } = require("nanoid");
const makeId = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 15);

async function seedReviews() {
	console.log("🌱 Starting Review Seed Process with Real Active Providers...");

	// 1. Clean up old test reviews and mock bookings
	await db.query(`
		DELETE FROM reviews WHERE booking_id IN (
			SELECT booking_id FROM bookings WHERE cancellation_reason = 'SEED_REVIEW_BOOKING'
		)
	`);
	await db.query(`DELETE FROM bookings WHERE cancellation_reason = 'SEED_REVIEW_BOOKING'`);

	// 2. Fetch all active services with their real providers in provider_services
	const psRes = await db.query(`
		SELECT ps.provider_id, u.name AS provider_name, s.id AS service_id, s.name AS service_name, s.slug AS service_slug
		FROM provider_services ps
		JOIN users u ON ps.provider_id = u.id
		JOIN services s ON ps.service_id = s.id
		WHERE ps.is_visible = TRUE
	`);

	const activeBySlug = {};
	for (const row of psRes.rows) {
		if (!activeBySlug[row.service_slug]) activeBySlug[row.service_slug] = [];
		activeBySlug[row.service_slug].push(row);
	}

	let seededCount = 0;

	for (let i = 0; i < REVIEW_TEMPLATES.length; i++) {
		const item = REVIEW_TEMPLATES[i];
		const matchedProviders = activeBySlug[item.service_slug] || [];

		if (matchedProviders.length === 0) {
			console.warn(`No active providers for ${item.service_slug}, skipping`);
			continue;
		}

		// Pick provider deterministically
		const provider = matchedProviders[i % matchedProviders.length];

		// Ensure customer user exists
		const custRes = await db.query(
			`INSERT INTO users (name, email, role, custom_id, password)
			 VALUES ($1, $2, 'customer', $3, 'password123')
			 ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
			 RETURNING id`,
			[
				item.customer_name,
				item.customer_email,
				"CUS" + makeId(),
			],
		);
		const customerId = custRes.rows[0].id;

		// Create completed booking
		const daysAgo = (i + 1) * 2;
		const bookingRes = await db.query(
			`INSERT INTO bookings (
				user_id, provider_id, service_id, date, start_time, end_time, price, 
				status, payment_method, payment_status, address, cancellation_reason, created_at
			)
			VALUES (
				$1, $2, $3, 
				CURRENT_DATE - INTERVAL '${daysAgo} days', 
				'10:00:00', '12:00:00', 499.00,
				'completed', 'online', 'paid', 'Verified Address, India', 'SEED_REVIEW_BOOKING',
				NOW() - INTERVAL '${daysAgo} days'
			)
			RETURNING booking_id`,
			[customerId, provider.provider_id, provider.service_id],
		);
		const bookingId = bookingRes.rows[0].booking_id;

		// Personalized review with provider name
		const reviewText = `${provider.provider_name} was exceptional! ${item.comment}`;

		await db.query(
			`INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment, tags, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '${daysAgo} days')`,
			[
				bookingId,
				customerId,
				provider.provider_id,
				item.rating,
				reviewText,
				JSON.stringify(item.tags),
			],
		);

		seededCount++;
	}

	// 3. Ensure test providers (e.g. Ronak Dutta, Rakesh Verma, Kartik Johar) have reviews for their services
	const demoProvidersRes = await db.query(`
		SELECT u.id, u.name, ps.service_id, s.name as service_name
		FROM users u
		JOIN provider_services ps ON ps.provider_id = u.id
		JOIN services s ON s.id = ps.service_id
		WHERE u.email IN ('ronakdutta100@gmail.com', 'tsswizzle1389@gmail.com', 'kartik.johar@gmail.com', 'gobinda_khan@gmail.com')
		LIMIT 4
	`);

	for (const demoProv of demoProvidersRes.rows) {
		const custRes = await db.query(
			`INSERT INTO users (name, email, role, custom_id, password)
			 VALUES ($1, $2, 'customer', $3, 'password123')
			 ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
			 RETURNING id`,
			[
				"Swati Sen",
				`swati.sen.${demoProv.name.toLowerCase().replace(/\s+/g, "")}@gmail.com`,
				"CUS" + makeId(),
			],
		);
		const custId = custRes.rows[0].id;

		const bRes = await db.query(
			`INSERT INTO bookings (
				user_id, provider_id, service_id, date, start_time, end_time, price, 
				status, payment_method, payment_status, address, cancellation_reason, created_at
			)
			VALUES (
				$1, $2, $3, 
				CURRENT_DATE - INTERVAL '1 days', 
				'11:00:00', '13:00:00', 550.00,
				'completed', 'online', 'paid', 'Metro Tower 4B, Sector 62', 'SEED_REVIEW_BOOKING',
				NOW() - INTERVAL '1 days'
			)
			RETURNING booking_id`,
			[custId, demoProv.id, demoProv.service_id],
		);

		await db.query(
			`INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment, tags, created_at)
			 VALUES ($1, $2, $3, 5, $4, $5, NOW() - INTERVAL '1 days')`,
			[
				bRes.rows[0].booking_id,
				custId,
				demoProv.id,
				`${demoProv.name} did an amazing job with ${demoProv.service_name}. Extremely skilled, gentle, and courteous. Will definitely rebook!`,
				JSON.stringify(["🌟 Highly Skilled", "⚡ Punctual & On-Time", "💬 Great Communication"]),
			],
		);
		seededCount++;
	}

	// 4. Update provider ratings in providers table to match their reviews
	await db.query(`
		UPDATE providers p
		SET rating = sub.avg_rating
		FROM (
			SELECT provider_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating
			FROM reviews
			GROUP BY provider_id
		) sub
		WHERE p.user_id = sub.provider_id
	`);

	console.log(`✅ Successfully seeded ${seededCount} authentic reviews mapped to active platform providers.`);
	process.exit(0);
}

seedReviews().catch((err) => {
	console.error("❌ Review seed error:", err);
	process.exit(1);
});
