import axios from "axios";

async function run() {
  try {
    const res = await axios.get("https://comix.to", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = res.data;
    
    // Find any hrefs
    const hrefRegex = /href="([^"]+)"/g;
    const links = new Set();
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      links.add(match[1]);
    }
    console.log("Hrefs found on homepage:", Array.from(links).slice(0, 50));

    // Find any JSON script contents
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
    while ((match = scriptRegex.exec(html)) !== null) {
      const content = match[1];
      if (content.includes("json") || content.includes("{") || content.includes("[")) {
        console.log("Found JSON-like script tag of length:", content.length);
        if (content.length < 5000) {
          console.log(content);
        } else {
          console.log(content.slice(0, 1000));
        }
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
