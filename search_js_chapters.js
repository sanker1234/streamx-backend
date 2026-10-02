import fs from "fs";

function run() {
  const content = fs.readFileSync("main.js", "utf8");
  console.log("File size:", content.length);

  // Search for /chapters or chapters url patterns
  const keywords = ["/chapters", "chapters", "/manga/", "/user/manga"];
  keywords.forEach(keyword => {
    let index = 0;
    console.log(`\n--- Matches for: ${keyword} ---`);
    let count = 0;
    while ((index = content.indexOf(keyword, index)) !== -1 && count < 15) {
      const snippet = content.slice(Math.max(0, index - 100), Math.min(content.length, index + keyword.length + 100));
      console.log(`[${index}]: ... ${snippet.replace(/\s+/g, " ").trim()} ...`);
      index += keyword.length;
      count++;
    }
  });
}

run();
