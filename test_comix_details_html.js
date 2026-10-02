import axios from "axios";

async function run() {
  try {
    const url = "https://comix.to/title/793e-arelyn-is-sick-and-tired";
    console.log("Fetching series page:", url);
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      }
    });
    console.log("Status:", res.status);
    console.log("HTML length:", res.data.length);
    
    const html = res.data;
    // Find script tag containing page data
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
      const content = match[1];
      if (content.includes("queries") && (content.includes("manga") || content.includes("chapters"))) {
        console.log("Found queries script tag of length:", content.length);
        console.log("Content snippet:", content.slice(0, 2000));
        break;
      }
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

run();
