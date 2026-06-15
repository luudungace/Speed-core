import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("posted_backlinks")
      .select("*")
      .order("posted_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ backlinks: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { forum_url, posted_url, status, details } = body;

    if (!forum_url || !posted_url) {
      return NextResponse.json({ error: "Missing required fields: forum_url, posted_url" }, { status: 400 });
    }

    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("posted_backlinks")
      .upsert({
        forum_url,
        posted_url,
        status: status || "success",
        posted_at: new Date().toISOString(),
        details: details || {},
        is_alive: true,
        last_checked_at: new Date().toISOString(),
      }, { onConflict: "posted_url" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ backlink: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
