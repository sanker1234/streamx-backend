// streamx-backend/providers/anikotoProvider.js
import axios from "axios";
import { EpisodeProvider } from "./base/EpisodeProvider.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registry } from "./providerRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mappingsPath = path.resolve(__dirname, "../config/anikoto_mappings.json");

function parseSearchQuery(q) {
  if (!q) return { seasonNum: null };
  let baseQuery = q.toLowerCase();
  let seasonNum = null;
  const seasonPatterns = [
    /\bseason\s*(\d+)\b/i,
    /\bs(\d+)\b/i,
    /\bpart\s*(\d+)\b/i,
    /\bcour\s*(\d+)\b/i,
    /\b(\d+)th\s*season/i,
    /\b(\d+)\b/i
  ];
  for (const pattern of seasonPatterns) {
    const match = baseQuery.match(pattern);
    if (match) {
      seasonNum = parseInt(match[1]);
      break;
    }
  }
  return { seasonNum };
}

export class AnikotoEpisodeProvider extends EpisodeProvider {
  constructor(name = "anikoto") {
    super(name);
    this.cache = new Map(); // seriesId -> { data, ts, rawData }
  }

  _normalizeTitle(t) {
    if (!t) return "";
    return t
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async _searchAnikoto(query) {
    if (!query) return [];
    console.log(`[Anikoto Provider] Searching Anikoto for: "${query}"`);
    try {
      const res = await axios.get(`https://anikototv.to/search?keyword=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 10000
      });
      const html = res.data;
      const itemRegex = /data-tip="(\d+)"[^>]*>\s*<a href="([^"]+)"/g;
      let match;
      const results = [];
      while ((match = itemRegex.exec(html)) !== null) {
        const id = parseInt(match[1]);
        const href = match[2];
        const watchMatch = href.match(/\/watch\/([^/]+)/);
        const slug = watchMatch ? watchMatch[1] : "";

        const subHtml = html.substring(match.index, match.index + 2000);
        const titleMatch = subHtml.match(/class="name d-title"[^>]*href="[^"]*"[^>]*data-jp="([^"]*)"[^>]*>([^<]+)<\/a>/);
        const titleJp = titleMatch ? titleMatch[1].trim() : "";
        const titleEn = titleMatch ? titleMatch[2].trim() : "";

        results.push({ id, slug, titleEn, titleJp });
      }
      return results;
    } catch (err) {
      console.warn(`[Anikoto Provider] Search failed for "${query}":`, err.message);
      return [];
    }
  }

  async _mapAniListToAnikoto(aniId, target) {
    const searchTerms = new Set();
    if (target.titles?.english) searchTerms.add(target.titles.english);
    if (target.titles?.romaji) searchTerms.add(target.titles.romaji);
    if (target.titles?.userPreferred) searchTerms.add(target.titles.userPreferred);
    if (target.titles?.native) searchTerms.add(target.titles.native);
    if (target.title) {
      if (typeof target.title === "string") searchTerms.add(target.title);
      else {
        if (target.title.english) searchTerms.add(target.title.english);
        if (target.title.romaji) searchTerms.add(target.title.romaji);
        if (target.title.native) searchTerms.add(target.title.native);
      }
    }
    if (target.synonyms) {
      target.synonyms.forEach(syn => {
        if (syn && syn.length > 3) {
          searchTerms.add(syn);
        }
      });
    }

    // Query synonyms of relations to discover hidden English names
    const targetSeason = parseSearchQuery(target.titles?.romaji || target.titles?.userPreferred || "").seasonNum;
    if (target.relations && target.relations.length > 0) {
      const relationIdsToQuery = target.relations
        .filter(rel => ["PREQUEL", "SEQUEL"].includes(rel.relationType) && rel.id)
        .slice(0, 2)
        .map(rel => rel.id);

      for (const relId of relationIdsToQuery) {
        try {
          const metadataProvider = registry.get("anime", "metadata");
          const relMeta = await metadataProvider.fetchDetails(relId);
          if (relMeta) {
            const relTitles = [
              relMeta.titles?.english,
              relMeta.titles?.romaji,
              relMeta.titles?.userPreferred,
              ...(relMeta.synonyms || [])
            ].filter(Boolean);

            const parsedRel = parseSearchQuery(relMeta.titles?.romaji || relMeta.titles?.userPreferred || "");
            const relSeason = parsedRel.seasonNum;

            for (const t of relTitles) {
              const cleanT = t.trim();
              if (cleanT.length > 3) {
                searchTerms.add(cleanT);
                if (relSeason && targetSeason) {
                  const rx = new RegExp(`\\b${relSeason}\\b`, 'g');
                  const targetSynonym = cleanT.replace(rx, String(targetSeason));
                  if (targetSynonym !== cleanT) {
                    searchTerms.add(targetSynonym);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn(`[Anikoto Provider] Failed to fetch relation details for ID ${relId}:`, e.message);
        }
      }
    }

    const candidatesMap = new Map();
    for (const term of searchTerms) {
      const results = await this._searchAnikoto(term);
      for (const item of results) {
        candidatesMap.set(item.id, item);
      }
    }

    const candidates = Array.from(candidatesMap.values());
    if (candidates.length === 0) {
      console.log("[Anikoto Provider] No search candidates found on Anikoto TV site.");
      return null;
    }

    const targetNorms = [];
    if (target.titles?.english) targetNorms.push(this._normalizeTitle(target.titles.english));
    if (target.titles?.romaji) targetNorms.push(this._normalizeTitle(target.titles.romaji));
    if (target.titles?.userPreferred) targetNorms.push(this._normalizeTitle(target.titles.userPreferred));
    if (target.titles?.native) targetNorms.push(this._normalizeTitle(target.titles.native));
    for (const term of searchTerms) {
      targetNorms.push(this._normalizeTitle(term));
    }

    const scoredCandidates = candidates.map(cand => {
      let bestScore = 0;
      const candNorms = [
        this._normalizeTitle(cand.titleEn),
        this._normalizeTitle(cand.titleJp),
        this._normalizeTitle(cand.slug.replace(/-/g, " "))
      ];

      for (const tNorm of targetNorms) {
        if (!tNorm) continue;
        for (const cNorm of candNorms) {
          if (!cNorm) continue;
          
          if (tNorm === cNorm) {
            bestScore = Math.max(bestScore, 100);
          } else if (tNorm.includes(cNorm) || cNorm.includes(tNorm)) {
            const shorter = Math.min(tNorm.length, cNorm.length);
            const longer = Math.max(tNorm.length, cNorm.length);
            const score = 50 + (shorter / longer) * 40;
            bestScore = Math.max(bestScore, score);
          }
        }
      }

      return { ...cand, score: bestScore };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);

    // If the top candidate is an extremely strong title match, trust it directly to avoid incorrect mapping of recap specials in Anikoto's DB
    if (scoredCandidates.length > 0 && scoredCandidates[0].score >= 90) {
      const best = scoredCandidates[0];
      console.log(`[Anikoto Provider] Strong title-based match: ${best.titleEn} (ID: ${best.id}, score: ${best.score.toFixed(1)})`);
      return best.id;
    }

    // Verify candidate via API to see if ani_id matches exactly
    const candidatesToVerify = scoredCandidates.filter(c => c.score > 40).slice(0, 5);
    for (const cand of candidatesToVerify) {
      console.log(`[Anikoto Provider] Verifying candidate ${cand.titleEn} (ID: ${cand.id}) via API...`);
      try {
        const res = await axios.get(`https://anikotoapi.site/series/${cand.id}`, { timeout: 5000 });
        if (res.data && res.data.ok && res.data.data && res.data.data.anime) {
          const aniIdField = res.data.data.anime.ani_id;
          if (String(aniIdField) === String(aniId)) {
            console.log(`[Anikoto Provider] Exact AniList ID match: ${cand.id}`);
            return cand.id;
          }
        }
      } catch (err) {
        console.warn(`[Anikoto Provider] Failed to fetch series info for verification of ${cand.id}:`, err.message);
      }
    }


    // Fallback to title-based match if score is high enough (e.g. >= 80)
    if (scoredCandidates.length > 0 && scoredCandidates[0].score >= 80) {
      const best = scoredCandidates[0];
      console.log(`[Anikoto Provider] Fallback to title-based match: ${best.titleEn} (ID: ${best.id}, score: ${best.score.toFixed(1)})`);
      return best.id;
    }

    return null;
  }

  /**
   * Resolves AniList ID to Anikoto ID.
   * Checks local mappings file first, falls back to scanning recent-anime.
   */
  async getAnikotoId(aniId) {
    const aniIdStr = String(aniId);
    if (fs.existsSync(mappingsPath)) {
      try {
        const mappings = JSON.parse(fs.readFileSync(mappingsPath, "utf-8"));
        if (mappings[aniIdStr]) {
          return mappings[aniIdStr];
        }
      } catch (err) {
        console.error("Failed to read mappings file:", err.message);
      }
    }

    console.log(`[Anikoto Provider] Cache miss for AniList ID ${aniIdStr}. Searching Anikoto by title...`);
    
    // Fetch detailed metadata from AniList
    let targetMetadata;
    try {
      const metadataProvider = registry.get("anime", "metadata");
      targetMetadata = await metadataProvider.fetchDetails(aniId);
    } catch (err) {
      console.warn(`[Anikoto Provider] Failed to fetch AniList details for ${aniIdStr}:`, err.message);
    }

    if (!targetMetadata) {
      throw new Error(`Failed to resolve metadata for AniList ID ${aniIdStr} to start mapping.`);
    }

    // Resolve mapped ID
    const mappedId = await this._mapAniListToAnikoto(aniId, targetMetadata);
    if (!mappedId) {
      throw new Error(`Anime with AniList ID ${aniIdStr} is not available on Anikoto (mapping failed).`);
    }

    // Write to cache
    let currentMappings = {};
    if (fs.existsSync(mappingsPath)) {
      try {
        currentMappings = JSON.parse(fs.readFileSync(mappingsPath, "utf-8"));
      } catch (e) {}
    }
    currentMappings[aniIdStr] = mappedId;
    try {
      fs.writeFileSync(mappingsPath, JSON.stringify(currentMappings, null, 2), "utf-8");
      console.log(`[Anikoto Provider] Saved mapping: AniList ID ${aniIdStr} -> Anikoto ID ${mappedId}`);
    } catch (err) {
      console.error("[Anikoto Provider] Failed to write mappings cache file:", err.message);
    }

    return mappedId;
  }

  /**
   * Fetch episodes for a specific media item.
   * @param {string|number} id - AniList ID
   */
  async fetchEpisodes(id) {
    try {
      const seriesId = await this.getAnikotoId(id);

      const now = Date.now();
      const cached = this.cache.get(seriesId);
      if (cached && now - cached.ts < 600000) { // 10 minutes cache TTL
        console.log(`[Anikoto Provider] Serving episodes for series ${seriesId} from cache`);
        return cached.data;
      }

      console.log(`[Anikoto Provider] Fetching series details for series ID ${seriesId}...`);
      const res = await axios.get(`https://anikotoapi.site/series/${seriesId}`, { timeout: 10000 });
      if (!res.data || !res.data.ok || !res.data.data) {
        throw new Error("Invalid series response from Anikoto API");
      }

      const episodes = (res.data.data.episodes || []).map(ep => ({
        id: String(ep.id),
        episode_number: ep.number,
        title: ep.title || `Episode ${ep.number}`,
        overview: "",
        still: "",
        air_date: ep.updated_at || ""
      }));

      const result = {
        provider: "anikoto",
        episodes: episodes
      };

      this.cache.set(seriesId, { data: result, ts: now, rawData: res.data.data });
      return result;
    } catch (err) {
      console.error(`[Anikoto Provider] fetchEpisodes failed:`, err.message);
      if (err.response) {
        if (err.response.status === 429) {
          throw new Error("Anikoto API rate limit exceeded (429). Please wait a minute and retry.");
        }
        if (err.response.status === 403) {
          throw new Error("Anikoto API returned forbidden (403). Access blocked.");
        }
      }
      throw err;
    }
  }

  /**
   * Fetch specific source information for an episode.
   * @param {string} episodeId
   * @param {string} [animeId] - AniList ID passed from client to identify series
   */
  async fetchEpisodeSources(episodeId, animeId) {
    try {
      const epIdNum = parseInt(episodeId);
      let seriesId = null;

      if (animeId) {
        try {
          seriesId = await this.getAnikotoId(animeId);
        } catch (e) {
          console.warn(`[Anikoto Provider] Could not map animeId ${animeId} during sources fetch:`, e.message);
        }
      }

      let seriesData = null;

      if (seriesId) {
        const cached = this.cache.get(seriesId);
        if (cached) {
          seriesData = cached.rawData;
        } else {
          console.log(`[Anikoto Provider] Cache miss for series ${seriesId} during sources fetch. Fetching...`);
          const res = await axios.get(`https://anikotoapi.site/series/${seriesId}`, { timeout: 10000 });
          if (res.data && res.data.ok && res.data.data) {
            seriesData = res.data.data;
            const episodes = (seriesData.episodes || []).map(ep => ({
              id: String(ep.id),
              episode_number: ep.number,
              title: ep.title || `Episode ${ep.number}`,
              overview: "",
              still: "",
              air_date: ep.updated_at || ""
            }));
            this.cache.set(seriesId, {
              data: { provider: "anikoto", episodes },
              ts: Date.now(),
              rawData: seriesData
            });
          }
        }
      }

      // Check all cached entries if seriesData is still not found
      if (!seriesData) {
        for (const entry of this.cache.values()) {
          if (entry.rawData && entry.rawData.episodes) {
            const found = entry.rawData.episodes.find(ep => 
              ep.id === epIdNum || 
              String(ep.id) === String(episodeId) || 
              ep.number === epIdNum || 
              ep.episode_number === epIdNum
            );
            if (found) {
              seriesData = entry.rawData;
              break;
            }
          }
        }
      }

      if (!seriesData || !seriesData.episodes) {
        throw new Error("Episode details or series not found in cache. Load the episode list first.");
      }

      // Find episode by exact ID or by episode number
      const episode = seriesData.episodes.find(ep => 
        ep.id === epIdNum || 
        String(ep.id) === String(episodeId) || 
        ep.number === epIdNum || 
        ep.episode_number === epIdNum
      );
      if (!episode) {
        throw new Error(`Episode ${episodeId} not found in series.`);
      }

      const sources = [];
      const embedUrl = episode.embed_url || {};

      if (embedUrl.sub) {
        sources.push({
          url: embedUrl.sub,
          quality: "SUB",
          isEmbed: true
        });
      }

      if (embedUrl.dub) {
        sources.push({
          url: embedUrl.dub,
          quality: "DUB",
          isEmbed: true
        });
      }

      if (embedUrl.hsub) {
        sources.push({
          url: embedUrl.hsub,
          quality: "Hard SUB",
          isEmbed: true
        });
      }

      if (sources.length === 0) {
        throw new Error("No video embed links found for this episode.");
      }

      return {
        headers: {
          "Referer": "https://anikototv.to/",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        sources: sources,
        subtitles: []
      };
    } catch (err) {
      console.error(`[Anikoto Provider] fetchEpisodeSources failed:`, err.message);
      throw err;
    }
  }
}
