const db = require("../config/db");

let tablesEnsured = false;

async function ensureAccountTables() {
	if (tablesEnsured) return;
	try {
		await db.query(`
			CREATE TABLE IF NOT EXISTS public.user_addresses (
				id serial PRIMARY KEY,
				user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
				label varchar(50) NOT NULL DEFAULT 'Home',
				full_address text NOT NULL,
				street varchar(255),
				landmark varchar(255),
				city varchar(100) NOT NULL DEFAULT 'Bengaluru',
				state varchar(100) NOT NULL DEFAULT 'Karnataka',
				postal_code varchar(20),
				lat double precision,
				lng double precision,
				is_default boolean DEFAULT false,
				created_at timestamptz DEFAULT now(),
				updated_at timestamptz DEFAULT now()
			);
			CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON public.user_addresses(user_id);

			CREATE TABLE IF NOT EXISTS public.user_payment_methods (
				id serial PRIMARY KEY,
				user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
				type varchar(30) NOT NULL,
				nickname varchar(100),
				account_number_masked varchar(50),
				bank_or_provider varchar(100),
				card_brand varchar(50),
				card_expiry varchar(10),
				cardholder_name varchar(100),
				upi_id varchar(100),
				is_default boolean DEFAULT false,
				created_at timestamptz DEFAULT now(),
				updated_at timestamptz DEFAULT now()
			);
			CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user_id ON public.user_payment_methods(user_id);

			CREATE TABLE IF NOT EXISTS public.platform_feedback (
				id serial PRIMARY KEY,
				user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
				name varchar(100),
				email varchar(150),
				role varchar(20) DEFAULT 'customer',
				rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
				category varchar(50) NOT NULL DEFAULT 'general',
				feedback text NOT NULL,
				status varchar(20) DEFAULT 'reviewed',
				created_at timestamptz DEFAULT now()
			);
			CREATE INDEX IF NOT EXISTS idx_platform_feedback_user_id ON public.platform_feedback(user_id);
		`);
		tablesEnsured = true;
	} catch (err) {
		console.warn("ensureAccountTables error:", err.message);
	}
}

// -------------------------------------------------------------
// SAVED ADDRESSES
// -------------------------------------------------------------

async function getAddresses(req, res, next) {
	try {
		await ensureAccountTables();
		const userId = req.user.id;
		const result = await db.query(
			`SELECT * FROM user_addresses 
			 WHERE user_id = $1 
			 ORDER BY is_default DESC, created_at DESC`,
			[userId],
		);
		res.json({ success: true, addresses: result.rows });
	} catch (err) {
		next(err);
	}
}

async function createAddress(req, res, next) {
	try {
		await ensureAccountTables();
		const userId = req.user.id;
		const {
			label = "Home",
			full_address,
			street,
			landmark,
			city = "Bengaluru",
			state = "Karnataka",
			postal_code,
			lat,
			lng,
			is_default = false,
		} = req.body;

		if (!full_address || !full_address.trim()) {
			return res.status(400).json({ error: "Address is required." });
		}

		if (is_default) {
			await db.query(
				`UPDATE user_addresses SET is_default = false WHERE user_id = $1`,
				[userId],
			);
		} else {
			// If this is the user's very first address, make it default automatically
			const countRes = await db.query(
				`SELECT COUNT(*) FROM user_addresses WHERE user_id = $1`,
				[userId],
			);
			if (parseInt(countRes.rows[0].count, 10) === 0) {
				req.body.is_default = true;
			}
		}

		const makeDefault = req.body.is_default ?? is_default;

		const insertResult = await db.query(
			`INSERT INTO user_addresses (
				user_id, label, full_address, street, landmark, city, state, postal_code, lat, lng, is_default
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			RETURNING *`,
			[
				userId,
				(label || "Home").trim(),
				full_address.trim(),
				street ? street.trim() : null,
				landmark ? landmark.trim() : null,
				(city || "Bengaluru").trim(),
				(state || "Karnataka").trim(),
				postal_code ? postal_code.trim() : null,
				lat ? parseFloat(lat) : null,
				lng ? parseFloat(lng) : null,
				Boolean(makeDefault),
			],
		);

		res.status(201).json({
			success: true,
			message: "Address saved successfully",
			address: insertResult.rows[0],
		});
	} catch (err) {
		next(err);
	}
}

