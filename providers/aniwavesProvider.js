import axios from "axios";
import { EpisodeProvider } from "./base/EpisodeProvider.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registry } from "./providerRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mappingsPath = path.resolve(__dirname, "../config/aniwaves_mappings.json");

export class AniwavesEpisodeProvider extends EpisodeProvider {
  constructor(name = "aniwaves") {
    super(name);
    this.cache = new Map(); // slug -> episodes data
  }

  _normalizeTitle(t) {
    if (!t) return "";
    return t
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async search(query) {
    if (!query) return [];
    console.log(`[Aniwaves Provider] Searching Aniwaves for: "${query}"`);
    try {
      const res = await axios.get(`https://aniwaves.ru/filter?keyword=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 10000
      });
      const html = res.data;

      const linkRegex = /<a class="name d-title" href="\/watch\/([a-z0-9-]+)"[^>]*>([^<]+)<\/a>/gi;
      let match;
      const results = [];
      const seen = new Set();

      while ((match = linkRegex.exec(html)) !== null) {
        const slug = match[1];
        const titleText = match[2].trim();
        if (slug && !seen.has(slug)) {
          seen.add(slug);
          results.push({ slug, title: titleText });
        }
      }
      return results;
    } catch (err) {
      console.warn(`[Aniwaves Provider] Search failed for "${query}":`, err.message);
      return [];
    }
  }

  async getAnime(id) {
    const aniIdStr = String(id);
    if (fs.existsSync(mappingsPath)) {
      try {
        const mappings = JSON.parse(fs.readFileSync(mappingsPath, "utf-8"));
        if (mappings[aniIdStr]) {
          return mappings[aniIdStr];
        }
      } catch (err) {
        console.error("[Aniwaves Provider] Failed to read mappings file:", err.message);
      }
    }

    console.log(`[Aniwaves Provider] Cache miss for AniList ID ${aniIdStr}. Searching title...`);

    let targetMetadata;
    try {
      const metadataProvider = registry.get("anime", "metadata");
      targetMetadata = await metadataProvider.fetchDetails(id);
    } catch (err) {
      console.warn(`[Aniwaves Provider] Failed to fetch AniList details:`, err.message);
    }

    if (!targetMetadata) {
      throw new Error(`Failed to resolve AniList metadata for ID ${aniIdStr}`);
    }

    const searchTerms = new Set();
    if (targetMetadata.titles?.english) searchTerms.add(targetMetadata.titles.english);
    if (targetMetadata.titles?.romaji) searchTerms.add(targetMetadata.titles.romaji);
    if (targetMetadata.titles?.userPreferred) searchTerms.add(targetMetadata.titles.userPreferred);
    if (targetMetadata.title) {
      if (typeof targetMetadata.title === "string") searchTerms.add(targetMetadata.title);
      else {
        if (targetMetadata.title.english) searchTerms.add(targetMetadata.title.english);
        if (targetMetadata.title.romaji) searchTerms.add(targetMetadata.title.romaji);
      }
    }

    const candidatesMap = new Map();
    for (const term of searchTerms) {
      const results = await this.search(term);
      for (const item of results) {
        candidatesMap.set(item.slug, item);
      }
    }

    const candidates = Array.from(candidatesMap.values());
    if (candidates.length === 0) {
      const slug = this._normalizeTitle(targetMetadata.titles?.romaji || targetMetadata.titles?.english || "").replace(/\s+/g, "-");
      if (slug) {
        return slug;
      }
      throw new Error(`Anime with AniList ID ${aniIdStr} was not found on Aniwaves.`);
    }

    const targetNorms = Array.from(searchTerms).map(t => this._normalizeTitle(t));
    const scored = candidates.map(cand => {
      let bestScore = 0;
      const titleNorm = this._normalizeTitle(cand.title);
      const slugNorm = this._normalizeTitle(cand.slug.replace(/-/g, " "));

      for (const tNorm of targetNorms) {
        if (tNorm === titleNorm || tNorm === slugNorm) {
          bestScore = 100;
        } else if (tNorm.includes(titleNorm) || titleNorm.includes(tNorm)) {
          bestScore = Math.max(bestScore, 80);
        }
      }
      return { ...cand, score: bestScore };
    });

    scored.sort((a, b) => b.score - a.score);
    const bestSlug = scored[0].slug;

    let currentMappings = {};
    if (fs.existsSync(mappingsPath)) {
      try {
        currentMappings = JSON.parse(fs.readFileSync(mappingsPath, "utf-8"));
      } catch (e) {}
    }
    currentMappings[aniIdStr] = bestSlug;
    try {
      fs.writeFileSync(mappingsPath, JSON.stringify(currentMappings, null, 2), "utf-8");
      console.log(`[Aniwaves Provider] Saved mapping: AniList ${aniIdStr} -> Aniwaves Slug ${bestSlug}`);
    } catch (err) {
      console.error("[Aniwaves Provider] Failed to write mappings:", err.message);
    }

    return bestSlug;
  }

  async fetchEpisodes(id) {
    const slug = await this.getAnime(id);
    const now = Date.now();
    const cached = this.cache.get(slug);
    if (cached && now - cached.ts < 10 * 60 * 1000) {
      return cached.data;
    }

    console.log(`[Aniwaves Provider] Fetching watch page for slug "${slug}" to resolve episode count...`);
    let totalEpisodes = 12; 
    let isDubAvailable = false;

    try {
      const res = await axios.get(`https://aniwaves.ru/watch/${slug}/ep-1`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 10000
      });
      const html = res.data;

      const numMatch = html.match(/"numberOfEpisodes":\s*(\d+)/i) || 
                       html.match(/Subbed episodes released.*?(\d+)/i) ||
                       html.match(/class="m-item".*?(\d+).*?Sub/i);
      if (numMatch) {
        totalEpisodes = parseInt(numMatch[1]);
      }

      if (html.includes('class="dub') || html.includes('Dub') || html.includes('fas fa-microphone')) {
        isDubAvailable = true;
      }
    } catch (err) {
      console.warn(`[Aniwaves Provider] Failed to fetch watch page for ${slug}, using default count:`, err.message);
    }

    const episodes = [];
    for (let i = 1; i <= totalEpisodes; i++) {
      episodes.push({
        id: String(i),
        episode_number: i,
        title: `Episode ${i}`,
        overview: "",
        still: "",
        air_date: ""
      });
    }

    const result = {
      provider: "aniwaves",
      episodes: episodes,
      isDubAvailable 
    };

    this.cache.set(slug, { data: result, ts: now });
    return result;
  }

  async fetchEpisodeSources(episodeId, animeId) {
    console.log(`[Aniwaves Provider] Resolving sources for episode ${episodeId} (animeId: ${animeId})`);
    const slug = await this.getAnime(animeId);

    let isDubAvailable = false;
    const cached = this.cache.get(slug);
    if (cached && cached.data) {
      isDubAvailable = cached.data.isDubAvailable;
    } else {
      try {
        const res = await axios.get(`https://aniwaves.ru/watch/${slug}/ep-1`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          timeout: 10000
        });
        const html = res.data;
        if (html.includes('class="dub') || html.includes('Dub') || html.includes('fas fa-microphone')) {
          isDubAvailable = true;
        }
      } catch (e) {}
    }

    const sources = [];
    const baseEmbedUrl = `https://aniwaves.ru/watch/${slug}/episode/${episodeId}`;

    sources.push({
      url: baseEmbedUrl,
      quality: "SUB",
      isEmbed: true
    });

    if (isDubAvailable) {
      sources.push({
        url: `${baseEmbedUrl}?audio=dub`,
        quality: "DUB",
        isEmbed: true
      });
    }

    return {
      headers: {
        "Referer": "https://aniwaves.ru/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      sources: sources,
      subtitles: []
    };
  }
}
