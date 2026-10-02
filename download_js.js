import axios from "axios";
import fs from "fs";

async function run() {
  try {
    const url = "https://comix.to/assets/build/35595e3de3c99889c1aa70/dist/main-thwd1a-BsrGi8DG.js";
    console.log("Downloading JS bundle...");
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    fs.writeFileSync("main.js", res.data);
    console.log("JS saved!");

    const content = res.data;
    // Let's search for keywords like "api", "chapters", "_", "token"
    // Let's find places where a query parameter is added to URLs
    const regex = /["']_["']\s*,\s*[^)]+/g;
    let match;
    console.log("Matches for '_' parameter:");
    while ((match = regex.exec(content)) !== null) {
      console.log("-", match[0]);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
