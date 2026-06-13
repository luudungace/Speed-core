import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeVietnameseText } from "@/lib/utils/text-normalize";

export type StoredRegistrationQueueItem = {
  url: string;
  title: string | null;
  rating: string;
  score: number;
  siteType: string;
  email: string | null;
  username: string;
  password?: string;
  note?: string;
  status: string;
  updatedAt?: string;
};

export type StoredRegisteredAccount = {
  id: string;
  url: string;
  domain: string;
  email: string;
  username: string;
  password: string;
  note?: string;
  emailVerificationStatus?: string;
  emailVerificationNote?: string;
  emailVerifiedAt?: string;
  createdAt: string;
};

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "registration-queue.json");
const ACCOUNTS_FILE = path.join(STORE_DIR, "registered-accounts.json");

type AccountWriteOptions = {
  allowDelete?: boolean;
};

function normalizeItem(item: StoredRegistrationQueueItem): StoredRegistrationQueueItem {
  return {
    ...item,
    title: item.title ? normalizeVietnameseText(item.title) : null,
    email: item.email ?? null,
    username: item.username ?? "",
    note: item.note ? normalizeVietnameseText(item.note) : item.note,
    status: normalizeVietnameseText(item.status),
    updatedAt: item.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeAccount(account: StoredRegisteredAccount): StoredRegisteredAccount {
  return {
    ...account,
    note: account.note ? normalizeVietnameseText(account.note) : account.note,
    emailVerificationStatus: account.emailVerificationStatus
      ? normalizeVietnameseText(account.emailVerificationStatus)
      : account.emailVerificationStatus,
    emailVerificationNote: account.emailVerificationNote
      ? normalizeVietnameseText(account.emailVerificationNote)
      : account.emailVerificationNote,
  };
}

export async function readRegistrationQueue() {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoredRegistrationQueueItem[];
    return Array.isArray(parsed) ? parsed.map(normalizeItem) : [];
  } catch {
    return [];
  }
}

export async function writeRegistrationQueue(items: StoredRegistrationQueueItem[]) {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(items.map(normalizeItem), null, 2), "utf8");
}

