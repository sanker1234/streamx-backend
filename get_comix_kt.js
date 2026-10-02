import axios from "axios";
import fs from "fs";

async function run() {
  try {
    const rawUrl = "https://raw.githubusercontent.com/N3uralCreativity/comix-downloader/main/mihon-support/src/en/comix/src/eu/kanade/tachiyomi/extension/en/comix/Comix.kt";
    console.log(`Downloading Comix.kt from raw URL: ${rawUrl}...`);
    const res = await axios.get(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    fs.writeFileSync("Comix.kt", res.data);
    console.log("Comix.kt saved successfully!");
  } catch (err) {
    console.error("Failed download from main branch, trying master branch...", err.message);
    try {
      const rawUrlMaster = "https://raw.githubusercontent.com/N3uralCreativity/comix-downloader/master/mihon-support/src/en/comix/src/eu/kanade/tachiyomi/extension/en/comix/Comix.kt";
      const res = await axios.get(rawUrlMaster, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      });
      fs.writeFileSync("Comix.kt", res.data);
      console.log("Comix.kt saved successfully from master branch!");
    } catch (err2) {
      console.error("Master branch failed too:", err2.message);
    }
  }
}

run();
