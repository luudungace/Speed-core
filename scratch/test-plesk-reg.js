const { chromium } = require("playwright");

function log(msg, type = "info") {
  const time = new Date().toLocaleTimeString("vi-VN");
  const prefix = `[Test ${time}]`;
  if (type === "success") {
    console.log(`\x1b[32m${prefix} ✅ ${msg}\x1b[0m`);
  } else if (type === "warn") {
    console.log(`\x1b[33m${prefix} ⚠️ ${msg}\x1b[0m`);
  } else {
    console.log(`\x1b[36m${prefix} ℹ&nbsp;${msg}\x1b[0m`);
  }
}

async function dismissUsercentrics(page) {
  log("Waiting for Usercentrics cookie consent banner...");
  for (let i = 0; i < 10; i++) {
    const clicked = await page.evaluate(() => {
      const root = document.getElementById('usercentrics-root');
      if (root && root.shadowRoot) {
        const acceptBtn = root.shadowRoot.querySelector('button[data-testid="uc-accept-all-button"]');
        if (acceptBtn) {
          acceptBtn.click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      log("Dismissed Usercentrics cookie consent banner successfully.", "success");
      await page.waitForTimeout(2000);
      return true;
    }
    await page.waitForTimeout(1000);
  }
  log("Usercentrics cookie consent banner not found or not dismissed.", "warn");
  return false;
}

async function testPlesk() {
  log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
  });
  const page = await context.newPage();
  
  try {
    log("Navigating to Plesk Forum...");
    await page.goto("https://talk.plesk.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Dismiss Usercentrics
    await dismissUsercentrics(page);
    
    // Find register button
    const regButton = await page.$("a[href*='register' i], a[href*='signup' i]");
    if (regButton) {
      log("Clicking Register button...");
      await regButton.click();
      await page.waitForTimeout(5000);
      
      log(`URL after click: ${page.url()}`);
      log(`Title after click: ${await page.title()}`);
      
      // Simulate input field detection (our new worker.js logic)
      const inputs = await page.$$("input");
      let uEl = null;
      let eEl = null;
      let pEl = null;

      for (const input of inputs) {
        const isVisible = await input.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
          }
          let parent = el.parentElement;
          while (parent) {
            const pStyle = window.getComputedStyle(parent);
            if (pStyle.display === 'none' || pStyle.visibility === 'hidden' || pStyle.opacity === '0') {
              return false;
            }
            parent = parent.parentElement;
          }
          return true;
        }).catch(() => false);

        if (!isVisible) continue;

        const name = (await input.getAttribute("name") || "").toLowerCase();
        const autocomplete = (await input.getAttribute("autocomplete") || "").toLowerCase();
        const type = (await input.getAttribute("type") || "").toLowerCase();
        const id = (await input.getAttribute("id") || "").toLowerCase();

        // Check if it is a honeypot field
        const isHoneypot = await input.evaluate(el => {
          const row = el.closest('.formRow') || el.closest('dl') || el.parentElement;
          if (row) {
            const rowText = row.innerText.toLowerCase();
            if (rowText.includes("leave this field blank") || rowText.includes("không điền") || rowText.includes("honeypot")) {
              return true;
            }
          }
          return false;
        }).catch(() => false);

        if (isHoneypot) {
          log(`[XenForo Detect] Bỏ qua trường Honeypot ẩn: name="${name}"`, "warn");
          continue;
        }

        if (!uEl && (autocomplete === "username" || autocomplete === "nickname" || name.includes("username") || id.includes("username"))) {
          uEl = input;
          log(`[XenForo Detect] Tìm thấy Username field: name="${name}", id="${id}", autocomplete="${autocomplete}"`, "success");
        } else if (!eEl && (autocomplete === "email" || type === "email" || name.includes("email") || id.includes("email"))) {
          eEl = input;
          log(`[XenForo Detect] Tìm thấy Email field: name="${name}", id="${id}", autocomplete="${autocomplete}"`, "success");
        } else if (!pEl && (autocomplete === "new-password" || autocomplete === "password" || type === "password" || name.includes("password") || id.includes("password"))) {
          pEl = input;
          log(`[XenForo Detect] Tìm thấy Password field: name="${name}", id="${id}", autocomplete="${autocomplete}"`, "success");
        }
      }

      // If still not found, try to look by labels for visible inputs
      if (!uEl || !eEl || !pEl) {
        log("[XenForo Detect] Chưa tìm đủ các trường chính bằng autocomplete. Thử quét nhãn (label)...");
        for (const input of inputs) {
          const isVisible = await input.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
          }).catch(() => false);

          if (!isVisible) continue;

          const type = (await input.getAttribute("type") || "").toLowerCase();
          if (type !== "text" && type !== "email" && type !== "password") continue;

          if (input === uEl || input === eEl || input === pEl) continue;

          const labelText = await page.evaluate(el => {
            const row = el.closest('.formRow') || el.closest('dl') || el.parentElement;
            if (row) {
              const label = row.querySelector('dt') || row.querySelector('label') || row;
              return label.innerText.toLowerCase();
            }
            return '';
          }, input).catch(() => "");

          if (labelText.includes("leave this field blank") || labelText.includes("không điền") || labelText.includes("honeypot")) {
            continue;
          }

          if (!uEl && (labelText.includes("username") || labelText.includes("tên đăng nhập") || labelText.includes("tên tài khoản"))) {
            uEl = input;
            log(`[XenForo Detect via Label] Tìm thấy Username field: label="${labelText}"`, "success");
          } else if (!eEl && (labelText.includes("email") || labelText.includes("thư điện tử"))) {
            eEl = input;
            log(`[XenForo Detect via Label] Tìm thấy Email field: label="${labelText}"`, "success");
          } else if (!pEl && (labelText.includes("password") || labelText.includes("mật khẩu"))) {
            pEl = input;
            log(`[XenForo Detect via Label] Tìm thấy Password field: label="${labelText}"`, "success");
          }
        }
      }

      if (uEl && eEl && pEl) {
        log("🎉 ĐÃ TÌM THẤY ĐẦY ĐỦ CÁC TRƯỜNG NHẬP LIỆU CHÍNH HỢP LỆ VÀ TRÁNH ĐƯỢC HONEYPOT!", "success");
      } else {
        log("❌ KHÔNG TÌM THẤY ĐẦY ĐỦ CÁC TRƯỜNG CHÍNH!", "warn");
      }
      
    } else {
      log("Register button not found!", "warn");
    }
  } catch (err) {
    log(`Error: ${err.message}`, "error");
  } finally {
    await browser.close();
  }
}

testPlesk();
