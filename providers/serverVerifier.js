import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mirrorsPath = path.resolve(__dirname, "../config/api_mirrors.json");

function getMirrors() {
  try {
    if (fs.existsSync(mirrorsPath)) {
      const raw = fs.readFileSync(mirrorsPath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Failed to read API mirrors configuration, using defaults:", err.message);
  }
  return ["http://localhost:4000"];
}

export const providerStatus = {
  anikoto: { available: true, errorType: null, lastChecked: 0 },
  megavid: { available: true, errorType: null, lastChecked: 0 },
  vidcloud: { available: true, errorType: null, lastChecked: 0 },
  zokoanime: { available: true, errorType: null, lastChecked: 0 },
  anixo: { available: true, errorType: null, lastChecked: 0 },
  vidnest: { available: true, errorType: null, lastChecked: 0 },
  vidsync: { available: true, errorType: null, lastChecked: 0 },
  anilink: { available: true, errorType: null, lastChecked: 0 },
  aniembed: { available: true, errorType: null, lastChecked: 0 },
  vidbolt: { available: true, errorType: null, lastChecked: 0 },
  videm: { available: true, errorType: null, lastChecked: 0 },
  codespecters: { available: true, errorType: null, lastChecked: 0 },
  streamflizo: { available: true, errorType: null, lastChecked: 0 },
  nineanime: { available: true, errorType: null, lastChecked: 0 },
  aniwaves: { available: true, errorType: null, lastChecked: 0 },
  animepahe: { available: true, errorType: null, lastChecked: 0 },
  crunchyroll: { available: true, errorType: null, lastChecked: 0 },
  bilibili: { available: true, errorType: null, lastChecked: 0 },
  twoembed: { available: true, errorType: null, lastChecked: 0 },
  vidlink: { available: true, errorType: null, lastChecked: 0 },
  netmirror: { available: true, errorType: null, lastChecked: 0 },
  smashystream: { available: true, errorType: null, lastChecked: 0 },
  peachify: { available: true, errorType: null, lastChecked: 0 },
  cinesrc: { available: true, errorType: null, lastChecked: 0 },
  filmu: { available: true, errorType: null, lastChecked: 0 },
  vidcore: { available: true, errorType: null, lastChecked: 0 },
  vidsrcsbs: { available: true, errorType: null, lastChecked: 0 },
  embedmaster: { available: true, errorType: null, lastChecked: 0 }
};

function getErrorType(err) {
  if (!err) return "unknown";
  if (err.code === "ECONNABORTED" || err.message?.toLowerCase().includes("timeout")) {
    return "timeout";
  }
  if (err.response) {
    const status = err.response.status;
    if (status === 403) return "cloudflare";
    return String(status);
  }
  return "network";
}

async function verifyUrl(targetUrl, headers = {}) {
  const reqHeaders = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ...headers
  };
  try {
    await axios.head(targetUrl, { headers: reqHeaders, timeout: 10000 });
    return { available: true, errorType: null };
  } catch (err) {
    if (err.response) {
      // If server responded (e.g. 405 Method Not Allowed), fall back to GET
      if (err.response.status === 405 || err.response.status === 501) {
        try {
          await axios.get(targetUrl, { headers: reqHeaders, timeout: 10000, maxContentLength: 50000 });
          return { available: true, errorType: null };
        } catch (getErr) {
          if (getErr.response) {
            return { available: true, errorType: null };
          }
          return { available: false, errorType: getErrorType(getErr) };
        }
      }
      return { available: true, errorType: null };
    }
    // If HEAD failed due to network/WAF drop, try GET fallback
    try {
      await axios.get(targetUrl, { headers: reqHeaders, timeout: 10000, maxContentLength: 50000 });
      return { available: true, errorType: null };
    } catch (getErr) {
      if (getErr.response) {
        return { available: true, errorType: null };
      }
      return { available: false, errorType: getErrorType(getErr) };
    }
  }
}

async function verifyAnikoto() {
  try {
    const res = await axios.get("https://anikotoapi.site/series/8800", { timeout: 10000 });
    if (res.data && res.data.ok) {
      return { available: true, errorType: null };
    }
    return { available: false, errorType: "invalid_response" };
  } catch (err) {
    return { available: false, errorType: getErrorType(err) };
  }
}

async function verifyMegaVid() {
  return verifyUrl("https://megavid.buzz", { Referer: "https://megavid.buzz" });
}

async function verifyVidCloud() {
  return verifyUrl("https://vidcloud.sbs");
}

async function verifyZokoAnime() {
  return verifyUrl("https://zokoanime.video");
}

async function verifyAniXo() {
  return verifyUrl("https://anixo.buzz");
}

async function verifyVidNest() {
  return verifyUrl("https://vidnest.fun");
}

async function verifyVidSync() {
  return verifyUrl("https://vidsync.pro");
}

async function verifyAniLink() {
  return verifyUrl("https://anilink.cc");
}

async function verifyAniEmbed() {
  return verifyUrl("https://aniembed.se");
}

async function verifyNineAnime() {
  try {
    const res = await axios.get("https://9anime.org.lv/?s=One+Piece", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 10000
    });
    if (res.data && res.data.includes("/anime/")) {
      return { available: true, errorType: null };
    }
    return { available: false, errorType: "invalid_response" };
  } catch (err) {
    return { available: false, errorType: getErrorType(err) };
  }
}

