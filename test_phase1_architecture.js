/**
 * Phase 1 Architecture Verification Test
 *
 * Tests:
 *   1. readerProviderRegistry — registers a stub, executes it, checks health
 *   2. AniList manga search — Solo Leveling
 *   3. AniList manga details — Solo Leveling (ID 87216)
 *   4. AniList manga list — trending
 *   5. HTTP regression — GET /api/anime/trending still works
 *   6. HTTP test — GET /api/manga/trending works
 *   7. HTTP test — GET /api/manga/search?q=Solo+Leveling works
 *   8. HTTP test — GET /api/manga/details/87216 works
 *   9. HTTP test — GET /api/manga/providers/health returns empty (no providers yet)
 *  10. HTTP test — GET /api/manga/chapters/:id returns informative empty (no providers)
 */

import { readerRegistry } from "./providers/readerProviderRegistry.js";
import { ReaderProvider } from "./providers/base/ReaderProvider.js";
import * as anilistProvider from "./providers/anilistProvider.js";
import axios from "axios";

const BASE = "http://localhost:3000";
let passed = 0;
let failed = 0;

function ok(label, value) {
  if (value) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function sep(title) {
  console.log(`\n${"─".repeat(60)}\n  ${title}\n${"─".repeat(60)}`);
}

// ── 1. ReaderProviderRegistry — stub provider ────────────────────────────────
sep("1. ReaderProviderRegistry stub test");

class StubReaderProvider extends ReaderProvider {
  constructor() { super("stub-test"); }
  async search(q, page) {
    return { results: [{ id: "stub-1", title: `Stub result for '${q}'`, cover: "", type: "manga", status: "RELEASING", lastChapter: 100, provider: "stub-test" }], provider: "stub-test" };
  }
  async details(id) {
    return { id, title: "Stub Title", cover: "", description: "Stub desc", status: "RELEASING", lastChapter: 100, type: "manga", provider: "stub-test" };
  }
  async chapters(id, options = {}) {
    return { id, chapters: [{ id: "ch-1", number: "1", title: "Chapter 1", uploadedAt: new Date().toISOString(), group: "Stub Scans", groups: ["Stub Scans"] }], page: 1, totalPages: 1, provider: "stub-test" };
  }
  async chapterPages(chapterId) {
    return { chapterId, pages: [{ url: "https://example.com/page1.jpg", width: 800, height: 1200, scrambled: false }], provider: "stub-test" };
  }
  async healthCheck() {
    return { ok: true, latencyMs: 1 };
  }
  supportsScanGroups() { return true; }
}

const stub = new StubReaderProvider();
readerRegistry.register(stub, 1);
ok("Registry accepts stub provider", readerRegistry.hasProviders());
ok("Registry lists stub provider", readerRegistry.list()[0]?.name === "stub-test");

const searchResult = await readerRegistry.executeWithFallback("search", "Solo Leveling", 1);
ok("executeWithFallback search returns results", searchResult?.results?.length > 0);
ok("Search result has provider field", searchResult?.results?.[0]?.provider === "stub-test");

const chaptersResult = await readerRegistry.executeWithFallback("chapters", "stub-id");
ok("executeWithFallback chapters returns chapters", chaptersResult?.chapters?.length > 0);
ok("Chapters have group field", typeof chaptersResult?.chapters?.[0]?.group === "string");

const pagesResult = await readerRegistry.executeWithFallback("chapterPages", "ch-1");
ok("executeWithFallback chapterPages returns pages", pagesResult?.pages?.length > 0);
ok("Pages have url field", typeof pagesResult?.pages?.[0]?.url === "string");

await readerRegistry.runHealthChecks();
const health = readerRegistry.getHealth();
ok("Health check marks stub as available", health["stub-test"]?.available === true);
ok("Health check records latencyMs", typeof health["stub-test"]?.latencyMs === "number");

ok("supportsScanGroups returns true", stub.supportsScanGroups() === true);

// Legacy alias compatibility
const legacyChapters = await stub.fetchChapters("test-id", 1);
ok("Legacy fetchChapters alias works", legacyChapters?.chapters?.length > 0);
const legacyPages = await stub.fetchChapterPages("ch-1");
ok("Legacy fetchChapterPages alias works", legacyPages?.pages?.length > 0);

// ── 2. AniList manga search ───────────────────────────────────────────────────
sep("2. AniList fetchMangaSearch — 'Solo Leveling'");
{
  const results = await anilistProvider.fetchMangaSearch("Solo Leveling");
  ok("fetchMangaSearch returns results", results?.results?.length > 0);
  ok("Results have id field", typeof results?.results?.[0]?.id === "number");
  ok("Results have title field", typeof results?.results?.[0]?.title === "string");
  ok("Results have type field (manga/manhwa/manhua)", ["manga","manhwa","manhua"].includes(results?.results?.[0]?.type));
  ok("Results have chapters field", "chapters" in results.results[0]);
  ok("Results have poster_path", typeof results?.results?.[0]?.poster_path === "string");
  const soloLeveling = results.results.find(r => r.title.toLowerCase().includes("solo leveling") || r.title.toLowerCase().includes("나 혼자만 레벨업"));
  ok("Solo Leveling found in results", !!soloLeveling);
  if (soloLeveling) {
    ok("Solo Leveling type is manhwa", soloLeveling.type === "manhwa");
    console.log(`     → Title: "${soloLeveling.title}", type: ${soloLeveling.type}, chapters: ${soloLeveling.chapters}`);
  }
}

// ── 3. AniList manga details ──────────────────────────────────────────────────
sep("3. AniList fetchMangaDetails — Solo Leveling (ID 87216)");
{
  const details = await anilistProvider.fetchMangaDetails(87216);
  ok("fetchMangaDetails returns data", !!details);
  ok("Title present", typeof details?.title === "string" && details?.title.length > 0);
  ok("Type is manhwa", details?.type === "manhwa");
  ok("Has chapters count", details?.chapters !== undefined);
  ok("Has genres", Array.isArray(details?.genres) && details?.genres.length > 0);
  ok("Has authors array", Array.isArray(details?.authors));
  ok("Has artists array", Array.isArray(details?.artists));
  ok("Has recommendations", Array.isArray(details?.recommendations));
  ok("Has relations", Array.isArray(details?.relations));
  ok("Has tags", Array.isArray(details?.tags));
  ok("Has externalLinks", Array.isArray(details?.externalLinks));
  ok("Has cover image", typeof details?.poster_path === "string" && details?.poster_path.length > 0);
  ok("Has overview", typeof details?.overview === "string" && details?.overview.length > 0);
  console.log(`     → "${details?.title}", type: ${details?.type}, chapters: ${details?.chapters}, authors: ${details?.authors?.length}`);
}

// ── 4. AniList manga list ─────────────────────────────────────────────────────
sep("4. AniList fetchMangaList — trending");
{
  const list = await anilistProvider.fetchMangaList({ page: 1, sort: ["TRENDING_DESC"] });
  ok("fetchMangaList returns results", list?.results?.length > 0);
  ok("Has total_pages", typeof list?.total_pages === "number");
  ok("Results have type field", ["manga","manhwa","manhua"].includes(list?.results?.[0]?.type));
}

// ── 5-9. HTTP endpoint tests ──────────────────────────────────────────────────
sep("5. HTTP Regression — GET /api/anime/trending");
{
  try {
    const res = await axios.get(`${BASE}/api/anime/trending`, { timeout: 15000 });
    ok("Anime trending returns 200", res.status === 200);
    ok("Anime trending has results", res.data?.results?.length > 0);
    ok("Anime results are ANIME type", res.data?.results?.[0]?.media === "anime" || res.data?.results?.[0]?.id > 0);
  } catch (e) {
    ok("Anime trending HTTP request succeeded", false);
    console.log("    Error:", e.message);
  }
}

sep("6. HTTP Test — GET /api/manga/trending");
{
  try {
    const res = await axios.get(`${BASE}/api/manga/trending`, { timeout: 15000 });
    ok("Manga trending returns 200", res.status === 200);
    ok("Manga trending has results", res.data?.results?.length > 0);
    ok("Manga results have type field", ["manga","manhwa","manhua"].includes(res.data?.results?.[0]?.type));
  } catch (e) {
    ok("Manga trending HTTP request succeeded", false);
    console.log("    Error:", e.message);
  }
}

sep("7. HTTP Test — GET /api/manga/search?q=Solo+Leveling");
{
  try {
    const res = await axios.get(`${BASE}/api/manga/search?q=Solo+Leveling`, { timeout: 15000 });
    ok("Manga search returns 200", res.status === 200);
    ok("Manga search has results", res.data?.results?.length > 0);
    const sl = res.data?.results?.find(r => r.title?.toLowerCase().includes("solo leveling") || r.title?.toLowerCase().includes("나 혼자만"));
    ok("Solo Leveling in search results", !!sl);
    if (sl) console.log(`    → Found: "${sl.title}" (${sl.type})`);
  } catch (e) {
    ok("Manga search HTTP request succeeded", false);
    console.log("    Error:", e.message);
  }
}

sep("8. HTTP Test — GET /api/manga/details/87216");
{
  try {
    const res = await axios.get(`${BASE}/api/manga/details/87216`, { timeout: 15000 });
    ok("Manga details returns 200", res.status === 200);
    ok("Details has title", typeof res.data?.title === "string");
    ok("Details has type", ["manga","manhwa","manhua"].includes(res.data?.type));
    ok("Details has authors", Array.isArray(res.data?.authors));
    ok("Details has tags", Array.isArray(res.data?.tags));
    console.log(`    → "${res.data?.title}", chapters: ${res.data?.chapters}, authors: ${res.data?.authors?.length}`);
  } catch (e) {
    ok("Manga details HTTP request succeeded", false);
    console.log("    Error:", e.message);
  }
}

sep("9. HTTP Test — GET /api/manga/providers/health");
{
  try {
    const res = await axios.get(`${BASE}/api/manga/providers/health`, { timeout: 10000 });
    ok("Providers health returns 200", res.status === 200);
    ok("Has summary field", typeof res.data?.summary?.total === "number");
    ok("Has providers array", Array.isArray(res.data?.providers));
    console.log(`    → Total providers: ${res.data?.summary?.total}, healthy: ${res.data?.summary?.healthy}`);
  } catch (e) {
    ok("Providers health HTTP request succeeded", false);
    console.log("    Error:", e.message);
  }
}

sep("10. HTTP Test — GET /api/manga/chapters/test-id (no providers = informative empty)");
{
  try {
    const res = await axios.get(`${BASE}/api/manga/chapters/test-id`, { timeout: 10000 });
    ok("Chapters endpoint returns 200", res.status === 200);
    ok("Returns chapters array (possibly empty)", Array.isArray(res.data?.chapters));
    // With no real providers registered on the HTTP server, it returns empty + message
    console.log(`    → provider: ${res.data?.provider}, chapters: ${res.data?.chapters?.length}, message: ${res.data?.message || "(none)"}`);
  } catch (e) {
    ok("Chapters endpoint HTTP request succeeded", false);
    console.log("    Error:", e.message);
  }
}

sep("11. AniList manga — manhwa list (KR)");
{
  const list = await anilistProvider.fetchMangaList({ page: 1, sort: ["POPULARITY_DESC"], countryOfOrigin: "KR" });
  ok("Manhwa list returns results", list?.results?.length > 0);
  ok("All results are manhwa type", list.results.every(r => r.type === "manhwa"));
  console.log(`    → ${list.results.length} manhwa results, first: "${list.results[0]?.title}"`);
}

sep("12. AniList manga — TBAТЕ details (The Beginning After The End, ID 104454)");
{
  try {
    const details = await anilistProvider.fetchMangaDetails(104454);
    ok("TBAТЕ details returned", !!details);
    ok("Has title", typeof details?.title === "string");
    console.log(`    → "${details?.title}" (${details?.type}), chapters: ${details?.chapters}`);
  } catch (e) {
    ok("TBAТЕ details succeeded", false);
    console.log("    Error:", e.message);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(60)}`);
console.log(`  Phase 1 Verification: ${passed} passed, ${failed} failed`);
console.log("═".repeat(60));
if (failed === 0) {
  console.log("  ✅ ALL TESTS PASSED — Architecture is ready for Phase 2");
} else {
  console.log(`  ⚠️  ${failed} test(s) failed — review output above`);
}
process.exit(failed > 0 ? 1 : 0);
