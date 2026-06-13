import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type GmailOAuthConfig = {
  clientId: string;
  clientSecret: string;
};

export type GmailOAuthToken = {
  email: string;
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
  updatedAt: string;
};

const STORE_DIR = path.join(process.cwd(), ".data");
const CONFIG_FILE = path.join(STORE_DIR, "gmail-oauth-config.json");
const TOKENS_FILE = path.join(STORE_DIR, "gmail-oauth-tokens.json");

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

export async function readGmailOAuthConfig() {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as GmailOAuthConfig;
    if (!parsed.clientId || !parsed.clientSecret) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeGmailOAuthConfig(config: GmailOAuthConfig) {
  await mkdir(STORE_DIR, { recursive: true });
  const next = {
    clientId: config.clientId.trim(),
    clientSecret: config.clientSecret.trim(),
  };
  await writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function readGmailOAuthTokens() {
  try {
    const raw = await readFile(TOKENS_FILE, "utf8");
    const parsed = JSON.parse(raw) as GmailOAuthToken[];
    return Array.isArray(parsed) ? parsed.map((item) => ({ ...item, email: normalizeEmail(item.email) })) : [];
  } catch {
    return [];
  }
}

export async function upsertGmailOAuthToken(token: Omit<GmailOAuthToken, "updatedAt">) {
  const current = await readGmailOAuthTokens();
  const email = normalizeEmail(token.email);
  const nextToken = { ...token, email, updatedAt: new Date().toISOString() };
  const next = [nextToken, ...current.filter((item) => item.email !== email)];
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(TOKENS_FILE, JSON.stringify(next, null, 2), "utf8");
  return nextToken;
}

export async function readGmailOAuthToken(email: string) {
  const normalized = normalizeEmail(email);
  return (await readGmailOAuthTokens()).find((item) => item.email === normalized) ?? null;
}

export async function deleteGmailOAuthToken(email: string) {
  const normalized = normalizeEmail(email);
  const current = await readGmailOAuthTokens();
  const next = current.filter((item) => item.email !== normalized);
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(TOKENS_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}
