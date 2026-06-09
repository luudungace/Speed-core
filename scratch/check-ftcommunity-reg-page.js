const { chromium } = require("playwright");

async function check() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log("Navigating to ftcommunity registration page...");
    await page.goto("http://forum.ftcommunity.de/ucp.php?mode=register", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    
    console.log("Clicking the agree button...");
    const agreeBtn = await page.$("input[name='agreed']");
    if (agreeBtn) {
      await agreeBtn.click();
      console.log("Clicked input[name='agreed']. Waiting for form...");
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(5000);
      
      console.log("Current URL after click:", page.url());
      await page.screenshot({ path: "scratch/ftcommunity_reg_step2.png" });
      console.log("Screenshot step 2 saved.");
      
      // Let's dump all inputs
      const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
          tag: el.tagName,
          name: el.getAttribute('name'),
          id: el.getAttribute('id'),
          type: el.getAttribute('type'),
          value: el.value || ''
        }));
      });
      console.log("Form inputs:", JSON.stringify(inputs, null, 2));
      
      // Let's dump visible text on page to check for any CAPTCHA prompt
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log("Page text preview:\n", pageText.substring(0, 1500));
      
    } else {
      console.log("Could not find agree button input[name='agreed']");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

check();
