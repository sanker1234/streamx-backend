import fs from "fs";

function run() {
  const content = fs.readFileSync("main.js", "utf8");
  console.log("File size:", content.length);

  // Let's find "N=" or "=N" or where N is imported/assigned
  // Look at lines around queryFn:()=>N.chapters
  const index = content.indexOf("queryFn:()=>N.chapters");
  if (index !== -1) {
    console.log("Found queryFn:()=>N.chapters at index:", index);
    const context = content.slice(Math.max(0, index - 2000), index + 100);
    console.log("Context:");
    console.log(context);
  }
}

run();
