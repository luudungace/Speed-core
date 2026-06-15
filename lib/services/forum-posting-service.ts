import path from "node:path";
import { chromium, type Page } from "playwright";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type ForumPostingInput = {
  url: string;
  username: string;
  password?: string;
  persona: {
    displayName: string;
    bio?: string;
    gender?: string;
    country?: string;
  };
  cmsType?: string;
  isDirectLogin?: boolean;
};

export type ForumPostingResult = {
  success: boolean;
  postedUrl?: string;
  error?: string;
};

const AUTOMATION_PROFILE_DIR = path.join(process.cwd(), ".playwright-forum-profile");

// AI post content writer using Gemini API
async function generateAIPostContent(
  apiKey: string,
  persona: any,
  targetUrl: string,
  categoryTitle: string,
  isDirectLogin = false
) {
  try {
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
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const lines = text.split("\n");
        let title = `Interesting thought about ${categoryTitle}`;
        let content = text;

        const titleLine = lines.find((l: string) => l.toLowerCase().startsWith("title:"));
        if (titleLine) {
          title = titleLine.replace(/title:/i, "").trim();
          content = lines.filter((l: string) => !l.toLowerCase().startsWith("title:")).join("\n").trim();
        }
        return { title, content };
      }
    }
  } catch (err) {
    console.error("[AI Writer] Lỗi kết nối Gemini API:", err);
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

// Mimic human behavior by scrolling and clicking random thread URLs (Task 3.2)
async function lurkOnSite(page: Page, baseUrl: string) {
  try {
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href*='/threads/'], a[href*='/p/'], a[href*='viewtopic.php']"))
        .map(a => a.getAttribute("href"))
        .filter((href): href is string => typeof href === "string" && !href.startsWith("#"))
        .slice(0, 3);
    });

    if (links.length === 0) {
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(4000);
      return;
    }

    for (const link of links) {
      let fullUrl = link;
      try {
        fullUrl = new URL(link, page.url()).toString();
      } catch (err) {
        fullUrl = link.startsWith("http") ? link : `${baseUrl}${link.startsWith("/") ? "" : "/"}${link}`;
      }
      await page.goto(fullUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
      await page.evaluate(() => window.scrollBy(0, 200));
      await page.waitForTimeout(3000);
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(2000);
    }
  } catch (err: any) {
    console.warn("[Nằm vùng] Bỏ qua lỗi nằm vùng:", err.message);
  }
}

// Locate general or popular high-activity sections matching keywords or highest stats (views/posts) (Task 3.3)
async function findGeneralCategory(page: Page, baseUrl: string): Promise<{ url: string; title: string } | null> {
  try {
    // 1. Try to extract parent forum from breadcrumbs first
    const breadcrumbInfo = await page.evaluate(() => {
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
        return { url: fullUrl, title: breadcrumbInfo.title };
      } catch {}
    }

    // 2. Statistical High-Traffic Ranking Engine
    const bestCategory = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      const keywords = ["general", "introduction", "off-topic", "discussions", "chat", "seo", "marketing", "business", "tech", "lounge", "news", "forum", "public", "thảo luận", "chung", "tán gẫu"];
      const parsedSubforums = [];

      function parseStatNumber(text: string) {
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

        const isValidForumLink = hrefLower.includes("viewforum.php") || 
                                 hrefLower.includes("/forums/") || 
                                 hrefLower.includes("/forum/") ||
                                 keywords.some(k => hrefLower.includes(k));

        if (!isValidForumLink) continue;

        const title = (a.textContent || "").trim();
        const lowerTitle = title.toLowerCase();

        let parentRow = a.closest("li, tr, div[class*='node'], div[class*='row'], div[class*='forum']");
        let score = 0;
        let statsFound = false;

        if (parentRow) {
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

        if (keywords.some(k => lowerTitle.includes(k))) {
          score += 50000;
        }

        parsedSubforums.push({ href, title, score, statsFound });
      }

      parsedSubforums.sort((a, b) => b.score - a.score);
      return parsedSubforums[0] || null;
    });

    if (bestCategory && bestCategory.href) {
      try {
        const fullUrl = new URL(bestCategory.href, page.url()).toString();
        return { url: fullUrl, title: bestCategory.title };
      } catch {
        const fullUrl = bestCategory.href.startsWith("http") ? bestCategory.href : `${baseUrl}${bestCategory.href.startsWith("/") ? "" : "/"}${bestCategory.href}`;
        return { url: fullUrl, title: bestCategory.title };
      }
    }

    // 3. Fallback scan
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
          return { href, title: a.textContent.trim() };
        }
      }
      return null;
    });

    if (fallbackCategory && fallbackCategory.href) {
      const fullUrl = new URL(fallbackCategory.href, page.url()).toString();
      return { url: fullUrl, title: fallbackCategory.title };
    }
  } catch (err) {
    console.error("[Tìm chuyên mục] Lỗi:", err);
  }
  return null;
}

