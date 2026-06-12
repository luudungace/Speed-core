import type { SerperResult } from "@/lib/types/crawler";
import { isUrlExcluded } from "@/lib/utils/crawler-filters";

const BACKLINKS_SH_ENDPOINT = "https://api.backlinks.sh/v1/backlinks";

type BacklinksShItem = {
  source_url?: string;
  target_url?: string;
  source_domain?: string;
  target_domain?: string;
  is_active?: boolean;
  first_seen?: string;
  last_seen?: string;
  seen_quarters?: number;
  rankings?: Record<string, unknown>;
};

type BacklinksShResponse = {
  data?: {
    backlinks?: BacklinksShItem[];
  };
};

function sourceDomainUrl(domain: string) {
  return `https://${domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]}/`;
}

export class BacklinksShService {
  private apiKey = process.env.BACKLINKS_SH_API_KEY;

  async findSources(target: string, limit: number, excludeDomains: string[] = []): Promise<SerperResult[]> {
    if (!this.apiKey) throw new Error("Missing BACKLINKS_SH_API_KEY.");

    const normalizedTarget = target.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!normalizedTarget || !normalizedTarget.includes(".")) return [];

    const url = new URL(BACKLINKS_SH_ENDPOINT);
    url.searchParams.set("target", normalizedTarget);
    url.searchParams.set("sort", "rank");
    url.searchParams.set("limit", String(Math.max(1, Math.min(1000, limit))));

    const response = await fetch(url, {
      headers: {
        "x-api-key": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`backlinks.sh error ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as BacklinksShResponse;
    return (payload.data?.backlinks ?? [])
      .filter((item) => item.is_active !== false)
      .map((item) => {
        const sourceUrl = item.source_url?.trim() || (item.source_domain ? sourceDomainUrl(item.source_domain) : "");
        return { item, sourceUrl };
      })
      .filter(({ sourceUrl }) => sourceUrl && !isUrlExcluded(sourceUrl, excludeDomains))
      .map(({ item, sourceUrl }) => ({
        url: sourceUrl,
        title: item.source_domain,
        snippet: `Backlink source for ${normalizedTarget}`,
        raw: {
          provider: "backlinks.sh",
          target: normalizedTarget,
          ...item,
        },
      }));
  }

  async findManySources(targets: string[], limitPerTarget: number, excludeDomains: string[] = []) {
    const byUrl = new Map<string, SerperResult>();
    for (const target of targets) {
      const results = await this.findSources(target, limitPerTarget, excludeDomains);
      for (const result of results) byUrl.set(result.url, result);
    }
    return [...byUrl.values()];
  }
}
