import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredEmailResource = {
  email: string;
  password: string;
  imapHost: string;
  imapPort: string;
  status: "ready" | "locked";
  updatedAt?: string;
};

const STORE_DIR = path.join(process.cwd(), ".data");
const EMAIL_STORE_FILE = path.join(STORE_DIR, "email-pool.json");

function normalizeEmail(item: StoredEmailResource): StoredEmailResource {
  return {
    email: item.email.toLowerCase().trim(),
    password: item.password ?? "",
    imapHost: item.imapHost || "imap.gmail.com",
    imapPort: item.imapPort || "993",
    status: item.status === "locked" ? "locked" : "ready",
    updatedAt: item.updatedAt ?? new Date().toISOString(),
  };
}

export async function readEmailPool() {
  try {
    const raw = await readFile(EMAIL_STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoredEmailResource[];
    return Array.isArray(parsed) ? parsed.map(normalizeEmail).filter((item) => item.email.includes("@")) : [];
  } catch {
    return [];
  }
}

export async function writeEmailPool(items: StoredEmailResource[]) {
  const byEmail = new Map<string, StoredEmailResource>();
  for (const item of items) {
    if (!item.email || !item.email.includes("@")) continue;
    const normalized = normalizeEmail({ ...item, updatedAt: new Date().toISOString() });
    byEmail.set(normalized.email, normalized);
  }
  await mkdir(STORE_DIR, { recursive: true });
  const rows = [...byEmail.values()];
  await writeFile(EMAIL_STORE_FILE, JSON.stringify(rows, null, 2), "utf8");
  return rows;
}

export async function upsertEmailPool(items: StoredEmailResource[]) {
  const current = await readEmailPool();
  const byEmail = new Map(current.map((item) => [item.email, item]));
  for (const item of items) {
    const normalized = normalizeEmail({ ...item, updatedAt: new Date().toISOString() });
    byEmail.set(normalized.email, normalized);
  }
  return writeEmailPool([...byEmail.values()]);
}
