// streamx-backend/providers/consumetProvider.js
import axios from "axios";
import { EpisodeProvider } from "./base/EpisodeProvider.js";
import { registry } from "./providerRegistry.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const providersPath = path.resolve(__dirname, "../config/providers.json");
const mirrorsPath = path.resolve(__dirname, "../config/api_mirrors.json");

function getEnabledProviders() {
  try {
    const raw = fs.readFileSync(providersPath, "utf-8");
    const list = JSON.parse(raw);
    return list.filter(p => p.enabled).map(p => p.name);
  } catch (err) {
    console.error("Failed to read providers configuration, using defaults:", err.message);
    return ["miruro", "animepahe", "anikoto", "mkissa", "reanime"];
  }
}

function getMirrors() {
  try {
    const raw = fs.readFileSync(mirrorsPath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read API mirrors configuration, using defaults:", err.message);
    return ["http://localhost:4000"];
  }
}

export class ConsumetEpisodeProvider extends EpisodeProvider {
  constructor(name = "consumet") {
    super(name);
  }

  /**
   * Fetch episodes for a specific media item.
   * Loops through mirrors, and for each mirror, loops through configured providers.
   * Falls back to AniList Metadata if all scrapers fail to prevent HTTP 500.
   * @param {string|number} id - AniList ID
   * @param {string} [specifiedProvider=null]
   */
  async fetchEpisodes(id, specifiedProvider = null) {
    const mirrors = getMirrors();
    const providersToTry = specifiedProvider ? [specifiedProvider] : getEnabledProviders();
    let lastError = null;

    for (const mirrorUrl of mirrors) {
      console.log(`[ConsuMet Proxy] Attempting queries via mirror: ${mirrorUrl}`);
      for (const providerName of providersToTry) {
        console.log(`[ConsuMet Proxy] [${mirrorUrl}] Trying provider: ${providerName}...`);
        try {
          const url = `${mirrorUrl}/meta/anilist/info/${id}`;
          const response = await axios.get(url, {
            params: { provider: providerName },
            timeout: 3500,
          });

          const data = response.data;
          if (data && data.episodes && data.episodes.length > 0) {
            console.log(`[ConsuMet Proxy] SUCCESS! [${mirrorUrl}] Fetched ${data.episodes.length} episodes via ${providerName}`);

            const episodes = data.episodes.map(ep => ({
              id: ep.id,
              episode_number: ep.number,
              title: ep.title || `Episode ${ep.number}`,
              overview: ep.description || "",
              still: ep.image || "",
              air_date: ep.airDate || "",
              isFiller: ep.isFiller || false,
              duration: ep.duration || null,
            }));

            return {
              provider: providerName,
              episodes: episodes,
            };
          }
        } catch (err) {
          const errMsg = err.response && err.response.data && err.response.data.message
            ? err.response.data.message
            : (err.message || err.code || "Unknown error");
          console.warn(`[ConsuMet Proxy] [${mirrorUrl}] Provider '${providerName}' failed: ${errMsg}`);
          lastError = new Error(`[${mirrorUrl}] ${providerName}: ${errMsg}`);
        }
      }
    }

    // FALLBACK: If all scrapers failed, resolve the episode list from AniList Metadata Provider
    console.warn(`[ConsuMet Proxy] All scrapers failed. Falling back to AniList Metadata Provider to resolve episodes.`);
    try {
      const metadataProvider = registry.get("anime", "metadata");
      const details = await metadataProvider.fetchDetails(id, "anime");
      if (details && details.episodes_list && details.episodes_list.length > 0) {
        const titleSlug = (details.title.userPreferred || details.title.english || "anime")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        const episodes = details.episodes_list.map(ep => {
          const epId = `${titleSlug}-episode-${ep.episode_number}`;
          return {
            id: epId,
            episode_number: ep.episode_number,
            title: ep.name || `Episode ${ep.episode_number}`,
            overview: ep.overview || "",
            still: ep.still || "",
            air_date: ep.air_date || "",
          };
        });

        console.log(`[ConsuMet Proxy] Fallback success. Constructed ${episodes.length} episodes using AniList metadata.`);
        return {
          provider: "anilist_fallback",
          episodes: episodes,
        };
      }
    } catch (metaErr) {
      console.error("[ConsuMet Proxy] AniList metadata fallback failed:", metaErr.message);
    }

    const errorDetails = lastError ? lastError.message : "No active mirrors/providers";
    throw new Error(`Failed to fetch episodes across all mirrors. Last error: ${errorDetails}`);
  }

  /**
   * Fetch specific source information for an episode.
   * Loops through mirrors on failure to ensure reliable stream resolution.
   * @param {string} episodeId
   * @param {string} [providerName="miruro"]
   */
  async fetchEpisodeSources(episodeId, providerName = "miruro") {
    const mirrors = getMirrors();
    let lastError = null;

    for (const mirrorUrl of mirrors) {
      console.log(`[ConsuMet Proxy] Fetching sources for ${episodeId} via mirror: ${mirrorUrl} (provider: ${providerName})...`);
      try {
        const url = `${mirrorUrl}/meta/anilist/watch/${episodeId}`;
        const response = await axios.get(url, {
          params: { provider: providerName },
          timeout: 3500,
        });

        const data = response.data || {};
        if (data.sources && data.sources.length > 0) {
          console.log(`[ConsuMet Proxy] SUCCESS! [${mirrorUrl}] Resolved sources for ${episodeId} via ${providerName}`);
          return {
            headers: data.headers || {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            sources: data.sources.map(src => ({
              url: src.url,
              quality: src.quality || "auto",
              isM3U8: src.isM3U8 || src.url.includes(".m3u8"),
            })),
            subtitles: (data.subtitles || []).map(sub => ({
              url: sub.url,
              lang: sub.lang || sub.label || "English",
            })),
          };
        }
      } catch (err) {
        const errMsg = err.response && err.response.data && err.response.data.message
          ? err.response.data.message
          : (err.message || err.code || "Unknown error");
        console.warn(`[ConsuMet Proxy] [${mirrorUrl}] Source fetch failed: ${errMsg}`);
        lastError = new Error(`[${mirrorUrl}] ${errMsg}`);
      }
    }

    const errorDetails = lastError ? lastError.message : "No active mirrors";
    throw new Error(`Failed to fetch sources across all mirrors. Last error: ${errorDetails}`);
  }
}
