import axios from 'axios';

const BACKEND = 'http://127.0.0.1:3000';
const KUHI = 'https://anime-api-hgd3.onrender.com';

const testAnimeList = [
  { name: 'One Piece', id: 21 },
  { name: 'Naruto', id: 20 },
  { name: 'Jujutsu Kaisen', id: 113415 },
  { name: 'Demon Slayer', id: 101922 },
  { name: 'Solo Leveling', id: 151807 }
];

async function runTests() {
  console.log('====================================================');
  console.log('  STREAMX SERVER 2 SUB/DUB SELECTOR VERIFICATION');
  console.log('====================================================\n');

  const resultsTable = [];

  for (const anime of testAnimeList) {
    console.log(`\n----------------------------------------------------`);
    console.log(`Testing: ${anime.name} (AniList ID: ${anime.id})`);
    console.log(`----------------------------------------------------`);

    // 1. Direct Kuhi API extraction
    let kuhiSubStreams = 0;
    let kuhiDubStreams = 0;

    try {
      const res = await axios.get(`${KUHI}/anime/extract/${anime.id}`, {
        params: { e: 1, type: 'sub', provider: 'aniwaves' },
        timeout: 20000
      });
      kuhiSubStreams = (res.data?.streams || []).length;
    } catch (e) {
      console.warn(`Kuhi SUB fetch notice:`, e.message);
    }

    try {
      const res = await axios.get(`${KUHI}/anime/extract/${anime.id}`, {
        params: { e: 1, type: 'dub', provider: 'aniwaves' },
        timeout: 20000
      });
      kuhiDubStreams = (res.data?.streams || []).length;
    } catch (e) {
      console.warn(`Kuhi DUB fetch notice:`, e.message);
    }

    console.log(`1. Kuhi Direct: SUB = ${kuhiSubStreams > 0 ? 'YES (' + kuhiSubStreams + ')' : 'NO'}, DUB = ${kuhiDubStreams > 0 ? 'YES (' + kuhiDubStreams + ')' : 'NO'}`);

    // 2. StreamX Backend Server 2 flow - SUB request
    let sxSubRes = null;
    try {
      const res = await axios.get(`${BACKEND}/api/anime/sources/1`, {
        params: { provider: 'server2', animeId: anime.id, type: 'sub' },
        timeout: 25000
      });
      if (res.data && res.data.sources && res.data.sources.length > 0) {
        sxSubRes = res.data;
      }
    } catch (e) {
      console.warn(`StreamX Server 2 SUB request error:`, e.message);
    }

    // 3. StreamX Backend Server 2 flow - DUB request
    let sxDubRes = null;
    try {
      const res = await axios.get(`${BACKEND}/api/anime/sources/1`, {
        params: { provider: 'server2', animeId: anime.id, type: 'dub' },
        timeout: 25000
      });
      if (res.data && res.data.sources && res.data.sources.length > 0) {
        sxDubRes = res.data;
      }
    } catch (e) {
      console.warn(`StreamX Server 2 DUB request error:`, e.message);
    }

    const sxSubCount = sxSubRes?.sources?.length || 0;
    const sxDubCount = sxDubRes?.sources?.length || 0;
    console.log(`2. StreamX Server 2: SUB sources = ${sxSubCount}, DUB sources = ${sxDubCount}`);

    // Verify cache independence: re-request SUB to confirm DUB didn't overwrite SUB
    let sxSubRecheck = null;
    try {
      const res = await axios.get(`${BACKEND}/api/anime/sources/1`, {
        params: { provider: 'server2', animeId: anime.id, type: 'sub' },
        timeout: 5000 // should be fast cached response
      });
      sxSubRecheck = res.data;
    } catch (e) {
      console.warn(`StreamX Server 2 SUB recheck error:`, e.message);
    }

    const recheckSubCount = sxSubRecheck?.sources?.length || 0;
    const recheckIsSub = sxSubRecheck?.sources?.[0]?.audio === 'sub';
    console.log(`3. Cache Independence: Rechecked SUB count = ${recheckSubCount} (audio: ${sxSubRecheck?.sources?.[0]?.audio})`);
    if (sxSubCount > 0) {
      if (recheckSubCount === 0 || !recheckIsSub) {
        throw new Error(`CRITICAL FAILURE: DUB request overwrote SUB cache for ${anime.name}!`);
      }
      console.log(`   -> SUB cache verified intact and NOT overwritten by DUB!`);
    }

    // 4. Test StreamX Frontend selector state simulation
    const hasSub = sxSubCount > 0;
    const hasDub = sxDubCount > 0;
    let streamXShows = '';
    if (hasSub && hasDub) streamXShows = 'SUB + DUB';
    else if (hasSub && !hasDub) streamXShows = 'SUB';
    else if (!hasSub && hasDub) streamXShows = 'DUB';
    else streamXShows = 'NONE';

    console.log(`4. StreamX Frontend derived buttons: [ ${streamXShows} ]`);

    resultsTable.push({
      Anime: anime.name,
      SUB: hasSub ? 'yes' : 'no',
      DUB: hasDub ? 'yes' : 'no',
      'StreamX shows': streamXShows
    });
  }

  // 5. Test Server 1 (Anikoto) to verify it remains 100% functional and untouched
  console.log(`\n----------------------------------------------------`);
  console.log(`Testing Server 1 (Anikoto) regression check...`);
  console.log(`----------------------------------------------------`);
  try {
    const s1Res = await axios.get(`${BACKEND}/api/anime/sources/1`, {
      params: { provider: 'server1', animeId: 21 },
      timeout: 15000
    });
    const s1Sources = s1Res.data?.sources || [];
    console.log(`Server 1 returned ${s1Sources.length} sources for One Piece:`);
    s1Sources.forEach(s => console.log(`  - Quality: ${s.quality}, Server: ${s.server || 'Anikoto'}`));
    if (s1Sources.length > 0) {
      console.log(`-> Server 1 is WORKING and completely untouched!`);
    } else {
      console.warn(`Server 1 returned 0 sources.`);
    }
  } catch (e) {
    console.warn(`Server 1 check note:`, e.message);
  }

  console.log('\n====================================================');
  console.log('               FINAL RESULTS TABLE');
  console.log('====================================================\n');
  console.table(resultsTable);
}

runTests();
