// streamx-backend/test_kuhi_integration.js
import axios from "axios";

const BACKEND_URL = "http://localhost:3000";
const RENDER_URL = "https://anime-api-hgd3.onrender.com";

async function runTests() {
  console.log("=== 1. TESTING RENDER API DIRECTLY ===");

  // 1.1 Direct Search
  try {
    const res = await axios.get(`${RENDER_URL}/anime/search?query=naruto&page=1&per_page=3`, { timeout: 20000 });
    console.log("✅ Render Direct Search:", res.status === 200 && res.data.results?.length > 0 ? "PASS" : "FAIL");
  } catch (e) {
    console.error("❌ Render Direct Search Failed:", e.message);
  }

  // 1.2 Direct Info
  try {
    const res = await axios.get(`${RENDER_URL}/anime/info/20`, { timeout: 20000 });
    console.log("✅ Render Direct Info:", res.status === 200 && res.data.id === 20 ? "PASS" : "FAIL");
  } catch (e) {
    console.error("❌ Render Direct Info Failed:", e.message);
  }

  // 1.3 Direct Episodes
  try {
    const res = await axios.get(`${RENDER_URL}/anime/episodes/20`, { timeout: 25000 });
    const hasProviders = res.status === 200 && Object.keys(res.data.providers || {}).length > 0;
    console.log("✅ Render Direct Episodes:", hasProviders ? "PASS" : "FAIL");
  } catch (e) {
    console.error("❌ Render Direct Episodes Failed:", e.message);
  }

  // 1.4 Direct Extract
  try {
    const res = await axios.get(`${RENDER_URL}/anime/extract/20?e=1&type=sub`, { timeout: 25000 });
    const hasStreams = res.status === 200 && res.data.streams?.length > 0;
    console.log("✅ Render Direct Extract:", hasStreams ? "PASS" : "FAIL");
    if (hasStreams) {
      console.log("   Found", res.data.streams.length, "streams. First stream type:", res.data.streams[0].type);
    }
  } catch (e) {
    console.error("❌ Render Direct Extract Failed:", e.message);
  }

  console.log("\n=== 2. TESTING STREAMX BACKEND ENDPOINTS ===");

  // 2.1 Backend Search
  try {
    const res = await axios.get(`${BACKEND_URL}/api/anime/search?q=naruto`, { timeout: 10000 });
    const pass = res.status === 200 && res.data.results?.length > 0 && res.data.results[0].title;
    console.log("✅ StreamX Search:", pass ? "PASS" : "FAIL");
  } catch (e) {
    console.error("❌ StreamX Search Failed:", e.message);
  }

  // 2.2 Backend Details
  try {
    const res = await axios.get(`${BACKEND_URL}/api/anime/details/20`, { timeout: 10000 });
    const pass = res.status === 200 && res.data.id === 20 && res.data.title;
    console.log("✅ StreamX Details:", pass ? "PASS" : "FAIL");
  } catch (e) {
    console.error("❌ StreamX Details Failed:", e.message);
  }

  // 2.3 Backend Episodes (server1 - Anikoto primary)
  try {
    const res = await axios.get(`${BACKEND_URL}/api/anime/episodes/20?provider=server1`, { timeout: 15000 });
    const pass = res.status === 200 && res.data.episodes?.length > 0;
    console.log("✅ StreamX Episodes (Primary Anikoto):", pass ? "PASS" : "FAIL", `(${res.data.episodes?.length} eps resolved)`);
  } catch (e) {
    console.error("❌ StreamX Episodes (Primary Anikoto) Failed:", e.message);
  }

  // 2.4 Backend Episodes (server2 - Kuhi fallback)
  try {
    const res = await axios.get(`${BACKEND_URL}/api/anime/episodes/20?provider=server2`, { timeout: 15000 });
    const pass = res.status === 200 && res.data.episodes?.length > 0;
    console.log("✅ StreamX Episodes (Fallback Kuhi):", pass ? "PASS" : "FAIL", `(${res.data.episodes?.length} eps resolved)`);
  } catch (e) {
    console.error("❌ StreamX Episodes (Fallback Kuhi) Failed:", e.message);
  }

  // 2.5 Backend Sources (server2 - Kuhi extraction)
  try {
    const res = await axios.get(`${BACKEND_URL}/api/anime/sources/1?provider=server2&animeId=20`, { timeout: 15000 });
    const pass = res.status === 200 && res.data.sources?.length > 0;
    console.log("✅ StreamX Sources (Kuhi Provider):", pass ? "PASS" : "FAIL");
    if (pass) {
      console.log("   Sources count:", res.data.sources.length);
      console.log("   Sample source:", JSON.stringify(res.data.sources[0]));
      console.log("   Headers present:", Boolean(res.data.headers));
    }
  } catch (e) {
    console.error("❌ StreamX Sources (Kuhi Provider) Failed:", e.message);
  }

  // 2.6 Backend Sources (server1 - Anikoto)
  try {
    const res = await axios.get(`${BACKEND_URL}/api/anime/sources/28527?provider=server1&animeId=20`, { timeout: 15000 });
    const pass = res.status === 200 && res.data.sources?.length > 0;
    console.log("✅ StreamX Sources (Anikoto Provider):", pass ? "PASS" : "FAIL");
  } catch (e) {
    console.warn("⚠️ StreamX Sources (Anikoto):", e.message);
  }

  console.log("\n=== 3. VERIFYING FALLBACK BEHAVIOR ===");
  // Test fallback: request with a non-existent or failing episode on server1, ensure it falls through to Kuhi
  try {
    // Episode ID "1" with animeId 20: Anikoto doesn't have ID "1" (Anikoto uses 5-digit database IDs like 28527),
    // so Anikoto fails and fallback should automatically kick in to Kuhi!
    const res = await axios.get(`${BACKEND_URL}/api/anime/sources/1?provider=server1&animeId=20`, { timeout: 20000 });
    console.log("✅ Fallback Execution (Anikoto -> Kuhi):", res.data.sources?.length > 0 ? "PASS" : "FAIL");
    console.log("   Resolved Server:", res.data.provider);
  } catch (e) {
    console.error("❌ Fallback test failed:", e.message);
  }

  console.log("\n=== CLI TESTS COMPLETED ===");
}

runTests();
