import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type StoredEmailResource = {
  email: string;
  password: string;
  imapHost: string;
  imapPort: string;
  status: "ready" | "locked";
  updatedAt?: string;
};

type DbEmailRow = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  password: string;
  imap_host: string;
  imap_port: number;
  status: "available" | "locked" | "used";
  locked_at: string | null;
};

function mapRowToResource(row: DbEmailRow): StoredEmailResource {
  return {
    email: row.email.toLowerCase().trim(),
    password: row.password,
    imapHost: row.imap_host || "imap.gmail.com",
    imapPort: String(row.imap_port || 993),
    status: row.status === "available" ? "ready" : "locked",
    updatedAt: row.updated_at || row.created_at,
  };
}

export async function readEmailPool(): Promise<StoredEmailResource[]> {
  try {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("emails")
      .select("*")
      .order("email", { ascending: true });

    if (error) throw error;
    return (data as DbEmailRow[]).map(mapRowToResource);
  } catch (error) {
    console.error("Lỗi khi đọc Email Pool từ DB:", error);
    return [];
  }
}

export async function writeEmailPool(items: StoredEmailResource[]): Promise<StoredEmailResource[]> {
  try {
    const db = createSupabaseAdmin();
    const rows = items
      .filter((item) => item.email && item.email.includes("@"))
      .map((item) => {
        const email = item.email.toLowerCase().trim();
        return {
          email,
          password: item.password ?? "",
          imap_host: item.imapHost || "imap.gmail.com",
          imap_port: Number(item.imapPort) || 993,
          status: (item.status === "locked" ? "locked" : "available") as DbEmailRow["status"],
          updated_at: new Date().toISOString(),
        };
      });

    if (rows.length === 0) return [];

    // Sử dụng upsert trên cột email (unique constraint)
    const { data, error } = await db
      .from("emails")
      .upsert(rows, { onConflict: "email" })
      .select("*");

    if (error) throw error;
    return (data as DbEmailRow[]).map(mapRowToResource);
  } catch (error) {
    console.error("Lỗi khi ghi Email Pool vào DB:", error);
    return [];
  }
}

export async function upsertEmailPool(items: StoredEmailResource[]): Promise<StoredEmailResource[]> {
  return writeEmailPool(items);
}
