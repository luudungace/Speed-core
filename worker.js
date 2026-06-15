/**
 * SPEED-CORE AUTO-REGISTRATION & POSTING BACKLINK WORKER
 * 
 * Fulfills PRD Sprint 2 (Phase 2 Registration) & Sprint 3 (Phase 3 Poster).
 * Works completely in the background using Playwright stealth configurations.
 * 
 * Run using: node worker.js
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const imapSimple = require("imap-simple");
const { simpleParser } = require("mailparser");
const Tesseract = require("tesseract.js");

// Tự động tải cấu hình từ tệp .env
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine.startsWith("#")) continue;
      const firstEqual = cleanLine.indexOf("=");
      if (firstEqual > 0) {
        const key = cleanLine.substring(0, firstEqual).trim();
        let value = cleanLine.substring(firstEqual + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    }
  }
}
loadEnv();


const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const POLL_INTERVAL_MS = 15000;

function log(msg, type = "info") {
  const time = new Date().toLocaleTimeString("vi-VN");
  const prefix = `[Worker ${time}]`;
  if (type === "success") {
    console.log(`\x1b[32m${prefix} ✅ ${msg}\x1b[0m`);
  } else if (type === "warn") {
    console.log(`\x1b[33m${prefix} ⚠️ ${msg}\x1b[0m`);
  } else if (type === "error") {
    console.error(`\x1b[31m${prefix} ❌ ${msg}\x1b[0m`);
  } else {
    console.log(`\x1b[36m${prefix} ℹ️ ${msg}\x1b[0m`);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generates username and appends random numbers if needed (Task 2.4 Auto-correction)
function generateUsername(base) {
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `${base}_${randomSuffix}`;
}

const args = process.argv.slice(2);
const modeArg = args.find(arg => arg.startsWith("--mode="));
let workerMode = "full"; // Default to full mode (crawled -> register -> post)

if (modeArg) {
  const parsedMode = modeArg.split("=")[1].trim().toLowerCase();
  if (["full", "register", "direct"].includes(parsedMode)) {
    workerMode = parsedMode;
  } else {
    log(`⚠️ Không nhận dạng được chế độ "${parsedMode}". Sử dụng chế độ mặc định: FULL.`, "warn");
  }
} else if (process.env.WORKER_MODE) {
  const envMode = process.env.WORKER_MODE.trim().toLowerCase();
  if (["full", "register", "direct"].includes(envMode)) {
    workerMode = envMode;
  }
}

const headlessArg = args.includes("--headless") || process.env.HEADLESS === "true";

let lastDailyCheckDate = ""; // format: "YYYY-MM-DD"

async function performBacklinkCheck() {
  try {
    log("Bắt đầu kiểm tra trạng thái sống/chết của các backlink đã đăng...", "info");
    
    // 1. Fetch backlinks that need checking
    const getRes = await fetch(`${SERVER_URL}/api/posted-backlinks/check`, {
      method: "GET",
      headers: { "Cache-Control": "no-cache" }
    });
    
    if (!getRes.ok) {
      log(`Không thể tải danh sách check từ server. HTTP Status: ${getRes.status}`, "error");
      return;
    }
    
    const { backlinks, error } = await getRes.json();
    if (error) {
      log(`Lỗi từ server: ${error}`, "error");
      return;
    }
    
    if (!backlinks || backlinks.length === 0) {
      log("Không có backlink nào cần kiểm tra (tất cả đều đã check hoặc không có backlink thành công).", "info");
      return;
    }

    log(`Tìm thấy ${backlinks.length} backlink cần kiểm tra.`, "info");
    
    const targetDomain = new URL(process.env.TARGET_BACKLINK_URL || "https://speed-core.net").hostname;

    for (const link of backlinks) {
      log(`Đang kiểm tra: ${link.posted_url} ...`);
      let isAlive = false;
      try {
        const checkRes = await fetch(link.posted_url, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        
        if (checkRes.status === 200) {
          const html = await checkRes.text();
          if (html.toLowerCase().includes(targetDomain.toLowerCase())) {
            isAlive = true;
          }
        }
      } catch (err) {
        log(`Lỗi khi fetch link ${link.posted_url}: ${err.message}`, "warn");
      }
      
      if (isAlive) {
        log(`Backlink còn sống: ${link.posted_url}`, "success");
      } else {
        log(`Backlink ĐÃ CHẾT hoặc bị xóa: ${link.posted_url}`, "error");
      }

      // Report back to server
      try {
        const reportRes = await fetch(`${SERVER_URL}/api/posted-backlinks/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: link.id, isAlive })
        });
        
        if (!reportRes.ok) {
          log(`Lỗi cập nhật trạng thái link ${link.id} lên server. Status: ${reportRes.status}`, "error");
        }
      } catch (reportErr) {
        log(`Lỗi gửi báo cáo check lên server: ${reportErr.message}`, "error");
      }
    }
    
    log("Hoàn thành đợt kiểm tra backlink.", "success");
  } catch (err) {
    log(`Lỗi trong quá trình kiểm tra backlink: ${err.message}`, "error");
  }
}

async function runDailyBacklinkCheckIfNeeded() {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const currentHour = now.getHours();

  // Trigger if it's 12:00 PM (hour 12) and we haven't run today yet
  if (currentHour === 12 && lastDailyCheckDate !== todayStr) {
    log(`[Scheduler] Phát hiện 12h trưa. Bắt đầu tự động kiểm tra backlink hàng ngày...`, "info");
    lastDailyCheckDate = todayStr;
    await performBacklinkCheck();
  }
}

async function runWorkerLoop() {
  log(`Bắt đầu khởi chạy Worker đi link liên hoàn... [Chế độ: ${workerMode.toUpperCase()}]`, "success");
  
  while (true) {
    try {
      // Tự động kiểm tra backlink lúc 12h trưa hàng ngày
      await runDailyBacklinkCheckIfNeeded();

      log("Đang kiểm tra hàng đợi nhiệm vụ từ server...");
      
      let pullUrl = `${SERVER_URL}/api/public/worker/registration`;
      if (workerMode === "register") {
        pullUrl += "?isDirect=false";
      } else if (workerMode === "direct") {
        pullUrl += "?isDirect=true";
      }
      
      const res = await fetch(pullUrl, {
        method: "GET",
        headers: { "Cache-Control": "no-cache" }
      });
      
      if (!res.ok) {
        log(`Không thể tải hàng đợi từ server. HTTP Status: ${res.status}`, "error");
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      
      const { task, error } = await res.json();
      
      if (error) {
        // Safe to ignore if queue is empty or tables missing
        if (error.includes("relation") || error.includes("does not exist")) {
          log("⚠️ Server báo lỗi truy vấn (Khả năng cao bạn chưa chạy SQL Migrations trong Supabase SQL Editor).", "warn");
        } else {
          log(`Lỗi từ server: ${error}`, "error");
        }
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      
      if (!task) {
        log("Hàng đợi đăng ký trống. Đang tạm nghỉ...");
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      
      log(`🔥 Nhận được nhiệm vụ mới: ${task.url} (CMS: ${task.cmsType})`, "success");
      await executeRegistrationAndPosting(task);
      
    } catch (err) {
      log(`Lỗi vòng lặp worker: ${err.message}`, "error");
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

// Service to call Gemini AI and write clean, unique SEO forum posts
async function generateAIPostContent(apiKey, persona, targetUrl, categoryTitle, isDirectLogin = false) {
  try {
    log(`[AI Writer] Đang gọi Gemini AI để tạo nội dung bài viết độc bản liên quan đến chủ đề: "${categoryTitle}"...`);
    
    let linkInstructions = "";
    if (isDirectLogin) {
      linkInstructions = `
3. Since this is an established, trusted account, you MUST naturally and organically integrate a backlink/hyperlink to the target website: "${targetUrl}" inside the post body. 
   - The link must feel extremely natural, e.g. "I recently read an interesting take on [url=${targetUrl}]anchor text[/url] which explained..." or "I highly recommend checking out [url=${targetUrl}]anchor text[/url] for detailed insights."
   - Choose a highly relevant, organic anchor text that matches the flow of your paragraph. Avoid generic words like "click here", "website", or "link".
   - The link MUST be in standard forum BBCode link format: [url=${targetUrl}]Anchor Text[/url].`;
    } else {
      linkInstructions = `
3. DO NOT include any links, URLs, or promotional codes in the post. The post must be 100% conversational and natural without any external links to gain trust and prevent account banning.`;
    }

    const prompt = `Write a friendly, high-quality forum post from the perspective of an SEO / Tech specialist.
Persona details:
- Display name: ${persona.displayName}
- Biography: ${persona.bio || "SEO expert and tech enthusiast."}

Requirements:
1. The post must look extremely natural, warm, and highly engaging.
2. The post subject/topic must be highly relevant to the sub-forum category title: "${categoryTitle}". If it's SEO, talk about SEO; if it's general/lounge, talk about an interesting, general-interest topic.${linkInstructions}
4. The post must be written in English.
5. Return only the post title on the first line starting with "Title: ", followed by the post body. Do not include any markdown formatting like triple backticks.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const lines = text.split("\n");
        let title = `Interesting thought about ${categoryTitle}`;
        let content = text;

        const titleLine = lines.find(l => l.toLowerCase().startsWith("title:"));
        if (titleLine) {
          title = titleLine.replace(/title:/i, "").trim();
          content = lines.filter(l => !l.toLowerCase().startsWith("title:")).join("\n").trim();
        }

        log("[AI Writer] 🎉 Tạo bài viết độc bản bằng Gemini AI thành công!", "success");
        return { title, content };
      }
    }
    log(`[AI Writer Warn] Phản hồi từ Gemini API không thành công. Status: ${res.status}. Sử dụng mẫu mặc định.`, "warn");
  } catch (err) {
    log(`[AI Writer Warn] Lỗi kết nối Gemini API: ${err.message}. Sử dụng mẫu mặc định.`, "warn");
  }

  // Fallback to static template
  const title = `Hello from ${persona.displayName}! New SEO and Tech Enthusiast here`;
  let content = "";
  if (isDirectLogin) {
    content = `Hi everyone,\n\nI am ${persona.displayName}, originating from ${persona.country || "US"}. I've been working in technical SEO and link acquisition for years. Glad to join this wonderful discussion forum!\n\nI highly recommend visiting my homepage: [url=${targetUrl}]${persona.displayName} SEO Agency[/url] for detailed analytics.\n\nLooking forward to learning from you all!`;
  } else {
    content = `Hi everyone,\n\nI am ${persona.displayName}, originating from ${persona.country || "US"}. I've been working in technical SEO and link acquisition for years. Glad to join this wonderful discussion forum!\n\nLooking forward to learning from you all!`;
  }
  return { title, content };
}

// Actual CMS posting logic for XenForo, phpBB, and Fallback
async function postBacklinkCMS(page, task, username, categoryUrl, categoryTitle = "General", isDirectLogin = false) {
  log(`[Đăng bài] Đang tiến hành tạo bài viết thực tế tại chuyên mục: ${categoryUrl}`);
  
  const targetUrl = process.env.TARGET_BACKLINK_URL || "https://speed-core.net";
  const geminiKey = process.env.GEMINI_API_KEY;
  
  let postTitle = "";
  let postContent = "";

  if (geminiKey && geminiKey !== "YOUR_GEMINI_API_KEY_HERE" && geminiKey.trim().length > 0) {
    const aiContent = await generateAIPostContent(geminiKey, task.persona, targetUrl, categoryTitle, isDirectLogin);
    postTitle = aiContent.title;
    postContent = aiContent.content + `\n\nBest regards,\n${username}`;
  } else {
    postTitle = `Hello from ${task.persona.displayName}! New SEO and Tech Enthusiast here`;
    if (isDirectLogin) {
      postContent = `Hi everyone,\n\nI am ${task.persona.displayName}, originating from ${task.persona.country || "US"}. I've been working in technical SEO and link acquisition for years. Glad to join this wonderful discussion forum!\n\nI highly recommend checking out my home project: [url=${targetUrl}]${task.persona.displayName} Professional SEO Audits[/url] for standard rankings.\n\nLooking forward to learning from you all!\n\nBest regards,\n${username}`;
    } else {
      postContent = `Hi everyone,\n\nI am ${task.persona.displayName}, originating from ${task.persona.country || "US"}. I've been working in technical SEO and link acquisition for years. Glad to join this wonderful discussion forum!\n\nLooking forward to learning from you all!\n\nBest regards,\n${username}`;
    }
  }

  try {
    await page.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    await checkForSecurityScreen(page);

    // ✅ Check if phpBB redirected us to login page (session lost during navigation)
    const currentUrlAfterNav = page.url();
    const redirectedToLogin = currentUrlAfterNav.includes("mode=login") || currentUrlAfterNav.includes("ucp.php");
    if (redirectedToLogin) {
      log("[Đăng bài] ⚠️ Phát hiện bị chuyển hướng về trang login! Re-login ngay...", "warn");
      await loginCMS(page, task, username, task.password || "");
      await page.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
    }

    // Tự động phát hiện CMS thực tế cho mục đăng bài
    let postCms = task.cmsType;
    const pageContent = await page.content().catch(() => "");
    const pageUrl = page.url().toLowerCase();
    
    if (pageContent.includes("wp-content") || pageContent.includes("wp-includes")) {
      postCms = "WordPress";
    } else if (pageContent.includes("phpBB") || pageContent.includes("ucp.php") || pageContent.includes("styles/prosilver")) {
      postCms = "phpBB";
    } else if (pageContent.includes("Discourse") || pageContent.includes("ember-application") || pageContent.includes("data-discourse")) {
      postCms = "Discourse";
    } else if (pageContent.includes("XenForo") || pageContent.includes("js-xenforo") || pageContent.includes("xf-")) {
      postCms = "XenForo";
    } else {
      postCms = "Generic";
    }

    log(`[Đăng bài] CMS thực tế được phát hiện để đăng: ${postCms}`);

    if (postCms === "XenForo") {
      log("[XenForo] Tìm nút 'Post thread' bằng bộ từ khóa đa ngôn ngữ...");
      let postBtn = null;
      
      // 1. Try reliable href patterns first
      postBtn = await page.$("a[href*='post-thread'], a[href*='create-thread']");
      
      // 2. Try text match loop across common languages
      if (!postBtn) {
        const postBtnTexts = [
          "Post thread", "New topic", "Create thread", "New thread", "Post new topic", "Create topic", "Start thread", "Start discussion",
          "Neues Thema", "Thema erstellen", "Neuer Beitrag", "Thema starten", "Beitrag schreiben",
          "Viết bài mới", "Đăng bài mới", "Tạo chủ đề", "Tạo bài viết", "Thảo luận mới",
          "Nouveau sujet", "Créer un sujet", "Nouvelle discussion",
          "Nuevo tema", "Crear tema", "Criar tópico"
        ];
        
        for (const text of postBtnTexts) {
          postBtn = await page.$(`a:has-text("${text}"), button:has-text("${text}"), span:has-text("${text}")`);
          if (postBtn && await postBtn.isVisible().catch(() => false)) {
            log(`[XenForo] 🎉 Tìm thấy nút đăng bài bằng từ khóa: "${text}"`, "success");
            break;
          }
        }
      }
      
      if (!postBtn) {
        postBtn = await page.$(".js-quickThread");
      }
      
      if (!postBtn) {
        // Fallback: Append post-thread to XenForo category URL
        const xenForoUrl = categoryUrl.endsWith("/") ? categoryUrl : categoryUrl + "/";
        const directPostUrl = xenForoUrl + "post-thread";
        log(`[XenForo] Không tìm thấy nút Post Thread. Thử điều hướng trực tiếp đến form posting: ${directPostUrl}...`, "warn");
        await page.goto(directPostUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
        await checkForSecurityScreen(page);
      } else {
        await postBtn.click();
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(2000);
        await checkForSecurityScreen(page);
      }

      log("[XenForo] Điền tiêu đề và nội dung bài viết...");
      const titleInput = await page.$("input[name='title']");
      const editor = await page.$(".fr-element, .redactor-editor");
      const textarea = await page.$("textarea[name='message']");
      
      if (!titleInput || (!editor && !textarea)) {
        throw new Error("Không tìm thấy các ô nhập liệu tiêu đề hoặc nội dung XenForo. Bạn có thể không có quyền gửi bài viết.");
      }

      await titleInput.fill(postTitle);
      if (editor) {
        await editor.fill(postContent);
      } else {
        await textarea.fill(postContent);
      }

      log("[XenForo] Gửi bài viết...");
      const submitBtn = await page.$("button:has-text('Post thread'), button[class*='button--primary'], button[type='submit']");
      if (!submitBtn) {
        throw new Error("Không tìm thấy nút 'Post thread' XenForo.");
      }
      
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => undefined);
      await page.waitForTimeout(6000);
      
      const finalUrl = page.url();
      
      // ✅ Strict Verification for XenForo
      const isStillOnPostingForm = finalUrl.includes("post-thread") || finalUrl.includes("create-thread");
      if (isStillOnPostingForm) {
        const errorText = await page.evaluate(() => {
          const errEl = document.querySelector(".blockMessage--error, .errorList, .js-overlayContainer");
          return errEl ? errEl.innerText.trim() : null;
        });
        if (errorText) {
          throw new Error(`Đăng bài XenForo thất bại: ${errorText}`);
        } else {
          const hasInputs = await page.$("input[name='title'], textarea[name='message'], .fr-element");
          if (hasInputs) {
            throw new Error("Đăng bài XenForo thất bại - form nhập liệu vẫn còn hiển thị (có thể bị chặn spam hoặc yêu cầu captcha).");
          }
        }
      }

      log(`[XenForo] Đăng bài thành công thực tế! Capturing URL: ${finalUrl}`, "success");
      return finalUrl;
    } else if (postCms === "phpBB") {
      log("[phpBB] Tìm nút 'New Topic' bằng bộ từ khóa đa ngôn ngữ...");
      let newTopicBtn = await page.$("a[href*='mode=post'], img[alt='Post new topic']");
      
      if (!newTopicBtn) {
        const phpBBTexts = [
          "New topic", "Post new topic", "Post thread", "Create topic", "Start thread", "Start discussion",
          "Neues Thema", "Thema erstellen", "Neuer Beitrag", "Thema starten", "Beitrag schreiben",
          "Viết bài mới", "Đăng bài mới", "Tạo chủ đề", "Tạo bài viết", "Thảo luận mới",
          "Nouveau sujet", "Créer un sujet", "Nouvelle discussion",
          "Nuevo tema", "Crear tema", "Criar tópico"
        ];
        
        for (const text of phpBBTexts) {
          newTopicBtn = await page.$(`a:has-text("${text}"), button:has-text("${text}"), img[alt*="${text}" i], span:has-text("${text}")`);
          if (newTopicBtn && await newTopicBtn.isVisible().catch(() => false)) {
            log(`[phpBB] 🎉 Tìm thấy nút New Topic bằng từ khóa: "${text}"`, "success");
            break;
          }
        }
      }
      
      if (!newTopicBtn) {
        // Fallback: Try direct bypass using forum ID from category URL
        const categoryUrlObj = new URL(categoryUrl);
        const forumId = categoryUrlObj.searchParams.get("f");
        if (forumId) {
          const directPostUrl = `${categoryUrlObj.origin}/posting.php?mode=post&f=${forumId}`;
          log(`[phpBB] Không tìm thấy nút New Topic. Thử điều hướng trực tiếp đến form posting: ${directPostUrl}...`, "warn");
          await page.goto(directPostUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
          await page.waitForTimeout(3000);
          await checkForSecurityScreen(page);
        } else {
          // Also check if we're on a login page (session expired again)
          const urlNow = page.url();
          if (urlNow.includes("login") || urlNow.includes("mode=login")) {
            throw new Error("Phiên đăng nhập hết hạn - bị chuyển hướng về trang login khi truy cập forum. Tài khoản có thể bị đình chỉ hoặc chưa được kích hoạt.");
          }
          throw new Error("Không tìm thấy nút 'New Topic' phpBB. Có thể diễn đàn này yêu cầu quyền đặc biệt hoặc URL không chứa form tạo bài viết.");
        }
      } else {
        await newTopicBtn.click();
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(2000);
        await checkForSecurityScreen(page);
      }

      // ✅ Check if clicking New Topic redirected us back to login (unverified account)
      const urlAfterClick = page.url();
      const loginRedirected = urlAfterClick.includes("mode=login") || urlAfterClick.includes("ucp.php");
      const loginRequiredText = await page.evaluate(() => {
        const body = document.body.innerText || "";
        return body.includes("Du musst dich anmelden") || body.includes("You must be registered") || body.includes("Login required");
      });
      
      if (loginRedirected || loginRequiredText) {
        // Try bypass: Extract forum ID from category URL and directly navigate to posting form
        log("[phpBB] ⚠️ Phát hiện yêu cầu đăng nhập. Thử bypass trực tiếp đến form đăng bài...", "warn");
        
        const categoryUrlObj = new URL(categoryUrl);
        const forumId = categoryUrlObj.searchParams.get("f");
        if (forumId) {
          const postFormUrl = new URL(categoryUrlObj.origin + "/posting.php");
          postFormUrl.searchParams.set("mode", "post");
          postFormUrl.searchParams.set("f", forumId);
          
          log(`[phpBB] Điều hướng trực tiếp đến form posting: ${postFormUrl.toString()}`);
          await page.goto(postFormUrl.toString(), { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
          await page.waitForTimeout(3000);
          
          // Check again if still redirected to login
          const urlAfterBypass = page.url();
          const stillLoginAfterBypass = urlAfterBypass.includes("mode=login") || await page.evaluate(() => {
            const text = document.body.innerText || "";
            return text.includes("Du musst dich anmelden") || 
                   text.includes("You need to login") || 
                   text.includes("must be registered") ||
                   text.includes("Login required");
          });
          
          if (stillLoginAfterBypass) {
            throw new Error("Tài khoản chưa được kích hoạt email hoặc thông tin đăng nhập sai - không thể đăng bài. Cần verify email trước.");
          }
        } else {
          throw new Error("Bị redirect về login và không thể trích xuất forum ID để bypass. Tài khoản có thể chưa kích hoạt.");
        }
      }

      log("[phpBB] Điền tiêu đề và nội dung...");
      await page.waitForSelector("input[name='subject'], textarea[name='message']", { timeout: 8000 }).catch(() => undefined);
      const subjectInput = await page.$("input[name='subject']");
      const textarea = await page.$("textarea[name='message']");
      if (!subjectInput || !textarea) {
        const debugUrl = page.url();
        log(`[phpBB Debug] URL hiện tại sau click: ${debugUrl}`, "warn");
        throw new Error(`Không tìm thấy ô nhập subject hoặc message trên phpBB. Trang hiện tại: ${debugUrl}`);
      }

      await subjectInput.fill(postTitle);
      await textarea.fill(postContent);

      log("[phpBB] Gửi bài viết...");
      const submitBtn = await page.$("input[type='submit'][name='post']");
      if (!submitBtn) {
        throw new Error("Không tìm thấy nút nộp bài ('post') trên phpBB.");
      }
      
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 25000 }).catch(() => undefined);
      await page.waitForTimeout(6000);
      
      const finalUrl = page.url();
      
      // ✅ Strict Verification for phpBB
      const isStillOnPostingForm = finalUrl.includes("posting.php");
      if (isStillOnPostingForm) {
        const errorText = await page.evaluate(() => {
          const errEl = document.querySelector(".error, div.error, .errorlist");
          return errEl ? errEl.innerText.trim() : null;
        });
        if (errorText) {
          throw new Error(`Đăng bài phpBB thất bại: ${errorText}`);
        } else {
          const hasInputs = await page.$("input[name='subject'], textarea[name='message']");
          if (hasInputs) {
            throw new Error("Đăng bài phpBB thất bại - form nhập liệu vẫn còn hiển thị (có thể bị chặn spam hoặc yêu cầu captcha).");
          }
        }
      }

      log(`[phpBB] Đăng bài thành công thực tế! Capturing URL: ${finalUrl}`, "success");
      return finalUrl;
    } else {
      log("[Fallback] Đang tìm nút tạo bài viết mới ở chế độ chung bằng bộ từ khóa đa ngôn ngữ...");
      let postBtn = null;
      
      // 1. Try URL href patterns first
      postBtn = await page.$("a[href*='post'], a[href*='new-topic'], a[href*='create-thread'], a[href*='write']");
      
      // 2. Try text labels
      if (!postBtn) {
        const fallbackTexts = [
          "Post thread", "New topic", "Create thread", "New thread", "Post new topic", "Create topic", "Start thread", "Start discussion",
          "Neues Thema", "Thema erstellen", "Neuer Beitrag", "Thema starten", "Beitrag schreiben",
          "Viết bài mới", "Đăng bài mới", "Tạo chủ đề", "Tạo bài viết", "Thảo luận mới",
          "Nouveau sujet", "Créer un sujet", "Nouvelle discussion",
          "Nuevo tema", "Crear tema", "Criar tópico"
        ];
        
        for (const text of fallbackTexts) {
          postBtn = await page.$(`a:has-text("${text}"), button:has-text("${text}"), span:has-text("${text}")`);
          if (postBtn && await postBtn.isVisible().catch(() => false)) {
            log(`[Fallback] 🎉 Tìm thấy nút tạo bài viết bằng từ khóa: "${text}"`, "success");
            break;
          }
        }
      }
      
      if (postBtn) {
        log("[Fallback] Click nút tạo bài viết...");
        await postBtn.click();
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
        await checkForSecurityScreen(page);
      }

      log("[Fallback] Thử tìm form đăng bài chung...");
      // Đợi form/editor xuất hiện (Discourse Ember lazy-loads editor)
      await page.waitForSelector("input[name*='title' i], input[name*='subject' i], #reply-title, .d-editor-input", { timeout: 8000 }).catch(() => undefined);

      const titleInput = await page.$("input[name*='title' i], input[name*='subject' i], #reply-title");
      // Discourse uses .d-editor-input for body content
      const textarea = await page.$(".d-editor-input, #wmd-input, textarea[name*='content' i], textarea[name*='body' i], textarea[name*='message' i], textarea[id*='editor' i], textarea");

      if (!titleInput || !textarea) {
        // Last resort: try Discourse API endpoint to post directly
        const isDiscourse = (await page.content().catch(() => "")).includes("Discourse");
        if (isDiscourse) {
          throw new Error("Forum Discourse: Không thể tạo topic vì chưa đăng nhập hoặc tài khoản chưa đủ Trust Level để đăng bài.");
        }
        throw new Error("Không tìm thấy ô nhập tiêu đề hoặc nội dung ở chế độ đăng bài chung.");
      }
      
      // Fill title
      try {
        await titleInput.click({ timeout: 3000 }).catch(() => undefined);
        await titleInput.fill(postTitle, { timeout: 5000 });
      } catch {
        await page.evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input', {bubbles:true})); }, titleInput, postTitle).catch(() => undefined);
      }

      // Fill body (Discourse .d-editor-input)
      try {
        await textarea.click({ timeout: 3000 }).catch(() => undefined);
        await textarea.fill(postContent, { timeout: 5000 });
      } catch {
        await page.evaluate((el, val) => {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', {bubbles:true}));
          el.dispatchEvent(new Event('change', {bubbles:true}));
        }, textarea, postContent).catch(() => undefined);
      }

      await page.waitForTimeout(2000);

      const submitBtn = await page.$("button[type='submit'], input[type='submit'], .create.btn-primary, #reply-control .create");
      if (!submitBtn) {
        throw new Error("Không tìm thấy nút gửi bài viết ở chế độ đăng bài chung.");
      }
      
      try {
        await submitBtn.click({ force: true, timeout: 5000 });
      } catch {
        await page.evaluate(el => el.click(), submitBtn).catch(() => undefined);
      }
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => undefined);
      await page.waitForTimeout(6000);
      
      const finalUrl = page.url();
      
      // ✅ Strict Verification for Fallback (skip check for Discourse which stays on same-ish URL)
      const hasInputs = await page.$("input[name*='title' i], input[name*='subject' i]");
      if (hasInputs && !finalUrl.includes("/t/")) {
        throw new Error("Đăng bài ở chế độ chung thất bại - form nhập liệu vẫn còn hiển thị.");
      }

      log(`[Fallback] Đăng bài thành công thực tế! Capturing URL: ${finalUrl}`, "success");
      return finalUrl;
    }
  } catch (err) {
    log(`[Đăng bài Error] Gặp lỗi khi đăng bài thực tế: ${err.message}`, "warn");
    throw err;
  }
}

async function executeRegistrationAndPosting(task) {
  // Chuẩn hóa URL nếu thiếu tiền tố giao thức (http:// hoặc https://)
  if (task.url && !task.url.startsWith("http://") && !task.url.startsWith("https://")) {
    task.url = "https://" + task.url;
  }

  let browser = await chromium.launch({
    headless: headlessArg,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled" // Stealth setup
    ]
  });

  let context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    viewport: { width: 1280, height: 800 }
  });

  let page = await context.newPage();
  page.setDefaultTimeout(30000);

  const isDirectLogin = !!(task.username && task.password);
  const username = isDirectLogin ? task.username : generateUsername(task.persona.usernameBase);
  // Mật khẩu đủ mạnh: có chữ hoa, chữ thường, số, ký tự đặc biệt
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const password = isDirectLogin ? task.password : `Secure@${randomNum}Abc!`;
  let emailConfirmed = isDirectLogin;
  let registered = isDirectLogin;

  try {
    // --- TỰ ĐỘNG PHÁT HIỆN CMS BAN ĐẦU ---
    log(`[Khởi động] Đang truy cập diễn đàn để nhận diện hệ thống: ${task.url}`);
    await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => undefined);
    await page.waitForTimeout(2000);
    await checkForSecurityScreen(page);
    await dismissCookieConsent(page);

    let detectedCms = task.cmsType;
    const pageContent = await page.content().catch(() => "");
    const pageUrl = page.url().toLowerCase();

    // Xây dựng assetsPattern cho miền hiện tại để lọc các link bên ngoài (tránh false positive)
    let assetsPattern = `(?:\\/|\\.\\/|\\.\\.\\/|wp-content|wp-includes|styles|js|clientscript|ucp\\.php)`;
    try {
      const parsed = new URL(page.url());
      const host = parsed.hostname.replace(/^www\./, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assetsPattern = `(?:(?:https?:)?\\/\\/(?:[^/]+\\.)?${host}|\\/|\\.\\/|\\.\\.\\/|wp-content|wp-includes|styles|js|clientscript|ucp\\.php)`;
    } catch (e) {
      // ignore
    }

    const hasWP = pageUrl.includes("wp-login") || pageUrl.includes("wp-signup") || new RegExp(`(?:href|src)=["']${assetsPattern}[^"']*(wp-content|wp-includes)\\/`, "i").test(pageContent);
    const hasPhpBB = pageUrl.includes("ucp.php") || /powered\s+by\s+phpBB/i.test(pageContent) || new RegExp(`(?:href|action)=["']${assetsPattern}[^"']*(viewforum\\.php\\?f=|viewtopic\\.php\\?[ft]=|ucp\\.php\\?mode=)`, "i").test(pageContent) || pageContent.includes("styles/prosilver");
    const hasDiscourse = pageContent.includes("ember-application") || pageContent.includes("data-discourse") || /Discourse\.SiteSettings/i.test(pageContent) || pageContent.includes("/srv/www/discourse");
    const hasXF = pageUrl.includes("xf-") || pageContent.includes("js-xenforo") || /XF\.config\s*=/i.test(pageContent) || new RegExp(`(?:href|src)=["']${assetsPattern}[^"']*(styles\\/default\\/xenforo|js\\/xf)\\/`, "i").test(pageContent);

    if (hasWP) {
      detectedCms = "WordPress";
    } else if (hasPhpBB) {
      detectedCms = "phpBB";
    } else if (hasDiscourse) {
      detectedCms = "Generic"; // Discourse sử dụng cơ chế fallback của Generic
    } else if (hasXF) {
      detectedCms = "XenForo";
    } else {
      detectedCms = "Generic";
    }

    log(`[Khởi động] CMS cấu hình: ${task.cmsType} | CMS thực tế nhận diện: ${detectedCms}`);
    task.cmsType = detectedCms; // Cập nhật lại cmsType thực tế cho cả luồng chạy sau này

    // --- PHASE 2: AUTO-REGISTRATION ---
    if (!isDirectLogin) {
      try {
        if (task.cmsType === "XenForo") {
          registered = await registerXenForo(page, task, username, password);
        } else if (task.cmsType === "WordPress") {
          registered = await registerWordPress(page, task, username, password);
        } else if (task.cmsType === "phpBB") {
          registered = await registerPhpBB(page, task, username, password);
        } else {
          registered = await registerFallback(page, task, username, password);
        }

        if (!registered) {
          throw new Error("Không thể điền form hoặc nộp đơn đăng ký thành công.");
        }
      } catch (regErr) {
        // Chuyển sang chế độ bán tự động khi đăng ký tự động thất bại
        if (headlessArg) {
          log(`[Bán tự động] Trình duyệt đang chạy ẩn (headless). Đóng và mở lại bằng trình duyệt nổi (headed) để người dùng thao tác...`, "info");
          const currentUrl = page.url();
          await browser.close().catch(() => undefined);
          
          browser = await chromium.launch({
            headless: false,
            args: [
              "--disable-dev-shm-usage",
              "--no-sandbox",
              "--disable-blink-features=AutomationControlled"
            ]
          });
          context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
            viewport: { width: 1280, height: 800 }
          });
          page = await context.newPage();
          page.setDefaultTimeout(30000);
          
          let targetUrl = currentUrl;
          if (!targetUrl || targetUrl === "about:blank") {
            targetUrl = task.url;
          }
          log(`[Bán tự động] Mở lại trang đăng ký: ${targetUrl}`);
          await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => undefined);
          await page.waitForTimeout(2000);
          await dismissCookieConsent(page);
        }

        registered = await runSemiAutoRegistration(page, task, username, password, regErr.message);
        if (!registered) {
          throw regErr;
        }
      }

      // --- IMAP ACTIVATION (Task 2.5) ---
      log(`[IMAP] Đang kiểm tra link kích hoạt gửi đến hòm thư: ${task.email.email}`);
      await sleep(5000); // Wait for email delivery
      
      // Gọi hàm kích hoạt email thực tế qua IMAP (sử dụng cache nếu đã lấy được ở bước bán tự động)
      const activationUrl = task.cachedActivationUrl || await verifyEmailViaImap(task.email, task.url);
      if (activationUrl) {
        log(`[IMAP] Đang điều hướng trình duyệt đến liên kết kích hoạt...`);
        await page.goto(activationUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => undefined);
        await page.waitForTimeout(5000);
        await checkForSecurityScreen(page);

        // ✅ Tự động điền mật khẩu WordPress nếu gặp trang Reset Password
        if (activationUrl.includes("wp-login.php?action=rp") || activationUrl.includes("action=rp")) {
          log("[WordPress] Phát hiện trang thiết lập mật khẩu mới. Tiến hành nhập mật khẩu...", "info");
          const pass1Input = await page.$("input[name='pass1'], #pass1");
          const submitBtn = await page.$("button[type='submit'], #wp-submit");
          if (pass1Input && submitBtn) {
            await pass1Input.fill(password);
            await page.waitForTimeout(1000);
            await submitBtn.click();
            await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
            await page.waitForTimeout(3000);
            log("[WordPress] Đã thiết lập mật khẩu tài khoản thành công!", "success");
          } else {
            log("[WordPress] Không tìm thấy ô nhập mật khẩu hoặc nút gửi trên trang reset.", "warn");
          }
        }

        emailConfirmed = true;
        log(`[IMAP] Đã kích hoạt tài khoản thành công qua liên kết email!`, "success");
      } else {
        log(`[IMAP] Không lấy được link kích hoạt qua hộp thư. Thử tiếp tục luồng bypass...`, "warn");
      }
    } else {
      log(`[Direct Login] Sử dụng tài khoản sẵn có: ${username} (Bỏ qua bước đăng ký & xác thực email)`, "success");
    }

    // --- PHASE 3: 3-MINUTE PROTOCOL (Auto-posting) ---
    log(`[Đăng nhập] Đang tiến hành đăng nhập vào diễn đàn...`);
    try {
      await loginCMS(page, task, username, password);
    } catch (loginErr) {
      if (isDirectLogin) {
        log(`[Đăng nhập] Đăng nhập thất bại lần 1 cho tài khoản sẵn có: ${loginErr.message}. Thử kích hoạt email qua IMAP đề phòng tài khoản chưa được kích hoạt...`, "warn");
        const activationUrl = await verifyEmailViaImap(task.email, task.url);
        if (activationUrl) {
          log(`[IMAP] Đang điều hướng trình duyệt đến liên kết kích hoạt tìm thấy...`);
          await page.goto(activationUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => undefined);
          await page.waitForTimeout(5000);
          await checkForSecurityScreen(page);
          
          log(`[Đăng nhập] Thử đăng nhập lại lần 2 sau khi kích hoạt...`);
          await loginCMS(page, task, username, password);
        } else {
          log(`[IMAP] Không tìm thấy liên kết kích hoạt mới qua IMAP. Ném lỗi đăng nhập ban đầu.`, "error");
          throw loginErr;
        }
      } else {
        throw loginErr;
      }
    }
    
    // --- LURKING PROTOCOL (Task 3.2 - Lurking) ---
    log(`[Nằm vùng] Bắt đầu giao thức Lurking (Click 3 bài viết, ở lại đọc ~10-15s/bài để giả lập người thật)`);
    await lurkOnSite(page, task.url);

    // --- PROFILE UPDATE (Task 3.1) ---
    log(`[Hồ sơ] Cập nhật bio ảo: "${task.persona.bio}"`);
    // Simulating profile updates
    await sleep(2000);

    // --- CATEGORY SEARCH & POSTING (Task 3.3, 3.4 & 3.5) ---
    log(`[Tìm chuyên mục] Đang quay lại trang chủ diễn đàn/bài viết gốc để tìm chuyên mục phù hợp...`);
    await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    await checkForSecurityScreen(page);

    log(`[Tìm chuyên mục] Đang tìm kiếm các sub-forum General, Introductions hoặc Off-topic...`);
    const categoryInfo = await findGeneralCategory(page, task.url);
    log(`[Tìm chuyên mục] Đã tìm thấy chuyên mục đăng phù hợp: "${categoryInfo.title}" (${categoryInfo.url})`);

    log(`[Đăng bài] Gọi LLM AI viết bài giới thiệu chứa backlink...`);
    const postedUrl = await postBacklinkCMS(page, task, username, categoryInfo.url, categoryInfo.title, isDirectLogin);

    log(`[Hoàn tất] Đăng bài thành công! Thành phẩm link: ${postedUrl}`, "success");

    // --- REPORT SUCCESS TO SERVER ---
    await reportResult(task.jobId, "success", {
      username,
      password,
      emailUsed: task.email.email,
      postedUrl,
      forumUrl: task.url
    });

  } catch (err) {
    log(`Thất bại tại nhiệm vụ ${task.url}: ${err.message}`, "error");
    try {
      const fs = require('fs');
      const path = require('path');
      const screenshotDir = path.join(__dirname, 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir);
      }
      const screenshotPath = path.join(screenshotDir, `failure_${task.jobId}.png`);
      await page.screenshot({ path: screenshotPath });
      log(`[Xác minh] Đã chụp ảnh màn hình lỗi tại: screenshots/failure_${task.jobId}.png`);
    } catch (e) {
      log(`Không thể chụp ảnh màn hình lỗi: ${e.message}`, "warn");
    }
    const reportPayload = {
      emailUsed: task.email.email,
      error: err.message
    };
    if (registered) {
      reportPayload.username = username;
      reportPayload.password = password;
    }
    await reportResult(task.jobId, "failed", reportPayload);
  } finally {
    await browser.close();
  }
}

// Dismiss Usercentrics Shadow DOM cookie consent banner
async function dismissUsercentrics(page) {
  try {
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
      log("[Cookie Banner] Đã tắt banner Usercentrics Cookie qua Shadow DOM.", "success");
      await page.waitForTimeout(2000);
      return true;
    }
  } catch (err) {
    // Ignore
  }
  return false;
}

// Dismiss common cookie consent banners (Task 2.2/2.3)
async function dismissCookieConsent(page) {
  try {
    await dismissUsercentrics(page);
    const cookieButtons = await page.$$("a.cc-dismiss, button.cc-dismiss, .cc-btn, a[class*='cookie' i], button[class*='cookie' i], a:has-text('Got it!'), button:has-text('Got it!'), button:has-text('Accept'), a:has-text('Accept'), button:has-text('Đồng ý'), a:has-text('Đồng ý'), button:has-text('đồng ý'), a:has-text('đồng ý'), .js-accept-cookies, #accept-cookies, button[id*='cookie' i]");
    for (const btn of cookieButtons) {
      const isVisible = await btn.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
      }).catch(() => false);
      
      if (isVisible) {
        const text = await btn.innerText().catch(() => "");
        log(`[Cookie Banner] Click nút đồng ý cookie: "${text.trim()}"`);
        await btn.click().catch(() => undefined);
        await page.waitForTimeout(1000);
      }
    }
  } catch (err) {
    // Ignore errors
  }
}


// AI-Powered Anti-Spam Security Q&A Solver using Gemini AI
async function solveSecurityQuestions(page, geminiKey) {
  if (!geminiKey || geminiKey === "YOUR_GEMINI_API_KEY_HERE" || geminiKey.trim().length === 0) {
    log("[Anti-Spam Q&A] Bỏ qua giải câu hỏi bảo mật do thiếu GEMINI_API_KEY.", "info");
    return;
  }

  try {
    log("[Anti-Spam Q&A] Đang quét tìm các câu hỏi bảo mật/anti-spam trên trang...");
    
    // Find all visible input fields (text, number)
    const inputs = await page.$$("input:not([type='hidden']):not([type='submit']):not([type='reset']):not([type='button']):not([type='checkbox']):not([type='radio'])");
    
    for (const input of inputs) {
      const isVisible = await input.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden';
      }).catch(() => false);
      
      if (!isVisible) continue;

      const name = (await input.getAttribute("name").catch(() => "") || "").toLowerCase();
      const id = (await input.getAttribute("id").catch(() => "") || "").toLowerCase();
      const placeholder = (await input.getAttribute("placeholder").catch(() => "") || "").toLowerCase();

      // Skip common fields we already filled or general fields
      const skipKeywords = [
        "username", "email", "password", "pass", "login", "user", "mail", "confirm", 
        "search", "location", "country", "city", "website", "homepage", "url", "bio", "about",
        "interest", "occupation", "signature", "avatar", "pf_"
      ];
      if (skipKeywords.some(kw => name.includes(kw) || id.includes(kw) || placeholder.includes(kw))) {
        continue;
      }

      // Check if it already has a value
      const existingVal = await input.evaluate(el => (el).value).catch(() => "") || "";
      if (existingVal.trim().length > 0) continue;

      // Find associated label or surrounding question text
      const questionText = await page.evaluate((el) => {
        // Helper to clean up strings
        const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

        // 1. Try label with 'for' matching the element ID
        if (el.id) {
          const label = document.querySelector(`label[for="${el.id}"]`);
          if (label && label.innerText.trim().length > 3) return clean(label.innerText);
        }

        // 2. Try closest parent label
        const closestLabel = el.closest("label");
        if (closestLabel && closestLabel.innerText.trim().length > 3) {
          // Remove the input text from label text if it's nested
          return clean(closestLabel.innerText.replace(el.innerText || "", ""));
        }
        
        // 3. Try searching parent nodes for textual questions
        let parent = el.parentElement;
        for (let depth = 0; depth < 4; depth++) {
          if (!parent) break;
          const text = parent.innerText || "";
          const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 3);
          for (const line of lines) {
            const lowerLine = line.toLowerCase();
            if (line.includes("?") || lowerLine.includes("security") || lowerLine.includes("spam") || lowerLine.includes("human") || lowerLine.includes("hỏi") || lowerLine.includes("câu hỏi") || lowerLine.includes("captcha") || lowerLine.includes("robot")) {
              if (line.length < 150) return clean(line);
            }
          }
          parent = parent.parentElement;
        }
        
        // 4. Try previous element sibling text
        const prev = el.previousElementSibling;
        if (prev && prev.innerText && prev.innerText.trim().length > 3) {
          return clean(prev.innerText);
        }
        
        return "";
      }, input).catch(() => "");

      if (questionText && questionText.trim().length > 3) {
        log(`[Anti-Spam Q&A] Câu hỏi phát hiện: "${questionText.trim()}"`);
        
        const prompt = `Solve this security/anti-spam question found on a forum registration page. Return ONLY the answer itself (a single word, number, or short phrase as required), with no other text, explanation, punctuation, or markdown.
Question: "${questionText.trim()}"`;

        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }]
            })
          });

          if (res.ok) {
            const data = await res.json();
            const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (answer && answer.trim().length > 0) {
              const cleanAnswer = answer.trim().replace(/[".']/g, ""); // strip quotes
              log(`[Anti-Spam Q&A] ✅ Lời giải tự động từ Gemini: "${cleanAnswer}"`, "success");
              await input.fill(cleanAnswer).catch(() => undefined);
            }
          } else {
            log(`[Anti-Spam Q&A] API status: ${res.status}`, "warn");
          }
        } catch (e) {
          log(`[Anti-Spam Q&A] Lỗi kết nối Gemini: ${e.message}`, "warn");
        }
      }
    }
  } catch (err) {
    log(`[Anti-Spam Q&A] Gặp lỗi khi xử lý: ${err.message}`, "warn");
  }
}

// XenForo Sign up page automator
async function registerXenForo(page, task, username, password) {
  log("[XenForo] Đang tìm liên kết đăng ký...");
  await dismissCookieConsent(page);
  
  if (!page.url().includes("register") && !page.url().includes("signup")) {
    let regButton = await page.$("a[href*='register' i], a[href*='signup' i], a[href*='sign-up' i], a[href*='join' i], a[href*='create' i], a[href*='registrieren' i], a[href*='dang-ky' i]");
    if (regButton) {
      await regButton.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      await dismissCookieConsent(page);
    } else {
      // Thử đoán đường dẫn đăng ký XenForo ở thư mục con hoặc index.php
      const urlObj = new URL(task.url);
      const pathParts = urlObj.pathname.split('/');
      let registerUrl = urlObj.origin + "/register/";
      let registerUrl2 = urlObj.origin + "/index.php?register/";
      
      if (pathParts.length > 2) {
        const subDir = pathParts[1];
        if (subDir !== "threads" && subDir !== "forums" && subDir !== "members" && !subDir.includes(".")) {
          registerUrl = urlObj.origin + "/" + subDir + "/register/";
          registerUrl2 = urlObj.origin + "/" + subDir + "/index.php?register/";
        }
      }
      log(`[XenForo] Không tìm thấy link đăng ký, thử điều hướng trực tiếp đến: ${registerUrl}`);
      await page.goto(registerUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
      await dismissCookieConsent(page);
 
      // Check if form is visible. If not, try fallback with query params
      const formExists = await page.$("input[type='text'], input[type='email'], input[autocomplete='username']");
      if (!formExists) {
        log(`[XenForo] Không thấy form tại URL đầu tiên. Thử điều hướng đến fallback: ${registerUrl2}`);
        await page.goto(registerUrl2, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
        await dismissCookieConsent(page);
      }
    }
  }

  // Đảm bảo chúng ta thực sự đang ở trang đăng ký
  if (!page.url().includes("register") && !page.url().includes("signup")) {
    throw new Error("Không thể truy cập trang đăng ký XenForo (Bị chặn hoặc chuyển hướng).");
  }
 
  // Đợi giải quyết CAPTCHA hoặc bảo mật trên trang đăng ký
  await checkForSecurityScreen(page);

  // Chờ form xuất hiện trước khi điền
  await page.waitForSelector("input[type='text'], input[type='email'], input[autocomplete='username']", { timeout: 10000 }).catch(() => undefined);

  log(`[XenForo] Đang điền form đăng ký với tên: ${username}`);
  
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
      log(`[XenForo] Bỏ qua trường Honeypot ẩn: name="${name}"`, "info");
      continue;
    }

    if (!uEl && (autocomplete === "username" || autocomplete === "nickname" || name.includes("username") || id.includes("username"))) {
      uEl = input;
    } else if (!eEl && (autocomplete === "email" || type === "email" || name.includes("email") || id.includes("email"))) {
      eEl = input;
    } else if (!pEl && (autocomplete === "new-password" || autocomplete === "password" || type === "password" || name.includes("password") || id.includes("password"))) {
      pEl = input;
    }
  }

  // If still not found, try to look by labels for visible inputs
  if (!uEl || !eEl || !pEl) {
    log("[XenForo] Chưa tìm đủ các trường chính bằng autocomplete. Thử quét nhãn (label)...");
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
      } else if (!eEl && (labelText.includes("email") || labelText.includes("thư điện tử"))) {
        eEl = input;
      } else if (!pEl && (labelText.includes("password") || labelText.includes("mật khẩu"))) {
        pEl = input;
      }
    }
  }

  let filled = false;
  if (uEl && eEl && pEl) {
    await uEl.fill(username);
    await eEl.fill(task.email.email);
    await pEl.fill(password);
    log("[XenForo] Đã điền xong các trường: Username, Email, Password thành công.", "success");

    // Agree to terms checkbox
    const agreeCheckbox = await page.$("input[type='checkbox'][name*='agree' i], input[type='checkbox'][name*='accept' i], input[type='checkbox'][name*='reg' i], input[type='checkbox'][required]");
    if (agreeCheckbox) {
      await agreeCheckbox.check().catch(() => undefined);
      log("[XenForo] Đã tích chọn đồng ý điều khoản.");
    }
    filled = true;
  }

  if (!filled) {
    log("[XenForo] ❌ Không thể điền đầy đủ các trường đăng ký chính.", "error");
    return false;
  }


  // Tự động giải câu hỏi bảo mật/anti-spam của XenForo nếu có
  await solveSecurityQuestions(page, process.env.GEMINI_API_KEY);

  log("[XenForo] Nộp đơn đăng ký...");
  const submitBtn = await page.$("button[type='submit'], input[type='submit']");
  if (submitBtn) {
    await submitBtn.click();
    await page.waitForTimeout(5000);
    
    // Kiểm tra lỗi phản hồi từ trang đăng ký XenForo
    const errorEl = await page.$(".blockMessage--error, .errorList, .js-overlayContainer");
    if (errorEl) {
      const errorText = await errorEl.innerText().catch(() => "");
      if (errorText && errorText.trim().length > 0) {
        log(`[XenForo Error] Lỗi đăng ký: ${errorText.trim()}`, "error");
        throw new Error(`Đăng ký XenForo thất bại: ${errorText.trim()}`);
      }
    }
    return true;
  }
  return false;
}

// WordPress registration automator
async function registerWordPress(page, task, username, password) {
  log("[WordPress] Điều hướng đến trang đăng ký mặc định...");
  const urlObj = new URL(task.url);
  const registerUrl = urlObj.origin + "/wp-login.php?action=register";
  await page.goto(registerUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);

  // Đợi giải quyết CAPTCHA hoặc bảo mật
  await checkForSecurityScreen(page);

  // Chờ form xuất hiện trước khi điền
  await page.waitForSelector("input[id='user_login']", { timeout: 10000 }).catch(() => undefined);

  const uEl = await page.$("input[id='user_login']");
  const eEl = await page.$("input[id='user_email']");

  if (uEl && eEl) {
    await uEl.fill(username);
    await eEl.fill(task.email.email);
    
    const submitBtn = await page.$("input[id='wp-submit']");
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(5000);
      
      // Kiểm tra lỗi phản hồi của WordPress
      const errorEl = await page.$("#login_error");
      if (errorEl) {
        const errorText = await errorEl.innerText().catch(() => "");
        if (errorText && errorText.trim().length > 0) {
          log(`[WordPress Error] Lỗi đăng ký: ${errorText.trim()}`, "error");
          throw new Error(`Đăng ký WordPress thất bại: ${errorText.trim()}`);
        }
      }
      return true;
    }
  }
  return false;
}

// phpBB registration automator
async function registerPhpBB(page, task, username, password) {
  log("[phpBB] Điều hướng đến trang đăng ký...");
  const urlObj = new URL(task.url);
  const pathParts = urlObj.pathname.split('/');
  let registerUrl = urlObj.origin + "/ucp.php?mode=register";
  if (pathParts.length > 2) {
    const subDir = pathParts[1];
    if (subDir !== "viewtopic.php" && subDir !== "viewforum.php" && subDir !== "community") {
      registerUrl = urlObj.origin + "/" + subDir + "/ucp.php?mode=register";
    } else if (subDir === "community") {
      registerUrl = urlObj.origin + "/community/ucp.php?mode=register";
    }
  }
  
  await dismissCookieConsent(page);
  await page.goto(registerUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(err => {
    log(`[phpBB] Lỗi khi chuyển hướng trực tiếp đến link đăng ký: ${err.message}`, "warn");
    return null;
  });
  await page.waitForTimeout(3000);
  await dismissCookieConsent(page);

  // Đợi giải quyết CAPTCHA hoặc bảo mật
  await checkForSecurityScreen(page);

  // Nếu bị chuyển hướng khỏi trang đăng ký (do thiếu session/cookie hoặc cấu hình khác)
  if (!page.url().includes("mode=register") && !page.url().includes("register")) {
    log("[phpBB] Không thể vào trang đăng ký trực tiếp. Thử tìm và click nút Register trên giao diện...");
    const regBtn = await page.$("a[href*='mode=register' i], a[href*='register' i], a:has-text('Register'), a:has-text('Registrieren'), a:has-text('Đăng ký')");
    if (regBtn && await regBtn.isVisible().catch(() => false)) {
      log("[phpBB] Click nút Register tìm thấy trên trang...");
      await regBtn.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
      await dismissCookieConsent(page);
      await checkForSecurityScreen(page);
    }
  }

  // Đảm bảo chúng ta thực sự đang ở trang đăng ký
  if (!page.url().includes("mode=register") && !page.url().includes("register")) {
    throw new Error("Không thể truy cập trang đăng ký của diễn đàn (Bị chặn hoặc chuyển hướng).");
  }

  // Nhấn đồng ý điều khoản hoặc vượt màn hình COPPA screen của phpBB (hỗ trợ nhiều bước)
  let reachedForm = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const isFormPresent = await page.evaluate(() => {
      const el = document.querySelector("input[name='email'], input[id='email']");
      if (!el) return { present: false, visible: false };
      return { present: true, visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) };
    });
    log(`[Debug phpBB] Attempt ${attempt} - isFormPresent: ${JSON.stringify(isFormPresent)}`);
    if (isFormPresent.visible) {
      reachedForm = true;
      break;
    }

    const nextBtnHandle = await page.evaluateHandle(() => {
      const elms = Array.from(document.querySelectorAll('a, input, button'));
      
      const isVisible = (el) => {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      };

      // 1. High priority: "older than 13" or standard agree matchers
      for (const el of elms) {
        if (!isVisible(el)) continue;
        const text = (el.textContent || el.value || '').toLowerCase();
        const href = (el.getAttribute('href') || '').toLowerCase();
        const name = (el.getAttribute('name') || '').toLowerCase();
        
        if (
          href.includes('coppa=0') ||
          text.includes('before') ||
          text.includes('older') ||
          text.includes('over 13') ||
          name.includes('agreed') ||
          name.includes('agree') ||
          text.includes('agree') ||
          text.includes('stimme') ||
          text.includes('einverstanden') ||
          text.includes('đồng ý') ||
          text.includes('dong y') ||
          text.includes('accepte') ||
          text.includes('accept')
        ) {
          return el;
        }
      }
      // 2. Low priority: fallback coppa/date buttons
      for (const el of elms) {
        if (!isVisible(el)) continue;
        const text = (el.textContent || el.value || '').toLowerCase();
        const href = (el.getAttribute('href') || '').toLowerCase();
        if (href.includes('coppa') || text.includes('after') || text.includes('born')) {
          return el;
        }
      }
      return null;
    });

    const nextBtn = nextBtnHandle.asElement();

    if (nextBtn) {
      const btnInfo = await page.evaluate(el => ({
        tag: el.tagName,
        text: el.textContent || el.value || '',
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        type: el.getAttribute('type') || ''
      }), nextBtn);
      log(`[Debug phpBB] nextBtn found: ${JSON.stringify(btnInfo)}`);
      
      log(`[phpBB] Phát hiện và click nút đồng ý/COPPA để tiếp tục (Attempt ${attempt})...`);
      await dismissCookieConsent(page);
      await nextBtn.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
      await dismissCookieConsent(page);
      await checkForSecurityScreen(page);
    } else {
      log(`[Debug phpBB] nextBtn NOT found on attempt ${attempt}`);
      break;
    }
  }

  // Chờ form xuất hiện trước khi điền để tránh race conditions
  await page.waitForSelector("input[name='username'], input[id='username']", { timeout: 10000 }).catch(() => undefined);

  log(`[phpBB] Đang điền form đăng ký với tên: ${username}`);
  const usernameInput = await page.$("input[name='username'], input[id='username']");
  const emailInput = await page.$("input[name='email'], input[id='email']");
  const emailConfirmInput = await page.$("input[name='email_confirm']");
  const passwordInput = await page.$("input[name='new_password'], input[name='password']");
  const passwordConfirmInput = await page.$("input[name='password_confirm']");

  if (usernameInput && emailInput && passwordInput) {
    await usernameInput.fill(username);
    await emailInput.fill(task.email.email);
    if (emailConfirmInput) await emailConfirmInput.fill(task.email.email);
    await passwordInput.fill(password);
    if (passwordConfirmInput) await passwordConfirmInput.fill(password);

    // Tự động điền các trường hồ sơ tùy chỉnh (Custom Profile Fields) như pf_name để bypass bắt buộc
    try {
      const extraInputs = await page.$$("input:not([type='hidden']):not([type='submit']):not([type='reset']):not([type='button']), select, textarea");
      for (const input of extraInputs) {
        const isVisible = await input.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
        }).catch(() => false);
        
        if (!isVisible) continue;

        const name = await input.getAttribute("name").catch(() => "") || "";
        const id = await input.getAttribute("id").catch(() => "") || "";
        const type = await input.getAttribute("type").catch(() => "") || "";
        const tagName = await input.evaluate(el => el.tagName.toLowerCase()).catch(() => "");

        // Skip fields we already filled
        if (
          name === "username" || id === "username" ||
          name === "email" || id === "email" ||
          name === "email_confirm" ||
          name === "new_password" || name === "password" ||
          name === "password_confirm"
        ) {
          continue;
        }

        // Check if it already has a value
        const value = await input.evaluate(el => (el).value).catch(() => "") || "";
        if (value.trim().length > 0) continue;

        const lowerName = (name.toLowerCase() + "_" + id.toLowerCase());
        let fillVal = "";

        if (name.startsWith("pf_") || lowerName.includes("realname") || lowerName.includes("name") || lowerName.includes("profile")) {
          if (lowerName.includes("location") || lowerName.includes("country") || lowerName.includes("city")) {
            fillVal = task.persona.country || "US";
          } else if (lowerName.includes("bio") || lowerName.includes("about") || lowerName.includes("interest") || lowerName.includes("occupation")) {
            fillVal = task.persona.bio || "I am a web enthusiast.";
          } else if (lowerName.includes("website") || lowerName.includes("homepage") || lowerName.includes("url")) {
            fillVal = ""; // Keep empty or target backlink
          } else {
            fillVal = task.persona.displayName || "JohnDoe";
          }
        } else if (lowerName.includes("captcha") || lowerName.includes("confirm_code") || lowerName.includes("mcaptcha")) {
          continue;
        } else if (tagName === "select") {
          continue;
        } else if (tagName === "textarea") {
          fillVal = task.persona.bio || "Hello from my profile!";
        } else if (type === "text") {
          fillVal = task.persona.displayName || "JohnDoe";
        }

        if (fillVal) {
          log(`[phpBB] Tự động điền trường tùy chỉnh '${name}' với giá trị: '${fillVal}'`);
          await input.fill(fillVal).catch(() => undefined);
        }
      }
    } catch (err) {
      log(`Lỗi khi quét các trường tùy chỉnh phpBB: ${err.message}`, "warn");
    }

    // Tự động giải các câu hỏi bảo mật/anti-spam của phpBB nếu có
    await solveSecurityQuestions(page, process.env.GEMINI_API_KEY);

    // Tự động click checkbox mCaptcha (I'm not a robot) nếu có và đợi giải quyết
    try {
      log("[phpBB] Đang tìm kiếm và kích hoạt checkbox mCaptcha...");
      let clicked = false;
      for (const frame of page.frames()) {
        const checkbox = await frame.$("input[type='checkbox'], [role='checkbox'], #widget-checkbox, .checkbox, #anchor");
        if (checkbox) {
          log("[phpBB] Click checkbox mCaptcha trong frame...");
          await checkbox.click().catch(() => undefined);
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        const checkbox = await page.$("input[type='checkbox'], [role='checkbox'], .checkbox");
        if (checkbox) {
          log("[phpBB] Click checkbox mCaptcha trên trang chính...");
          await checkbox.click().catch(() => undefined);
        }
      }

      // Đợi CAPTCHA hoàn tất trả về token (tối đa 15s)
      const tokenInput = await page.$("input[name='mcaptcha__token'], input[name*='captcha' i]");
      if (tokenInput) {
        log("[phpBB] Đang đợi CAPTCHA hoàn thành và trả về token...");
        for (let i = 0; i < 15; i++) {
          const tokenVal = await tokenInput.evaluate(el => el.value).catch(() => "");
          if (tokenVal && tokenVal.trim().length > 0) {
            log("[phpBB] ✅ CAPTCHA đã được giải tự động thành công!", "success");
            break;
          }
          await page.waitForTimeout(1000);
        }
      }
    } catch (mCapErr) {
      log(`Lỗi xử lý mCaptcha: ${mCapErr.message}`, "warn");
    }

    log("[phpBB] Click nút Absenden/Submit...");
    const submitBtn = await page.$("input[type='submit'][name='submit'], button[type='submit'][name='submit']") ||
                      await page.$("input[type='submit']:not([name='preview'])") ||
                      await page.$("button[type='submit']");
    if (submitBtn) {
      await submitBtn.click();
      
      // Đợi chuyển trang hoặc networkidle
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 10000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
      
      // 1. Kiểm tra lỗi phản hồi của phpBB
      const errorEl = await page.$(".error, div.error, .errorlist");
      if (errorEl) {
        const errorText = await errorEl.innerText().catch(() => "");
        if (errorText && errorText.trim().length > 0) {
          log(`[phpBB Error] Lỗi đăng ký: ${errorText.trim()}`, "error");
          throw new Error(`Đăng ký phpBB thất bại: ${errorText.trim()}`);
        }
      }

      // 2. Kiểm tra text trang để xác minh đăng ký thành công
      const pageText = await page.evaluate(() => document.body.innerText).catch(() => "");
      const successKeywords = [
        "erstellt", "created", "registriert", "registered", "aktiviert", "activated", 
        "kích hoạt", "thành công", "wilkommen", "welcome", "e-mail an", "email sent",
        "posteingang", "inbox", "registrierung", "information"
      ];
      
      const containsSuccess = successKeywords.some(kw => pageText.toLowerCase().includes(kw));
      const hasEmailInUse = pageText.toLowerCase().includes("e-mail-adresse wird bereits verwendet") || 
                            pageText.toLowerCase().includes("email address is already in use") ||
                            pageText.toLowerCase().includes("already registered");

      if (hasEmailInUse) {
        throw new Error("Đăng ký phpBB thất bại: Die angegebene E-Mail-Adresse wird bereits verwendet.");
      }
      
      if (containsSuccess) {
        log("[phpBB] Đăng ký thành công! Đang chờ email kích hoạt...", "success");
        return true;
      }

      // Kiểm tra xem form đăng ký có bị tải lại do thiếu thông tin/sai captcha không
      const stillHasInputs = await page.$("input[name='username']");
      if (stillHasInputs) {
        log("[phpBB] ⚠️ Form đăng ký vẫn còn xuất hiện sau khi submit. Có thể thiếu thông tin hoặc sai CAPTCHA.", "warn");
        throw new Error("Đăng ký phpBB thất bại: Form đăng ký bị tải lại (thiếu thông tin hoặc sai CAPTCHA).");
      }

      log("[phpBB] Không phát hiện lỗi rõ ràng, tiếp tục bước kích hoạt email.");
      return true;
    }
  }
  return false;
}

// Fallback register form
async function registerFallback(page, task, username, password) {
  log("[Fallback] Khởi động chế độ điền form đăng ký thông minh cho mọi loại diễn đàn...");
  
  // 1. Kiểm tra xem URL hiện tại có phải trang đăng ký không. Nếu không, cố gắng tìm link/nút đăng ký và click.
  const currentUrl = page.url().toLowerCase();
  const isOnRegisterPage = currentUrl.includes("register") || 
                           currentUrl.includes("signup") || 
                           currentUrl.includes("sign-up") || 
                           currentUrl.includes("createaccount") || 
                           currentUrl.includes("create-account") || 
                           currentUrl.includes("mode=register");
  
  if (!isOnRegisterPage) {
    log("[Fallback] Chưa ở trang đăng ký. Đang tìm nút Register/Sign Up...");
    const regBtn = await page.$("a[href*='register' i], a[href*='signup' i], a[href*='sign-up' i], a[href*='create-account' i], a[href*='mode=register' i], a:has-text('Register'), a:has-text('Sign Up'), a:has-text('Registrieren'), a:has-text('Đăng ký'), a:has-text('Créer un compte')");
    if (regBtn && await regBtn.isVisible().catch(() => false)) {
      log("[Fallback] Phát hiện nút Đăng ký, tiến hành Click...");
      await regBtn.click();
      // Đợi chuyển trang hoặc xuất hiện ô nhập liệu (nếu mở modal)
      await Promise.race([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 8000 }),
        page.waitForSelector("input", { timeout: 8000 })
      ]).catch(() => undefined);
      await page.waitForTimeout(3000);
      await dismissCookieConsent(page);
      await checkForSecurityScreen(page);
    } else {
      // Thử đoán URL đăng ký bằng các pattern phổ biến
      const urlObj = new URL(page.url());
      const commonPaths = ["/register", "/signup", "/register/", "/signup/", "/index.php?app=core&module=global&section=register", "/ucp.php?mode=register"];
      let foundReg = false;
      for (const p of commonPaths) {
        const testUrl = urlObj.origin + p;
        log(`[Fallback] Thử truy cập trực tiếp đường dẫn đăng ký dự đoán: ${testUrl}...`);
        const res = await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);
        if (res && res.ok()) {
          await page.waitForTimeout(2000);
          const hasEmail = await page.$("input[type='email']");
          if (hasEmail) {
            log(`[Fallback] Vào trang đăng ký thành công qua URL dự đoán: ${testUrl}`, "success");
            foundReg = true;
            break;
          }
        }
      }
      if (!foundReg) {
        log("[Fallback Warn] Không tự động chuyển tiếp tới trang đăng ký được. Thử tiếp tục quét form tại trang hiện tại...", "warn");
      }
    }
  }

  // Bỏ qua các trang điều khoản dịch vụ (Agree / Accept) nếu gặp phải
  const agreeBtn = await page.$("input[type='submit'][name='agreed'], button:has-text('Agree'), a:has-text('Agree'), button:has-text('Accept'), a:has-text('Accept'), button:has-text('Đồng ý'), a:has-text('Đồng ý'), button:has-text('Einverstanden'), a:has-text('Einverstanden')");
  if (agreeBtn && await agreeBtn.isVisible().catch(() => false)) {
    log("[Fallback] Nhấp chọn nút đồng ý điều khoản dịch vụ...");
    await agreeBtn.click();
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    await dismissCookieConsent(page);
    await checkForSecurityScreen(page);
  }

  // 2. Chờ trường email xuất hiện hoặc nạp các trường form
  await page.waitForSelector("input", { timeout: 8000 }).catch(() => undefined);

  // Lấy danh sách toàn bộ thẻ input/select/textarea
  const allInputs = await page.$$("input:not([type='hidden']), select, textarea");
  
  let usernameEl = null;
  let fullnameEl = null;
  let emailEl = null;
  let emailConfirmEl = null;
  let passwordEl = null;
  let passwordConfirmEl = null;
  const agreementCheckboxes = [];
  
  for (const input of allInputs) {
    const isVisible = await input.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden';
    }).catch(() => false);
    if (!isVisible) continue;

    const type = (await input.getAttribute("type").catch(() => "") || "").toLowerCase();
    const name = (await input.getAttribute("name").catch(() => "") || "").toLowerCase();
    const id = (await input.getAttribute("id").catch(() => "") || "").toLowerCase();
    const placeholder = (await input.getAttribute("placeholder").catch(() => "") || "").toLowerCase();
    
    // 1. Nhận diện Email
    if (type === "email" || name.includes("email") || name.includes("mail") || id.includes("email") || id.includes("mail")) {
      if (name.includes("confirm") || name.includes("check") || name.includes("repeat") || id.includes("confirm")) {
        emailConfirmEl = input;
      } else if (!emailEl) {
        emailEl = input;
      }
    }
    
    // 2. Nhận diện Username
    else if (type === "text" && (name.includes("user") || name.includes("nick") || name.includes("login") || id.includes("user") || id.includes("nick") || placeholder.includes("user") || placeholder.includes("tên đăng nhập") || placeholder.includes("tên tài khoản"))) {
      if (!usernameEl) usernameEl = input;
    }

    // 2b. Nhận diện Họ tên / Tên hiển thị (Full Name / Display Name)
    else if (type === "text" && (name.includes("name") || name.includes("display") || id.includes("name") || id.includes("display") || placeholder.includes("name") || placeholder.includes("họ tên") || placeholder.includes("tên hiển thị"))) {
      if (!fullnameEl) fullnameEl = input;
    }
    
    // 3. Nhận diện Password
    else if (type === "password" || name.includes("pass") || id.includes("pass")) {
      if (name.includes("confirm") || name.includes("check") || name.includes("repeat") || name.includes("2") || id.includes("confirm") || id.includes("check")) {
        passwordConfirmEl = input;
      } else if (!passwordEl) {
        passwordEl = input;
      }
    }
    
    // 4. Nhận diện Checkbox Đồng ý điều khoản
    else if (type === "checkbox") {
      const isRequired = await input.getAttribute("required").catch(() => null);
      const labelText = await page.evaluate(el => {
        const parentLabel = el.closest("label");
        if (parentLabel) return parentLabel.innerText.toLowerCase();
        if (el.id) {
          const l = document.querySelector(`label[for="${el.id}"]`);
          if (l) return l.innerText.toLowerCase();
        }
        return el.parentElement ? el.parentElement.innerText.toLowerCase() : "";
      }, input).catch(() => "");
      
      const keywords = ["agree", "accept", "terms", "privacy", "policy", "rules", "condition", "datenschutz", "nutzungsbedingungen", "đồng ý", "điều khoản", "chấp nhận"];
      if (isRequired || keywords.some(kw => labelText.includes(kw) || name.includes(kw) || id.includes(kw))) {
        agreementCheckboxes.push(input);
      }
    }
  }

  // Nếu vẫn chưa tìm được username nhưng có trường input text đầu tiên rỗng
  if (!usernameEl) {
    for (const input of allInputs) {
      const type = (await input.getAttribute("type").catch(() => "") || "").toLowerCase();
      const name = (await input.getAttribute("name").catch(() => "") || "").toLowerCase();
      if (type === "text" && !name.includes("captcha") && !name.includes("confirm") && !name.includes("code")) {
        usernameEl = input;
        break;
      }
    }
  }

  if (emailEl) {
    log(`[Fallback] Điền Email: ${task.email.email}`);
    await emailEl.fill(task.email.email);
    if (emailConfirmEl) {
      log(`[Fallback] Điền Xác nhận Email: ${task.email.email}`);
      await emailConfirmEl.fill(task.email.email);
    }
    
    if (usernameEl) {
      log(`[Fallback] Điền Username: ${username}`);
      await usernameEl.fill(username);
    }

    if (fullnameEl) {
      log(`[Fallback] Điền Họ tên/Tên hiển thị: ${task.persona.displayName}`);
      await fullnameEl.fill(task.persona.displayName);
    }
    
    if (passwordEl) {
      log(`[Fallback] Điền Password: ${password}`);
      await passwordEl.fill(password);
      if (passwordConfirmEl) {
        log(`[Fallback] Điền Xác nhận Password: ${password}`);
        await passwordConfirmEl.fill(password);
      }
    }

    // Tích các checkbox đồng ý điều khoản
    for (const checkbox of agreementCheckboxes) {
      log("[Fallback] Tích chọn checkbox đồng ý điều khoản...");
      await checkbox.check().catch(() => undefined);
    }

    // Tự động giải các câu hỏi bảo mật/anti-spam fallback nếu có
    const geminiKey = process.env.GEMINI_API_KEY;
    await solveSecurityQuestions(page, geminiKey);

    // Giải CAPTCHA hình ảnh (nếu xuất hiện)
    await checkForSecurityScreen(page);

    // Tìm và Click nút submit
    let submitBtn = await page.$("button[type='submit'], input[type='submit']");
    if (!submitBtn) {
      const submitSelectors = [
        "button:has-text('Register')", "button:has-text('Sign Up')", "button:has-text('Create Account')", 
        "input[value*='Register' i]", "input[value*='Sign Up' i]", "input[value*='Create' i]",
        "button:has-text('Đăng ký')", "button:has-text('Registrieren')", "button:has-text('Submit')",
        ".ipsButton_primary", ".btn-primary", "button.create", "button[class*='signup']", "button[class*='register']"
      ];
      for (const sel of submitSelectors) {
        submitBtn = await page.$(sel);
        if (submitBtn) break;
      }
    }

    if (submitBtn) {
      log("[Fallback] Gửi form đăng ký (Submit)...");
      // Thử click thường trước, sau đó dùng JS click nếu thường không hoạt động (Discourse/Ember)
      try {
        await submitBtn.click({ timeout: 5000 });
      } catch (clickErr) {
        log("[Fallback] Click thường thất bại, thử JS click (Discourse/Ember)...", "warn");
        await page.evaluate(el => el.click(), submitBtn).catch(() => undefined);
      }
      await page.waitForTimeout(6000);
      await checkForSecurityScreen(page);

      // Kiểm tra lỗi phản hồi chung
      const errorEl = await page.$(".error, .alert-error, .alert-danger, #error, #login_error, .blockMessage--error, .ipsMessage--error");
      if (errorEl) {
        const errorText = await errorEl.innerText().catch(() => "");
        if (errorText && errorText.trim().length > 0) {
          log(`[Fallback Error] Lỗi đăng ký: ${errorText.trim()}`, "error");
          throw new Error(`Đăng ký thất bại: ${errorText.trim()}`);
        }
      }
      return true;
    }
  }
  return false;
}

// Simulate IMAP email verification link search (Task 2.5)
async function simulateImapVerification(email) {
  log(`[IMAP Simulation] Kiểm tra hộp thư cho ${email}...`);
  await sleep(3000);
  return true; // Successfully activated account
}

// Lurking protocol: visits 3 articles, stay ~5s on each and scrolls (Task 3.2)
async function lurkOnSite(page, baseUrl) {
  try {
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href*='/threads/'], a[href*='/p/']"))
        .map(a => a.getAttribute("href"))
        .filter(href => href && !href.startsWith("#"))
        .slice(0, 3);
    });

    if (links.length === 0) {
      log("[Nằm vùng] Không tìm thấy bài viết nào để lướt xem. Nằm vùng trực tiếp trên trang chủ.");
      await page.evaluate(() => window.scrollBy(0, 400));
      await sleep(5000);
      return;
    }

    for (const link of links) {
      let fullUrl = link;
      try {
        fullUrl = new URL(link, page.url()).toString();
      } catch (err) {
        fullUrl = link.startsWith("http") ? link : `${baseUrl}${link.startsWith("/") ? "" : "/"}${link}`;
      }
      log(`[Nằm vùng] Đang lướt xem bài đăng: ${fullUrl}`);
      await page.goto(fullUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
      
      // Slow scroll mimicry
      await page.evaluate(() => window.scrollBy(0, 200));
      await sleep(3000);
      await page.evaluate(() => window.scrollBy(0, 300));
      await sleep(2000);
    }
  } catch (err) {
    log(`[Nằm vùng] Bỏ qua lỗi nằm vùng: ${err.message}`, "warn");
  }
}

// Locate general or popular high-activity sections matching keywords (Task 3.3)
// Locate general or popular high-activity sections matching keywords or highest stats (views/posts) (Task 3.3)
async function findGeneralCategory(page, baseUrl) {
  try {
    // 1. If we are on a topic/thread detail page, try to extract the parent forum from breadcrumbs first
    const breadcrumbInfo = await page.evaluate(() => {
      // Common breadcrumb selectors for phpBB and XenForo
      const selectors = [
        "li.breadcrumbs a[href*='viewforum.php']",
        "ul.navlinks a[href*='viewforum.php']",
        ".breadcrumb a[href*='/forums/']",
        ".p-breadcrumbs a[href*='/forums/']",
        "a[href*='viewforum.php']",
        "a[href*='/forums/']"
      ];
      
      for (const selector of selectors) {
        const anchors = Array.from(document.querySelectorAll(selector));
        if (anchors.length > 0) {
          // Select the last breadcrumb anchor (usually the direct parent sub-forum)
          const lastAnchor = anchors[anchors.length - 1];
          const href = lastAnchor.getAttribute("href");
          const text = (lastAnchor.textContent || "").trim();
          if (href && !href.includes("index.php") && text.length > 0) {
            return { href, title: text };
          }
        }
      }
      return null;
    });

    if (breadcrumbInfo && breadcrumbInfo.href) {
      try {
        const fullUrl = new URL(breadcrumbInfo.href, page.url()).toString();
        log(`[Tìm chuyên mục] 🎉 Tìm thấy sub-forum cha từ Breadcrumbs: "${breadcrumbInfo.title}" (${fullUrl})`, "success");
        return { url: fullUrl, title: breadcrumbInfo.title };
      } catch (err) {}
    }

    // 2. Premium Statistical High-Traffic Ranking Engine
    log("[Tìm chuyên mục] 📊 Khởi động Bộ phân tích lưu lượng chuyên mục (Traffic Ranking Engine)...");
    const bestCategory = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      const keywords = ["general", "introduction", "off-topic", "discussions", "chat", "seo", "marketing", "business", "tech", "lounge", "news", "forum", "public", "thảo luận", "chung", "tán gẫu"];
      
      const parsedSubforums = [];

      // Helper to parse numbers like 4.5K, 1.2M, 5,432
      function parseStatNumber(text) {
        if (!text) return 0;
        let clean = text.replace(/,/g, "").trim().toLowerCase();
        let multiplier = 1;
        if (clean.endsWith("k")) {
          multiplier = 1000;
          clean = clean.slice(0, -1);
        } else if (clean.endsWith("m")) {
          multiplier = 1000000;
          clean = clean.slice(0, -1);
        }
        const val = parseFloat(clean);
        return isNaN(val) ? 0 : val * multiplier;
      }

      for (const a of anchors) {
        const href = (a.getAttribute("href") || "").trim();
        const hrefLower = href.toLowerCase();
        
        // Exclude generic links
        if (
          !href ||
          hrefLower === "index.php" ||
          hrefLower === "./index.php" ||
          hrefLower.endsWith("/index.php") ||
          hrefLower === "/" ||
          hrefLower.startsWith("#") ||
          hrefLower.includes("ucp.php") ||
          hrefLower.includes("mcp.php") ||
          hrefLower.includes("login") ||
          hrefLower.includes("register")
        ) {
          continue;
        }

        // We only target valid forum/category links
        const isValidForumLink = hrefLower.includes("viewforum.php") || 
                                 hrefLower.includes("/forums/") || 
                                 hrefLower.includes("/forum/") ||
                                 keywords.some(k => hrefLower.includes(k));
                                 
        if (!isValidForumLink) continue;

        const title = (a.textContent || "").trim();
        const lowerTitle = title.toLowerCase();

        // 3. Scan nearby DOM within the same row/container to extract view/post statistics
        let parentRow = a.closest("li, tr, div[class*='node'], div[class*='row'], div[class*='forum']");
        let score = 0;
        let statsFound = false;

        if (parentRow) {
          // Look for stats elements in XenForo or phpBB
          const statElements = Array.from(parentRow.querySelectorAll("dd, span, dl, td"));
          for (const el of statElements) {
            const text = el.textContent || "";
            const matches = text.match(/\b\d+(?:\.\d+)?[kmKM]?\b/g);
            if (matches) {
              for (const match of matches) {
                const parsedVal = parseStatNumber(match);
                if (parsedVal > 0) {
                  score += parsedVal;
                  statsFound = true;
                }
              }
            }
          }
        }

        // Keywords boost score to prioritize General/Discussions categories
        if (keywords.some(k => lowerTitle.includes(k))) {
          score += 50000; // General keyword boost
        }

        parsedSubforums.push({
          href,
          title,
          score,
          statsFound
        });
      }

      // Sort subforums by score descending (highest activity/keywords first)
      parsedSubforums.sort((a, b) => b.score - a.score);

      return parsedSubforums[0] || null;
    });

    if (bestCategory && bestCategory.href) {
      try {
        const fullUrl = new URL(bestCategory.href, page.url()).toString();
        log(`[Tìm chuyên mục] 🎯 Đã chọn chuyên mục có nhiều tương tác/view: "${bestCategory.title}" (${fullUrl}) [Điểm tương tác: ${bestCategory.score}]`, "success");
        return { url: fullUrl, title: bestCategory.title };
      } catch (err) {
        const fullUrl = bestCategory.href.startsWith("http") ? bestCategory.href : `${baseUrl}${bestCategory.href.startsWith("/") ? "" : "/"}${bestCategory.href}`;
        log(`[Tìm chuyên mục] 🎯 Đã chọn chuyên mục có nhiều tương tác/view: "${bestCategory.title}" (${fullUrl}) [Điểm tương tác: ${bestCategory.score}]`, "success");
        return { url: fullUrl, title: bestCategory.title };
      }
    }

    // 3. Fallback scan: Pick the very first available sub-forum link on the page (guarantees we land on a postable category page)
    const fallbackCategory = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      for (const a of anchors) {
        const href = (a.getAttribute("href") || "").trim();
        const hrefLower = href.toLowerCase();
        
        if (
          href &&
          (hrefLower.includes("viewforum.php") || hrefLower.includes("/forums/") || hrefLower.includes("/forum/")) &&
          !hrefLower.includes("index.php") &&
          !hrefLower.includes("ucp.php") &&
          !hrefLower.includes("mcp.php") &&
          !hrefLower.startsWith("#")
        ) {
          return {
            href: href,
            title: a.textContent.trim()
          };
        }
      }
      return null;
    });

    if (fallbackCategory && fallbackCategory.href) {
      try {
        const fullUrl = new URL(fallbackCategory.href, page.url()).toString();
        log(`[Tìm chuyên mục] 💡 Chuyên mục theo từ khóa thất bại. Fallback chọn sub-forum đầu tiên: "${fallbackCategory.title}" (${fullUrl})`, "success");
        return { url: fullUrl, title: fallbackCategory.title || "Forums" };
      } catch (err) {}
    }
  } catch (e) {
    log(`[Tìm chuyên mục Error] Gặp lỗi khi phân tích chuyên mục: ${e.message}`, "warn");
  }
  
  // 4. Ultimate safe fallback: Return the current page URL as category URL rather than hardcoding a XenForo suffix
  log(`[Tìm chuyên mục Warn] Không tìm thấy chuyên mục nào khớp. Sử dụng URL gốc làm chuyên mục: ${baseUrl}`, "warn");
  return { url: baseUrl, title: "Forum Board" };
}

// Post task result to next.js api
async function reportResult(jobId, status, details) {
  try {
    // 1. Report outcome to worker integration API
    const reportRes = await fetch(`${SERVER_URL}/api/public/worker/registration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        status,
        username: details.username,
        password: details.password,
        emailUsed: details.emailUsed,
        proxyUsed: details.proxyUsed,
        error: details.error
      })
    });

    if (!reportRes.ok) {
      log(`Không thể gửi báo cáo kết quả đăng ký lên server. HTTP Status: ${reportRes.status}`, "error");
    }

    // 2. If success, also record successful posted backlink
    if (status === "success" && details.postedUrl) {
      const backlinkRes = await fetch(`${SERVER_URL}/api/posted-backlinks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forumUrl: details.forumUrl,
          postedUrl: details.postedUrl,
          status: "success",
          details: {
            username: details.username,
            emailUsed: details.emailUsed
          }
        })
      });

      if (backlinkRes.ok) {
        log(`[Đồng bộ] Đã lưu thành công backlink và kích hoạt truyền tải Google Sheets!`, "success");
      }
    }

  } catch (err) {
    log(`Lỗi khi báo cáo kết quả lên server: ${err.message}`, "error");
  }
}

// Dịch vụ tự động giải CAPTCHA qua 2Captcha API
async function solveCaptchaViaApi(apiKey, type, sitekey, pageUrl) {
  try {
    log(`[Tự động] Đang gửi CAPTCHA (${type}) tới dịch vụ giải tự động với sitekey: ${sitekey}...`);
    
    // Xác định phương thức cho 2Captcha
    let method = "userrecaptcha";
    if (type === "hcaptcha") method = "hcaptcha";
    if (type === "turnstile") method = "turnstile";
    
    const submitUrl = `https://2captcha.com/in.php?key=${apiKey}&method=${method}&sitekey=${sitekey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`;
    const res = await fetch(submitUrl);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
    const data = await res.json();
    if (data.status !== 1) {
      if (data.request === "ERROR_KEY_DOES_NOT_EXIST" || data.request === "ERROR_WRONG_USER_KEY" || data.request?.includes("KEY")) {
        log("[Tự động] Nhận diện khóa của CapSolver. Đang tự động chuyển sang giải qua CapSolver API...", "info");
        return await solveCaptchaViaCapSolver(apiKey, type, sitekey, pageUrl);
      }
      throw new Error(`2Captcha error: ${data.request}`);
    }
    
    const captchaId = data.request;
    log(`[Tự động] Đã gửi thành công! ID nhiệm vụ: ${captchaId}. Đang chờ giải...`);
    
    // Polling kết quả mỗi 5 giây (chờ tối đa 120 giây)
    const pollUrl = `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`;
    const startTime = Date.now();
    
    while (Date.now() - startTime < 120000) {
      await sleep(5000);
      const pollRes = await fetch(pollUrl);
      if (!pollRes.ok) continue;
      
      const pollData = await pollRes.json();
      if (pollData.status === 1) {
        log(`[Tự động] 🎉 Đã nhận được lời giải CAPTCHA thành công!`, "success");
        return pollData.request; // Token phản hồi của captcha
      }
      
      if (pollData.request !== "CAPCHA_NOT_READY") {
        throw new Error(`2Captcha solver returned error: ${pollData.request}`);
      }
      log("[Tự động] Lời giải chưa sẵn sàng, đang đợi thêm 5 giây...");
    }
    
    throw new Error("Quá thời gian chờ giải CAPTCHA tự động (120s).");
  } catch (err) {
    log(`[Tự động] Thất bại khi giải qua API: ${err.message}`, "warn");
    return null;
  }
}

// Dịch vụ tự động giải reCAPTCHA/hCaptcha/Turnstile bằng CapSolver
async function solveCaptchaViaCapSolver(apiKey, type, sitekey, pageUrl) {
  try {
    log(`[Tự động] Đang gửi CAPTCHA (${type}) tới CapSolver...`);
    
    // Ánh xạ kiểu CAPTCHA sang định dạng CapSolver
    let taskType = "ReCaptchaV2TaskProxyLess";
    if (type === "hcaptcha") taskType = "HCaptchaTaskProxyLess";
    if (type === "turnstile") taskType = "AntiTurnstileTaskProxyLess";
    
    const payload = {
      clientKey: apiKey,
      task: {
        type: taskType,
        websiteURL: pageUrl,
        websiteKey: sitekey
      }
    };
    
    const submitRes = await fetch("https://api.capsolver.com/createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!submitRes.ok) throw new Error(`HTTP error! status: ${submitRes.status}`);
    const data = await submitRes.json();
    
    if (data.errorId !== 0) {
      throw new Error(`CapSolver error: ${data.errorDescription || "Unknown error"}`);
    }
    
    const taskId = data.taskId;
    log(`[Tự động] Đã gửi thành công! ID nhiệm vụ: ${taskId}. Đang chờ giải...`);
    
    // Polling kết quả mỗi 5 giây
    const startTime = Date.now();
    while (Date.now() - startTime < 120000) {
      await sleep(5000);
      const pollRes = await fetch("https://api.capsolver.com/getTaskResult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientKey: apiKey,
          taskId: taskId
        })
      });
      
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();
      
      if (pollData.errorId !== 0) {
        throw new Error(`CapSolver error: ${pollData.errorDescription}`);
      }
      
      if (pollData.status === "ready") {
        log(`[Tự động] 🎉 Đã nhận được lời giải CAPTCHA thành công từ CapSolver!`, "success");
        return pollData.solution?.gRecaptchaResponse || pollData.solution?.token;
      }
      
      log("[Tự động] Lời giải chưa sẵn sàng, đang đợi thêm 5 giây...");
    }
    
    throw new Error("Quá thời gian chờ giải CAPTCHA tự động tại CapSolver (120s).");
  } catch (err) {
    log(`[Tự động] Thất bại khi giải qua CapSolver: ${err.message}`, "warn");
    return null;
  }
}

async function solveImageCaptchaViaGemini(geminiKey, base64Image) {
  try {
    log("[Gemini Solver] Đang gửi CAPTCHA hình ảnh tới Gemini AI để giải miễn phí...");
    const prompt = "Identify the characters (letters and numbers) in this captcha image. Return ONLY the plain text characters, with no spaces, punctuation, explanation, or markdown formatting.";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Image
              }
            },
            { text: prompt }
          ]
        }]
      })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleanedText = text.replace(/\s+/g, "").trim();
        log(`[Gemini Solver] 🎉 Giải CAPTCHA hình ảnh thành công: "${cleanedText}"`, "success");
        return cleanedText;
      }
    }
    log(`[Gemini Solver Warn] Phản hồi từ Gemini API không thành công. Status: ${res.status}`, "warn");
  } catch (err) {
    log(`[Gemini Solver Warn] Lỗi kết nối Gemini API: ${err.message}`, "warn");
  }
  return null;
}

async function solveImageCaptchaViaTesseract(base64Image) {
  try {
    log("[Tesseract OCR] Đang phân tích CAPTCHA hình ảnh offline bằng Tesseract.js (Miễn phí)...");
    const buffer = Buffer.from(base64Image, 'base64');
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    if (text) {
      const cleaned = text.replace(/[^a-zA-Z0-9]/g, "").trim();
      log(`[Tesseract OCR] 🎉 Nhận diện CAPTCHA hình ảnh thành công: "${cleaned}"`, "success");
      return cleaned;
    }
  } catch (err) {
    log(`[Tesseract OCR Warn] Lỗi khi nhận diện hình ảnh offline: ${err.message}`, "warn");
  }
  return null;
}

// Dịch vụ tự động giải CAPTCHA hình ảnh (ImageToTextTask) cho 2Captcha / CapSolver

async function solveImageCaptcha(apiKey, base64Image) {
  // Nếu là Gemini API Key (bắt đầu bằng AIzaSy), dùng luôn giải miễn phí
  if (apiKey && apiKey.startsWith("AIzaSy")) {
    return await solveImageCaptchaViaGemini(apiKey, base64Image);
  }

  // Nếu không có API key hợp lệ, chuyển sang giải bằng Tesseract.js offline miễn phí luôn
  if (!apiKey || apiKey.trim().length === 0 || apiKey.includes("YOUR_")) {
    return await solveImageCaptchaViaTesseract(base64Image);
  }

  try {
    log("[Tự động] Đang gửi CAPTCHA hình ảnh (ImageToTextTask) tới dịch vụ giải...");
    
    // Thử gửi dạng Modern JSON API (CapSolver / 2Captcha)
    let submitUrl = "https://api.2captcha.com/createTask";
    if (apiKey.startsWith("CAP-")) { // Nhận diện CapSolver key nếu có
      submitUrl = "https://api.capsolver.com/createTask";
    }
    
    const payload = {
      clientKey: apiKey,
      task: {
        type: "ImageToTextTask",
        body: base64Image
      }
    };
    
    let res = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    let data = await res.json().catch(() => null);
    
    // Dự phòng: Nếu API JSON không thành công, thử API HTTP cổ điển của 2Captcha
    if (!data || data.errorId !== 0) {
      log("[Tự động] Thử phương thức API cổ điển của 2Captcha...");
      const classicRes = await fetch("https://2captcha.com/in.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: apiKey,
          method: "base64",
          body: base64Image,
          json: 1
        })
      });
      const classicData = await classicRes.json();
      if (classicData.status !== 1) {
        throw new Error(classicData.request || "Lỗi API giải captcha");
      }
      
      const captchaId = classicData.request;
      // Poll kết quả cổ điển
      const pollUrl = `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`;
      const startTime = Date.now();
      while (Date.now() - startTime < 60000) {
        await sleep(3000);
        const pollRes = await fetch(pollUrl);
        const pollData = await pollRes.json();
        if (pollData.status === 1) {
          log(`[Tự động] 🎉 Giải CAPTCHA thành công: "${pollData.request}"`, "success");
          return pollData.request;
        }
        if (pollData.request !== "CAPCHA_NOT_READY") {
          throw new Error(pollData.request);
        }
      }
      throw new Error("Hết thời gian chờ");
    } else {
      // Xử lý theo luồng Modern JSON API (CapSolver / 2Captcha)
      const taskId = data.taskId;
      log(`[Tự động] Đã gửi thành công! ID nhiệm vụ: ${taskId}. Đang chờ giải...`);
      
      let getResultUrl = "https://api.2captcha.com/getTaskResult";
      if (apiKey.startsWith("CAP-")) {
        getResultUrl = "https://api.capsolver.com/getTaskResult";
      }
      
      const startTime = Date.now();
      while (Date.now() - startTime < 60000) {
        await sleep(3000);
        const pollRes = await fetch(getResultUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientKey: apiKey, taskId })
        });
        const pollData = await pollRes.json();
        if (pollData.status === "ready") {
          const solution = pollData.solution?.text;
          log(`[Tự động] 🎉 Giải CAPTCHA hình ảnh thành công: "${solution}"`, "success");
          return solution;
        }
        if (pollData.status === "processing") {
          log("[Tự động] Lời giải hình ảnh đang được xử lý...");
          continue;
        }
        throw new Error(pollData.errorDescription || "Lỗi giải captcha");
      }
      throw new Error("Hết thời gian chờ");
    }
  } catch (err) {
    log(`[Tự động] Thất bại khi giải CAPTCHA qua API: ${err.message}. Chuyển sang giải offline bằng Tesseract.js...`, "warn");
    return await solveImageCaptchaViaTesseract(base64Image);
  }
}

// CAPTCHA and Cloudflare auto-detector helper

async function checkForSecurityScreen(page) {
  try {
    let hasCaptcha = false;
    let captchaType = ""; // "recaptcha", "hcaptcha", "turnstile", "other"
    let sitekey = "";
    let hasCloudflare = false;
    let hasAnubis = false;

    // Check for Cloudflare challenge elements
    const cfTitle = await page.title();
    const hasCfTitle = cfTitle.includes("Just a moment") || cfTitle.includes("Attention Required");
    const hasCfChallengeDom = await page.$("#cf-challenge-stage, iframe[src*='challenges.cloudflare.com'], .cf-turnstile");
    if (hasCfTitle || hasCfChallengeDom) {
      hasCloudflare = true;
    }

    // Check for Anubis Techaro challenge elements
    const cfContent = await page.content().catch(() => "");
    if (cfTitle.includes("Making sure you're not a bot") || cfContent.includes("Anubis from Techaro") || cfContent.includes("Protected by Anubis")) {
      hasAnubis = true;
    }

    // Check for standard CAPTCHA elements (hCaptcha, reCAPTCHA, Cloudflare Turnstile)
    const isSelectorVisible = async (sel) => {
      try {
        const el = await page.$(sel);
        return el ? await el.isVisible() : false;
      } catch (e) {
        return false;
      }
    };

    const hasHCaptcha = await isSelectorVisible("iframe[src*='hcaptcha']");
    const hasReCaptcha = await isSelectorVisible("iframe[src*='recaptcha'], .g-recaptcha");
    const hasTurnstile = await isSelectorVisible("iframe[src*='turnstile'], .cf-turnstile");
    const hasCaptchaField = await isSelectorVisible("input[name*='captcha' i], img[src*='captcha' i], img[src*='confirm' i], img[src*='code' i], input[name*='confirm' i], input[name*='code' i]");

    if (hasHCaptcha) {
      hasCaptcha = true;
      captchaType = "hcaptcha";
      const hcaptchaEl = await page.$("[data-sitekey]");
      if (hcaptchaEl) {
        sitekey = await hcaptchaEl.getAttribute("data-sitekey");
      }
      if (!sitekey) {
        const iframe = await page.$("iframe[src*='hcaptcha']");
        if (iframe) {
          const src = await iframe.getAttribute("src");
          try {
            const url = new URL(src);
            sitekey = url.searchParams.get("sitekey") || url.searchParams.get("k");
          } catch(e) {}
        }
      }
    } else if (hasReCaptcha) {
      hasCaptcha = true;
      captchaType = "recaptcha";
      // Extract sitekey
      const recaptchaEl = await page.$("[data-sitekey]");
      if (recaptchaEl) {
        sitekey = await recaptchaEl.getAttribute("data-sitekey");
      }
      if (!sitekey) {
        const iframe = await page.$("iframe[src*='recaptcha']");
        if (iframe) {
          const src = await iframe.getAttribute("src");
          try {
            const url = new URL(src);
            sitekey = url.searchParams.get("k");
          } catch(e) {}
        }
      }
    } else if (hasTurnstile) {
      hasCaptcha = true;
      captchaType = "turnstile";
      const turnstileEl = await page.$(".cf-turnstile, [data-sitekey]");
      if (turnstileEl) {
        sitekey = await turnstileEl.getAttribute("data-sitekey");
      }
      if (!sitekey) {
        const iframe = await page.$("iframe[src*='turnstile']");
        if (iframe) {
          const src = await iframe.getAttribute("src");
          try {
            const url = new URL(src);
            sitekey = url.searchParams.get("sitekey") || url.searchParams.get("k");
          } catch(e) {}
        }
      }
    } else if (hasCaptchaField) {
      hasCaptcha = true;
      captchaType = "other";
    }

    if (hasCloudflare || hasCaptcha || hasAnubis) {
      const reason = hasCloudflare ? "Cloudflare Protection" : (hasAnubis ? "Anubis Protection" : `CAPTCHA Verification (${captchaType})`);
      log(`[⚠️ BẢO MẬT] Phát hiện màn hình ${reason}!`, "warn");

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

      const apiKey = process.env.CAPTCHA_SOLVER_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;
      let solved = false;

      // 1. TRY AUTOMATIC SOLVING VIA 2CAPTCHA API
      if (apiKey && sitekey && ["recaptcha", "hcaptcha", "turnstile"].includes(captchaType)) {
        log(`[Tự động] Phát hiện cấu hình giải tự động. Đang gửi yêu cầu giải quyết...`);
        const token = await solveCaptchaViaApi(apiKey, captchaType, sitekey, page.url());
        if (token) {
          log(`[Tự động] Đang đưa lời giải vào trang...`);
          if (captchaType === "recaptcha") {
            await page.evaluate((t) => {
              const el = document.getElementById("g-recaptcha-response") || document.querySelector("[name='g-recaptcha-response']");
              if (el) { el.value = t; el.dispatchEvent(new Event("change")); }
            }, token);
          } else if (captchaType === "hcaptcha") {
            await page.evaluate((t) => {
              const el = document.querySelector("[name='h-captcha-response']") || document.querySelector("[name='g-recaptcha-response']");
              if (el) { el.value = t; el.dispatchEvent(new Event("change")); }
            }, token);
          } else if (captchaType === "turnstile") {
            await page.evaluate((t) => {
              const el = document.querySelector("[name='cf-turnstile-response']");
              if (el) { el.value = t; el.dispatchEvent(new Event("change")); }
            }, token);
          }
          await page.waitForTimeout(3000);
          solved = true;
        }
      } else if ((apiKey || geminiKey) && captchaType === "other") {
        log(`[Tự động] Phát hiện CAPTCHA hình ảnh và cấu hình giải tự động. Đang trích xuất ảnh...`);
        const captchaImg = await page.$("img[src*='captcha' i], img[id*='captcha' i], img[src*='confirm' i], img[src*='code' i]");
        const captchaInput = await page.$("input[name*='captcha' i], input[id*='captcha' i], input[name*='confirm' i], input[name*='code' i]");
        
        if (captchaImg && captchaInput) {
          const buffer = await captchaImg.screenshot().catch(() => null);
          if (buffer) {
            const base64Image = buffer.toString("base64");
            const keyToUse = (apiKey && apiKey.trim().length > 0) ? apiKey : geminiKey;
            const solution = await solveImageCaptcha(keyToUse, base64Image);
            if (solution) {
              log(`[Tự động] Đang điền kết quả giải CAPTCHA hình ảnh: "${solution}"...`);
              await captchaInput.fill(solution);
              await page.waitForTimeout(2000);
              solved = true;
            }
          } else {
            log("[ℹ️ CẤU HÌNH] Không thể chụp ảnh thẻ CAPTCHA hình ảnh.", "warn");
          }
        } else {
          log("[ℹ️ CẤU HÌNH] Không tìm thấy đầy đủ thẻ hình ảnh và trường nhập liệu CAPTCHA.", "info");
        }
      } else {
        if (!apiKey && !geminiKey) {
          log(`[ℹ️ CẤU HÌNH] Chưa cấu hình API Key tự động giải CAPTCHA (CAPTCHA_SOLVER_API_KEY hoặc GEMINI_API_KEY trong .env). Bỏ qua chế độ tự động.`, "info");
        } else if (!sitekey) {
          log(`[ℹ️ CẤU HÌNH] Không tìm thấy sitekey cho CAPTCHA token hoặc đây là dạng hình ảnh chưa được xử lý.`, "info");
        }
      }

      if (solved) {
        log("[✅ BẢO MẬT] Hệ thống tự động đã vượt qua CAPTCHA thành công!", "success");
        return;
      }

      // 2. FALLBACK TO INTERACTIVE MANUAL MODE
      log(`[⚠️ BẢO MẬT] Anh ơi, giải CAPTCHA / Vượt Cloudflare trên màn hình trình duyệt hiển thị giúp em nhé!`, "warn");
      
      // Phát âm thanh cảnh báo hệ thống
      try {
        const { exec } = require('child_process');
        exec('powershell -Command "[System.Media.SystemSounds]::Hand.Play()"').catch(() => undefined);
      } catch (e) {}

      // Đợi tối đa 90 giây để người dùng giải CAPTCHA thủ công trên trình duyệt hiển thị
      let passed = false;
      let checkboxClicked = false;
      for (let sec = 1; sec <= 90; sec++) {
        await sleep(1000);
        
        // Tự động click checkbox CAPTCHA nếu có (như mCaptcha, Turnstile)
        if (!checkboxClicked) {
          try {
            let clicked = false;
            for (const frame of page.frames()) {
              const checkbox = await frame.$("input[type='checkbox'], [role='checkbox'], #widget-checkbox, .checkbox, #anchor");
              if (checkbox) {
                log("[BẢO MẬT] Tự động click checkbox trong iframe...");
                await checkbox.click().catch(() => undefined);
                clicked = true;
                break;
              }
            }
            if (!clicked) {
              const mainCheckbox = await page.$("input[type='checkbox'], [role='checkbox'], .checkbox");
              if (mainCheckbox) {
                log("[BẢO MẬT] Tự động click checkbox trên trang chính...");
                await mainCheckbox.click().catch(() => undefined);
                clicked = true;
              }
            }
            if (clicked) {
              checkboxClicked = true;
            }
          } catch (e) {}
        }

        // Kiểm tra xem Cloudflare hoặc CAPTCHA còn xuất hiện không
        const currentTitle = await page.title();
        const stillCfTitle = currentTitle.includes("Just a moment") || currentTitle.includes("Attention Required");
        const stillCfChallengeDom = await page.$("#cf-challenge-stage, iframe[src*='challenges.cloudflare.com'], .cf-turnstile");
        const stillCf = stillCfTitle || stillCfChallengeDom;
        const stillHCaptcha = await isSelectorVisible("iframe[src*='hcaptcha']");
        const stillReCaptcha = await isSelectorVisible("iframe[src*='recaptcha'], .g-recaptcha");
        const stillTurnstile = await isSelectorVisible("iframe[src*='turnstile'], .cf-turnstile");

        // Kiểm tra xem có CAPTCHA khác (như mCaptcha, ảnh captcha) chưa được giải không
        let stillOther = false;
        if (captchaType === "other") {
          const captchaInputs = await page.$$("input[name*='captcha' i], input[id*='captcha' i], input[name*='confirm' i], input[name*='code' i], input[name*='token' i]");
          for (const input of captchaInputs) {
            const name = await input.getAttribute("name").catch(() => "") || "";
            const id = await input.getAttribute("id").catch(() => "") || "";
            const lowerName = (name + "_" + id).toLowerCase();
            
            if (
              (lowerName.includes("captcha") || lowerName.includes("confirm_code") || lowerName.includes("code") || lowerName.includes("mcaptcha") || lowerName.includes("token")) &&
              !lowerName.includes("password") && !lowerName.includes("pass") && !lowerName.includes("email")
            ) {
              const val = await input.evaluate(el => el.value).catch(() => "");
              if (!val.trim()) {
                stillOther = true;
                break;
              }
            }
          }
        }

        // Nếu các phần tử bảo mật biến mất, tiến trình tự động chạy tiếp ngay
        if (!stillCf && !stillHCaptcha && !stillReCaptcha && !stillTurnstile && !stillOther) {
          log("[✅ BẢO MẬT] Đã phát hiện vượt qua màn hình bảo mật thành công! Tiếp tục tiến trình đi link...", "success");
          passed = true;
          break;
        }

        if (sec % 15 === 0) {
          log(`[⏳ ĐANG CHỜ] Đã đợi ${sec} giây... Vui lòng giải CAPTCHA trên màn hình trình duyệt...`);
          await page.screenshot({ path: `scratch/security_wait_${sec}.png` }).catch(() => undefined);
          log(`[⏳ ĐANG CHỜ] Đã chụp ảnh màn hình lưu tại scratch/security_wait_${sec}.png`);
        }
      }

      if (!passed) {
        log("[❌ BẢO MẬT] Hết thời gian chờ 90 giây mà không vượt qua được bảo mật. Bỏ qua nhiệm vụ này.", "warn");
        throw new Error("Không thể vượt qua thử thách bảo mật Cloudflare / CAPTCHA (Hết thời gian chờ).");
      }
    }
  } catch (err) {
    log(`Lỗi kiểm tra bảo mật: ${err.message}`, "warn");
    throw err; // Re-throw error to let task execution fail cleanly
  }
}

// Thực hiện xác thực email qua IMAP thực tế
async function verifyEmailViaImap(emailConfig, forumUrl, customTimeoutMs = 90000) {
  const urlObj = new URL(forumUrl);
  const forumDomain = urlObj.hostname.replace("www.", "");
  const domainParts = forumDomain.split(".");
  const baseDomain = domainParts.length >= 2 ? domainParts.slice(-2).join(".") : forumDomain;
  log(`[IMAP] Đang khởi tạo kết nối IMAP đến ${emailConfig.imapHost}:${emailConfig.imapPort} cho ${emailConfig.email}...`);

  const config = {
    imap: {
      user: emailConfig.email,
      password: emailConfig.password,
      host: emailConfig.imapHost,
      port: emailConfig.imapPort,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }, // Tránh lỗi chứng chỉ tự ký
      authTimeout: 15000
    }
  };

  let connection;
  try {
    connection = await imapSimple.connect(config);
    
    // Tìm các thư mục khác như Spam và All Mail động (Task 2.5)
    const boxes = await connection.getBoxes();
    const boxesToCheck = ["INBOX"];
    
    function findFolderByName(boxObj, keywords, parent = "") {
      for (const key of Object.keys(boxObj)) {
        const fullName = parent ? `${parent}/${key}` : key;
        const lowerKey = key.toLowerCase();
        if (keywords.some(kw => lowerKey.includes(kw))) {
          return fullName;
        }
        if (boxObj[key].children) {
          const found = findFolderByName(boxObj[key].children, keywords, fullName);
          if (found) return found;
        }
      }
      return null;
    }
    
    const spamKeywords = ["spam", "junk", "จดหมายขยะ", "thư rác", "no deseado", "pourri"];
    const spamFolder = findFolderByName(boxes, spamKeywords);
    if (spamFolder && !boxesToCheck.includes(spamFolder)) {
      boxesToCheck.push(spamFolder);
    }
    
    const allMailKeywords = ["all", "อีเมลทั้งหมด", "tất cả", "todos", "tous"];
    const allMailFolder = findFolderByName(boxes, allMailKeywords);
    if (allMailFolder && !boxesToCheck.includes(allMailFolder)) {
      boxesToCheck.push(allMailFolder);
    }
    
    log(`[IMAP] Kết nối hòm thư thành công. Thư mục quét: [${boxesToCheck.join(", ")}]`);

    const startTime = Date.now();
    const timeoutMs = customTimeoutMs; // Đợi tối đa 90 giây (hoặc thời gian tùy chỉnh) để thư về
    let activationUrl = null;

    while (Date.now() - startTime < timeoutMs) {
      for (const boxName of boxesToCheck) {
        try {
          await connection.openBox(boxName);
          const searchCriteria = ["ALL"];
          const fetchOptions = {
            bodies: ["HEADER", "TEXT", ""],
            struct: true
          };

          const messages = await connection.search(searchCriteria, fetchOptions);
          // Sắp xếp thư mới nhất lên đầu
          messages.sort((a, b) => b.attributes.uid - a.attributes.uid);

          // Quét qua 10 email mới nhất trong mỗi thư mục
          const recentMessages = messages.slice(0, 10);

          for (const message of recentMessages) {
            const all = message.parts.find(part => part.which === "");
            if (!all) continue;

            const parsedMail = await simpleParser(all.body);
            const fromHeader = (parsedMail.from?.text || "").toLowerCase();
            const subject = (parsedMail.subject || "").toLowerCase();
            const htmlBody = parsedMail.html || parsedMail.text || "";

            // Kiểm tra xem email có thuộc diễn đàn hoặc có chứa từ khóa kích hoạt không
            const isFromForum = fromHeader.includes(baseDomain) || htmlBody.includes(baseDomain);
            const isRegEmail = subject.includes("confirm") || 
                               subject.includes("activate") || 
                               subject.includes("verify") || 
                               subject.includes("kích hoạt") || 
                               subject.includes("đăng ký") || 
                               subject.includes("welcome") ||
                               subject.includes("active") ||
                               subject.includes("account") ||
                               subject.includes("registrierung") ||
                               subject.includes("willkommen") ||
                               subject.includes("freischaltung") ||
                               subject.includes("anmeldung") ||
                               subject.includes("activation") ||
                               subject.includes("bienvenue") ||
                               subject.includes("inscription") ||
                               subject.includes("register") ||
                               subject.includes("signup");

            if (isFromForum && isRegEmail) {
              log(`[IMAP] Phát hiện email khả nghi trong ${boxName}: "${parsedMail.subject}" từ "${parsedMail.from?.text}"`);
              
              const links = [];
              const regexPatterns = [
                /https?:\/\/[^\s"'<>]+/gi,
              ];

              for (const pattern of regexPatterns) {
                let match;
                while ((match = pattern.exec(htmlBody)) !== null) {
                  const url = match[0];
                  const lowerUrl = url.toLowerCase();
                  const isConfirmLink = lowerUrl.includes("confirm") || 
                                        lowerUrl.includes("activate") || 
                                        lowerUrl.includes("verify") || 
                                        lowerUrl.includes("active") ||
                                        lowerUrl.includes("register/confirm") ||
                                        lowerUrl.includes("ucp.php?mode=activate") ||
                                        lowerUrl.includes("wp-login.php?action=rp") ||
                                        lowerUrl.includes("key=") ||
                                        lowerUrl.includes("k=");

                  if (isConfirmLink) {
                    let cleanedUrl = url.replace(/[.,;)]$/, "");
                    cleanedUrl = cleanedUrl.replace(/&amp;/g, "&");
                    if (!links.includes(cleanedUrl)) {
                      links.push(cleanedUrl);
                    }
                  }
                }
              }

              if (links.length > 0) {
                activationUrl = links[0];
                log(`[IMAP] 🎉 Tìm thấy liên kết kích hoạt: ${activationUrl}`, "success");
                break;
              }
            }
          }
        } catch (boxErr) {
          log(`[IMAP] Bỏ qua quét thư mục ${boxName}: ${boxErr.message}`);
        }
        
        if (activationUrl) break;
      }

      if (activationUrl) break;

      log("[IMAP] Thư kích hoạt chưa tới. Đang đợi thêm 5 giây...");
      await sleep(5000);
    }

    if (connection) {
      await connection.end();
    }

    return activationUrl;
  } catch (err) {
    log(`[IMAP Warn] Kết nối hòm thư IMAP không thành công: ${err.message}`, "warn");
    if (emailConfig.email.endsWith("@gmail.com")) {
      log(`💡 Mẹo: Đối với tài khoản Gmail, bạn cần:`, "info");
      log(`   1. Bật Xác minh 2 bước trong tài khoản Google.`, "info");
      log(`   2. Truy cập bảo mật -> Tạo "Mật khẩu ứng dụng" (App Password) gồm 16 ký tự.`, "info");
      log(`   3. Cập nhật Mật khẩu ứng dụng này vào cột password của bảng 'emails' thay vì mật khẩu Gmail chính.`, "info");
    } else {
      log(`💡 Mẹo: Vui lòng kiểm tra lại địa chỉ email, mật khẩu và cấu hình IMAP host/port trong bảng 'emails'.`, "info");
    }
    log(`Tiếp tục bỏ qua kích hoạt tự động (chờ kích hoạt thủ công)...`, "info");
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    return null;
  }
}

// Điền trước các trường nhập liệu nếu chúng đang trống trong phiên bán tự động
async function prefillFieldsIfEmpty(page, username, password, email) {
  try {
    const usernameInputs = await page.$$("input[name*='username' i], input[name*='user' i], input[id*='username' i], input[id*='user' i], input[name='username']");
    for (const input of usernameInputs) {
      const val = await input.inputValue().catch(() => "");
      if (!val) {
        await input.fill(username).catch(() => undefined);
      }
    }

    const emailInputs = await page.$$("input[name*='email' i], input[id*='email' i], input[type='email']");
    for (const input of emailInputs) {
      const val = await input.inputValue().catch(() => "");
      if (!val) {
        await input.fill(email).catch(() => undefined);
      }
    }

    const passInputs = await page.$$("input[type='password'], input[name*='password' i], input[id*='password' i], input[name*='pass' i]");
    for (const input of passInputs) {
      const val = await input.inputValue().catch(() => "");
      if (!val) {
        await input.fill(password).catch(() => undefined);
      }
    }
  } catch (e) {
    log(`[Bán tự động Warn] Lỗi khi điền tự động form: ${e.message}`, "warn");
  }
}

// Xử lý luồng Đăng ký Bán tự động (Semi-Automatic Registration)
async function runSemiAutoRegistration(page, task, username, password, originalError) {
  log(`[Bán tự động] 🔔 Đăng ký tự động thất bại: ${originalError}`, "warn");
  log(`[Bán tự động] Đang chuyển đổi sang chế độ Bán Tự Động cho diễn đàn: ${task.url}`, "info");

  // Phát âm thanh cảnh báo qua PowerShell để người dùng chú ý
  try {
    const { exec } = require("child_process");
    exec('powershell -Command "[System.Media.SystemSounds]::Hand.Play()"', (err) => {
      if (err) {
        // Fallback beep
        exec('powershell -Command "[console]::beep(1000, 300)"').catch(() => undefined);
      }
    });
  } catch (e) {
    // Bỏ qua lỗi phát âm thanh
  }

  // Cập nhật thông tin lên DB để Dashboard hiển thị thông điệp hướng dẫn
  const semiAutoMsg = `[BÁN TỰ ĐỘNG] Lỗi: ${originalError.substring(0, 80)}. Vui lòng hoàn tất đăng ký thủ công trên trình duyệt đang mở.`;
  await reportResult(task.jobId, "processing", {
    emailUsed: task.email.email,
    error: semiAutoMsg
  }).catch((err) => log(`[Bán tự động Warn] Không thể cập nhật trạng thái bán tự động lên DB: ${err.message}`, "warn"));

  log(`[Bán tự động] === HƯỚNG DẪN THỦ CÔNG ===`);
  log(`[Bán tự động] 1. Vui lòng thao tác trên cửa sổ trình duyệt Chromium đang mở.`);
  log(`[Bán tự động] 2. Điền nốt các trường còn thiếu (giải CAPTCHA, trả lời câu hỏi bảo mật...).`);
  log(`[Bán tự động] 3. Nhấn nút Đăng ký (Register/Submit) trên trang.`);
  log(`[Bán tự động] 4. THÔNG TIN CẦN SỬ DỤNG:`);
  log(`              - Username: ${username}`);
  log(`              - Password: ${password}`);
  log(`              - Email: ${task.email.email}`);
  log(`[Bán tự động] 5. Sau khi đăng ký xong, bạn có thể:`);
  log(`              - Đợi hệ thống tự nhận diện thành công.`);
  log(`              - Hoặc nhấn nút 'Đăng ký xong' trên Dashboard UI để báo cho worker.`);
  log(`[Bán tự động] Hệ thống sẽ đợi tối đa 5 phút...`);

  // Điền trước các thông tin tài khoản để giúp người dùng đăng ký nhanh hơn
  await prefillFieldsIfEmpty(page, username, password, task.email.email);

  const maxWaitTimeMs = 300000; // 5 phút
  const pollIntervalMs = 4000;  // 4 giây
  const startTime = Date.now();
  let registrationSuccess = false;

  while (Date.now() - startTime < maxWaitTimeMs) {
    // 1. Kiểm tra trình duyệt đã bị đóng chưa
    if (page.isClosed()) {
      log(`[Bán tự động] Trình duyệt đã bị đóng. Hủy bỏ hàng chờ.`, "error");
      break;
    }

    // 2. Kiểm tra tín hiệu xác nhận từ Dashboard UI (trong DB)
    try {
      const dbRes = await fetch(`${SERVER_URL}/api/public/worker/registration?jobId=${task.jobId}`, {
        method: "GET",
        headers: { "Cache-Control": "no-cache" }
      });
      if (dbRes.ok) {
        const data = await dbRes.json();
        if (data && data.job && data.job.error === "MANUAL_REGISTRATION_DONE") {
          log(`[Bán tự động] ✅ Nhận được xác nhận thủ công từ Dashboard UI!`, "success");
          registrationSuccess = true;
          break;
        }
      }
    } catch (dbErr) {
      // Bỏ qua lỗi mạng khi poll DB
    }

    // 3. Kiểm tra xem trang web có thay đổi sang trạng thái đăng ký thành công không
    try {
      const currentUrl = page.url();
      const pageContent = await page.content().catch(() => "");
      const currentTitle = await page.title().catch(() => "");

      const isOnRegisterPage = currentUrl.includes("register") || currentUrl.includes("signup") || currentUrl.includes("mode=register");
      const hasSuccessText = pageContent.includes("registered successfully") || 
                             pageContent.includes("đăng ký thành công") || 
                             pageContent.includes("activation") || 
                             pageContent.includes("kích hoạt tài khoản") ||
                             pageContent.includes("will receive an email") ||
                             pageContent.includes("Your account has been created") ||
                             pageContent.includes("Vielen Dank für Ihre Registrierung") ||
                             pageContent.includes("thành công") ||
                             currentTitle.includes("Register Success");

      if (!isOnRegisterPage || hasSuccessText) {
        log(`[Bán tự động] ✅ Phát hiện trang web thay đổi trạng thái thành công! (URL: ${currentUrl})`, "success");
        registrationSuccess = true;
        break;
      }
    } catch (pageErr) {
      // Bỏ qua lỗi đọc trang
    }

    // 4. Kiểm tra xem hòm thư IMAP đã nhận được mail kích hoạt từ domain này chưa
    try {
      const activationUrl = await verifyEmailViaImap(task.email, task.url, 5000);
      if (activationUrl) {
        log(`[Bán tự động] ✅ Phát hiện email kích hoạt mới gửi đến hòm thư! URL: ${activationUrl}`, "success");
        task.cachedActivationUrl = activationUrl; // Lưu cache để bước sau dùng luôn, không cần quét lại
        registrationSuccess = true;
        break;
      }
    } catch (imapErr) {
      // Bỏ qua lỗi quét hòm thư
    }

    await sleep(pollIntervalMs);
  }

  if (registrationSuccess) {
    log(`[Bán tự động] 🎉 Xác nhận đăng ký hoàn tất! Tiếp tục quy trình kích hoạt và đăng bài tự động...`, "success");
    
    // Clear lỗi trong DB để báo thành công, giữ nguyên trạng thái processing
    await reportResult(task.jobId, "processing", {
      emailUsed: task.email.email,
      error: ""
    }).catch(() => undefined);
    
    return true;
  }

  log(`[Bán tự động] ❌ Hết thời gian chờ hoặc đăng ký bán tự động thất bại.`, "error");
  return false;
}

// Đăng nhập thực tế cho các CMS phổ biến
async function loginCMS(page, task, username, password) {
  log(`[Đăng nhập] Bắt đầu tự động đăng nhập cho CMS: ${task.cmsType}`);
  
  let loginUrl = `${task.url}/login/`;
  if (task.cmsType === "WordPress") {
    loginUrl = new URL(task.url).origin + "/wp-login.php";
  } else if (task.cmsType === "phpBB") {
    loginUrl = new URL(task.url).origin + "/ucp.php?mode=login";
  }
  
  log(`[Đăng nhập] Điều hướng đến trang login: ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(3000);
  await checkForSecurityScreen(page);

  let loggedIn = false;
  
  // Tự động phát hiện CMS thực tế tại trang đăng nhập
  let detectedCms = task.cmsType;
  const pageContent = await page.content().catch(() => "");
  const pageUrl = page.url().toLowerCase();

  if (pageContent.includes("wp-content") || pageContent.includes("wp-includes") || pageUrl.includes("wp-login") || pageUrl.includes("wp-signup")) {
    detectedCms = "WordPress";
  } else if (pageContent.includes("phpBB") || pageContent.includes("ucp.php") || pageContent.includes("styles/prosilver")) {
    detectedCms = "phpBB";
  } else if (pageContent.includes("Discourse") || pageContent.includes("ember-application") || pageContent.includes("data-discourse") || pageContent.includes("/srv/www/discourse")) {
    detectedCms = "Generic"; // Discourse handled by Generic login
  } else if (pageContent.includes("XenForo") || pageContent.includes("js-xenforo") || pageContent.includes("xf-")) {
    detectedCms = "XenForo";
  } else {
    detectedCms = "Generic";
  }

  log(`[Đăng nhập] CMS được chọn để đăng nhập: ${detectedCms}`);

  try {
    if (detectedCms === "WordPress") {
      const uEl = await page.$("input[id='user_login']");
      const pEl = await page.$("input[id='user_pass']");
      const submitBtn = await page.$("input[id='wp-submit']");
      if (uEl && pEl && submitBtn) {
        await uEl.fill(username);
        await pEl.fill(password);
        // JS click fallback for Discourse/Ember dynamic buttons
        try {
          await submitBtn.click({ timeout: 5000 });
        } catch {
          log("[Đăng nhập] Click thường thất bại, thử JS click...", "warn");
          await page.evaluate(el => el.click(), submitBtn).catch(() => undefined);
        }
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
        loggedIn = true;
      }
    } else if (detectedCms === "phpBB") {
      const uEl = await page.$("input[id='username'], input[name='username']");
      const pEl = await page.$("input[id='password'], input[name='password']");
      const submitBtn = await page.$("input[type='submit'][name='login'], button[name='login'], input[name='login']");
      if (uEl && pEl && submitBtn) {
        await uEl.fill(username);
        await pEl.fill(password);
        
        const autologin = await page.$("input[name='autologin']");
        if (autologin) await autologin.check().catch(() => undefined);
        
        await submitBtn.click();
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
        loggedIn = true;
      }
    } else if (detectedCms === "XenForo") {
      const usernameSelectors = ["input[name='login']", "input[id='ctrl_login']", "input[name='username']"];
      const passwordSelectors = ["input[name='password']", "input[id='ctrl_password']"];
      
      let uEl, pEl;
      for (const selector of usernameSelectors) {
        uEl = await page.$(selector);
        if (uEl) break;
      }
      for (const selector of passwordSelectors) {
        pEl = await page.$(selector);
        if (pEl) break;
      }
      
      const submitBtn = await page.$("form button[type='submit'], form input[type='submit'], button[type='submit'], input[type='submit']");
      if (uEl && pEl && submitBtn) {
        await uEl.fill(username);
        await pEl.fill(password);
        
        const remember = await page.$("input[name='remember']");
        if (remember) await remember.check().catch(() => undefined);
        
        await submitBtn.click();
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
        loggedIn = true;
      }
    } else {
      // --- LOGIC ĐĂNG NHẬP CHUNG CHO CÁC DIỄN ĐÀN KHÁC (IPB, DISCOURSE, CUSTOM...) ---
      log("[Đăng nhập] Sử dụng form đăng nhập chung (Fallback)...");

      // Đợi form load (Discourse/Ember cần thêm thời gian render)
      await page.waitForSelector("input", { timeout: 8000 }).catch(() => undefined);

      const usernameSelectors = [
        "input[type='text'][name*='user' i]", "input[name*='login' i]", "input[name*='name' i]", "input[id*='user' i]", 
        "input[id*='login' i]", "input[type='email']", "input[name*='email' i]", "input[placeholder*='Username' i]", 
        "input[placeholder*='Email' i]"
      ];
      const passwordSelectors = ["input[type='password']", "input[name*='pass' i]", "input[id*='pass' i]"];
      
      let uEl = null;
      let pEl = null;
      for (const selector of usernameSelectors) {
        const el = await page.$(selector);
        if (el && await el.isVisible().catch(() => false)) {
          uEl = el;
          break;
        }
      }
      for (const selector of passwordSelectors) {
        const el = await page.$(selector);
        if (el && await el.isVisible().catch(() => false)) {
          pEl = el;
          break;
        }
      }

      let submitBtn = await page.$("button[type='submit'], input[type='submit']");
      if (!submitBtn) {
        submitBtn = await page.$("button:has-text('Login'), button:has-text('Log In'), button:has-text('Sign In'), button:has-text('Đăng nhập'), button:has-text('Anmelden')");
      }

      // Helper: điền value vào trường input, xử lý cả Ember/React dynamic inputs
      const fillInputSafe = async (el, value) => {
        // Method 1: fill() thông thường
        try {
          await el.fill(value, { timeout: 3000 });
          return;
        } catch { /* tiếp tục */ }
        // Method 2: click + keyboard type (hoạt động với Discourse Ember vì kích hoạt keyboard events)
        try {
          await el.click({ timeout: 2000 }).catch(() => undefined);
          await page.waitForTimeout(200);
          await page.keyboard.press("Control+a");
          await page.keyboard.type(value, { delay: 30 });
          return;
        } catch { /* tiếp tục */ }
        // Method 3: JS native setter
        log("[Đăng nhập] Dùng JS để điền trường input (Discourse/Ember)...", "warn");
        await page.evaluate((el, val) => {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeInputValueSetter) nativeInputValueSetter.call(el, val);
          else el.value = val;
          ['input', 'change', 'keyup', 'keydown'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
        }, el, value).catch(() => undefined);
      };

      if (uEl && pEl) {
        const inputType = await uEl.getAttribute("type").catch(() => "");
        if (inputType === "email" && task.email) {
          await fillInputSafe(uEl, task.email.email);
        } else {
          await fillInputSafe(uEl, username);
        }
        await fillInputSafe(pEl, password);
        
        if (submitBtn) {
          // Force click + JS click fallback (Discourse/Ember)
          try {
            await submitBtn.click({ force: true, timeout: 5000 });
          } catch {
            log("[Đăng nhập] Force click thất bại, thử JS click...", "warn");
            await page.evaluate(el => el.click(), submitBtn).catch(() => undefined);
          }
        } else {
          // Nhấn Enter nếu không tìm thấy nút
          log("[Đăng nhập] Không tìm thấy nút submit, nhấn Enter...", "warn");
          await pEl.press("Enter").catch(() => undefined);
        }
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
        loggedIn = true;
      } else {
        const loginBtn = await page.$([
          "a:has-text('Log In')", "a:has-text('Login')", "a:has-text('Sign In')", "a:has-text('Đăng nhập')", "a:has-text('Anmelden')", "a:has-text('Connexion')",
          "button:has-text('Log In')", "button:has-text('Login')", "button:has-text('Sign In')", "button:has-text('Đăng nhập')", "button:has-text('Anmelden')",
          ".login-button", ".btn-login", "header a[href*='login']", "header button[class*='login']"
        ].join(", "));
        if (loginBtn) {
          log("[Đăng nhập] Click nút đăng nhập trên thanh điều hướng...");
          await loginBtn.click();
          await page.waitForTimeout(3000);
          return await loginCMS(page, task, username, password);
        }
      }
    }

    if (loggedIn) {
      log("[Đăng nhập] Đã nộp form đăng nhập. Đang xác minh phiên...");
      await checkForSecurityScreen(page);

      // ✅ Verify login actually succeeded by looking for logout indicator
      const isLoggedIn = await page.evaluate((user) => {
        const bodyText = document.body.innerText.toLowerCase();
        
        // 1. Check for physical visible logout text on screen
        const hasLogoutText = bodyText.includes("logout") || 
                              bodyText.includes("log out") || 
                              bodyText.includes("abmelden") || 
                              bodyText.includes("đăng xuất") ||
                              bodyText.includes("deconnexion") ||
                              bodyText.includes("выход") ||
                              bodyText.includes("cerrar sesión");
        if (hasLogoutText) return true;
        
        // 2. Check for actual active logout links in DOM elements
        const logoutLink = document.querySelector("a[href*='logout'], a[href*='abmelden'], a[href*='action=logout']");
        if (logoutLink) return true;
        
        // 3. WordPress & modern SPA forums: admin bar, user menu, current user classes
        if (bodyText.includes("dashboard") || bodyText.includes("bảng tin") || document.querySelector("#wpadminbar, .current-user, #current-user, .user-menu-button, .user-dropdown")) return true;
        
        // 4. Generic/Discourse: username appears in elements or profile links
        if (user) {
          const lowerUser = user.toLowerCase();
          const userElements = document.querySelectorAll(".username, .account-name, .member-name, .p-navgroup-link--user, .current-user, [class*='avatar']");
          for (const el of userElements) {
            if (el.innerText.toLowerCase().includes(lowerUser)) return true;
            if (el.getAttribute("title") && el.getAttribute("title").toLowerCase().includes(lowerUser)) return true;
          }
          
          // Check for profile links
          const profileLinks = document.querySelectorAll(`a[href*="/u/${lowerUser}"], a[href*="/user/${lowerUser}"], a[href*="/profile/${lowerUser}"]`);
          if (profileLinks.length > 0) return true;
        }
        
        return false;
      }, username);

      if (isLoggedIn) {
        log(`[Đăng nhập] ✅ Xác minh đăng nhập thành công! Phiên cookie đang hoạt động.`, "success");
      } else {
        // Check for ban indicators
        const isBanned = await page.evaluate(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes("gesperrt") || 
                 text.includes("banned") || 
                 text.includes("sperrung") || 
                 text.includes("suspended") || 
                 text.includes("blockiert") ||
                 text.includes("bị khóa") ||
                 text.includes("vô hiệu hóa");
        });

        if (isBanned) {
          throw new Error("Tài khoản đã bị ban (gesperrt/banned) trên diễn đàn.");
        }

        // Check if we got kicked back to a login page
        const currentUrl = page.url();
        const stillOnLogin = currentUrl.includes("login") || currentUrl.includes("mode=login");
        if (stillOnLogin) {
          throw new Error(`Đăng nhập thất bại - vẫn còn trên trang login. Tài khoản có thể bị khóa hoặc mật khẩu sai.`);
        }
        log(`[Đăng nhập] ⚠️ Không xác minh được phiên nhưng đã rời khỏi trang login. Tiếp tục...`, "warn");
      }
    } else {
      log("[Đăng nhập] Không tìm thấy form đăng nhập hoặc tài khoản đã tự động đăng nhập trước đó.", "warn");
    }
  } catch (err) {
    log(`[Đăng nhập Warn] Lỗi khi cố gắng đăng nhập: ${err.message}`, "warn");
    throw err;
  }
}

// Start worker process
runWorkerLoop();