// Re-login helper if session is lost
async function loginCMS(page: Page, username: string, password: string) {
  try {
    const inputs = await page.$$("input:not([type='hidden'])");
    let uInput = null;
    let pInput = null;

    for (const input of inputs) {
      const name = (await input.getAttribute("name") || "").toLowerCase();
      const type = (await input.getAttribute("type") || "").toLowerCase();
      const id = (await input.getAttribute("id") || "").toLowerCase();

      if (!uInput && (name.includes("username") || name.includes("login") || id.includes("username") || id.includes("login") || type === "text")) {
        uInput = input;
      } else if (!pInput && (name.includes("password") || id.includes("password") || type === "password")) {
        pInput = input;
      }
    }

    if (uInput && pInput) {
      await uInput.fill(username);
      await pInput.fill(password);
      const submitBtn = await page.$("input[type='submit'], button[type='submit'], button:has-text('Log in'), button:has-text('Login')");
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      }
    }
  } catch (err) {
    console.error("[Login CMS] Lỗi login:", err);
  }
}

export async function postForumBacklink(input: ForumPostingInput): Promise<ForumPostingResult> {
  const targetUrl = process.env.TARGET_BACKLINK_URL || "https://speed-core.net";
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const isDirectLogin = input.isDirectLogin ?? true;

  const context = await chromium.launchPersistentContext(AUTOMATION_PROFILE_DIR, {
    headless: false,
    channel: "chromium",
    args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-blink-features=AutomationControlled"],
    viewport: { width: 1366, height: 900 },
    locale: "en-US",
    timezoneId: "Asia/Ho_Chi_Minh",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  });

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // Step 1: Nav to homepage
    await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(2000);

    // Step 2: Lurking
    await lurkOnSite(page, input.url);

    // Step 3: Find category
    const category = await findGeneralCategory(page, input.url);
    if (!category) {
      throw new Error("Không thể định vị được chuyên mục đăng bài phù hợp.");
    }

    // Step 4: Re-login if session is dead
    await page.goto(category.url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    if (currentUrl.includes("mode=login") || currentUrl.includes("ucp.php") || currentUrl.includes("login")) {
      if (input.password) {
        await loginCMS(page, input.username, input.password);
        await page.goto(category.url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
      }
    }

    // Step 5: Detect actual CMS on posting page
    const pageContent = await page.content().catch(() => "");
    let postCms = input.cmsType || "Generic";

    if (pageContent.includes("wp-content") || pageContent.includes("wp-includes")) {
      postCms = "WordPress";
    } else if (pageContent.includes("phpBB") || pageContent.includes("ucp.php") || pageContent.includes("styles/prosilver")) {
      postCms = "phpBB";
    } else if (pageContent.includes("XenForo") || pageContent.includes("js-xenforo") || pageContent.includes("xf-")) {
      postCms = "XenForo";
    }

    // Step 6: Generate post content via Gemini
    const { title: postTitle, content: postContent } = await generateAIPostContent(
      geminiKey,
      input.persona,
      targetUrl,
      category.title,
      isDirectLogin
    );

    const fullContent = postContent + `\n\nBest regards,\n${input.username}`;
    let finalPostedUrl = "";

    if (postCms === "XenForo") {
      let postBtn = await page.$("a[href*='post-thread'], a[href*='create-thread']");
      if (!postBtn) {
        const postBtnTexts = ["Post thread", "New topic", "Create thread", "New thread", "Post new topic", "Create topic", "Start thread"];
        for (const text of postBtnTexts) {
          postBtn = await page.$(`a:has-text("${text}"), button:has-text("${text}"), span:has-text("${text}")`);
          if (postBtn && await postBtn.isVisible().catch(() => false)) break;
        }
      }

      if (!postBtn) {
        const xenForoUrl = category.url.endsWith("/") ? category.url : category.url + "/";
        const directPostUrl = xenForoUrl + "post-thread";
        await page.goto(directPostUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
      } else {
        await postBtn.click();
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      }
      await page.waitForTimeout(3000);

      const titleInput = await page.$("input[name='title']");
      const editor = await page.$(".fr-element, .redactor-editor");
      const textarea = await page.$("textarea[name='message']");

      if (!titleInput || (!editor && !textarea)) {
        throw new Error("Không tìm thấy form soạn thảo XenForo.");
      }

      await titleInput.fill(postTitle);
      if (editor) {
        await editor.fill(fullContent);
      } else if (textarea) {
        await textarea.fill(fullContent);
      } else {
        throw new Error("Không tìm thấy editor hoặc textarea.");
      }

      const submitBtn = await page.$("button:has-text('Post thread'), button[class*='button--primary'], button[type='submit']");
      if (!submitBtn) throw new Error("Không tìm thấy nút gửi XenForo.");
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => undefined);
      await page.waitForTimeout(6000);

      finalPostedUrl = page.url();
      if (finalPostedUrl.includes("post-thread") || finalPostedUrl.includes("create-thread")) {
        throw new Error("Gửi bài XenForo không thành công. Form soạn thảo vẫn hiển thị.");
      }
    } else if (postCms === "phpBB") {
      let newTopicBtn = await page.$("a[href*='mode=post'], img[alt='Post new topic']");
      if (!newTopicBtn) {
        const phpBBTexts = ["New topic", "Post new topic", "Post thread", "Create topic", "Start thread"];
        for (const text of phpBBTexts) {
          newTopicBtn = await page.$(`a:has-text("${text}"), button:has-text("${text}"), img[alt*="${text}" i]`);
          if (newTopicBtn && await newTopicBtn.isVisible().catch(() => false)) break;
        }
      }

      if (!newTopicBtn) {
        const categoryUrlObj = new URL(category.url);
        const forumId = categoryUrlObj.searchParams.get("f");
        if (forumId) {
          const directPostUrl = `${categoryUrlObj.origin}/posting.php?mode=post&f=${forumId}`;
          await page.goto(directPostUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
        } else {
          throw new Error("Không tìm thấy nút New Topic trên phpBB.");
        }
      } else {
        await newTopicBtn.click();
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      }
      await page.waitForTimeout(3000);

      const subjectInput = await page.$("input[name='subject']");
      const textarea = await page.$("textarea[name='message']");
      if (!subjectInput || !textarea) throw new Error("Không tìm thấy form soạn thảo phpBB.");

      await subjectInput.fill(postTitle);
      await textarea.fill(fullContent);

      const submitBtn = await page.$("input[type='submit'][name='post']");
      if (!submitBtn) throw new Error("Không tìm thấy nút nộp bài phpBB.");
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 25000 }).catch(() => undefined);
      await page.waitForTimeout(6000);

      finalPostedUrl = page.url();
      if (finalPostedUrl.includes("posting.php")) {
        throw new Error("Gửi bài phpBB không thành công. Form soạn thảo vẫn hiển thị.");
      }
    } else {
      // Generic posting fallback
      let postBtn = await page.$("a[href*='post'], a[href*='new-topic'], a[href*='create-thread']");
      if (!postBtn) {
        const fallbackTexts = ["Post thread", "New topic", "Create thread", "New thread", "Post new topic", "Create topic", "Start thread"];
        for (const text of fallbackTexts) {
          postBtn = await page.$(`a:has-text("${text}"), button:has-text("${text}")`);
          if (postBtn && await postBtn.isVisible().catch(() => false)) break;
        }
      }

      if (postBtn) {
        await postBtn.click();
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
      }

      await page.waitForSelector("input[name*='title' i], input[name*='subject' i], textarea", { timeout: 8000 }).catch(() => undefined);
      const titleInput = await page.$("input[name*='title' i], input[name*='subject' i]");
      const textarea = await page.$("textarea");

      if (!titleInput || !textarea) {
        throw new Error("Không tìm thấy form soạn thảo bài viết.");
      }

      await titleInput.fill(postTitle);
      await textarea.fill(fullContent);

      const submitBtn = await page.$("button[type='submit'], input[type='submit']");
      if (!submitBtn) throw new Error("Không tìm thấy nút gửi bài.");
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => undefined);
      await page.waitForTimeout(6000);

      finalPostedUrl = page.url();
    }

    // Step 7: Persist backlink to database if successful
    if (finalPostedUrl && !finalPostedUrl.includes("register") && !finalPostedUrl.includes("login")) {
      const db = createSupabaseAdmin();
      await db.from("posted_backlinks").upsert({
        forum_url: input.url,
        posted_url: finalPostedUrl,
        status: "success",
        posted_at: new Date().toISOString(),
        details: {
          username: input.username,
          title: postTitle,
          category: category.title,
          categoryUrl: category.url,
          cmsType: postCms
        },
        is_alive: true,
        last_checked_at: new Date().toISOString()
      }, { onConflict: "posted_url" });

      return { success: true, postedUrl: finalPostedUrl };
    }

    throw new Error("Không lấy được URL bài viết đã đăng.");
  } catch (err: any) {
    return { success: false, error: err.message || "Lỗi không xác định khi đăng bài." };
  } finally {
    await context.close().catch(() => undefined);
  }
}
