const { chromium } = require("playwright");

async function testHeadful() {
  console.log("Launching headful browser...");
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled"
    ]
  });
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    viewport: { width: 1280, height: 720 }
  });
  
  // Set webdriver to undefined to bypass simple checks
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  const page = await context.newPage();
  
  try {
    console.log("Navigating to phpBB register...");
    await page.goto("https://www.phpbb.com/community/ucp.php?mode=register", { waitUntil: "domcontentloaded" });
    
    // Poll for Turnstile frame
    console.log("Waiting for Turnstile frame to appear...");
    let turnstileFrame = null;
    for (let i = 0; i < 15; i++) {
      turnstileFrame = page.frames().find(f => f.url().includes("challenges.cloudflare.com"));
      if (turnstileFrame) break;
      await page.waitForTimeout(1000);
    }
    
    if (turnstileFrame) {
      console.log("Found Turnstile frame! URL:", turnstileFrame.url());
      
      // Wait for it to be stable
      await page.waitForTimeout(3000);
      
      // Attempt click
      console.log("Clicking Turnstile checkbox...");
      await turnstileFrame.locator('body').click({ position: { x: 30, y: 30 } });
      
      console.log("Clicked Turnstile checkbox! Waiting for verification (max 20 seconds)...");
      let verified = false;
      for (let sec = 1; sec <= 20; sec++) {
        await page.waitForTimeout(1000);
        const title = await page.title();
        const url = page.url();
        console.log(`[Second ${sec}] URL: ${url}, Title: ${title}`);
        
        if (!title.includes("Just a moment") && !url.includes("challenges.cloudflare.com")) {
          verified = true;
          break;
        }
      }
      
      if (verified) {
        console.log("🎉 SUCCESS! Verification bypassed successfully!");
      } else {
        console.log("❌ FAILED: Still stuck on verification screen.");
      }
    } else {
      console.log("Turnstile frame not found!");
    }
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await browser.close();
  }
}

testHeadful();
