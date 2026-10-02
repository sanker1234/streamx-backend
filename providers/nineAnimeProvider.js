// streamx-backend/providers/nineAnimeProvider.js
import axios from "axios";
import { EpisodeProvider } from "./base/EpisodeProvider.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registry } from "./providerRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mappingsPath = path.resolve(__dirname, "../config/nineanime_mappings.json");

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

export class NineAnimeScraperProvider extends EpisodeProvider {
  constructor(name = "nineanime") {
    super(name);
    this.cache = new Map(); // slug -> { episodes, ts }
  }

  _normalizeTitle(t) {
    if (!t) return "";
    return t
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Search 9anime.org.lv for a query string.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async search(query) {
    if (!query) return [];
    console.log(`[9Anime Scraper] Searching for: "${query}"`);
    try {
      const res = await axios.get(`https://9anime.org.lv/?s=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 10000
      });
      let html = res.data;
      // Isolate search results content from sidebar/footer noise
      const sidebarIndex = html.indexOf('<div id="sidebar">');
      if (sidebarIndex !== -1) {
        html = html.substring(0, sidebarIndex);
      }

      const linkRegex = /href="(https:\/\/9anime\.org\.lv\/anime\/([a-z0-9-]+)\/?)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      const results = [];
      const seen = new Set();

      while ((match = linkRegex.exec(html)) !== null) {
        const url = match[1];
        const slug = match[2];
        const innerHTML = match[3];

        // Use clean title attribute if present, otherwise parse inner text as fallback
        const titleAttrMatch = match[0].match(/title="([^"]+)"/i);
        let titleText = "";
        if (titleAttrMatch) {
          titleText = titleAttrMatch[1];
        } else {
          const rawText = innerHTML.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          titleText = rawText.split("  ").map(s => s.trim()).filter(Boolean).pop() || rawText.split(" ").pop();
        }

        if (slug && titleText && !seen.has(slug)) {
          seen.add(slug);
          results.push({
            id: slug,
            title: titleText,
            url: url
          });
        }
      }
      return results;
    } catch (err) {
      console.warn(`[9Anime Scraper] Search failed for "${query}":`, err.message);
      return [];
    }
  }

  /**
   * Resolves AniList ID to 9Anime anime slug.
   * Uses persistent mappings cache file first, otherwise maps using search titles.
   * @param {string|number} id
   * @returns {Promise<string>}
   */
  async getAnime(id) {
    const aniIdStr = String(id);
    if (fs.existsSync(mappingsPath)) {
      try {
        const mappings = JSON.parse(fs.readFileSync(mappingsPath, "utf-8"));
        if (mappings[aniIdStr]) {
          return mappings[aniIdStr];
        }
      } catch (err) {
        console.error("[9Anime Scraper] Failed to read mappings file:", err.message);
      }
    }

    console.log(`[9Anime Scraper] Cache miss for AniList ID ${aniIdStr}. Searching title...`);

    let targetMetadata;
    try {
      const metadataProvider = registry.get("anime", "metadata");
      targetMetadata = await metadataProvider.fetchDetails(id);
    } catch (err) {
      console.warn(`[9Anime Scraper] Failed to fetch AniList details for ${aniIdStr}:`, err.message);
    }

    if (!targetMetadata) {
      throw new Error(`Failed to resolve metadata for AniList ID ${aniIdStr} to map to 9Anime.`);
    }

    // Determine target titles
    const searchTerms = new Set();
    if (targetMetadata.titles?.english) searchTerms.add(targetMetadata.titles.english);
    if (targetMetadata.titles?.romaji) searchTerms.add(targetMetadata.titles.romaji);
    if (targetMetadata.titles?.userPreferred) searchTerms.add(targetMetadata.titles.userPreferred);
    if (targetMetadata.titles?.native) searchTerms.add(targetMetadata.titles.native);
    if (targetMetadata.title) {
      if (typeof targetMetadata.title === "string") searchTerms.add(targetMetadata.title);
      else {
        if (targetMetadata.title.english) searchTerms.add(targetMetadata.title.english);
        if (targetMetadata.title.romaji) searchTerms.add(targetMetadata.title.romaji);
        if (targetMetadata.title.native) searchTerms.add(targetMetadata.title.native);
      }
    }
    if (targetMetadata.synonyms) {
      targetMetadata.synonyms.forEach(syn => {
        if (syn && syn.length > 3) {
          searchTerms.add(syn);
        }
      });
    }

    // Query synonyms of relations to discover hidden English names
    const targetSeason = parseSearchQuery(targetMetadata.titles?.romaji || targetMetadata.titles?.userPreferred || "").seasonNum;
    if (targetMetadata.relations && targetMetadata.relations.length > 0) {
      const relationIdsToQuery = targetMetadata.relations
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
          console.warn(`[9Anime Scraper] Failed to fetch relation details for ID ${relId}:`, e.message);
        }
      }
    }

    // Run search
    const candidatesMap = new Map();
    for (const term of searchTerms) {
      const results = await this.search(term);
      for (const item of results) {
        candidatesMap.set(item.id, item);
      }
    }

    const candidates = Array.from(candidatesMap.values());
    if (candidates.length === 0) {
      throw new Error(`Anime with AniList ID ${aniIdStr} was not found on 9Anime site.`);
    }

    // Score candidates
    const targetNorms = [];
    if (targetMetadata.titles?.english) targetNorms.push(this._normalizeTitle(targetMetadata.titles.english));
    if (targetMetadata.titles?.romaji) targetNorms.push(this._normalizeTitle(targetMetadata.titles.romaji));
    if (targetMetadata.titles?.userPreferred) targetNorms.push(this._normalizeTitle(targetMetadata.titles.userPreferred));
    if (targetMetadata.titles?.native) targetNorms.push(this._normalizeTitle(targetMetadata.titles.native));
    for (const term of searchTerms) {
      targetNorms.push(this._normalizeTitle(term));
    }

    const scoredCandidates = candidates.map(cand => {
      let bestScore = 0;
      const slugNorm = this._normalizeTitle(cand.id.replace(/-/g, " "));
      
      let cleanTitle = cand.title.replace(/\s+/g, " ").trim();
      if (cand.title.includes("Completed") || cand.title.includes("Ongoing") || cand.title.includes("ONA") || cand.title.includes("Sub") || cand.title.includes("Dub")) {
        const parts = cand.title.replace(/\s+/g, " ").split(" ");
        const halfLen = Math.floor(parts.length / 2);
        const firstHalf = parts.slice(0, halfLen).join(" ");
        const secondHalf = parts.slice(halfLen).join(" ");
        if (firstHalf.toLowerCase().includes(secondHalf.toLowerCase().substring(0, 10)) || 
            secondHalf.toLowerCase().includes(firstHalf.toLowerCase().substring(0, 10))) {
          cleanTitle = secondHalf;
        }
      }
      const titleNorm = this._normalizeTitle(cleanTitle);
      const candNorms = [slugNorm, titleNorm].filter(Boolean);


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

    if (scoredCandidates.length === 0 || scoredCandidates[0].score < 40) {
      throw new Error(`No reliable match found on 9Anime for title: "${targetMetadata.titles?.english || targetMetadata.titles?.romaji}"`);
    }

    const bestSlug = scoredCandidates[0].id;

    // Cache slug mapping
    let currentMappings = {};
    if (fs.existsSync(mappingsPath)) {
      try {
        currentMappings = JSON.parse(fs.readFileSync(mappingsPath, "utf-8"));
      } catch (e) {}
    }
    currentMappings[aniIdStr] = bestSlug;
    try {
      fs.writeFileSync(mappingsPath, JSON.stringify(currentMappings, null, 2), "utf-8");
      console.log(`[9Anime Scraper] Saved mapping: AniList ${aniIdStr} -> 9Anime Slug ${bestSlug}`);
    } catch (err) {
      console.error("[9Anime Scraper] Failed to write mappings file:", err.message);
    }

    return bestSlug;
  }

  /**
   * Fetches episodes list for AniList ID.
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async getEpisodes(id) {
    const slug = await this.getAnime(id);
    const now = Date.now();
    const cached = this.cache.get(slug);
    if (cached && now - cached.ts < 600000) { // 10m cache
      return cached.episodes;
    }

    console.log(`[9Anime Scraper] Fetching episodes for slug "${slug}"...`);
    try {
      const res = await axios.get(`https://9anime.org.lv/anime/${slug}/`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 10000
      });
      const html = res.data;

      // Extract episode links scoped strictly to target slug (ignoring year suffix if any) to avoid sidebar leaks
      const matchedSlug = slug.replace(/-\d{4}$/, '');
      const escapedSlug = matchedSlug.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const epRegex = new RegExp(`href="(https?:\\/\\/9anime\\.org\\.lv\\/${escapedSlug}-episode-(\\d+)\\/?)"`, "gi");
      let match;
      const episodesMap = new Map();

      while ((match = epRegex.exec(html)) !== null) {
        const url = match[1];
        const epNum = parseInt(match[2]);
        if (!episodesMap.has(epNum)) {
          episodesMap.set(epNum, {
            id: url,
            episode_number: epNum,
            title: `Episode ${epNum}`,
            overview: "",
            still: "",
            air_date: ""
          });
        }
      }

      const episodes = Array.from(episodesMap.values());
      // Sort episodes numerically (ascending)
      episodes.sort((a, b) => a.episode_number - b.episode_number);

      console.log(`[9Anime Scraper] Found ${episodes.length} episodes for ${slug}`);

      const result = {
        provider: "nineanime",
        episodes: episodes
      };

      this.cache.set(slug, { episodes: result, ts: now });
      return result;
    } catch (err) {
      console.error(`[9Anime Scraper] Failed to fetch episodes for ${slug}:`, err.message);
      throw err;
    }
  }

