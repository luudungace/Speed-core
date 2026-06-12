import {
  readGmailOAuthConfig,
  readGmailOAuthToken,
  upsertGmailOAuthToken,
  type GmailOAuthToken,
} from "@/lib/services/gmail-oauth-store";
import { randomUUID } from "node:crypto";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GmailMessageListResponse = {
  messages?: Array<{ id?: string }>;
};

type GmailMessageResponse = {
  payload?: GmailPayloadPart;
  snippet?: string;
};

type GmailPayloadPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
};

export type GmailVerificationLookup =
  | { status: "missing-token"; note: string }
  | { status: "not-found"; note: string }
  | { status: "error"; note: string }
  | { status: "found"; note: string; link: string };

function makeState(email: string) {
  return Buffer.from(JSON.stringify({ email: email.toLowerCase().trim(), nonce: randomUUID() }), "utf8").toString("base64url");
}

export function parseGmailOAuthState(state: string) {
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as { email?: string };
    return typeof parsed.email === "string" && parsed.email.includes("@") ? parsed.email.toLowerCase().trim() : null;
  } catch {
    return null;
  }
}

export async function buildGmailOAuthUrl(email: string, origin: string) {
  const config = await readGmailOAuthConfig();
  if (!config) throw new Error("Chưa cấu hình Google OAuth client.");

  const redirectUri = `${origin}/auth/gmail/callback`;
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", makeState(email));
  url.searchParams.set("login_hint", email);
  return url.toString();
}

async function postGoogleToken(params: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const payload = (await response.json()) as TokenResponse;
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || "Google token exchange failed.");
  }
  return payload;
}

export async function exchangeGmailOAuthCode(input: { code: string; email: string; origin: string }) {
  const config = await readGmailOAuthConfig();
  if (!config) throw new Error("Chưa cấu hình Google OAuth client.");

  const payload = await postGoogleToken({
    code: input.code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: `${input.origin}/auth/gmail/callback`,
    grant_type: "authorization_code",
  });

  if (!payload.refresh_token) {
    throw new Error("Google không trả refresh_token. Hãy revoke quyền app rồi kết nối lại với prompt consent.");
  }

  return upsertGmailOAuthToken({
    email: input.email,
    refreshToken: payload.refresh_token,
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(0, (payload.expires_in ?? 3600) - 60) * 1000,
    scope: payload.scope,
    tokenType: payload.token_type,
  });
}

async function getAccessToken(token: GmailOAuthToken) {
  if (token.accessToken && token.expiresAt && token.expiresAt > Date.now()) return token.accessToken;

  const config = await readGmailOAuthConfig();
  if (!config) throw new Error("Chưa cấu hình Google OAuth client.");

  const payload = await postGoogleToken({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: token.refreshToken,
    grant_type: "refresh_token",
  });

  const saved = await upsertGmailOAuthToken({
    ...token,
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(0, (payload.expires_in ?? 3600) - 60) * 1000,
    scope: payload.scope ?? token.scope,
    tokenType: payload.token_type ?? token.tokenType,
  });
  if (!saved.accessToken) throw new Error("Google không trả access_token.");
  return saved.accessToken;
}

function base64UrlDecode(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function collectMessageText(part?: GmailPayloadPart): string {
  if (!part) return "";
  const chunks: string[] = [];
  if (part.body?.data) chunks.push(base64UrlDecode(part.body.data));
  for (const child of part.parts ?? []) chunks.push(collectMessageText(child));
  return chunks.join("\n");
}

function extractLinks(text: string) {
  const hrefLinks = [...text.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
  const plainLinks = [...text.matchAll(/https?:\/\/[^\s"'<>\\)]+/gi)].map((match) => match[0]);
  return [...new Set([...hrefLinks, ...plainLinks].map((link) => link.replace(/&amp;/g, "&").replace(/[.,;]+$/g, "")))];
}

function scoreVerificationLink(link: string, domain: string) {
  let score = 0;
  const lower = link.toLowerCase();
  if (domain && lower.includes(domain.toLowerCase())) score += 25;
  if (/activate|activation|verify|verification|confirm|validate|email/.test(lower)) score += 45;
  if (/ucp\.php.*mode=activate|account.*activate|confirm.*email/.test(lower)) score += 40;
  if (/unsubscribe|privacy|terms|login|reset|password/.test(lower)) score -= 60;
  return score;
}

async function gmailGet<T>(accessToken: string, url: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const payload = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Gmail API request failed.");
  return payload;
}

export async function findGmailApiVerificationLink(email: string, domain: string): Promise<GmailVerificationLookup> {
  const token = await readGmailOAuthToken(email);
  if (!token) return { status: "missing-token", note: "Email chưa kết nối Gmail OAuth." };

  try {
    const accessToken = await getAccessToken(token);
    const query = `newer_than:14d (${domain ? `{from:${domain} ${domain}}` : ""} subject:(activate OR activation OR verify OR verification OR confirm OR registration))`;
    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    listUrl.searchParams.set("q", query);
    listUrl.searchParams.set("maxResults", "20");
    const list = await gmailGet<GmailMessageListResponse>(accessToken, listUrl.toString());
    const ids = (list.messages ?? []).map((message) => message.id).filter(Boolean).slice(0, 20) as string[];

    const links: string[] = [];
    for (const id of ids) {
      const messageUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
      messageUrl.searchParams.set("format", "full");
      const message = await gmailGet<GmailMessageResponse>(accessToken, messageUrl.toString());
      links.push(...extractLinks(`${message.snippet ?? ""}\n${collectMessageText(message.payload)}`));
    }

    const best = links
      .map((link) => ({ link, score: scoreVerificationLink(link, domain) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (!best) return { status: "not-found", note: "Gmail API đọc được mailbox nhưng chưa tìm thấy link xác nhận." };
    return { status: "found", note: "Tìm thấy link xác nhận qua Gmail API.", link: best.link };
  } catch (error) {
    return { status: "error", note: error instanceof Error ? error.message : "Gmail API lookup failed." };
  }
}
