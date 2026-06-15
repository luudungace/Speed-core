type HeaderSource = {
  get(name: string): string | null | undefined;
};

function readHeader(headers: HeaderSource, name: string): string | null {
  const value = headers.get(name);
  if (!value?.trim()) return null;
  return value.split(",")[0]?.trim() ?? null;
}

/**
 * Resolve the browser-facing origin behind a reverse proxy (Nginx, etc.).
 * Prefers X-Forwarded-* headers so redirects and auth callbacks use the public URL.
 */
export function getPublicOriginFromHeaders(
  headers: HeaderSource,
  fallbackUrl?: string,
): string {
  const forwardedHost = readHeader(headers, "x-forwarded-host");
  const host = forwardedHost ?? readHeader(headers, "host");

  if (host) {
    const forwardedProto = readHeader(headers, "x-forwarded-proto");
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]");
    const proto = forwardedProto ?? (isLocal ? "http" : "https");
    return `${proto}://${host}`;
  }

  if (fallbackUrl) {
    return new URL(fallbackUrl).origin;
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
