import axios from "axios";

const ANILIST_URL = "https://graphql.anilist.co";

// Reusable media fragment for GraphQL queries
const MEDIA_FRAGMENT = `
  id
  idMal
  title {
    romaji
    english
    native
    userPreferred
  }
  synonyms
  description
  startDate {
    year
    month
    day
  }
  averageScore
  popularity
  coverImage {
    extraLarge
    large
    medium
  }
  bannerImage
  genres
  episodes
  status
  format
  countryOfOrigin
`;

/**
 * Executes a query against the AniList GraphQL API
 */
async function queryAniList(query, variables = {}) {
  try {
    const response = await axios.post(
      ANILIST_URL,
      { query, variables },
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        timeout: 15000,
      }
    );

    // Surface GraphQL errors explicitly
    if (response.data?.errors) {
      const msg = response.data.errors[0]?.message || "AniList GraphQL error";
      console.error("AniList GraphQL errors:", response.data.errors);
      throw new Error(msg);
    }

    return response.data?.data;
  } catch (err) {
    if (err.response?.data?.errors) {
      const msg = err.response.data.errors[0]?.message || "AniList GraphQL error";
      console.error("AniList API error:", err.response.data.errors);
      throw new Error(msg);
    }
    console.error("AniList API Error:", err.message);
    throw new Error(err.message);
  }
}

/**
 * Maps a single AniList Media object to a TMDB-compatible format
 */
export function mapAniListMedia(item, mediaType = "anime") {
  if (!item) return null;
  const title = item.title?.english || item.title?.romaji || item.title?.userPreferred || item.title?.native || "Untitled";
  const year = item.startDate?.year ? String(item.startDate.year) : "";

  // Format release date
  let releaseDate = "";
  if (item.startDate?.year) {
    const m = String(item.startDate.month || 1).padStart(2, "0");
    const d = String(item.startDate.day || 1).padStart(2, "0");
    releaseDate = `${item.startDate.year}-${m}-${d}`;
  }

  const origin = item.countryOfOrigin || "";
  const resolvedMedia = (origin === "CN" || origin === "TW") ? "donghua" : (mediaType || "anime");

  return {
    id: item.id,
    idMal: item.idMal,
    media: resolvedMedia,
    format: item.format || "TV",
    countryOfOrigin: origin,
    title: title,
    name: title,
    overview: item.description ? item.description.replace(/<[^>]*>/g, "") : "",
    year: year,
    first_air_date: releaseDate,
    release_date: releaseDate,
    vote_average: item.averageScore ? parseFloat((item.averageScore / 10).toFixed(1)) : 0.0,
    vote_count: item.popularity || 0,
    popularity: item.popularity || 0,
    poster_path: item.coverImage?.extraLarge || item.coverImage?.large || "",
    backdrop_path: item.bannerImage || item.coverImage?.extraLarge || item.coverImage?.large || "",
    genres: (item.genres || []).map(g => (typeof g === "string" ? { name: g } : g)),
    genre_ids: [],
    number_of_seasons: 1,
    number_of_episodes: item.episodes || 1,
    status: item.status || "Unknown",
    titles: {
      romaji: item.title?.romaji || "",
      english: item.title?.english || "",
      native: item.title?.native || "",
      userPreferred: item.title?.userPreferred || "",
    },
    synonyms: item.synonyms || [],
  };
}

/**
 * Maps detailed AniList Media object to detailed TMDB format
 */
