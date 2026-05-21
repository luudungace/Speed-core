import { chromium, type Browser } from "playwright";
import type { CmsType, ContactItem, CrawledUrlResult, SerperResult } from "@/lib/types/crawler";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+(?:\s?\[at\]\s?|\s?@\s?)[a-zA-Z0-9.-]+(?:\s?\[dot\]\s?|\s?\.\s?)[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;

function normalizeEmail(value: string) {
  return value.replace(/\s*\[at\]\s*/gi, "@").replace(/\s*\[dot\]\s*/gi, ".").replace(/\s+/g, "");
}

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

function detectCms(html: string): CmsType {
  const haystack = html.toLowerCase();
  if (haystack.includes("xenforo") || haystack.includes("data-template=\"forum_view\"")) return "XenForo";
  if (haystack.includes("wp-content") || haystack.includes("wp-includes") || haystack.includes("wordpress")) return "WordPress";
  if (haystack.includes("vbulletin") || haystack.includes("vb_login") || haystack.includes("clientscript/vbulletin")) return "vBulletin";
  if (haystack.includes("phpbb") || haystack.includes("viewforum.php") || haystack.includes("styles/prosilver")) return "phpBB";
  return "Unknown";
}

function getDomain(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

export class PlaywrightCrawlerService {
  private browser: Browser | null = null;

  private async getBrowser() {
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
      await page.close();

      const combined = `${html}\n${text}`;
      return {
        url: item.url,
        domain,
        title: title || item.title || null,
        cms_type: detectCms(html),
        emails: uniqueContacts(combined.match(EMAIL_RE), "html", normalizeEmail),
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
