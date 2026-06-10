import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ProxyPoolRow = {
  id: string;
  endpoint: string;
  proxy_type: string;
  host: string;
  port: number;
  username: string | null;
  status: "available" | "locked" | "invalid" | "disabled" | "used";
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
};

function parseProxyLine(line: string, proxyType: string) {
  const parts = line.trim().split(":");
  if (parts.length !== 2 && parts.length !== 4) return null;

  const [host = "", portRaw = "", username = "", passwordValue = ""] = parts.map((part) => part.trim());
  const port = Number(portRaw);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;

  return {
    endpoint: parts.length === 4 ? `${host}:${port}:${username}:${passwordValue}` : `${host}:${port}`,
    proxy_type: proxyType,
    host,
    port,
    username: username || null,
    password_value: passwordValue || null,
  };
}

function parseBulkProxies(bulk: string, proxyType: string) {
  const errors: string[] = [];
  const parsed = new Map<string, NonNullable<ReturnType<typeof parseProxyLine>>>();

  bulk.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const row = parseProxyLine(trimmed, proxyType);
    if (!row) {
      errors.push(`Dong ${index + 1} phai dung dang host:port hoac host:port:user:pass.`);
      return;
    }
    parsed.set(row.endpoint, row);
  });

  return { rows: Array.from(parsed.values()), errors };
}

function mapDbError(message: string) {
  if (message.includes("schema cache") && message.includes("proxy_pool")) {
    return "Supabase da co migration nhung PostgREST schema cache chua thay proxy_pool. Hay chay NOTIFY pgrst, 'reload schema'; hoac doi 1-2 phut roi thu lai.";
  }
  if (message.includes("proxy_pool")) {
    return "Chua apply migration 009_proxy_persona_pool.sql trong Supabase nen chua luu duoc Proxy.";
  }
  return message;
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length > 0) return parts.join(" ");
    try {
      return JSON.stringify(record);
    } catch {
      return "Loi Supabase khong doc duoc noi dung.";
    }
  }
  return String(error);
}

async function listProxies() {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("proxy_pool")
    .select("id,endpoint,proxy_type,host,port,username,status,locked_by,locked_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProxyPoolRow[];
}

export async function GET() {
  try {
    const rows = await listProxies();
    return NextResponse.json({ rows, count: rows.length });
  } catch (err) {
    const message = errorToMessage(err);
    return NextResponse.json({ rows: [], count: 0, error: mapDbError(message) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { bulk?: string; proxyType?: string };
    const proxyType = body.proxyType?.trim().toLowerCase() || "residential";
    const { rows: parsedRows, errors } = parseBulkProxies(body.bulk ?? "", proxyType);
    if (errors.length > 0) {
      return NextResponse.json({ rows: [], count: 0, error: errors.join(" ") }, { status: 400 });
    }
    if (parsedRows.length === 0) {
      return NextResponse.json({ rows: [], count: 0, error: "Ban can nhap it nhat mot proxy." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const db = createSupabaseAdmin();
    const { error } = await db.from("proxy_pool").upsert(
      parsedRows.map((row) => ({
        ...row,
        status: "available",
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        updated_at: now,
      })),
      { onConflict: "endpoint" },
    );

    if (error) throw error;

    const rows = await listProxies();
    return NextResponse.json({ rows, count: rows.length, saved: parsedRows.length });
  } catch (err) {
    const message = errorToMessage(err);
    return NextResponse.json({ rows: [], count: 0, error: mapDbError(message) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ rows: [], count: 0, error: "Thieu id proxy can xoa." }, { status: 400 });
    }

    const db = createSupabaseAdmin();
    const { error } = await db.from("proxy_pool").delete().eq("id", id);
    if (error) throw error;

    const rows = await listProxies();
    return NextResponse.json({ rows, count: rows.length, deleted: 1 });
  } catch (err) {
    const message = errorToMessage(err);
    return NextResponse.json({ rows: [], count: 0, error: mapDbError(message) }, { status: 500 });
  }
}
