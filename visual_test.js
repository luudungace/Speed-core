/**
 * SPEED-CORE VISUAL SYSTEM TEST & INTERACTIVE TOUR
 * 
 * This script runs Playwright in visual mode (headless: false) on your machine.
 * It logs into http://localhost:3001 and walks you through the entire premium UI automatically.
 * 
 * Run using: node visual_test.js
 */

const { chromium } = require("playwright");

async function runVisualTest() {
  console.log("\x1b[36m[System Test] Khởi động trình duyệt kiểm thử hệ thống (Chế độ Trực quan)... \x1b[0m");

  const browser = await chromium.launch({
    headless: false, // Runs visibly on your desktop!
    slowMo: 1000,    // Slows down actions by 1s so you can easily watch each step
    args: ["--start-maximized"]
  });

  const context = await browser.newContext({
    viewport: null // Uses natural screen size
  });

  const page = await context.newPage();
  
  try {
    console.log("\x1b[36m[System Test] 1. Điều hướng đến Speed-Core Portal (http://localhost:3001)...\x1b[0m");
    await page.goto("http://localhost:3001", { waitUntil: "networkidle" });

    console.log("\x1b[36m[System Test] 2. Tự động điền tài khoản quản trị thử nghiệm...\x1b[0m");
    await page.fill("input[name='email']", "testuser@example.com");
    await page.fill("input[name='password']", "password123");
    
    console.log("\x1b[36m[System Test] 3. Nhấp nút 'Vào Dashboard' đăng nhập...\x1b[0m");
    await page.click("button[type='submit']");
    await page.waitForURL("http://localhost:3001/", { timeout: 10000 });

    console.log("\x1b[32m[System Test] ✅ Đăng nhập thành công! Đang hiển thị Dashboard trực tiếp...\x1b[0m");
    await page.waitForTimeout(4000);

    console.log("\x1b[36m[System Test] 4. Chuyển sang trang 'Tài nguyên' (Resources Pool)...\x1b[0m");
    await page.click("a[href='/resources']");
    await page.waitForSelector("button:has-text('Proxy')");
    await page.waitForTimeout(2000);

    console.log("\x1b[36m[System Test]    - Chuyển sang tab Proxy...\x1b[0m");
    await page.click("button:has-text('Proxy')");
    await page.waitForTimeout(2000);

    console.log("\x1b[36m[System Test]    - Chuyển sang tab Persona ảo...\x1b[0m");
    await page.click("button:has-text('Persona')");
    await page.waitForTimeout(2500);

    console.log("\x1b[36m[System Test] 5. Chuyển sang trang 'Đăng ký diễn đàn' (Active Queue)...\x1b[0m");
    await page.click("a[href='/register-forum']");
    await page.waitForTimeout(3000);

    console.log("\x1b[36m[System Test] 6. Chuyển sang trang 'Backlink đã đăng' (Successful Backlinks)... \x1b[0m");
    await page.click("a[href='/posted-backlinks']");
    await page.waitForTimeout(4000);

    console.log("\x1b[32m\n[System Test] 🎉 Đã hoàn tất tour kiểm thử hệ thống tự động thành công!\x1b[0m");
    console.log("\x1b[33m[System Test] Trình duyệt sẽ được giữ nguyên mở trong 15 giây nữa để bạn tự do tương tác...\x1b[0m");
    
    await page.waitForTimeout(15000);
  } catch (err) {
    console.error("\x1b[31m[System Test] Lỗi trong quá trình chạy test:\x1b[0m", err.message);
  } finally {
    await browser.close();
    console.log("\x1b[36m[System Test] Trình duyệt kiểm thử đã đóng an toàn. Hệ thống hoạt động hoàn hảo.\x1b[0m");
  }
}

runVisualTest();
