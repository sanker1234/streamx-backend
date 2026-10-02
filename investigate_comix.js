/**
 * INVESTIGATION ONLY — no code changes
 * comix.to is NOT Next.js - it uses a custom SPA with #initial-data JSON
 * This script investigates the actual data architecture
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

const TEST_SLUG = '793e-arelyn-is-sick-and-tired';
const TEST_HASH = '793e';

function section(title) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(70));
}

function extractInitialData(html) {
  const m = html.match(/<script type="application\/json" id="initial-data">([^<]+)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

// ── 1. Inspect the SPA architecture ──────────────────────────────────────────
section('1. Homepage #initial-data structure');
{
  const res = await axios.get('https://comix.to/', { headers: BASE_HEADERS, timeout: 15000 });
  const data = extractInitialData(res.data);
  if (data) {
    console.log('page:', data.page);
    console.log('queries keys:', Object.keys(data.queries || {}));
    // Show first query key content type
    const qKeys = Object.keys(data.queries || {});
    for (const k of qKeys.slice(0, 3)) {
      console.log(`\nQuery [${k}] type:`, Array.isArray(data.queries[k]) ? `array[${data.queries[k].length}]` : typeof data.queries[k]);
      const sample = JSON.stringify(data.queries[k]).slice(0, 500);
      console.log('  Sample:', sample);
    }
    // Also look for build hash in asset URLs
    const buildMatch = res.data.match(/\/assets\/build\/([a-f0-9]+)\//);
    console.log('\nAsset build hash:', buildMatch?.[1]);
  }
}

// ── 2. Title page #initial-data — Full inspection ─────────────────────────────
section(`2. Title page #initial-data for ${TEST_SLUG}`);
let titleInitialData = null;
{
  const res = await axios.get(`https://comix.to/title/${TEST_SLUG}`, { headers: BASE_HEADERS, timeout: 15000 });
  titleInitialData = extractInitialData(res.data);
  if (titleInitialData) {
    console.log('page:', titleInitialData.page);
    console.log('queries keys:', JSON.stringify(Object.keys(titleInitialData.queries || {})));
    
    // Extract manga detail
    const queries = titleInitialData.queries;
    for (const [key, value] of Object.entries(queries)) {
      const parsed = JSON.parse(key);
      console.log(`\nQuery: ${JSON.stringify(parsed)}`);
      const valStr = JSON.stringify(value);
      if (valStr.length > 1000) {
        console.log(`  Value (${valStr.length} bytes, showing 1000): ${valStr.slice(0, 1000)}...`);
      } else {
        console.log('  Value:', valStr);
      }
    }
  }
}

// ── 3. Probe /api/v1/manga/{hash} directly (no signature required?) ───────────
section(`3. Direct API v1 probe: /api/v1/manga/${TEST_HASH}`);
{
  try {
    const res = await axios.get(`https://comix.to/api/v1/manga/${TEST_HASH}`, {
      headers: JSON_HEADERS,
      timeout: 15000
    });
    console.log(`HTTP Status: ${res.status}`);
    console.log(`Response size: ${JSON.stringify(res.data).length} bytes`);
    const r = res.data?.result;
    if (r) {
      console.log('title:', r.title);
      console.log('hid:', r.hid);
      console.log('status:', r.status);
      console.log('firstChapterUrl:', r.firstChapterUrl);
      console.log('latestChapterUrl:', r.latestChapterUrl);
      console.log('followsTotal:', r.followsTotal);
      console.log('ratedAvg:', r.ratedAvg);
      console.log('genres count:', r.genres?.length);
      console.log('authors:', r.authors?.map(a => a.title)?.join(', '));
    } else {
      console.log('Full response:', JSON.stringify(res.data).slice(0, 800));
    }
  } catch (e) {
    console.log(`FAILED: ${e.message} (status: ${e.response?.status})`);
  }
}

// ── 4. Probe /api/v1/manga/{hash}/chapters (needs signature?) ──────────────────
section(`4. /api/v1/manga/${TEST_HASH}/chapters WITHOUT signature`);
{
  try {
    const res = await axios.get(`https://comix.to/api/v1/manga/${TEST_HASH}/chapters`, {
      headers: JSON_HEADERS,
      timeout: 15000
    });
    console.log(`HTTP Status: ${res.status}`);
    console.log(`Response size: ${JSON.stringify(res.data).length} bytes`);
    console.log('Top-level keys:', Object.keys(res.data));
    const result = res.data?.result;
    if (result) {
      console.log('Result type:', typeof result);
      if (Array.isArray(result?.items)) {
        console.log('Chapter count:', result.items.length);
        console.log('First chapter:', JSON.stringify(result.items[0]).slice(0, 300));
      } else {
        console.log('Result (first 500):', JSON.stringify(result).slice(0, 500));
      }
    } else {
      console.log('Full response (first 800):', JSON.stringify(res.data).slice(0, 800));
    }
  } catch (e) {
    console.log(`FAILED: ${e.message} (status: ${e.response?.status})`);
    if (e.response?.data) {
      console.log('Error response:', JSON.stringify(e.response.data).slice(0, 300));
    }
  }
}

// ── 5. Get the firstChapterUrl and probe the chapter page #initial-data ────────
section(`5. Chapter reader page #initial-data inspection`);
let firstChapterId = null;
let firstChapterSlug = null;
{
  // We know the structure from step 2
  if (titleInitialData) {
    const queries = titleInitialData.queries;
    const detailKey = Object.keys(queries).find(k => k.includes('"detail"'));
    if (detailKey) {
      const mangaData = queries[detailKey];
      console.log('firstChapterUrl:', mangaData?.firstChapterUrl);
      console.log('latestChapterUrl:', mangaData?.latestChapterUrl);
      
      if (mangaData?.firstChapterUrl) {
        // e.g. /title/793e-arelyn-is-sick-and-tired/9777916-chapter-0
        const parts = mangaData.firstChapterUrl.split('/');
        firstChapterSlug = parts.pop(); // 9777916-chapter-0
        firstChapterId = firstChapterSlug.split('-')[0]; // 9777916
        console.log('\nFirst chapter slug:', firstChapterSlug);
        console.log('First chapter ID:', firstChapterId);
      }
      
      // Show available data from manga detail
      const fields = ['title', 'hid', 'status', 'score', 'synopsis', 'genres', 'authors', 'year', 'latestChapter', 'followsTotal'];
      for (const f of fields) {
        const v = mangaData?.[f];
        if (v !== undefined) {
          console.log(`${f}:`, typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : v);
        }
      }
    }
  }
}

if (firstChapterSlug) {
  // Fetch chapter reader page
  try {
    const res = await axios.get(`https://comix.to/title/${TEST_SLUG}/${firstChapterSlug}`, {
      headers: BASE_HEADERS,
      timeout: 15000
    });
    console.log(`\nChapter page HTTP Status: ${res.status}`);
    const chData = extractInitialData(res.data);
    if (chData) {
      console.log('\nChapter page #initial-data:');
      console.log('page:', chData.page);
      console.log('queries:', JSON.stringify(Object.keys(chData.queries)));
      
      for (const [key, value] of Object.entries(chData.queries)) {
        const parsed = JSON.parse(key);
        console.log(`\nQuery: ${JSON.stringify(parsed)}`);
        const valStr = JSON.stringify(value);
        if (valStr.length > 2000) {
          console.log(`  Value (${valStr.length} bytes, showing 2000):`);
          console.log(valStr.slice(0, 2000));
        } else {
          console.log('  Value:', valStr);
        }
      }
    }
  } catch (e) {
    console.log(`Chapter page fetch FAILED: ${e.message}`);
  }
}

// ── 6. Probe /api/v1/chapters/{id} directly (no signature) ────────────────────
if (firstChapterId) {
  section(`6. /api/v1/chapters/${firstChapterId} WITHOUT signature`);
  try {
    const res = await axios.get(`https://comix.to/api/v1/chapters/${firstChapterId}`, {
      headers: JSON_HEADERS,
      timeout: 15000
    });
    console.log(`HTTP Status: ${res.status}`);
    const result = res.data?.result;
    if (result) {
      console.log('Chapter ID:', result.id || result.hid);
      console.log('Chapter number:', result.chapter);
      console.log('Title:', result.title);
      console.log('Group:', result.group || result.scanlation_group);
      console.log('Pages data (type):', typeof result.pages);
      if (result.pages) {
        const pagesStr = JSON.stringify(result.pages);
        console.log('Pages data (first 500):', pagesStr.slice(0, 500));
      }
      console.log('Prev chapter:', result.prev || result.prevChapterUrl);
      console.log('Next chapter:', result.next || result.nextChapterUrl);
    } else {
      console.log('Full response (first 800):', JSON.stringify(res.data).slice(0, 800));
    }
  } catch (e) {
    console.log(`FAILED: ${e.message} (status: ${e.response?.status})`);
    if (e.response?.data) console.log('Error response:', JSON.stringify(e.response.data).slice(0, 300));
  }
}

// ── 7. Test the search endpoint ──────────────────────────────────────────────
section('7. /api/v1/search?q=arelyn (no signature)');
{
  try {
    const res = await axios.get(`https://comix.to/api/v1/search?q=arelyn&limit=5`, {
      headers: JSON_HEADERS,
      timeout: 15000
    });
    console.log(`HTTP Status: ${res.status}`);
    const r = res.data;
    console.log('Keys:', Object.keys(r));
    const items = r?.result?.items || r?.items || r?.results;
    if (Array.isArray(items)) {
      console.log('Result count:', items.length);
      console.log('First result:', JSON.stringify(items[0]).slice(0, 400));
    } else {
      console.log('Full (first 800):', JSON.stringify(r).slice(0, 800));
    }
  } catch (e) {
    console.log(`FAILED: ${e.message} (status: ${e.response?.status})`);
  }
}

// ── 8. Test the browse/trending endpoint ────────────────────────────────────
section('8. /api/v1/manga (top/trending, no signature)');
{
  try {
    const res = await axios.get(`https://comix.to/api/v1/manga?type=trending&days=1&limit=5&content_rating[]=safe`, {
      headers: JSON_HEADERS,
      timeout: 15000
    });
    console.log(`HTTP Status: ${res.status}`);
    const r = res.data;
    console.log('Keys:', Object.keys(r));
    const items = r?.result?.items || r?.items || r?.results;
    if (Array.isArray(items)) {
      console.log('Item count:', items.length);
      console.log('First item title:', items[0]?.title);
      console.log('First item hid:', items[0]?.hid);
    } else {
      console.log('Full (first 800):', JSON.stringify(r).slice(0, 800));
    }
  } catch (e) {
    console.log(`FAILED: ${e.message} (status: ${e.response?.status})`);
  }
}

// ── 9. Check if scanlation group info is in chapter list initial-data ─────────
section('9. Scanlation groups in chapter-list queries');
{
  // The chapter list page — what initial-data does it have?
  // comix.to typically shows chapter list on the title page itself
  if (titleInitialData) {
    const queries = titleInitialData.queries;
    for (const [key, value] of Object.entries(queries)) {
      if (JSON.stringify(key).includes('chapter') || JSON.stringify(value).includes('chapter')) {
        console.log(`Chapter-related query: ${key}`);
        const valStr = JSON.stringify(value);
        console.log(`Value (first 600): ${valStr.slice(0, 600)}`);
      }
    }
  }
}

// ── 10. Inspect the browser extension reference endpoint structure ─────────────
section('10. Testing extension-style chapter enumeration endpoint');
{
  // Browser extension may hit /api/v1/manga/{hid}/chapters?limit=99999
  try {
    const res = await axios.get(`https://comix.to/api/v1/manga/${TEST_HASH}/chapters?limit=5`, {
      headers: JSON_HEADERS,
      timeout: 15000
    });
    console.log(`HTTP Status: ${res.status}`);
    console.log('Response type:', typeof res.data);
    const valStr = JSON.stringify(res.data);
    console.log(`Response (first 800): ${valStr.slice(0, 800)}`);
  } catch (e) {
    console.log(`FAILED: ${e.message} (status: ${e.response?.status})`);
    if (e.response?.data) console.log('Error body:', JSON.stringify(e.response.data).slice(0, 400));
  }
}

console.log('\n\n' + '═'.repeat(70));
console.log('INVESTIGATION COMPLETE');
console.log('═'.repeat(70));
