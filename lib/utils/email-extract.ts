import type { ContactItem } from "@/lib/types/crawler";

/** Regex trên text hiển thị — TLD phải là chữ cái, domain không bắt đầu bằng số */
const EMAIL_TEXT_RE =
  /\b[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/gi;

const INVALID_TLDS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "ico",
  "css",
  "js",
  "mjs",
  "map",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "json",
  "xml",
  "html",
  "php",
  "asp",
  "aspx",
]);

export function normalizeEmail(value: string) {
  let email = value
    .replace(/^mailto:/i, "")
    .split("?")[0]
    .trim()
    .replace(/\s*\[at\]\s*/gi, "@")
    .replace(/\s*\[dot\]\s*/gi, ".")
    .replace(/\s+/g, "");

  try {
    email = decodeURIComponent(email);
  } catch {
    // keep as-is
  }

  return email.toLowerCase();
}

export function isLikelyEmail(value: string) {
  const email = normalizeEmail(value);
  if (!email || email.length > 254) return false;
  if (/@2x/i.test(email)) return false;
  if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?)(\?|$)/i.test(email)) return false;

  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return false;

  const local = email.slice(0, at);
  const host = email.slice(at + 1);
  if (!local || !host.includes(".")) return false;
  if (/^[0-9]/.test(host)) return false;
  if (/^[0-9a-f]{24,}$/i.test(host.replace(/\./g, ""))) return false;

  const tld = host.split(".").pop() ?? "";
  if (!/^[a-z]{2,24}$/.test(tld) || INVALID_TLDS.has(tld)) return false;

  if (!/^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(email)) {
    return false;
  }

  return true;
}

export function extractEmailsFromText(text: string): string[] {
  const matches = text.match(EMAIL_TEXT_RE) ?? [];
  return matches.map(normalizeEmail).filter(isLikelyEmail);
}

export function dedupeEmails(
  items: { value: string; source: ContactItem["source"] }[],
  limit = 20,
): ContactItem[] {
  const seen = new Set<string>();
  const out: ContactItem[] = [];

  for (const item of items) {
    const normalized = normalizeEmail(item.value);
    if (!isLikelyEmail(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ value: normalized, source: item.source });
    if (out.length >= limit) break;
  }

  return out;
}
