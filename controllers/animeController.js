import { registry } from "../providers/providerRegistry.js";
import { providerStatus, getAvailableServersList } from "../providers/serverVerifier.js";

const serverMapping = {
  server1: { type: "anikoto", provider: "anikoto" },
  server2: { type: "megavid", provider: "megavid" },
  server3: { type: "vidcloud", provider: "vidcloud" },
  server4: { type: "zokoanime", provider: "zokoanime" },
  server5: { type: "anixo", provider: "anixo" },
  server6: { type: "vidnest", provider: "vidnest" },
  server7: { type: "vidsync", provider: "vidsync" },
  server8: { type: "aniembed", provider: "aniembed" },
  server9: { type: "vidbolt", provider: "vidbolt" },
  anikoto: { type: "anikoto", provider: "anikoto" },
  megavid: { type: "megavid", provider: "megavid" },
  vidcloud: { type: "vidcloud", provider: "vidcloud" },
  zokoanime: { type: "zokoanime", provider: "zokoanime" },
  anixo: { type: "anixo", provider: "anixo" },
  vidnest: { type: "vidnest", provider: "vidnest" },
  vidsync: { type: "vidsync", provider: "vidsync" },
  anilink: { type: "anilink", provider: "anilink" },
  aniembed: { type: "aniembed", provider: "aniembed" },
  vidbolt: { type: "vidbolt", provider: "vidbolt" }
};

const detailsCache = new Map();
const episodesCache = new Map();
const sourcesCache = new Map();

function getProvider() {
  return registry.get("anime", "metadata");
}

/**
 * GET /api/anime/trending
 */