  /**
   * Extracts player stream sources from an episode URL.
   * @param {string} episodeId - the absolute URL of the episode page
   * @returns {Promise<Object>}
   */
  async getSources(episodeId) {
    console.log(`[9Anime Scraper] Getting sources from episode page: ${episodeId}`);
    try {
      const res = await axios.get(episodeId, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 10000
      });
      const html = res.data;

      const sources = [];

      // Find standard iframe src URL
      const iframeRegex = /<iframe[^>]+src="([^"]+)"/gi;
      let match;
      while ((match = iframeRegex.exec(html)) !== null) {
        const url = match[1].replace(/&#038;/g, "&");
        const lowerUrl = url.toLowerCase();
        
        // Skip obvious widgets and ads
        if (lowerUrl.includes("facebook.com") || lowerUrl.includes("twitter.com") || lowerUrl.includes("disqus") || lowerUrl.includes("google") || lowerUrl.includes("captcha") || lowerUrl.includes("ads") || lowerUrl.includes("analytics")) {
          continue;
        }

        sources.push({
          url: url.startsWith("//") ? `https:${url}` : url,
          quality: "Embed Player",
          isEmbed: true
        });
        break;
      }

      if (sources.length === 0) {
        throw new Error("No player embeds found for this episode on 9Anime.");
      }

      return {
        headers: {
          "Referer": "https://9anime.org.lv/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        sources: sources,
        subtitles: []
      };
    } catch (err) {
      console.error(`[9Anime Scraper] Failed to get sources for ${episodeId}:`, err.message);
      throw err;
    }
  }

  // EpisodeProvider compatibility
  async fetchEpisodes(id) {
    return this.getEpisodes(id);
  }

  async fetchEpisodeSources(episodeId, animeId) {
    return this.getSources(episodeId);
  }
}
