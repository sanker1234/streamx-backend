import axios from "axios";

async function run() {
  try {
    const url = "https://comix.to/title/01-solo-leveling";
    console.log("Fetching series page:", url);
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      }
    });
    console.log("Status:", res.status);
    console.log("HTML length:", res.data.length);
    
    // Check if the HTML contains any chapter urls
    const raw = res.data;
    const CHAPTER_PATH_REGEX = /\/title\/[a-z0-9-]+\/\d+-chapter-[\w.-]+/gi;
    const matches = raw.match(CHAPTER_PATH_REGEX) || [];
    console.log("Matched chapter URLs in HTML:", matches.length);
    console.log("Unique chapter URLs:", [...new Set(matches)].slice(0, 10));
  } catch (err) {
    console.error("Fetch failed:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
    }
  }
}

run();
