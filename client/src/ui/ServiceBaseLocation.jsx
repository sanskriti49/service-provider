import { useEffect, useRef, useState } from "react";
import { validCoordinates } from "../utils/serviceLocation";
export default function ServiceBaseLocation({
  value,
  onChange
}) {
  const [locating, setLocating] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => () => {
    generation.current++;
  }, []);
  const locate = () => {
    if (!navigator.geolocation) {
      setError("Your browser can't share your location. Enter the coordinates of your service base.");
      return;
    }
    const request = ++generation.current;
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(({
      coords
    }) => {
      if (request !== generation.current) return;
      onChange({
        lat: coords.latitude,
        lng: coords.longitude,
        confirmed: false
      });
      setLocating(false);
    }, () => {
      if (request === generation.current) {
        setLocating(false);
        setError("Location is unavailable. Enter your service-base coordinates or try again.");
      }
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  };
  const edit = (field, text) => {
    generation.current++;
    setLocating(false);
    onChange({
      ...value,
      [field]: text,
      confirmed: false
    });
  };
  const valid = validCoordinates(value?.lat, value?.lng);
  return <div className="space-y-3 rounded-xl border border-violet-400/30 p-4">
		<p className="text-sm font-semibold">Service base</p>
		<p className="text-xs opacity-70">Confirm the point you travel from. A city name alone is not precise enough for nearby matching.</p>
		<button type="button" onClick={locate} disabled={locating} className="rounded-lg bg-violet-600 px-3 py-2 text-xs text-white">{locating ? "Locating…" : "Use my location"}</button>
		<div className="grid grid-cols-2 gap-3">
			<label className="text-xs">Latitude<input aria-label="Service base latitude" type="number" min="-90" max="90" step="any" value={value?.lat ?? ""} onChange={e => edit('lat', e.target.value)} className="mt-1 w-full rounded-lg border border-violet-400/30 bg-transparent p-2" /></label>
			<label className="text-xs">Longitude<input aria-label="Service base longitude" type="number" min="-180" max="180" step="any" value={value?.lng ?? ""} onChange={e => edit('lng', e.target.value)} className="mt-1 w-full rounded-lg border border-violet-400/30 bg-transparent p-2" /></label>
		</div>
		{valid && <a href={`https://www.openstreetmap.org/?mlat=${value.lat}&mlon=${value.lng}#map=17/${value.lat}/${value.lng}`} target="_blank" rel="noreferrer" className="block text-xs text-violet-400 underline">Check this point on the map</a>}
		<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(value?.confirmed)} disabled={!valid} onChange={e => onChange({
        ...value,
        confirmed: e.target.checked
      })} />This point is my service base</label>
		{error && <p role="alert" className="text-xs text-amber-500">{error}</p>}
	</div>;
}
