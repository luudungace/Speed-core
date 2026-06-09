const { chromium } = require("playwright");

async function testDOM() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
  });
  const page = await context.newPage();
  
  try {
    await page.goto("https://www.phpbb.com/community/ucp.php?mode=register", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    
    const turnstileFrame = page.frames().find(f => f.url().includes("challenges.cloudflare.com"));
    if (turnstileFrame) {
      console.log("Found Turnstile frame!");
      
      const debugInfo = await turnstileFrame.evaluate(() => {
        return {
          bodyHTML: document.body.innerHTML,
          headHTML: document.head.innerHTML,
          title: document.title,
          allElementsCount: document.querySelectorAll('*').length
        };
      });
      
      console.log("Debug Info inside Turnstile frame:", JSON.stringify(debugInfo, null, 2));
    }
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await browser.close();
  }
}

testDOM();
