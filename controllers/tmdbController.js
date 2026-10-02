import axios from "axios";
import { TMDB_BASE, TMDB_API_KEY, httpsAgent, TMDB_HEADERS } from "../config/http.js";

// In-memory cache for TMDB API responses: cacheKey -> { data, ts }
const tmdbCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-flight request deduplication map: cacheKey -> Promise
const inFlightRequests = new Map();

/**
 * GET /api/{*endpoint}
 * Proxies requests to TMDB API, injecting API key, browser headers, caching, and deduplication.
 */
export async function proxyTMDB(req, res) {
  let endpoint = "";
  const startTime = Date.now();

  try {
    const raw = req.params.endpoint ?? req.params[0];
    endpoint = Array.isArray(raw) ? raw.join("/") : (raw || "");

    // Ignore empty requests
    if (!endpoint) {
      return res.status(400).json({ success: false, error: "Endpoint is required" });
    }

    // Normalize endpoint (strip leading slashes to prevent double slashes)
    const cleanEndpoint = endpoint.replace(/^\/+/, "");

    // Build unique cache key from cleanEndpoint and sorted query params
    const queryParams = { ...req.query };
    delete queryParams.api_key; // normalise
    const sortedQuery = Object.keys(queryParams)
      .sort()
      .map(k => `${k}=${queryParams[k]}`)
      .join("&");
    const cacheKey = `${cleanEndpoint}?${sortedQuery}`;

    // 1. Check cache
    const cached = tmdbCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json(cached.data);
    }

    // 2. Coalesce in-flight requests for identical endpoints
    let requestPromise = inFlightRequests.get(cacheKey);

    if (!requestPromise) {
      requestPromise = (async () => {
        const targetUrl = `${TMDB_BASE}/${cleanEndpoint}`;
        const maxRetries = 2;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const response = await axios.get(targetUrl, {
              params: {
                api_key: TMDB_API_KEY,
                language: "en-US",
                ...req.query,
              },
              headers: TMDB_HEADERS,
              timeout: 8000,
            });
            const data = response.data;
            tmdbCache.set(cacheKey, { data, ts: Date.now() });
            return data;
          } catch (err) {
            const isTransient = err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.code === "ECONNABORTED";
            if (isTransient && attempt < maxRetries) {
              console.warn(`[TMDB Proxy] Transient ${err.code} on "${cleanEndpoint}", retrying (attempt ${attempt + 1}/${maxRetries})...`);
              await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
              continue;
            }
            throw err;
          }
        }
      })().finally(() => {
        inFlightRequests.delete(cacheKey);
      });

      inFlightRequests.set(cacheKey, requestPromise);
    }

    const data = await requestPromise;
    return res.json(data);
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const statusCode = err.response?.status || (err.code === "ECONNABORTED" ? 504 : 502);

    console.warn(`[TMDB Proxy] Endpoint "/${endpoint}" failed after ${duration}s: ${err.message} (status: ${statusCode})`);

    if (err.response?.data) {
      return res.status(statusCode).json(err.response.data);
    }

    return res.status(statusCode).json({
      success: false,
      error: err.message || "TMDB request failed",
      results: [],
    });
  }
}