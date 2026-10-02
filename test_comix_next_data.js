import axios from "axios";

async function run() {
  try {
    const url = "https://comix.to/title/793e-arelyn-is-sick-and-tired";
    console.log("1. Fetching series page:", url);
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      }
    });

    const html = res.data;
    
    // Find script tag with ID __NEXT_DATA__
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) {
      console.error("Could not find __NEXT_DATA__ script!");
      return;
    }

    const nextData = JSON.parse(match[1].trim());
    const buildId = nextData.buildId;
    console.log("Found buildId:", buildId);

    // Get slug
    const slug = "793e-arelyn-is-sick-and-tired";
    
    // 2. Fetch page data JSON
    const nextDataUrl = `https://comix.to/_next/data/${buildId}/title/${slug}.json?page=1`;
    console.log("2. Fetching Next.js data from URL:", nextDataUrl);
    const resJson = await axios.get(nextDataUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": url
      }
    });
    console.log("Status:", resJson.status);
    console.log("JSON response keys:", Object.keys(resJson.data || {}));
    
    // Print pageProps details or query details
    if (resJson.data?.pageProps) {
      console.log("pageProps keys:", Object.keys(resJson.data.pageProps));
      const queries = resJson.data.pageProps.dehydratedState?.queries || [];
      console.log("Queries in dehydratedState count:", queries.length);
      queries.forEach(q => {
        console.log("- QueryKey:", q.queryKey);
        if (q.queryKey[1] === "chapters") {
          console.log("  Chapters found! Count:", q.state?.data?.items?.length);
          console.log("  First chapter in query state:", JSON.stringify(q.state?.data?.items?.[0], null, 2));
        }
      });
    }
  } catch (err) {
    console.error("Failed:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Body snippet:", String(err.response.data).slice(0, 1000));
    }
  }
}

run();