export function mapAniListDetails(item, mediaType = "anime") {
  const norm = mapAniListMedia(item, mediaType);
  if (!norm) return null;

  // Map Cast (character name + voice actor)
  norm.cast = (item.characters?.edges || []).slice(0, 15).map(edge => {
    const charNode = edge.node;
    const actor = edge.voiceActors?.[0];
    return {
      id: charNode.id,
      name: actor ? actor.name.full : charNode.name.full,
      character: charNode.name.full,
      photo: actor ? actor.image?.large : charNode.image?.large
    };
  });

  // Map Trailer
  norm.trailer = (item.trailer?.site === "youtube")
    ? { site: "YouTube", key: item.trailer.id }
    : null;

  // Map Recommendations
  norm.recommendations = (item.recommendations?.nodes || [])
    .filter(n => n.mediaRecommendation)
    .slice(0, 12)
    .map(n => mapAniListMedia(n.mediaRecommendation, mediaType));

  // Map Relations
  norm.relations = (item.relations?.edges || [])
    .filter(edge => edge.node.type === "ANIME")
    .map(edge => {
      const node = edge.node;
      const title = node.title.english || node.title.romaji || node.title.userPreferred || node.title.native || "Untitled";
      return {
        id: node.id,
        idMal: node.idMal,
        title: title,
        relationType: edge.relationType,
        format: node.format,
        status: node.status,
        episodes: node.episodes || 0,
        year: node.startDate?.year ? String(node.startDate.year) : "",
        poster_path: node.coverImage?.extraLarge || node.coverImage?.large || "",
      };
    });

  // Season list (AniList uses 1 season per entry)
  norm.season_list = [{ season_number: 1, name: "Season 1" }];

  // Generate a flat episode list from the episode count
  const epCount = item.episodes || 12;
  norm.episodes_list = Array.from({ length: epCount }, (_, i) => ({
    id: `${item.id}-ep-${i + 1}`,
    episode_number: i + 1,
    name: `Episode ${i + 1}`,
    overview: `Watch Episode ${i + 1} of ${norm.title}`,
    still: item.bannerImage || item.coverImage?.large || "",
    air_date: "",
    rating: norm.vote_average
  }));

  return norm;
}

// ── EXPORTS ─────────────────────────────────────────────────────────────

/**
 * Fetch a list of anime.
 * Builds the GraphQL query dynamically to avoid passing null/undefined
 * optional variables (e.g. countryOfOrigin), which AniList treats as
 * an explicit "filter by null" — returning zero results.
 */
export async function fetchList({ page = 1, perPage = 20, sort, status, countryOfOrigin } = {}) {
  // Build argument declarations and media filter args only for values present
  const hasCountry = countryOfOrigin != null && countryOfOrigin !== "";
  const hasStatus  = status  != null && status  !== "";
  const hasSort    = sort != null && (Array.isArray(sort) ? sort.length > 0 : true);

  // Query variable declarations
  const varDecls = [
    "$page: Int",
    "$perPage: Int",
    hasSort    && "$sort: [MediaSort]",
    hasStatus  && "$status: MediaStatus",
    hasCountry && "$countryOfOrigin: CountryCode",
  ].filter(Boolean).join(", ");

  // media() field arguments
  const mediaArgs = [
    "type: ANIME",
    hasSort    && "sort: $sort",
    hasStatus  && "status: $status",
    hasCountry && "countryOfOrigin: $countryOfOrigin",
  ].filter(Boolean).join(", ");

  const query = `
    query (${varDecls}) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(${mediaArgs}) {
          ${MEDIA_FRAGMENT}
        }
      }
    }
  `;

  // Build variables — only include defined values
  const variables = { page, perPage };
  if (hasSort)    variables.sort    = sort;
  if (hasStatus)  variables.status  = status;
  if (hasCountry) variables.countryOfOrigin = countryOfOrigin;

  const data = await queryAniList(query, variables);
  const mediaType = countryOfOrigin === "CN" ? "donghua" : "anime";

  return {
    results: (data?.Page?.media || []).map(item => mapAniListMedia(item, mediaType)),
    total_pages: data?.Page?.pageInfo?.lastPage || 1,
    page: data?.Page?.pageInfo?.currentPage || 1,
  };
}

