import type { CrawlResultRow } from "@/lib/types/crawler";
import { getAuthLinks } from "@/lib/utils/auth-links";

const REGISTER_HINT_RE = /register|signup|sign-up|join|create-account|dang-ky|đăng ký|注册|登録|registr/i;

export type RegistrationCandidate = {
  domain: string;
  url: string;
  cmsType: string;
  score: number;
  source: "cms_pattern" | "crawler_url" | "html_link";
  reason: string;
};

function resolveUrl(href: string, baseUrl: string) {
  try {
    const url = new URL(href, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function sameDomain(url: string, domain: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === domain.replace(/^www\./, "");
  } catch {
    return false;
  }
}

function uniqueCandidates(candidates: RegistrationCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function discoverRegistrationCandidates(row: CrawlResultRow): RegistrationCandidate[] {
  const candidates: RegistrationCandidate[] = [];
  const cmsLinks = getAuthLinks({ url: row.url, domain: row.domain, cmsType: row.cms_type });
  const knownCms = row.cms_type !== "Unknown";

  candidates.push({
    domain: row.domain,
    url: cmsLinks.register,
    cmsType: row.cms_type,
    score: knownCms ? 75 : 45,
    source: "cms_pattern",
    reason: knownCms ? "CMS pattern register URL" : "Default register URL fallback",
  });

  if (REGISTER_HINT_RE.test(row.url)) {
    candidates.push({
      domain: row.domain,
      url: row.url,
      cmsType: row.cms_type,
      score: 70,
      source: "crawler_url",
      reason: "Crawler URL already looks like registration",
    });
  }

  const snippet = row.html_snippet ?? "";
  const hrefs = Array.from(snippet.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
    .map((match) => match[1])
    .filter((href) => REGISTER_HINT_RE.test(href))
    .map((href) => resolveUrl(href, row.url))
    .filter((url): url is string => Boolean(url))
    .filter((url) => sameDomain(url, row.domain))
    .slice(0, 8);

  hrefs.forEach((url) => {
    candidates.push({
      domain: row.domain,
      url,
      cmsType: row.cms_type,
      score: 85,
      source: "html_link",
      reason: "Registration-like href found in crawled HTML",
    });
  });

  return uniqueCandidates(candidates).sort((a, b) => b.score - a.score);
}
