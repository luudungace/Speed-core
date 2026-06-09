const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://forum.ftcommunity.de/viewtopic.php?f=4&t=9732", { waitUntil: "domcontentloaded" });
  
  const breadcrumbs = await page.evaluate(() => {
    const crumbItems = Array.from(document.querySelectorAll(".crumb, .breadcrumbs, li.breadcrumbs, li.crumb, [class*='breadcrumb']"));
    return crumbItems.map(c => ({
      className: c.className,
      html: c.outerHTML,
      links: Array.from(c.querySelectorAll("a")).map(a => ({ href: a.getAttribute("href"), text: a.textContent.trim() }))
    }));
  });
  
  console.log("Breadcrumbs elements:", JSON.stringify(breadcrumbs, null, 2));
  
  await browser.close();
}

main().catch(console.error);
