import axios from "axios";

async function run() {
  try {
    const url = "https://comix.to/api/v1/manga/793e/chapters?page=1&limit=100&order[number]=desc";
    console.log("Fetching chapters from API without token...");
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://comix.to/title/793e-arelyn-is-sick-and-tired"
      }
    });
    console.log("Status:", res.status);
    console.log("Chapters length:", res.data?.result?.items?.length);
  } catch (err) {
    console.error("Fetch failed:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Response data:", JSON.stringify(err.response.data, null, 2));
    }
  }
}

run();
