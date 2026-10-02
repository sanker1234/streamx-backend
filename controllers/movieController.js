// streamx-backend/controllers/movieController.js
import { registry } from "../providers/providerRegistry.js";
import { providerStatus } from "../providers/serverVerifier.js";

const serverMapping = {
  videm: "videm",
  vidbolt: "vidbolt",
  codespecters: "codespecters",
  streamflizo: "streamflizo",
  cinesrc: "cinesrc",
  filmu: "filmu",
  vidcore: "vidcore",
  peachify: "peachify",
  netmirror: "netmirror",
  vidsrcsbs: "vidsrcsbs",
  smashystream: "smashystream",
  twoembed: "twoembed",
  embedmaster: "embedmaster",
  vidlink: "vidlink",
  // Legacy aliases for backward compatibility
  server1: "videm",
  server2: "vidbolt",
  server3: "codespecters",
  server4: "streamflizo"
};

const movieSourcesCache = new Map();

/**
 * GET /api/movie/sources/:media/:id
 * 
 * Query params:
 *   provider  — preferred provider key (default: videm)
 *   season    — season number (required for TV)
 *   episode   — episode number (required for TV)
 */
export async function getStreamingSources(req, res) {
  try {
    const { media, id } = req.params;
    const { provider, season, episode } = req.query;

    if (!id || !media) {
      return res.status(400).json({ success: false, error: "ID and media are required" });
    }

    const requestedServer = provider || "videm";
    const seasonVal = season ? parseInt(season) : undefined;
    const episodeVal = episode ? parseInt(episode) : undefined;

    // Cache Isolation key
    const cacheKey = `${media}-${id}-${requestedServer}-${seasonVal || ""}-${episodeVal || ""}`;
    if (movieSourcesCache.has(cacheKey)) {
      const cached = movieSourcesCache.get(cacheKey);
      if (Date.now() - cached.ts < 5 * 60 * 1000) { // 5 mins
        return res.json(cached.data);
      }
    }

    // Build the fallback chain
    const order = [
      "videm",
      "vidbolt",
      "codespecters",
      "streamflizo",
      "cinesrc",
      "filmu",
      "vidcore",
      "vidsrcsbs",
      "smashystream",
      "twoembed",
      "embedmaster"
    ];
    const priorityList = [requestedServer, ...order.filter(s => s !== requestedServer)];


    let resolvedSources = null;
    let resolvedServer = null;
    let lastError = null;

    for (const srv of priorityList) {
      const srvType = serverMapping[srv];
      if (!srvType) continue;

      // Check verifier state if it failed and is NOT the requested one
      const status = providerStatus[srvType];
      if (status && !status.available && srv !== requestedServer) {
        continue;
      }

      console.log(`[Movie Controller] Attempting to resolve ${media} sources using ${srv} (${srvType})...`);
      try {
        const providerInstance = registry.get(srvType, "streaming");
        const sources = await providerInstance.fetchStreamSources(id, {
          mediaType: media,
          season: seasonVal,
          episode: episodeVal
        });

        if (sources && (sources.embedUrl || (sources.sources && sources.sources.length > 0))) {
          resolvedSources = sources;
          resolvedServer = srv;
          break;
        }
      } catch (err) {
        console.warn(`[Movie Controller] Server ${srv} (${srvType}) failed:`, err.message);
        lastError = err;
      }
    }

    if (resolvedSources) {
      const responseData = {
        success: true,
        provider: resolvedServer, // Return the actual working server key transparently
        ...resolvedSources
      };
      console.log(`[Movie Controller] Successfully resolved ${media} sources via server: ${resolvedServer}`);
      movieSourcesCache.set(cacheKey, { data: responseData, ts: Date.now() });
      return res.json(responseData);
    }

    console.error(`[Movie Controller] All servers failed to resolve ${media} sources for ID ${id}`);
    return res.status(500).json({
      success: false,
      error: lastError ? lastError.message : "Failed to resolve sources across all servers"
    });
  } catch (err) {
    console.error("[Movie Controller] getStreamingSources failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
