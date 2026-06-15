import { createServerClient } from "@supabase/ssr";
import { getPublicOriginFromHeaders } from "@/lib/http/public-origin";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const origin = getPublicOriginFromHeaders(request.headers, request.url);
  const redirectUrl = new URL("/", origin);
  let response = NextResponse.redirect(redirectUrl);

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
          response = NextResponse.redirect(redirectUrl);
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  await supabase.auth.signOut();
  return response;
}
