import type { SerperResult } from "@/lib/types/crawler";
import { isUrlExcluded, normalizeDomain } from "@/lib/utils/crawler-filters";

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const BLOCKED_HOSTS = [
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "linkedin.com",
  "pinterest.com",
  "tiktok.com",
];

type SerperOrganicItem = {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
};

function isAllowedUrl(url: string, excludeDomains: string[] = []) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (isUrlExcluded(url, excludeDomains)) return false;
    return !BLOCKED_HOSTS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
  } catch {
    return false;
  }
}

export class SerperService {
  private apiKey = process.env.SERPER_API_KEY;

  async searchDork(query: string, pages: number, excludeDomains: string[] = []): Promise<SerperResult[]> {
    if (!this.apiKey) throw new Error("Missing SERPER_API_KEY.");

    const results: SerperResult[] = [];
    for (let page = 1; page <= pages; page += 1) {
      const response = await fetch(SERPER_ENDPOINT, {
        method: "POST",
        headers: {
          "X-API-KEY": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          page,
          num: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`Serper error ${response.status}: ${await response.text()}`);
      }

      const payload = (await response.json()) as { organic?: SerperOrganicItem[] };
      for (const item of payload.organic ?? []) {
        if (!item.link || !isAllowedUrl(item.link, excludeDomains)) continue;
        results.push({
          url: item.link,
          title: item.title,
          snippet: item.snippet,
          position: item.position,
          raw: { ...item, dork: query, page },
        });
      }
    }

    return results;
  }

  async searchMany(
    dorks: string[],
    pagesPerDork: number,
    excludeDomains: string[] = [],
  ): Promise<SerperResult[]> {
    const byDomain = new Map<string, SerperResult>();
    for (const dork of dorks) {
      const results = await this.searchDork(dork, pagesPerDork, excludeDomains);
      for (const result of results) {
        const domain = normalizeDomain(result.url);
        if (!byDomain.has(domain)) byDomain.set(domain, result);
      }
    }
    return [...byDomain.values()];
  }
}
