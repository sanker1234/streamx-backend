import axios from "axios";
import fs from "fs";

async function run() {
  try {
    const url = "https://comix.to/title/793e-arelyn-is-sick-and-tired/2869665-chapter-1";
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = res.data;
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
      const content = match[1];
      if (content.includes("queries")) {
        fs.writeFileSync("queries_chapter.json", content.trim());
        console.log("queries_chapter.json saved! Length:", content.length);
        const parsed = JSON.parse(content.trim());
        console.log("Root keys:", Object.keys(parsed));
        if (parsed.queries) {
          console.log("Query keys:", Object.keys(parsed.queries));
        }
        break;
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
