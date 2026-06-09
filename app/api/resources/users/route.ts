import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type UserPoolRow = {
  id: string;
  username: string;
  display_name: string | null;
  status: "available" | "locked" | "invalid" | "disabled" | "used";
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
};

function parseBulkUsers(bulk: string) {
  const errors: string[] = [];
  const parsed = new Map<string, { username: string; displayName: string | null }>();

  bulk.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const [usernameRaw = "", displayNameRaw = ""] = trimmed.split("|").map((part) => part.trim());
    const username = usernameRaw.toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      errors.push(`Dong ${index + 1} user phai gom 3-32 ky tu: a-z, 0-9, dau ., _, -.`);
      return;
    }

    parsed.set(username, {
      username,
      displayName: displayNameRaw || null,
    });
  });

  return { rows: Array.from(parsed.values()), errors };
}

function mapDbError(message: string) {
  if (message.includes("user_pool")) {
    return "Chua apply migration 008_user_pool.sql trong Supabase nen chua luu duoc User Pool.";
  }
  return message;
}

async function listUsers() {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("user_pool")
    .select("id,username,display_name,status,locked_by,locked_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as UserPoolRow[];
}

export async function GET() {
  try {
    const rows = await listUsers();
    return NextResponse.json({ rows, count: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ rows: [], count: 0, error: mapDbError(message) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { bulk?: string };
    const { rows: parsedRows, errors } = parseBulkUsers(body.bulk ?? "");
    if (errors.length > 0) {
      return NextResponse.json({ rows: [], count: 0, error: errors.join(" ") }, { status: 400 });
    }
    if (parsedRows.length === 0) {
      return NextResponse.json({ rows: [], count: 0, error: "Ban can nhap it nhat mot user." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const db = createSupabaseAdmin();
    const { error } = await db.from("user_pool").upsert(
      parsedRows.map((row) => ({
        username: row.username,
        display_name: row.displayName,
        status: "available",
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        updated_at: now,
      })),
      { onConflict: "username" },
    );

    if (error) throw error;

    const rows = await listUsers();
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
      return NextResponse.json({ rows: [], count: 0, error: "Action khong hop le." }, { status: 400 });
    }

    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("user_pool")
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

    const rows = await listUsers();
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
      return NextResponse.json({ rows: [], count: 0, error: "Thieu id user can xoa." }, { status: 400 });
    }

    const db = createSupabaseAdmin();
    const { error } = await db.from("user_pool").delete().eq("id", id);
    if (error) throw error;

    const rows = await listUsers();
    return NextResponse.json({ rows, count: rows.length, deleted: 1 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ rows: [], count: 0, error: mapDbError(message) }, { status: 500 });
  }
}
