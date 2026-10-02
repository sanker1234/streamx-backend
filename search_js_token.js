import fs from "fs";

function run() {
  const content = fs.readFileSync("main.js", "utf8");
  console.log("File size:", content.length);

  // Search for _ parameter construction or signatures
  const keywords = ["\"_\"", "'_'", "?_=", "_=", "crypto", "hash", "sha", "md5"];
  keywords.forEach(keyword => {
    let index = 0;
    console.log(`\n--- Matches for: ${keyword} ---`);
    let count = 0;
    while ((index = content.indexOf(keyword, index)) !== -1 && count < 10) {
      const snippet = content.slice(Math.max(0, index - 80), Math.min(content.length, index + keyword.length + 80));
      console.log(`[${index}]: ... ${snippet.replace(/\s+/g, " ").trim()} ...`);
      index += keyword.length;
      count++;
    }
  });
}

run();
