import { useState, useEffect } from "react";
import axios from "axios";

export const useFetch = (url) => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		if (!url) {
			setLoading(false);
			return;
		}
		const controller = new AbortController();

		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await axios.get(url, { signal: controller.signal });
				setData(response.data);
			} catch (err) {
				// Don't update state if the request was cancelled
				if (axios.isCancel(err)) {
					console.log("Request canceled:", err.message);
				} else {
					console.error("Failed to fetch data", err);
					setError("Oops! Something went wrong while fetching the data.");
				}
			} finally {
				// Only set loading to false if the component is still mounted
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			}
		};
		fetchData();
		// Cleanup function: this runs when the component unmounts or the URL changes.
		return () => {
			controller.abort();
		};
	}, [url]);

	return { data, loading, error };
};
