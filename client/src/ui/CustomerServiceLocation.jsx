import { useEffect, useRef, useState } from "react";
import api from "../api/axiosInstance";
import { useAuth } from "../contexts/AuthContext";
import { apiCache } from "../utils/apiCache";
import { addressCandidates, createRequestGuard, serviceLocation, validCoordinates } from "../utils/serviceLocation";
export default function CustomerServiceLocation({
  value,
  onChange
}) {
  const {
    user
  } = useAuth();
  const [search, setSearch] = useState(value?.address || ""),
    [matches, setMatches] = useState([]),
    [saved, setSaved] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requests = useRef(createRequestGuard());
  useEffect(() => () => requests.current.cancel(), []);
  useEffect(() => {
    setSearch(value?.address || "");
  }, [value?.address]);
  useEffect(() => {
    if (!user?.id) return;
    const cacheKey = `user_addresses_${user.id}`;
    const cached = apiCache.get(cacheKey);
    if (cached) {
      setSaved(cached);
      return;
    }
    let active = true;
    api.get('/api/account/addresses').then(res => {
      const list = res.data?.addresses || [];
      if (active) setSaved(list);
      apiCache.set(cacheKey, list, 60000);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);
  const find = async (text = search) => {
    if (text.trim().length < 5) {
      setError("Enter your service address, city and postcode.");
      return;
    }
    const request = requests.current.begin();
    setBusy(true);
    setError("");
    setMatches([]);
    try {
      const choices = await addressCandidates(text, request.signal);
      if (request.current()) {
        setMatches(choices);
        if (!choices.length) setError("No matching location found. Try a more complete address.");
      }
    } catch (err) {
      if (request.current()) setError(err.message);
    } finally {
      if (request.current()) setBusy(false);
    }
  };
  const choose = location => {
    requests.current.cancel();
    setMatches([]);
    setBusy(false);
    onChange(location);
  };
  return <details className="mb-6 rounded-2xl border border-violet-400/20 bg-[#22194A] p-4 text-sm text-white">
		<summary className="cursor-pointer font-semibold">{value?.address || "Choose your service address"}</summary>
		<div className="mt-3 space-y-3">
			{saved.length > 0 && <select aria-label="Saved service address" defaultValue="" className="w-full rounded-lg bg-[#191034] p-2" onChange={e => {
        const selected = saved.find(a => String(a.id) === e.target.value);
        if (!selected) return;
        if (validCoordinates(selected.lat, selected.lng)) choose(serviceLocation({
          ...selected,
          source: 'saved'
        }));else {
          setSearch(selected.full_address);
          find(selected.full_address);
        }
      }}>
				<option value="">Choose a saved address</option>{saved.map(a => <option key={a.id} value={a.id}>{a.label}: {a.full_address}</option>)}
			</select>}
			<label className="block text-xs text-gray-300">Search service address<input aria-label="Search service address" value={search} onChange={e => {
          requests.current.cancel();
          setBusy(false);
          setMatches([]);
          setSearch(e.target.value);
        }} className="mt-1 w-full rounded-lg border border-violet-400/20 bg-transparent p-2" /></label>
			<button type="button" disabled={busy} onClick={() => find()} className="rounded-lg bg-violet-600 px-4 py-2">{busy ? 'Finding location…' : 'Find service location'}</button>
			{matches.map((location, i) => <button key={i} type="button" onClick={() => choose(location)} className="block w-full rounded-lg border border-violet-400/20 p-3 text-left text-xs">{location.address}</button>)}
			{error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
		</div>
	</details>;
}