export async function fetchDetails(id, mediaType = "anime") {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FRAGMENT}
        trailer {
          id
          site
        }
        relations {
          edges {
            relationType
            node {
              id
              idMal
              title {
                romaji
                english
                native
                userPreferred
              }
              type
              format
              status
              episodes
              startDate {
                year
              }
              coverImage {
                extraLarge
                large
              }
            }
          }
        }
        recommendations(perPage: 12, sort: [RATING_DESC]) {
          nodes {
            mediaRecommendation {
              ${MEDIA_FRAGMENT}
            }
          }
        }
        characters(sort: [ROLE_DESC, RELEVANCE], role: MAIN) {
          edges {
            role
            node {
              id
              name { full }
              image { large }
            }
            voiceActors(language: JAPANESE) {
              id
              name { full }
              image { large }
            }
          }
        }
      }
    }
  `;

  const data = await queryAniList(query, { id: parseInt(id) });
  if (!data?.Media) return null;
  return mapAniListDetails(data.Media, mediaType);
}

function parseSearchQuery(q) {
  let baseQuery = q.toLowerCase();
  let seasonNum = null;

  // Match season patterns: "season 5", "s5", "part 5", "cour 5", "5th season", " 5" (trailing)
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
      baseQuery = baseQuery.replace(pattern, "").trim();
      break;
    }
  }

  // Clean base query from junk/punctuation, keep letters/numbers and CJK characters
  baseQuery = baseQuery
    .replace(/[:\-.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { baseQuery, seasonNum };
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export async function fetchSearch(searchQuery, page = 1, perPage = 20) {
  // 1. Parse search query into base title and season number
  const { baseQuery, seasonNum } = parseSearchQuery(searchQuery);

  // 2. Perform initial searches
  const queriesToRun = new Set([searchQuery]);
  if (baseQuery && baseQuery !== searchQuery) {
    queriesToRun.add(baseQuery);
  }

  const resultsMap = new Map();
  const executeSearch = async (q) => {
    const query = `
      query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(search: $search, type: ANIME) {
            ${MEDIA_FRAGMENT}
          }
        }
      }
    `;
    try {
      const data = await queryAniList(query, { search: q, page: 1, perPage: 50 });
      return data?.Page?.media || [];
    } catch (e) {
      console.warn(`[AniList Search] Query failed for "${q}":`, e.message);
      return [];
    }
  };

  for (const q of queriesToRun) {
    const mediaItems = await executeSearch(q);
    for (const item of mediaItems) {
      resultsMap.set(item.id, item);
    }
  }

  // 3. Extract alternative base titles to perform expansion
  const discoveredBases = new Set();
  for (const item of resultsMap.values()) {
    const titles = [
      item.title?.english,
      item.title?.romaji,
      item.title?.userPreferred,
      ...(item.synonyms || [])
    ].filter(Boolean);

    for (const t of titles) {
      const b = parseSearchQuery(t).baseQuery;
      if (b && b.length > 3) {
        discoveredBases.add(b);
      }
    }
  }

  // 4. Run secondary searches for discovered base titles that we haven't searched yet
  const secondaryQueries = Array.from(discoveredBases).filter(b => b !== baseQuery && b !== searchQuery);
  for (const secQ of secondaryQueries.slice(0, 3)) {
    const mediaItems = await executeSearch(secQ);
    for (const item of mediaItems) {
      resultsMap.set(item.id, item);
    }
  }

  // 5. Score and sort all candidate media items
  const candidates = Array.from(resultsMap.values());
  
  // Build the synonym relationships: which base titles are grouped together?
  const synonymGroups = [];
  const addSynonyms = (bases) => {
    let group = synonymGroups.find(g => bases.some(b => g.has(b)));
    if (!group) {
      group = new Set();
      synonymGroups.push(group);
    }
    bases.forEach(b => group.add(b));
  };

  for (const item of candidates) {
    const bases = [];
    const titles = [
      item.title?.english,
      item.title?.romaji,
      item.title?.userPreferred,
      ...(item.synonyms || [])
    ].filter(Boolean);
    for (const t of titles) {
      const b = parseSearchQuery(t).baseQuery;
      if (b) bases.push(b);
    }
    if (bases.length > 1) {
      addSynonyms(bases);
    }
  }

  const getMatchScore = (item) => {
    const titles = [
      item.title?.english,
      item.title?.romaji,
      item.title?.native,
      item.title?.userPreferred,
      ...(item.synonyms || [])
    ].filter(Boolean).map(t => t.toLowerCase());

    let bestTitleScore = 0;
    for (const t of titles) {
      const itemBase = parseSearchQuery(t).baseQuery;
      
      // Direct base match
      let isSynonym = (itemBase === baseQuery);
      if (!isSynonym && itemBase) {
        // Check if itemBase is in the same synonym group as baseQuery
        const group = synonymGroups.find(g => g.has(baseQuery));
        if (group && group.has(itemBase)) {
          isSynonym = true;
        }
      }

      if (isSynonym) {
        bestTitleScore = Math.max(bestTitleScore, 100);
      } else if (itemBase && (itemBase.includes(baseQuery) || baseQuery.includes(itemBase))) {
        bestTitleScore = Math.max(bestTitleScore, 80);
      } else {
        const cleanT = t.replace(/[^a-z0-9\u4e00-\u9fa5\u3040-\u30ff]/g, "").trim();
        const cleanB = baseQuery.replace(/[^a-z0-9\u4e00-\u9fa5\u3040-\u30ff]/g, "").trim();
        const dist = levenshteinDistance(cleanT, cleanB);
        const maxLen = Math.max(cleanT.length, cleanB.length);
        if (maxLen > 0) {
          const sim = 1 - dist / maxLen;
          if (sim > 0.6) {
            bestTitleScore = Math.max(bestTitleScore, Math.floor(sim * 75));
          }
        }
      }
    }

    if (bestTitleScore === 0) return 0;

    // Season matching
    if (seasonNum !== null) {
      let seasonMatched = false;
      const seasonRegexes = [
        new RegExp(`\\bseason\\s*${seasonNum}\\b`, "i"),
        new RegExp(`\\b${seasonNum}th\\s*season`, "i"),
        new RegExp(`\\bs${seasonNum}\\b`, "i"),
        new RegExp(`\\bpart\\s*${seasonNum}\\b`, "i"),
        new RegExp(`\\bcour\\s*${seasonNum}\\b`, "i"),
        new RegExp(`\\b${seasonNum}\\b`, "i")
      ];

      for (const t of titles) {
        if (seasonRegexes.some(rx => rx.test(t))) {
          seasonMatched = true;
          break;
        }
      }

      if (seasonMatched) {
        return bestTitleScore + 50;
      } else {
        // Penalty if season number is specified in query but item title contains a DIFFERENT season number
        let hasOtherSeason = false;
        for (let s = 1; s <= 10; s++) {
          if (s === seasonNum) continue;
          const otherRx = new RegExp(`\\b(season\\s*${s}|s${s}|part\\s*${s}|cour\\s*${s}|${s}th\\s*season|\\b${s}\\b)`, "i");
          for (const t of titles) {
            if (otherRx.test(t)) {
              hasOtherSeason = true;
              break;
            }
          }
        }
        if (hasOtherSeason) {
          return bestTitleScore - 40;
        }
        return bestTitleScore - 15;
      }
    }

    return bestTitleScore;
  };

  const scored = candidates
    .map(item => ({ item, score: getMatchScore(item) }))
    .filter(c => c.score > 30);

  scored.sort((a, b) => b.score - a.score);

  const finalItems = scored.map(c => mapAniListMedia(c.item, "anime"));

  // Pagination
  const itemsPerPage = perPage;
  const totalItems = finalItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (page - 1) * itemsPerPage;
  const paginated = finalItems.slice(startIndex, startIndex + itemsPerPage);

  return {
    results: paginated,
    total_pages: totalPages,
    page: page,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MANGA SUPPORT — additive exports only, zero changes to existing functions above
// ══════════════════════════════════════════════════════════════════════════════

// Manga-specific media fragment (includes chapters, volumes, staff, format)
const MANGA_MEDIA_FRAGMENT = `
  id
  idMal
  title {
    romaji
    english
    native
    userPreferred
  }
  synonyms
  description
  startDate {
    year
    month
    day
  }
  averageScore
  popularity
  coverImage {
    extraLarge
    large
    medium
  }
  bannerImage
  genres
  chapters
  volumes
  status
  format
  countryOfOrigin
