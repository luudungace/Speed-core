const playwright = require("playwright");

async function runSimulation() {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log("Navigating to https://forum.qcad.org/...");
    await page.goto("https://forum.qcad.org/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);
    
    // Find and click Sign Up button
    console.log("Opening Sign Up modal...");
    const signUpBtn = await page.$("button:has-text('Sign Up'), button:has-text('Đăng ký'), .sign-up-button");
    if (!signUpBtn) {
      console.log("Sign Up button not found!");
      return;
    }
    await signUpBtn.click();
    await page.waitForTimeout(3000);
    
    // Fill inputs
    console.log("Filling inputs...");
    const emailInput = await page.$("input[type='email'], input[name*='email']");
    const userInput = await page.$("input[placeholder*='Username'], input[name*='username']");
    const passInput = await page.$("input[type='password'], input[name*='password']");
    
    const testEmail = `testuser_${Date.now()}@gmail.com`;
    const testUser = `TestUser_${Math.floor(Math.random() * 10000)}`;
    const testPass = "R#k9Wd8vLp12_test";
    
    console.log(`Using Email: ${testEmail}, Username: ${testUser}`);
    
    if (emailInput) await emailInput.fill(testEmail);
    if (userInput) await userInput.fill(testUser);
    if (passInput) await passInput.fill(testPass);
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "scratch/qcad_filled.png" });
    
    console.log("Clicking Sign Up submit...");
    const submitBtn = await page.$("button[type='submit'], .btn-primary.create, button:has-text('Sign Up')");
    if (submitBtn) {
      await submitBtn.click();
      console.log("Clicked submit. Waiting 6 seconds...");
      await page.waitForTimeout(6000);
      await page.screenshot({ path: "scratch/qcad_after_submit.png" });
    } else {
      console.log("Submit button not found!");
    }
  } catch (err) {
    console.error("Error during simulation:", err);
  } finally {
    await browser.close();
  }
}

runSimulation();
