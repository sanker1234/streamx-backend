// streamx-backend/controllers/mangaController.js
//
// Handles all /api/manga/* routes.
// Does NOT touch animeController.js or any existing functionality.
//
// Endpoints:
//   GET /api/manga/trending
//   GET /api/manga/popular
//   GET /api/manga/search?q=&page=
//   GET /api/manga/details/:id
//   GET /api/manga/manhwa            (trending manhwa via country=KR)
//   GET /api/manga/manhua            (trending manhua via country=CN)
//   GET /api/manga/chapters/:id?provider=&page=&group=&sort=
//   GET /api/manga/pages/:chapterId?provider=
//   GET /api/manga/providers/health

import * as anilistProvider from "../providers/anilistProvider.js";
import { readerRegistry } from "../providers/readerProviderRegistry.js";

// ── In-memory caches (same pattern as animeController.js) ────────────────────
const detailsCache  = new Map();   // TTL: 30 min
const listCache     = new Map();   // TTL: 15 min
const searchCache   = new Map();   // TTL: 10 min
const chaptersCache = new Map();   // TTL: 10 min
const pagesCache    = new Map();   // TTL: 60 min (pages rarely change)

const CACHE_TTL = {
  details:  30 * 60 * 1000,
  list:     15 * 60 * 1000,
  search:   10 * 60 * 1000,
  chapters: 10 * 60 * 1000,
  pages:    60 * 60 * 1000,
};

function fromCache(map, key, ttl) {
  const entry = map.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  return null;
}

function toCache(map, key, data) {
  map.set(key, { data, ts: Date.now() });
}

// ── Manga Metadata (AniList) ──────────────────────────────────────────────────

/**
 * GET /api/manga/trending
 */
