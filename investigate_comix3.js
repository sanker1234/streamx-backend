/**
 * INVESTIGATION ONLY - Final targeted probes
 * Focus: Can we enumerate chapters + get page image URLs without signature?
 */
import axios from 'axios';

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Cache-Control': 'no-cache',
  'Referer': 'https://comix.to/',
};

const JSON_HEADERS = { ...BASE_HEADERS, 'Accept': 'application/json, text/plain, */*' };

function sep(t) { console.log(`\n${'═'.repeat(70)}\n  ${t}\n${'═'.repeat(70)}`); }

function extractInitialData(html) {
  const m = html.match(/<script type="application\/json" id="initial-data">([^<]+)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}

// ── 1: Full detail query from title page ─────────────────────────────────────
sep('1. Complete manga detail query from title page');
{
  const res = await axios.get(`https://comix.to/title/793e-arelyn-is-sick-and-tired`, {
    headers: BASE_HEADERS, timeout: 20000
  });
  const data = extractInitialData(res.data);
  const queries = data?.queries || {};
  const detailKey = Object.keys(queries).find(k => k.includes('"detail"'));
  if (detailKey) {
    const detail = queries[detailKey];
    console.log('ALL fields available in detail query:');
    console.log(JSON.stringify(Object.keys(detail), null, 2));
    console.log('\nFull detail object:');
    console.log(JSON.stringify(detail, null, 2).slice(0, 8000));
  }
}

// ── 2: Can we enumerate all chapters through title page pagination? ───────────
// The SPA shows chapters but must load them from somewhere.
// Test if there is a chapter-list specific page or query
sep('2. Chapter list enumeration — direct scraping of title page with chapter list');
{
  // comix.to title pages have chapter tabs — try different URL patterns
  const urls = [
    'https://comix.to/title/793e-arelyn-is-sick-and-tired/chapters',
    'https://comix.to/title/793e-arelyn-is-sick-and-tired?page=1',
    'https://comix.to/title/793e-arelyn-is-sick-and-tired?tab=chapters',
  ];
  
  for (const url of urls) {
    try {
      const res = await axios.get(url, { headers: BASE_HEADERS, timeout: 12000 });
      console.log(`${url}: ${res.status} (${res.data.length} bytes)`);
      const data = extractInitialData(res.data);
      if (data) {
        const qKeys = Object.keys(data.queries);
        console.log('  Queries:', qKeys);
        // Check for chapter data
        for (const [k, v] of Object.entries(data.queries)) {
          if (JSON.stringify(k).includes('chapter') || JSON.stringify(v).includes('chapter_id') || JSON.stringify(v).includes('"chapter"')) {
            console.log('  CHAPTER DATA FOUND in query:', k);
            console.log('  Value:', JSON.stringify(v).slice(0, 600));
          }
        }
      }
    } catch (e) {
      console.log(`${url}: FAILED (${e.response?.status || e.message})`);
    }
  }
}

// ── 3: Test signed chapter list endpoint (what does the SPA actually call?) ───
// The cfg token from the HTML can be used to bypass the signature
sep('3. Chapter list with cfg token from HTML (signature bypass?)');
{
  // First get the cfg token from the homepage
  const homeRes = await axios.get('https://comix.to/', { headers: BASE_HEADERS, timeout: 15000 });
  const cfgMatch = homeRes.data.match(/name="cfg" content="([^"]+)"/);
  const cfgToken = cfgMatch?.[1];
  console.log('cfg token:', cfgToken ? cfgToken.slice(0, 30) + '...' : 'NOT FOUND');
  
  if (cfgToken) {
    // Try using the cfg token directly as a bearer or param
    const tests = [
      // As _ param (what the signed endpoint expects)
      `https://comix.to/api/v1/manga/793e/chapters?_=${cfgToken}&limit=5`,
      // As Authorization header
      null, // placeholder
    ];
    
    try {
      const res = await axios.get(tests[0], {
        headers: { ...JSON_HEADERS, 'X-Cfg': cfgToken },
        timeout: 10000
      });
      console.log(`cfg as _param: ${res.status}`);
      console.log(JSON.stringify(res.data).slice(0, 400));
    } catch (e) {
      console.log(`cfg as _param: FAILED (${e.response?.status || e.message})`);
      if (e.response?.data) console.log('Error:', JSON.stringify(e.response.data).slice(0, 200));
    }
  }
}

