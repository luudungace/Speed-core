import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam?.startsWith("/") ? nextParam : "/";

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "email_verification_failed");

  if (!code) {
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
