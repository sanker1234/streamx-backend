import fs from "fs";

function run() {
  const content = fs.readFileSync("main.js", "utf8");
  console.log("File size:", content.length);

  // Search for the word "chapters" in a method definition block
  let index = 0;
  const keyword = "chapters";
  console.log(`\n--- Matches for: ${keyword} ---`);
  let count = 0;
  while ((index = content.indexOf(keyword, index)) !== -1 && count < 30) {
    const snippet = content.slice(Math.max(0, index - 50), Math.min(content.length, index + keyword.length + 50));
    // Print if it looks like a function definition
    if (snippet.includes(":") || snippet.includes("=") || snippet.includes("function")) {
      console.log(`[${index}]: ... ${snippet.replace(/\s+/g, " ").trim()} ...`);
      count++;
    }
    index += keyword.length;
  }
}

run();