export async function getTrending(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const origin = req.query.origin;
    const data = await getProvider().fetchList({
      page,
      sort: ["TRENDING_DESC", "POPULARITY_DESC"],
      countryOfOrigin: origin
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/anime/popular
 */
export async function getPopular(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const origin = req.query.origin;
    const sort = req.query.sort ? [req.query.sort] : ["POPULARITY_DESC"];
    const data = await getProvider().fetchList({
      page,
      sort,
      countryOfOrigin: origin
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/anime/upcoming
 */
export async function getUpcoming(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const origin = req.query.origin;
    const data = await getProvider().fetchList({
      page,
      sort: ["POPULARITY_DESC"],
      status: "NOT_YET_RELEASED",
      countryOfOrigin: origin
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/anime/airing
 */
export async function getAiring(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const origin = req.query.origin;
    const data = await getProvider().fetchList({
      page,
      sort: ["POPULARITY_DESC"],
      status: "RELEASING",
      countryOfOrigin: origin
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/anime/search?query=...
 */
export async function getSearch(req, res) {
  try {
    const query = req.query.query || req.query.q || "";
    const page = parseInt(req.query.page) || 1;
    const data = await getProvider().fetchSearch(query, page);
    return res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/anime/details/:id
 */
export async function getDetails(req, res) {
  try {
    const id = req.params.id;
    const mediaType = req.query.media || "anime";
    const cacheKey = `${id}-${mediaType}`;

    if (detailsCache.has(cacheKey)) {
      const cached = detailsCache.get(cacheKey);
      if (Date.now() - cached.ts < 30 * 60 * 1000) { // 30 mins
        return res.json(cached.data);
      }
    }

    const data = await getProvider().fetchDetails(id, mediaType);
    if (!data) {
      return res.status(404).json({ success: false, error: "Anime not found" });
    }
    detailsCache.set(cacheKey, { data, ts: Date.now() });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/anime/episodes/:id
 */
export async function getEpisodes(req, res) {
  const id = req.params.id;
  const explicitProvider = req.query.provider ? req.query.provider.toLowerCase().trim() : null;
  const isExplicit = Boolean(explicitProvider && explicitProvider !== "auto" && explicitProvider !== "default");
  const requestedServer = isExplicit ? explicitProvider : "server1";
  console.log(`[Anime] Requested provider for episodes: ${requestedServer} (explicit: ${isExplicit})`);

  const cacheKey = `${id}-${requestedServer}`;
  if (episodesCache.has(cacheKey)) {
    const cached = episodesCache.get(cacheKey);
    if (Date.now() - cached.ts < 10 * 60 * 1000) { // 10 mins
      return res.json(cached.data);
    }
  }

  // Active episodes provider: Server 1 (Anikoto) provides standard episode list and mapping
  const order = ["server1"];
  const priorityList = isExplicit && serverMapping[requestedServer]?.type === "anikoto" ? [requestedServer] : order;

  let resolvedEpisodes = null;
  let resolvedProvider = null;
  let lastError = null;

  for (const srv of priorityList) {
    console.log(`[Episodes Controller] Fetching episode list for AniList ID ${id} using ${srv}...`);
    try {
      const providerInstance = registry.get("anikoto", "episodes");
      const data = await providerInstance.fetchEpisodes(id);

      if (data && data.episodes && data.episodes.length > 0) {
        resolvedEpisodes = data.episodes;
        resolvedProvider = srv;
        break;
      }
    } catch (err) {
      console.warn(`[Episodes Controller] Server ${srv} episode list fetch failed for AniList ID ${id}: ${err.message}`);
      lastError = err;
    }
  }

  const availableServers = getAvailableServersList();
  if (resolvedEpisodes) {
    const responseData = {
      provider: requestedServer || "server1",
      episodes: resolvedEpisodes,
      availableServers
    };
    const resolvedCacheKey = `${id}-${requestedServer || "server1"}`;
    episodesCache.set(resolvedCacheKey, { data: responseData, ts: Date.now() });
    return res.json(responseData);
  }

  console.error(`[Episodes Controller] Server ${requestedServer} failed to resolve episodes for AniList ID ${id}.`);
  return res.status(502).json({
    success: false,
    provider: requestedServer,
    episodes: [],
    availableServers,
    error: `Server ${requestedServer} failed to resolve episodes: ${lastError ? lastError.message : "Episodes not found"}`
  });
}

/**
 * Resolves episode identifier to a standard episode number
 */
async function resolveEpisodeNumber(animeId, episodeId) {
  const parsed = parseInt(episodeId);
  if (!isNaN(parsed) && parsed > 0 && parsed < 2000 && String(parsed) === String(episodeId)) {
    return parsed;
  }

  console.log(`[Episode Resolver] Mapping episodeId "${episodeId}" to episode number for animeId ${animeId}...`);

  for (const key of episodesCache.keys()) {
    if (key.startsWith(`${animeId}-`)) {
      const cached = episodesCache.get(key);
      if (cached && cached.data && cached.data.episodes) {
        const found = cached.data.episodes.find(e => String(e.id) === String(episodeId) || e.episode_number === parsed);
        if (found) {
          return found.episode_number;
        }
      }
    }
  }

  try {
    const anikotoInstance = registry.get("anikoto", "episodes");
    const data = await anikotoInstance.fetchEpisodes(animeId);
    if (data && data.episodes) {
      const found = data.episodes.find(e => String(e.id) === String(episodeId) || e.episode_number === parsed);
      if (found) {
        return found.episode_number;
      }
    }
  } catch (e) {
    console.warn("[Episode Resolver] Anikoto fetch mapping fallback failed:", e.message);
  }

  return !isNaN(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * GET /api/anime/sources/:episodeId
 */
export async function getEpisodeSources(req, res) {
  const episodeId = req.params.episodeId;
  const animeId = req.query.animeId || null;
  const explicitProvider = req.query.provider ? req.query.provider.toLowerCase().trim() : null;
  const isExplicit = Boolean(explicitProvider && explicitProvider !== "auto" && explicitProvider !== "default");
  const requestedServer = isExplicit ? explicitProvider : "server1";
  const requestedAudio = (req.query.type || req.query.audio || "sub").toLowerCase();

  console.log(`[Anime Sources] Requested provider: ${requestedServer} (audio: ${requestedAudio})`);

  const cacheKey = `${episodeId}-${requestedServer}-${animeId}-${requestedAudio}`;
  if (sourcesCache.has(cacheKey)) {
    const cached = sourcesCache.get(cacheKey);
    if (Date.now() - cached.ts < 5 * 60 * 1000) { // 5 mins
      return res.json(cached.data);
    }
  }

  // Sequential server priority list
  const order = ["server1", "server2", "server3", "server4", "server5", "server6", "server7", "server8", "server9"];
  const priorityList = isExplicit ? [requestedServer] : order;

  let resolvedData = null;
  let resolvedServer = null;
  let lastError = null;

  for (const srv of priorityList) {
    const serverConf = serverMapping[srv];
    if (!serverConf) {
      lastError = new Error(`Unknown server: ${srv}`);
      continue;
    }

    const srvType = serverConf.type;
    const providerKey = serverConf.provider;
    const status = providerStatus[providerKey];

    if (!isExplicit && status && !status.available) {
      console.log(`[Sources Controller] Skipping server ${srv} in auto fallback chain due to unhealthy status: ${status.errorType}`);
      continue;
    }

    console.log(`[Sources Controller] Resolving sources using ${srv} (provider: ${providerKey})...`);
    try {
      let data = null;

      if (srvType === "anikoto") {
        // Server 1 (Anikoto) - Preserved exactly
        const providerInstance = registry.get("anikoto", "episodes");
        data = await providerInstance.fetchEpisodeSources(episodeId, animeId);
        if (data) {
          data.provider = srv;
          data.supportedAudioModes = ["sub", "dub"];
        }
      } else if (["megavid", "vidcloud", "zokoanime", "anixo", "vidnest", "vidsync", "anilink", "aniembed", "vidbolt"].includes(srvType)) {
        // Embed Providers
        const providerInstance = registry.get(srvType, "episodes");
        const epNum = await resolveEpisodeNumber(animeId, episodeId);

        // Validate audio mode according to provider capabilities
        if (!providerInstance.supportedAudioModes.includes(requestedAudio)) {
          throw new Error(`UNSUPPORTED_AUDIO_MODE: ${providerInstance.displayName} does not support '${requestedAudio}'. Supported: ${providerInstance.supportedAudioModes.join(", ")}`);
        }

        const embedUrl = providerInstance.buildEmbedUrl({
          anilistId: animeId,
          episode: epNum,
          audio: requestedAudio,
          start: parseFloat(req.query.start) || 0,
          autoplay: req.query.autoplay !== "0",
          autoNext: req.query.autonext !== "0",
          autoSkip: req.query.autoskip !== "0"
        });

        data = {
          success: true,
          type: "embed",
          provider: srv,
          providerName: providerInstance.id,
          displayName: providerInstance.displayName,
          embedUrl,
          audio: requestedAudio,
          supportedAudioModes: providerInstance.supportedAudioModes,
          origin: providerInstance.origin,
          sources: [
            {
              url: embedUrl,
              quality: requestedAudio.toUpperCase(),
              isEmbed: true,
              audio: requestedAudio
            }
          ],
          subtitles: []
        };
      }

      if (data && (data.type === "embed" || (Array.isArray(data.sources) && data.sources.length > 0))) {
        resolvedData = data;
        resolvedServer = srv;
        break;
      }
    } catch (err) {
      console.warn(`[Sources Controller] Server ${srv} failed:`, err.message);
      lastError = err;
      if (isExplicit) {
        console.log(`[Anime Sources] Explicit provider ${requestedServer} failed. Returning clear error without silent provider switching.`);
        break;
      }
    }
  }

  if (resolvedData) {
    const finalData = {
      ...resolvedData,
      provider: resolvedServer
    };
    console.log(">>> Backend getEpisodeSources resolved source successfully via:", resolvedServer);
    sourcesCache.set(cacheKey, { data: finalData, ts: Date.now() });
    return res.json(finalData);
  }

  console.error(`[Sources Controller] Failed to resolve sources for ${episodeId} on ${requestedServer}:`, lastError ? lastError.message : "No stream available");

  return res.status(502).json({
    success: false,
    provider: requestedServer,
    sources: [],
    error: lastError ? lastError.message : `Failed to resolve stream on ${requestedServer}`
  });
}
