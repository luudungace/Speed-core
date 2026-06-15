import { createServerClient } from "@supabase/ssr";
import { getPublicOriginFromHeaders } from "@/lib/http/public-origin";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const origin = getPublicOriginFromHeaders(request.headers, request.url);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam?.startsWith("/") ? nextParam : "/";

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "email_verification_failed");

  if (!code) {
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.redirect(new URL(next, origin));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
