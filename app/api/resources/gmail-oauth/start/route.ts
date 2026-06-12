import { NextResponse } from "next/server";
import { buildGmailOAuthUrl } from "@/lib/services/gmail-api-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    if (!body.email || !body.email.includes("@")) {
      return NextResponse.json({ error: "Email không hợp lệ." }, { status: 422 });
    }
    const origin = new URL(request.url).origin;
    const authUrl = await buildGmailOAuthUrl(body.email, origin);
    return NextResponse.json({ authUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không tạo được Gmail OAuth URL." }, { status: 500 });
  }
}
