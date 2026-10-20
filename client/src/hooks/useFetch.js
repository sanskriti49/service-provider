import { useCallback, useEffect, useSyncExternalStore } from "react";
import api from "../api/axiosInstance";
import { createPublicResource } from "../utils/publicResource.js";

// All consumers load the same public catalogue; share requests and a short cache.
const catalogue = createPublicResource({
	request: async (url, options) => (await api.get(url, options)).data,
});
const empty = { data: null, loading: false, error: null };

export const useFetch = (url) => {
	const subscribe = useCallback(listener => url ? catalogue.subscribe(url, listener) : () => {}, [url]);
	const getSnapshot = useCallback(() => url ? catalogue.getSnapshot(url) : empty, [url]);
	const state = useSyncExternalStore(subscribe, getSnapshot);
	const retry = useCallback(() => {
		if (url) catalogue.read(url, { force: true }).catch(() => {});
	}, [url]);

	useEffect(() => {
		if (!url) return;
		const controller = new AbortController();
		catalogue.read(url, { signal: controller.signal }).catch(() => {});
		return () => controller.abort();
	}, [url]);

	useEffect(() => {
		if (!state.error) return;
		window.addEventListener("online", retry);
		return () => window.removeEventListener("online", retry);
	}, [state.error, retry]);

	return {
		...state,
		error: state.error ? "Services are temporarily unavailable. Please try again." : null,
		retry,
	};
};
