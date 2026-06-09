import type { ContactItem } from "@/lib/types/crawler";

const TEL_HREF_RE = /href=["']tel:([^"']+)["']/gi;
const WHATSAPP_RE = /(?:https?:)?\/\/(?:wa\.me\/|(?:api\.)?whatsapp\.com\/send\?[^"'\s>]*phone=)([+\d][+\d\s().-]*)/gi;
const JSON_LD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const PHONE_CANDIDATE_RE =
  /(^|[^\w])((?:\+|00)?(?:\d[\s().-]?){6,18}\d(?:\s*(?:ext\.?|extension|x|#)\s*\d{1,6})?)(?=$|[^\w])/gi;

const CONTACT_CONTEXT_RE =
  /(contact|contacts|phone|tel|telephone|mobile|cell|cellphone|hotline|call|calling|whatsapp|viber|telegram|zalo|support|sales|office|fax|liên hệ|lien he|điện thoại|dien thoai|di động|di dong|gọi|goi|hotline|tư vấn|tu van|hỗ trợ|ho tro)/i;

const BAD_CONTEXT_RE =
  /(order|invoice|sku|product|tracking|zip|postal|postcode|views|replies|likes|copyright|since|date|updated|published|version|px|width|height|rgb|rgba)/i;

function decodePhone(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripExtension(value: string) {
  return value.replace(/\s*(?:ext\.?|extension|x|#)\s*\d{1,6}\s*$/i, "");
}

function cleanPhone(value: string) {
  return decodePhone(value)
    .replace(/^tel:/i, "")
    .replace(/[^\d+().\-\s#xext]/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[^\d+]+|[^\d)]+$/g, "")
    .trim();
}

function phoneDigits(value: string) {
  return stripExtension(value).replace(/\D/g, "");
}

function canonicalPhone(value: string) {
  const cleaned = cleanPhone(value);
  const digits = phoneDigits(cleaned);
  if (cleaned.startsWith("+")) return `+${digits}`;
  if (cleaned.startsWith("00")) return `+${digits.slice(2)}`;
  return digits;
}

function hasLikelyCountryCode(value: string) {
  const cleaned = cleanPhone(value);
  return cleaned.startsWith("+") || cleaned.startsWith("00");
}

function hasUsefulSeparators(value: string) {
  return /[\s().-]/.test(value);
}

function hasBadShape(value: string) {
  const digits = phoneDigits(value);
  if (digits.length < 7 || digits.length > 15) return true;
  if (/^(\d)\1{6,}$/.test(digits)) return true;
  if (/^(1234567|12345678|123456789|987654321)/.test(digits)) return true;
  if (/^(19|20)\d{2}$/.test(digits)) return true;
  return false;
}

function contextAround(text: string, start: number, end: number) {
  return text.slice(Math.max(0, start - 80), Math.min(text.length, end + 80));
}

function isLikelyPhone(value: string, context: string, fromTelLink = false) {
  const cleaned = cleanPhone(value);
  const digits = phoneDigits(cleaned);
  if (!cleaned || hasBadShape(cleaned)) return false;

  const hasContext = CONTACT_CONTEXT_RE.test(context);
  const badContext = BAD_CONTEXT_RE.test(context);
  const international = hasLikelyCountryCode(cleaned);

  if (fromTelLink) return true;
  if (badContext && !hasContext) return false;
  if (international && digits.length >= 8) return true;
  if (hasContext && (digits.length >= 8 || hasUsefulSeparators(cleaned))) return true;

  return false;
}

function addPhone(
  out: ContactItem[],
  seen: Set<string>,
  value: string,
  source: ContactItem["source"],
  context = "",
  fromTelLink = false,
) {
  const cleaned = cleanPhone(value);
  if (!isLikelyPhone(cleaned, context, fromTelLink)) return;

  const canonical = canonicalPhone(cleaned);
  if (!canonical || seen.has(canonical)) return;

  seen.add(canonical);
  out.push({ value: cleaned, source });
}

function collectStructuredPhones(value: unknown, out: string[]) {
  if (!value) return;

  if (typeof value === "string") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectStructuredPhones(item, out);
    return;
  }

  if (typeof value !== "object") return;

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (
      ["telephone", "phone", "faxnumber"].includes(normalizedKey) ||
      normalizedKey.endsWith("phone")
    ) {
      if (typeof nestedValue === "string") out.push(nestedValue);
      if (Array.isArray(nestedValue)) {
        for (const item of nestedValue) {
          if (typeof item === "string") out.push(item);
        }
      }
    }
    collectStructuredPhones(nestedValue, out);
  }
}

function extractStructuredPhones(html: string) {
  const phones: string[] = [];
  let match;

  while ((match = JSON_LD_RE.exec(html)) !== null) {
    try {
      collectStructuredPhones(JSON.parse(match[1].trim()), phones);
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  return phones;
}

export function extractPhones(html: string, text: string, limit = 20): ContactItem[] {
  const seen = new Set<string>();
  const out: ContactItem[] = [];

  let telMatch;
  while ((telMatch = TEL_HREF_RE.exec(html)) !== null) {
    addPhone(out, seen, telMatch[1], "html", "", true);
    if (out.length >= limit) return out;
  }

  let whatsappMatch;
  while ((whatsappMatch = WHATSAPP_RE.exec(html)) !== null) {
    addPhone(out, seen, whatsappMatch[1], "html", "", true);
    if (out.length >= limit) return out;
  }

  for (const phone of extractStructuredPhones(html)) {
    addPhone(out, seen, phone, "html", "", true);
    if (out.length >= limit) return out;
  }

  let textMatch;
  while ((textMatch = PHONE_CANDIDATE_RE.exec(text)) !== null) {
    const value = textMatch[2];
    const start = textMatch.index + textMatch[1].length;
    const end = start + value.length;
    addPhone(out, seen, value, "text", contextAround(text, start, end));
    if (out.length >= limit) return out;
  }

  return out;
}
