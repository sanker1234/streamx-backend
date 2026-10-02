import axios from "axios";

async function testAgent(name, ua) {
  try {
    console.log(`\nTesting User-Agent: ${name}...`);
    const url = "https://comix.to/title/793e-arelyn-is-sick-and-tired";
    const res = await axios.get(url, {
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      timeout: 8000
    });
    console.log("Status:", res.status);
    console.log("HTML length:", res.data.length);
    // Search for any chapter links
    const matches = res.data.match(/\/title\/[a-z0-9-]+\/\d+-chapter-[\w.-]+/gi) || [];
    console.log("Found chapter link matches:", matches.length);
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

async function run() {
  await testAgent("Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
  await testAgent("Bingbot", "Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)");
  await testAgent("Yahoo! Slurp", "Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)");
}

run();
