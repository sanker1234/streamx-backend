/**
 * INVESTIGATION ONLY — no code changes anywhere
 * Testing comix.to Next.js data endpoints
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

async function step(label, fn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP: ${label}`);
  console.log('='.repeat(60));
  try {
    const result = await fn();
    return result;
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    if (err.response) {
      console.error(`  Status: ${err.response.status}`);
      console.error(`  Body (first 300 chars): ${JSON.stringify(err.response.data).slice(0, 300)}`);
    }
    return null;
  }
}

// ── STEP 1: Get the homepage and extract buildId ──────────────────────────────
const buildId = await step('Fetch homepage and extract __NEXT_DATA__ buildId', async () => {
  const res = await axios.get('https://comix.to/', { headers: BASE_HEADERS, timeout: 15000 });
  console.log(`HTTP Status: ${res.status}`);
  
  const html = res.data;
  // Extract __NEXT_DATA__ JSON block
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (!m) {
    // Try to find buildId in script src tags
    const buildMatches = html.match(/_next\/static\/([^/'"]+)\//g);
    if (buildMatches) {
      console.log('Found in script src:', buildMatches.slice(0, 5));
    }
    // Also check for any JSON containing buildId
    const bidMatch = html.match(/"buildId":"([^"]+)"/);
    if (bidMatch) {
      console.log('buildId found in HTML:', bidMatch[1]);
      return bidMatch[1];
    }
    console.log('HTML snippet (first 2000 chars):', html.slice(0, 2000));
    throw new Error('__NEXT_DATA__ not found in homepage HTML');
  }

  const nextData = JSON.parse(m[1]);
  console.log('buildId:', nextData.buildId);
  console.log('page:', nextData.page);
  console.log('props keys:', Object.keys(nextData.props || {}));
  return nextData.buildId;
});

if (!buildId) {
  console.log('\nCould not get buildId. Trying title page directly...');
}

// ── STEP 2: Fetch title page HTML to get buildId ──────────────────────────────
// Use the manga visible in the browser: 793e-arelyn-is-sick-and-tired
const TEST_SLUG = '793e-arelyn-is-sick-and-tired';

const titleBuildId = await step(`Fetch title page HTML for ${TEST_SLUG}`, async () => {
  const res = await axios.get(`https://comix.to/title/${TEST_SLUG}`, { 
    headers: BASE_HEADERS, 
    timeout: 15000 
  });
  console.log(`HTTP Status: ${res.status}`);
  const html = res.data;
  
  // Extract __NEXT_DATA__
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (m) {
    const nextData = JSON.parse(m[1]);
    console.log('buildId:', nextData.buildId);
    console.log('page:', nextData.page);
    // Show structure
    const propKeys = Object.keys(nextData.props || {});
    console.log('props keys:', propKeys);
    
    // Try to find chapter data in the nextData
    const propsStr = JSON.stringify(nextData.props);
    
    // Check for chapter-related keys
    const hasChapters = propsStr.includes('chapter');
    const hasManga = propsStr.includes('manga') || propsStr.includes('comic');
    console.log('Has chapters data:', hasChapters);
    console.log('Has manga data:', hasManga);

    // Print pageProps
    const pp = nextData.props?.pageProps;
    if (pp) {
      console.log('\nPageProps keys:', Object.keys(pp));
      // Look for manga details
      const comicData = pp.comic || pp.manga || pp.data;
      if (comicData) {
        console.log('\nComic/manga data found:');
        console.log('  title:', comicData.title);
        console.log('  hid:', comicData.hid);
        console.log('  status:', comicData.status);
        console.log('  first_chapter:', comicData.firstChapterUrl || comicData.first_chapter_id);
        console.log('  latest_chapter:', comicData.latestChapterUrl || comicData.latest_chapter_id);
      }
      // Look for chapters list
      const chapters = pp.chapters || pp.chapterList;
      if (chapters) {
        console.log('\nChapters list found! Count:', Array.isArray(chapters) ? chapters.length : 'N/A (not array)');
        if (Array.isArray(chapters) && chapters.length > 0) {
          console.log('First chapter sample:', JSON.stringify(chapters[0]).slice(0, 300));
        }
      }
    }
    
    return nextData.buildId;
  }

  // If no __NEXT_DATA__, look for buildId in script tags
  const bidMatch = html.match(/"buildId":"([^"]+)"/);
  if (bidMatch) {
    console.log('buildId found in HTML:', bidMatch[1]);
    return bidMatch[1];
  }
  
  // Check script src for build chunks
  const srcMatches = [...html.matchAll(/_next\/static\/([A-Za-z0-9_-]+)\//g)];
  if (srcMatches.length > 0) {
    const ids = [...new Set(srcMatches.map(m => m[1]))];
    console.log('Candidate buildIds from script srcs:', ids);
    return ids[0];
  }
  
  console.log('No buildId found. HTML preview (2000 chars):\n', html.slice(0, 2000));
  return null;
});

const effectiveBuildId = buildId || titleBuildId;
if (!effectiveBuildId) {
  console.log('\nFATAL: Cannot determine buildId. Stopping investigation.');
  process.exit(1);
}

console.log(`\nUsing buildId: ${effectiveBuildId}`);

// ── STEP 3: Test /_next/data/{buildId}/title/{slug}.json ─────────────────────
await step(`Test /_next/data/{buildId}/title/${TEST_SLUG}.json`, async () => {
  const url = `https://comix.to/_next/data/${effectiveBuildId}/title/${TEST_SLUG}.json`;
  console.log('URL:', url);
  const res = await axios.get(url, { headers: JSON_HEADERS, timeout: 15000 });
  console.log(`HTTP Status: ${res.status}`);
  
  const data = res.data;
  console.log('Top-level keys:', Object.keys(data));
  
  const pp = data.pageProps;
  if (pp) {
    console.log('\nPageProps keys:', Object.keys(pp));
    
    const comic = pp.comic || pp.manga || pp.data;
    if (comic) {
      console.log('\nComic/Manga data:');
      console.log('  title:', comic.title);
      console.log('  hid:', comic.hid);
      console.log('  status:', comic.status);
      console.log('  synopsis:', (comic.synopsis || '').slice(0, 200));
      console.log('  genres:', comic.genres?.map(g => g.title || g.name)?.join(', '));
      console.log('  authors:', comic.authors?.map(a => a.title || a.name)?.join(', '));
      console.log('  year:', comic.year);
      console.log('  score:', comic.ratedAvg || comic.rated_avg || comic.score);
      console.log('  cover:', comic.poster?.large || comic.cover);
      console.log('  firstChapterUrl:', comic.firstChapterUrl);
      console.log('  latestChapterUrl:', comic.latestChapterUrl);
      console.log('  follows_total:', comic.followsTotal || comic.follows_total);
    }
    
    // Check for chapters embedded
    const chapters = pp.chapters || pp.chapterList || pp.chapter_list;
    if (chapters) {
      console.log('\nEmbedded chapters found:');
      if (Array.isArray(chapters)) {
        console.log('  Count:', chapters.length);
        console.log('  First chapter:', JSON.stringify(chapters[0]).slice(0, 300));
      }
    }
    
    // Check for scanlation groups
    const groups = pp.scanlationGroups || pp.groups || comic?.scanlation_groups;
    if (groups) {
      console.log('\nScanlation groups:', JSON.stringify(groups).slice(0, 300));
    }
    
    // Raw print for deep inspection
    console.log('\nFull pageProps (first 3000 chars):');
    console.log(JSON.stringify(pp).slice(0, 3000));
  }
  
  return data;
});

// ── STEP 4: Test with page param ──────────────────────────────────────────────
await step(`Test /_next/data/{buildId}/title/${TEST_SLUG}.json?page=2`, async () => {
  const url = `https://comix.to/_next/data/${effectiveBuildId}/title/${TEST_SLUG}.json?page=2`;
  console.log('URL:', url);
  const res = await axios.get(url, { headers: JSON_HEADERS, timeout: 15000 });
  console.log(`HTTP Status: ${res.status}`);
  const pp = res.data?.pageProps;
  console.log('PageProps keys:', Object.keys(pp || {}));
  const chapters = pp?.chapters || pp?.chapterList;
  if (chapters) {
    console.log('Chapters on page 2 count:', chapters.length);
    console.log('First item:', JSON.stringify(chapters[0]).slice(0, 300));
  } else {
    console.log('Full pageProps (first 2000 chars):', JSON.stringify(pp).slice(0, 2000));
  }
  return res.data;
});

// ── STEP 5: Find the chapter reader page structure ────────────────────────────
// From firstChapterUrl, find the chapter slug/ID
await step('Test chapter reader page __NEXT_DATA__', async () => {
  // We know 793e-arelyn-is-sick-and-tired has chapters
  // Try to find firstChapterUrl from step 3 and test the reader endpoint
  const titleRes = await axios.get(`https://comix.to/title/${TEST_SLUG}`, {
    headers: BASE_HEADERS,
    timeout: 15000
  });
  const html = titleRes.data;
  
  // Try to find chapter links
  const chapterLinkMatches = [...html.matchAll(/href="(\/title\/[^"]+\/[^"]+)"/g)];
  const chapterLinks = [...new Set(chapterLinkMatches.map(m => m[1]))].slice(0, 5);
  console.log('Chapter links found:', chapterLinks);
  
  // Also check for firstChapterUrl in JSON
  const firstChapterMatch = html.match(/"firstChapterUrl"\s*:\s*"([^"]+)"/);
  const latestChapterMatch = html.match(/"latestChapterUrl"\s*:\s*"([^"]+)"/);
  console.log('firstChapterUrl:', firstChapterMatch?.[1]);
  console.log('latestChapterUrl:', latestChapterMatch?.[1]);
  
  return { chapterLinks, firstChapterUrl: firstChapterMatch?.[1] };
});

// ── STEP 6: Test the /_next/data/{buildId}/title/{slug}/{chapterId}.json ──────
await step('Test chapter reader _next/data endpoint', async () => {
  // Use a known chapter ID — from the title page URL pattern
  // e.g., /title/793e-arelyn-is-sick-and-tired/793e-chapter-1
  // The chapter URL slug is typically {hashId}-chapter-{n}
  // First fetch the title to get the actual chapter slug
  const titleRes = await axios.get(`https://comix.to/title/${TEST_SLUG}`, {
    headers: BASE_HEADERS,
    timeout: 15000
  });
  const html = titleRes.data;
  
  // Extract firstChapterUrl
  const firstChapterMatch = html.match(/"firstChapterUrl"\s*:\s*"([^"]+)"/);
  if (!firstChapterMatch) {
    // Try to find any chapter path
    const chapterPathMatch = html.match(/\/title\/793e-arelyn-is-sick-and-tired\/([^"'\s]+)/);
    if (chapterPathMatch) {
      console.log('Found chapter path:', chapterPathMatch[0]);
    }
    throw new Error('Could not find firstChapterUrl');
  }
  
  // firstChapterUrl format: /title/{slug}/{chapterSlug}
  const chapterPath = firstChapterMatch[1]; // e.g. /title/793e-arelyn-is-sick-and-tired/9777916-chapter-0
  const chapterSlug = chapterPath.split('/').pop(); // e.g. 9777916-chapter-0
  console.log('Chapter path:', chapterPath);
  console.log('Chapter slug:', chapterSlug);
  
  // Now test /_next/data/{buildId}/title/{slug}/{chapterSlug}.json
  const url = `https://comix.to/_next/data/${effectiveBuildId}/title/${TEST_SLUG}/${chapterSlug}.json`;
  console.log('Testing URL:', url);
  
  const res = await axios.get(url, { headers: JSON_HEADERS, timeout: 20000 });
  console.log(`HTTP Status: ${res.status}`);
  
  const pp = res.data?.pageProps;
  console.log('PageProps keys:', Object.keys(pp || {}));
  
  // Look for pages/images
  const chapter = pp?.chapter || pp?.chapterData;
  const pages = pp?.pages || pp?.images || chapter?.pages;
  
  if (chapter) {
    console.log('\nChapter data:');
    console.log('  id:', chapter.id || chapter.hid);
    console.log('  chapter:', chapter.chapter);
    console.log('  title:', chapter.title);
    console.log('  group:', chapter.group || chapter.scanlation_group);
    console.log('  prev:', chapter.prev || chapter.prevChapterUrl);
    console.log('  next:', chapter.next || chapter.nextChapterUrl);
  }
  
  if (pages) {
    console.log('\nPages/Images found:');
    console.log('  Count:', Array.isArray(pages) ? pages.length : 'not an array');
    if (Array.isArray(pages) && pages.length > 0) {
      console.log('  First page:', JSON.stringify(pages[0]));
      console.log('  Second page:', JSON.stringify(pages[1]));
    }
  }
  
  // Full dump of pageProps
  console.log('\nFull pageProps (first 4000 chars):');
  console.log(JSON.stringify(pp).slice(0, 4000));
  
  return res.data;
});

console.log('\n\n' + '='.repeat(60));
console.log('INVESTIGATION COMPLETE');
console.log('='.repeat(60));
