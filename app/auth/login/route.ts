import { createServerClient } from "@supabase/ssr";
import { getPublicOriginFromHeaders } from "@/lib/http/public-origin";
import { NextResponse, type NextRequest } from "next/server";

function loginRedirectUrl(origin: string, error: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", error);
  return url;
}

export async function POST(request: NextRequest) {
  const origin = getPublicOriginFromHeaders(request.headers, request.url);
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const homeUrl = new URL("/", origin);
  let response = NextResponse.redirect(homeUrl, { status: 303 });

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
          response = NextResponse.redirect(homeUrl, { status: 303 });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return NextResponse.redirect(loginRedirectUrl(origin, "invalid_credentials"), { status: 303 });
    }
    if (error.message.includes("Email not confirmed")) {
      return NextResponse.redirect(loginRedirectUrl(origin, "email_not_confirmed"), { status: 303 });
    }
    return NextResponse.redirect(loginRedirectUrl(origin, "auth_failed"), { status: 303 });
  }

  return response;
}
