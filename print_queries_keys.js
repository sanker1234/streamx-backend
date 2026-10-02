import axios from "axios";

async function run() {
  try {
    const url = "https://comix.to/title/793e-arelyn-is-sick-and-tired";
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = res.data;
    
    // Search for anchor tags containing /title/793e
    const linkRegex = /href="\/title\/793e([^"]+)"/g;
    const links = new Set();
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      links.add(match[1]);
    }
    console.log("Chapter paths found in HTML:", Array.from(links));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
