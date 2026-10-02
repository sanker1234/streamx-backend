// streamx-backend/config/http.js
// Shared HTTP client configuration for backend providers.
// Centralizes TMDB API key, base URL, and IPv4 agent.

import https from "https";
import dotenv from "dotenv";

dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

// Force IPv4 for TMDB requests
const httpsAgent = new https.Agent({ family: 4 });

export const TMDB_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Encoding": "gzip, deflate",
  "Accept-Language": "en-US,en;q=0.9",
};

// TMDB request defaults
export const tmdbDefaults = {
  params: {
    api_key: TMDB_API_KEY,
    language: "en-US",
  },
  headers: TMDB_HEADERS,
  httpsAgent,
  timeout: 8000,
};

export { TMDB_API_KEY, TMDB_BASE, httpsAgent };