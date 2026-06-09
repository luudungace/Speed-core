/**
 * FULL AUTO BACKLINK - v2
 * Dùng 1secmail.com (API public, domain uy tín hơn)
 * hoặc mail.tm (REST API chuẩn OAuth)
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const clean = line.trim();
      if (!clean || clean.startsWith("#")) continue;
      const eq = clean.indexOf("=");
      if (eq > 0) {
        let val = clean.substring(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        process.env[clean.substring(0, eq).trim()] = val;
      }
    }
  }
}
loadEnv();

const SERVER_URL = "http://localhost:3001";

function log(msg, type = "info") {
  const time = new Date().toLocaleTimeString("vi-VN");
  const icons = { info: "ℹ️", success: "✅", warn: "⚠️", error: "❌" };
  console.log(`[${time}] ${icons[type] || "ℹ️"} ${msg}`);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rnd(len = 7) {
  return Math.random().toString(36).substring(2, 2 + len);
}

// ─────────────────────────────────────────────
// EMAIL SERVICE: 1secmail.com
// Domains khả dụng: 1secmail.com, 1secmail.org, 1secmail.net,
//                   wwjmp.com, esiix.com, xojxe.com, yoggm.com
// ─────────────────────────────────────────────
const SECMAIL_DOMAINS = ["1secmail.com", "1secmail.org", "1secmail.net", "wwjmp.com", "yoggm.com"];

async function createTempEmail() {
  const user = "ftuser" + rnd(6);
  // Thử từng domain cho đến khi có domain mà forum chấp nhận
  const domain = SECMAIL_DOMAINS[Math.floor(Math.random() * SECMAIL_DOMAINS.length)];
  const emailAddr = `${user}@${domain}`;
  log(`Dùng email tạm: ${emailAddr}`, "success");
  return { emailAddr, user, domain };
}

async function waitForActivationEmail({ user, domain }, maxWaitMs = 180000) {
  log(`Đang poll email tại 1secmail (${user}@${domain}) tối đa ${maxWaitMs / 1000}s...`);
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await sleep(6000);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    try {
      const res = await fetch(
        `https://www.1secmail.com/api/v1/?action=getMessages&login=${user}&domain=${domain}`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      const msgs = await res.json();

      if (msgs && msgs.length > 0) {
        log(`📬 Có ${msgs.length} email! Đang đọc...`, "success");

        for (const msg of msgs) {
          log(`  From: ${msg.from} | Subject: ${msg.subject}`);

          // Lấy body đầy đủ
          const bodyRes = await fetch(
            `https://www.1secmail.com/api/v1/?action=readMessage&login=${user}&domain=${domain}&id=${msg.id}`,
            { headers: { "User-Agent": "Mozilla/5.0" } }
          );
          const msgData = await bodyRes.json();
          const rawBody = (msgData.body || msgData.textBody || msgData.htmlBody || "").replace(/&amp;/g, "&").replace(/\r\n/g, " ");

          log(`  Body (200 chars): ${rawBody.substring(0, 200)}`);

          // Tìm tất cả URL trong body
          const allUrls = rawBody.match(/https?:\/\/[^\s"<>\\]+/gi) || [];
          log(`  Tìm thấy ${allUrls.length} URL trong email.`);
          for (const u of allUrls) log(`    → ${u}`);

          // Ưu tiên link kích hoạt
          const activationUrl = allUrls.find(u =>
            u.includes("confirm") || u.includes("activat") || u.includes("verify") ||
            u.includes("ucp.php") || u.includes("mode=activate") || u.includes("act_key") ||
            u.includes("ftcommunity")
          );

          if (activationUrl) {
            log(`✅ Link kích hoạt: ${activationUrl}`, "success");
            return activationUrl;
          }

          // Fallback: lấy link dài nhất không phải unsubscribe
          const goodLinks = allUrls.filter(u => !u.includes("unsubscribe") && u.length > 30);
          if (goodLinks.length > 0) {
            log(`Dùng link fallback: ${goodLinks[0]}`, "warn");
            return goodLinks[0];
          }
        }
      } else {
        log(`Chưa có email... (${elapsed}s đã qua)`);
      }
    } catch (e) {
      log(`1secmail API lỗi: ${e.message}`, "warn");
    }
  }

  throw new Error(`Timeout ${maxWaitMs / 1000}s chờ email kích hoạt từ 1secmail.`);
}

// ─────────────────────────────────────────────
// ĐĂNG KÝ phpBB
// ─────────────────────────────────────────────
async function registerOnForum(page, origin, username, password, emailAddr) {
  const registerUrl = `${origin}/ucp.php?mode=register`;
  log(`Điều hướng đến đăng ký: ${registerUrl}`);
  await page.goto(registerUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Trang Terms: tìm nút đồng ý
  const allSubmitBtns = await page.$$("input[type='submit']");
  for (const btn of allSubmitBtns) {
    const val = (await btn.getAttribute("value") || "").toLowerCase();
    const name = (await btn.getAttribute("name") || "").toLowerCase();
    if (val.includes("stimme") || val.includes("agree") || name.includes("agreed")) {
      log(`Click nút đồng ý: "${await btn.getAttribute("value")}"`);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(500);
      await btn.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
      await page.waitForTimeout(2000);
      break;
    }
  }

  // Chờ form xuất hiện
  await page.waitForSelector("input[name='username'], input[id='username']", { timeout: 10000 }).catch(() => undefined);

  log(`Điền form đăng ký: ${username} | ${emailAddr}`);
  const uInput = await page.$("input[name='username'], input[id='username']");
  const eInput = await page.$("input[name='email'], input[id='email']");
  const eConfirm = await page.$("input[name='email_confirm']");
  const pInput = await page.$("input[name='new_password'], input[name='password']");
  const pConfirm = await page.$("input[name='password_confirm']");

  if (!uInput || !eInput || !pInput) {
    const debugUrl = page.url();
    const txt = await page.evaluate(() => document.body.innerText.substring(0, 400));
    throw new Error(`Không thấy form đăng ký tại ${debugUrl}: ${txt}`);
  }

  await uInput.fill(username);
  await eInput.fill(emailAddr);
  if (eConfirm) await eConfirm.fill(emailAddr);
  await pInput.fill(password);
  if (pConfirm) await pConfirm.fill(password);

  // Submit
  const submitBtn = await page.$("input[type='submit'][name='submit'], button[type='submit'][name='submit']") ||
                    await page.$("input[type='submit']:not([name='preview'])");
  if (!submitBtn) throw new Error("Không thấy nút submit đăng ký.");

  log("Nộp form...");
  await submitBtn.click();
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(3000);

  const resultText = await page.evaluate(() => document.body.innerText);
  log(`Kết quả đăng ký (200c): ${resultText.substring(0, 200)}`);

  // Kiểm tra lỗi rõ ràng
  if (resultText.includes("vergeben") || resultText.includes("bereits") || resultText.includes("already in use")) {
    throw new Error("Username đã tồn tại, thử username khác.");
  }

  log("Đăng ký xong, chờ email kích hoạt...", "success");
  return true;
}

// ─────────────────────────────────────────────
// KÍCH HOẠT
// ─────────────────────────────────────────────
async function activateAccount(page, activationUrl) {
  log(`Kích hoạt: ${activationUrl}`);
  await page.goto(activationUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);
  const txt = await page.evaluate(() => document.body.innerText);
  log(`Kết quả kích hoạt: ${txt.substring(0, 300)}`);
}

// ─────────────────────────────────────────────
// ĐĂNG NHẬP
// ─────────────────────────────────────────────
async function loginForum(page, origin, username, password) {
  const loginUrl = `${origin}/ucp.php?mode=login`;
  log(`Đăng nhập: ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(2000);

  const uEl = await page.$("input[id='username'], input[name='username']");
  const pEl = await page.$("input[id='password'], input[name='password']");
  const submitBtn = await page.$("input[type='submit'][name='login'], button[type='submit']");
  if (!uEl || !pEl) throw new Error("Không tìm thấy form đăng nhập.");

  await uEl.fill(username);
  await pEl.fill(password);
  const autologin = await page.$("input[name='autologin']");
  if (autologin) await autologin.check().catch(() => undefined);

  await submitBtn.click();
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(3000);

  const html = await page.evaluate(() => document.body.innerHTML.toLowerCase());
  if (html.includes("logout") || html.includes("abmelden")) {
    log("✅ Đăng nhập thành công!", "success");
  } else {
    const curUrl = page.url();
    log(`Sau login URL: ${curUrl}`, "warn");
    if (curUrl.includes("login")) throw new Error("Đăng nhập thất bại - vẫn trên trang login.");
  }
}

// ─────────────────────────────────────────────
// ĐĂNG BÀI
// ─────────────────────────────────────────────
async function postThread(page, origin, forumId, username) {
  const postUrl = `${origin}/viewforum.php?f=${forumId}`;
  log(`Điều hướng đến subforum: ${postUrl}`);
  await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Kiểm tra login vẫn còn hiệu lực
  const htmlCheck = await page.evaluate(() => document.body.innerHTML.toLowerCase());
  if (htmlCheck.includes("du musst dich anmelden") || htmlCheck.includes("you must be registered")) {
    throw new Error("Session hết hạn khi vào subforum.");
  }

  // Click "Neues Thema" (New Topic)
  let newTopicBtn = await page.$("a[href*='mode=post']");
  if (newTopicBtn) {
    log("Click New Topic button...");
    await newTopicBtn.click();
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
  } else {
    // Navigate trực tiếp
    const directUrl = `${origin}/posting.php?mode=post&f=${forumId}`;
    log(`Thử navigate trực tiếp: ${directUrl}`);
    await page.goto(directUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);
  }

  // Kiểm tra bị redirect login không
  const urlNow = page.url();
  const txtNow = await page.evaluate(() => document.body.innerText || "");
  if (urlNow.includes("mode=login") || txtNow.includes("Du musst dich anmelden")) {
    throw new Error("Bị redirect về login - tài khoản chưa kích hoạt email hoặc chưa đủ quyền.");
  }

  // Điền form
  const subjectEl = await page.$("input[name='subject']");
  const messageEl = await page.$("textarea[name='message']");
  if (!subjectEl || !messageEl) {
    throw new Error(`Không thấy form đăng bài. URL: ${urlNow}`);
  }

  const postTitle = `Community Introduction - ${username}`;
  const postBody = `Hello everyone!\n\nMy name is ${username} and I'm excited to be part of this fischertechnik community. I've been interested in fischertechnik models for a long time and look forward to exchanging ideas with you all.\n\nBest regards,\n${username}`;

  log("Điền nội dung bài viết...");
  await subjectEl.fill(postTitle);
  await messageEl.fill(postBody);

  const submitBtn = await page.$("input[type='submit'][name='post']");
  if (!submitBtn) throw new Error("Không thấy nút post.");

  log("Nộp bài viết...");
  await submitBtn.click();
  await page.waitForNavigation({ waitUntil: "networkidle", timeout: 25000 }).catch(() => undefined);
  await page.waitForTimeout(6000);

  const finalUrl = page.url();
  log(`Đăng bài thành công! URL: ${finalUrl}`, "success");
  return finalUrl;
}

// ─────────────────────────────────────────────
// LƯU KẾT QUẢ
// ─────────────────────────────────────────────
async function saveResult(forumUrl, postedUrl, username, email) {
  try {
    const res = await fetch(`${SERVER_URL}/api/posted-backlinks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forumUrl, postedUrl, status: "success", details: { username, emailUsed: email } })
    });
    if (res.ok) log("Đã lưu backlink vào Supabase!", "success");
    else log(`Lưu DB lỗi: ${res.status}`, "warn");
  } catch (e) {
    log(`Lưu DB exception: ${e.message}`, "warn");
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  const TARGET = "https://forum.ftcommunity.de/viewtopic.php?f=4&t=9732";
  const ORIGIN = "https://forum.ftcommunity.de";
  const FORUM_ID = "4"; // f=4 từ URL target
  const USERNAME = "ftmember_" + rnd(5);
  const PASSWORD = "Secure@" + Math.floor(10000 + Math.random() * 90000);

  log("═══════════════════════════════════════════", "success");
  log("  FULL AUTO BACKLINK v2 - BẮT ĐẦU", "success");
  log("═══════════════════════════════════════════", "success");
  log(`Username: ${USERNAME} | Password: ${PASSWORD}`);

  // Tạo email tạm
  const emailInfo = await createTempEmail();
  log(`Email: ${emailInfo.emailAddr}`, "success");

  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"]
  });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    viewport: { width: 1280, height: 800 }
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  let postedUrl = null;

  try {
    // 1. Đăng ký
    log("\n[BƯỚC 1/5] Đăng ký tài khoản...", "success");
    await registerOnForum(page, ORIGIN, USERNAME, PASSWORD, emailInfo.emailAddr);

    // 2. Chờ email kích hoạt từ 1secmail
    log("\n[BƯỚC 2/5] Chờ email kích hoạt từ 1secmail...", "success");
    let activationUrl = null;
    try {
      activationUrl = await waitForActivationEmail(emailInfo, 180000); // 3 phút
    } catch (e) {
      log(`Email timeout: ${e.message}`, "warn");
    }

    // 3. Kích hoạt
    if (activationUrl) {
      log("\n[BƯỚC 3/5] Kích hoạt tài khoản...", "success");
      await activateAccount(page, activationUrl);
    } else {
      log("\n[BƯỚC 3/5] Không có link kích hoạt - tiếp tục thử.", "warn");
    }

    // 4. Đăng nhập
    log("\n[BƯỚC 4/5] Đăng nhập...", "success");
    await loginForum(page, ORIGIN, USERNAME, PASSWORD);

    // 5. Đăng bài
    log("\n[BƯỚC 5/5] Đăng bài...", "success");
    postedUrl = await postThread(page, ORIGIN, FORUM_ID, USERNAME);

    // Lưu kết quả
    await saveResult(TARGET, postedUrl, USERNAME, emailInfo.emailAddr);

    log("\n═══════════════════════════════════════════", "success");
    log("🎉 HOÀN TẤT! BACKLINK ĐÃ ĐƯỢC ĐĂNG!", "success");
    log(`🔗 ${postedUrl}`, "success");
    log("═══════════════════════════════════════════", "success");
    await page.screenshot({ path: "scratch/success-result.png" });
    log("📸 Ảnh kết quả: scratch/success-result.png");

  } catch (err) {
    log(`\n❌ LỖI: ${err.message}`, "error");
    await page.screenshot({ path: "scratch/error-result.png" }).catch(() => undefined);
    log("📸 Ảnh lỗi: scratch/error-result.png");
  } finally {
    await sleep(5000);
    await browser.close();
  }
}

main();
