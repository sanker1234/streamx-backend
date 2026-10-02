import axios from "axios";
import fs from "fs";

async function downloadFile(repoPath, localName) {
  try {
    const rawUrl = `https://raw.githubusercontent.com/yurtzy/comix-api/master/${repoPath}`;
    console.log(`Downloading ${repoPath}...`);
    const res = await axios.get(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    fs.writeFileSync(localName, res.data);
    console.log(`Saved as ${localName}!`);
  } catch (err) {
    console.error(`Failed ${repoPath} on master branch:`, err.message);
    try {
      const rawUrlMain = `https://raw.githubusercontent.com/yurtzy/comix-api/main/${repoPath}`;
      console.log(`Trying main branch for ${repoPath}...`);
      const res = await axios.get(rawUrlMain, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      });
      fs.writeFileSync(localName, res.data);
      console.log(`Saved as ${localName} from main branch!`);
    } catch (err2) {
      console.error(`Failed ${repoPath} on main branch too:`, err2.message);
    }
  }
}

async function run() {
  await downloadFile("secure-tgambp-7QDhTKTL.js", "secure-tgambp-7QDhTKTL.js");
  await downloadFile("src/lib/vm.ts", "yurtzy_vm.ts");
  await downloadFile("src/lib/proxy.ts", "yurtzy_proxy.ts");
  await downloadFile("src/app/api/manga/[id]/chapters/route.ts", "yurtzy_chapters.ts");
  await downloadFile("src/app/api/manga/[id]/route.ts", "yurtzy_manga.ts");
  await downloadFile("src/app/api/manga/read/route.ts", "yurtzy_read.ts");
}

run();