async function updateAddress(req, res, next) {
	try {
		await ensureAccountTables();
		const userId = req.user.id;
		const { id } = req.params;
		const {
			label,
			full_address,
			street,
			landmark,
			city,
			state,
			postal_code,
			lat,
			lng,
			is_default,
		} = req.body;

		const existing = await db.query(
			`SELECT * FROM user_addresses WHERE id = $1 AND user_id = $2`,
			[id, userId],
		);
		if (existing.rows.length === 0) {
			return res.status(404).json({ error: "Address not found." });
		}

		if (is_default) {
			await db.query(
				`UPDATE user_addresses SET is_default = false WHERE user_id = $1`,
				[userId],
			);
		}

		const updateResult = await db.query(
			`UPDATE user_addresses SET
				label = COALESCE($1, label),
				full_address = COALESCE($2, full_address),
				street = COALESCE($3, street),
				landmark = COALESCE($4, landmark),
				city = COALESCE($5, city),
				state = COALESCE($6, state),
				postal_code = COALESCE($7, postal_code),
				lat = COALESCE($8, lat),
				lng = COALESCE($9, lng),
				is_default = COALESCE($10, is_default),
				updated_at = NOW()
			WHERE id = $11 AND user_id = $12
			RETURNING *`,
			[
				label ? label.trim() : null,
				full_address ? full_address.trim() : null,
				street ? street.trim() : null,
				landmark ? landmark.trim() : null,
				city ? city.trim() : null,
				state ? state.trim() : null,
				postal_code ? postal_code.trim() : null,
				lat != null ? parseFloat(lat) : null,
				lng != null ? parseFloat(lng) : null,
				is_default != null ? Boolean(is_default) : null,
				id,
				userId,
			],
		);

		res.json({
			success: true,
			message: "Address updated successfully",
			address: updateResult.rows[0],
		});
	} catch (err) {
		next(err);
	}
}

async function deleteAddress(req, res, next) {
	try {
		await ensureAccountTables();
		const userId = req.user.id;
		const { id } = req.params;

		const result = await db.query(
			`DELETE FROM user_addresses WHERE id = $1 AND user_id = $2 RETURNING *`,
			[id, userId],
		);

		if (result.rowCount === 0) {
			return res.status(404).json({ error: "Address not found." });
		}

		// If deleted address was default, make the most recent remaining address default
		if (result.rows[0].is_default) {
			await db.query(
				`UPDATE user_addresses 
				 SET is_default = true 
				 WHERE id = (
					 SELECT id FROM user_addresses 
					 WHERE user_id = $1 
					 ORDER BY created_at DESC 
					 LIMIT 1
				 )`,
				[userId],
			);
		}

		res.json({ success: true, message: "Address removed successfully" });
	} catch (err) {
		next(err);
	}
}

async function setDefaultAddress(req, res, next) {
	try {
		await ensureAccountTables();
		const userId = req.user.id;
		const { id } = req.params;

		await db.query(
			`UPDATE user_addresses SET is_default = false WHERE user_id = $1`,
			[userId],
		);
		const result = await db.query(
			`UPDATE user_addresses SET is_default = true, updated_at = NOW() 
			 WHERE id = $1 AND user_id = $2 
			 RETURNING *`,
			[id, userId],
		);

		if (result.rowCount === 0) {
			return res.status(404).json({ error: "Address not found." });
		}

		res.json({
			success: true,
			message: "Default address set successfully",
			address: result.rows[0],
		});
	} catch (err) {
		next(err);
	}
}

// -------------------------------------------------------------
// SAVED PAYMENT ACCOUNTS / METHODS
// -------------------------------------------------------------

async function getPaymentMethods(req, res, next) {
	try {
		await ensureAccountTables();
		const userId = req.user.id;
		const result = await db.query(
			`SELECT id, user_id, type, nickname, account_number_masked, bank_or_provider, 
			        card_brand, card_expiry, cardholder_name, upi_id, is_default, created_at 
			 FROM user_payment_methods 
			 WHERE user_id = $1 
			 ORDER BY is_default DESC, created_at DESC`,
			[userId],
		);
		res.json({ success: true, payment_methods: result.rows });
	} catch (err) {
		next(err);
	}
}

