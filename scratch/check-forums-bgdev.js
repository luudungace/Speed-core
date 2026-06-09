const { chromium } = require('playwright');

async function checkCMS() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const target = 'https://forums.bgdev.org/index.php?showtopic=31796';
  console.log('Navigating to:', target);
  
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const content = await page.content();
    console.log('Page title:', await page.title());
    
    // Check common CMS patterns
    if (content.includes('phpBB')) {
      console.log('CMS is phpBB');
    } else if (content.includes('IP.Board') || content.includes('ipb_') || content.includes('Invision Power Board')) {
      console.log('CMS is Invision Power Board (IPB)');
    } else if (content.includes('vBulletin')) {
      console.log('CMS is vBulletin');
    } else if (content.includes('XenForo')) {
      console.log('CMS is XenForo');
    } else {
      console.log('Could not identify CMS from content keywords. Checking DOM elements...');
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('Footer text:', bodyText.substring(bodyText.length - 500));
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

checkCMS();
