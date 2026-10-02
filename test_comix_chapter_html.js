import axios from "axios";

async function run() {
  try {
    const url = "https://comix.to/title/793e-arelyn-is-sick-and-tired/2869665-chapter-1";
    console.log("Fetching chapter page:", url);
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      }
    });
    console.log("Status:", res.status);
    console.log("HTML length:", res.data.length);
    
    const html = res.data;
    // Let's search for image urls (e.g. containing .webp, .jpg, static.comix.to, etc.)
    const imageUrlRegex = /https?:\/\/[^\s"'<>\\]+\.(?:webp|jpg|jpeg|png|avif)/gi;
    const matches = html.match(imageUrlRegex) || [];
    console.log("Found image URL matches in HTML:", matches.length);
    console.log("Unique matches:", [...new Set(matches)].slice(0, 10));

    // Find script tags containing queries or page state
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
      const content = match[1];
      if (content.includes("queries")) {
        console.log("Found queries script in chapter page of length:", content.length);
        console.log("Snippet:", content.slice(0, 2000));
        break;
      }
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

run();
