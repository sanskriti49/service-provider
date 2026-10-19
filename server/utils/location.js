const Joi = require("joi");
const coordinateFields = {
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180)
};
function validCoordinates(lat, lng) {
  return [lat, lng].every(v => v !== null && v !== undefined && v !== "" && (typeof v === "number" || typeof v === "string") && Number.isFinite(Number(v))) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}
function pairedCoordinates(value, helpers) {
  const lat = value.lat ?? value.latitude;
  const lng = value.lng ?? value.longitude;
  if (lat != null !== (lng != null)) return helpers.message("Latitude and longitude must be supplied together");
  return value;
}
function validDate(value, helpers) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return helpers.message("A valid YYYY-MM-DD date is required");
  return value;
}
const dateField = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom(validDate);
const timeField = Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const configuredRadius = Number(process.env.PROVIDER_SEARCH_RADIUS_KM ?? 50);
const DEFAULT_RADIUS_KM = Number.isFinite(configuredRadius) && configuredRadius >= 1 && configuredRadius <= 500 ? configuredRadius : 50;
const discoverySchema = Joi.object({
  service: Joi.string().trim().max(100),
  ...coordinateFields,
  radius: Joi.number().min(1).max(500).default(DEFAULT_RADIUS_KM),
  sort_by: Joi.string().valid("recommended", "distance", "rating", "price_asc", "price_desc"),
  min_rating: Joi.number().min(0).max(5),
  max_price: Joi.number().min(0),
  date: dateField,
  start_time: timeField
}).with("start_time", "date").with("date", "lat").with("date", "lng").custom(pairedCoordinates).unknown(true);
const availabilitySchema = Joi.object({
  lat: coordinateFields.lat.required(),
  lng: coordinateFields.lng.required(),
  service: Joi.string().trim().max(100),
  service_id: Joi.string().trim().max(100),
  radius: Joi.number().min(1).max(500).default(DEFAULT_RADIUS_KM),
  from: dateField,
  days: Joi.number().integer().min(1).max(30).default(14)
}).with("radius", "lat").with("radius", "lng").custom(pairedCoordinates).unknown(true);
module.exports = {
  validCoordinates,
  validDate,
  pairedCoordinates,
  coordinateFields,
  discoverySchema,
  availabilitySchema,
  DEFAULT_RADIUS_KM
};
