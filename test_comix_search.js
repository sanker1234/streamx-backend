import axios from "axios";

async function run() {
  try {
    const url = "https://comix.to/api/v1/manga?keyword=Solo%20Leveling&limit=28&order[relevance]=desc";
    console.log("Searching comix.to for Solo Leveling...");
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://comix.to/"
      }
    });
    console.log("Status:", res.status);
    console.log("Result items length:", res.data?.result?.items?.length);
    console.log("First item:", JSON.stringify(res.data?.result?.items?.[0], null, 2));
  } catch (err) {
    console.error("Search failed:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Body snippet:", String(err.response.data).slice(0, 1000));
    }
  }
}

run();