export async function getTrending(req, res) {
  const page = parseInt(req.query.page) || 1;
  try {
    const cacheKey = `trending-${page}`;
    const cached = fromCache(listCache, cacheKey, CACHE_TTL.list);
    if (cached) return res.json(cached);

    const data = await anilistProvider.fetchMangaList({
      page,
      sort: ["TRENDING_DESC", "POPULARITY_DESC"],
    });
    toCache(listCache, cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error("[Manga Controller] getTrending failed:", err.message);
    res.json({ success: true, results: [], total_pages: 1, page: page, error: err.message });
  }
}

/**
 * GET /api/manga/popular
 */
export async function getPopular(req, res) {
  const page = parseInt(req.query.page) || 1;
  try {
    const cacheKey = `popular-${page}`;
    const cached = fromCache(listCache, cacheKey, CACHE_TTL.list);
    if (cached) return res.json(cached);

    const data = await anilistProvider.fetchMangaList({
      page,
      sort: ["POPULARITY_DESC"],
    });
    toCache(listCache, cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error("[Manga Controller] getPopular failed:", err.message);
    res.json({ success: true, results: [], total_pages: 1, page: page, error: err.message });
  }
}

/**
 * GET /api/manga/manhwa — trending manhwa (Korean origin)
 */
export async function getManhwa(req, res) {
  const page = parseInt(req.query.page) || 1;
  try {
    const cacheKey = `manhwa-${page}`;
    const cached = fromCache(listCache, cacheKey, CACHE_TTL.list);
    if (cached) return res.json(cached);

    const data = await anilistProvider.fetchMangaList({
      page,
      sort: ["POPULARITY_DESC"],
      countryOfOrigin: "KR",
    });
    toCache(listCache, cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error("[Manga Controller] getManhwa failed:", err.message);
    res.json({ success: true, results: [], total_pages: 1, page: page, error: err.message });
  }
}

/**
 * GET /api/manga/manhua — trending manhua (Chinese origin)
 */
export async function getManhua(req, res) {
  const page = parseInt(req.query.page) || 1;
  try {
    const cacheKey = `manhua-${page}`;
    const cached = fromCache(listCache, cacheKey, CACHE_TTL.list);
    if (cached) return res.json(cached);

    const data = await anilistProvider.fetchMangaList({
      page,
      sort: ["POPULARITY_DESC"],
      countryOfOrigin: "CN",
    });
    toCache(listCache, cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error("[Manga Controller] getManhua failed:", err.message);
    res.json({ success: true, results: [], total_pages: 1, page: page, error: err.message });
  }
}

/**
 * GET /api/manga/search?q=&page=
 */
export async function getSearch(req, res) {
  try {
    const query = (req.query.q || "").trim();
    const page  = parseInt(req.query.page) || 1;

    if (!query) {
      return res.status(400).json({ success: false, error: "Search query 'q' is required" });
    }

    const cacheKey = `search-${query}-${page}`;
    const cached = fromCache(searchCache, cacheKey, CACHE_TTL.search);
    if (cached) return res.json(cached);

    const data = await anilistProvider.fetchMangaSearch(query, page);
    toCache(searchCache, cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error("[Manga Controller] getSearch failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/manga/details/:id
 * Returns full AniList manga metadata (title, cover, synopsis, genres, authors, artists,
 * recommendations, relations, tags, external links, chapter/volume counts).
 */
export async function getDetails(req, res) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, error: "ID is required" });

    const cacheKey = `details-${id}`;
    const cached = fromCache(detailsCache, cacheKey, CACHE_TTL.details);
    if (cached) return res.json(cached);

    const data = await anilistProvider.fetchMangaDetails(id);
    if (!data) {
      return res.status(404).json({ success: false, error: "Manga not found on AniList" });
    }

    toCache(detailsCache, cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error("[Manga Controller] getDetails failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Chapter List (ReaderProvider) ─────────────────────────────────────────────

/**
 * GET /api/manga/chapters/:id
 *
 * Query params:
 *   provider  — preferred provider name (optional; registry handles fallback)
 *   page      — page number (default 1)
 *   limit     — chapters per page (default 30)
 *   group     — filter by scanlation group (optional)
 *   sort      — 'asc' | 'desc' (default 'desc')
 *
 * The :id here is the provider-specific series ID (not AniList ID).
 * The frontend must resolve the mapping from AniList ID → provider ID
 * by calling the search() endpoint and selecting the correct result,
 * or via a future mapping layer (Phase 4).
 */
export async function getChapters(req, res) {
  const { id } = req.params;
  const {
    provider: preferredProvider,
    page    = "1",
    limit   = "30",
    group,
    sort    = "desc",
  } = req.query;

  if (!id) return res.status(400).json({ success: false, error: "Series ID is required" });

  const options = {
    page:  parseInt(page) || 1,
    limit: parseInt(limit) || 30,
    sort:  sort === "asc" ? "asc" : "desc",
    ...(group ? { group } : {}),
  };

  const cacheKey = `chapters-${id}-${preferredProvider || "any"}-${options.page}-${options.sort}-${group || ""}`;
  const cached = fromCache(chaptersCache, cacheKey, CACHE_TTL.chapters);
  if (cached) return res.json(cached);

  // If no providers are registered yet, return an informative empty response
  if (!readerRegistry.hasProviders()) {
    return res.json({
      id,
      chapters: [],
      page: options.page,
      totalPages: 0,
      provider: "none",
      message: "No reader providers are registered yet. Providers will be added in Phase 2.",
    });
  }

  try {
    let result;

    if (preferredProvider) {
      // Try requested provider first, fall back to registry chain on failure
      try {
        const providerInstance = readerRegistry.getProvider(preferredProvider);
        result = await providerInstance.chapters(id, options);
      } catch (err) {
        console.warn(`[Manga Controller] Preferred provider '${preferredProvider}' failed: ${err.message}. Falling back.`);
        result = await readerRegistry.executeWithFallback("chapters", id, options);
      }
    } else {
      result = await readerRegistry.executeWithFallback("chapters", id, options);
    }

    toCache(chaptersCache, cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("[Manga Controller] getChapters failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Chapter Pages (ReaderProvider) ───────────────────────────────────────────

/**
 * GET /api/manga/pages/:chapterId
 *
 * Query params:
 *   provider — preferred provider name (optional)
 *
 * :chapterId is the provider-specific chapter ID.
 */
export async function getChapterPages(req, res) {
  const { chapterId } = req.params;
  const { provider: preferredProvider } = req.query;

  if (!chapterId) return res.status(400).json({ success: false, error: "Chapter ID is required" });

  const cacheKey = `pages-${chapterId}-${preferredProvider || "any"}`;
  const cached = fromCache(pagesCache, cacheKey, CACHE_TTL.pages);
  if (cached) return res.json(cached);

  if (!readerRegistry.hasProviders()) {
    return res.json({
      chapterId,
      pages: [],
      provider: "none",
      message: "No reader providers are registered yet. Providers will be added in Phase 2.",
    });
  }

  try {
    let result;

    if (preferredProvider) {
      try {
        const providerInstance = readerRegistry.getProvider(preferredProvider);
        result = await providerInstance.chapterPages(chapterId);
      } catch (err) {
        console.warn(`[Manga Controller] Preferred provider '${preferredProvider}' failed: ${err.message}. Falling back.`);
        result = await readerRegistry.executeWithFallback("chapterPages", chapterId);
      }
    } else {
      result = await readerRegistry.executeWithFallback("chapterPages", chapterId);
    }

    toCache(pagesCache, cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("[Manga Controller] getChapterPages failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Provider Health ───────────────────────────────────────────────────────────

/**
 * GET /api/manga/providers/health
 * Returns current health status of all registered reader providers.
 */
export async function getProvidersHealth(req, res) {
  try {
    const health = readerRegistry.getHealth();
    const providers = readerRegistry.list();

    res.json({
      providers,
      health,
      summary: {
        total: providers.length,
        healthy: providers.filter(p => health[p.name]?.available).length,
        unhealthy: providers.filter(p => !health[p.name]?.available).length,
      },
    });
  } catch (err) {
    console.error("[Manga Controller] getProvidersHealth failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/manga/providers/search?q=&page=
 * Search for a manga directly across a specific provider (for mapping/lookup).
 * Used by the frontend to find provider IDs for a given AniList ID.
 */
export async function searchProvider(req, res) {
  const query = (req.query.q || "").trim();
  const page  = parseInt(req.query.page) || 1;
  const providerName = req.query.provider;

  if (!query) return res.status(400).json({ success: false, error: "'q' is required" });

  if (!readerRegistry.hasProviders()) {
    return res.json({ results: [], provider: "none" });
  }

  try {
    let result;
    if (providerName) {
      const providerInstance = readerRegistry.getProvider(providerName);
      result = await providerInstance.search(query, page);
    } else {
      result = await readerRegistry.executeWithFallback("search", query, page);
    }
    res.json(result);
  } catch (err) {
    console.error("[Manga Controller] searchProvider failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
