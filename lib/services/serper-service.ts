import type { SerperResult } from "@/lib/types/crawler";
import { isUrlExcluded } from "@/lib/utils/crawler-filters";

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
    const autoAllPages = pages <= 0; // Nếu truyền <= 0, tự động cào cho đến khi hết trang
    const maxLoops = autoAllPages ? 100 : pages; // Giới hạn tối đa 100 trang để tránh cạn tài khoản API vô ý
    
    let page = 1;
    while (page <= maxLoops) {
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
      const organicItems = payload.organic ?? [];
      
      // Nếu không còn kết quả tìm kiếm nào ở trang này, dừng cào dork này
      if (organicItems.length === 0) {
        break;
      }

      for (const item of organicItems) {
        if (!item.link || !isAllowedUrl(item.link, excludeDomains)) continue;
        results.push({
          url: item.link,
          title: item.title,
          snippet: item.snippet,
          position: item.position,
          raw: { ...item, dork: query, page },
        });
      }

      page += 1;
    }

    return results;
  }

  async searchMany(
    dorks: string[],
    pagesPerDork: number,
    excludeDomains: string[] = [],
  ): Promise<SerperResult[]> {
    // Thu thập tất cả URL từ các dorks
    const byUrl = new Map<string, SerperResult>();
    for (const dork of dorks) {
      const results = await this.searchDork(dork, pagesPerDork, excludeDomains);
      for (const result of results) byUrl.set(result.url, result);
    }

    // ✅ Dedup theo DOMAIN: chỉ giữ 1 URL đại diện mỗi domain
    // Ưu tiên URL ngắn hơn (gần root hơn) — tránh URL bài viết cụ thể
    const byDomain = new Map<string, SerperResult>();
    for (const result of byUrl.values()) {
      try {
        const hostname = new URL(result.url).hostname.replace(/^www\./, "");
        const existing = byDomain.get(hostname);
        if (!existing || result.url.length < existing.url.length) {
          byDomain.set(hostname, result);
        }
      } catch {
        // URL không hợp lệ, bỏ qua
      }
    }

    return [...byDomain.values()];
  }
}
