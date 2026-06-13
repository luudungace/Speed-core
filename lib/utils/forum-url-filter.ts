export type UrlDepthFilter = "all" | "domain_only" | "domain_plus_one" | "deep";

export const URL_DEPTH_OPTIONS: { value: UrlDepthFilter; label: string }[] = [
  { value: "all", label: "Tất cả URL" },
  { value: "domain_only", label: "Chỉ domain" },
  { value: "domain_plus_one", label: "Domain + 1 path" },
  { value: "deep", label: "URL sâu (bài viết)" },
];

const FORUM_POST_PATH_RE =
  /\/(threads\/[^/]+\.\d+|viewtopic\.php|showthread\.php|post-\d+\.html|topic\/\d+|t\/[^/]+)(\/|$|\?)/i;
const WP_POST_PATH_RE = /\/\d{4}\/\d{2}\/[^/]+/i;
const DEEP_PATH_RE =
  /\/(new-thread|post-thread|new-topic|create-thread|reply|post-reply|write-for-us|contribute)(\/|$|\?|-)/i;

export function getUrlPathSegments(url: string) {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, "");
    if (!pathname || pathname === "/") return [];
    return pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.toLowerCase());
  } catch {
    return [];
  }
}

export function isForumPostUrl(url: string) {
  const haystack = url.toLowerCase();
  return FORUM_POST_PATH_RE.test(haystack) || WP_POST_PATH_RE.test(haystack) || DEEP_PATH_RE.test(haystack);
}

export function classifyUrlDepth(url: string): Exclude<UrlDepthFilter, "all"> {
  const segments = getUrlPathSegments(url);
  if (segments.length === 0) return "domain_only";
  if (segments.length === 1) return "domain_plus_one";
  if (segments.length >= 2 || isForumPostUrl(url)) return "deep";
  return "domain_plus_one";
}

export function matchesUrlDepth(url: string, filter: UrlDepthFilter) {
  if (filter === "all") return true;

  const segments = getUrlPathSegments(url);
  if (filter === "domain_only") return segments.length === 0;
  if (filter === "domain_plus_one") return segments.length === 1;
  if (filter === "deep") return segments.length >= 2 || isForumPostUrl(url);
  return true;
}

export function parseUrlDepthFilter(value: string | null | undefined): UrlDepthFilter {
  if (value === "domain_only" || value === "domain_plus_one" || value === "deep") return value;
  return "all";
}
