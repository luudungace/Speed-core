const { chromium } = require("playwright");
const fs = require("fs");

async function testPhpBB() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
  });
  const page = await context.newPage();
  
  try {
    console.log("Navigating to phpBB...");
    await page.goto("https://www.phpbb.com/community/ucp.php?mode=register", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);
    
    console.log(`URL: ${page.url()}`);
    console.log(`Title: ${await page.title()}`);
    
    // Save screenshot
    await page.screenshot({ path: "scratch/phpbb_cloudflare_test.png" });
    console.log("Saved screenshot to scratch/phpbb_cloudflare_test.png");
    
    // Log first 1000 characters of HTML body
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log("Body text snippet:\n", bodyText.substring(0, 500));
    
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

testPhpBB();
