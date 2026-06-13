import { chromium, type Browser, type Page } from "playwright";
import type { CmsType, ContactItem, CrawledUrlResult, SerperResult } from "@/lib/types/crawler";
import {
  dedupeEmails,
  extractEmailsFromText,
  isLikelyEmail,
  normalizeEmail,
} from "@/lib/utils/email-extract";
import { detectBacklinkCandidate, type BacklinkCandidate, type PageLink } from "@/lib/utils/backlink-candidate";
import { detectManualReviewReason, formatManualReviewError } from "@/lib/utils/manual-review";
import { detectRegistrationOpportunity, formatRegistrationStatus } from "@/lib/utils/registration-opportunity";

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

async function extractPageLinks(page: Page): Promise<PageLink[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => {
        const element = anchor as HTMLAnchorElement;
        return {
          href: element.href,
          text: element.innerText || element.getAttribute("aria-label") || element.getAttribute("title") || "",
        };
      })
      .filter((link) => /^https?:\/\//i.test(link.href))
      .slice(0, 250),
  );
}

function rawWithCandidate(raw: Record<string, unknown>, candidate: BacklinkCandidate) {
  return {
    ...raw,
    backlink_candidate: candidate,
  };
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
      const links = await extractPageLinks(page).catch(() => []);

      const manualReviewReason = detectManualReviewReason({ title, html, text });
      const cmsType = detectCms(html);
      const candidate = detectBacklinkCandidate({ url: item.url, html, text, cmsType, links });
      if (manualReviewReason) {
        await page.close();
        return {
          url: item.url,
          domain,
          title: title || item.title || null,
          cms_type: cmsType,
          emails: [],
          phones: [],
          status: "failed",
          error: formatManualReviewError(manualReviewReason),
          crawl_time: Number(((performance.now() - started) / 1000).toFixed(3)),
          html_snippet: html.slice(0, 12000),
          raw_serper_data: rawWithCandidate(item.raw, candidate),
        };
      }

      const domEmails = await extractEmailsFromPage(page);
      const textEmails = extractEmailsFromText(text).map((value) => ({
        value,
        source: "text" as const,
      }));

      await page.close();

      const emails = dedupeEmails([...domEmails, ...textEmails]);
      const hasRegistration = detectRegistrationOpportunity({ url: item.url, html, text });

      return {
        url: item.url,
        domain,
        title: title || item.title || null,
        cms_type: cmsType,
        emails,
        phones: uniqueContacts(text.match(PHONE_RE), "text"),
        status: "success",
        error: formatRegistrationStatus(hasRegistration),
        crawl_time: Number(((performance.now() - started) / 1000).toFixed(3)),
        html_snippet: html.slice(0, 12000),
        raw_serper_data: rawWithCandidate(item.raw, candidate),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown crawl error";
      const manualReviewReason = detectManualReviewReason({ title: item.title, error: errorMessage });
      const candidate = detectBacklinkCandidate({
        url: item.url,
        text: [item.title, item.snippet, JSON.stringify(item.raw)].filter(Boolean).join("\n"),
        cmsType: "Unknown",
      });

      return {
        url: item.url,
        domain,
        title: item.title ?? null,
        cms_type: "Unknown",
        emails: [],
        phones: [],
        status: "failed",
        error: manualReviewReason ? formatManualReviewError(manualReviewReason) : errorMessage,
        crawl_time: Number(((performance.now() - started) / 1000).toFixed(3)),
        html_snippet: null,
        raw_serper_data: rawWithCandidate(item.raw, candidate),
      };
    }
  }

  async close() {
    await this.browser?.close();
    this.browser = null;
  }
}
