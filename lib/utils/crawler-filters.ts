export const DEFAULT_EXCLUDE_DOMAINS = [
  "google.com", "google.com.vn", "google.co.uk", "google.co.jp", "google.fr", "google.de", "google.it", "google.es", "google.ca", "google.com.au",
  "bing.com", "yahoo.com", "yandex.ru", "duckduckgo.com", "baidu.com", "yandex.com",
  "facebook.com", "youtube.com", "twitter.com", "instagram.com", "linkedin.com", "pinterest.com",
  "tiktok.com", "wikipedia.org", "w3schools.com", "github.com", "gitlab.com", "stackoverflow.com",
  "stackexchange.com", "medium.com", "quora.com", "reddit.com", "wordpress.com", "blogger.com",
  "blogspot.com", "tumblr.com", "netflix.com", "amazon.com", "ebay.com", "apple.com", "microsoft.com",
  "pinterest.co.uk", "t.co", "bit.ly", "tinyurl.com", "youtu.be", "vimeo.com"
];

export function normalizeExcludeDomains(input: unknown): string[] {
  if (typeof input !== "string") return [];
  const seen = new Set<string>();

  return input
    .split(/[\r\n,;]+/)
    .map((line) =>
      line
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0],
    )
    .filter((domain) => {
      if (!domain || !domain.includes(".")) return false;
      if (seen.has(domain)) return false;
      seen.add(domain);
      return true;
    })
    .slice(0, 100);
}

export function isHostnameExcluded(hostname: string, excludeDomains: string[]) {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return excludeDomains.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

export function isUrlExcluded(url: string, excludeDomains: string[]) {
  const mergedExcludes = [...new Set([...DEFAULT_EXCLUDE_DOMAINS, ...excludeDomains])];
  try {
    const hostname = new URL(url).hostname;
    return isHostnameExcluded(hostname, mergedExcludes);
  } catch {
    return true;
  }
}
