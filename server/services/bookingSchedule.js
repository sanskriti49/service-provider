const {
  BookingError,
  activeBookingPredicate
} = require("../utils/bookingLifecycle");
const {
  getPriceDetails
} = require("../utils/pricing");
const {
  getDirectionalTravelDurations,
  calculateHaversineDistance
} = require("../utils/geoUtils");
const {
  validCoordinates,
  DEFAULT_RADIUS_KM
} = require("../utils/location");
const minutes = value => {
  const [h, m] = String(value).split(":").map(Number);
  return h * 60 + m;
};
const time = value => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
function indiaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
async function selectService(client, booking) {
  const result = await client.query(`SELECT ps.price,s.name,s.id AS service_id,u.lat AS provider_lat,u.lng AS provider_lng FROM provider_services ps
 JOIN services s ON s.id=ps.service_id JOIN providers p ON p.user_id=ps.provider_id
 JOIN users u ON u.id=p.user_id
 WHERE ps.provider_id=$1 AND (s.id::text=$2 OR s.slug=$2) AND ps.is_visible=TRUE AND p.status='approved'`, [booking.provider_id, String(booking.service_id)]);
  if (!result.rows.length) throw new BookingError(409, "Provider must be approved and offer the selected visible service");
  return result.rows[0];
}
function assertWithinRadius(selected, booking) {
  const radius = booking.radius ?? booking.search_radius_km ?? DEFAULT_RADIUS_KM;
  if (!Number.isFinite(Number(radius)) || radius < 1 || radius > 500 || !validCoordinates(booking.latitude, booking.longitude)) throw new BookingError(400, "A valid radius and confirmed customer service location are required");
  const distance = calculateHaversineDistance(booking.latitude, booking.longitude, selected.provider_lat, selected.provider_lng);
  if (distance == null) throw new BookingError(409, "The provider's service base needs confirmation before nearby booking");
  if (distance > radius) throw new BookingError(409, `This provider is outside your ${radius} km search radius. Choose another provider or expand your search.`);
}
function intervalsForDate(date, exceptions, master, legacy) {
  const exception = exceptions[0];
  if (exception && !exception.is_available) return [];
  if (Array.isArray(exception?.override_slots)) return exception.override_slots;
  if (master.length) return master;
  if (typeof legacy === "string") {
    try {
      legacy = JSON.parse(legacy);
    } catch {
      legacy = [];
    }
  }
  return Array.isArray(legacy) ? legacy.filter(slot => Number(slot.day) === new Date(`${date}T00:00:00Z`).getUTCDay()) : [];
}
async function workingIntervals(client, booking, snapshot) {
  if (snapshot) return intervalsForDate(booking.date, snapshot.exceptions.filter(row => row.date_str === booking.date), snapshot.master.filter(row => Number(row.day_of_week) === new Date(`${booking.date}T00:00:00Z`).getUTCDay()), snapshot.legacy);
  const exceptions = await client.query("SELECT is_available,override_slots FROM provider_date_exceptions WHERE provider_id=$1 AND date=$2::date", [booking.provider_id, booking.date]);
  if (exceptions.rows.length && !exceptions.rows[0].is_available) return [];
  if (Array.isArray(exceptions.rows[0]?.override_slots)) return exceptions.rows[0].override_slots;
  const master = await client.query("SELECT start_time,end_time FROM provider_master_availability WHERE provider_id=$1 AND day_of_week=EXTRACT(DOW FROM $2::date)", [booking.provider_id, booking.date]);
  if (master.rows.length) return master.rows;
  const result = await client.query("SELECT availability FROM providers WHERE user_id=$1", [booking.provider_id]);
  return intervalsForDate(booking.date, exceptions.rows, master.rows, result.rows[0]?.availability);
}
async function conflictContext(client, booking, config, existingRows) {
  if (!validCoordinates(booking.latitude, booking.longitude)) throw new BookingError(400, "Confirm the customer service location before checking travel availability");
  const result = existingRows ? {
    rows: existingRows
  } : await client.query(`SELECT start_time,end_time,latitude,longitude,
 (SELECT name FROM services WHERE id=bookings.service_id) AS service_name FROM bookings WHERE provider_id=$1 AND date=$2::date
 AND ($3::uuid IS NULL OR booking_id<>$3) AND ${activeBookingPredicate} ORDER BY start_time,booking_id`, [booking.provider_id, booking.date, booking.booking_id || null]);
  const rows = result.rows.map(row => ({
    ...row,
    before: Math.max(config.buffer ?? 20, row.service_name ? getPriceDetails(row.service_name).buffer : 0),
    after: Math.max(config.buffer ?? 20, row.service_name ? getPriceDetails(row.service_name).buffer : 0)
  }));
  if (rows.some(row => !validCoordinates(row.latitude, row.longitude))) throw new BookingError(409, "An existing booking on this date needs its service location confirmed before travel availability can be verified");
  {
    const positioned = rows.filter(row => validCoordinates(row.latitude, row.longitude));
    if (positioned.length) {
      let durations;
      try {
        durations = await getDirectionalTravelDurations([Number(booking.longitude), Number(booking.latitude)], positioned.map(row => [Number(row.longitude), Number(row.latitude)]));
      } catch (err) {
        if (err.code === "ROUTING_UNAVAILABLE") throw new BookingError(503, err.message);
        throw err;
      }
      positioned.forEach((row, i) => {
        row.before = Math.max(row.before, durations.from[i] + 5);
        row.after = Math.max(row.after, durations.to[i] + 5);
      });
    }
  }
  return rows;
}
function hasConflict(rows, start, end) {
  return rows.some(row => !(end + row.after <= minutes(row.start_time) || start >= minutes(row.end_time) + row.before));
}
async function assertNoConflicts(client, booking, config) {
  if (hasConflict(await conflictContext(client, booking, config), minutes(booking.start_time), minutes(booking.end_time))) throw new BookingError(409, "Slot conflicts with another booking or its travel buffer");
}
async function validateLocationChange(client, booking) {
  const selected = await selectService(client, booking);
  assertWithinRadius(selected, booking);
  await assertNoConflicts(client, booking, getPriceDetails(selected.name));
}
async function validateSchedule(client, booking) {
  const selected = await selectService(client, booking),
    config = getPriceDetails(selected.name);
  assertWithinRadius(selected, booking);
  const start = minutes(booking.start_time),
    end = start + (config.slotDuration || 60);
  if (end >= 1440) throw new BookingError(400, "Service must finish before midnight");
  booking.end_time = time(end);
  const future = await client.query("SELECT ($1::date + $2::time) AT TIME ZONE 'Asia/Kolkata' >= clock_timestamp() + INTERVAL '45 minutes' AS valid", [booking.date, booking.start_time]);
  if (!future.rows[0].valid) throw new BookingError(400, "Booking requires at least 45 minutes lead time");
  const intervals = await workingIntervals(client, booking);
  if (!intervals.some(slot => minutes(slot.start_time || slot.start) <= start && minutes(slot.end_time || slot.end) >= end)) throw new BookingError(409, "Slot is outside the provider's published working hours");
  await assertNoConflicts(client, booking, config);
  return selected;
}
async function getAvailability(client, {
  provider_id,
  service_id,
  from = indiaDate(),
  days = 14,
  latitude,
  longitude,
  radius
}, now = new Date()) {
  const selected = await selectService(client, {
      provider_id,
      service_id
    }),
    config = getPriceDetails(selected.name),
    duration = config.slotDuration || 60;
  assertWithinRadius(selected, {
    latitude,
    longitude,
    radius
  });
  const first = new Date(`${from}T00:00:00Z`),
    results = [];
  const last = new Date(first);
  last.setUTCDate(first.getUTCDate() + days - 1);
  const endDate = last.toISOString().slice(0, 10);
  const [master, exceptions, legacy, bookings] = await Promise.all([client.query("SELECT day_of_week,start_time,end_time FROM provider_master_availability WHERE provider_id=$1", [provider_id]), client.query("SELECT TO_CHAR(date,'YYYY-MM-DD') AS date_str,is_available,override_slots FROM provider_date_exceptions WHERE provider_id=$1 AND date BETWEEN $2::date AND $3::date", [provider_id, from, endDate]), client.query("SELECT availability FROM providers WHERE user_id=$1", [provider_id]), client.query(`SELECT TO_CHAR(date,'YYYY-MM-DD') AS date_str,start_time,end_time,latitude,longitude,
   (SELECT name FROM services WHERE id=bookings.service_id) AS service_name FROM bookings
   WHERE provider_id=$1 AND date BETWEEN $2::date AND $3::date AND ${activeBookingPredicate} ORDER BY date,start_time,booking_id`, [provider_id, from, endDate])]);
  const snapshot = {
    master: master.rows,
    exceptions: exceptions.rows,
    legacy: legacy.rows[0]?.availability
  };
  for (let i = 0; i < days; i++) {
    const day = new Date(first);
    day.setUTCDate(first.getUTCDate() + i);
    const date = day.toISOString().slice(0, 10);
    const free_slots = [];
    results.push({
      date,
      free_slots
    });
    if (date < indiaDate(now)) continue;
    const booking = {
      provider_id,
      service_id,
      date,
      latitude,
      longitude
    };
    const intervals = await workingIntervals(client, booking, snapshot);
    if (!intervals.length) continue;
    const conflicts = await conflictContext(client, booking, config, bookings.rows.filter(row => row.date_str === date));
    for (const interval of intervals) {
      for (let start = minutes(interval.start_time || interval.start); start + duration <= minutes(interval.end_time || interval.end); start += Math.min(60, duration)) {
        const end = start + duration;
        if (end >= 1440 || new Date(`${date}T${time(start)}:00+05:30`).getTime() < now.getTime() + 45 * 60000 || hasConflict(conflicts, start, end)) continue;
        if (!free_slots.some(slot => slot.start === time(start))) free_slots.push({
          start: time(start),
          end: time(end),
          start_time: time(start),
          end_time: time(end),
          isBooked: false,
          is_booked: false
        });
      }
    }
    free_slots.sort((a, b) => a.start.localeCompare(b.start));
  }
  return results;
}
module.exports = {
  validateSchedule,
  validateLocationChange,
  assertNoConflicts,
  getAvailability,
  indiaDate,
  hasConflict
};
