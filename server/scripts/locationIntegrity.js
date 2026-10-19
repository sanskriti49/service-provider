// Audit only by default. Repairs require owner-confirmed coordinates and the
// exact existing address/base label; geocoding never silently picks a result.
const fs = require("node:fs");
const Joi = require("joi");
const {
  validCoordinates
} = require("../utils/location");
const {
  lockBooking,
  lockSchedule,
  activeBookingPredicate,
  BookingError
} = require("../utils/bookingLifecycle");
const manifestSchema = Joi.array().min(1).max(100).items(Joi.object({
  kind: Joi.string().valid("provider", "booking", "address").required(),
  id: Joi.when("kind", {
    is: "address",
    then: Joi.string().pattern(/^\d+$/).required(),
    otherwise: Joi.string().guid().required()
  }),
  expected_address: Joi.string().required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  confirmed: Joi.boolean().valid(true).required()
}));
async function auditLocations(db) {
  const client = await db.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const providers = await client.query("SELECT u.id,u.lat,u.lng FROM users u JOIN providers p ON p.user_id=u.id");
    const bookings = await client.query(`SELECT b.booking_id,b.latitude,b.longitude,u.lat AS provider_lat,u.lng AS provider_lng,
      (${activeBookingPredicate.replaceAll("status", "b.status").replaceAll("payment_method", "b.payment_method").replaceAll("hold_expires_at", "b.hold_expires_at")} AND b.date >= (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date) AS upcoming_active
      FROM bookings b LEFT JOIN users u ON u.id=b.provider_id`);
    const addresses = await client.query("SELECT id,lat,lng FROM user_addresses");
    const issues = [...providers.rows.filter(r => !validCoordinates(r.lat, r.lng)).map(r => ({
      kind: "provider",
      id: r.id,
      issue: "service_base_needs_confirmation"
    })), ...bookings.rows.flatMap(r => !validCoordinates(r.latitude, r.longitude) ? [{
      kind: "booking",
      id: r.booking_id,
      issue: "service_location_needs_confirmation",
      upcoming_active: r.upcoming_active
    }] : Number(r.latitude) === Number(r.provider_lat) && Number(r.longitude) === Number(r.provider_lng) && validCoordinates(r.provider_lat, r.provider_lng) ? [{
      kind: "booking",
      id: r.booking_id,
      issue: "matches_provider_base_check_with_customer",
      upcoming_active: r.upcoming_active
    }] : []), ...addresses.rows.filter(r => !validCoordinates(r.lat, r.lng)).map(r => ({
      kind: "address",
      id: String(r.id),
      issue: "saved_location_needs_confirmation"
    }))];
    await client.query("COMMIT");
    return {
      audited_at: new Date().toISOString(),
      counts: {
        providers: providers.rows.length,
        bookings: bookings.rows.length,
        saved_addresses: addresses.rows.length
      },
      issues,
      notes: ["Coordinate equality with a provider is a review flag, not proof of an error.", "Valid numbers do not prove address accuracy; owners must confirm their map location.", "Historical booking addresses are retained. No private addresses or coordinates are included in this report."]
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
async function repairLocations(db, manifest, schedule = require("../services/bookingSchedule"), cache = require("../utils/cache")) {
  const {
    error,
    value
  } = manifestSchema.validate(manifest, { convert: false });
  if (error) throw new BookingError(400, error.message);
  if (new Set(value.map(r => `${r.kind}:${r.id}`)).size !== value.length) throw new BookingError(400, "Duplicate repair target");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    // Acquire all affected provider/date locks in the same order before changing
    // anything, including batch repairs of multiple unpositioned jobs.
    const providerIds = value.filter(r => r.kind === "provider").map(r => r.id);
    const bookingIds = value.filter(r => r.kind === "booking").map(r => r.id);
    const affected = await client.query(`SELECT booking_id,provider_id,TO_CHAR(date,'YYYY-MM-DD') AS date FROM bookings
      WHERE (booking_id=ANY($1::uuid[]) OR provider_id=ANY($2::uuid[])) AND ${activeBookingPredicate}
      AND date >= (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY provider_id,date,booking_id`, [bookingIds, providerIds]);
    const dates = new Set();
    for (const row of affected.rows) {
      const key = `${row.provider_id}:${row.date}`;
      if (!dates.has(key)) {
        await lockSchedule(client, row.provider_id, row.date);
        dates.add(key);
      }
    }
    for (const repair of value) {
      if (repair.kind === "provider") {
        const old = (await client.query("SELECT location FROM users WHERE id=$1 AND role='provider' FOR UPDATE", [repair.id])).rows[0];
        if (!old || old.location !== repair.expected_address) throw new BookingError(409, "Provider base label changed; confirm the current location again");
        await client.query("UPDATE users SET lat=$1,lng=$2 WHERE id=$3", [repair.latitude, repair.longitude, repair.id]);
      } else if (repair.kind === "address") {
        const old = (await client.query("SELECT full_address FROM user_addresses WHERE id=$1 FOR UPDATE", [repair.id])).rows[0];
        if (!old || old.full_address !== repair.expected_address) throw new BookingError(409, "Saved address changed; confirm it again");
        await client.query("UPDATE user_addresses SET lat=$1,lng=$2,updated_at=NOW() WHERE id=$3", [repair.latitude, repair.longitude, repair.id]);
      } else {
        const old = await lockBooking(client, repair.id);
        if (!affected.rows.some(r => r.booking_id === repair.id) || old.address !== repair.expected_address) throw new BookingError(409, "Only an unchanged upcoming active booking location can be repaired");
        await client.query("UPDATE bookings SET latitude=$1,longitude=$2,updated_at=NOW() WHERE booking_id=$3", [repair.latitude, repair.longitude, repair.id]);
      }
    }
    for (const row of affected.rows) {
      const booking = await lockBooking(client, row.booking_id);
      if (["pending", "booked", "confirmed", "in_progress"].includes(booking.status)) await schedule.validateLocationChange(client, {
        ...booking,
        date: booking.date_string
      });
    }
    await client.query("COMMIT");
    try {
      await cache.delPattern("providers_");
    } catch (error) {
      console.warn("Location repair committed; discovery cache expires shortly:", error.message);
    }
    return {
      repaired: value.map(({
        kind,
        id
      }) => ({
        kind,
        id
      }))
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
if (require.main === module) {
  const db = require("../config/db");
  const args = process.argv.slice(2);
  Promise.resolve().then(() => {
    if (args[0] === "--apply" && args.length === 2) return repairLocations(db, JSON.parse(fs.readFileSync(args[1], "utf8")));
    if (args.length) throw new Error("Usage: locationIntegrity.js [--apply owner-confirmed-manifest.json]");
    return auditLocations(db);
  }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error("Location operation failed:", error.message);
    process.exitCode = 1;
  }).finally(() => db.end());
}
module.exports = {
  auditLocations,
  repairLocations
};
