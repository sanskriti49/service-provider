require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const crypto = require("crypto");
const { activeBookingPredicate } = require("../utils/bookingLifecycle");
const { customAlphabet } = require("nanoid");
const Joi = require("joi");
const db = require("../config/db");
const cache = require("../utils/cache");
const { hashIfPresent } = require("../utils/hash");
const { normalizeEmail } = require("../utils/normalizeEmail");
const { getPriceDetails } = require("../utils/pricing");
const {
	s3Client,
	generatePresignedUploadUrl,
	generatePresignedDownloadUrl,
	uploadBufferToS3,
	isConfigured: isS3Configured,
} = require("../config/s3");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

function extractS3Key(docUrlOrKey) {
	if (!docUrlOrKey || typeof docUrlOrKey !== "string") return null;
	if (docUrlOrKey.startsWith("kyc-documents/")) return docUrlOrKey;
	if (docUrlOrKey.includes(".amazonaws.com/")) {
		return docUrlOrKey.split(".amazonaws.com/")[1];
	}
	return null;
}

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});
const {
	calculateHaversineDistance,
	estimateTravelTimeMinutes,
	calculateMatchScore,
} = require("../utils/geoUtils");

const {
	generateRealSlots,
} = require("../utils/timeUtils");

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveProviderId(clientOrPool, idOrCustomId) {
	if (!idOrCustomId) return null;
	const value = String(idOrCustomId).trim();
	let result;
	if (UUID_REGEX.test(value)) {
		result = await clientOrPool.query(
			`SELECT id FROM users WHERE id = $1::uuid AND role = 'provider'`,
			[value],
		);
	} else {
		result = await clientOrPool.query(
			`SELECT id FROM users WHERE custom_id = $1 AND role = 'provider'`,
			[value],
		);
	}
	return result.rows[0]?.id ?? null;
}

const {
  validCoordinates,
  pairedCoordinates,
  coordinateFields,
  discoverySchema,
  availabilitySchema
} = require("../utils/location");
let spatialCapability = {
  supported: false,
  expires: 0
};
async function checkPostGisSupport(clientOrPool) {
  if (Date.now() < spatialCapability.expires) return spatialCapability.supported;
  try {
    const result = await clientOrPool.query(`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='postgis') AND EXISTS (
   SELECT 1 FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid
   WHERE a.attrelid=to_regclass('users') AND a.attname='geom' AND NOT a.attisdropped AND t.typname='geography'
  ) AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('users') AND tgname='trg_users_geom_sync' AND tgenabled!='D') AS supported`);
    const supported = result.rows[0]?.supported === true;
    spatialCapability = {
      supported,
      expires: Date.now() + (supported ? 60000 : 5000)
    };
    return supported;
  } catch (_) {
    return false;
  }
}

const providerSchema = Joi.object({
	password: Joi.string().min(8).max(72).required(),
	name: Joi.string().min(3).max(100).required(),
	email: Joi.string().email().lowercase().required(),
	phone: Joi.string()
		.pattern(/^\+91 ?[6-9]\d{9}$/)
		.message("Phone must be a valid Indian number (+91 followed by 10 digits)")
		.optional(),
	location: Joi.string().optional(),
	lat: coordinateFields.lat.required(),
	lng: coordinateFields.lng.required(),
	photo: Joi.string().allow("").optional(),
	bio: Joi.string().max(500).allow("").optional(),
	service: Joi.string().required(),
	services: Joi.array()
		.items(
			Joi.object({
				slug: Joi.string().required(),
				price: Joi.number().min(0).required(),
			}),
		)
		.optional(),
	price: Joi.number().min(0).optional(),
	price_unit: Joi.string().optional().default("fixed"),
	rating: Joi.number().min(0).max(5).optional(),
	availability: Joi.array()
		.items(
			Joi.object({
				day: Joi.number().min(0).max(6).required(),
				start: Joi.string().required(),
				end: Joi.string().required(),
			}),
		)
		.optional(),
	kyc_doc_type: Joi.string()
		.valid("aadhaar", "driving_license", "certificate")
		.allow("")
		.optional(),
	kyc_doc_number: Joi.string().max(100).allow("").optional(),
	kyc_doc_front: Joi.string().allow("", null).optional(),
	kyc_doc_back: Joi.string().allow("", null).optional(),
}).custom(pairedCoordinates);

const providerUpdateSchema = Joi.object({
	name: Joi.string().min(3).max(100).optional(),
	email: Joi.string().email().optional(),
	phone: Joi.string()
		.pattern(/^\+91 ?[6-9]\d{9}$/)
		.message(
			"Phone must be a valid Indian number (+91 followed by 10 digits starting with 6-9)",
		)
		.optional(),
	password: Joi.string().min(6).optional(),
	location: Joi.string().optional(),
	lat: coordinateFields.lat.optional(),
	lng: coordinateFields.lng.optional(),
	photo: Joi.string().allow("").optional(),
	bio: Joi.string().max(500).optional(),
	service: Joi.string().optional(),
	service_id: Joi.string().uuid().optional(),
	price: Joi.number().min(0).optional(),
	price_unit: Joi.string().optional(),
	rating: Joi.number().min(0).max(5).optional(),
	availability: Joi.array().optional(),
}).custom(pairedCoordinates);

