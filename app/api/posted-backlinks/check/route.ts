import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = createSupabaseAdmin();
    // Return backlinks that haven't been checked or were checked more than 24 hours ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await db
      .from("posted_backlinks")
      .select("*")
      .or(`last_checked_at.is.null,last_checked_at.lt.${oneDayAgo}`)
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ backlinks: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, isAlive } = body;

    if (!id || typeof isAlive !== "boolean") {
      return NextResponse.json({ error: "Missing required fields: id, isAlive" }, { status: 400 });
    }

    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("posted_backlinks")
      .update({
        is_alive: isAlive,
        last_checked_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ backlink: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
