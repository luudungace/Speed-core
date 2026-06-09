const { chromium } = require("playwright");

async function checkForum() {
  console.log("Launching browser...");
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
  });
  const page = await context.newPage();
  
  try {
    const targetUrl = "https://pikniktv.info/posting.php?mode=post&f=328";
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);
    
    console.log("Current URL:", page.url());
    console.log("Title:", await page.title());
    
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log("--- Body Text (first 1000 chars) ---");
    console.log(bodyText.substring(0, 1000));
    console.log("------------------------------------");
    
    // Check if input[name='subject'] and textarea[name='message'] exist
    const hasSubject = await page.$("input[name='subject']");
    const hasMessage = await page.$("textarea[name='message']");
    console.log(`Has input[name='subject']: ${!!hasSubject}`);
    console.log(`Has textarea[name='message']: ${!!hasMessage}`);
    
    // List all inputs
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("input, textarea, select")).map(el => ({
        tagName: el.tagName,
        type: el.type || el.getAttribute("type"),
        name: el.getAttribute("name"),
        id: el.getAttribute("id"),
        value: el.value
      }));
    });
    console.log("Inputs on page:", JSON.stringify(inputs, null, 2));

    await page.screenshot({ path: "scratch/pikniktv_debug.png" });
    console.log("Saved debug screenshot to scratch/pikniktv_debug.png");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

checkForum();
