import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axiosInstance";

const endpoint = "/api/bookings";
const panel = "space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5";
const button = "rounded-lg border border-violet-400/30 px-3 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-400/15 disabled:opacity-50";
const formatMoney = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const money = (paise) => formatMoney.format(paise / 100);
const dateLabel = (date) => new Intl.DateTimeFormat("en-IN", {
	day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
}).format(new Date(date));
const message = (error, fallback) => error.response?.data?.message || fallback;

function priceDifference(price, original) {
	if (original == null) return "Original price unavailable";
	const delta = price - original;
	return delta === 0 ? "Same price" : `${money(Math.abs(delta))} ${delta > 0 ? "more" : "less"} than the original`;
}

function ReplacementOptions({ bookingId }) {
	const [date, setDate] = useState("");
	const [refresh, setRefresh] = useState(0);
	const [result, setResult] = useState(null);
	const [error, setError] = useState("");
	const [selection, setSelection] = useState(null);
	const [saving, setSaving] = useState(false);
	const [confirmationError, setConfirmationError] = useState("");
	const url = `${endpoint}/${bookingId}/replacement`;
	const replacementId = result?.original.replacement_id;

	useEffect(() => {
		const request = new AbortController();
		api.get(url, { params: date ? { date } : {}, signal: request.signal })
			.then(({ data }) => { if (!request.signal.aborted) setResult(data); })
			.catch((err) => {
				if (!request.signal.aborted) setError(message(err, "Could not check replacement options."));
			});
		return () => request.abort();
	}, [date, refresh, url]);

	useEffect(() => {
		if (!replacementId) return;
		const onStatusChange = ({ detail }) => {
			if (detail?.type === "booking_status" && detail.data?.booking_id === replacementId) {
				setRefresh((value) => value + 1);
			}
		};
		window.addEventListener("app:notification", onStatusChange);
		return () => window.removeEventListener("app:notification", onStatusChange);
	}, [replacementId]);

	function search(nextDate) {
		setSelection(null);
		setError("");
		setConfirmationError("");
		setResult((current) => current ? { ...current, options: null } : null);
		setDate(nextDate);
		setRefresh((value) => value + 1);
	}

	async function confirm() {
		if (!selection || !result?.options || saving || result.payment_block) return;
		setSaving(true);
		setConfirmationError("");
		try {
			const { data } = await api.post(url, {
				provider_id: selection.provider.provider_id, date: result.date,
				start_time: selection.slot.start, approved_price_paise: selection.provider.price_paise,
			});
			setResult({ ...result, original: data.original, options: [] });
			setSelection(null);
		} catch (err) {
			setConfirmationError(message(err, "We couldn't confirm the request. Refresh to check whether it went through."));
			setSelection(null);
		} finally {
			setSaving(false);
		}
	}

	if (result?.original.replacement_id) {
		const { replacement_status: status, replacement_provider_name: name,
			replacement_can_retry: canRetry } = result.original;
		return <div className="space-y-2 text-sm text-slate-200" role="status">
			<p>Replacement with {name} · {status === "pending" ? "Awaiting provider acceptance" : status.replaceAll("_", " ")}</p>
			{canRetry && <Link className={`${button} inline-block`} to={`?tab=recovery&replacement=${replacementId}`}>
				Try another provider
			</Link>}
			<Link className="text-violet-300 underline" to={`?tab=${["cancelled", "expired", "completed", "no_show"].includes(status) ? "history" : "upcoming"}`}>
				View bookings
			</Link>
			{status === "cancelled" && !canRetry && <Link className="block text-violet-300 underline" to="/services">Browse services</Link>}
		</div>;
	}

	const original = result?.original;
	return (
		<div className="space-y-4 text-sm text-slate-200">
			{result?.window && (
				<div className="flex flex-wrap items-end gap-3">
					<label className="grid gap-1">
						<span>Appointment date</span>
						<input type="date" value={date || result.date || result.window.preferred}
							min={result.window.min} max={result.window.max} disabled={saving}
							onChange={(event) => search(event.target.value)}
							className="rounded-lg border border-white/20 bg-[#1c122b] p-2 scheme-dark" />
					</label>
					<button type="button" className={button} disabled={saving} onClick={() => search(date)}>Refresh options</button>
				</div>
			)}
			{error && (
				<div className="space-y-2">
					<p role="alert" className="text-rose-300">{error}</p>
					{!result && <button type="button" className={button} onClick={() => search(date)}>Try again</button>}
				</div>
			)}
			{!error && !result?.options && <p role="status">Checking providers and travel availability…</p>}
			{result?.payment_block && <p className="rounded-lg bg-amber-400/10 p-3 text-amber-200">{result.payment_block}</p>}
			{result?.options?.length === 0 && <p>No matching providers showed availability for this date. Try another date or keep the cancellation.</p>}
			{result?.options?.length > 0 && (
				<div className="grid gap-3 sm:grid-cols-2">
					{result.options.map((provider) => (
						<div key={provider.provider_id} className="space-y-2 rounded-xl border border-white/10 p-3">
							<p className="font-semibold text-white">{provider.name} · {money(provider.price_paise)}</p>
							<p className="text-slate-300">{priceDifference(provider.price_paise, original.price_paise)}</p>
							<div className="flex flex-wrap gap-2">
								{[...provider.slots].sort((a, b) => Number(b.same_time) - Number(a.same_time)).map((slot) => {
									const active = selection?.provider.provider_id === provider.provider_id && selection.slot.start === slot.start;
									return <button type="button" key={slot.start}
										className={`${button} ${active ? "bg-violet-400/25 ring-1 ring-violet-300" : ""}`}
										aria-pressed={active} disabled={saving || Boolean(confirmationError)}
										onClick={() => setSelection({ provider, slot })}>
										{slot.start}–{slot.end}{slot.same_time ? " · Original time" : ""}
									</button>;
								})}
							</div>
						</div>
					))}
				</div>
			)}
			{result?.options && result.partial && <p className="text-slate-400">Some providers were outside this search or could not be checked.</p>}
			{confirmationError && <p role="alert" className="text-rose-300">{confirmationError} Use Refresh options to check again.</p>}
			{selection && (
				<div className="space-y-2 rounded-xl border border-violet-400/30 bg-violet-500/10 p-3">
					<p><strong>{selection.provider.name}</strong> · {dateLabel(result.date)}, {selection.slot.start} IST</p>
					<p>Pay {money(selection.provider.price_paise)} after service. Your request reserves this slot and awaits provider acceptance.</p>
					<button type="button" className={`${button} bg-violet-400/15`} disabled={saving || Boolean(result.payment_block)} onClick={confirm}>
						{saving ? "Reserving…" : `Confirm replacement for ${money(selection.provider.price_paise)}`}
					</button>
				</div>
			)}
			<p className="text-slate-400">
				Your original booking is already cancelled. You can leave it cancelled without choosing a replacement.
				{original?.payment_method === "online" && " Track the original payment in Refunds below."}
			</p>
			<Link className="text-violet-300 underline" to="/services">Browse services</Link>
		</div>
	);
}

