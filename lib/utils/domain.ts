/**
 * Standardizes a domain string.
 * Example: "https://www.google.com/search?q=test" -> "google.com"
 */
export function normalizeDomain(input: string): string {
  let cleaned = input.trim().toLowerCase();
  
  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//i, "");
  
  // Split path, query, hash
  cleaned = cleaned.split("/")[0].split("?")[0].split("#")[0];
  
  // Remove www. prefix
  cleaned = cleaned.replace(/^www\./i, "");
  
  // Remove trailing dots/spaces
  cleaned = cleaned.replace(/\.+$/, "").trim();
  
  // Simple validation: must have at least one dot and some chars around it
  if (!cleaned.includes(".") || cleaned.length < 3) {
    return "";
  }
  
  return cleaned;
}

/**
 * Extracts the domain from a URL using the URL parser, falling back to basic normalization.
 */
export function getDomainFromUrl(url: string): string {
  if (!url) return "";
  try {
    let parsedUrl = url.trim();
    if (!/^https?:\/\//i.test(parsedUrl)) {
      parsedUrl = "https://" + parsedUrl;
    }
    const host = new URL(parsedUrl).hostname;
    return host.replace(/^www\./i, "").toLowerCase();
  } catch (e) {
    return normalizeDomain(url);
  }
}

/**
 * Normalizes a list of domains from a string (newline/comma separated).
 */
export function normalizeDomainList(input: string, max?: number): string[] {
  if (!input) return [];
  
  const domains = input
    .split(/[\n,;]+/)
    .map((item) => normalizeDomain(item))
    .filter(Boolean);
    
  const unique = [...new Set(domains)];
  
  if (max !== undefined) {
    return unique.slice(0, max);
  }
  
  return unique;
}
