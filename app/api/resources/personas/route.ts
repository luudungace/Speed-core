import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type PersonaPoolRow = {
  id: string;
  display_name: string;
  username_base: string;
  bio: string | null;
  gender: string | null;
  country: string | null;
  status: "available" | "locked" | "invalid" | "disabled" | "used";
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
};

type UserPoolCompatRow = {
  id: string;
  username: string;
  display_name: string | null;
  status: "available" | "locked" | "invalid" | "disabled" | "used";
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
  metadata: Record<string, unknown> | null;
};

function cleanUsernameBase(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_").slice(0, 32);
}

function isMissingPersonaTable(error: unknown) {
  const message = errorToMessage(error);
  return message.includes("persona_pool") && /schema cache|Could not find the table|PGRST205/i.test(message);
}

function mapDbError(message: string) {
  if (message.includes("schema cache") && message.includes("persona_pool")) {
    return "Supabase da co migration nhung PostgREST schema cache chua thay persona_pool. Hay chay NOTIFY pgrst, 'reload schema'; hoac doi 1-2 phut roi thu lai.";
  }
  if (message.includes("persona_pool")) {
    return "Chua apply migration 009_proxy_persona_pool.sql trong Supabase nen chua luu duoc Persona.";
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

async function listPersonas() {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("persona_pool")
    .select("id,display_name,username_base,bio,gender,country,status,locked_by,locked_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingPersonaTable(error)) return listCompatPersonas();
    throw error;
  }
  return (data ?? []) as PersonaPoolRow[];
}

function mapCompatPersona(row: UserPoolCompatRow): PersonaPoolRow {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    display_name: row.display_name ?? row.username,
    username_base: row.username,
    bio: typeof metadata.bio === "string" ? metadata.bio : null,
    gender: typeof metadata.gender === "string" ? metadata.gender : null,
    country: typeof metadata.country === "string" ? metadata.country : null,
    status: row.status,
    locked_by: row.locked_by,
    locked_at: row.locked_at,
    updated_at: row.updated_at,
  };
}

async function listCompatPersonas() {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("user_pool")
    .select("id,username,display_name,status,locked_by,locked_at,updated_at,metadata")
    .eq("metadata->>resource_kind", "persona")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as UserPoolCompatRow[]).map(mapCompatPersona);
}

export async function GET() {
  try {
    const rows = await listPersonas();
    return NextResponse.json({ rows, count: rows.length });
  } catch (err) {
    const message = errorToMessage(err);
    return NextResponse.json({ rows: [], count: 0, error: mapDbError(message) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      displayName?: string;
      usernameBase?: string;
      bio?: string;
      gender?: string;
      country?: string;
    };
    const displayName = body.displayName?.trim() ?? "";
    const usernameBase = cleanUsernameBase(body.usernameBase ?? "");

    if (!displayName) {
      return NextResponse.json({ rows: [], count: 0, error: "Display name la bat buoc." }, { status: 400 });
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(usernameBase)) {
      return NextResponse.json({ rows: [], count: 0, error: "Username base phai gom 3-32 ky tu: a-z, 0-9, dau ., _, -." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const db = createSupabaseAdmin();
    const payload = {
      display_name: displayName,
      username_base: usernameBase,
      bio: body.bio?.trim() || null,
      gender: body.gender?.trim() || null,
      country: body.country?.trim() || null,
      status: "available",
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      updated_at: now,
    };
    const { error } = await db.from("persona_pool").upsert(
      {
        ...payload,
      },
      { onConflict: "username_base" },
    );

    if (error) {
      if (!isMissingPersonaTable(error)) throw error;
      const { error: compatError } = await db.from("user_pool").upsert(
        {
          username: usernameBase,
          display_name: displayName,
          status: "available",
          locked_by: null,
          locked_at: null,
          lock_expires_at: null,
          updated_at: now,
          metadata: {
            resource_kind: "persona",
            bio: payload.bio,
            gender: payload.gender,
            country: payload.country,
          },
        },
        { onConflict: "username" },
      );
      if (compatError) throw compatError;
    }

    const rows = await listPersonas();
    return NextResponse.json({ rows, count: rows.length, saved: 1 });
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
      return NextResponse.json({ rows: [], count: 0, error: "Thieu id persona can xoa." }, { status: 400 });
    }

    const db = createSupabaseAdmin();
    const { error } = await db.from("persona_pool").delete().eq("id", id);
    if (error) {
      if (!isMissingPersonaTable(error)) throw error;
      const { error: compatError } = await db.from("user_pool").delete().eq("id", id).eq("metadata->>resource_kind", "persona");
      if (compatError) throw compatError;
    }

    const rows = await listPersonas();
    return NextResponse.json({ rows, count: rows.length, deleted: 1 });
  } catch (err) {
    const message = errorToMessage(err);
    return NextResponse.json({ rows: [], count: 0, error: mapDbError(message) }, { status: 500 });
  }
}