async function createPaymentMethod(req, res, next) {
	try {
		await ensureAccountTables();
		const userId = req.user.id;
		const {
			type, // 'card', 'upi', 'bank_account', 'wallet'
			nickname,
			card_number,
			card_brand,
			card_expiry,
			cardholder_name,
			upi_id,
			bank_name,
			account_number,
			is_default = false,
		} = req.body;

		if (!type || !["card", "upi", "bank_account", "wallet"].includes(type)) {
			return res.status(400).json({ error: "Invalid payment method type. Choose card, upi, bank_account, or wallet." });
		}

		let masked = null;
		let brand = card_brand || null;
		let provider = bank_name || null;
		let cleanUpi = null;
		let cleanExpiry = card_expiry ? card_expiry.trim() : null;
		let cleanHolder = cardholder_name ? cardholder_name.trim() : null;

		if (type === "card") {
			if (!card_number || card_number.replace(/\s+/g, "").length < 12) {
				return res.status(400).json({ error: "Please enter a valid card number." });
			}
			const digitsOnly = card_number.replace(/\D/g, "");
			const last4 = digitsOnly.slice(-4);
			masked = `•••• •••• •••• ${last4}`;

			// Auto detect brand if not provided
			if (!brand) {
				if (/^4/.test(digitsOnly)) brand = "visa";
				else if (/^5[1-5]/.test(digitsOnly)) brand = "mastercard";
				else if (/^(60|65|81|82)/.test(digitsOnly)) brand = "rupay";
				else if (/^3[47]/.test(digitsOnly)) brand = "amex";
				else brand = "card";
			}
			provider = provider || "Bank Card";
		} else if (type === "upi") {
			if (!upi_id || !upi_id.includes("@")) {
				return res.status(400).json({ error: "Please provide a valid UPI ID (e.g. name@okhdfcbank)." });
			}
			cleanUpi = upi_id.trim().toLowerCase();
			masked = cleanUpi;
			const handle = cleanUpi.split("@")[1] || "";
			if (handle.includes("okhdfc") || handle.includes("okaxis") || handle.includes("oksbi") || handle.includes("okicici")) {
				provider = "Google Pay";
			} else if (handle.includes("ybl") || handle.includes("ibl") || handle.includes("axl")) {
				provider = "PhonePe";
			} else if (handle.includes("paytm")) {
				provider = "Paytm UPI";
			} else {
				provider = "UPI";
			}
		} else if (type === "bank_account") {
			if (!account_number || account_number.length < 6) {
				return res.status(400).json({ error: "Please provide a valid bank account number." });
			}
			const last4 = account_number.slice(-4);
			masked = `A/C •••• ${last4}`;
			provider = bank_name || "Net Banking";
		} else if (type === "wallet") {
			provider = provider || "Wallet";
			masked = "Digital Wallet";
		}

		if (is_default) {
			await db.query(
				`UPDATE user_payment_methods SET is_default = false WHERE user_id = $1`,
				[userId],
			);
		} else {
			// First payment method is default
			const countRes = await db.query(
				`SELECT COUNT(*) FROM user_payment_methods WHERE user_id = $1`,
				[userId],
			);
			if (parseInt(countRes.rows[0].count, 10) === 0) {
				req.body.is_default = true;
			}
		}

		const makeDefault = req.body.is_default ?? is_default;

		const insertResult = await db.query(
			`INSERT INTO user_payment_methods (
				user_id, type, nickname, account_number_masked, bank_or_provider, 
				card_brand, card_expiry, cardholder_name, upi_id, is_default
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			RETURNING *`,
			[
				userId,
				type,
				nickname ? nickname.trim() : null,
				masked,
				provider,
				brand,
				cleanExpiry,
				cleanHolder,
				cleanUpi,
				Boolean(makeDefault),
			],
		);

		res.status(201).json({
			success: true,
			message: "Payment account saved securely",
			payment_method: insertResult.rows[0],
		});
	} catch (err) {
		next(err);
	}
}

