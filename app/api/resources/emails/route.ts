import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EmailPoolRow = {
  id: string;
  email: string;
  password_value: string;
  imap_host: string;
  imap_port: number;
  status: "available" | "locked" | "invalid" | "disabled" | "used";
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
};

function parseBulkEmails(bulk: string) {
  const errors: string[] = [];
  const parsed = new Map<string, { email: string; passwordValue: string }>();

  bulk.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const separatorIndex = trimmed.indexOf("|");
    if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
      errors.push(`Dòng ${index + 1} phải đúng dạng email|password.`);
      return;
    }

    const email = trimmed.slice(0, separatorIndex).trim().toLowerCase();
    const passwordValue = trimmed.slice(separatorIndex + 1).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Dòng ${index + 1} có email không hợp lệ.`);
      return;
    }

    parsed.set(email, { email, passwordValue });
  });

  return { rows: Array.from(parsed.values()), errors };
}

function mapDbError(message: string) {
  if (message.includes("email_pool")) {
    return "Chưa apply migration 005_resource_pools.sql trong Supabase nên chưa lưu được Email Pool.";
  }
  return message;
}

async function listEmails() {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("email_pool")
    .select("id,email,password_value,imap_host,imap_port,status,locked_by,locked_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as EmailPoolRow[];
}

export async function GET() {
  try {
    const rows = await listEmails();
    return NextResponse.json({ rows, count: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ rows: [], count: 0, error: mapDbError(message) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { bulk?: string; imapHost?: string; imapPort?: number };
    const imapHost = body.imapHost?.trim().toLowerCase() ?? "";
    const imapPort = Number(body.imapPort);

    if (!imapHost) {
      return NextResponse.json({ rows: [], count: 0, error: "IMAP host là bắt buộc." }, { status: 400 });
    }
    if (!Number.isInteger(imapPort) || imapPort < 1 || imapPort > 65535) {
      return NextResponse.json({ rows: [], count: 0, error: "Port phải là số từ 1 đến 65535." }, { status: 400 });
    }

    const { rows: parsedRows, errors } = parseBulkEmails(body.bulk ?? "");
    if (errors.length > 0) {
      return NextResponse.json({ rows: [], count: 0, error: errors.join(" ") }, { status: 400 });
    }
    if (parsedRows.length === 0) {
      return NextResponse.json({ rows: [], count: 0, error: "Bạn cần nhập ít nhất một email." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const db = createSupabaseAdmin();
    const { error } = await db.from("email_pool").upsert(
      parsedRows.map((row) => ({
        email: row.email,
        password_value: row.passwordValue,
        imap_host: imapHost,
        imap_port: imapPort,
        status: "available",
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        updated_at: now,
      })),
      { onConflict: "email" },
    );

    if (error) throw error;

    const rows = await listEmails();
    return NextResponse.json({ rows, count: rows.length, saved: parsedRows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ rows: [], count: 0, error: mapDbError(message) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { action?: string };
    if (body.action !== "unlock_stuck") {
      return NextResponse.json({ rows: [], count: 0, error: "Action không hợp lệ." }, { status: 400 });
    }

    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("email_pool")
      .update({
        status: "available",
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("status", "locked")
      .select("id");

    if (error) throw error;

    const rows = await listEmails();
    return NextResponse.json({ rows, count: rows.length, unlocked: data?.length ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ rows: [], count: 0, error: mapDbError(message) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim();

    if (!id) {
      return NextResponse.json({ rows: [], count: 0, error: "Thiáº¿u id email cáº§n xÃ³a." }, { status: 400 });
    }

    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("email_pool")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) throw error;

    const rows = await listEmails();
    return NextResponse.json({ rows, count: rows.length, deleted: data?.length ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ rows: [], count: 0, error: mapDbError(message) }, { status: 500 });
  }
}
