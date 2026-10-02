import axios from "axios";
import fs from "fs";

async function run() {
  try {
    const rawUrl = "https://raw.githubusercontent.com/yurtzy/comix-api/master/src/app/page.tsx";
    console.log("Downloading page.tsx...");
    const res = await axios.get(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    fs.writeFileSync("yurtzy_page.tsx", res.data);
    console.log("Saved page.tsx as yurtzy_page.tsx!");
  } catch (err) {
    console.error("Failed on master branch:", err.message);
    try {
      const rawUrlMain = "https://raw.githubusercontent.com/yurtzy/comix-api/main/src/app/page.tsx";
      const res = await axios.get(rawUrlMain, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      });
      fs.writeFileSync("yurtzy_page.tsx", res.data);
      console.log("Saved page.tsx as yurtzy_page.tsx from main branch!");
    } catch (err2) {
      console.error("Failed on main branch too:", err2.message);
    }
  }
}

run();