export default function BookingReplacementRecovery({ selectedId }) {
	const [items, setItems] = useState(null);
	const [error, setError] = useState("");
	const [refresh, setRefresh] = useState(0);
	const bookingId = selectedId;

	useEffect(() => {
		const request = new AbortController();
		api.get(`${endpoint}/recovery/replacements`, { signal: request.signal })
			.then(({ data }) => {
				if (!request.signal.aborted) {
					setItems(data.items);
					setError("");
				}
			})
			.catch((err) => {
				if (!request.signal.aborted) setError(message(err, "Could not load cancelled appointments."));
			});
		return () => request.abort();
	}, [refresh]);

	useEffect(() => {
		const onStatusChange = ({ detail }) => {
			if (detail?.type === "booking_status") setRefresh((value) => value + 1);
		};
		window.addEventListener("app:notification", onStatusChange);
		return () => window.removeEventListener("app:notification", onStatusChange);
	}, []);

	return (
		<section className={`mb-5 ${panel}`} aria-label="Provider cancellations">
			<h2 className="font-bold text-white">Provider cancellations</h2>
			{error && <>
				<p role="alert" className="text-sm text-rose-300">{error}</p>
				<button type="button" className={button} onClick={() => { setError(""); setRefresh((value) => value + 1); }}>Try again</button>
			</>}
			{!items && !error && <p className="text-sm text-slate-300" role="status">Loading cancelled appointments…</p>}
			{items?.length === 0 && !bookingId && <p className="text-sm text-slate-300">There are no provider cancellations to recover.</p>}
			{items?.map((item) => (
				<article key={item.booking_id} className={panel}>
					<p className="font-semibold text-white">{item.service_name || "Service appointment"} · {dateLabel(item.date)}, {item.start_time} IST</p>
					<p className="text-sm text-slate-300">{item.provider_name} cancelled. {item.cancellation_reason}</p>
					{item.price_paise != null && <p className="text-sm text-slate-400">Original price {money(item.price_paise)}</p>}
					{bookingId === item.booking_id ? <ReplacementOptions bookingId={item.booking_id} /> : (
						<Link className={`${button} inline-block`} to={`?tab=recovery&replacement=${item.booking_id}`}>
							{item.replacement_id ? "View replacement" : "Find a replacement"}
						</Link>
					)}
				</article>
			))}
			{items && bookingId && !items.some((item) => item.booking_id === bookingId) && (
				<ReplacementOptions key={bookingId} bookingId={bookingId} />
			)}
		</section>
	);
}
