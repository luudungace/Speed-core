import { createSupabaseAdmin } from "@/lib/supabase/admin";
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

type DbQueueRow = {
  url: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  rating: string;
  score: number;
  site_type: string;
  email: string | null;
  username: string;
  password?: string;
  status: string;
  note?: string;
};

type DbAccountRow = {
  id: string;
  created_at: string;
  url: string;
  domain: string;
  email: string;
  username: string;
  password: string;
  note: string | null;
  email_verification_status: string | null;
  email_verification_note: string | null;
  email_verified_at: string | null;
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

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function mapQueueRowToItem(row: DbQueueRow): StoredRegistrationQueueItem {
  return {
    url: row.url,
    title: row.title,
    rating: row.rating,
    score: row.score,
    siteType: row.site_type,
    email: row.email,
    username: row.username,
    password: row.password,
    status: row.status,
    note: row.note,
    updatedAt: row.updated_at || row.created_at,
  };
}

function mapAccountRowToAccount(row: DbAccountRow): StoredRegisteredAccount {
  return {
    id: row.id,
    url: row.url,
    domain: row.domain,
    email: row.email,
    username: row.username,
    password: row.password,
    note: row.note ?? undefined,
    emailVerificationStatus: row.email_verification_status ?? undefined,
    emailVerificationNote: row.email_verification_note ?? undefined,
    emailVerifiedAt: row.email_verified_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function readRegistrationQueue(): Promise<StoredRegistrationQueueItem[]> {
  try {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("registration_queue")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data as DbQueueRow[]).map(mapQueueRowToItem).map(normalizeItem);
  } catch (error) {
    console.error("Lỗi khi đọc registration_queue từ DB:", error);
    return [];
  }
}

export async function writeRegistrationQueue(items: StoredRegistrationQueueItem[]) {
  try {
    const db = createSupabaseAdmin();
    const normalized = items.map(normalizeItem);
    const rows = normalized.map((item) => ({
      url: item.url,
      title: item.title,
      rating: item.rating,
      score: item.score,
      site_type: item.siteType,
      email: item.email,
      username: item.username,
      password: item.password,
      status: item.status,
      note: item.note,
      updated_at: item.updatedAt ?? new Date().toISOString(),
    }));

    if (rows.length === 0) return;

    const { error } = await db
      .from("registration_queue")
      .upsert(rows, { onConflict: "url" });

    if (error) throw error;
  } catch (error) {
    console.error("Lỗi khi ghi registration_queue vào DB:", error);
  }
}

export async function upsertRegistrationQueueItems(items: StoredRegistrationQueueItem[]) {
  try {
    const db = createSupabaseAdmin();
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
  } catch (error) {
    console.error("Lỗi khi upsertRegistrationQueueItems:", error);
    return [];
  }
}

export async function readRegisteredAccounts(): Promise<StoredRegisteredAccount[]> {
  try {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("registered_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data as DbAccountRow[]).map(mapAccountRowToAccount).map(normalizeAccount);
  } catch (error) {
    console.error("Lỗi khi đọc registered_accounts từ DB:", error);
    return [];
  }
}

export async function appendRegisteredAccounts(accounts: Array<Omit<StoredRegisteredAccount, "id" | "domain" | "createdAt">>) {
  if (accounts.length === 0) return readRegisteredAccounts();
  try {
    const db = createSupabaseAdmin();
    const current = await readRegisteredAccounts();
    const existingKeys = new Set(current.map((account) => `${account.url}|${account.email}|${account.username}`));

    const additions = accounts
      .filter((account) => account.url && account.email && account.username && account.password)
      .filter((account) => !existingKeys.has(`${account.url}|${account.email}|${account.username}`))
      .map((account) => {
        const normalized = normalizeAccount(account as StoredRegisteredAccount);
        return {
          url: normalized.url,
          domain: getDomain(normalized.url),
          email: normalized.email,
          username: normalized.username,
          password: normalized.password,
          note: normalized.note ?? null,
          email_verification_status: normalized.emailVerificationStatus ?? null,
          email_verification_note: normalized.emailVerificationNote ?? null,
          email_verified_at: normalized.emailVerifiedAt ?? null,
        };
      });

    if (additions.length > 0) {
      const { error } = await db.from("registered_accounts").insert(additions);
      if (error) throw error;
    }

    return readRegisteredAccounts();
  } catch (error) {
    console.error("Lỗi khi appendRegisteredAccounts:", error);
    return readRegisteredAccounts();
  }
}

export async function deleteRegisteredAccount(id: string) {
  try {
    const db = createSupabaseAdmin();
    const current = await readRegisteredAccounts();
    const deleted = current.find((account) => account.id === id);
    if (!deleted) return { deleted: null, accounts: current };

    const { error } = await db.from("registered_accounts").delete().eq("id", id);
    if (error) throw error;

    const remainingAccounts = current.filter((account) => account.id !== id);

    // Cập nhật trạng thái trong hàng đợi registration_queue
    const queue = await readRegistrationQueue();
    const matchedQueueItem = queue.find((item) => item.url === deleted.url && item.email === deleted.email);
    if (matchedQueueItem) {
      matchedQueueItem.status = "Không xác định";
      matchedQueueItem.username = "";
      matchedQueueItem.password = "";
      matchedQueueItem.note = "Account đã xóa, email có thể dùng lại.";
      matchedQueueItem.updatedAt = new Date().toISOString();
      await writeRegistrationQueue([matchedQueueItem]);
    }

    const updatedQueue = await readRegistrationQueue();

    return { deleted, accounts: remainingAccounts, queue: updatedQueue };
  } catch (error) {
    console.error("Lỗi khi xóa registered account:", error);
    return { deleted: null, accounts: await readRegisteredAccounts(), queue: await readRegistrationQueue() };
  }
}

export async function updateRegisteredAccountEmailVerification(
  id: string,
  patch: Pick<StoredRegisteredAccount, "emailVerificationStatus" | "emailVerificationNote" | "emailVerifiedAt">,
) {
  try {
    const db = createSupabaseAdmin();
    const current = await readRegisteredAccounts();
    const account = current.find((item) => item.id === id);
    if (!account) return { account: null, accounts: current };

    const updateData = {
      email_verification_status: patch.emailVerificationStatus ?? null,
      email_verification_note: patch.emailVerificationNote ?? null,
      email_verified_at: patch.emailVerifiedAt ?? null,
    };

    const { error } = await db
      .from("registered_accounts")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    const updatedAccount = { ...account, ...patch };
    const accounts = current.map((item) => (item.id === id ? updatedAccount : item));
    return { account: updatedAccount, accounts };
  } catch (error) {
    console.error("Lỗi khi cập nhật email verification:", error);
    return { account: null, accounts: await readRegisteredAccounts() };
  }
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

  matched.status = "Không xác định";
  matched.username = "";
  matched.password = "";
  matched.note = "Account đã xóa, email có thể dùng lại.";
  matched.updatedAt = new Date().toISOString();

  await writeRegistrationQueue([matched]);
  const nextQueue = await readRegistrationQueue();

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
