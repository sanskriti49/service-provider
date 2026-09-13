// Single source of truth for the API origin.
// Set VITE_API_URL in .env for deployed environments; the default suits local dev.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default API_URL;
