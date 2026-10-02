import axios from "axios";
import * as cheerio from "cheerio";

async function run() {
  const query = "Attack on Titan";
  console.log("Searching Anix for:", query);
  
  try {
    const res = await axios.get(`https://anix.com.pl/?s=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(res.data);
    const results = [];
    
    $(".film-list .film-item, .film_list-wrap .flw-item").each((i, el) => {
      const titleEl = $(el).find(".film-name a, .film-detail .film-name a");
      const href = titleEl.attr("href");
      const title = titleEl.text().trim();
      
      if (href) {
        const slug = href.split("/anime/")[1]?.replace("/", "") || href.split("/").filter(Boolean).pop();
        results.push({ id: slug, title });
      }
    });
    
    console.log("Found candidates count:", results.length);
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error("Search failed:", err.message);
  }
}

run();
