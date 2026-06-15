import { createServerClient } from "@supabase/ssr";
import { getPublicOriginFromHeaders } from "@/lib/http/public-origin";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const publicOrigin = getPublicOriginFromHeaders(request.headers, request.url);

  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/posted-backlinks");

  if (!user && !isPublicPath) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/login", publicOrigin));
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", publicOrigin));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
