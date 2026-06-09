const playwright = require("playwright");

async function checkSignup() {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log("Navigating to https://forum.qcad.org/...");
    await page.goto("https://forum.qcad.org/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);
    
    console.log("Taking homepage screenshot...");
    await page.screenshot({ path: "scratch/qcad_home.png" });
    
    // Find and click Sign Up button
    console.log("Locating Sign Up button...");
    const signUpBtn = await page.$("button:has-text('Sign Up'), button:has-text('Đăng ký'), .sign-up-button");
    if (signUpBtn) {
      console.log("Clicking Sign Up button...");
      await signUpBtn.click();
      await page.waitForTimeout(4000);
      
      console.log("Taking Signup Modal screenshot...");
      await page.screenshot({ path: "scratch/qcad_signup_modal.png" });
    } else {
      console.log("Sign Up button not found!");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

checkSignup();
