/**
 * INVESTIGATION ONLY - Deep dive into chapter reader #initial-data
 * and probing what comes from SSR vs protected API
 */
import axios from 'axios';

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Cache-Control': 'no-cache',
  'Referer': 'https://comix.to/',
};

const JSON_HEADERS = {
  ...BASE_HEADERS,
  'Accept': 'application/json, text/plain, */*',
};

function sep(t) { console.log(`\n${'═'.repeat(70)}\n  ${t}\n${'═'.repeat(70)}`); }
function extractInitialData(html) {
  const m = html.match(/<script type="application\/json" id="initial-data">([^<]+)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

const TEST_SLUG = '793e-arelyn-is-sick-and-tired';
const TEST_HASH = '793e';

// ── A: Full chapter reader page dump ─────────────────────────────────────────
sep('A: Full chapter reader #initial-data (chapter 1)');
const chapterSlug = '2869665-chapter-1'; // from earlier investigation
{
  const res = await axios.get(`https://comix.to/title/${TEST_SLUG}/${chapterSlug}`, {
    headers: BASE_HEADERS, timeout: 20000
  });
  console.log(`HTTP: ${res.status}`);
  const data = extractInitialData(res.data);
  if (data) {
    console.log('page:', data.page);
    console.log('# queries:', Object.keys(data.queries).length);
    for (const [key, value] of Object.entries(data.queries)) {
      const k = JSON.parse(key);
      console.log(`\nQuery type: ${JSON.stringify(k)}`);
      const vStr = JSON.stringify(value);
      console.log(`  → ${vStr.length} bytes`);
      // Full dump for chapter-specific queries
      if (JSON.stringify(k).includes('read') || JSON.stringify(k).includes('chapter') || vStr.includes('pages') || vStr.includes('images')) {
        console.log('  FULL VALUE:');
        console.log(vStr.slice(0, 5000));
      } else {
        console.log('  Sample:', vStr.slice(0, 400));
      }
    }
  } else {
    // No initial-data? Check raw HTML for clues
    const html = res.data;
    console.log('No #initial-data found. HTML excerpt (3000 chars):');
    console.log(html.slice(0, 3000));
  }
}

// ── B: Full title page #initial-data — all queries ───────────────────────────
sep('B: Full title page #initial-data — all queries');
{
  const res = await axios.get(`https://comix.to/title/${TEST_SLUG}`, {
    headers: BASE_HEADERS, timeout: 20000
  });
  const data = extractInitialData(res.data);
  if (data) {
    console.log('# queries:', Object.keys(data.queries).length);
    for (const [key, value] of Object.entries(data.queries)) {
      const k = JSON.parse(key);
      const vStr = JSON.stringify(value);
      console.log(`\nQuery: ${JSON.stringify(k)}`);
      console.log(`  ${vStr.length} bytes → ${vStr.slice(0, 600)}`);
    }
  }
}

// ── C: Check if chapter list is embedded in title page ───────────────────────
sep('C: Does title page embed chapter list? Check queries for chapter arrays');
{
  const res = await axios.get(`https://comix.to/title/${TEST_SLUG}`, {
    headers: BASE_HEADERS, timeout: 20000
  });
  const data = extractInitialData(res.data);
  if (data) {
    for (const [key, value] of Object.entries(data.queries)) {
      const vStr = JSON.stringify(value);
      // Look for arrays that might be chapter lists
      if (Array.isArray(value)) {
        console.log(`Query ${key} is an array of ${value.length} items`);
        if (value.length > 0) {
          const item = value[0];
          const hasChapterField = 'chapter' in item || 'chapter_id' in item || 'chapterId' in item;
          console.log('  Has chapter fields:', hasChapterField);
          console.log('  First item fields:', Object.keys(item));
          console.log('  First item:', JSON.stringify(item).slice(0, 300));
        }
      } else if (value && typeof value === 'object' && value.items) {
        console.log(`Query ${key} has .items array of ${value.items.length}`);
        if (value.items.length > 0) {
          const item = value.items[0];
          console.log('  First item fields:', Object.keys(item));
          const hasChapterField = 'chapter' in item || 'chapter_id' in item;
          console.log('  Has chapter fields:', hasChapterField);
          console.log('  First item:', JSON.stringify(item).slice(0, 300));
        }
      }
    }
  }
}

// ── D: Test chapter page with chapter 68 (latest) ─────────────────────────────
sep('D: Chapter reader #initial-data — latest chapter 68');
const latestChapterSlug = '10646674-chapter-68';
{
  const res = await axios.get(`https://comix.to/title/${TEST_SLUG}/${latestChapterSlug}`, {
    headers: BASE_HEADERS, timeout: 20000
  });
  console.log(`HTTP: ${res.status}`);
  const data = extractInitialData(res.data);
  if (data) {
    console.log('page:', data.page);
    for (const [key, value] of Object.entries(data.queries)) {
      const k = JSON.parse(key);
      const vStr = JSON.stringify(value);
      console.log(`\nQuery: ${JSON.stringify(k)} → ${vStr.length} bytes`);
      console.log(vStr.slice(0, 1000));
    }
  } else {
    const html = res.data;
    // Try to find any JSON data that contains pages
    const pagesMatch = html.match(/"pages"\s*:\s*(\{[^}]+\}|\[[^\]]+\])/);
    if (pagesMatch) console.log('Found pages data:', pagesMatch[0].slice(0, 400));
    // Look for image URLs
    const imgMatch = html.match(/(https?:\/\/[^"'\s]+\.(webp|jpg|jpeg|png))/g);
    if (imgMatch) {
      console.log('Found image URLs:', imgMatch.slice(0, 5));
    }
    console.log('\nHTML (first 2000 chars):', html.slice(0, 2000));
  }
}

// ── E: Does the chapter page SSR include image URLs in HTML? ──────────────────
sep('E: Checking if chapter page HTML contains image URLs directly');
{
  const res = await axios.get(`https://comix.to/title/${TEST_SLUG}/${chapterSlug}`, {
    headers: BASE_HEADERS, timeout: 20000
  });
  const html = res.data;
  
  // Check for CDN image URLs
  const cdnUrls = [...html.matchAll(/https?:\/\/[^"'\s]*\.(webp|jpg|jpeg|png)[^"'\s]*/g)].map(m => m[0]);
  console.log('CDN image URLs found in HTML:', cdnUrls.length);
  cdnUrls.slice(0, 10).forEach(u => console.log(' ', u));
  
  // Check for comix.to static URLs
  const staticUrls = [...html.matchAll(/https?:\/\/[^"'\s]*comix[^"'\s]*/g)].map(m => m[0]);
  console.log('\ncomix.to URLs found:', staticUrls.slice(0, 5));
  
  // Look for wowpic or similar CDN patterns (seen in yurtzy investigation)
  const wowpicUrls = [...html.matchAll(/https?:\/\/[^"'\s]*wowpic[^"'\s]*/g)].map(m => m[0]);
  console.log('\nwowpic CDN URLs found:', wowpicUrls.slice(0, 5));
  
  // Look for si/ or /i/ pattern (scrambled vs non-scrambled)
  const scramblerPattern = [...html.matchAll(/\/si\/[^"'\s]+/g)].map(m => m[0]);
  console.log('\n/si/ (scrambled) URLs found:', scramblerPattern.slice(0, 3));
}

// ── F: Test SPA query endpoints directly ─────────────────────────────────────
sep('F: Probing SPA /query or /q endpoints');
{
  // The SPA uses TanStack Query, so data must come from somewhere...
  // Check if there's a dedicated query API endpoint
  const candidates = [
    `https://comix.to/api/q`,
    `https://comix.to/api/query`,
    `https://comix.to/api/v2/manga/${TEST_HASH}`,
    `https://comix.to/api/manga/${TEST_HASH}`,
  ];
  
  for (const url of candidates) {
    try {
      const res = await axios.get(url, { headers: JSON_HEADERS, timeout: 8000 });
      console.log(`${url}: ${res.status} → ${JSON.stringify(res.data).slice(0, 200)}`);
    } catch (e) {
      console.log(`${url}: FAILED (${e.response?.status ?? e.message})`);
    }
  }
}

// ── G: What does the chapter page SSR provide via meta tags? ─────────────────
sep('G: Chapter page meta tags / SEO data');
{
  const res = await axios.get(`https://comix.to/title/${TEST_SLUG}/${chapterSlug}`, {
    headers: BASE_HEADERS, timeout: 20000
  });
  const html = res.data;
  const metas = [...html.matchAll(/<meta[^>]+>/g)].map(m => m[0]);
  console.log('Meta tags:');
  metas.forEach(m => console.log(' ', m));
  
  // Also check title, canonical
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+>/);
  console.log('\nTitle:', titleMatch?.[1]);
  console.log('Canonical:', canonical?.[0]);
}

// ── H: Check title page for embedded chapter count query ─────────────────────
sep('H: Title page — chapter count query analysis');
{
  const res = await axios.get(`https://comix.to/title/${TEST_SLUG}`, {
    headers: BASE_HEADERS, timeout: 20000
  });
  const data = extractInitialData(res.data);
  if (data) {
    // Look for "count" queries
    for (const [key, value] of Object.entries(data.queries)) {
      const k = JSON.parse(key);
      if (JSON.stringify(k).includes('count') || JSON.stringify(value).includes('count')) {
        console.log(`Count-related query: ${key}`);
        console.log('Value:', JSON.stringify(value).slice(0, 400));
      }
      // Look for pagination metadata
      if (JSON.stringify(value).includes('lastPage') || JSON.stringify(value).includes('total')) {
        console.log(`Pagination-related query: ${key}`);
        console.log('Value:', JSON.stringify(value).slice(0, 400));
      }
    }
  }
}

console.log('\n\n' + '═'.repeat(70));
console.log('DEEP INVESTIGATION COMPLETE');
console.log('═'.repeat(70));
