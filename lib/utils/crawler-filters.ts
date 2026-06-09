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
    });
}

export function normalizeDomain(input: string) {
  try {
    return new URL(input).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
}

export function uniqueByDomain<T>(items: T[], getUrlOrDomain: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const domain = normalizeDomain(getUrlOrDomain(item));
    if (!domain || seen.has(domain)) return false;
    seen.add(domain);
    return true;
  });
}

export function isHostnameExcluded(hostname: string, excludeDomains: string[]) {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return excludeDomains.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

export function isUrlExcluded(url: string, excludeDomains: string[]) {
  if (excludeDomains.length === 0) return false;
  try {
    const hostname = new URL(url).hostname;
    return isHostnameExcluded(hostname, excludeDomains);
  } catch {
    return true;
  }
}
