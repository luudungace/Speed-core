import { NextResponse } from "next/server";
import {
  deleteGmailOAuthToken,
  readGmailOAuthConfig,
  readGmailOAuthTokens,
  writeGmailOAuthConfig,
} from "@/lib/services/gmail-oauth-store";

export const runtime = "nodejs";

export async function GET() {
  const [config, tokens] = await Promise.all([readGmailOAuthConfig(), readGmailOAuthTokens()]);
  return NextResponse.json({
    configured: Boolean(config),
    clientId: config?.clientId ?? "",
    connectedEmails: tokens.map((token) => ({
      email: token.email,
      updatedAt: token.updatedAt,
      scope: token.scope,
    })),
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { clientId?: string; clientSecret?: string };
  if (!body.clientId?.trim() || !body.clientSecret?.trim()) {
    return NextResponse.json({ error: "Thiếu client_id hoặc client_secret." }, { status: 422 });
  }
  const config = await writeGmailOAuthConfig({ clientId: body.clientId, clientSecret: body.clientSecret });
  return NextResponse.json({ configured: true, clientId: config.clientId });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email." }, { status: 400 });
  const tokens = await deleteGmailOAuthToken(email);
  return NextResponse.json({ connectedEmails: tokens.map((token) => ({ email: token.email, updatedAt: token.updatedAt })) });
}