// ── 4: Probe the SPA asset JS for API call patterns ──────────────────────────
sep('4. Reverse engineer SPA JS for API call patterns');
{
  // Get the main JS bundle URL
  const homeRes = await axios.get('https://comix.to/', { headers: BASE_HEADERS, timeout: 15000 });
  const mainJsMatch = homeRes.data.match(/src="(\/assets\/build\/[^"]+main[^"]+\.js)"/);
  if (mainJsMatch) {
    console.log('Main JS URL:', mainJsMatch[1]);
    try {
      const jsRes = await axios.get(`https://comix.to${mainJsMatch[1]}`, {
        headers: { ...JSON_HEADERS, 'Accept': '*/*' },
        timeout: 30000
      });
      const js = jsRes.data;
      console.log(`Main JS size: ${js.length} bytes`);
      
      // Search for chapter-related API calls
      const chapterApiPatterns = [
        /\/api\/v1\/chapters\/[^"'`]+/g,
        /\/api\/v1\/manga\/[^"'`]+\/chapters/g,
        /chapters.*?url.*?['"]/g,
      ];
      
      for (const pattern of chapterApiPatterns) {
        const matches = [...js.matchAll(pattern)].map(m => m[0]).slice(0, 5);
        if (matches.length > 0) {
          console.log(`Pattern ${pattern.source}:`);
          matches.forEach(m => console.log('  ', m.slice(0, 200)));
        }
      }
      
      // Search for "pages" pattern
      const pagesIdx = js.indexOf('"pages"');
      if (pagesIdx > -1) {
        console.log('\n"pages" found at offset', pagesIdx);
        console.log('Context:', js.slice(Math.max(0, pagesIdx - 100), pagesIdx + 200));
      }
      
      // Search for "baseUrl" which is in page data
      const baseUrlIdx = js.indexOf('"baseUrl"');
      if (baseUrlIdx > -1) {
        console.log('\n"baseUrl" found at offset', baseUrlIdx);
        console.log('Context:', js.slice(Math.max(0, baseUrlIdx - 100), baseUrlIdx + 200));
      }
      
      // Search for the chapter read endpoint pattern
      const readPattern = [...js.matchAll(/\/api\/v1\/chapters\//g)];
      console.log(`\n/api/v1/chapters/ occurrences in JS: ${readPattern.length}`);
      
      // Search for chapter list endpoint
      const chListPattern = [...js.matchAll(/\/manga\/.*\/chapters/g)];
      console.log(`/manga/{id}/chapters occurrences: ${chListPattern.length}`);
      
      // Find what queries exist
      const queryMatches = [...js.matchAll(/"(manga|chapter|read|search)".*?"(detail|list|chapters|search|top|groups|read)"/g)];
      console.log('\nQuery key patterns found:', queryMatches.slice(0, 10).map(m => m[0]));
      
    } catch (e) {
      console.log(`Failed to fetch main JS: ${e.message}`);
    }
  } else {
    console.log('Main JS URL not found in HTML');
    // Show what asset URLs we have
    const assetMatches = [...homeRes.data.matchAll(/src="(\/assets\/[^"]+)"/g)].map(m => m[1]);
    console.log('Asset URLs:', assetMatches);
  }
}

// ── 5: Try accessing chapter list through HTML scraping ──────────────────────
sep('5. HTML scraping: Can chapter links be extracted from title page?');
{
  const res = await axios.get('https://comix.to/title/793e-arelyn-is-sick-and-tired', {
    headers: BASE_HEADERS, timeout: 20000
  });
  const html = res.data;
  
  // Look for chapter anchors
  const chapterLinks = [...html.matchAll(/href="(\/title\/793e[^"]+chapter[^"]+)"/g)].map(m => m[1]);
  console.log(`Chapter links in HTML: ${chapterLinks.length}`);
  chapterLinks.slice(0, 5).forEach(l => console.log(' ', l));
  
  // Look for chapter IDs
  const chapterIds = [...html.matchAll(/\/(\d+)-chapter-(\d+)/g)].map(m => ({
    id: m[1],
    chapter: m[2],
    full: m[0]
  }));
  console.log(`\nChapter ID patterns: ${chapterIds.length}`);
  chapterIds.slice(0, 5).forEach(c => console.log(' ', JSON.stringify(c)));
  
  // Check if the SPA pre-renders any chapter data
  const initialData = extractInitialData(html);
  if (initialData) {
    const q = initialData.queries;
    // Look for anything that lists chapters
    const chapterListQuery = Object.entries(q).find(([k, v]) => {
      const vStr = JSON.stringify(v);
      return vStr.includes('"chapter"') && vStr.includes('"id"') && Array.isArray(v?.items);
    });
    if (chapterListQuery) {
      console.log('\n✅ CHAPTER LIST FOUND IN INITIAL DATA!');
      console.log('Key:', chapterListQuery[0]);
      console.log('Items count:', chapterListQuery[1].items?.length);
      console.log('First item:', JSON.stringify(chapterListQuery[1].items?.[0]));
    } else {
      console.log('\n❌ No chapter list in initial-data queries');
      console.log('All queries:', Object.keys(q));
    }
  }
}

// ── 6: Test the extension-referenced endpoint format ────────────────────────
// The user mentioned browser extension uses /_next/data/ - let's check if
// this might be a DIFFERENT site that inspired comix.to, like comick.io
sep('6. Architecture clarification — comick.io vs comix.to');
{
  // The extension might target comick.io (which IS Next.js based)
  try {
    const res = await axios.get('https://comick.io/', { 
      headers: BASE_HEADERS, timeout: 10000 
    });
    const m = res.data.match(/"buildId":"([^"]+)"/);
    if (m) {
      console.log('comick.io buildId:', m[1]);
      console.log('comick.io IS Next.js!');
      
      // Test the _next/data endpoint
      const testSlug = 'arelyn-is-sick-and-tired-F793G';  // example
      const nextUrl = `https://comick.io/_next/data/${m[1]}/comic/arelyn-is-sick-and-tired-F793G.json`;
      console.log('Test URL:', nextUrl);
      
      try {
        const r2 = await axios.get(nextUrl, { headers: JSON_HEADERS, timeout: 10000 });
        console.log('Status:', r2.status);
        console.log('Response keys:', Object.keys(r2.data));
        const pp = r2.data?.pageProps;
        console.log('pageProps keys:', Object.keys(pp || {}));
      } catch (e2) {
        console.log('_next/data test:', e2.response?.status || e2.message);
      }
    }
  } catch (e) {
    console.log('comick.io:', e.response?.status || e.message);
  }
  
  // Also test comick.fun
  try {
    const res2 = await axios.get('https://comick.fun/', { 
      headers: BASE_HEADERS, timeout: 10000 
    });
    const m2 = res2.data.match(/"buildId":"([^"]+)"/);
    if (m2) {
      console.log('\ncomick.fun buildId:', m2[1]);
      console.log('comick.fun IS Next.js!');
    }
    console.log('comick.fun: HTTP', res2.status);
  } catch (e) {
    console.log('comick.fun:', e.response?.status || e.message);
  }
}

// ── 7: Comprehensive summary of what's accessible from SSR ───────────────────
sep('7. SUMMARY: What SSR #initial-data provides without any token');
{
  const res = await axios.get('https://comix.to/title/793e-arelyn-is-sick-and-tired', {
    headers: BASE_HEADERS, timeout: 20000
  });
  const data = extractInitialData(res.data);
  if (!data) { console.log('No initial data'); }
  else {
    const detail = Object.values(data.queries).find(v => v?.hid === '793e');
    if (detail) {
      console.log('\n✅ FROM SSR (no token required):');
      const available = [];
      const missing = [];
      
      const checks = {
        'title': detail.title,
        'hid (hash id)': detail.hid,
        'synopsis': detail.synopsis?.slice(0, 50),
        'status': detail.status,
        'originalLanguage': detail.originalLanguage,
        'year': detail.year,
        'cover (poster.large)': detail.poster?.large,
        'latestChapter': detail.latestChapter,
        'firstChapterUrl': detail.firstChapterUrl,
        'latestChapterUrl': detail.latestChapterUrl,
        'genres': detail.genres?.map(g=>g.title)?.join(', '),
        'authors': detail.authors?.map(a=>a.title)?.join(', '),
        'followsTotal': detail.followsTotal,
        'ratedAvg': detail.ratedAvg,
        'ratedCount': detail.ratedCount,
        'type (manhwa/manga)': detail.type,
        'rank': detail.rank,
        'links (external)': detail.links,
        'altTitles': detail.altTitles?.length > 0 ? `${detail.altTitles.length} titles` : null,
        'contentRating': detail.contentRating,
      };
      
      for (const [k, v] of Object.entries(checks)) {
        if (v !== null && v !== undefined && v !== '' && v !== false) {
          available.push(`  ✅ ${k}: ${JSON.stringify(v).slice(0, 80)}`);
        } else {
          missing.push(`  ❌ ${k}`);
        }
      }
      
      console.log(available.join('\n'));
      if (missing.length > 0) {
        console.log('\n❌ NOT in SSR detail query:');
        console.log(missing.join('\n'));
      }
    }
    
    // Scanlation groups (separate query)
    const groups = Object.values(data.queries).find(v => Array.isArray(v) && v[0]?.slug);
    if (groups) {
      console.log('\n✅ Scanlation groups: AVAILABLE from SSR');
      console.log('  Count:', groups.length);
      console.log('  Sample:', groups.slice(0, 3).map(g => g.name).join(', '));
    }
    
    // What's DEFINITELY NOT available
    console.log('\n\n❌ FROM SSR: NOT AVAILABLE (require protected API):');
    console.log('  ❌ Chapter list (chapter_id, chapter number, upload_date per chapter)');
    console.log('  ❌ Page image URLs for any chapter');
    console.log('  ❌ Page scramble info (page.s === 1 or 0)');
    console.log('  ❌ CDN baseUrl for image delivery');
    console.log('  ❌ prev/next chapter navigation from reader (not in SSR)');
    console.log('  ❌ Scanlation group per chapter (only global groups for manga)');
    console.log('  ❌ Chapter upload dates');
  }
}

console.log('\n\n' + '═'.repeat(70));
console.log('FINAL INVESTIGATION COMPLETE');
console.log('═'.repeat(70));
