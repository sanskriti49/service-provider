export function validCoordinates(lat, lng) {
  return [lat, lng].every(v => v !== null && v !== undefined && v !== "" && (typeof v === "number" || typeof v === "string") && Number.isFinite(Number(v))) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}
export function serviceLocation(value = {}) {
  const valid = validCoordinates(value?.lat, value?.lng);
  return {
    address: String(value?.address ?? value?.full_address ?? "").trim(),
    lat: valid ? Number(value.lat) : null,
    lng: valid ? Number(value.lng) : null,
    source: value?.source ?? "manual"
  };
}
// Only the explicit customer object is trusted. Provider coordinates are never a customer fallback.
export function initialCustomerLocation(state) {
  return serviceLocation(state?.serviceLocation ?? {
    address: state?.address
  });
}
export function editServiceAddress(location, address) {
  const text = String(address);
  return text.trim() === location.address.trim() ? {
    ...location,
    address: text
  } : serviceLocation({
    address: text
  });
}
export function locationParams(location) {
  return validCoordinates(location?.lat, location?.lng) ? {
    lat: String(location.lat),
    lng: String(location.lng)
  } : {};
}
export function bookingCoordinates(location) {
  if (!validCoordinates(location?.lat, location?.lng) || !location.address?.trim()) throw new Error("Choose a confirmed service address before booking.");
  return {
    latitude: Number(location.lat),
    longitude: Number(location.lng)
  };
}
export function requestCacheKey(prefix, parameters) {
  const params = new URLSearchParams(parameters);
  params.sort();
  return `${prefix}_${params.toString()}`;
}
export function createRequestGuard() {
  let controller;
  return {
    begin() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      return {
        signal: current.signal,
        current: () => controller === current && !current.signal.aborted,
        cancel: () => current.abort()
      };
    },
    cancel() {
      controller?.abort();
    }
  };
}
export async function addressCandidates(address, signal) {
  const params = new URLSearchParams({
    format: "json",
    q: address.trim(),
    limit: "5",
    addressdetails: "1"
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error("Address search is unavailable. Try again or use your location.");
  const results = await response.json();
  if (!Array.isArray(results)) throw new Error("Address search is unavailable. Please try again.");
  return results.filter(r => validCoordinates(r.lat, r.lon)).map(r => serviceLocation({
    address: r.display_name,
    lat: r.lat,
    lng: r.lon,
    source: "geocoded"
  }));
}
export async function reverseLocation(lat, lng, signal) {
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error("Couldn't resolve this location to an address.");
  const data = await response.json();
  if (!data.display_name) throw new Error("Couldn't resolve this location to an address.");
  return serviceLocation({
    address: data.display_name,
    lat,
    lng,
    source: "browser"
  });
}
export function indiaDate(now = new Date(), offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  const day = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}