async function deletePaymentMethod(req, res, next) {
	try {
		await ensureAccountTables();
		const userId = req.user.id;
		const { id } = req.params;

		const result = await db.query(
			`DELETE FROM user_payment_methods WHERE id = $1 AND user_id = $2 RETURNING *`,
			[id, userId],
		);

		if (result.rowCount === 0) {
			return res.status(404).json({ error: "Payment method not found." });
		}

		if (result.rows[0].is_default) {
			await db.query(
				`UPDATE user_payment_methods 
				 SET is_default = true 
				 WHERE id = (
					 SELECT id FROM user_payment_methods 
					 WHERE user_id = $1 
					 ORDER BY created_at DESC 
					 LIMIT 1
				 )`,
				[userId],
			);
		}

		res.json({ success: true, message: "Payment method removed successfully" });
	} catch (err) {
		next(err);
	}
}

async function setDefaultPaymentMethod(req, res, next) {
	try {
		await ensureAccountTables();
		const userId = req.user.id;
		const { id } = req.params;

		await db.query(
			`UPDATE user_payment_methods SET is_default = false WHERE user_id = $1`,
			[userId],
		);
		const result = await db.query(
			`UPDATE user_payment_methods SET is_default = true, updated_at = NOW() 
			 WHERE id = $1 AND user_id = $2 
			 RETURNING *`,
			[id, userId],
		);

		if (result.rowCount === 0) {
			return res.status(404).json({ error: "Payment method not found." });
		}

		res.json({
			success: true,
			message: "Default payment method updated",
			payment_method: result.rows[0],
		});
	} catch (err) {
		next(err);
	}
}

// -------------------------------------------------------------
// USER / PLATFORM FEEDBACK
// -------------------------------------------------------------

async function submitFeedback(req, res, next) {
	try {
		await ensureAccountTables();
		const userId = req.user ? req.user.id : null;
		const userRole = req.user?.role || "customer";
		const {
			rating,
			category = "general",
			feedback,
			name,
			email,
		} = req.body;

		const numRating = parseInt(rating, 10);
		if (isNaN(numRating) || numRating < 1 || numRating > 5) {
			return res.status(400).json({ error: "Rating must be an integer between 1 and 5." });
		}

		if (!feedback || !feedback.trim()) {
			return res.status(400).json({ error: "Feedback comment is required." });
		}

		let userName = name;
		let userEmail = email;

		if (userId && (!userName || !userEmail)) {
			const uRes = await db.query(`SELECT name, email FROM users WHERE id = $1`, [userId]);
			if (uRes.rows.length > 0) {
				userName = userName || uRes.rows[0].name;
				userEmail = userEmail || uRes.rows[0].email;
			}
		}

		const cleanCategory = (category || "general").toLowerCase();

		const insertResult = await db.query(
			`INSERT INTO platform_feedback (user_id, name, email, role, rating, category, feedback, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, 'reviewed')
			 RETURNING *`,
			[
				userId,
				userName || "TaskGenie User",
				userEmail || "user@taskgenie.in",
				userRole,
				numRating,
				cleanCategory,
				feedback.trim(),
			],
		);

		// Dispatch confirmation notification to customer
		if (userId) {
			try {
				await db.query(
					`INSERT INTO notifications (user_id, title, message, type, data)
					 VALUES ($1, $2, $3, 'system', $4)`,
					[
						userId,
						"Thank you for your feedback! 💬",
						`We received your feedback regarding ${cleanCategory.replace(/_/g, " ")}. Your thoughts help us make TaskGenie better for everyone.`,
						JSON.stringify({ feedback_id: insertResult.rows[0].id, rating: numRating, category: cleanCategory }),
					],
				);
			} catch (_) {}
		}

		res.status(201).json({
			success: true,
			message: "Thank you! Your feedback has been submitted successfully.",
			feedback: insertResult.rows[0],
		});
	} catch (err) {
		next(err);
	}
}

async function getMyFeedback(req, res, next) {
	try {
		await ensureAccountTables();
		const userId = req.user.id;
		const result = await db.query(
			`SELECT * FROM platform_feedback 
			 WHERE user_id = $1 
			 ORDER BY created_at DESC 
			 LIMIT 20`,
			[userId],
		);
		res.json({ success: true, feedback: result.rows });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	ensureAccountTables,
	getAddresses,
	createAddress,
	updateAddress,
	deleteAddress,
	setDefaultAddress,
	getPaymentMethods,
	createPaymentMethod,
	deletePaymentMethod,
	setDefaultPaymentMethod,
	submitFeedback,
	getMyFeedback,
};