`;

/**
 * Maps a single AniList MANGA Media object to a normalised manga-friendly format.
 * Distinct from mapAniListMedia — includes chapters/volumes/type detection.
 */
function mapMangaItem(item) {
  if (!item) return null;
  const title =
    item.title?.english ||
    item.title?.romaji ||
    item.title?.userPreferred ||
    item.title?.native ||
    "Untitled";
  const year = item.startDate?.year ? String(item.startDate.year) : "";

  let releaseDate = "";
  if (item.startDate?.year) {
    const m = String(item.startDate.month || 1).padStart(2, "0");
    const d = String(item.startDate.day || 1).padStart(2, "0");
    releaseDate = `${item.startDate.year}-${m}-${d}`;
  }

  // Detect content type from countryOfOrigin
  let contentType = "manga";
  const origin = item.countryOfOrigin || "";
  if (origin === "KR") contentType = "manhwa";
  else if (origin === "CN" || origin === "TW") contentType = "manhua";

  return {
    id: item.id,
    idMal: item.idMal,
    media: contentType,         // "manga" | "manhwa" | "manhua"
    type: contentType,
    title,
    name: title,
    overview: item.description ? item.description.replace(/<[^>]*>/g, "") : "",
    year,
    release_date: releaseDate,
    first_air_date: releaseDate,
    vote_average: item.averageScore ? parseFloat((item.averageScore / 10).toFixed(1)) : 0.0,
    vote_count: item.popularity || 0,
    popularity: item.popularity || 0,
    poster_path: item.coverImage?.extraLarge || item.coverImage?.large || "",
    backdrop_path: item.bannerImage || item.coverImage?.extraLarge || item.coverImage?.large || "",
    genres: (item.genres || []).map(g => ({ name: g })),
    chapters: item.chapters || null,    // total chapter count (null if ongoing/unknown)
    volumes: item.volumes || null,
    status: item.status || "Unknown",
    format: item.format || null,
    countryOfOrigin: item.countryOfOrigin || null,
    titles: {
      romaji: item.title?.romaji || "",
      english: item.title?.english || "",
      native: item.title?.native || "",
      userPreferred: item.title?.userPreferred || "",
    },
    synonyms: item.synonyms || [],
  };
}

/**
 * Maps a detailed AniList MANGA object — adds authors, artists, relations, recs, tags.
 */
function mapMangaDetails(item) {
  const norm = mapMangaItem(item);
  if (!norm) return null;

  // Separate authors vs artists from staff edges
  const authors = [];
  const artists = [];
  for (const edge of item.staff?.edges || []) {
    const role = (edge.role || "").toLowerCase();
    const person = {
      id: edge.node?.id,
      name: edge.node?.name?.full || "",
      photo: edge.node?.image?.large || "",
      role: edge.role,
    };
    if (role.includes("art") || role.includes("illustrat")) {
      artists.push(person);
    } else {
      authors.push(person);
    }
  }
  norm.authors = authors;
  norm.artists = artists;

  // Recommendations
  norm.recommendations = (item.recommendations?.nodes || [])
    .filter(n => n.mediaRecommendation)
    .slice(0, 12)
    .map(n => mapMangaItem(n.mediaRecommendation))
    .filter(Boolean);

  // Relations (ANIME + MANGA)
  norm.relations = (item.relations?.edges || []).map(edge => {
    const node = edge.node;
    const title =
      node.title?.english ||
      node.title?.romaji ||
      node.title?.userPreferred ||
      node.title?.native ||
      "Untitled";
    return {
      id: node.id,
      idMal: node.idMal,
      title,
      relationType: edge.relationType,
      format: node.format,
      status: node.status,
      type: node.type,
      chapters: node.chapters || null,
      episodes: node.episodes || null,
      year: node.startDate?.year ? String(node.startDate.year) : "",
      poster_path: node.coverImage?.extraLarge || node.coverImage?.large || "",
    };
  });

  // Tags
  norm.tags = (item.tags || []).map(t => ({
    name: t.name,
    rank: t.rank,
    isAdult: t.isAdult,
  }));

  // External links (MAL, MangaDex, etc.)
  norm.externalLinks = (item.externalLinks || []).map(l => ({
    site: l.site,
    url: l.url,
  }));

  return norm;
}

/**
 * Fetch a paginated list of manga from AniList.
 * @param {object} opts
 * @param {number}   [opts.page=1]
 * @param {number}   [opts.perPage=20]
 * @param {string[]} [opts.sort]            - e.g. ["TRENDING_DESC"]
 * @param {string}   [opts.status]          - AniList MediaStatus enum
 * @param {string}   [opts.countryOfOrigin] - ISO code: KR=manhwa, CN=manhua
 * @param {string}   [opts.format]          - e.g. "MANGA", "ONE_SHOT"
 */
export async function fetchMangaList({ page = 1, perPage = 20, sort, status, countryOfOrigin, format } = {}) {
  const hasCountry = countryOfOrigin != null && countryOfOrigin !== "";
  const hasStatus  = status != null && status !== "";
  const hasSort    = sort != null && (Array.isArray(sort) ? sort.length > 0 : true);
  const hasFormat  = format != null && format !== "";

  const varDecls = [
    "$page: Int",
    "$perPage: Int",
    hasSort    && "$sort: [MediaSort]",
    hasStatus  && "$status: MediaStatus",
    hasCountry && "$countryOfOrigin: CountryCode",
    hasFormat  && "$format: MediaFormat",
  ].filter(Boolean).join(", ");

  const mediaArgs = [
    "type: MANGA",
    hasSort    && "sort: $sort",
    hasStatus  && "status: $status",
    hasCountry && "countryOfOrigin: $countryOfOrigin",
    hasFormat  && "format: $format",
  ].filter(Boolean).join(", ");

  const query = `
    query (${varDecls}) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(${mediaArgs}) {
          ${MANGA_MEDIA_FRAGMENT}
        }
      }
    }
  `;

  const variables = { page, perPage };
  if (hasSort)    variables.sort            = sort;
  if (hasStatus)  variables.status          = status;
  if (hasCountry) variables.countryOfOrigin = countryOfOrigin;
  if (hasFormat)  variables.format          = format;

  const data = await queryAniList(query, variables);
  return {
    results: (data?.Page?.media || []).map(item => mapMangaItem(item)),
    total_pages: data?.Page?.pageInfo?.lastPage || 1,
    page: data?.Page?.pageInfo?.currentPage || 1,
  };
}

/**
 * Fetch detailed manga information from AniList by ID.
 * Includes authors, artists, relations, recommendations, tags, and external links.
 * @param {string|number} id - AniList media ID
 * @returns {Promise<object|null>}
 */
export async function fetchMangaDetails(id) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        ${MANGA_MEDIA_FRAGMENT}
        tags {
          name
          rank
          isAdult
        }
        externalLinks {
          site
          url
        }
        staff(sort: [RELEVANCE]) {
          edges {
            role
            node {
              id
              name { full }
              image { large }
            }
          }
        }
        relations {
          edges {
            relationType
            node {
              id
              idMal
              title {
                romaji
                english
                native
                userPreferred
              }
              type
              format
              status
              chapters
              episodes
              startDate { year }
              coverImage {
                extraLarge
                large
              }
            }
          }
        }
        recommendations(perPage: 12, sort: [RATING_DESC]) {
          nodes {
            mediaRecommendation {
              ${MANGA_MEDIA_FRAGMENT}
            }
          }
        }
      }
    }
  `;

  const data = await queryAniList(query, { id: parseInt(id) });
  if (!data?.Media) return null;
  return mapMangaDetails(data.Media);
}

/**
 * Search manga on AniList by title.
 * @param {string} searchQuery
 * @param {number} [page=1]
 * @param {number} [perPage=20]
 * @returns {Promise<{ results: object[], total_pages: number, page: number }>}
 */
export async function fetchMangaSearch(searchQuery, page = 1, perPage = 20) {
  const query = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(search: $search, type: MANGA) {
          ${MANGA_MEDIA_FRAGMENT}
        }
      }
    }
  `;

  const data = await queryAniList(query, { search: searchQuery, page, perPage });
  return {
    results: (data?.Page?.media || []).map(item => mapMangaItem(item)),
    total_pages: data?.Page?.pageInfo?.lastPage || 1,
    page: data?.Page?.pageInfo?.currentPage || 1,
  };
}
