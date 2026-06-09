const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  console.log('Navigating to registration page...');
  await page.goto('http://forum.ftcommunity.de/ucp.php?mode=register', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Click agree
  console.log('Clicking agree terms button...');
  const agreeBtn = await page.$("input[name='agreed']");
  if (agreeBtn) {
    await agreeBtn.click();
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    await page.waitForTimeout(3000);
  }

  // Fill form
  const username = `TestUser_${Math.floor(100 + Math.random() * 900)}`;
  const email = 'mama0874160121+test2@gmail.com';
  const password = 'TestSecurePassword123!';

  console.log(`Filling form with username: ${username}, email: ${email}...`);
  await page.fill("input[name='username']", username);
  await page.fill("input[name='email']", email);
  await page.fill("input[name='new_password']", password);
  await page.fill("input[name='password_confirm']", password);
  await page.fill("input[name='pf_name']", 'Test Realname');

  // Trigger mCaptcha checkbox click in iframe
  console.log('Solving mCaptcha by clicking it inside iframe...');
  let clicked = false;
  for (const frame of page.frames()) {
    // Locate the mCaptcha checkbox in the iframe
    const checkbox = await frame.$("input[type='checkbox'], [role='checkbox'], #widget-checkbox, .checkbox, #anchor");
    if (checkbox) {
      console.log('Found mCaptcha checkbox inside iframe. Clicking...');
      await checkbox.click();
      clicked = true;
      break;
    }
  }

  if (clicked) {
    console.log('Clicked mCaptcha inside iframe. Waiting for token...');
    const tokenInput = await page.$("input[name='mcaptcha__token']");
    if (tokenInput) {
      for (let i = 0; i < 20; i++) {
        const val = await tokenInput.evaluate(el => el.value);
        if (val && val.trim().length > 0) {
          console.log('Token generated successfully:', val.substring(0, 30) + '...');
          break;
        }
        await page.waitForTimeout(1000);
      }
    }
  } else {
    console.log('Failed to find and click mCaptcha checkbox.');
  }

  // Submit form
  console.log('Submitting form...');
  const submitBtn = await page.$("input[type='submit'][name='submit']");
  if (submitBtn) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => undefined),
      submitBtn.click()
    ]);
    await page.waitForTimeout(5000);
  }

  console.log('Current URL after submit:', page.url());
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Post-Submit Body Text (First 1000 chars):');
  console.log(bodyText.substring(0, 1000));

  await browser.close();
}

run();