function localDateStr(dt) {
	const year = dt.getFullYear();
	const month = String(dt.getMonth() + 1).padStart(2, "0");
	const day = String(dt.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

async function insertSlots(client, userId, schedule) {
	await client.query(
		"DELETE FROM provider_master_availability WHERE provider_id = $1",
		[userId],
	);

	const seenRules = new Set();
	const uniqueSchedule = [];
	for (const rule of schedule) {
		const key = `${rule.day}_${rule.start}_${rule.end}`;
		if (!seenRules.has(key)) {
			seenRules.add(key);
			uniqueSchedule.push(rule);
		}
	}

	for (const rule of uniqueSchedule) {
		await client.query(
			`INSERT INTO provider_master_availability (provider_id, day_of_week, start_time, end_time)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (provider_id, day_of_week, start_time, end_time) DO NOTHING`,
			[userId, rule.day, rule.start, rule.end],
		);
	}

	await client.query("DELETE FROM availability_slots WHERE provider_id = $1", [
		userId,
	]);

	for (const s of generateRealSlots(uniqueSchedule)) {
		let cleanDateStr;
		if (s.date instanceof Date) {
			cleanDateStr = localDateStr(s.date);
		} else {
			cleanDateStr = String(s.date).substring(0, 10);
		}

		await client.query(
			`INSERT INTO availability_slots (provider_id, date, start_time, end_time)
             VALUES ($1,$2::date,$3,$4)`,
			[userId, cleanDateStr, s.start_time, s.end_time],
		);
	}
}

async function createProvider(req, res, next) {
	const { error, value } = providerSchema.validate(req.body);
	if (error) return res.status(400).json({ error: error.details[0].message });

	const {
		name,
		email,
		phone,
		password,
		service,
		services: extraServices,
		price,
		price_unit,
		rating,
		availability,
		location,
		lat,
		lng,
		photo,
		bio,
		kyc_doc_type,
		kyc_doc_number,
		kyc_doc_front,
		kyc_doc_back,
	} = value;

	const client = await db.connect();
	try {
		await client.query("BEGIN");

		const sRow = await client.query("SELECT id FROM services WHERE slug=$1", [
			service,
		]);
		if (!sRow.rows.length) {
			await client.query("ROLLBACK");
			return res
				.status(400)
				.json({ error: `Unknown service slug: ${service}` });
		}
		const serviceId = sRow.rows[0].id;

		const hashed = await hashIfPresent(password);
		const nano = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20);
		const customId = "SRV" + nano();

		const userInsert = await client.query(
			`INSERT INTO users (name, email, phone, role, custom_id, password, location, lat, lng, photo, bio)
             VALUES ($1,$2,$3,'provider',$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
			[
				name,
				normalizeEmail(email),
				phone,
				customId,
				hashed,
				location,
				lat ?? null,
				lng ?? null,
				photo,
				bio,
			],
		);
		const userId = userInsert.rows[0].id;

		await client.query(
			`INSERT INTO providers (
                user_id, rating, availability, status,
                kyc_doc_type, kyc_doc_number, kyc_doc_front, kyc_doc_back,
                kyc_status, is_verified, kyc_submitted_at
            )
            VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,'pending',FALSE,NOW())`,
			[
				userId,
				rating ?? null,
				JSON.stringify(availability ?? []),
				kyc_doc_type || null,
				kyc_doc_number || null,
				kyc_doc_front || null,
				kyc_doc_back || null,
			],
		);

		await client.query(
			`INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible)
             VALUES ($1,$2,$3,$4,TRUE)
             ON CONFLICT (provider_id, service_id) 
             DO NOTHING`,
			[userId, serviceId, price ?? 0, price_unit ?? "fixed"],
		);

		for (const svc of extraServices ?? []) {
			const r = await client.query("SELECT id FROM services WHERE slug=$1", [
				svc.slug,
			]);
			if (!r.rows.length) continue;
			await client.query(
				`INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible)
                 VALUES ($1,$2,$3,'fixed',TRUE)
                 ON CONFLICT (provider_id, service_id) 
                 DO UPDATE 
                 SET price=EXCLUDED.price`,
				[userId, r.rows[0].id, svc.price],
			);
		}

		await insertSlots(client, userId, availability ?? []);
		await client.query("COMMIT");
		cache.delPattern("providers_");
		res.status(201).json({
			message: "Provider created successfully",
			user_id: userId,
			custom_id: customId,
		});
	} catch (err) {
		await client.query("ROLLBACK");
		next(err);
	} finally {
		client.release();
	}
}

async function uploadKycDocument(req, res, next) {
	try {
		if (!req.file) {
			return res.status(400).json({ error: "No document file provided" });
		}

		let documentUrl;
		let storageEngine = "fallback";
		const uniqueSuffix = crypto.randomBytes(6).toString("hex");
		const sanitizedFileName = (req.file.originalname || "document").replace(
			/[^a-zA-Z0-9._-]/g,
			"_",
		);
		const userId = req.user?.id || "unassigned";
		const fileKey = `kyc-documents/${userId}/${Date.now()}-${uniqueSuffix}-${sanitizedFileName}`;

		// 1. Primary AWS S3 Encrypted Storage (SSE-S3)
		if (isS3Configured) {
			try {
				const s3Res = await uploadBufferToS3({
					buffer: req.file.buffer,
					key: fileKey,
					contentType: req.file.mimetype,
				});
				documentUrl = s3Res.fileUrl;
				storageEngine = s3Res.isMock ? "s3-mock" : "s3";
			} catch (s3Err) {
				console.warn(
					"AWS S3 upload failed, checking fallbacks:",
					s3Err.message,
				);
			}
		}

		// 2. Secondary Cloudinary Fallback (if S3 is unconfigured or failed)
		if (
			!documentUrl &&
			process.env.CLOUDINARY_CLOUD_NAME &&
			process.env.CLOUDINARY_API_KEY &&
			process.env.CLOUDINARY_API_SECRET
		) {
			try {
				const result = await new Promise((resolve, reject) => {
					const stream = cloudinary.uploader.upload_stream(
						{ folder: "kyc_documents", resource_type: "auto" },
						(err, res) => {
							if (err) reject(err);
							else resolve(res);
						},
					);
					streamifier.createReadStream(req.file.buffer).pipe(stream);
				});
				documentUrl = result.secure_url;
				storageEngine = "cloudinary";
			} catch (uploadErr) {
				console.warn(
					"Cloudinary upload failed, using data URI fallback:",
					uploadErr.message,
				);
			}
		}

		// 3. Final In-Memory Data URI Fallback (Zero Downtime / Local Dev)
		if (!documentUrl) {
			documentUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
			storageEngine = "data-uri";
		}

		res.json({
			success: true,
			url: documentUrl,
			fileKey,
			filename: req.file.originalname,
			mimetype: req.file.mimetype,
			size: req.file.size,
			storage: storageEngine,
		});
	} catch (err) {
		next(err);
	}
}

/**
 * Generate a presigned S3 upload URL for direct browser-to-S3 ingestion (Zero Server Egress)
 */
async function getKycPresignedUrl(req, res, next) {
	try {
		const { fileName, fileType, fileSize } = req.body;
		if (!fileName) {
			return res.status(400).json({ error: "fileName is required" });
		}
		if (fileSize && fileSize > 5 * 1024 * 1024) {
			return res.status(400).json({ error: "Document photo must be under 5MB" });
		}

		const uniqueSuffix = crypto.randomBytes(6).toString("hex");
		const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
		const userId = req.user?.id || "unassigned";
		const fileKey = `kyc-documents/${userId}/${Date.now()}-${uniqueSuffix}-${sanitizedFileName}`;

		const { uploadUrl, fileUrl, isMock } = await generatePresignedUploadUrl({
			key: fileKey,
			contentType: fileType || "application/octet-stream",
			expiresIn: 300,
		});

		res.json({
			success: true,
			uploadUrl,
			fileUrl,
			fileKey,
			fileName: sanitizedFileName,
			isMock,
		});
	} catch (err) {
		next(err);
	}
}

async function getProviders(req, res, next) {
  try {
    const {
      error,
      value
    } = discoverySchema.validate(req.query);
    if (error) return res.status(400).json({
      error: error.details[0].message
    });
    const {
      service,
      lat,
      lng,
      radius,
      sort_by,
      min_rating,
      max_price,
      date,
      start_time
    } = value;
    const hasUserCoords = validCoordinates(lat, lng);
    const cacheKey = "providers_" + JSON.stringify({
      service,
      lat,
      lng,
      radius,
      sort_by,
      min_rating,
      max_price,
      date,
      start_time
    });
    if (!date) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }
    let spatial = hasUserCoords && (await checkPostGisSupport(db));
    const select = async () => {
      const params = [],
        where = ["p.status = 'approved'"];
      let distanceSelect = "";
      if (spatial) {
        params.push(lng, lat, radius * 1000 + 0.01);
        distanceSelect = ", ST_Distance(u.geom, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, false)/1000 AS postgis_distance_km";
        // A centimetre tolerance only selects candidates; the shared full-precision distance below decides eligibility.
        where.push("(ST_DWithin(u.geom,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$3,false) OR u.geom IS NULL)");
      }
      if (service) {
        params.push(service);
        where.push(`(LOWER(s.slug)=LOWER($${params.length}) OR s.id::text=$${params.length})`);
      }
      if (min_rating != null) {
        params.push(min_rating);
        where.push(`COALESCE(p.rating,0)>=$${params.length}`);
      }
      if (max_price != null) {
        params.push(max_price);
        where.push(`ps.price<=$${params.length}`);
      }
      return db.query(`SELECT DISTINCT ON (u.id) u.name,u.photo,u.phone,u.bio,u.location,u.custom_id,u.lat,u.lng,
    s.name AS service,s.slug AS service_slug,s.id AS service_id,ps.price,ps.price_unit,
    p.rating,p.user_id,p.availability,COALESCE(p.is_verified,FALSE) AS is_verified,p.verification_badge,
    COALESCE(p.kyc_status,'pending') AS kyc_status ${distanceSelect}
    FROM providers p JOIN users u ON p.user_id=u.id
    JOIN provider_services ps ON ps.provider_id=p.user_id AND ps.is_visible=TRUE
    JOIN services s ON s.id=ps.service_id WHERE ${where.join(" AND ")}
    ORDER BY u.id,ps.created_at ASC,ps.id ASC`, params);
    };
    let result;
    try {
      result = await select();
    } catch (err) {
      if (!spatial || !["42703", "42883", "42704"].includes(err.code)) throw err;
      spatial = false;
      spatialCapability = {
        supported: false,
        expires: Date.now() + 5000
      };
      result = await select();
    }
    let providers = result.rows.map(p => {
      const distance = hasUserCoords ? calculateHaversineDistance(lat, lng, p.lat, p.lng) : null;
      return {
        ...p,
        distance_km: distance,
        travel_time_mins: distance == null ? null : estimateTravelTimeMinutes(distance),
        is_nearby: distance == null ? null : distance <= radius,
        availability_status: "unknown"
      };
    });
    if (hasUserCoords) providers = providers.filter(p => p.is_nearby === true);
    if (date) {
      const schedule = require("../services/bookingSchedule");
      const available = [];
      for (let offset = 0; offset < providers.length; offset += 4) {
        const batch = await Promise.all(providers.slice(offset, offset + 4).map(async p => {
          try {
            if (start_time) await schedule.validateSchedule(db, {
              provider_id: p.user_id,
              service_id: p.service_id,
              date,
              start_time,
              latitude: lat,
              longitude: lng,
              radius
            });else {
              const days = await schedule.getAvailability(db, {
                provider_id: p.user_id,
                service_id: p.service_id,
                from: date,
                days: 1,
                latitude: lat,
                longitude: lng,
                radius
              });
              if (!days[0]?.free_slots.length) return null;
            }
            return {
              ...p,
              availability_status: "available"
            };
          } catch (err) {
            if ([400, 409].includes(err.status)) return null;
            throw err;
          }
        }));
        available.push(...batch.filter(Boolean));
      }
      providers = available;
    }
    const avgPrice = providers.length ? providers.reduce((sum, p) => sum + Number(p.price), 0) / providers.length : 500;
    providers = providers.map(p => ({
      ...p,
      match_score: calculateMatchScore({
        distanceKm: p.distance_km,
        maxRadiusKm: radius,
        rating: p.rating,
        price: Number(p.price),
        avgPrice,
        hasAvailableSlots: p.availability_status === "available" ? true : null
      })
    }));
    const mode = sort_by || (hasUserCoords ? "recommended" : "rating");
    providers.sort((a, b) => {
      if (mode === "distance") return (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity) || String(a.user_id).localeCompare(String(b.user_id));
      if (mode === "price_asc") return Number(a.price) - Number(b.price) || String(a.user_id).localeCompare(String(b.user_id));
      if (mode === "price_desc") return Number(b.price) - Number(a.price) || String(a.user_id).localeCompare(String(b.user_id));
      if (mode === "rating") return Number(b.rating ?? 0) - Number(a.rating ?? 0) || String(a.user_id).localeCompare(String(b.user_id));
      return b.match_score - a.match_score || (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity) || Number(b.rating ?? 0) - Number(a.rating ?? 0) || String(a.user_id).localeCompare(String(b.user_id));
    });
    if (!date) cache.set(cacheKey, providers, 45000);
    return res.json(providers);
  } catch (err) {
    next(err);
  }
}

async function matchProviders(req, res, next) {
	return getProviders(req, res, next);
}

async function getProviderById(req, res, next) {
	try {
		const { custom_id } = req.params;
		const providerId = await resolveProviderId(db, custom_id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		const selectedService = req.query.service_id || req.query.service;
		if(selectedService!==undefined && (typeof selectedService!=="string" || selectedService.length>100))return res.status(400).json({error:"Invalid service identifier"});
		const providerRes = await db.query(
			`SELECT u.id, u.name, u.role, u.custom_id,
                    u.location, u.lat, u.lng, u.photo, u.bio,
                    p.rating AS rating, p.availability,
                    ps.price, ps.price_unit, 
                    s.name AS service, s.slug AS service_slug, s.id AS service_id,
                    COALESCE(p.is_verified, FALSE) AS is_verified,
                    p.verification_badge,
                    COALESCE(p.kyc_status, 'pending') AS kyc_status
             FROM providers p
             JOIN users u ON u.id = p.user_id
             LEFT JOIN provider_services ps ON ps.provider_id = u.id AND ps.is_visible = TRUE
             LEFT JOIN services s ON s.id=ps.service_id
             WHERE u.id = $1 ${selectedService ? "AND (s.id::text=$2 OR s.slug=$2)" : ""}
             ORDER BY ps.created_at,ps.id LIMIT 1`,
			selectedService ? [providerId,selectedService] : [providerId],
		);
		if (!providerRes.rows.length)
			return res.status(404).json({ error: "Provider not found" });

		const provider = providerRes.rows[0];

		const masterRes = await db.query(
			`SELECT day_of_week AS day, 
                    TO_CHAR(start_time, 'HH24:MI') AS start, 
                    TO_CHAR(end_time, 'HH24:MI') AS end
             FROM provider_master_availability
             WHERE provider_id = $1
             ORDER BY day_of_week ASC`,
			[provider.id],
		);

		let weeklyAvailability = [];
		if (masterRes.rows.length > 0) {
			weeklyAvailability = masterRes.rows.map((r) => ({
				day: Number(r.day),
				start: r.start,
				end: r.end,
			}));
		} else if (provider.availability) {
			if (typeof provider.availability === "string") {
				try {
					weeklyAvailability = JSON.parse(provider.availability);
				} catch (e) {
					weeklyAvailability = [];
				}
			} else if (Array.isArray(provider.availability)) {
				weeklyAvailability = provider.availability;
			}
		}

		if (weeklyAvailability.length === 0) {
			weeklyAvailability = [
				{ day: 1, start: "09:00", end: "18:00" },
				{ day: 2, start: "09:00", end: "18:00" },
				{ day: 3, start: "09:00", end: "18:00" },
				{ day: 4, start: "09:00", end: "18:00" },
				{ day: 5, start: "09:00", end: "18:00" },
				{ day: 6, start: "10:00", end: "17:00" },
			];
		}

		const servicesRes = await db.query(
			`SELECT s.id, s.name, s.slug, s.description, s.image_url,
                    ps.price, ps.price_unit, ps.is_visible
             FROM provider_services ps
             JOIN services s ON s.id = ps.service_id
             WHERE ps.provider_id = $1`,
			[provider.id],
		);

		let slots = [];
		try {
			const slotsRes = await db.query(
				`SELECT 
					TO_CHAR(s.date,'YYYY-MM-DD') AS date_str,
					TO_CHAR(s.start_time, 'HH24:MI') AS start_time,
					TO_CHAR(s.end_time, 'HH24:MI') AS end_time,
					EXISTS (
						SELECT 1 FROM bookings b
						WHERE b.provider_id = s.provider_id
						  AND b.date = s.date
						  AND b.start_time = s.start_time
						  AND ${activeBookingPredicate}
					) AS is_booked
				 FROM availability_slots s
				 WHERE s.provider_id = $1 
				   AND s.date >= CURRENT_DATE 
				   AND s.date <= CURRENT_DATE + INTERVAL '30 days'
				 ORDER BY s.date, s.start_time`,
				[provider.id],
			);
			slots = slotsRes.rows.map((s) => ({
				date: s.date_str,
				start_time: s.start_time,
				end_time: s.end_time,
				start: s.start_time,
				end: s.end_time,
				isBooked: s.is_booked === true,
			}));

			if (slots.length === 0 && weeklyAvailability.length > 0) {
				const generated = generateRealSlots(weeklyAvailability);
				slots = generated.map((s) => ({
					date: typeof s.date === "string" ? s.date.slice(0, 10) : localDateStr(s.date),
					start_time: s.start_time,
					end_time: s.end_time,
					start: s.start_time,
					end: s.end_time,
					isBooked: false,
				}));
			}
		} catch (slotsErr) {
			console.warn("Slots query fallback in getProviderById:", slotsErr.message);
		}

		res.json({
			message: "Provider fetched",
			provider: {
				...provider,
				availability: weeklyAvailability,
				slots,
				services: servicesRes.rows,
			},
		});
	} catch (err) {
		next(err);
	}
}

async function updateProvider(req, res, next) {
	const { error, value } = providerUpdateSchema.validate(req.body);
	if (error) return res.status(400).json({ error: error.details[0].message });

	const id = req.params.id;
	const {
		name,
		email,
		phone,
		password,
		location,
		lat,
		lng,
		photo,
		bio,
		service,
		service_id: bodyServiceId,
		price,
		price_unit,
		rating,
		availability,
	} = value;

	const providerId = await resolveProviderId(db, id);
	if (!providerId) return res.status(404).json({ error: "Provider not found" });

	if (req.user && req.user.role !== "admin" && req.user.id !== providerId) {
		return res.status(403).json({
			error: "Access denied. Cannot modify another provider's account.",
		});
	}

	const client = await db.connect();
	try {
		await client.query("BEGIN");

		let clearCoordinates=false;
  if(location !== undefined && !validCoordinates(lat,lng)){
   const previous=await client.query("SELECT location FROM users WHERE id=$1",[providerId]);
   clearCoordinates=previous.rows.length>0 && location.trim()!==(previous.rows[0].location||"").trim();
  }
  const hashed = await hashIfPresent(password);
		await client.query(
			`UPDATE users SET
                name=COALESCE($1,name), email=COALESCE($2,email), password=COALESCE($3,password),
                location=COALESCE($4,location), photo=COALESCE($5,photo), bio=COALESCE($6,bio), phone=COALESCE($7,phone),
                lat=CASE WHEN $11 THEN NULL ELSE COALESCE($8,lat) END, lng=CASE WHEN $11 THEN NULL ELSE COALESCE($9,lng) END
             WHERE id=$10`,
			[name, email, hashed, location, photo, bio, phone, lat, lng, providerId, clearCoordinates],
		);

		let serviceId = bodyServiceId ?? null;
		if (!serviceId && service) {
			const s = await client.query("SELECT id FROM services WHERE slug=$1", [
				service,
			]);
			if (!s.rows.length) {
				await client.query("ROLLBACK");
				return res
					.status(400)
					.json({ error: `Unknown service slug: ${service}` });
			}
			serviceId = s.rows[0].id;
		}

		if (serviceId) {
			await client.query(
				`INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible)
                 VALUES ($1, $2, $3, $4, TRUE)
                 ON CONFLICT (provider_id, service_id)
                 DO UPDATE SET 
                    price = COALESCE(EXCLUDED.price, provider_services.price), 
                    price_unit = COALESCE(EXCLUDED.price_unit, provider_services.price_unit)`,
				[providerId, serviceId, price ?? 0, price_unit ?? "fixed"],
			);
		}

		if (availability) {
			const parsedAvailability =
				typeof availability === "string"
					? JSON.parse(availability)
					: availability;

			await insertSlots(client, providerId, parsedAvailability);
			await client.query(
				`UPDATE providers SET availability=$1 WHERE user_id=$2`,
				[JSON.stringify(parsedAvailability), providerId],
			);
		}

		await client.query("COMMIT");
		cache.delPattern("providers_");
		res.json({ message: "Provider updated successfully" });
	} catch (err) {
		await client.query("ROLLBACK");
		next(err);
	} finally {
		client.release();
	}
}

async function getProviderServices(req, res, next) {
	try {
		const providerId = await resolveProviderId(db, req.params.id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		const result = await db.query(
			`SELECT s.id, s.name, s.slug, s.description, s.image_url,
                    ps.price, ps.price_unit, ps.is_visible
             FROM provider_services ps
             JOIN services s ON s.id = ps.service_id
             WHERE ps.provider_id = $1
             ORDER BY ps.created_at ASC`,
			[providerId],
		);
		res.json(result.rows);
	} catch (err) {
		next(err);
	}
}

async function addProviderService(req, res, next) {
	const { slug, price, description, price_unit, availability } = req.body;

	if (!slug || price == null)
		return res.status(400).json({ error: "slug and price are required" });

	const parsedPrice = parseFloat(price);
	if (isNaN(parsedPrice) || parsedPrice < 0)
		return res
			.status(400)
			.json({ error: "price must be a non-negative number" });

	const client = await db.connect();
	try {
		await client.query("BEGIN");

		const providerId = await resolveProviderId(client, req.params.id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		if (req.user && req.user.role !== "admin" && req.user.id !== providerId) {
			await client.query("ROLLBACK");
			return res.status(403).json({
				error: "Access denied. Cannot modify another provider's services.",
			});
		}

		await client.query(
			`INSERT INTO providers (user_id, rating, availability)
             VALUES ($1, NULL, '[]')
             ON CONFLICT (user_id) DO NOTHING`,
			[providerId],
		);

		const sRow = await client.query("SELECT id FROM services WHERE slug=$1", [
			slug,
		]);
		if (!sRow.rows.length)
			return res.status(400).json({ error: `Unknown service slug: ${slug}` });
		const serviceId = sRow.rows[0].id;

		const result = await client.query(
			`INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible, slug, description)
             VALUES ($1, $2, $3, COALESCE($4, 'fixed'), TRUE, $5, $6)
             ON CONFLICT (provider_id, service_id)
             DO UPDATE SET 
                price = EXCLUDED.price, 
                price_unit = COALESCE(EXCLUDED.price_unit, provider_services.price_unit),
                is_visible = TRUE,
                slug = COALESCE(EXCLUDED.slug, provider_services.slug),
                description = COALESCE(EXCLUDED.description, provider_services.description)
             RETURNING *`,
			[
				providerId,
				serviceId,
				parsedPrice,
				price_unit || null,
				slug,
				description ?? null,
			],
		);

		if (availability && Array.isArray(availability.days)) {
			const customSchedule = availability.days.map((day) => ({
				day: Number(day),
				start: availability.startTime || "09:00:00",
				end: availability.endTime || "18:00:00",
			}));

			await insertSlots(client, providerId, customSchedule);
		}

		await client.query("COMMIT");
		cache.delPattern("providers_");
		res
			.status(201)
			.json({ message: "Service added successfully", data: result.rows[0] });
	} catch (err) {
		await client.query("ROLLBACK");
		next(err);
	} finally {
		client.release();
	}
}

async function removeProviderService(req, res, next) {
	try {
		const providerId = await resolveProviderId(db, req.params.id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		if (req.user && req.user.role !== "admin" && req.user.id !== providerId) {
			return res.status(403).json({
				error: "Access denied. Cannot delete another provider's service.",
			});
		}

		const result = await db.query(
			`DELETE FROM provider_services WHERE provider_id=$1 AND service_id=$2::uuid`,
			[providerId, req.params.service_id],
		);
		if (!result.rowCount)
			return res
				.status(404)
				.json({ error: "Service not found on this provider" });
		cache.delPattern("providers_");
		res.json({ message: "Service removed" });
	} catch (err) {
		next(err);
	}
}

async function toggleServiceVisibility(req, res, next) {
	try {
		const { is_visible } = req.body;
		if (typeof is_visible !== "boolean")
			return res.status(400).json({ error: "is_visible must be a boolean" });

		const providerId = await resolveProviderId(db, req.params.id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		if (req.user && req.user.role !== "admin" && req.user.id !== providerId) {
			return res.status(403).json({
				error: "Access denied. Cannot update another provider's service visibility.",
			});
		}

		const result = await db.query(
			`UPDATE provider_services SET is_visible=$1
             WHERE provider_id=$2 AND service_id=$3::uuid RETURNING *`,
			[is_visible, providerId, req.params.service_id],
		);
		cache.delPattern("providers_");
		if (!result.rowCount)
			return res
				.status(404)
				.json({ error: "Service not found on this provider" });

		res.json({
			message: is_visible ? "Service is now live" : "Service paused",
			data: result.rows[0],
		});
	} catch (err) {
		next(err);
	}
}

async function getProviderAvailability(req, res, next) {
  try {
    const {
      error,
      value
    } = availabilitySchema.validate(req.query);
    if (error) return res.status(400).json({
      error: error.details[0].message
    });
    const provider = await resolveProviderId(db, req.params.id);
    if (!provider) return res.status(404).json({
      error: "Provider not found"
    });
    let service = value.service_id || value.service;
    if (!service) {
      const result = await db.query("SELECT service_id FROM provider_services WHERE provider_id=$1 AND is_visible=TRUE ORDER BY created_at,id LIMIT 1", [provider]);
      service = result.rows[0]?.service_id;
    }
    if (!service) return res.status(409).json({
      error: "Provider has no visible services"
    });
    const availability = await require("../services/bookingSchedule").getAvailability(db, {
      provider_id: provider,
      service_id: service,
      from: value.from,
      days: value.days,
      latitude: value.lat,
      longitude: value.lng,
      radius: value.radius
    });
    return res.json({
      provider_id: provider,
      availability
    });
  } catch (err) {
    next(err);
  }
}

async function deleteProvider(req, res, next) {
	try {
		const providerId = await resolveProviderId(db, req.params.id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		if (req.user && req.user.role !== "admin" && req.user.id !== providerId) {
			return res.status(403).json({
				error: "Access denied. Cannot delete another provider's account.",
			});
		}

		const r = await db.query("DELETE FROM providers WHERE user_id=$1", [
			providerId,
		]);
		if (!r.rowCount)
			return res.status(404).json({ error: "No provider found" });
		cache.delPattern("providers_");
		res.json({ message: "Provider deleted successfully" });
	} catch (err) {
		next(err);
	}
}

const kycSubmitSchema = Joi.object({
	kyc_doc_type: Joi.string()
		.valid("aadhaar", "driving_license", "certificate", "pan", "voter_id")
		.required()
		.messages({
			"any.only": "Document type must be Aadhaar, Driving License, Trade Certificate, PAN, or Voter ID",
			"any.required": "Document type is required",
		}),
	kyc_doc_number: Joi.string().min(4).max(100).required().messages({
		"string.min": "Document number must have at least 4 characters",
		"any.required": "Document identification number is required",
	}),
	kyc_doc_front: Joi.string().required().messages({
		"any.required": "Front photo of your document is required",
	}),
	kyc_doc_back: Joi.string().allow("", null).optional(),
	kyc_declaration: Joi.boolean().valid(true).required().messages({
		"any.only": "You must accept the truthfulness and verification declaration",
		"any.required": "Verification declaration is required",
	}),
});

async function getKycStatus(req, res, next) {
	try {
		const targetParam = req.params.id;
		const providerId = await resolveProviderId(db, targetParam);
		if (!providerId) {
			return res.status(404).json({ error: "Provider not found" });
		}

		if (req.user && req.user.role !== "admin" && req.user.id !== providerId) {
			return res.status(403).json({ error: "Access denied. Cannot view other provider's KYC documents." });
		}

		const result = await db.query(
			`SELECT u.id, u.name, u.email, u.phone,
			        COALESCE(p.kyc_status, 'pending') AS kyc_status,
			        COALESCE(p.is_verified, FALSE) AS is_verified,
			        p.verification_badge,
			        p.kyc_doc_type,
			        p.kyc_doc_number,
			        p.kyc_doc_front,
			        p.kyc_doc_back,
			        p.rejection_reason,
			        p.verified_at,
			        p.kyc_submitted_at
			 FROM users u
			 LEFT JOIN providers p ON p.user_id = u.id
			 WHERE u.id = $1`,
			[providerId],
		);

		if (!result.rows.length) {
			return res.status(404).json({ error: "Provider not found" });
		}

		const kyc = { ...result.rows[0] };
		if (isS3Configured) {
			const frontKey = extractS3Key(kyc.kyc_doc_front);
			if (frontKey) {
				try {
					const { downloadUrl } = await generatePresignedDownloadUrl({ key: frontKey });
					kyc.kyc_doc_front_view = downloadUrl;
				} catch (_) {}
			}
			const backKey = extractS3Key(kyc.kyc_doc_back);
			if (backKey) {
				try {
					const { downloadUrl } = await generatePresignedDownloadUrl({ key: backKey });
					kyc.kyc_doc_back_view = downloadUrl;
				} catch (_) {}
			}
		}

		res.json({
			success: true,
			kyc,
		});
	} catch (err) {
		next(err);
	}
}

async function submitKyc(req, res, next) {
	try {
		const targetParam = req.params.id;
		const providerId = await resolveProviderId(db, targetParam);
		if (!providerId) {
			return res.status(404).json({ error: "Provider not found" });
		}

		if (req.user && req.user.role !== "admin" && req.user.id !== providerId) {
			return res.status(403).json({ error: "Access denied. Cannot update another provider's KYC documents." });
		}

		const { error, value } = kycSubmitSchema.validate(req.body);
		if (error) {
			return res.status(400).json({ error: error.details[0].message });
		}

		const { kyc_doc_type, kyc_doc_number, kyc_doc_front, kyc_doc_back } = value;
		const sanitizedDocNumber = kyc_doc_number.trim().toUpperCase();

		const updateRes = await db.query(
			`INSERT INTO providers (user_id, kyc_doc_type, kyc_doc_number, kyc_doc_front, kyc_doc_back, kyc_status, kyc_submitted_at, rejection_reason, status)
			 VALUES ($1, $2, $3, $4, $5, 'pending', now(), NULL, 'pending')
			 ON CONFLICT (user_id) DO UPDATE SET
			    kyc_doc_type = EXCLUDED.kyc_doc_type,
			    kyc_doc_number = EXCLUDED.kyc_doc_number,
			    kyc_doc_front = EXCLUDED.kyc_doc_front,
			    kyc_doc_back = EXCLUDED.kyc_doc_back,
			    kyc_status = 'pending',
			    kyc_submitted_at = now(),
			    rejection_reason = NULL
			 RETURNING user_id, kyc_doc_type, kyc_doc_number, kyc_doc_front, kyc_doc_back, kyc_status, kyc_submitted_at, is_verified, verification_badge`,
			[providerId, kyc_doc_type, sanitizedDocNumber, kyc_doc_front, kyc_doc_back || null],
		);

		try {
			await db.query(
				`INSERT INTO notifications (user_id, title, message, type, data)
				 VALUES ($1, $2, $3, 'system', $4)`,
				[
					providerId,
					"📋 KYC Documents Received",
					"Your identity verification documents have been submitted. Our security team verifies submissions within 24–48 hours.",
					JSON.stringify({ kyc_status: "pending", submitted_at: new Date().toISOString() }),
				],
			);
		} catch (notifErr) {
			console.warn("Could not dispatch KYC submission notification:", notifErr.message);
		}

		cache.delPattern("provider");

		res.json({
			success: true,
			message: "KYC documents submitted successfully. Verification takes 24–48 business hours.",
			kyc: updateRes.rows[0],
		});
	} catch (err) {
		console.error("submitKyc error:", err);
		next(err);
	}
}

module.exports = {
	providerSchema,
	createProvider,
	uploadKycDocument,
	getKycPresignedUrl,
	getProviders,
	matchProviders,
	getProviderById,
	updateProvider,
	getProviderServices,
	addProviderService,
	removeProviderService,
	toggleServiceVisibility,
	deleteProvider,
	getProviderAvailability,
	getKycStatus,
	submitKyc,
};
