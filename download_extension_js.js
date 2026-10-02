import axios from "axios";
import fs from "fs";

async function downloadFile(name) {
  try {
    const rawUrl = `https://raw.githubusercontent.com/N3uralCreativity/comix-downloader/master/${name}`;
    console.log(`Downloading ${name} from raw URL...`);
    const res = await axios.get(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    fs.writeFileSync(name, res.data);
    console.log(`${name} saved!`);
  } catch (err) {
    console.error(`Failed ${name}:`, err.message);
  }
}

async function run() {
  await downloadFile("background.js");
  await downloadFile("cdl-features-core.js");
  await downloadFile("content_title.js");
}

run();