async function verifyAniwaves() {
  try {
    const res = await axios.get("https://aniwaves.ru/filter?keyword=One+Piece", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 10000
    });
    if (res.data && res.data.includes("aniwaves.ru")) {
      return { available: true, errorType: null };
    }
    return { available: false, errorType: "invalid_response" };
  } catch (err) {
    return { available: false, errorType: getErrorType(err) };
  }
}

async function verifyTwoEmbed() {
  return verifyUrl("https://www.2embed.cc");
}

async function verifyVidLink() {
  return verifyUrl("https://vidlink.pro");
}

async function verifyNetMirror() {
  return verifyUrl("https://net27.cc");
}

async function verifyConsumetProvider(providerName) {
  const mirrors = getMirrors();
  let lastError = null;

  for (const mirrorUrl of mirrors) {
    try {
      const infoUrl = `${mirrorUrl}/meta/anilist/info/21?provider=${providerName}`;
      const resInfo = await axios.get(infoUrl, { timeout: 3000 });
      if (resInfo.data && resInfo.data.episodes?.length > 0) {
        const firstEp = resInfo.data.episodes[0];
        const watchUrl = `${mirrorUrl}/meta/anilist/watch/${encodeURIComponent(firstEp.id)}?provider=${providerName}`;
        const resWatch = await axios.get(watchUrl, { timeout: 3000 });
        if (resWatch.data && resWatch.data.sources?.length > 0) {
          return { available: true, errorType: null };
        }
      }
    } catch (err) {
      lastError = err;
    }
  }
  return { available: false, errorType: getErrorType(lastError) };
}

async function verifySmashyStream() {
  return verifyUrl("https://embed.smashystream.com");
}

export async function verifyAllServers() {
  console.log("[Server Verifier] Starting global health checks for production providers...");

  const checks = {
    anikoto: verifyAnikoto,
    megavid: verifyMegaVid,
    vidcloud: verifyVidCloud,
    zokoanime: verifyZokoAnime,
    anixo: verifyAniXo,
    vidnest: verifyVidNest,
    vidsync: verifyVidSync,
    anilink: verifyAniLink,
    aniembed: verifyAniEmbed,
    nineanime: verifyNineAnime,
    aniwaves: verifyAniwaves,
    animepahe: () => verifyConsumetProvider("animepahe"),
    crunchyroll: () => verifyConsumetProvider("crunchyroll"),
    bilibili: () => verifyConsumetProvider("bilibili"),
    videm: () => verifyUrl("https://videm.xyz"),
    vidbolt: () => verifyUrl("https://vidbolt.pro"),
    codespecters: () => verifyUrl("https://api.codespecters.com"),
    streamflizo: async () => {
      try {
        const res = await axios.get("https://streamflizoapi.top/stream/tmdb/27205", { timeout: 6000 });
        if (res.data && !res.data.includes("Invalid Request")) return { available: true, errorType: null };
        return { available: false, errorType: "400_invalid_request" };
      } catch (e) {
        return { available: false, errorType: getErrorType(e) };
      }
    },
    twoembed: verifyTwoEmbed,
    vidlink: verifyVidLink,
    netmirror: verifyNetMirror,
    smashystream: verifySmashyStream,
    peachify: () => verifyUrl("https://peachify.pro"),
    cinesrc: () => verifyUrl("https://cinesrc.st"),
    filmu: () => verifyUrl("https://embed.filmu.in"),
    vidcore: () => verifyUrl("https://vidcore.org"),
    vidsrcsbs: () => verifyUrl("https://vidsrc.sbs"),
    embedmaster: () => verifyUrl("https://embedmaster.link")
  };

  const tasks = Object.entries(checks).map(async ([provider, checkFunc]) => {
    try {
      const res = await checkFunc();
      providerStatus[provider] = { ...res, lastChecked: Date.now() };
      console.log(`[Server Verifier] Provider "${provider}": ${res.available ? "HEALTHY" : "UNHEALTHY (" + res.errorType + ")"}`);
    } catch (err) {
      providerStatus[provider] = { available: false, errorType: getErrorType(err), lastChecked: Date.now() };
      console.log(`[Server Verifier] Provider "${provider}": UNHEALTHY (${err.message})`);
    }
  });

  await Promise.allSettled(tasks);
  console.log("[Server Verifier] All provider health checks completed.");
}

export function startPeriodicHealthChecks() {
  setInterval(async () => {
    try {
      await verifyAllServers();
    } catch (e) {
      console.error("[Server Verifier] Periodic health check failed:", e.message);
    }
  }, 5 * 60 * 1000);
}

export function getAvailableServersList(category = "anime") {
  if (category === "anime") {
    return ["server1", "server2", "server3", "server4", "server5", "server6", "server7", "server8", "server9"];
  }
  return ["videm", "vidbolt", "vidlink", "codespecters", "cinesrc", "filmu", "vidcore", "vidsrcsbs", "smashystream", "twoembed", "embedmaster"];
}