export async function upsertRegistrationQueueItems(items: StoredRegistrationQueueItem[]) {
  const current = await readRegistrationQueue();
  const byUrl = new Map(current.map((item) => [item.url, item]));
  for (const item of items) {
    const existing = byUrl.get(item.url);
    const incomingHasCredentials = Boolean(item.username && item.password);
    const existingHasCredentials = Boolean(existing?.username && existing?.password);
    byUrl.set(
      item.url,
      normalizeItem({
        ...(existing ?? item),
        ...item,
        username: incomingHasCredentials || !existingHasCredentials ? item.username : existing?.username ?? "",
        password: incomingHasCredentials || !existingHasCredentials ? item.password : existing?.password,
        title: item.title ?? existing?.title ?? null,
        rating: item.rating || existing?.rating || "",
        siteType: item.siteType || existing?.siteType || "",
        score: item.score || existing?.score || 0,
        updatedAt: new Date().toISOString(),
      }),
    );
  }
  const incomingUrls = new Set(items.map((item) => item.url));
  const merged = [...current.filter((item) => !incomingUrls.has(item.url)), ...items.map((item) => byUrl.get(item.url) as StoredRegistrationQueueItem)];
  await writeRegistrationQueue(merged);
  return merged;
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export async function readRegisteredAccounts() {
  try {
    const raw = await readFile(ACCOUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoredRegisteredAccount[];
    return Array.isArray(parsed) ? parsed.map(normalizeAccount) : [];
  } catch {
    return [];
  }
}

async function writeRegisteredAccounts(accounts: StoredRegisteredAccount[], options: AccountWriteOptions = {}) {
  const next = accounts.map(normalizeAccount);
  if (!options.allowDelete) {
    const current = await readRegisteredAccounts();
    const currentKeys = new Set(current.map((account) => account.id));
    const nextKeys = new Set(next.map((account) => account.id));
    const missing = current.filter((account) => currentKeys.has(account.id) && !nextKeys.has(account.id));

    if (missing.length > 0) {
      throw new Error(
        `Refused to remove ${missing.length} registered account(s). Use deleteRegisteredAccount() for explicit deletion.`,
      );
    }
  }

  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(ACCOUNTS_FILE, JSON.stringify(next, null, 2), "utf8");
}

export async function appendRegisteredAccounts(accounts: Array<Omit<StoredRegisteredAccount, "id" | "domain" | "createdAt">>) {
  if (accounts.length === 0) return readRegisteredAccounts();
  const current = await readRegisteredAccounts();
  const now = new Date().toISOString();
  const existingKeys = new Set(current.map((account) => `${account.url}|${account.email}|${account.username}`));
  const additions = accounts
    .filter((account) => account.url && account.email && account.username && account.password)
    .filter((account) => !existingKeys.has(`${account.url}|${account.email}|${account.username}`))
    .map((account) => ({
      ...normalizeAccount(account as StoredRegisteredAccount),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      domain: getDomain(account.url),
      createdAt: now,
    }));
  const next = [...additions, ...current];
  await writeRegisteredAccounts(next);
  return next;
}

export async function deleteRegisteredAccount(id: string) {
  const current = await readRegisteredAccounts();
  const deleted = current.find((account) => account.id === id);
  if (!deleted) return { deleted: null, accounts: current };

  const accounts = current.filter((account) => account.id !== id);
  await writeRegisteredAccounts(accounts, { allowDelete: true });

  const queue = await readRegistrationQueue();
  const nextQueue = queue.map((item) =>
    item.url === deleted.url && item.email === deleted.email
      ? {
          ...item,
          status: "Không xác định",
          username: "",
          password: "",
          note: "Account đã xóa, email có thể dùng lại.",
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  await writeRegistrationQueue(nextQueue);

  return { deleted, accounts, queue: nextQueue };
}

export async function updateRegisteredAccountEmailVerification(
  id: string,
  patch: Pick<StoredRegisteredAccount, "emailVerificationStatus" | "emailVerificationNote" | "emailVerifiedAt">,
) {
  const current = await readRegisteredAccounts();
  const account = current.find((item) => item.id === id);
  if (!account) return { account: null, accounts: current };

  const nextAccount = { ...account, ...patch };
  const accounts = current.map((item) => (item.id === id ? nextAccount : item));
  await writeRegisteredAccounts(accounts);
  return { account: nextAccount, accounts };
}

export async function deleteLegacyRegisteredAccount(id: string) {
  const encoded = id.replace(/^legacy-/, "");
  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return { deleted: null, accounts: await readRegisteredAccounts(), queue: await readRegistrationQueue() };
  }
  const [url, email, username] = decoded.split("|");
  if (!url || !email || !username) {
    return { deleted: null, accounts: await readRegisteredAccounts(), queue: await readRegistrationQueue() };
  }

  const queue = await readRegistrationQueue();
  const matched = queue.find((item) => item.url === url && item.email === email && item.username === username);
  if (!matched) {
    return { deleted: null, accounts: await readRegisteredAccounts(), queue };
  }

  const nextQueue = queue.map((item) =>
    item.url === url && item.email === email && item.username === username
      ? {
          ...item,
          status: "Không xác định",
          username: "",
          password: "",
          note: "Account đã xóa, email có thể dùng lại.",
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  await writeRegistrationQueue(nextQueue);
  return {
    deleted: {
      id,
      url,
      domain: getDomain(url),
      email,
      username,
      password: matched.password ?? "",
      note: matched.note,
      createdAt: matched.updatedAt ?? new Date().toISOString(),
    },
    accounts: await readRegisteredAccounts(),
    queue: nextQueue,
  };
}
