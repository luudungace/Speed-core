const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to thread page...");
  await page.goto("https://forum.ftcommunity.de/viewtopic.php?f=4&t=9732", { waitUntil: "domcontentloaded" });
  
  console.log("Querying all anchors on page:");
  const anchors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a")).map(a => ({
      href: a.getAttribute("href"),
      text: a.textContent.trim(),
      html: a.outerHTML
    }));
  });
  
  for (const a of anchors) {
    if (a.href && (a.href.includes("viewforum.php") || a.href.includes("index.php") || a.text.includes("fischertechnik"))) {
      console.log(`Href: ${a.href} | Text: ${a.text} | HTML: ${a.html}`);
    }
  }
  
  await browser.close();
}

main().catch(console.error);
