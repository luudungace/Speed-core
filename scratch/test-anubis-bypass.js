const { chromium } = require("playwright");

function log(msg, type = "info") {
  const time = new Date().toLocaleTimeString("vi-VN");
  const prefix = `[Test ${time}]`;
  if (type === "success") {
    console.log(`\x1b[32m${prefix} ✅ ${msg}\x1b[0m`);
  } else if (type === "warn") {
    console.log(`\x1b[33m${prefix} ⚠️ ${msg}\x1b[0m`);
  } else {
    console.log(`\x1b[36m${prefix} ℹ️ ${msg}\x1b[0m`);
  }
}

async function checkForSecurityScreen(page) {
  try {
    let hasCaptcha = false;
    let captchaType = ""; // "recaptcha", "hcaptcha", "turnstile", "other"
    let sitekey = "";
    let hasCloudflare = false;
    let hasAnubis = false;

    // Check for Cloudflare challenge elements
    const cfTitle = await page.title();
    const cfContent = await page.content();
    if (cfTitle.includes("Just a moment") || cfTitle.includes("Attention Required") || cfContent.includes("cloudflare") || cfContent.includes("Ray ID")) {
      hasCloudflare = true;
    }

    // Check for Anubis Techaro challenge elements
    if (cfTitle.includes("Making sure you're not a bot") || cfContent.includes("Anubis from Techaro") || cfContent.includes("Protected by Anubis")) {
      hasAnubis = true;
    }

    // Check for standard CAPTCHA elements (hCaptcha, reCAPTCHA, Cloudflare Turnstile)
    const hasHCaptcha = await page.$("iframe[src*='hcaptcha']");
    const hasReCaptcha = await page.$("iframe[src*='recaptcha'], .g-recaptcha");
    const hasTurnstile = await page.$("iframe[src*='turnstile'], .cf-turnstile");
    const hasCaptchaField = await page.$("input[name*='captcha' i], img[src*='captcha' i]");

    if (hasReCaptcha) {
      hasCaptcha = true;
      captchaType = "recaptcha";
    } else if (hasHCaptcha) {
      hasCaptcha = true;
      captchaType = "hcaptcha";
    } else if (hasTurnstile) {
      hasCaptcha = true;
      captchaType = "turnstile";
    } else if (hasCaptchaField) {
      hasCaptcha = true;
      captchaType = "other";
    }

    if (hasCloudflare || hasCaptcha || hasAnubis) {
      const reason = hasCloudflare ? "Cloudflare Protection" : (hasAnubis ? "Anubis Protection" : `CAPTCHA Verification (${captchaType})`);
      log(`Phát hiện màn hình ${reason}!`, "warn");

      if (hasAnubis) {
        log("[Anubis] Đang chờ thuật toán PoW hoàn thành...");
        let continueBtn = null;
        const startTime = Date.now();
        while (Date.now() - startTime < 15000) {
          continueBtn = await page.$("a:has-text('Continue'), a:has-text('Продолжить'), button:has-text('Continue'), a[href*='redir']");
          if (continueBtn && await continueBtn.isVisible().catch(() => false)) {
            break;
          }
          await page.waitForTimeout(1000);
        }
        
        if (continueBtn) {
          log("[Anubis] Click nút 'Continue' để tiếp tục...", "success");
          await continueBtn.click();
          await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
          await page.waitForTimeout(3000);
          return;
        } else {
          log("[Anubis] Không tìm thấy nút 'Continue' tự động. Thử chờ chuyển hướng...", "warn");
          await page.waitForTimeout(5000);
        }
      }
    }
  } catch (err) {
    log(`Bỏ qua lỗi kiểm tra bảo mật: ${err.message}`, "warn");
  }
}

async function runTest() {
  log("Khởi chạy trình duyệt test...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
  });
  const page = await context.newPage();
  
  try {
    const targetUrl = "https://pikniktv.info/posting.php?mode=post&f=328";
    log(`Điều hướng đến: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    
    log(`Gọi hàm checkForSecurityScreen...`);
    await checkForSecurityScreen(page);
    
    log(`Sau khi xử lý bảo mật, URL hiện tại là: ${page.url()}`);
    log(`Tiêu đề trang: ${await page.title()}`);
    
    const bodyText = await page.evaluate(() => document.body.innerText);
    log(`Đoạn nội dung trang đầu tiên:\n${bodyText.substring(0, 300)}`);
    
    // Check if redirect worked or if we got further
    if (page.url().includes("posting.php") && !page.url().includes("anubis")) {
      log("🎉 KIỂM TRA THÀNH CÔNG! Đã vượt qua bảo mật Anubis thành công!", "success");
    } else {
      log("❌ KIỂM TRA THẤT BẠI: Vẫn bị giữ ở trang bảo mật Anubis.", "warn");
    }
  } catch (e) {
    log(`Lỗi test: ${e.message}`, "error");
  } finally {
    await browser.close();
  }
}

runTest();
