const { chromium } = require("playwright");

async function check() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto("http://forum.ftcommunity.de/ucp.php?mode=register", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    const agreeBtn = await page.$("input[name='agreed']");
    if (agreeBtn) {
      await agreeBtn.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(5000);
      
      const fields = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('dl'));
        return rows.map(row => {
          const label = row.querySelector('dt')?.innerText.trim() || '';
          const desc = row.querySelector('dd.explanation')?.innerText.trim() || '';
          const inputs = Array.from(row.querySelectorAll('input, select, textarea')).map(el => ({
            tag: el.tagName,
            name: el.getAttribute('name'),
            type: el.getAttribute('type'),
            id: el.getAttribute('id')
          }));
          return { label, desc, inputs };
        });
      });
      
      console.log("Registration Fields:");
      fields.forEach(f => {
        console.log(`- Label: "${f.label}"`);
        if (f.desc) console.log(`  Desc: "${f.desc}"`);
        console.log(`  Inputs:`, f.inputs);
      });
      
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

check();
