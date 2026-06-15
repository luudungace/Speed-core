import { NextResponse } from "next/server";
import { getPublicOriginFromHeaders } from "@/lib/http/public-origin";
import { exchangeGmailOAuthCode, parseGmailOAuthState } from "@/lib/services/gmail-api-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = getPublicOriginFromHeaders(request.headers, request.url);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const redirect = new URL("/resources", origin);

  if (error) {
    redirect.searchParams.set("gmail_oauth", "error");
    redirect.searchParams.set("message", error);
    return NextResponse.redirect(redirect);
  }
  const email = state ? parseGmailOAuthState(state) : null;
  if (!code || !email) {
    redirect.searchParams.set("gmail_oauth", "error");
    redirect.searchParams.set("message", "Missing OAuth code or state.");
    return NextResponse.redirect(redirect);
  }

  try {
    await exchangeGmailOAuthCode({ code, email, origin });
    redirect.searchParams.set("gmail_oauth", "connected");
    redirect.searchParams.set("email", email);
    return NextResponse.redirect(redirect);
  } catch (exchangeError) {
    redirect.searchParams.set("gmail_oauth", "error");
    redirect.searchParams.set("message", exchangeError instanceof Error ? exchangeError.message : "OAuth exchange failed.");
    return NextResponse.redirect(redirect);
  }
}
