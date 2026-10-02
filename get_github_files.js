import axios from "axios";

async function listPath(path) {
  try {
    const res = await axios.get(`https://api.github.com/repos/N3uralCreativity/comix-downloader/contents/${path}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    for (const item of res.data) {
      if (item.type === "dir") {
        await listPath(item.path);
      } else if (item.name.endsWith(".kt")) {
        console.log(`Kotlin File: ${item.path}`);
      }
    }
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

async function run() {
  console.log("Listing Kotlin source files inside mihon-support/src recursively...");
  await listPath("mihon-support/src");
}

run();
