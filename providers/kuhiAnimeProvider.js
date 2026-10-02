// streamx-backend/providers/kuhiAnimeProvider.js
import axios from "axios";
import { EpisodeProvider } from "./base/EpisodeProvider.js";
import { MetadataProvider } from "./base/MetadataProvider.js";
import { mapAniListMedia, mapAniListDetails } from "./anilistProvider.js";
import { registry } from "./providerRegistry.js";

const DEFAULT_BASE_URL = "https://anime-api-hgd3.onrender.com";
const TIMEOUT_MS = 20000;

function getBaseUrl() {
  return (process.env.ANIME_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/**
 * KuhiAnimeProvider - Episode and Streaming Provider for Render Anime API
 */
export class KuhiAnimeProvider extends EpisodeProvider {
  constructor(name = "kuhi") {
    super(name);
    this.cache = new Map(); // key -> { data, ts }
  }

  /**
   * Parse episode number and anilist ID from inputs
   */
  _parseEpisodeParams(episodeId, animeId) {
    let resolvedAnimeId = animeId ? String(animeId).trim() : null;
    let resolvedEpNum = null;

    // Check if episodeId is a simple number: e.g. "1", 1
    const numeric = parseInt(episodeId, 10);
    if (!isNaN(numeric) && String(numeric) === String(episodeId).trim()) {
      resolvedEpNum = numeric;
    } else if (typeof episodeId === "string") {
      // Could be formatted as watch/anikoto/20/sub/anikoto-1 or 20-ep-1
      const watchMatch = episodeId.match(/watch\/[^/]+\/(\d+)\/(sub|dub)\/[^/]+-(\d+)/i);
      if (watchMatch) {
        if (!resolvedAnimeId) resolvedAnimeId = watchMatch[1];
        resolvedEpNum = parseInt(watchMatch[3], 10);
      } else {
        const epMatch = episodeId.match(/(?:ep|episode)[-_]?(\d+)/i);
        if (epMatch) {
          resolvedEpNum = parseInt(epMatch[1], 10);
        } else if (!isNaN(numeric)) {
          resolvedEpNum = numeric;
        }
      }
    }

    if (!resolvedEpNum || resolvedEpNum < 1) {
      resolvedEpNum = 1;
    }

    return {
      animeId: resolvedAnimeId,
      episodeNumber: resolvedEpNum
    };
  }

  /**
   * Fetch episodes for an anime using AniList ID
   * GET /anime/episodes/{anilist_id}
   */
  async fetchEpisodes(id) {
    const anilistId = String(id).trim();
    const cacheKey = `eps-${anilistId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
      return cached.data;
    }

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/anime/episodes/${encodeURIComponent(anilistId)}`;
    console.log(`[KuhiAnimeProvider] Fetching episodes for AniList ID ${anilistId} from ${url}`);

    try {
      const res = await axios.get(url, {
        timeout: 8000, // fast timeout so we fall back cleanly to AniList metadata if Render is slow
        headers: {
          "Accept": "application/json",
          "User-Agent": "StreamX-Backend/2.0"
        }
      });

      const data = res.data;
      if (data && data.providers && Object.keys(data.providers).length > 0) {
        const providers = data.providers;
        const providerKeys = Object.keys(providers);
        const preferredOrder = ["anibd", "animegg", "aniwaves", "anikoto"];
        let selectedProviderKey = preferredOrder.find(k => providers[k]?.episodes?.sub?.length > 0);
        if (!selectedProviderKey) {
          selectedProviderKey = providerKeys.find(k => providers[k]?.episodes?.sub?.length > 0 || providers[k]?.episodes?.dub?.length > 0) || providerKeys[0];
        }

        const chosen = providers[selectedProviderKey]?.episodes || {};
        const subList = chosen.sub || [];
        const dubList = chosen.dub || [];
        const dubMap = new Map();
        dubList.forEach(d => dubMap.set(d.number, d));

        const episodeSourceList = subList.length > 0 ? subList : dubList;
        if (episodeSourceList && episodeSourceList.length > 0) {
          const normalizedEpisodes = episodeSourceList.map(ep => {
            const epNum = ep.number || parseInt(ep.sourceNumber, 10) || 1;
            return {
              id: ep.id || String(epNum),
              episode_number: epNum,
              title: ep.title || `Episode ${epNum}`,
              overview: ep.description || "",
              still: ep.image || "",
              air_date: ep.airDate || "",
              filler: ep.filler || false,
              duration: ep.duration || null,
              hasSub: subList.some(s => s.number === epNum),
              hasDub: dubMap.has(epNum)
            };
          });

          // Sort by episode number ascending
          normalizedEpisodes.sort((a, b) => a.episode_number - b.episode_number);

          const result = {
            provider: "kuhi",
            episodes: normalizedEpisodes
          };

          this.cache.set(cacheKey, { data: result, ts: Date.now() });
          return result;
        }
      }
    } catch (err) {
      console.warn(`[KuhiAnimeProvider] Render episodes API failed for ${anilistId}:`, err.message);
    }

    // Robust Fallback: Resolve episodes using AniList Metadata Provider
    console.log(`[KuhiAnimeProvider] Falling back to AniList Metadata Provider for AniList ID ${anilistId}...`);
    try {
      const metadataProvider = registry.get("anime", "metadata");
      const details = await metadataProvider.fetchDetails(anilistId, "anime");
      if (details && details.episodes_list && details.episodes_list.length > 0) {
        const normalizedEpisodes = details.episodes_list.map(ep => ({
          id: String(ep.episode_number),
          episode_number: ep.episode_number,
          title: ep.name || `Episode ${ep.episode_number}`,
          overview: ep.overview || "",
          still: ep.still || "",
          air_date: ep.air_date || "",
          filler: false
        }));

        const result = {
          provider: "kuhi",
          episodes: normalizedEpisodes
        };

        this.cache.set(cacheKey, { data: result, ts: Date.now() });
        return result;
      }
    } catch (fallbackErr) {
      console.error(`[KuhiAnimeProvider] Metadata fallback also failed for ${anilistId}:`, fallbackErr.message);
    }

    throw new Error(`Failed to load episodes for anime ${anilistId}`);
  }

  /**
   * Resolve variant M3U8 if the provided URL is a master playlist (#EXT-X-STREAM-INF)
   */
  async _resolveHlsVariant(originalUrl, referer) {
    if (!originalUrl || typeof originalUrl !== "string") return originalUrl;
    try {
      const res = await axios.get(originalUrl, {
        headers: {
          "Referer": referer || "",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 6000
      });
      const text = typeof res.data === "string" ? res.data : "";
      if (text.includes("#EXT-X-STREAM-INF")) {
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
            const nextLine = lines[i + 1]?.trim();
            if (nextLine && !nextLine.startsWith("#")) {
              const resolved = new URL(nextLine, originalUrl).href;
              console.log(`[KuhiAnimeProvider] Resolved master playlist to variant: ${resolved}`);
              return resolved;
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[KuhiAnimeProvider] Variant resolution note: ${err.message}`);
    }
    return originalUrl;
  }

  /**
   * Fetch stream sources for an episode
   * GET /anime/extract/{query}?e={number}&type={sub|dub}&provider={provider}
   */
  async fetchEpisodeSources(episodeId, animeId, options = {}) {
    const { animeId: resolvedAnimeId, episodeNumber } = this._parseEpisodeParams(episodeId, animeId);
    if (!resolvedAnimeId) {
      throw new Error(`Cannot resolve sources: animeId is missing for episode ${episodeId}`);
    }

    const requestedAudio = (options.type || options.audio || "sub").toLowerCase();
    const providerKey = options.provider || "default";
    const cacheKey = `src-${resolvedAnimeId}-${episodeNumber}-${providerKey}-${requestedAudio}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      return cached.data;
    }

    const baseUrl = getBaseUrl();
    console.log(`[KuhiAnimeProvider] Extracting sources for anime ${resolvedAnimeId} Episode ${episodeNumber} (${requestedAudio.toUpperCase()})...`);

    // Prioritize providers proven to work fast and reliably on Render
    const providersToTry = options.provider 
      ? [options.provider, "aniwaves", "animegg"]
      : ["aniwaves", "animegg", null];
    const uniqueProviders = [...new Set(providersToTry)];

    let audioResult = null;
    for (const prov of uniqueProviders) {
      try {
        console.log(`[KuhiAnimeProvider] Extracting ${requestedAudio} via provider "${prov || 'auto'}"...`);
        const params = { e: episodeNumber, type: requestedAudio };
        if (prov) params.provider = prov;
        const res = await axios.get(`${baseUrl}/anime/extract/${encodeURIComponent(resolvedAnimeId)}`, {
          params,
          timeout: 20000,
          headers: { "Accept": "application/json", "User-Agent": "StreamX-Backend/2.0" }
        });
        if (res.data && Array.isArray(res.data.streams) && res.data.streams.length > 0) {
          console.log(`[KuhiAnimeProvider] Provider "${prov || 'auto'}" succeeded for ${requestedAudio} with ${res.data.streams.length} stream(s)`);
          audioResult = {
            provider: res.data.provider || prov || "server2",
            streams: res.data.streams.map(s => ({ ...s, audio: requestedAudio, server: s.server || prov || "Kuhi" })),
            subtitles: Array.isArray(res.data.subtitles) ? res.data.subtitles : []
          };
          break;
        }
      } catch (err) {
        console.warn(`[KuhiAnimeProvider] Provider "${prov || 'auto'}" for ${requestedAudio} failed:`, err.message);
      }
    }

    if (!audioResult || !audioResult.streams || audioResult.streams.length === 0) {
      console.log(`[KuhiAnimeProvider] No streams found for ${requestedAudio} on anime ${resolvedAnimeId} Ep ${episodeNumber}`);
      const emptyResult = {
        headers: {},
        sources: [],
        subtitles: [],
        provider: "server2"
      };
      this.cache.set(cacheKey, { data: emptyResult, ts: Date.now() });
      return emptyResult;
    }

    const allNormalizedSources = [];
    const allSubtitles = [];
    let primaryReferer = "https://playeng.animeapps.top/";
    const groupLabel = requestedAudio.toUpperCase(); // "SUB" or "DUB"

    // Categorize streams: prefer direct HLS or MP4, fallback to embed
    const hlsOrMp4 = audioResult.streams.find(s => s.type === "hls" || s.type === "mp4" || s.url?.includes(".m3u8") || s.url?.includes(".mp4"));
    const embed = audioResult.streams.find(s => s.type === "embed" || s.url?.includes("/embed") || s.url?.includes("/e/"));

    const chosen = [];
    if (hlsOrMp4) chosen.push({ stream: hlsOrMp4, isPrimary: true });
    if (embed && embed !== hlsOrMp4 && !embed.url?.includes("play.echovideo.ru")) {
      chosen.push({ stream: embed, isPrimary: !hlsOrMp4 });
    }

    if (chosen.length === 0) {
      audioResult.streams.slice(0, 2).forEach((s, idx) => {
        chosen.push({ stream: s, isPrimary: idx === 0 });
      });
    }

    for (const item of chosen) {
      const s = item.stream;
      const ref = s.referer || primaryReferer;
      if (s.referer) primaryReferer = s.referer;

      const isM3U8 = s.type === "hls" || s.url?.includes(".m3u8");
      const isMP4 = s.type === "mp4" || s.url?.includes(".mp4");
      const isEmbed = s.type === "embed" || (!isM3U8 && !isMP4);

      let playUrl = s.url;
      if (isM3U8) {
        const variantUrl = await this._resolveHlsVariant(s.url, ref);
        playUrl = `${baseUrl}/proxy_m3u8?url=${encodeURIComponent(variantUrl)}&referer=${encodeURIComponent(ref)}`;
      }

      const qual = item.isPrimary ? groupLabel : `${groupLabel} (Embed)`;

      allNormalizedSources.push({
        url: playUrl,
        quality: qual,
        isEmbed: isEmbed,
        isM3U8: isM3U8,
        server: s.server || audioResult.provider,
        audio: requestedAudio,
        priority: item.isPrimary ? 1 : 2
      });
    }

    if (audioResult.subtitles && audioResult.subtitles.length > 0) {
      audioResult.subtitles.forEach(sub => {
        allSubtitles.push({
          url: sub.url,
          lang: sub.lang || sub.label || "English"
        });
      });
    }

    const responseData = {
      headers: {
        "Referer": primaryReferer,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      sources: allNormalizedSources,
      subtitles: allSubtitles,
      provider: "server2"
    };

    this.cache.set(cacheKey, { data: responseData, ts: Date.now() });
    return responseData;
  }
}

/**
 * KuhiMetadataProvider - Metadata Provider for Render Anime API
 */
export class KuhiMetadataProvider extends MetadataProvider {
  constructor(name = "kuhi") {
    super(name);
    this.cache = new Map();
  }

  /**
   * Search anime
   * GET /anime/search?query={q}&page={page}&per_page={perPage}
   */
  async fetchSearch(query, page = 1, perPage = 20) {
    if (!query || !query.trim()) {
      return { page: 1, total_pages: 1, total_results: 0, results: [] };
    }

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/anime/search`;
    console.log(`[KuhiAnimeProvider] Searching anime: "${query}" (page ${page})`);

    try {
      const res = await axios.get(url, {
        params: {
          query: query.trim(),
          page: page,
          per_page: perPage
        },
        timeout: TIMEOUT_MS,
        headers: { "Accept": "application/json", "User-Agent": "StreamX-Backend/2.0" }
      });

      const data = res.data || {};
      const rawResults = data.results || [];
      const normalizedResults = rawResults.map(item => mapAniListMedia(item, "anime")).filter(Boolean);
      const total = data.total || normalizedResults.length;
      const totalPages = Math.ceil(total / perPage) || 1;

      return {
        page: data.page || page,
        total_pages: totalPages,
        total_results: total,
        results: normalizedResults
      };
    } catch (err) {
      console.warn(`[KuhiAnimeProvider] search failed for "${query}":`, err.message);
      throw err;
    }
  }

  /**
   * Fetch anime details by AniList ID
   * GET /anime/info/{anilist_id}
   */
  async fetchDetails(id, mediaType = "anime") {
    const anilistId = String(id).trim();
    const cacheKey = `info-${anilistId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 30 * 60 * 1000) {
      return cached.data;
    }

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/anime/info/${encodeURIComponent(anilistId)}`;
    console.log(`[KuhiAnimeProvider] Fetching details for AniList ID ${anilistId}`);

    try {
      const res = await axios.get(url, {
        timeout: TIMEOUT_MS,
        headers: { "Accept": "application/json", "User-Agent": "StreamX-Backend/2.0" }
      });

      const raw = res.data;
      if (!raw || !raw.id) {
        throw new Error(`Anime not found: ${anilistId}`);
      }

      const normalized = mapAniListDetails(raw, mediaType);
      this.cache.set(cacheKey, { data: normalized, ts: Date.now() });
      return normalized;
    } catch (err) {
      console.warn(`[KuhiAnimeProvider] details failed for ${anilistId}:`, err.message);
      throw err;
    }
  }
}
