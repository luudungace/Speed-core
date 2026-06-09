import { chromium, type Browser, type Page } from "playwright";
import type { CmsType, ContactItem, CrawledUrlResult, SerperResult } from "@/lib/types/crawler";
import {
  dedupeEmails,
  extractEmailsFromText,
  isLikelyEmail,
  normalizeEmail,
} from "@/lib/utils/email-extract";

const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;

function uniqueContacts(matches: string[] | null, source: ContactItem["source"], normalizer = (value: string) => value.trim()) {
  const seen = new Set<string>();
  return (matches ?? [])
    .map((value) => normalizer(value))
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, 20)
    .map((value) => ({ value, source }));
}

async function extractEmailsFromPage(page: Page): Promise<{ value: string; source: ContactItem["source"] }[]> {
  const fromDom = await page.evaluate(() => {
    const found: string[] = [];

    for (const anchor of document.querySelectorAll('a[href^="mailto:"], a[href^="MAILTO:"]')) {
      const href = anchor.getAttribute("href") ?? "";
      const addr = href.replace(/^mailto:/i, "").split("?")[0].trim();
      if (addr) found.push(addr);
    }

    for (const input of document.querySelectorAll('input[type="email"]')) {
      const value = (input as HTMLInputElement).value?.trim();
      if (value) found.push(value);
    }

    return found;
  });

  return fromDom
    .map((value) => normalizeEmail(value))
    .filter(isLikelyEmail)
    .map((value) => ({ value, source: "html" as const }));
}

function detectCms(html: string, siteUrl?: string): CmsType {
  let assetsPattern = `(?:\\/|\\.\\/|\\.\\.\\/|wp-content|wp-includes|styles|js|clientscript|ucp\\.php)`;
  if (siteUrl) {
    try {
      const parsed = new URL(siteUrl);
      const host = parsed.hostname.replace(/^www\./, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assetsPattern = `(?:(?:https?:)?\\/\\/(?:[^/]+\\.)?${host}|\\/|\\.\\/|\\.\\.\\/|wp-content|wp-includes|styles|js|clientscript|ucp\\.php)`;
    } catch {
      // ignore
    }
  }

  // 1. WordPress:
  const hasWPMeta = /<meta\s+name=["']generator["']\s+content=["']WordPress/i.test(html);
  const hasWPAssets = new RegExp(`(?:href|src)=["']${assetsPattern}[^"']*(wp-content|wp-includes)\\/`, "i").test(html);
  if (hasWPMeta || hasWPAssets) return "WordPress";

  // 2. Discourse (kiểm tra trước XenForo để tránh false-positive):
  // Discourse dùng Ember.js và có các dấu hiệu riêng biệt
  const hasDiscourse =
    html.includes("ember-application") ||
    html.includes("data-discourse") ||
    /Discourse\.SiteSettings/i.test(html) ||
    html.includes("/assets/discourse");
  if (hasDiscourse) return "Generic"; // Worker xử lý Discourse qua Generic fallback

  // 3. XenForo:
  // Dùng XF.config và các class/asset đặc trưng — BÒ data-template vì nó là generic attribute
  const hasXFConfig = /XF\.config\s*=/i.test(html);
  const hasXFAssets = new RegExp(`(?:href|src)=["']${assetsPattern}[^"']*(styles\\/default\\/xenforo|js\\/xf)\\/`, "i").test(html);
  const hasXFMeta = /<meta\s+name=["']generator["']\s+content=["']XenForo/i.test(html);
  const hasXFClass = html.includes('class="js-xenforo"') || html.includes('class="p-pagewrapper"');
  if (hasXFConfig || hasXFAssets || hasXFMeta || hasXFClass) return "XenForo";

  // 4. phpBB:
  const hasPhpBBLines = /powered\s+by\s+<a[^>]*>phpBB/i.test(html) || /powered\s+by\s+phpBB/i.test(html);
  const hasPhpBBUrls = new RegExp(`(?:href|action)=["']${assetsPattern}[^"']*(viewforum\\.php\\?f=|viewtopic\\.php\\?[ft]=|ucp\\.php\\?mode=)`, "i").test(html);
  const hasPhpBBAssets = new RegExp(`(?:href|src)=["']${assetsPattern}[^"']*(styles\\/prosilver\\/theme|styles\\/prosilver\\/imageset)\\/`, "i").test(html);
  if (hasPhpBBLines || hasPhpBBUrls || hasPhpBBAssets) return "phpBB";

  // 5. vBulletin:
  const hasVBMeta = /<meta\s+name=["']generator["']\s+content=["']vBulletin/i.test(html);
  const hasVBAssets = new RegExp(`(?:href|src)=["']${assetsPattern}[^"']*(clientscript\\/vbulletin|vb_login)`, "i").test(html);
  if (hasVBMeta || hasVBAssets) return "vBulletin";

  return "Unknown";
}


function getDomain(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

export class PlaywrightCrawlerService {
  private browser: Browser | null = null;

  private async getBrowser() {
    // Kiểm tra browser hiện tại có còn hoạt động không (tránh dùng browser đã crash)
    if (this.browser && !this.browser.isConnected()) {
      try { await this.browser.close(); } catch { /* ignore */ }
      this.browser = null;
    }
    this.browser ??= await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
    return this.browser;
  }

  async crawl(item: SerperResult): Promise<CrawledUrlResult> {
    const started = performance.now();
    const domain = getDomain(item.url);

    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      });
      page.setDefaultTimeout(20000);
      await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => undefined);

      const title = await page.title().catch(() => item.title ?? null);
      const html = await page.content();
      const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");

      const domEmails = await extractEmailsFromPage(page);
      const textEmails = extractEmailsFromText(text).map((value) => ({
        value,
        source: "text" as const,
      }));

      await page.close();

      const emails = dedupeEmails([...domEmails, ...textEmails]);

      return {
        url: item.url,
        domain,
        title: title || item.title || null,
        cms_type: detectCms(html, item.url),
        emails,
        phones: uniqueContacts(text.match(PHONE_RE), "text"),
        status: "success",
        error: null,
        crawl_time: Number(((performance.now() - started) / 1000).toFixed(3)),
        html_snippet: html.slice(0, 12000),
        raw_serper_data: item.raw,
      };
    } catch (error) {
      return {
        url: item.url,
        domain,
        title: item.title ?? null,
        cms_type: "Unknown",
        emails: [],
        phones: [],
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown crawl error",
        crawl_time: Number(((performance.now() - started) / 1000).toFixed(3)),
        html_snippet: null,
        raw_serper_data: item.raw,
      };
    }
  }

  async close() {
    await this.browser?.close();
    this.browser = null;
  }
}
