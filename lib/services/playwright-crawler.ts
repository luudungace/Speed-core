import type { CmsType, ContactItem, CrawledUrlResult, SerperResult } from "@/lib/types/crawler";
import {
  dedupeEmails,
  extractEmailsFromText,
  isLikelyEmail,
  normalizeEmail,
} from "@/lib/utils/email-extract";
import { extractPhones } from "@/lib/utils/phone-extract";

function extractEmailsFromHtml(html: string) {
  const mailtoRe = /mailto:([^"'\s?]+)/gi;
  const results: { value: string; source: ContactItem["source"] }[] = [];
  let match;
  while ((match = mailtoRe.exec(html)) !== null) {
    const email = normalizeEmail(match[1]);
    if (isLikelyEmail(email)) {
      results.push({ value: email, source: "html" });
    }
  }
  return results;
}

function detectCms(html: string): CmsType {
  const haystack = html.toLowerCase();
  if (haystack.includes("xenforo") || haystack.includes('data-template="forum_view"')) return "XenForo";
  if (haystack.includes("wp-content") || haystack.includes("wp-includes") || haystack.includes("wordpress")) return "WordPress";
  if (haystack.includes("vbulletin") || haystack.includes("vb_login") || haystack.includes("clientscript/vbulletin")) return "vBulletin";
  if (haystack.includes("phpbb") || haystack.includes("viewforum.php") || haystack.includes("styles/prosilver")) return "phpBB";
  return "Unknown";
}

function getDomain(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

export class PlaywrightCrawlerService {
  async crawl(item: SerperResult): Promise<CrawledUrlResult> {
    const started = performance.now();
    const domain = getDomain(item.url);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(item.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeout);

      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim().slice(0, 200) : null;

      const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
      const bodyText = (bodyMatch?.[0] ?? html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

      const htmlEmails = extractEmailsFromHtml(html);
      const textEmails = extractEmailsFromText(bodyText).map((value) => ({
        value,
        source: "text" as const,
      }));
      const emails = dedupeEmails([...htmlEmails, ...textEmails]);

      return {
        url: item.url,
        domain,
        title: title || item.title || null,
        cms_type: detectCms(html),
        emails,
        phones: extractPhones(html, bodyText),
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
    // No browser to close
  }
}
